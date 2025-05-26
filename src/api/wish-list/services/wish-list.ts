import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::wish-list.wish-list', ({ strapi }) => ({
  /**
   * Finds a wishlist by name for the authenticated user.
   */
  async findWishlist(ctx, wishlistName = 'Default') {
    const { user } = ctx.state;

    if (!user) {
      throw new Error('Authentication required. Please create an account.');
    }

    const wishlist = await strapi.entityService.findMany('api::wish-list.wish-list', {
      filters: { user: { id: user.id }, name: wishlistName }, // Corrected filter
      populate: ['products'],
    });
    return wishlist.length > 0 ? wishlist[0] : null;
  },

  /**
   * Updates a wishlist with new product data for the authenticated user.
   */
  async updateWishlist(ctx, data, wishlistName = 'Default') {
    const { user } = ctx.state;

    if (!user) {
      throw new Error('Authentication required. Please create an account.');
    }

    const wishlists = await strapi.entityService.findMany('api::wish-list.wish-list', {
      filters: { user: { id: user.id }, name: wishlistName }, // Corrected filter
    });
    if (wishlists.length === 0) {
      throw new Error(`Wishlist "${wishlistName}" not found`);
    }
    const wishlist = wishlists[0];
    return await strapi.entityService.update('api::wish-list.wish-list', wishlist.id, {
      data: { products: data },
    });
  },
}));
