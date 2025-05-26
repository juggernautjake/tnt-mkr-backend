// src/api/review/services/review.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::review.review', ({ strapi }) => ({
  async hasPurchasedProduct(userId: number, productId: number) {
    const orders = await strapi.entityService.findMany('api::order.order', {
      filters: {
        user: { id: userId },
        order_items: { product: { id: productId } },
      },
    }) as Array<any>; // Explicitly cast to array
    return orders.length > 0;
  },
}));