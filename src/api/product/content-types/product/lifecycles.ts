// src/api/product/content-types/product/lifecycles.ts
export default {
  async beforeCreate(event: any) {
    console.log('Creating product:', event.params.data);
    const data = event.params.data;
    if (data.default_price !== undefined && data.default_price !== null) {
      data.default_price = Number(data.default_price);
    }
    if (data.discounted_price !== undefined && data.discounted_price !== null) {
      data.discounted_price = Number(data.discounted_price);
    }
  },
  async beforeUpdate(event: any) {
    const data = event.params.data;
    if (data.default_price !== undefined && data.default_price !== null) {
      data.default_price = Number(data.default_price);
    }
    if (data.discounted_price !== undefined && data.discounted_price !== null) {
      data.discounted_price = Number(data.discounted_price);
    }
  },
};