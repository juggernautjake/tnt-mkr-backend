import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::webhook-event.webhook-event', ({ strapi }) => ({
  async create(ctx) {
    // Log the raw request body for debugging
    strapi.log.info('Received webhook payload:', ctx.request.body);

    // Ensure the body is present and valid
    if (!ctx.request.body || typeof ctx.request.body !== 'object') {
      strapi.log.error('Invalid webhook payload: Body is missing or not an object');
      return ctx.badRequest('Invalid webhook payload');
    }

    const event = ctx.request.body;

    // Extract fields with fallback values to avoid undefined errors
    const event_id = event.id || 'unknown_event_id';
    const event_type = event.type || 'unknown_event_type';
    const event_data = event.data?.object || {};
    const timestamp = event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString();
    const source = 'stripe';

    // Log extracted data for debugging
    strapi.log.info('Extracted event data:', { event_id, event_type, timestamp });

    try {
      const webhookEvent = await strapi.entityService.create('api::webhook-event.webhook-event', {
        data: {
          event_id,
          event_type,
          event_data,
          timestamp,
          source,
          processed: false,
        },
      });

      await strapi.service('api::webhook-event.webhook-event').processWebhookEvent(webhookEvent);
      await strapi.entityService.update('api::webhook-event.webhook-event', webhookEvent.id, {
        data: { processed: true },
      });
      strapi.log.info(`Webhook event ${webhookEvent.event_id} fully processed`);
      return webhookEvent;
    } catch (error) {
      strapi.log.error('Error processing webhook event:', error);
      return ctx.badRequest('Error processing webhook event', { error });
    }
  },
}));