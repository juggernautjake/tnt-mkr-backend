import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { Context } from 'koa';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

const { ApplicationError, ValidationError, NotFoundError } = errors;

// Ensure STRIPE_SECRET_KEY is set
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in the environment variables');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil',
});

type CartStatus = 'active' | 'abandoned' | 'converted';

interface CartItem {
  id: number;
  product: { id: number; name: string };
  quantity: number;
  price: string;
  colors?: Array<{ id: number; name: string }>;
  engravings?: any[];
  cart_item_parts?: Array<{ product_part: { id: number }; color: { id: number } }>;
}

interface OrderItemInput {
  product: number;
  quantity: number;
  price: number;
  engravings: any[];
  colors: number[];
  promotions: number[];
}

interface OrderInput {
  order_number: string;
  shipping_method: number;
  discount_code: number | null;
  user: number | null;
  guest_email: string | null;
  ordered_at: Date;
  customer_name: string;
  customer_phone: string;
  total_amount: number; // In cents
  order_status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'returned';
  payment_status: 'pending' | 'completed' | 'failed';
  shipping_address: number;
  billing_address: number;
  subtotal: number; // In cents
  shipping_cost: number; // In cents
  sales_tax: number; // In cents
  transaction_fee: number; // In cents
  discount_total: number; // In cents
  payment_last_four: string;
}

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx: Context) {
    const { data } = ctx.request.body as { data: any };
    const { user } = ctx.state;
    strapi.log.debug(`[Order Controller] Create order started with data: ${JSON.stringify(data)}`);

    if (!data.cartId || !data.shippingMethodId || !data.paymentMethod) {
      strapi.log.error('[Order Controller] Missing required fields');
      throw new ValidationError('cartId, shippingMethodId, and paymentMethod are required');
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

      strapi.log.debug(`[Order Controller] Fetched cart: ${JSON.stringify(cart)}`);

      if (!cart || (cart.user && user && cart.user.id !== user.id) || (!user && !cart.guest_session)) {
        strapi.log.error('[Order Controller] Cart not found or unauthorized');
        throw new NotFoundError('Cart not found or does not belong to you');
      }
      if (cart.cart_items.length === 0) {
        strapi.log.error('[Order Controller] Cart is empty');
        throw new ValidationError('No items to order');
      }

      const shippingMethod = await strapi.entityService.findOne('api::shipping-option.shipping-option', data.shippingMethodId, {
        fields: ['baseCost', 'costPerItem'],
      });
      if (!shippingMethod) {
        strapi.log.error(`[Order Controller] Invalid shippingMethodId: ${data.shippingMethodId}`);
        throw new ValidationError('Invalid shippingMethodId');
      }
      strapi.log.debug(`[Order Controller] Shipping method: ${JSON.stringify(shippingMethod)}`);

      const currentDate = new Date().toISOString().split('T')[0];
      const orderItemsData: OrderItemInput[] = await Promise.all(cart.cart_items.map(async (item: CartItem) => {
        const product = await strapi.entityService.findOne('api::product.product', item.product.id, {
          populate: ['promotions'],
        });
        const activePromotions = product.promotions.filter(
          (promo: any) => promo.start_date <= currentDate && promo.end_date >= currentDate && promo.publishedAt
        );
        return {
          product: item.product.id,
          quantity: item.quantity,
          price: Math.round(parseFloat(item.price) * 100), // Convert price to cents
          engravings: item.engravings || [],
          colors: item.colors?.map((color) => color.id) || [],
          promotions: activePromotions.map((promo: any) => promo.id),
        };
      }));
      strapi.log.debug(`[Order Controller] Prepared order items: ${JSON.stringify(orderItemsData)}`);

      const subtotalCents = orderItemsData.reduce(
        (sum: number, item: OrderItemInput) => sum + item.price * item.quantity,
        0
      );
      const totalItems = orderItemsData.reduce((sum: number, item: OrderItemInput) => sum + item.quantity, 0);
      const baseCostCents = Math.round(shippingMethod.baseCost * 100);
      const costPerItemCents = Math.round(shippingMethod.costPerItem * 100);
      const shippingCents = baseCostCents + costPerItemCents * (totalItems - 1);
      const taxRate = process.env.TAX_RATE ? parseFloat(process.env.TAX_RATE) : 0.0825;
      const taxCents = Math.round(subtotalCents * taxRate);
      const transactionFeeCents = 50; // Fixed at 50 cents
      const discountsCents = 0;
      const calculatedTotalCents = subtotalCents + shippingCents + taxCents + transactionFeeCents - discountsCents;

      const totalFromFrontendCents = Number(data.total_amount); // Already in cents from frontend
      if (Math.abs(totalFromFrontendCents - calculatedTotalCents) > 1) {
        strapi.log.error(`[Order Controller] Total mismatch. Expected ${calculatedTotalCents} cents, received ${totalFromFrontendCents} cents`);
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
        shipping_method: Number(data.shippingMethodId),
        discount_code: discountCodeId,
        user: user?.id || null,
        guest_email: !user ? data.guest_email : null,
        ordered_at: new Date(),
        customer_name: data.customer_name || user?.username || '',
        customer_phone: data.customer_phone || user?.phone || '',
        total_amount: calculatedTotalCents, // Stored in cents
        order_status: 'pending',
        payment_status: 'pending',
        shipping_address: shippingAddressId,
        billing_address: billingAddressId,
        subtotal: subtotalCents, // Stored in cents
        shipping_cost: shippingCents, // Stored in cents
        sales_tax: taxCents, // Stored in cents
        transaction_fee: transactionFeeCents, // Stored in cents
        discount_total: discountsCents, // Stored in cents
        payment_last_four: '',
      };

      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
        populate: ['order_items'],
      });

      for (const item of orderItemsData) {
        const orderItem = await strapi.entityService.create('api::order-item.order-item', {
          data: {
            order: order.id,
            product: item.product,
            quantity: item.quantity,
            price: item.price / 100, // Convert back to dollars for order-item schema if needed
            colors: item.colors,
            engravings: item.engravings,
            promotions: item.promotions,
          },
        });

        const cartItem = cart.cart_items.find((ci: CartItem) => ci.product.id === item.product);
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

        const product = await strapi.entityService.findOne('api::product.product', item.product, {
          fields: ['units_sold'],
        });
        if (product) {
          const newUnitsSold = (product.units_sold || 0) + item.quantity;
          await strapi.entityService.update('api::product.product', item.product, {
            data: { units_sold: newUnitsSold },
          });
        }
      }

      if (data.paymentMethod === 'stripe') {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: calculatedTotalCents, // Amount in cents for Stripe
          currency: 'usd',
          metadata: { order_id: order.id, order_number: order.order_number },
        });

        await strapi.entityService.update('api::order.order', order.id, {
          data: { payment_intent_id: paymentIntent.id },
        });

        await strapi.entityService.update('api::cart.cart', data.cartId, {
          data: { cart_items: [], total: 0, status: 'converted' }, // Total in cents
        });

        let newGuestSession: string | null = user ? null : uuidv4();
        if (!user) {
          let existingCarts = await strapi.entityService.findMany('api::cart.cart', {
            filters: { guest_session: newGuestSession },
          });
          while (existingCarts.length > 0) {
            newGuestSession = uuidv4();
            existingCarts = await strapi.entityService.findMany('api::cart.cart', {
              filters: { guest_session: newGuestSession },
            });
          }
        }

        const newCartData = {
          total: 0, // In cents
          status: 'active' as const,
          user: user ? user.id : null,
          guest_session: newGuestSession,
        };

        const newCart = await strapi.entityService.create('api::cart.cart', {
          data: newCartData,
          populate: ['cart_items'],
        });
        strapi.log.debug(`[Order Controller] Created new active cart ${newCart.id} with guest_session ${newGuestSession}`);

        if (!user) {
          ctx.cookies.set("session_id", newGuestSession, { httpOnly: true, sameSite: "lax", path: '/' });
          strapi.log.debug(`[Order Controller] Set session_id cookie to ${newGuestSession} with path '/'`);
        }

        return ctx.send({
          message: 'Order created, proceed to payment',
          orderId: order.id,
          paymentIntentClientSecret: paymentIntent.client_secret,
          newCartId: newCart.id,
          newGuestSession: newGuestSession,
        });
      }

      return ctx.send({ message: 'Order created successfully', orderId: order.id });
    } catch (error) {
      strapi.log.error('[Order Controller] Error in create order:', error);
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
      strapi.log.error('[Order Controller] Error in find:', error);
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