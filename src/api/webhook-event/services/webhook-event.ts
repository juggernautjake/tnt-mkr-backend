import { factories } from '@strapi/strapi';
import Stripe from 'stripe';
import Handlebars from 'handlebars';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-04-30.basil',
});

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  ordered_at: string;
  payment_last_four: string;
  customer_name: string;
  guest_email?: string;
  payment_status: 'pending' | 'completed' | 'failed';
  payment_intent_id?: string;
  user?: { id: number; email: string };
  shipping_address?: { id: number; street: string; city: string; state: string; postal_code: string; country: string };
  billing_address?: { id: number; street: string; city: string; state: string; postal_code: string; country: string };
  order_items: Array<{
    id: number;
    product: { id: number; name: string };
    price: string;
    quantity: number;
    order_item_parts: Array<{
      id: number;
      product_part: { id: number; name: string };
      color: { id: number; name: string; hex_codes: Array<{ hex_code: string }> };
    }>;
    promotions: Array<{ id: number; name: string }>;
  }>;
}

interface OrderUpdateData {
  payment_status?: 'pending' | 'completed' | 'failed';
  order_status?: 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled' | 'returned';
  payment_last_four?: string;
}

const ORDER_CONFIRMATION_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background-color: #fefaf0; font-family: 'Roboto', sans-serif; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); border: 3px solid; border-image: linear-gradient(45deg, #fe5100, white, #fe5100) 1; }
    h1 { color: #fe5100; font-size: 30px; font-weight: bold; margin-bottom: 20px; text-align: center; }
    p { margin: 10px 0; font-size: 16px; }
    .intro-text { text-align: center; margin-bottom: 20px; }
    .order-details { border-top: 1px solid #ddd; padding-top: 15px; margin-bottom: 20px; }
    .order-details p { margin: 8px 0; }
    .order-items { margin-top: 20px; }
    .order-item { border-bottom: 1px solid #ddd; padding: 10px 0; }
    .item-name { font-weight: bold; color: #333; }
    .item-details { display: flex; justify-content: space-between; margin-top: 5px; }
    .customizations { margin-top: 10px; }
    .customization { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
    .color-bubble { width: 30px; height: 20px; border-radius: 10px; border: 2px solid black; }
    .promotions { margin-top: 10px; }
    .button { position: relative; padding: 0.8rem 1.2rem; border-radius: 9999px; font-weight: bold; cursor: pointer; overflow: hidden; transition: transform 0.2s ease-in-out; border: 2px solid transparent; background-color: #fe5100; color: white; display: inline-block; text-decoration: none; text-align: center; margin-top: 20px; }
    .button:hover { transform: scale(1.05); background: linear-gradient(45deg, #fe5100, white, #fe5100); color: #333; }
    .footer { margin-top: 20px; font-size: 12px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Thank You for Your Order!</h1>
    <p class="intro-text">We’ve received your order and will begin processing it shortly.<br>Please save the order confirmation information below.</p>
    <div class="order-details">
      <p><strong>Order Number:</strong> {{ order_number }}</p>
      <p><strong>Order Date:</strong> {{ ordered_at }}</p>
      <p><strong>Total:</strong> {{ total_amount }}</p>
      <p><strong>Payment Method:</strong> ****-****-****-{{ payment_last_four }}</p>
      <p><strong>Shipping to:</strong> {{ customer_name }} <br>{{ shipping_address.street }}, {{ shipping_address.city }}, {{ shipping_address.state }} {{ shipping_address.postal_code }}, {{ shipping_address.country }}</p>
      <p><strong>Billing Address:</strong> <br>{{ billing_address.street }}, {{ billing_address.city }}, {{ billing_address.state }} {{ billing_address.postal_code }}, {{ billing_address.country }}</p>
    </div>
    <div class="order-items">
      <h2 style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px;">Items Purchased</h2>
      {{#order_items}}
      <div class="order-item">
        <div class="item-name">{{ product.name }}</div>
        <div class="item-details">
          <span>Price: {{ price }}<br>Quantity: {{ quantity }}</span>
        </div>
        {{#order_item_parts}}
        <div class="customization">
          <span>{{ product_part.name }}: {{ color.name }}</span>
          <div class="color-bubble" style="background: {{ color.hex_codes.0.hex_code }};"></div>
        </div>
        {{/order_item_parts}}
        {{#promotions}}
        <div class="promotions">
          <h3 style="font-size: 18px; font-weight: bold; color: #333;">Promotions:</h3>
          <p>{{ name }}</p>
        </div>
        {{/promotions}}
      </div>
      {{/order_items}}
    </div>
    <p>We’ll notify you when your order ships.</p>
    <a href="{{ frontend_url }}" class="button">Visit Our Store</a>
    <div class="footer"><p>© TNT MKR. All rights reserved.</p></div>
  </div>
</body>
</html>
`;

export default factories.createCoreService('api::webhook-event.webhook-event', ({ strapi }) => ({
  async processWebhookEvent(event: any) {
    const { event_type, event_data } = event;
    strapi.log.info(`Processing webhook event ${event_type} with ID ${event.event_id}`);

    if (event_type === 'payment_intent.succeeded') {
      const paymentIntentId = event_data.id;

      const orders = await strapi.db.query('api::order.order').findMany({
        where: { payment_intent_id: paymentIntentId },
        populate: [
          'user',
          'shipping_address',
          'billing_address',
          'order_items.product',
          'order_items.order_item_parts.product_part',
          'order_items.order_item_parts.color',
          'order_items.promotions',
        ],
      }) as Order[];

      if (orders.length === 0) {
        strapi.log.warn(`No order found for payment_intent_id: ${paymentIntentId}`);
        return;
      }

      const order = orders[0];
      if (order.payment_status === 'completed') {
        strapi.log.info(`Order ${order.id} already completed; skipping`);
        return;
      }

      const updateData: OrderUpdateData = {
        payment_status: 'completed',
        order_status: 'paid',
      };

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.latest_charge) {
          const chargeId = paymentIntent.latest_charge as string;
          const charge = await stripe.charges.retrieve(chargeId);
          if (charge.payment_method_details?.card?.last4) {
            updateData.payment_last_four = charge.payment_method_details.card.last4;
          }
        }

        await strapi.entityService.update('api::order.order', order.id, { data: updateData });
        strapi.log.info(`Updated order ${order.id} to payment_status: completed, order_status: paid`);

        const updatedOrder = await strapi.db.query('api::order.order').findOne({
          where: { id: order.id },
          populate: [
            'user',
            'shipping_address',
            'billing_address',
            'order_items.product',
            'order_items.order_item_parts.product_part',
            'order_items.order_item_parts.color',
            'order_items.promotions',
          ],
        }) as Order;

        await this.sendConfirmationEmail(updatedOrder);
      } catch (error) {
        strapi.log.error(`Error processing payment_intent.succeeded for order ${order.id}: ${error.message}`);
        throw error;
      }
    } else if (event_type === 'charge.succeeded') {
      const paymentIntentId = event_data.payment_intent;

      const orders = await strapi.db.query('api::order.order').findMany({
        where: { payment_intent_id: paymentIntentId },
        populate: [
          'user',
          'shipping_address',
          'billing_address',
          'order_items.product',
          'order_items.order_item_parts.product_part',
          'order_items.order_item_parts.color',
          'order_items.promotions',
        ],
      }) as Order[];

      if (orders.length === 0) {
        strapi.log.warn(`No order found for payment_intent_id: ${paymentIntentId}`);
        return;
      }

      const order = orders[0];
      if (order.payment_status === 'completed') {
        strapi.log.info(`Order ${order.id} already completed; skipping`);
        return;
      }

      const updateData: OrderUpdateData = {
        payment_status: 'completed',
        order_status: 'paid',
      };
      if (event_data.payment_method_details?.card?.last4) {
        updateData.payment_last_four = event_data.payment_method_details.card.last4;
      }

      await strapi.entityService.update('api::order.order', order.id, { data: updateData });
      strapi.log.info(`Updated order ${order.id} from charge.succeeded`);

      const updatedOrder = await strapi.db.query('api::order.order').findOne({
        where: { id: order.id },
        populate: [
          'user',
          'shipping_address',
          'billing_address',
          'order_items.product',
          'order_items.order_item_parts.product_part',
          'order_items.order_item_parts.color',
          'order_items.promotions',
        ],
      }) as Order;

      await this.sendConfirmationEmail(updatedOrder);
    } else {
      strapi.log.warn(`Unhandled event type: ${event_type}`);
    }
  },

  async sendConfirmationEmail(order: Order) {
    const customerEmail = order.guest_email || order.user?.email;
    if (!customerEmail) {
      strapi.log.warn(`No email available for order ${order.id}`);
      return;
    }

    const orderData = this.transformOrderData(order);
    const compiledTemplate = Handlebars.compile(ORDER_CONFIRMATION_TEMPLATE);
    const html = compiledTemplate(orderData);

    try {
      await strapi.plugins['email'].services.email.send({
        to: customerEmail,
        subject: 'Order Confirmation - TNT-MKR',
        html,
      });
      strapi.log.info(`Confirmation email sent to ${customerEmail} for order ${order.id}`);
    } catch (error) {
      strapi.log.error(`Failed to send email to ${customerEmail}: ${error.message}`);
    }
  },

  transformOrderData(order: Order) {
    return {
      order_number: order.order_number,
      ordered_at: new Date(order.ordered_at).toLocaleDateString(),
      total_amount: (order.total_amount / 100).toFixed(2),
      payment_last_four: order.payment_last_four || '',
      customer_name: order.customer_name,
      shipping_address: order.shipping_address || {},
      billing_address: order.billing_address || {},
      order_items: order.order_items.map((item) => ({
        product: item.product,
        price: parseFloat(item.price).toFixed(2),
        quantity: item.quantity,
        order_item_parts: item.order_item_parts.map((part) => ({
          product_part: part.product_part,
          color: part.color,
        })),
        promotions: item.promotions,
      })),
      frontend_url: process.env.FRONTEND_URL || 'https://www.tnt-mkr.com',
    };
  },
}));