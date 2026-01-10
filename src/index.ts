import { Strapi } from '@strapi/strapi';
import redisService from './services/redis';
import { RedisClientType } from 'redis';
import { seedShippingBoxes } from './bootstrap/seed-shipping-boxes';
import googleSheets from './services/google-sheets';

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

    // Initialize Google Sheets
    if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      try {
        const initialized = await googleSheets.initGoogleSheets();
        if (initialized) {
          await googleSheets.ensureOrdersSheet();
          strapi.log.info('Google Sheets initialized and Orders sheet ready');
        }
      } catch (error) {
        strapi.log.error('Failed to initialize Google Sheets:', error);
      }
    } else {
      strapi.log.info('Google Sheets not configured. Skipping initialization.');
    }

    // Seed shipping boxes on first run
    await seedShippingBoxes(strapi);

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

    // Sync recent orders to Google Sheets (runs every 15 minutes)
    strapi.cron.add({
      '*/15 * * * *': async () => {
        if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) return;

        try {
          // Find orders updated in the last 20 minutes that might need syncing
          const recentOrders = await strapi.entityService.findMany('api::order.order', {
            filters: {
              updatedAt: { $gt: new Date(Date.now() - 20 * 60 * 1000) },
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
              shipping_box: true,
              user: true,
              discount_code: true,
            },
            limit: 50,
          });

          for (const order of recentOrders) {
            try {
              await googleSheets.upsertOrder(order as any);
            } catch (err) {
              strapi.log.error(`Failed to sync order ${(order as any).order_number} to Google Sheets:`, err);
            }
          }

          if (recentOrders.length > 0) {
            strapi.log.info(`Synced ${recentOrders.length} orders to Google Sheets`);
          }
        } catch (error) {
          strapi.log.error('Error syncing orders to Google Sheets:', error);
        }
      },
    });

    // Expire promotions (runs daily at midnight)
    strapi.cron.add({
      '0 0 * * *': async () => {
        try {
          const expiredPromotions = await strapi.entityService.findMany('api::promotion.promotion', {
            filters: {
              end_date: { $lt: new Date().toISOString().split('T')[0] },
              publishedAt: { $ne: null },
            },
          });

          for (const promotion of expiredPromotions) {
            await strapi.entityService.update('api::promotion.promotion', promotion.id, {
              data: { publishedAt: null },
            });
            strapi.log.info(`Unpublished expired promotion: ${(promotion as any).name}`);
          }

          if (expiredPromotions.length > 0) {
            strapi.log.info(`Expired ${expiredPromotions.length} promotions`);
          }
        } catch (error) {
          strapi.log.error('Error expiring promotions:', error);
        }
      },
    });
  },
};