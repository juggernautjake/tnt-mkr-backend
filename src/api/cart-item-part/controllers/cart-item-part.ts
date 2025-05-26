import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::cart-item-part.cart-item-part', ({ strapi }) => ({
  async create(ctx) {
    strapi.log.debug('[Cart Item Part Create] Starting creation process');
    const response = await super.create(ctx);
    const { id } = response.data;
    
    strapi.log.debug(`[Cart Item Part Create] Created entry with ID: ${id}`);
    
    try {
      // Update the entry to set publishedAt for publishing
      const updatedEntry = await strapi.entityService.update('api::cart-item-part.cart-item-part', id, {
        data: {
          publishedAt: new Date().toISOString(),
        },
      });
      strapi.log.info(`[Cart Item Part Create] Successfully published cart item part ${id}`);
      strapi.log.debug(`[Cart Item Part Create] Updated entry: ${JSON.stringify(updatedEntry)}`);
    } catch (error) {
      strapi.log.error(`[Cart Item Part Create] Failed to publish cart item part ${id}:`, error);
      throw error;
    }
    
    strapi.log.debug('[Cart Item Part Create] Creation process completed');
    return response;
  },
}));