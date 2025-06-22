import { factories } from '@strapi/strapi';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
});

export default factories.createCoreService('api::webhook-event.webhook-event', ({ strapi }) => ({
  async processWebhookEvent(event: any) {
    const { event_type, event_data } = event;
    strapi.log.info(`Processing webhook event ${event_type} with ID ${event.event_id}`);
    strapi.log.debug(`Event data: ${JSON.stringify(event_data, null, 2)}`);

    switch (event_type) {
      case 'payment_intent.succeeded': {
        const paymentIntentId = event_data.id;
        strapi.log.info(`Looking for order with payment_intent_id: ${paymentIntentId}`);

        const orders = await strapi.entityService.findMany('api::order.order', {
          filters: { payment_intent_id: paymentIntentId },
          populate: { user: true },
        });

        if (orders.length > 0) {
          const order = orders[0];
          strapi.log.info(`Found order ${order.id} for payment_intent_id: ${paymentIntentId}`);

          try {
            let updateData: {
              payment_status: 'pending' | 'completed' | 'failed';
              order_status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'returned';
              payment_last_four?: string;
            } = {
              payment_status: 'completed',
              order_status: 'paid',
            };

            // Retrieve PaymentIntent
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            strapi.log.debug(`PaymentIntent retrieved: ${JSON.stringify(paymentIntent, null, 2)}`);

            // Try to get last four from charge
            if (paymentIntent.latest_charge) {
              const chargeId = paymentIntent.latest_charge as string;
              strapi.log.info(`Retrieving charge ${chargeId} for order ${order.id}`);
              try {
                const charge = await stripe.charges.retrieve(chargeId);
                strapi.log.debug(`Charge retrieved: ${JSON.stringify(charge, null, 2)}`);
                if (charge.payment_method_details?.card?.last4) {
                  updateData.payment_last_four = charge.payment_method_details.card.last4;
                  strapi.log.info(`Set payment_last_four to ${updateData.payment_last_four} from charge for order ${order.id}`);
                } else {
                  strapi.log.warn(`No card last4 found in charge ${chargeId} for order ${order.id}`);
                }
              } catch (chargeError) {
                strapi.log.error(`Failed to retrieve charge ${chargeId}: ${chargeError.message}`);
              }
            } else {
              strapi.log.warn(`No latest_charge found in PaymentIntent ${paymentIntentId} for order ${order.id}`);
            }

            // Fallback to PaymentMethod if last four not set
            if (!updateData.payment_last_four && paymentIntent.payment_method) {
              const paymentMethodId = paymentIntent.payment_method as string;
              strapi.log.info(`Retrieving payment method ${paymentMethodId} for order ${order.id}`);
              try {
                const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
                strapi.log.debug(`PaymentMethod retrieved: ${JSON.stringify(paymentMethod, null, 2)}`);
                if (paymentMethod.card?.last4) {
                  updateData.payment_last_four = paymentMethod.card.last4;
                  strapi.log.info(`Set payment_last_four to ${updateData.payment_last_four} from payment method for order ${order.id}`);
                } else {
                  strapi.log.warn(`No card last4 found in payment method ${paymentMethodId} for order ${order.id}`);
                }
              } catch (methodError) {
                strapi.log.error(`Failed to retrieve payment method ${paymentMethodId}: ${methodError.message}`);
              }
            }

            // Update the order with type assertion
            const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
              data: updateData as any,
            });
            strapi.log.info(`Updated order ${order.id} with payment_status: completed, order_status: paid, payment_last_four: ${updateData.payment_last_four || 'N/A'}`);
            strapi.log.debug(`Updated order details: ${JSON.stringify(updatedOrder, null, 2)}`);

            // Send confirmation email
            let customerEmail = order.guest_email || (order.user ? order.user.email : null);
            if (customerEmail) {
              await strapi.plugins['email'].services.email.send({
                to: customerEmail,
                subject: 'Order Confirmation - TNT-MKR',
                text: `Thank you for your purchase!\n\nYour order ${order.order_number} has been successfully paid.\nTotal: $${(order.total_amount / 100).toFixed(2)}\n\nWe’ll notify you when it ships.\n\nBest,\nTNT-MKR Team`,
              });
              strapi.log.info(`Confirmation email sent to ${customerEmail} for order ${order.id}`);
            } else {
              strapi.log.warn(`No customer email found for order ${order.id}`);
            }
          } catch (error) {
            strapi.log.error(`Failed to process webhook for order ${order.id}: ${error.message}`);
            throw error;
          }
        } else {
          strapi.log.warn(`No order found for payment_intent_id: ${paymentIntentId}`);
        }
        break;
      }
      case 'charge.succeeded': {
        const charge = event_data;
        const paymentIntentId = charge.payment_intent;
        strapi.log.info(`Processing charge.succeeded for payment_intent_id: ${paymentIntentId}`);

        const orders = await strapi.entityService.findMany('api::order.order', {
          filters: { payment_intent_id: paymentIntentId },
          populate: { user: true },
        });

        if (orders.length > 0) {
          const order = orders[0];
          strapi.log.info(`Found order ${order.id} for payment_intent_id: ${paymentIntentId}`);

          try {
            let updateData: {
              payment_status: 'pending' | 'completed' | 'failed';
              order_status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'returned';
              payment_last_four?: string;
            } = {
              payment_status: 'completed',
              order_status: 'paid',
            };

            if (charge.payment_method_details?.card?.last4) {
              updateData.payment_last_four = charge.payment_method_details.card.last4;
              strapi.log.info(`Set payment_last_four to ${updateData.payment_last_four} from charge.succeeded for order ${order.id}`);
            } else {
              strapi.log.warn(`No card last4 found in charge.succeeded for order ${order.id}`);
            }

            // Update the order with type assertion
            const updatedOrder = await strapi.entityService.update('api::order.order', order.id, {
              data: updateData as any,
            });
            strapi.log.info(`Updated order ${order.id} with payment_status: completed, order_status: paid, payment_last_four: ${updateData.payment_last_four || 'N/A'}`);
            strapi.log.debug(`Updated order details: ${JSON.stringify(updatedOrder, null, 2)}`);

            let customerEmail = order.guest_email || (order.user ? order.user.email : null);
            if (customerEmail) {
              await strapi.plugins['email'].services.email.send({
                to: customerEmail,
                subject: 'Order Confirmation - TNT-MKR',
                text: `Thank you for your purchase!\n\nYour order ${order.order_number} has been successfully paid.\nTotal: $${(order.total_amount / 100).toFixed(2)}\n\nWe’ll notify you when it ships.\n\nBest,\nTNT-MKR Team`,
              });
              strapi.log.info(`Confirmation email sent to ${customerEmail} for order ${order.id}`);
            } else {
              strapi.log.warn(`No customer email found for order ${order.id}`);
            }
          } catch (error) {
            strapi.log.error(`Failed to process charge.succeeded for order ${order.id}: ${error.message}`);
            throw error;
          }
        } else {
          strapi.log.warn(`No order found for payment_intent_id: ${paymentIntentId} in charge.succeeded`);
        }
        break;
      }
      default:
        strapi.log.warn(`Unhandled event type: ${event_type}`);
    }
  },
}));