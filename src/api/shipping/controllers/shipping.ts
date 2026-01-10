import { Context } from 'koa';
import easypostService from '../../../services/easypost';
import shippingCalculator from '../../../services/shipping-calculator';
import googleSheets from '../../../services/google-sheets';

// Helper function to check if user is admin
async function isAdmin(ctx: Context): Promise<boolean> {
  const { user } = ctx.state;
  if (!user) return false;
  
  try {
    const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
      populate: ['role'],
    });
    
    if (!userWithRole || !userWithRole.role) return false;
    
    const roleName = (userWithRole.role as any).name?.toLowerCase();
    const roleType = (userWithRole.role as any).type?.toLowerCase();
    
    return roleName === 'admin' || roleType === 'admin';
  } catch (error) {
    strapi.log.error('Error checking admin role:', error);
    return false;
  }
}

// Helper function for sending shipping notification
async function sendShippingNotification(strapi: any, order: any) {
  const customerEmail = order.customer_email || order.guest_email || order.user?.email;
  
  if (!customerEmail) {
    strapi.log.warn(`No email available for shipping notification - order ${order.id}`);
    return;
  }

  const trackingNumber = order.tracking_number;
  if (!trackingNumber) {
    strapi.log.warn(`No tracking number for order ${order.id}`);
    return;
  }

  const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;

  let estimatedDelivery = '';
  let showDelivery = 'none';
  if (order.estimated_delivery_date) {
    const date = new Date(order.estimated_delivery_date);
    estimatedDelivery = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    showDelivery = 'block';
  }

  const shippingAddress = order.shipping_address || {};
  const addressParts = [
    shippingAddress.street,
    shippingAddress.street2,
    `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postal_code}`,
  ].filter(Boolean);
  const formattedAddress = addressParts.join('<br>');
  
  // Build items HTML
  let itemsHtml = '';
  for (const item of order.order_items || []) {
    const productName = item.product?.name || 'Product';
    const quantity = item.quantity || 1;
    
    let partsHtml = '';
    for (const part of item.order_item_parts || []) {
      const partName = part.product_part?.name || 'Part';
      const colorName = part.color?.name || 'Color';
      partsHtml += `<div style="margin-top: 5px; font-size: 14px; color: #666;">${partName}: ${colorName}</div>`;
    }
    
    itemsHtml += `
      <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
        <div style="font-weight: bold; color: #333;">${productName} × ${quantity}</div>
        ${partsHtml}
      </div>
    `;
  }

  const shipDate = order.shipped_at
    ? new Date(order.shipped_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background-color: #fefaf0; font-family: 'Roboto', sans-serif; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); border: 3px solid; border-image: linear-gradient(45deg, #fe5100, white, #fe5100) 1; }
    h1 { color: #fe5100; font-size: 30px; font-weight: bold; margin-bottom: 20px; text-align: center; }
    p { margin: 10px 0; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Your Order Has Shipped! 📦</h1>
    <p style="text-align: center; margin-bottom: 20px;">Great news! Your order is on its way.</p>
    
    <div style="background-color: #f5f5f5; border: 2px solid #fe5100; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Tracking Number:</p>
      <div style="font-size: 24px; font-weight: bold; color: #fe5100; letter-spacing: 2px;">${trackingNumber}</div>
      <a href="${trackingUrl}" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background-color: #fe5100; color: white; text-decoration: none; border-radius: 25px; font-weight: bold;" target="_blank">Track Your Package</a>
    </div>

    <div style="background-color: #e8f5e9; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; display: ${showDelivery};">
      <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Estimated Delivery:</p>
      <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">${estimatedDelivery}</div>
    </div>

    <div style="border-top: 1px solid #ddd; padding-top: 15px; margin-bottom: 20px;">
      <p><strong>Order Number:</strong> ${order.order_number || ''}</p>
      <p><strong>Carrier:</strong> ${order.carrier_service || 'USPS'}</p>
      <p><strong>Ship Date:</strong> ${shipDate}</p>
      <p><strong>Shipping to:</strong><br>
        ${order.customer_name || ''}<br>
        ${formattedAddress}
      </p>
    </div>

    <div style="margin-top: 20px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px;">Items in This Shipment</h2>
      ${itemsHtml}
    </div>

    <p style="margin-top: 20px;">If you have any questions about your order, please don't hesitate to contact us.</p>
    
    <div style="margin-top: 20px; font-size: 12px; color: #555; text-align: center;">
      <p>Thank you for shopping with TNT MKR!</p>
      <p>© TNT MKR. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    await strapi.plugins['email'].services.email.send({
      to: customerEmail,
      from: process.env.DEFAULT_FROM_EMAIL || 'TNT MKR <no-reply@tnt-mkr.com>',
      subject: `Your TNT MKR Order Has Shipped! - ${order.order_number}`,
      html,
    });
    strapi.log.info(`Shipping notification sent to ${customerEmail} for order ${order.id}`);
  } catch (error: any) {
    strapi.log.error(`Failed to send shipping notification to ${customerEmail}: ${error.message}`);
    throw error;
  }
}

export default {
  // Validate an address
  async validateAddress(ctx: Context) {
    const { address } = ctx.request.body as { address: any };

    if (!address || !address.street || !address.city || !address.state || !address.postal_code) {
      return ctx.badRequest('Missing required address fields: street, city, state, postal_code');
    }

    // Check if state is continental US first
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

    // Validate state is continental US
    if (!easypostService.isValidContinentalUS(address.state)) {
      return ctx.badRequest('We currently only ship to the continental United States (excludes Alaska, Hawaii, and US territories).');
    }

    try {
      // Get all active shipping boxes
      const boxes = await strapi.entityService.findMany('api::shipping-box.shipping-box' as any, {
        filters: { is_active: true },
        sort: { priority: 'asc' },
      });

      // Fetch full product/part data for each cart item
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

      // Get shipping rates
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

    const { status, page = 1, pageSize = 50 } = ctx.query;

    try {
      const filters: any = {};
      if (status) {
        filters.order_status = status;
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

      // Update Google Sheet
      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet:', sheetError);
      }

      return ctx.send({ order: updatedOrder });
    } catch (error: any) {
      strapi.log.error('Update order shipping error:', error);
      return ctx.internalServerError('Failed to update order', { error: error.message });
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

      // Create EasyPost tracker
      let easypostTrackerId = '';
      try {
        easypostTrackerId = await easypostService.createTracker(tracking_number, 'USPS');
      } catch (trackerError) {
        strapi.log.error('Failed to create EasyPost tracker:', trackerError);
      }

      // Update order
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: {
          tracking_number,
          carrier_service,
          order_status: 'shipped',
          shipped_at: new Date().toISOString(),
          easypost_tracker_id: easypostTrackerId,
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
          user: true,
        },
      });

      // Send shipping notification email
      const customerEmail = (order as any).customer_email || (order as any).guest_email || (order as any).user?.email;
      if (customerEmail && !(order as any).shipping_notification_sent) {
        try {
          await sendShippingNotification(strapi, updatedOrder);
          await strapi.entityService.update('api::order.order', id, {
            data: { shipping_notification_sent: true },
          });
        } catch (emailError) {
          strapi.log.error('Failed to send shipping notification:', emailError);
        }
      }

      // Update Google Sheet
      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet:', sheetError);
      }

      return ctx.send({ order: updatedOrder });
    } catch (error: any) {
      strapi.log.error('Mark as shipped error:', error);
      return ctx.internalServerError('Failed to mark order as shipped', { error: error.message });
    }
  },

  // Admin: Bulk add tracking numbers
  async bulkAddTracking(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { orders } = ctx.request.body as { orders: Array<{ order_id: number; tracking_number: string }> };

    if (!orders || !Array.isArray(orders)) {
      return ctx.badRequest('Orders array is required');
    }

    const results: Array<{ order_id: number; success: boolean; error?: string }> = [];

    for (const orderData of orders) {
      try {
        const order = await strapi.entityService.findOne('api::order.order', orderData.order_id);
        
        if (!order) {
          results.push({ order_id: orderData.order_id, success: false, error: 'Order not found' });
          continue;
        }

        let trackerId = '';
        try {
          trackerId = await easypostService.createTracker(orderData.tracking_number, 'USPS');
        } catch (e) {
          // Continue without tracker
        }

        await strapi.entityService.update('api::order.order', orderData.order_id, {
          data: {
            tracking_number: orderData.tracking_number,
            order_status: 'shipped',
            shipped_at: new Date().toISOString(),
            easypost_tracker_id: trackerId,
          },
        });

        results.push({ order_id: orderData.order_id, success: true });
      } catch (error: any) {
        results.push({ order_id: orderData.order_id, success: false, error: error.message });
      }
    }

    return ctx.send({ results });
  },

  // Admin: Export orders for Pirate Ship
  async exportForPirateShip(ctx: Context) {
    if (!await isAdmin(ctx)) {
      return ctx.forbidden('Admin access required');
    }

    const { order_ids } = ctx.request.body as { order_ids: number[] };

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return ctx.badRequest('Order IDs are required');
    }

    try {
      const orders: any[] = [];

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

      // Update Google Sheet with export
      await googleSheets.addToPirateShipExport(orders as any);

      // Generate CSV
      const csv = await googleSheets.getPirateShipCSV(orders as any);

      return ctx.send({
        csv,
        message: `Exported ${orders.length} orders for Pirate Ship`,
        spreadsheet_url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}`,
      });
    } catch (error: any) {
      strapi.log.error('Export for Pirate Ship error:', error);
      return ctx.internalServerError('Failed to export orders', { error: error.message });
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

    strapi.log.info(`Tracking webhook received for ${trackingNumber}: ${status}`);

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
        strapi.log.warn(`No order found for tracking number: ${trackingNumber}`);
        return ctx.send({ received: true });
      }

      const order = orders[0] as any;

      let orderStatus = order.order_status;
      let deliveredAt = order.delivered_at;

      switch (status) {
        case 'in_transit':
          orderStatus = 'in_transit';
          break;
        case 'out_for_delivery':
          orderStatus = 'out_for_delivery';
          break;
        case 'delivered':
          orderStatus = 'delivered';
          deliveredAt = new Date().toISOString();
          break;
        case 'return_to_sender':
        case 'failure':
          orderStatus = 'returned';
          break;
      }

      const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
        data: {
          order_status: orderStatus,
          delivered_at: deliveredAt,
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
          user: true,
        },
      });

      try {
        await googleSheets.upsertOrder(updatedOrder as any);
      } catch (sheetError) {
        strapi.log.error('Failed to update Google Sheet from tracking webhook:', sheetError);
      }

      return ctx.send({ received: true, order_updated: true });
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
};