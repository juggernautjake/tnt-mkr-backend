// C:\TNT-MKR\Website Stuff\Code Base\tnt-mkr-backend\src\api\cart\services\cart.ts
import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

export default factories.createCoreService('api::cart.cart', ({ strapi }) => ({
  async findGuestCart(guestSession: string, populate: any = ['cart_items']) {
    if (!guestSession) {
      throw new ValidationError('Guest session ID is required');
    }
    return strapi.entityService.findMany('api::cart.cart', {
      filters: { guest_session: guestSession },
      populate,
    });
  },

  async createCart(data: Record<string, any>, user?: any, guestSession?: string) {
    const effectiveGuestSession = data.guest_session || guestSession;
    if (!user && !effectiveGuestSession) {
      throw new ValidationError('Guest session ID is required for unauthenticated users');
    }

    const cartData = {
      ...data,
      user: user ? user.id : null,
      guest_session: user ? null : effectiveGuestSession,
      total: Number(data.total) || 0,
    };

    const cart = await strapi.entityService.create('api::cart.cart', { data: cartData });

    return cart;
  },

  async updateCart(id: number, data: Record<string, any>, user?: any, guestSession?: string) {
    const cart = await strapi.entityService.findOne('api::cart.cart', id, {
      populate: ['user', 'cart_items'],
    });

    if (!cart) {
      throw new ValidationError('Cart not found');
    }

    if (user && cart.user && cart.user.id !== user.id) {
      throw new ValidationError('Unauthorized: Cart does not belong to this user');
    }
    if (!user && cart.guest_session !== guestSession) {
      throw new ValidationError('Unauthorized: Invalid guest session');
    }

    const total = cart.cart_items.reduce((sum: number, item: any) => {
      const price = Number(item.product.default_price) || 0;
      return sum + price * (item.quantity || 1);
    }, 0);

    const updatedCart = await strapi.entityService.update('api::cart.cart', id, {
      data: { ...data, total },
    });

    return updatedCart;
  },
}));