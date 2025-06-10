import { Strapi } from '@strapi/strapi';
import redisService from './services/redis';
import { RedisClientType } from 'redis';

export default {
  async bootstrap({ strapi }: { strapi: Strapi }) {
    // Initialize Redis if REDIS_URL is provided
    if (process.env.REDIS_URL) {
      try {
        strapi.redis = redisService() as RedisClientType;
        strapi.log.info(`Redis initialized with REDIS_URL: ${process.env.REDIS_URL}`);
      } catch (error) {
        strapi.log.error('Failed to initialize Redis:', error);
      }
    } else {
      strapi.log.info('Redis not configured. Skipping initialization.');
    }

    // Cleanup abandoned guest carts (runs every hour)
    strapi.cron.add({
      '0 * * * *': async () => {
        try {
          const abandonedCarts = await strapi.entityService.findMany('api::cart.cart', {
            filters: {
              guest_session: { $ne: null },
              status: { $eq: 'active' as const },
              updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24 hours ago
            },
          });
          for (const cart of abandonedCarts) {
            // Find all cart items associated with the cart
            const cartItems = await strapi.entityService.findMany('api::cart-item.cart-item', {
              filters: { cart: { id: cart.id } },
            });
            // Delete each cart item individually
            for (const item of cartItems) {
              await strapi.entityService.delete('api::cart-item.cart-item', item.id);
            }
            // Delete the cart
            await strapi.entityService.delete('api::cart.cart', cart.id);
          }
          strapi.log.info(`Cleaned up ${abandonedCarts.length} abandoned guest carts`);
        } catch (error) {
          strapi.log.error('Error cleaning up guest carts:', error);
        }
      },
    });
  },
};