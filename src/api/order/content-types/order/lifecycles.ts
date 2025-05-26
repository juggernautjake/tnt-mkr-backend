export default {
  async beforeCreate(event: { params: { data: any } }) {
    const { data } = event.params;
    strapi.log.debug(`[Order Lifecycle] BeforeCreate started with data: ${JSON.stringify(data)}`);

    if (!data.order_number) {
      data.order_number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      strapi.log.debug(`[Order Lifecycle] Generated order_number: ${data.order_number}`);
    }
    if (!data.total_amount) {
      strapi.log.error('[Order Lifecycle] Total amount is missing');
      throw new Error('Total amount is required');
    }

    strapi.log.debug('[Order Lifecycle] BeforeCreate completed');
  },

  async beforeUpdate(event: { params: { data: any; where: { id: number } } }) {
    const { data, where } = event.params;
    strapi.log.debug(`[Order Lifecycle] BeforeUpdate started for order ${where.id} with data: ${JSON.stringify(data)}`);

    // Define fields that trigger total recalculation
    const isUpdatingItems =
      data.order_items &&
      (data.order_items.connect?.length > 0 || data.order_items.disconnect?.length > 0);
    const isUpdatingCosts =
      'shipping_cost' in data || 'sales_tax' in data || 'discount_total' in data;

    // Only recalculate total if relevant fields are being updated
    if (isUpdatingItems || isUpdatingCosts) {
      const order = await strapi.entityService.findOne('api::order.order', where.id, {
        populate: { order_items: true },
      });
      strapi.log.debug(`[Order Lifecycle] Fetched existing order: ${JSON.stringify(order)}`);

      // Merge existing order with update data
      const updatedOrder = { ...order, ...data };

      // If order_items is an object with connect/disconnect, retain the existing array for calculation
      if (data.order_items && !Array.isArray(data.order_items)) {
        updatedOrder.order_items = order.order_items; // Use existing order_items array
        strapi.log.debug('[Order Lifecycle] Retained existing order_items for calculation');
      }

      const totalCents = await strapi.service('api::order.order').calculateTotal(updatedOrder);
      const totalFromDataCents = data.total_amount
        ? Number(data.total_amount) * 100
        : Number(order.total_amount) * 100;

      strapi.log.debug(`[Order Lifecycle] Total from data: ${totalFromDataCents} cents`);
      strapi.log.debug(`[Order Lifecycle] Calculated total: ${totalCents} cents`);

      if (Math.abs(totalFromDataCents - totalCents) > 1) {
        strapi.log.error(`[Order Lifecycle] Total mismatch on update. Frontend: ${totalFromDataCents}, Calculated: ${totalCents}`);
        throw new Error('Total mismatch. Please refresh and try again.');
      }
      data.total_amount = (totalCents / 100).toFixed(2);
      strapi.log.debug(`[Order Lifecycle] Updated total_amount to $${data.total_amount}`);
    } else {
      strapi.log.debug('[Order Lifecycle] No relevant fields updated; skipping total recalculation');
    }

    strapi.log.debug('[Order Lifecycle] BeforeUpdate completed');
  },
};