import { factories } from '@strapi/strapi';
import Stripe from 'stripe';
import Handlebars from 'handlebars';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-05-28.basil',
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
    base_price: string;
    quantity: number;
    order_item_parts: Array<{
      id: number;
      product_part: { id: number; name: string };
      color: { id: number; name: string; hex_codes: Array<{ hex_code: string }> };
    }>;
    promotions: Array<{ id: number; name: string }>;
  }>;
  subtotal: number;
  shipping_cost: number;
  sales_tax: number;
  discount_total: number;
  transaction_fee: number;
  shipping_method: { id: number; name: string };
  confirmation_email_sent: boolean;
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
    .order-summary { margin-top: 20px; }
    .order-items { margin-top: 20px; }
    .order-item { border-bottom: 1px solid #ddd; padding: 10px 0; }
    .item-name { font-weight: bold; color: #333; }
    .item-details { display: flex; justify-content: space-between; margin-top: 5px; }
    .customizations { margin-top: 10px; }
    .customization { margin-bottom: 10px; }
    .promotions { margin-top: 10px; }
    .button { position: relative; padding: 0.8rem 1.2rem; border-radius: 9999px; font-weight: bold; cursor: pointer; overflow: hidden; transition: transform 0.2s ease-in-out; border: 2px solid transparent; background-color: #fe5100; color: white; display: inline-block; text-decoration: none; text-align: center; margin-top: 20px; }
    .button:hover { transform: scale(1.05); background: linear-gradient(45deg, #fe5100, white, #fe5100); color: #333; }
    .footer { margin-top: 20px; font-size: 12px; color: #555; text-align: center; }
    .contact-instructions { margin-top: 20px; }
    .promotions-list { margin-top: 20px; }
    .strikethrough { text-decoration: line-through; color: #888; margin-right: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Thank You for Your Order!</h1>
    <p class="intro-text">We’ve received your order and will begin processing it shortly.<br>Please save the order confirmation information below.</p>
    <div class="order-details">
      <p><strong>Order Number:</strong> {{ order_number }}</p>
      <p><strong>Order Date:</strong> {{ ordered_at }}</p>
      <p><strong>Payment Method:</strong> ****-****-****-{{ payment_last_four }}</p>
      <p><strong>Shipping to:</strong> {{ customer_name }} <br>{{ shipping_address.street }}, {{ shipping_address.city }}, {{ shipping_address.state }} {{ shipping_address.postal_code }}, {{ shipping_address.country }}</p>
      <p><strong>Billing Address:</strong> <br>{{ billing_address.street }}, {{ billing_address.city }}, {{ billing_address.state }} {{ billing_address.postal_code }}, {{ billing_address.country }}</p>
    </div>
    <div class="order-summary">
      <h2>Order Summary</h2>
      <p><strong>Subtotal:</strong> {{ subtotal }}</p>
      <p><strong>Shipping Method:</strong> {{ shipping_method }}</p>
      <p><strong>Shipping Cost:</strong> {{ shipping_cost }}</p>
      <p><strong>Tax:</strong> {{ sales_tax }}</p>
      {{#if discount_total}}
      <p><strong>Total Amount Saved:</strong> -{{ discount_total }}</p>
      {{/if}}
      <p><strong>Transaction Fee:</strong> {{ transaction_fee }}</p>
      <p><strong>Total:</strong> {{ total_amount }}</p>
    </div>
    <div class="order-items">
      <h2 style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px;">Items Purchased</h2>
      {{#order_items}}
      <div class="order-item">
        <div class="item-name">{{ product.name }}</div>
        <div class="item-details">
          {{#if (gt base_price price)}}
            <span>Original Price: <span class="strikethrough">{{ base_price }}</span><br>Discounted Price: {{ price }}<br>Quantity: {{ quantity }}</span>
          {{else}}
            <span>Price: {{ price }}<br>Quantity: {{ quantity }}</span>
          {{/if}}
        </div>
        {{#order_item_parts}}
        <div class="customization">
          <span>{{ product_part.name }}: {{ color.name }}</span>
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
    {{#if applied_promotions.length}}
    <div class="promotions-list">
      <h2 style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px;">Applied Promotions</h2>
      <ul>
        {{#applied_promotions}}
        <li>{{ this }}</li>
        {{/applied_promotions}}
      </ul>
    </div>
    {{/if}}
    <p>We’ll notify you when your order ships.</p>
    <p class="contact-instructions">
      If you have any questions, disputes, or changes to your order, please use the contact form on our website and reference your order confirmation number.
    </p>
    <a href="{{ frontend_url }}" class="button">Visit Our Store</a>
    <div class="footer"><p>© TNT MKR. All rights reserved.</p></div>
  </div>
</body>
</html>
`;

Handlebars.registerHelper('gt', function (a, b) {
  return parseFloat(a) > parseFloat(b);
});

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
          'shipping_method',
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
      if (order.confirmation_email_sent) {
        strapi.log.info(`Confirmation email already sent for order ${order.id}; skipping`);
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

        const cartId = event_data.metadata.cart_id;
        if (cartId) {
          const cart = await strapi.entityService.findOne('api::cart.cart', cartId, {
            populate: { cart_items: true },
          });
          if (cart) {
            for (const item of cart.cart_items || []) {
              await strapi.entityService.delete('api::cart-item.cart-item', item.id);
            }
            await strapi.entityService.delete('api::cart.cart', cartId);
            strapi.log.info(`Deleted cart ${cartId} and its items after successful payment`);
          }
        }

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
            'shipping_method',
          ],
        }) as Order;

        await this.sendConfirmationEmail(updatedOrder);

        // New: Send notification to company email
        await this.sendAdminNotification(updatedOrder);

        await strapi.entityService.update('api::order.order', order.id, {
          data: { confirmation_email_sent: true },
        });
      } catch (error) {
        strapi.log.error(`Error processing payment_intent.succeeded for order ${order.id}: ${error.message}`);
        throw error;
      }
    } else if (event_type === 'payment_intent.payment_failed') {
      const paymentIntentId = event_data.id;

      const orders = await strapi.db.query('api::order.order').findMany({
        where: { payment_intent_id: paymentIntentId },
        populate: ['user', 'shipping_address', 'billing_address'],
      }) as Order[];

      if (orders.length === 0) {
        strapi.log.warn(`No order found for payment_intent_id: ${paymentIntentId}`);
        return;
      }

      const order = orders[0];
      if (order.payment_status === 'failed') {
        strapi.log.info(`Order ${order.id} already marked as failed; skipping`);
        return;
      }

      const updateData: OrderUpdateData = {
        payment_status: 'failed',
        order_status: 'canceled',
      };

      await strapi.entityService.update('api::order.order', order.id, { data: updateData });
      strapi.log.info(`Updated order ${order.id} to payment_status: failed, order_status: canceled`);

      const customerEmail = order.guest_email || order.user?.email;
      if (customerEmail) {
        const failureReason = event_data.last_payment_error?.message || 'Unknown reason';
        await strapi.plugins['email'].services.email.send({
          to: customerEmail,
          from: 'TNT MKR <no-reply@tnt-mkr.com>',
          subject: 'Payment Failed - TNT-MKR',
          text: `Your payment for order ${order.order_number} failed due to: ${failureReason}. Please try again with a different payment method.`,
        });
        strapi.log.info(`Sent payment failure email to ${customerEmail} for order ${order.id}`);
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
          'shipping_method',
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
      if (order.confirmation_email_sent) {
        strapi.log.info(`Confirmation email already sent for order ${order.id}; skipping`);
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
          'shipping_method',
        ],
      }) as Order;

      await this.sendConfirmationEmail(updatedOrder);

      // New: Send notification to company email
      await this.sendAdminNotification(updatedOrder);

      await strapi.entityService.update('api::order.order', order.id, {
        data: { confirmation_email_sent: true },
      });
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
        from: 'TNT MKR <no-reply@tnt-mkr.com>',
        subject: 'Order Confirmation - TNT-MKR',
        html,
      });
      strapi.log.info(`Confirmation email sent to ${customerEmail} for order ${order.id}`);
    } catch (error) {
      strapi.log.error(`Failed to send email to ${customerEmail}: ${error.message}`);
    }
  },

  // New method: Send notification to company email
  async sendAdminNotification(order: Order) {
    const companyEmail = 'customer-service@tnt-mkr.com'; // Or your Google group email if different

    const orderData = this.transformOrderData(order);
    const compiledTemplate = Handlebars.compile(ORDER_CONFIRMATION_TEMPLATE);
    const html = compiledTemplate(orderData);

    try {
      await strapi.plugins['email'].services.email.send({
        to: companyEmail,
        from: 'TNT MKR <no-reply@tnt-mkr.com>',
        subject: `New Order Received - #${order.order_number}`,
        html,
      });
      strapi.log.info(`Admin notification email sent to ${companyEmail} for order ${order.id}`);
    } catch (error) {
      strapi.log.error(`Failed to send admin notification to ${companyEmail}: ${error.message}`);
    }
  },

  transformOrderData(order: Order) {
    const appliedPromotions = Array.from(new Set(order.order_items.flatMap(item => item.promotions.map(p => p.name))));
    return {
      order_number: order.order_number,
      ordered_at: new Date(order.ordered_at).toLocaleDateString(),
      total_amount: (order.total_amount / 100).toFixed(2),
      subtotal: (order.subtotal / 100).toFixed(2),
      shipping_cost: (order.shipping_cost / 100).toFixed(2),
      sales_tax: (order.sales_tax / 100).toFixed(2),
      discount_total: (order.discount_total / 100).toFixed(2),
      transaction_fee: (order.transaction_fee / 100).toFixed(2),
      shipping_method: order.shipping_method?.name || 'N/A',
      payment_last_four: order.payment_last_four || '',
      customer_name: order.customer_name,
      shipping_address: order.shipping_address || {},
      billing_address: order.billing_address || {},
      order_items: order.order_items.map((item) => ({
        product: item.product,
        price: parseFloat(item.price).toFixed(2),
        base_price: parseFloat(item.base_price).toFixed(2),
        quantity: item.quantity,
        order_item_parts: item.order_item_parts.map((part) => ({
          product_part: part.product_part,
          color: part.color,
        })),
        promotions: item.promotions,
      })),
      applied_promotions: appliedPromotions,
      frontend_url: process.env.FRONTEND_URL || 'https://www.tnt-mkr.com',
    };
  },
}));