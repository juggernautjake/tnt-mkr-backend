import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError, ValidationError, NotFoundError, UnauthorizedError } = errors;

interface WishlistData {
  id: number;
  products: number[];
  name: string;
  date_created: string;
  user?: number; // Optional, since not used in the code
}

export default factories.createCoreController('api::wish-list.wish-list', ({ strapi }) => ({
  /**
   * Adds a product to the user's wishlist.
   * - Authenticated users only.
   */
  async addProduct(ctx) {
    const { productId, wishlistName = 'Default' } = ctx.request.body;
    const { user } = ctx.state;

    if (!user) {
      throw new UnauthorizedError('You must be logged in to manage wishlists. Please create an account.');
    }

    if (!productId) {
      throw new ValidationError('Product ID is required');
    }

    try {
      const wishlists = await strapi.entityService.findMany('api::wish-list.wish-list', {
        filters: { user: { id: user.id }, name: wishlistName }, // Corrected filter
      }) as WishlistData[];

      let wishlist: WishlistData;
      if (wishlists.length === 0) {
        wishlist = await strapi.entityService.create('api::wish-list.wish-list', {
          data: {
            user: user.id,
            name: wishlistName,
            products: [productId],
            date_created: new Date(),
          },
        }) as WishlistData;
      } else {
        wishlist = wishlists[0];
        if (wishlist.products.length >= 50) {
          throw new ValidationError(`Wishlist "${wishlistName}" has reached the 50-product limit`);
        }
        const updatedProducts = [...new Set([...wishlist.products, productId])];
        await strapi.entityService.update('api::wish-list.wish-list', wishlist.id, {
          data: { products: updatedProducts },
        });
      }
      return ctx.send({ message: `Product ${productId} added to wishlist "${wishlistName}"` });
    } catch (error) {
      strapi.log.error('Error in addProduct:', error);
      throw new ApplicationError('Failed to add product', { cause: error });
    }
  },

  /**
   * Removes a product from the user's wishlist.
   * - Authenticated users only.
   */
  async removeProduct(ctx) {
    const { productId, wishlistName = 'Default' } = ctx.request.body;
    const { user } = ctx.state;

    if (!user) {
      throw new UnauthorizedError('You must be logged in to manage wishlists. Please create an account.');
    }

    if (!productId) {
      throw new ValidationError('Product ID is required');
    }

    try {
      const wishlists = await strapi.entityService.findMany('api::wish-list.wish-list', {
        filters: { user: { id: user.id }, name: wishlistName }, // Corrected filter
      }) as WishlistData[];

      if (wishlists.length === 0) {
        throw new NotFoundError(`Wishlist "${wishlistName}" not found`);
      }

      const wishlist = wishlists[0];
      const updatedProducts = wishlist.products.filter((id) => id !== productId);
      await strapi.entityService.update('api::wish-list.wish-list', wishlist.id, {
        data: { products: updatedProducts },
      });
      return ctx.send({ message: `Product ${productId} removed from wishlist "${wishlistName}"` });
    } catch (error) {
      strapi.log.error('Error in removeProduct:', error);
      throw new ApplicationError('Failed to remove product', { cause: error });
    }
  },
}));
