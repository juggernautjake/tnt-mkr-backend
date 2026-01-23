import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { Context } from 'koa';
import Stripe from 'stripe';

const { ApplicationError, ValidationError, NotFoundError } = errors;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in the environment variables');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil',
});

type CartStatus = 'active' | 'abandoned' | 'converted';

interface CartItem {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  price: string;
  effective_price: number;
  base_price: string;
  is_additional_part?: boolean;
  colors?: Array<{ id: number; name: string }>;
  engravings?: any[];
  cart_item_parts?: Array<{ product_part: { id: number }; color: { id: number } }>;
}

interface OrderItemInput {
  cart_item_id?: string;
  product: number;
  quantity: number;
  price: number;
  engravings: any[];
  colors: number[];
  promotions: number[];
  is_additional_part?: boolean;
}

interface OrderInput {
  order_number: string;
  shipping_method?: number | null;
  discount_code: number | null;
  user: number | null;
  guest_email: string | null;
  ordered_at: Date;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  order_status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'returned';
  payment_status: 'pending' | 'completed' | 'failed';
  shipping_address: number;
  billing_address: number;
  subtotal: number;
  shipping_cost: number;
  sales_tax: number;
  transaction_fee: number;
  discount_total: number;
  payment_last_four: string;
  confirmation_email_sent: boolean;
  carrier_service?: string;
  estimated_delivery_date?: string;
  easypost_shipment_id?: string;
  shipping_rate_id?: string;
}

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx: Context) {
    const { data } = ctx.request.body as { data: any };
    const { user } = ctx.state;

    // Validate required fields - now accepts either shippingMethodId OR shipping_cost
    if (!data.cartId || !data.paymentMethod) {
      throw new ValidationError('cartId and paymentMethod are required');
    }

    // Must have either old shipping method OR new EasyPost shipping cost
    if (!data.shippingMethodId && data.shipping_cost === undefined) {
      throw new ValidationError('Either shippingMethodId or shipping_cost is required');
    }

    try {
      const cart = await strapi.entityService.findOne('api::cart.cart', data.cartId, {
        populate: {
          cart_items: {
            populate: {
              product: { populate: ['promotions'] },
              colors: true,
              cart_item_parts: {
                populate: ['product_part', 'color'],
              },
            },
          },
          user: true,
        },
      }) as any;

      if (!cart || (cart.user && user && cart.user.id !== user.id) || (!user && !cart.guest_session)) {
        throw new NotFoundError('Cart not found or does not belong to you');
      }
      if (cart.cart_items.length === 0) {
        throw new ValidationError('No items to order');
      }

      // Handle shipping cost - support both old (shippingMethodId) and new (EasyPost) methods
      let shippingCents: number;
      let shippingMethodId: number | null = null;

      if (data.shippingMethodId) {
        // Legacy: Use shipping-option entity
        const shippingMethod = await strapi.entityService.findOne('api::shipping-option.shipping-option', data.shippingMethodId, {
          fields: ['baseCost', 'costPerItem'],
        });
        if (!shippingMethod) {
          throw new ValidationError('Invalid shippingMethodId');
        }
        shippingMethodId = Number(data.shippingMethodId);
        const totalItems = data.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const baseCostCents = Math.round(shippingMethod.baseCost * 100);
        const costPerItemCents = Math.round(shippingMethod.costPerItem * 100);
        shippingCents = baseCostCents + costPerItemCents * (totalItems - 1);
      } else {
        // New: Use EasyPost shipping cost from frontend (already in cents)
        shippingCents = data.shipping_cost;
      }

      const currentDate = new Date().toISOString().split('T')[0];
      const orderItemsData: OrderItemInput[] = await Promise.all(data.order_items.map(async (item: any) => {
        const product = await strapi.entityService.findOne('api::product.product', item.product, {
          populate: ['promotions'],
        });
        
        // Find the matching cart item to get is_additional_part flag
        const cartItem = item.cart_item_id
          ? cart.cart_items.find((ci: CartItem) => ci.id.toString() === item.cart_item_id)
          : cart.cart_items.find((ci: CartItem) => ci.product.id === item.product);
        
        // For additional parts, don't apply product-level promotions
        const isAdditionalPart = cartItem?.is_additional_part || false;
        const activePromotions = isAdditionalPart ? [] : product.promotions.filter(
          (promo: any) => promo.start_date <= currentDate && promo.end_date >= currentDate && promo.publishedAt
        );
        
        const priceCents = item.price || Math.round(product.effective_price * 100);
        return {
          cart_item_id: item.cart_item_id,
          product: item.product,
          quantity: item.quantity,
          price: priceCents,
          engravings: item.engravings || [],
          colors: item.colors?.map((color: any) => color.id) || [],
          promotions: activePromotions.map((promo: any) => promo.id),
          is_additional_part: isAdditionalPart,
        };
      }));

      const subtotalCents = data.subtotal || orderItemsData.reduce(
        (sum: number, item: OrderItemInput) => sum + item.price * item.quantity,
        0
      );
      const taxRate = process.env.TAX_RATE ? parseFloat(process.env.TAX_RATE) : 0.0825;
      const taxCents = data.sales_tax || Math.round(subtotalCents * taxRate);
      const transactionFeeCents = data.transaction_fee || 50;

      // Calculate total discount based on order items
      let totalDiscountCents = 0;
      const orderItemsWithBasePrice = await Promise.all(orderItemsData.map(async (item) => {
        // For additional parts, get base price from the part itself
        if (item.is_additional_part) {
          const cartItem = item.cart_item_id
            ? cart.cart_items.find((ci: CartItem) => ci.id.toString() === item.cart_item_id)
            : cart.cart_items.find((ci: CartItem) => ci.product.id === item.product && ci.is_additional_part);
          
          const basePriceCents = cartItem ? Math.round(parseFloat(cartItem.base_price) * 100) : item.price;
          const itemDiscountCents = (basePriceCents - item.price) * item.quantity;
          totalDiscountCents += itemDiscountCents > 0 ? itemDiscountCents : 0;
          return { ...item, base_price: basePriceCents };
        }
        
        // For full products, get base price from product.default_price
        const product = await strapi.entityService.findOne('api::product.product', item.product, {
          fields: ['default_price'],
        });
        const basePriceCents = Math.round(product.default_price * 100);
        const itemDiscountCents = (basePriceCents - item.price) * item.quantity;
        totalDiscountCents += itemDiscountCents > 0 ? itemDiscountCents : 0;
        return { ...item, base_price: basePriceCents };
      }));

      const discountsCents = totalDiscountCents;
      const calculatedTotalCents = subtotalCents + shippingCents + taxCents + transactionFeeCents;

      const totalFromFrontendCents = data.total_amount;
      if (Math.abs(totalFromFrontendCents - calculatedTotalCents) > 1) {
        throw new ValidationError(
          `Total mismatch. Expected ${calculatedTotalCents} cents, received ${totalFromFrontendCents} cents`
        );
      }

      let shippingAddressId: number;
      let billingAddressId: number;
      if (user) {
        shippingAddressId = await handleAddress(data.shipping_address, user.id, 'shipping');
        billingAddressId = await handleAddress(data.billing_address, user.id, 'billing');
      } else {
        shippingAddressId = await createTemporaryAddress(data.shipping_address);
        billingAddressId = await createTemporaryAddress(data.billing_address);
      }

      let discountCodeId: number | null = null;
      if (data.discount_code && data.discount_code.code) {
        const discountCodes = await strapi.entityService.findMany('api::discount-code.discount-code', {
          filters: { code: data.discount_code.code },
          limit: 1,
        });
        if (discountCodes.length > 0) {
          discountCodeId = Number(discountCodes[0].id);
        } else {
          throw new ValidationError('Invalid discount code');
        }
      }

      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const orderData: OrderInput = {
        order_number: orderNumber,
        shipping_method: shippingMethodId,
        discount_code: discountCodeId,
        user: user?.id || null,
        guest_email: !user ? data.guest_email : null,
        ordered_at: new Date(),
        customer_name: data.customer_name || user?.username || '',
        customer_phone: data.customer_phone || user?.phone || '',
        total_amount: totalFromFrontendCents,
        order_status: 'pending',
        payment_status: 'pending',
        shipping_address: shippingAddressId,
        billing_address: billingAddressId,
        subtotal: subtotalCents,
        shipping_cost: shippingCents,
        sales_tax: taxCents,
        transaction_fee: transactionFeeCents,
        discount_total: discountsCents,
        payment_last_four: '',
        confirmation_email_sent: false,
        // EasyPost fields
        carrier_service: data.carrier_service || null,
        estimated_delivery_date: data.estimated_delivery_date || null,
        easypost_shipment_id: data.easypost_shipment_id || null,
        shipping_rate_id: data.shipping_rate_id || null,
      };

      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
        populate: ['order_items'],
      });

      for (const item of orderItemsWithBasePrice) {
        const product = await strapi.entityService.findOne('api::product.product', item.product, {
          fields: ['default_price', 'effective_price', 'units_sold'],
        });
        
        // Find the matching cart item to get is_additional_part flag and cart_item_parts
        const cartItem = item.cart_item_id
          ? cart.cart_items.find((ci: CartItem) => ci.id.toString() === item.cart_item_id)
          : cart.cart_items.find((ci: CartItem) => ci.product.id === item.product);
        
        const orderItem = await strapi.entityService.create('api::order-item.order-item', {
          data: {
            order: order.id,
            product: item.product,
            quantity: item.quantity,
            price: item.price / 100,
            base_price: item.base_price / 100,
            colors: item.colors,
            engravings: item.engravings,
            promotions: item.promotions,
            is_additional_part: item.is_additional_part || false,
          },
        });

        if (cartItem && cartItem.cart_item_parts) {
          for (const cartItemPart of cartItem.cart_item_parts) {
            await strapi.entityService.create('api::order-item-part.order-item-part', {
              data: {
                order_item: orderItem.id,
                product_part: cartItemPart.product_part.id,
                color: cartItemPart.color.id,
              },
            });
          }
        }

        if (product) {
          const newUnitsSold = (product.units_sold || 0) + item.quantity;
          await strapi.entityService.update('api::product.product', item.product, {
            data: { units_sold: newUnitsSold },
          });
        }
      }

      if (data.paymentMethod === 'stripe') {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalFromFrontendCents,
          currency: 'usd',
          metadata: { order_id: order.id, order_number: order.order_number, cart_id: data.cartId },
        });

        await strapi.entityService.update('api::order.order', order.id, {
          data: { payment_intent_id: paymentIntent.id },
        });

        return ctx.send({
          message: 'Order created, proceed to payment',
          orderId: order.id,
          paymentIntentClientSecret: paymentIntent.client_secret,
          cartId: data.cartId,
          guestSession: cart.guest_session,
        });
      }

      return ctx.send({ message: 'Order created successfully', orderId: order.id });
    } catch (error) {
      strapi.log.error('Error in order create:', error);
      throw new ApplicationError('Failed to create order', { cause: error });
    }
  },

  async find(ctx: Context) {
    try {
      const { filters } = ctx.query;
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters,
        populate: {
          order_items: {
            populate: {
              product: true,
              order_item_parts: {
                populate: ['product_part', 'color'],
              },
              promotions: true,
            },
          },
          shipping_address: true,
          billing_address: true,
        },
      });
      return this.transformResponse(orders);
    } catch (error) {
      strapi.log.error('Error in order find:', error);
      return ctx.internalServerError('Failed to fetch orders', { cause: error });
    }
  },
}));

async function handleAddress(addressData: any, userId: number, type: 'shipping' | 'billing'): Promise<number> {
  const existingAddresses = await strapi.entityService.findMany('api::address.address', {
    filters: { user: { id: userId } },
  });

  const matchingAddress = existingAddresses.find(
    (addr: any) =>
      addr.street === addressData.street &&
      addr.city === addressData.city &&
      addr.state === addressData.state &&
      addr.postal_code === addressData.postal_code &&
      addr.country === addressData.country
  );

  if (matchingAddress) {
    return Number(matchingAddress.id);
  } else {
    const newAddress = await strapi.entityService.create('api::address.address', {
      data: {
        ...addressData,
        user: userId,
        is_billing: type === 'billing',
        is_shipping: type === 'shipping',
        publishedAt: new Date().toISOString(),
      },
    });
    return Number(newAddress.id);
  }
}

async function createTemporaryAddress(addressData: any): Promise<number> {
  const tempAddress = await strapi.entityService.create('api::address.address', {
    data: {
      ...addressData,
      user: null,
      publishedAt: new Date().toISOString(),
    },
  });
  return Number(tempAddress.id);
}