import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::review.review', ({ strapi }: { strapi: any }) => ({
  async create(ctx: any) {
    const { data } = ctx.request.body;
    const { product } = data;
    const user = ctx.state.user;

    // Check authentication
    if (!user) {
      return ctx.unauthorized('You must be logged in to create a review');
    }

    // Verify purchase
    const hasPurchased = await strapi.service('api::review.review').hasPurchasedProduct(user.id, product);
    if (!hasPurchased) {
      return ctx.forbidden('You must purchase the product to leave a review');
    }

    // Create the review (remains in draft until published)
    const response = await super.create(ctx);
    return response;
  },
}));
