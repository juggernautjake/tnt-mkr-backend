import { factories } from '@strapi/strapi';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

export default factories.createCoreController('api::webhook-event.webhook-event', ({ strapi }) => ({
  async create(ctx) {
    // Capture the raw request body for Stripe verification
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
      // Verify the event
      const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      strapi.log.info(`Webhook event received: ${event.id} (${event.type})`);

      const event_id = event.id;
      const event_type = event.type;
      const event_data = event.data.object;
      const timestamp = new Date(event.created * 1000).toISOString();
      const source = 'stripe';

      // Check for duplicate events
      const existingEvent = await strapi.db.query('api::webhook-event.webhook-event').findOne({
        where: { event_id },
      });
      if (existingEvent) {
        strapi.log.info(`Duplicate webhook event ${event_id} detected; acknowledging but not reprocessing`);
        ctx.body = { received: true };
        return;
      }

      // Store the event with processed: false
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

      // Respond to Stripe immediately
      ctx.body = { received: true };
      strapi.log.info(`Acknowledged webhook event ${event_id} to Stripe`);

      // Process the event asynchronously
      setImmediate(async () => {
        try {
          await strapi.service('api::webhook-event.webhook-event').processWebhookEvent(webhookEvent);
          await strapi.entityService.update('api::webhook-event.webhook-event', webhookEvent.id, {
            data: { processed: true },
          });
          strapi.log.info(`Webhook event ${event_id} processed successfully`);
        } catch (error) {
          strapi.log.error(`Failed to process webhook event ${event_id}: ${error.message}`);
        }
      });

      return;
    } catch (error) {
      strapi.log.error(`Webhook verification failed: ${error.message}`);
      return ctx.badRequest('Webhook verification failed', { error: error.message });
    }
  },
}));