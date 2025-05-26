export default {
    async afterCreate(event: any) {
      const { result } = event;
      if (result) {
        // Publish the cart_item_part by setting publishedAt to current timestamp
        await strapi.entityService.update('api::cart-item-part.cart-item-part', result.id, {
          data: {
            publishedAt: new Date().toISOString(),
          },
        });
      }
    },
  };