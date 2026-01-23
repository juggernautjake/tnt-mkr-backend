import { Context } from 'koa';
import easypostService from '../../../services/easypost';
import shippingCalculator from '../../../services/shipping-calculator';
import googleSheets from '../../../services/google-sheets';
import orderEmailTemplates from '../../../services/order-email-templates';

// Helper function to check if user is admin
async function isAdmin(ctx: Context): Promise<boolean> {
  const { user } = ctx.state;
  
  // Debug: Log the user state
  strapi.log.info(`[ADMIN CHECK] User state exists: ${!!user}`);
  
  if (!user) {
    strapi.log.warn('[ADMIN CHECK] No user in context state - authentication may have failed');
    return false;
  }
  
  strapi.log.info(`[ADMIN CHECK] User ID: ${user.id}, checking role...`);
  
  try {
    const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
      populate: ['role'],
    });
    
    if (!userWithRole) {
      strapi.log.warn(`[ADMIN CHECK] User ${user.id} not found in database`);
      return false;
    }
    
    if (!userWithRole.role) {
      strapi.log.warn(`[ADMIN CHECK] User ${user.id} has no role assigned`);
      return false;
    }
    
    const role = userWithRole.role as any;
    const roleName = role.name?.toLowerCase() || '';
    const roleType = role.type?.toLowerCase() || '';
    
    strapi.log.info(`[ADMIN CHECK] User ${user.id} - Role name: "${role.name}", Role type: "${role.type}"`);
    
    // Check for various admin role patterns
    const isAdminRole = 
      roleName === 'admin' || 
      roleName === 'administrator' ||
      roleName.includes('admin') ||
      roleType === 'admin' ||
      roleType === 'administrator' ||
      roleType.includes('admin');
    
    strapi.log.info(`[ADMIN CHECK] User ${user.id} - Is admin: ${isAdminRole}`);
    
    return isAdminRole;
  } catch (error) {
    strapi.log.error('[ADMIN CHECK] Error checking admin role:', error);
    return false;
  }
}

// Valid unified order status values
type OrderStatus = 'pending' | 'paid' | 'printing' | 'printed' | 'assembling' | 'packaged' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'canceled' | 'returned';

// Helper function to map EasyPost status to order status
function mapTrackingStatusToOrderStatus(trackingStatus: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    'pre_transit': 'shipped',
    'in_transit': 'in_transit',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'delivered',
    'return_to_sender': 'returned',
    'failure': 'returned',
    'cancelled': 'canceled',
    'error': 'shipped',
    'unknown': 'shipped',
  };
  return statusMap[trackingStatus] || 'shipped';
}

export default {
  // Validate an address
  async validateAddress(ctx: Context) {
    const { address } = ctx.request.body as { address: any };

    if (!address || !address.street || !address.city || !address.state || !address.postal_code) {
      return ctx.badRequest('Missing required address fields: street, city, state, postal_code');
    }

    if (!easypostService.isValidContinentalUS(address.state)) {
      return ctx.send({
        is_valid: false,
        error: 'We currently only ship to the continental United States (excludes Alaska, Hawaii, and US territories).',
      });
    }

    try {
      const result = await easypostService.validateAddress({
        street: address.street,
        street2: address.street2 || '',
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        phone: address.phone || '',
      });

      return ctx.send(result);
    } catch (error: any) {
      strapi.log.error('Address validation error:', error);
      return ctx.badRequest('Failed to validate address', { error: error.message });
    }
  },

  // Get shipping rates for cart items
  async getRates(ctx: Context) {
    const { address, cart_items } = ctx.request.body as { address: any; cart_items: any[] };

    if (!address || !address.state || !address.postal_code) {
      return ctx.badRequest('Missing required address fields');
    }

    if (!cart_items || cart_items.length === 0) {
      return ctx.badRequest('Cart items are required');
    }

    if (!easypostService.isValidContinentalUS(address.state)) {
      return ctx.badRequest('We currently only ship to the continental United States (excludes Alaska, Hawaii, and US territories).');
    }

    try {
      const boxes = await strapi.entityService.findMany('api::shipping-box.shipping-box' as any, {
        filters: { is_active: true },
        sort: { priority: 'asc' },
      });

      const enrichedCartItems = await Promise.all(
        cart_items.map(async (item: any) => {
          let product = null;
          let cartItemParts: any[] = [];

          if (item.product_id) {
            product = await strapi.entityService.findOne('api::product.product', item.product_id, {
              fields: ['id', 'weight_oz', 'length', 'width', 'height'],
            });
          }

          if (item.cart_item_parts && item.cart_item_parts.length > 0) {
            cartItemParts = await Promise.all(
              item.cart_item_parts.map(async (part: any) => {
                const productPart = part.product_part_id
                  ? await strapi.entityService.findOne('api::product-part.product-part', part.product_part_id, {
                      fields: ['id', 'weight_oz', 'length', 'width', 'height'],
                    })
                  : null;
                return { product_part: productPart };
              })
            );
          }

          return {
            product,
            quantity: item.quantity || 1,
            is_additional_part: item.is_additional_part || false,
            cart_item_parts: cartItemParts,
          };
        })
      );

      const redis = strapi.redis;
      const result = await shippingCalculator.getShippingRates(
        {
          street: address.street || '',
          street2: address.street2 || '',
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          phone: address.phone || '',
        },
        enrichedCartItems,
        boxes as any,
        redis
      );

      return ctx.send({
        rates: result.rates,
        packages: result.packages,
        shipment_id: result.shipment_id,
        cached: result.cached,
        fallback_used: result.fallback_used,
      });
    } catch (error: any) {
      strapi.log.error('Get shipping rates error:', error);
      return ctx.badRequest('Failed to get shipping rates', { error: error.message });
    }
  },

  // Admin: Get orders for management
  async getAdminOrders(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { status, search, page = 1, pageSize = 50 } = ctx.query;

    try {
      const filters: any = {};
      if (status) {
        filters.order_status = status;
      }
      if (search) {
        filters.$or = [
          { order_number: { $containsi: search } },
          { customer_name: { $containsi: search } },
          { customer_email: { $containsi: search } },
          { guest_email: { $containsi: search } },
          { tracking_number: { $containsi: search } },
        ];
      }

      const orders = await strapi.entityService.findMany('api::order.order', {
        filters,
        sort: { ordered_at: 'desc' },
        populate: {
          order_items: {
            populate: {
              product: { fields: ['id', 'name', 'weight_oz'] },
              order_item_parts: {
                populate: {
                  product_part: { fields: ['id', 'name', 'weight_oz'] },
                  color: { fields: ['id', 'name'] },
                },
              },
            },
          },
          shipping_address: true,
          billing_address: true,
          shipping_box: true,
          user: { fields: ['id', 'email', 'username'] },
        },
        start: (Number(page) - 1) * Number(pageSize),
        limit: Number(pageSize),
      });

      const total = await strapi.db.query('api::order.order').count({ where: filters });

      return ctx.send({
        orders,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          pageCount: Math.ceil(total / Number(pageSize)),
        },
      });
    } catch (error: any) {
      strapi.log.error('Get admin orders error:', error);
      return ctx.internalServerError('Failed to get orders', { error: error.message });
    }
  },

  // Admin: Update order shipping info
  async updateOrderShipping(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { id } = ctx.params;
    const updateFields = ctx.request.body as any;

    try {
      const order = await strapi.entityService.findOne('api::order.order', id);

      if (!order) {
        return ctx.notFound('Order not found');
      }

      const updateData: any = {};

      if (updateFields.tracking_number !== undefined) updateData.tracking_number = updateFields.tracking_number;
      if (updateFields.carrier_service !== undefined) updateData.carrier_service = updateFields.carrier_service;
      if (updateFields.package_weight_oz !== undefined) updateData.package_weight_oz = updateFields.package_weight_oz;
      if (updateFields.package_length !== undefined) updateData.package_length = updateFields.package_length;
      if (updateFields.package_width !== undefined) updateData.package_width = updateFields.package_width;
      if (updateFields.package_height !== undefined) updateData.package_height = updateFields.package_height;
      if (updateFields.shipping_box_id !== undefined) updateData.shipping_box = updateFields.shipping_box_id;
      if (updateFields.admin_notes !== undefined) updateData.admin_notes = updateFields.admin_notes;
      if (updateFields.admin_hidden !== undefined) updateData.admin_hidden = updateFields.admin_hidden;

      if (Object.keys(updateData).length === 0) {
        return ctx.badRequest('No valid fields to update');
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: updateData,
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          shipping_box: true,
          user: true,
        },
      });

      if (!updateFields.admin_hidden) {
        try {
          await googleSheets.upsertOrder(updatedOrder as any);
        } catch (sheetError) {
          strapi.log.error('Failed to update Google Sheet:', sheetError);
        }
      }

      return ctx.send({ order: updatedOrder });
    } catch (error: any) {
      strapi.log.error('Update order shipping error:', error);
      return ctx.internalServerError('Failed to update order', { error: error.message });
    }
  },

  // Admin: Update unified order status with optional tracking number and email notification
  async updateOrderStatus(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { id } = ctx.params;
    const { 
      order_status, 
      tracking_number, 
      carrier_service,
      send_email = false
    } = ctx.request.body as { 
      order_status: string;
      tracking_number?: string;
      carrier_service?: string;
      send_email?: boolean;
    };

    const validStatuses: OrderStatus[] = ['pending', 'paid', 'printing', 'printed', 'assembling', 'packaged', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'canceled', 'returned'];
    if (!order_status || !validStatuses.includes(order_status as OrderStatus)) {
      return ctx.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      }) as any;

      if (!order) {
        return ctx.notFound('Order not found');
      }

      const previousStatus = order.order_status;
      const updateData: any = {
        order_status: order_status,
      };

      if (order_status === 'shipped') {
        if (!order.shipped_at) {
          updateData.shipped_at = new Date().toISOString();
        }
        
        if (tracking_number && tracking_number.trim()) {
          updateData.tracking_number = tracking_number.trim();
          updateData.carrier_service = carrier_service || 'USPS';
          
          try {
            const trackerResult = await easypostService.createTracker(tracking_number.trim(), carrier_service || 'USPS');
            if (trackerResult.id) {
              updateData.easypost_tracker_id = trackerResult.id;
            }
            
            if (trackerResult.status && trackerResult.status !== 'pre_transit') {
              const mappedStatus = mapTrackingStatusToOrderStatus(trackerResult.status);
              if (mappedStatus !== 'shipped') {
                updateData.order_status = mappedStatus;
              }
            }
            
            if (trackerResult.est_delivery_date) {
              updateData.estimated_delivery_date = trackerResult.est_delivery_date;
            }
            
            if (trackerResult.status === 'delivered' && trackerResult.delivered_at) {
              updateData.delivered_at = trackerResult.delivered_at;
            }
          } catch (trackerError) {
            strapi.log.error('Failed to create EasyPost tracker:', trackerError);
          }
        }
      }

      if (order_status === 'delivered' && !order.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: updateData,
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      let emailResult: { success: boolean; reason?: string; sentTo?: string; bcc?: string; error?: string } = { success: false, reason: 'not_requested' };
      
      if (send_email) {
        const finalStatus = updateData.order_status || order_status;
        emailResult = await orderEmailTemplates.sendStatusNotificationEmail(
          strapi,
          updatedOrder as any,
          finalStatus
        );
        
        if (emailResult.success && finalStatus === 'shipped' && tracking_number) {
          await strapi.entityService.update('api::order.order', id, {
            data: { shipping_notification_sent: true },
          });
        }
      }

      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet:', sheetError);
      }

      strapi.log.info(`[STATUS UPDATE] Order ${order.order_number}: Changed status from "${previousStatus}" to "${updateData.order_status}"${tracking_number ? ` with tracking ${tracking_number}` : ''}${send_email ? ' (email requested)' : ''}`);

      return ctx.send({
        order: updatedOrder,
        previous_status: previousStatus,
        new_status: updateData.order_status,
        tracking_added: !!tracking_number,
        email_sent: emailResult.success,
        email_details: emailResult,
        message: `Order status updated from "${previousStatus}" to "${updateData.order_status}"`,
      });
    } catch (error: any) {
      strapi.log.error('Update order status error:', error);
      return ctx.internalServerError('Failed to update order status', { error: error.message });
    }
  },

  // Admin: Mark order as shipped and send notification
  async markAsShipped(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { id } = ctx.params;
    const { tracking_number, carrier_service = 'USPS' } = ctx.request.body as any;

    if (!tracking_number) {
      return ctx.badRequest('Tracking number is required');
    }

    try {
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      let easypostTrackerId = '';
      let currentTrackingStatus: OrderStatus = 'shipped';
      let estimatedDeliveryDate = null;
      let deliveredAt = null;

      try {
        const trackerResult = await easypostService.createTracker(tracking_number, carrier_service);
        easypostTrackerId = trackerResult.id || '';
        
        if (trackerResult.status) {
          currentTrackingStatus = mapTrackingStatusToOrderStatus(trackerResult.status);
          strapi.log.info(`[TRACKING] Order ${(order as any).order_number}: EasyPost status is "${trackerResult.status}", mapped to "${currentTrackingStatus}"`);
        }
        
        if (trackerResult.est_delivery_date) {
          estimatedDeliveryDate = trackerResult.est_delivery_date;
        }
        
        if (trackerResult.status === 'delivered' && trackerResult.delivered_at) {
          deliveredAt = trackerResult.delivered_at;
        }
      } catch (trackerError) {
        strapi.log.error('Failed to create EasyPost tracker:', trackerError);
      }

      const updateData: any = {
        tracking_number,
        carrier_service,
        order_status: currentTrackingStatus,
        shipped_at: new Date().toISOString(),
        easypost_tracker_id: easypostTrackerId,
      };

      if (estimatedDeliveryDate) {
        updateData.estimated_delivery_date = estimatedDeliveryDate;
      }

      if (deliveredAt) {
        updateData.delivered_at = deliveredAt;
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: updateData,
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      // Send shipping notification email
      let emailResult: { success: boolean; reason?: string; sentTo?: string; bcc?: string; error?: string } = { success: false, reason: 'not_attempted' };
      const customerEmail = (order as any).customer_email || (order as any).guest_email || (order as any).user?.email;
      if (customerEmail && !(order as any).shipping_notification_sent) {
        emailResult = await orderEmailTemplates.sendStatusNotificationEmail(
          strapi,
          updatedOrder as any,
          'shipped'
        );
        if (emailResult.success) {
          await strapi.entityService.update('api::order.order', id, {
            data: { shipping_notification_sent: true },
          });
        }
      } else if ((order as any).shipping_notification_sent) {
        emailResult = { success: true, reason: 'already_sent' } as any;
      }

      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet:', sheetError);
      }

      return ctx.send({ 
        order: updatedOrder,
        tracking_status: currentTrackingStatus,
        email_sent: emailResult.success,
        email_details: emailResult,
      });
    } catch (error: any) {
      strapi.log.error('Mark as shipped error:', error);
      return ctx.internalServerError('Failed to mark order as shipped', { error: error.message });
    }
  },

  // Admin: Refresh tracking status for a single order
  async refreshTrackingStatus(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { id } = ctx.params;

    try {
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      }) as any;

      if (!order) {
        return ctx.notFound('Order not found');
      }

      if (!order.tracking_number) {
        return ctx.badRequest('Order has no tracking number');
      }

      const trackingResult = await easypostService.getTrackingStatus(
        order.tracking_number,
        order.carrier_service || 'USPS'
      );

      if (!trackingResult) {
        return ctx.badRequest('Could not fetch tracking status');
      }

      const newOrderStatus = mapTrackingStatusToOrderStatus(trackingResult.status);
      
      const updateData: any = {
        order_status: newOrderStatus,
      };

      if (trackingResult.est_delivery_date) {
        updateData.estimated_delivery_date = trackingResult.est_delivery_date;
      }

      if (trackingResult.status === 'delivered' && trackingResult.delivered_at) {
        updateData.delivered_at = trackingResult.delivered_at;
      }

      if (trackingResult.id && !order.easypost_tracker_id) {
        updateData.easypost_tracker_id = trackingResult.id;
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: updateData,
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet:', sheetError);
      }

      strapi.log.info(`[TRACKING REFRESH] Order ${order.order_number}: Updated status from "${order.order_status}" to "${newOrderStatus}"`);

      return ctx.send({
        order: updatedOrder,
        previous_status: order.order_status,
        new_status: newOrderStatus,
        tracking_details: trackingResult,
      });
    } catch (error: any) {
      strapi.log.error('Refresh tracking status error:', error);
      return ctx.internalServerError('Failed to refresh tracking status', { error: error.message });
    }
  },

  // Admin: Refresh all tracking statuses for shipped orders
  async refreshAllTrackingStatuses(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    try {
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: {
          tracking_number: { $notNull: true, $ne: '' },
          order_status: { $in: ['shipped', 'in_transit', 'out_for_delivery'] },
        } as any,
        populate: {
          shipping_address: true,
          user: true,
        },
        limit: 100,
      }) as any[];

      const results: Array<{ order_number: string; success: boolean; previous_status?: string; new_status?: string; error?: string }> = [];

      for (const order of orders) {
        try {
          const trackingResult = await easypostService.getTrackingStatus(
            order.tracking_number,
            order.carrier_service || 'USPS'
          );

          if (trackingResult) {
            const newOrderStatus = mapTrackingStatusToOrderStatus(trackingResult.status);
            
            if (newOrderStatus !== order.order_status) {
              const updateData: any = {
                order_status: newOrderStatus,
              };

              if (trackingResult.est_delivery_date) {
                updateData.estimated_delivery_date = trackingResult.est_delivery_date;
              }

              if (trackingResult.status === 'delivered' && trackingResult.delivered_at) {
                updateData.delivered_at = trackingResult.delivered_at;
              }

              const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
                data: updateData,
                populate: {
                  shipping_address: true,
                  billing_address: true,
                  order_items: {
                    populate: {
                      product: true,
                      order_item_parts: { populate: ['product_part', 'color'] },
                    },
                  },
                  user: true,
                },
              });

              try {
                await googleSheets.upsertOrder(updatedOrder as any);
              } catch (sheetError) {
                strapi.log.error(`Failed to update Google Sheet for order ${order.order_number}:`, sheetError);
              }
            }

            results.push({
              order_number: order.order_number,
              success: true,
              previous_status: order.order_status,
              new_status: newOrderStatus,
            });
          } else {
            results.push({
              order_number: order.order_number,
              success: false,
              error: 'Could not fetch tracking status',
            });
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err: any) {
          results.push({
            order_number: order.order_number,
            success: false,
            error: err.message,
          });
        }
      }

      const updated = results.filter(r => r.success && r.previous_status !== r.new_status).length;
      const unchanged = results.filter(r => r.success && r.previous_status === r.new_status).length;
      const failed = results.filter(r => !r.success).length;

      return ctx.send({
        message: `Refreshed ${orders.length} orders: ${updated} updated, ${unchanged} unchanged, ${failed} failed`,
        results,
      });
    } catch (error: any) {
      strapi.log.error('Refresh all tracking statuses error:', error);
      return ctx.internalServerError('Failed to refresh tracking statuses', { error: error.message });
    }
  },

  // Admin: Bulk add tracking numbers
  async bulkAddTracking(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { orders, csv_data } = ctx.request.body as { 
      orders?: Array<{ order_id: number; tracking_number: string }>;
      csv_data?: string;
    };

    let trackingData: Array<{ order_number?: string; order_id?: number; tracking_number: string }> = [];

    if (csv_data) {
      const lines = csv_data.trim().split('\n');
      for (const line of lines) {
        const [orderIdentifier, trackingNumber] = line.split(',').map(s => s.trim());
        if (orderIdentifier && trackingNumber) {
          trackingData.push({
            order_number: orderIdentifier,
            tracking_number: trackingNumber,
          });
        }
      }
    } else if (orders && Array.isArray(orders)) {
      trackingData = orders.map(o => ({
        order_id: o.order_id,
        tracking_number: o.tracking_number,
      }));
    }

    if (trackingData.length === 0) {
      return ctx.badRequest('No valid tracking data provided');
    }

    let successful = 0;
    let failed = 0;
    const results: Array<{ identifier: string; success: boolean; error?: string }> = [];

    for (const data of trackingData) {
      try {
        let orderId: number | null = null;

        if (data.order_id) {
          orderId = data.order_id;
        } else if (data.order_number) {
          const foundOrders = await strapi.entityService.findMany('api::order.order', {
            filters: { order_number: data.order_number },
            limit: 1,
          });
          if (foundOrders.length > 0) {
            orderId = (foundOrders[0] as any).id;
          }
        }

        if (!orderId) {
          results.push({ 
            identifier: data.order_number || String(data.order_id), 
            success: false, 
            error: 'Order not found' 
          });
          failed++;
          continue;
        }

        let trackerId = '';
        let orderStatus: OrderStatus = 'shipped';
        let estimatedDeliveryDate = null;
        try {
          const trackerResult = await easypostService.createTracker(data.tracking_number, 'USPS');
          trackerId = trackerResult.id || '';
          if (trackerResult.status) {
            orderStatus = mapTrackingStatusToOrderStatus(trackerResult.status);
          }
          if (trackerResult.est_delivery_date) {
            estimatedDeliveryDate = trackerResult.est_delivery_date;
          }
        } catch (e) {
          // Continue without tracker
        }

        const updateData: any = {
          tracking_number: data.tracking_number,
          order_status: orderStatus,
          shipped_at: new Date().toISOString(),
          easypost_tracker_id: trackerId,
        };

        if (estimatedDeliveryDate) {
          updateData.estimated_delivery_date = estimatedDeliveryDate;
        }

        const updatedOrder = await strapi.entityService.update('api::order.order', orderId, {
          data: updateData,
          populate: {
            shipping_address: true,
            billing_address: true,
            order_items: {
              populate: {
                product: true,
                order_item_parts: { populate: ['product_part', 'color'] },
              },
            },
            user: true,
          },
        });

        try {
          await googleSheets.upsertOrder(updatedOrder as any);
        } catch (sheetError) {
          strapi.log.error(`Failed to update Google Sheet for bulk tracking:`, sheetError);
        }

        results.push({ 
          identifier: data.order_number || String(data.order_id), 
          success: true 
        });
        successful++;
      } catch (error: any) {
        results.push({ 
          identifier: data.order_number || String(data.order_id), 
          success: false, 
          error: error.message 
        });
        failed++;
      }
    }

    return ctx.send({ 
      successful, 
      failed, 
      results,
      message: `Processed ${trackingData.length} orders: ${successful} successful, ${failed} failed`,
    });
  },

  // Admin: Export orders for Pirate Ship
  async exportForPirateShip(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { order_ids } = ctx.request.body as { order_ids?: number[] };

    try {
      let orders: any[] = [];

      if (order_ids && Array.isArray(order_ids) && order_ids.length > 0) {
        for (const orderId of order_ids) {
          const order = await strapi.entityService.findOne('api::order.order', orderId, {
            populate: {
              shipping_address: true,
              user: true,
            },
          });
          if (order) {
            orders.push(order);
          }
        }
      } else {
        orders = await strapi.entityService.findMany('api::order.order', {
          filters: {
            order_status: 'packaged',
            tracking_number: { $null: true },
            admin_hidden: { $ne: true },
          } as any,
          populate: {
            shipping_address: true,
            user: true,
          },
          limit: 500,
        }) as any[];
      }

      if (orders.length === 0) {
        return ctx.badRequest('No orders to export. Make sure orders are marked as "Packaged" and have no tracking number.');
      }

      try {
        await googleSheets.addToPirateShipExport(orders as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet for Pirate Ship export:', sheetError);
      }

      const csv = await googleSheets.getPirateShipCSV(orders as any);

      ctx.set('Content-Type', 'text/csv');
      ctx.set('Content-Disposition', `attachment; filename="pirate-ship-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      return ctx.send(csv);
    } catch (error: any) {
      strapi.log.error('Export for Pirate Ship error:', error);
      return ctx.internalServerError('Failed to export orders', { error: error.message });
    }
  },

  // Admin: Sync orders to Google Sheets
  async syncGoogleSheets(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    try {
      const initialized = await googleSheets.initGoogleSheets();
      if (!initialized) {
        return ctx.badRequest('Google Sheets is not configured. Please check your environment variables.');
      }

      await googleSheets.ensureOrdersSheet();

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: {
          ordered_at: { $gte: ninetyDaysAgo.toISOString() },
        },
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          shipping_box: true,
          user: true,
          discount_code: true,
        },
        sort: { ordered_at: 'desc' },
        limit: 500,
      }) as any[];

      let syncedCount = 0;
      let failedCount = 0;

      for (const order of orders) {
        try {
          const rowNumber = await googleSheets.upsertOrder(order);
          if (rowNumber) {
            if (!order.google_sheet_row || order.google_sheet_row !== rowNumber) {
              await strapi.entityService.update('api::order.order', order.id, {
                data: { google_sheet_row: rowNumber },
              });
            }
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          strapi.log.error(`Failed to sync order ${order.order_number}:`, err);
          failedCount++;
        }
      }

      strapi.log.info(`[GOOGLE SHEETS SYNC] Synced ${syncedCount} orders, ${failedCount} failed`);

      return ctx.send({
        synced_count: syncedCount,
        failed_count: failedCount,
        total_orders: orders.length,
        sheet_url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`,
        message: `Successfully synced ${syncedCount} orders to Google Sheets`,
      });
    } catch (error: any) {
      strapi.log.error('Sync to Google Sheets error:', error);
      return ctx.internalServerError('Failed to sync orders to Google Sheets', { error: error.message });
    }
  },

  // EasyPost tracking webhook handler
  async trackingWebhook(ctx: Context) {
    const { result } = ctx.request.body as any;

    if (!result || !result.tracking_code) {
      return ctx.send({ received: true });
    }

    const trackingNumber = result.tracking_code;
    const status = result.status;
    const estDeliveryDate = result.est_delivery_date;

    strapi.log.info(`[TRACKING WEBHOOK] Received for ${trackingNumber}: ${status}`);

    try {
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: { tracking_number: trackingNumber },
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      if (orders.length === 0) {
        strapi.log.warn(`[TRACKING WEBHOOK] No order found for tracking number: ${trackingNumber}`);
        return ctx.send({ received: true });
      }

      const order = orders[0] as any;
      const previousStatus = order.order_status;
      const newOrderStatus = mapTrackingStatusToOrderStatus(status);

      if (previousStatus === newOrderStatus) {
        strapi.log.info(`[TRACKING WEBHOOK] No status change for ${order.order_number} (still ${previousStatus})`);
        return ctx.send({ received: true, status_unchanged: true });
      }

      const updateData: any = {
        order_status: newOrderStatus,
      };

      if (estDeliveryDate) {
        updateData.estimated_delivery_date = estDeliveryDate;
      }

      if (status === 'delivered') {
        updateData.delivered_at = result.carrier_detail?.delivered_at || new Date().toISOString();
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
        data: updateData,
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      });

      strapi.log.info(`[TRACKING WEBHOOK] Updated order ${order.order_number}: ${previousStatus} → ${newOrderStatus}`);

      const autoEmailStatuses = ['in_transit', 'out_for_delivery', 'delivered'];
      let emailResult: { success: boolean; reason?: string; sentTo?: string; error?: string } = { success: false, reason: 'not_auto_email_status' };

      if (autoEmailStatuses.includes(newOrderStatus)) {
        emailResult = await orderEmailTemplates.sendStatusNotificationEmail(
          strapi,
          updatedOrder as any,
          newOrderStatus
        );

        if (emailResult.success) {
          strapi.log.info(`[TRACKING WEBHOOK] Auto-sent "${newOrderStatus}" email for order ${order.order_number}`);
        } else {
          strapi.log.warn(`[TRACKING WEBHOOK] Failed to send "${newOrderStatus}" email for order ${order.order_number}: ${emailResult.reason || emailResult.error}`);
        }
      }

      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet from tracking webhook:', sheetError);
      }

      return ctx.send({ 
        received: true, 
        order_updated: true,
        previous_status: previousStatus,
        new_status: newOrderStatus,
        email_sent: emailResult.success,
      });
    } catch (error: any) {
      strapi.log.error('Tracking webhook processing error:', error);
      return ctx.send({ received: true, error: error.message });
    }
  },

  // Get calculated package info for an order
  async calculateOrderPackage(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { id } = ctx.params;

    try {
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          order_items: {
            populate: {
              product: { fields: ['id', 'name', 'weight_oz', 'length', 'width', 'height'] },
              order_item_parts: {
                populate: {
                  product_part: { fields: ['id', 'name', 'weight_oz', 'length', 'width', 'height'] },
                },
              },
            },
          },
          shipping_box: true,
        },
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      const boxes = await strapi.entityService.findMany('api::shipping-box.shipping-box' as any, {
        filters: { is_active: true },
        sort: { priority: 'asc' },
      });

      const cartItems = (order as any).order_items.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        is_additional_part: item.is_additional_part,
        cart_item_parts: item.order_item_parts?.map((oip: any) => ({
          product_part: oip.product_part,
        })) || [],
      }));

      const packages = await shippingCalculator.calculatePackages(cartItems, boxes as any);

      const recommendedBox = packages.length > 0 ? (boxes as any[]).find((box: any) =>
        box.length === packages[0].length &&
        box.width === packages[0].width &&
        box.height === packages[0].height
      ) : null;

      return ctx.send({
        calculated_packages: packages,
        recommended_box: recommendedBox,
        available_boxes: boxes,
        current_package: (order as any).package_weight_oz ? {
          weight_oz: (order as any).package_weight_oz,
          length: (order as any).package_length,
          width: (order as any).package_width,
          height: (order as any).package_height,
          box: (order as any).shipping_box,
        } : null,
      });
    } catch (error: any) {
      strapi.log.error('Calculate order package error:', error);
      return ctx.internalServerError('Failed to calculate package', { error: error.message });
    }
  },

  // Test email configuration
  async testEmail(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    try {
      const { email } = ctx.request.body as { email?: string };
      const testEmail = email || ctx.state.user?.email;
      
      if (!testEmail) {
        return ctx.badRequest('No email provided');
      }

      const customerServiceEmail = process.env.DEFAULT_REPLY_TO_EMAIL || 'customer-service@tnt-mkr.com';

      await strapi.plugins['email'].services.email.send({
        to: testEmail,
        from: process.env.DEFAULT_FROM_EMAIL || 'TNT MKR <no-reply@tnt-mkr.com>',
        replyTo: customerServiceEmail,
        bcc: customerServiceEmail,
        subject: 'TNT MKR - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">✅ Email Test Successful</h1>
            <p style="color: #666; text-align: center;">
              This is a test email from your TNT MKR shipping admin panel.
            </p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Configuration:</strong></p>
              <ul>
                <li>From: ${process.env.DEFAULT_FROM_EMAIL || 'no-reply@tnt-mkr.com'}</li>
                <li>Reply-To: ${customerServiceEmail}</li>
                <li>BCC: ${customerServiceEmail}</li>
                <li>Mailgun Domain: ${process.env.MAILGUN_DOMAIN || 'not set'}</li>
              </ul>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">
              Sent at ${new Date().toISOString()}
            </p>
          </div>
        `,
      });

      strapi.log.info(`✅ Test email sent successfully to ${testEmail}`);

      return ctx.send({
        success: true,
        message: `Test email sent to ${testEmail}`,
        bcc: customerServiceEmail,
      });
    } catch (error: any) {
      strapi.log.error('❌ Test email error:', error);
      return ctx.internalServerError('Failed to send test email', { 
        error: error.message,
        details: error.response?.body || error.stack 
      });
    }
  },

  // Admin: Send custom message to customer
  async sendCustomMessage(ctx: Context) {
    strapi.log.info('[CUSTOM MESSAGE] Received request to send custom message');
    
    if (!await isAdmin(ctx)) {
      strapi.log.warn('[CUSTOM MESSAGE] Admin check failed - returning 403');
      return ctx.forbidden('Admin access required');
    }

    strapi.log.info('[CUSTOM MESSAGE] Admin check passed');

    const { id } = ctx.params;
    const { message, subject } = ctx.request.body as { message: string; subject?: string };

    if (!message || message.trim().length === 0) {
      return ctx.badRequest('Message is required');
    }

    try {
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          shipping_address: true,
          billing_address: true,
          order_items: {
            populate: {
              product: true,
              order_item_parts: { populate: ['product_part', 'color'] },
            },
          },
          user: true,
        },
      }) as any;

      if (!order) {
        return ctx.notFound('Order not found');
      }

      const customerEmail = order.customer_email || order.guest_email || order.user?.email;
      if (!customerEmail) {
        return ctx.badRequest('No customer email found for this order');
      }

      const emailResult = await orderEmailTemplates.sendCustomMessageEmail(
        strapi,
        order,
        message.trim(),
        subject?.trim() || undefined
      );

      if (emailResult.success) {
        strapi.log.info(`[CUSTOM MESSAGE] Admin sent custom message to ${customerEmail} for order ${order.order_number}`);
        return ctx.send({
          success: true,
          message: 'Custom message sent successfully',
          sentTo: emailResult.sentTo,
          bcc: emailResult.bcc,
        });
      } else {
        strapi.log.error(`[CUSTOM MESSAGE] Failed to send custom message for order ${order.order_number}: ${emailResult.reason}`);
        return ctx.badRequest(`Failed to send message: ${emailResult.reason || emailResult.error}`);
      }
    } catch (error: any) {
      strapi.log.error('Send custom message error:', error);
      return ctx.internalServerError('Failed to send custom message', { error: error.message });
    }
  },

  // Debug endpoint to check auth status (temporary - remove in production)
  async debugAuth(ctx: Context) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.send({
        authenticated: false,
        message: 'No user in context - JWT may be invalid or missing',
        headers: {
          authorization: ctx.request.header.authorization ? 'Present (redacted)' : 'Missing',
        },
      });
    }

    try {
      const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        populate: ['role'],
      });

      return ctx.send({
        authenticated: true,
        user_id: user.id,
        user_email: (userWithRole as any)?.email,
        role: userWithRole?.role ? {
          id: (userWithRole.role as any).id,
          name: (userWithRole.role as any).name,
          type: (userWithRole.role as any).type,
        } : null,
        is_admin: await isAdmin(ctx),
      });
    } catch (error: any) {
      return ctx.send({
        authenticated: true,
        user_id: user.id,
        error: error.message,
      });
    }
  },
};