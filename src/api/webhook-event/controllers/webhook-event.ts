import { factories } from '@strapi/strapi';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

export default factories.createCoreController('api::webhook-event.webhook-event', ({ strapi }) => ({
  async create(ctx) {
    // Capture the raw request body
    let rawBody = '';
    await new Promise<void>((resolve) => {
      ctx.req.setEncoding('utf8');
      ctx.req.on('data', (chunk) => {
        rawBody += chunk;
      });
      ctx.req.on('end', () => {
        resolve();
      });
    });

    // Get the Stripe signature from the headers
    const signature = ctx.request.headers['stripe-signature'];
    if (!signature) {
      strapi.log.error('Missing Stripe signature');
      return ctx.badRequest('Missing Stripe signature');
    }

    try {
      // Verify the event using the raw body, signature, and webhook secret
      const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      strapi.log.info('Webhook signature verified successfully');

      const event_id = event.id;
      const event_type = event.type;
      const event_data = event.data.object;
      const timestamp = new Date(event.created * 1000).toISOString();
      const source = 'stripe';

      // Check if the event has already been processed
      const existingEvent = await strapi.db.query('api::webhook-event.webhook-event').findOne({
        where: { event_id },
      });
      if (existingEvent) {
        strapi.log.info(`Webhook event ${event_id} already processed`);
        return existingEvent;
      }

      // Create a new webhook event entry
      const webhookEvent = await strapi.entityService.create('api::webhook-event.webhook-event', {
        data: {
          event_id,
          event_type,
          event_data: event_data as any, // Cast to any to resolve type mismatch
          timestamp,
          source,
          processed: false,
        },
      });

      // Process the webhook event (e.g., update order status, send email)
      await strapi.service('api::webhook-event.webhook-event').processWebhookEvent(webhookEvent);

      // Mark the event as processed
      await strapi.entityService.update('api::webhook-event.webhook-event', webhookEvent.id, {
        data: { processed: true },
      });

      strapi.log.info(`Webhook event ${webhookEvent.event_id} fully processed`);
      return webhookEvent;
    } catch (error) {
      strapi.log.error(`Webhook processing failed: ${error.message}`);
      return ctx.badRequest('Webhook processing failed', { error: error.message });
    }
  },
}));