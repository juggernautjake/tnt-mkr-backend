import { factories } from '@strapi/strapi';

interface OrderData {
  order_items: { product: number; quantity: number; price: number }[];
  shipping_method: number | { id: number };
  subtotal: number; // In cents
  shipping_cost: number; // In cents
  sales_tax: number; // In cents
  transaction_fee: number; // In cents
  discount_total: number; // In cents
}

export default factories.createCoreService('api::order.order', ({ strapi }) => ({
  async calculateTotal(order: OrderData): Promise<number> {
    const subtotalCents = order.order_items.reduce(
      (sum: number, item: { product: number; quantity: number; price: number }) => {
        const itemTotal = item.price * item.quantity; // Price already in cents
        strapi.log.debug(`[Order Service] Item total: ${item.price} cents * ${item.quantity} = ${itemTotal} cents`);
        return sum + itemTotal;
      },
      0
    );
    strapi.log.debug(`[Order Service] Subtotal: ${subtotalCents} cents`);

    const totalItems = order.order_items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    const shippingMethodId = typeof order.shipping_method === 'object' ? order.shipping_method.id : order.shipping_method;
    const shippingMethod = await strapi.entityService.findOne(
      'api::shipping-option.shipping-option',
      shippingMethodId,
      {
        fields: ['baseCost', 'costPerItem'],
      }
    );
    const baseCostCents = Math.round(shippingMethod.baseCost * 100);
    const costPerItemCents = Math.round(shippingMethod.costPerItem * 100);
    const shippingCents = baseCostCents + costPerItemCents * (totalItems - 1);
    strapi.log.debug(`[Order Service] Shipping: base=${baseCostCents}, perItem=${costPerItemCents} * ${totalItems - 1} = ${shippingCents} cents`);

    const taxRate = process.env.TAX_RATE ? parseFloat(process.env.TAX_RATE) : 0.0825;
    const taxCents = Math.round(subtotalCents * taxRate);
    strapi.log.debug(`[Order Service] Tax: ${subtotalCents} * ${taxRate} = ${taxCents} cents`);

    const transactionFeeCents = order.transaction_fee; // Already in cents

    const totalCents = subtotalCents + shippingCents + taxCents + transactionFeeCents;
    strapi.log.debug(`[Order Service] Total: ${totalCents} cents (subtotal=${subtotalCents}, shipping=${shippingCents}, tax=${taxCents}, fee=${transactionFeeCents})`);

    return totalCents;
  },
}));