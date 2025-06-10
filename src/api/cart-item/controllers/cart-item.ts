import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError, ValidationError } = errors;

async function roundTo99Cents(price: number): Promise<number> {
  const dollars = Math.floor(price);
  const cents = price - dollars;
  if (cents === 0.99) {
    return price;
  }
  return dollars + 0.99;
}

async function calculateEffectivePrice(strapi: any, product: any): Promise<number> {
  const currentDate = new Date().toISOString().split('T')[0];
  let effectivePrice = product.default_price;
  const promotions = product.promotions.filter(promo => {
    return promo.start_date <= currentDate && promo.end_date >= currentDate && promo.publishedAt;
  });
  let isDiscounted = false;
  promotions.forEach((promotion: any) => {
    if (promotion.discount_percentage) {
      const discount = product.default_price * (promotion.discount_percentage / 100);
      effectivePrice = Math.min(effectivePrice, product.default_price - discount);
      isDiscounted = true;
    } else if (promotion.discount_amount) {
      effectivePrice = Math.min(effectivePrice, product.default_price - promotion.discount_amount);
      isDiscounted = true;
    }
  });
  if (isDiscounted) {
    effectivePrice = await roundTo99Cents(effectivePrice);
  } else if (promotions.length === 0 && product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }
  // Return as a number, no toFixed(2) or Number() needed
  return effectivePrice;
}

export default factories.createCoreController('api::cart-item.cart-item', ({ strapi }) => ({
  async create(ctx: any) {
    const { data } = ctx.request.body as { data: any };
    const user = ctx.state.user;
    const sessionId = ctx.request.headers['x-guest-session'];

    strapi.log.info(`[Cart Item Create] Received request with data: ${JSON.stringify(data)}`);
    strapi.log.debug(`[Cart Item Create] User: ${user ? user.id : 'None'}, Session ID: ${sessionId}`);

    if (!data || !data.cart || !data.product || !data.base_price || !data.effective_price) {
      strapi.log.warn('[Cart Item Create] Missing required fields');
      return ctx.badRequest('Cart ID, product, base_price, and effective_price are required');
    }

    const cart: any = await strapi.entityService.findOne('api::cart.cart', data.cart, {
      populate: { user: true, cart_items: { populate: ['product', 'cart_item_parts.product_part', 'cart_item_parts.color'] } },
    });

    if (!cart) {
      strapi.log.warn(`[Cart Item Create] Cart ${data.cart} not found`);
      return ctx.badRequest('Cart not found');
    }

    if (user && cart.user?.id !== user.id) {
      strapi.log.warn(`[Cart Item Create] User ${user.id} unauthorized for cart ${data.cart}`);
      return ctx.forbidden('You do not have permission to add items to this cart');
    }
    if (!user && cart.guest_session !== sessionId) {
      strapi.log.warn(`[Cart Item Create] Session ${sessionId} unauthorized for cart ${data.cart}`);
      return ctx.forbidden('You do not have permission to add items to this cart');
    }

    const product = await strapi.entityService.findOne('api::product.product', data.product, {
      populate: ['promotions'],
    });

    const effectivePrice = await calculateEffectivePrice(strapi, product);
    const providedEffectivePrice = parseFloat(data.effective_price);
    if (Math.abs(providedEffectivePrice - effectivePrice) > 0.01) {
      strapi.log.warn(`[Cart Item Create] Effective price mismatch for product ${data.product}: provided=${providedEffectivePrice}, calculated=${effectivePrice}`);
      throw new ValidationError(`Invalid effective price: Provided (${providedEffectivePrice}) does not match calculated (${effectivePrice})`);
    }

    const cartItems = cart.cart_items || [];
    const existingItems = cartItems.filter((item: any) => item.product?.id === data.product);
    const newCustomizations = (data.customizations || []).map((cust: any) => ({
      product_part: cust.product_part.id,
      color: cust.color.id,
    })).sort((a: any, b: any) => a.product_part - b.product_part);

    const matchingItem = existingItems.find((item: any) => {
      const itemCustomizations = (item.cart_item_parts || []).map((cip: any) => ({
        product_part: cip.product_part?.id,
        color: cip.color?.id,
      })).sort((a: any, b: any) => a.product_part - b.product_part);
      return JSON.stringify(itemCustomizations) === JSON.stringify(newCustomizations);
    });

    try {
      if (matchingItem) {
        const updatedItem = await strapi.entityService.update('api::cart-item.cart-item', matchingItem.id, {
          data: { quantity: (matchingItem.quantity || 0) + (data.quantity || 1) },
          populate: ['product', 'cart_item_parts.product_part', 'cart_item_parts.color'],
        });
        strapi.log.info(`[Cart Item Create] Updated item: ${JSON.stringify(updatedItem)}`);
        return this.transformResponse(updatedItem);
      } else {
        const basePrice = parseFloat(data.base_price);
        // Round to 2 decimal places, keeping it a number
        const roundedBasePrice = Math.round(basePrice * 100) / 100;
        const roundedEffectivePrice = Math.round(effectivePrice * 100) / 100;

        const newItem = await strapi.entityService.create('api::cart-item.cart-item', {
          data: {
            cart: data.cart,
            product: data.product,
            quantity: data.quantity || 1,
            base_price: roundedBasePrice,
            effective_price: roundedEffectivePrice,
          },
          populate: ['product'],
        });

        for (const cust of data.customizations || []) {
          await strapi.entityService.create('api::cart-item-part.cart-item-part', {
            data: {
              product_part: cust.product_part.id,
              color: cust.color.id,
              cart_item: newItem.id,
              publishedAt: new Date().toISOString(),
            },
          });
        }

        const completeItem = await strapi.entityService.findOne('api::cart-item.cart-item', newItem.id, {
          populate: ['product', 'cart_item_parts.product_part', 'cart_item_parts.color'],
        });

        strapi.log.info(`[Cart Item Create] Created item: ${JSON.stringify(completeItem)}`);
        return this.transformResponse(completeItem);
      }
    } catch (error) {
      strapi.log.error('[Cart Item Create] Error:', error);
      throw new ApplicationError('Failed to process cart item', { cause: error });
    }
  },

  async delete(ctx: any) {
    const { id } = ctx.params;
    const user = ctx.state.user;
    const sessionId = ctx.request.headers['x-guest-session'];

    const cartItem = await strapi.entityService.findOne('api::cart-item.cart-item', id, {
      populate: { cart: { populate: ['user'] } },
    });

    if (!cartItem) {
      return ctx.notFound('Cart item not found');
    }

    const cart = cartItem.cart;
    if (user && cart.user?.id !== user.id) {
      return ctx.forbidden('You do not have permission to delete this item');
    }
    if (!user && cart.guest_session !== sessionId) {
      return ctx.forbidden('You do not have permission to delete this item');
    }

    try {
      const deletedItem = await strapi.entityService.delete('api::cart-item.cart-item', id);
      return this.transformResponse(deletedItem);
    } catch (error) {
      strapi.log.error('[Cart Item Delete] Error:', error);
      throw new ApplicationError('Failed to delete cart item', { cause: error });
    }
  },
}));