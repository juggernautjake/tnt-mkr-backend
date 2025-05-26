// src/api/cart/content-types/cart/lifecycles.ts
export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    if (!Array.isArray(data.cart_items)) data.cart_items = [];
    if (data.total === undefined) {
      throw new Error('Total is required for cart creation');
    }
    data.total = Number(data.total); // Coerce to number
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;
    if (data.total !== undefined) {
      data.total = Number(data.total); // Coerce if provided
    }
  },
};