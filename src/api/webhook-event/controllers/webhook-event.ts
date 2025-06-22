import { factories } from '@strapi/strapi';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

export default factories.createCoreController('api::webhook-event.webhook-event', ({ strapi }) => ({
  async create(ctx) {
    const unparsedSymbol = Symbol.for('unparsedBody');
    const rawBody = ctx.request.body[unparsedSymbol];
    if (!rawBody) {
      strapi.log.error('Missing raw body in webhook request');
      return ctx.badRequest('Missing raw body');
    }

    const signature = ctx.request.headers['stripe-signature'];
    if (!signature) {
      strapi.log.error('Missing Stripe-Signature header');
      return ctx.badRequest('Missing Stripe signature');
    }

    try {
      strapi.log.info('Verifying Stripe webhook signature');
      const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      strapi.log.info(`Webhook event received: ${event.id} (${event.type})`);

      const event_id = event.id;
      const event_type = event.type;
      const event_data = event.data.object as any;
      const timestamp = new Date(event.created * 1000).toISOString();
      const source = 'stripe';

      const existingEvent = await strapi.db.query('api::webhook-event.webhook-event').findOne({
        where: { event_id },
      });
      if (existingEvent) {
        strapi.log.info(`Duplicate webhook event ${event_id} detected; acknowledging but not reprocessing`);
        ctx.status = 200;
        ctx.body = { received: true };
        return;
      }

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

      ctx.status = 200;
      ctx.body = { received: true };
      strapi.log.info(`Acknowledged webhook event ${event_id} to Stripe`);

      setImmediate(async () => {
        try {
          await strapi.service('api::webhook-event.webhook-event').processWebhookEvent(webhookEvent);
          await strapi.entityService.update('api::webhook-event.webhook-event', webhookEvent.id, {
            data: { processed: true },
          });
          strapi.log.info(`Webhook event ${event_id} processed successfully`);
        } catch (error) {
          strapi.log.error(`Failed to process webhook event ${event_id}: ${(error as Error).message}`);
        }
      });

      return;
    } catch (error) {
      strapi.log.error(`Webhook verification failed: ${(error as Error).message}`);
      return ctx.badRequest('Webhook verification failed', { error: (error as Error).message });
    }
  },
}));