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
    // Recalculate effective_price if price fields are updated
    if (data.default_price !== undefined || data.discounted_price !== undefined) {
      const currentProduct = await strapi.db.query('api::product.product').findOne({
        where: { id: event.params.where.id },
      });
      const updatedProduct = { ...currentProduct, ...data };

      const currentDate = new Date().toISOString().split('T')[0];
      const promotions = await strapi.db.query('api::promotion.promotion').findMany({
        where: {
          start_date: { $lte: currentDate },
          end_date: { $gte: currentDate },
          publishedAt: { $ne: null },
        },
        populate: ['products'],
      });

      const productPromotions = promotions.filter(promo =>
        promo.products.some(p => p.id === updatedProduct.id)
      );
      let effectivePrice = updatedProduct.default_price;
      let maxDiscount = 0;

      productPromotions.forEach(promo => {
        const discount = promo.discount_percentage
          ? updatedProduct.default_price * (promo.discount_percentage / 100)
          : promo.discount_amount || 0;
        maxDiscount = Math.max(maxDiscount, discount);
      });

      if (maxDiscount > 0) {
        effectivePrice = updatedProduct.default_price - maxDiscount;
      } else if (updatedProduct.discounted_price) {
        effectivePrice = updatedProduct.discounted_price;
      }

      data.effective_price = Number(effectivePrice.toFixed(2));
    }
  },
};