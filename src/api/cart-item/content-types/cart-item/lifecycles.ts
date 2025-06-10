export default {
  async afterCreate(event: any) {
    await updateCartTotal(event.result.cart?.id);
  },
  async afterUpdate(event: any) {
    await updateCartTotal(event.result.cart?.id);
  },
  async afterDelete(event: any) {
    await updateCartTotal(event.result.cart?.id);
  },
};

async function roundTo99Cents(price: number): Promise<number> {
  const dollars = Math.floor(price);
  const cents = price - dollars;
  if (cents === 0.99) {
    return price;
  }
  return dollars + 0.99;
}

async function calculateEffectivePrice(strapi: any, productId: number): Promise<number> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const product = await strapi.entityService.findOne('api::product.product', productId, {
    populate: ['promotions'],
  });

  if (!product) {
    throw new Error(`Product with ID ${productId} not found`);
  }

  let effectivePrice = product.default_price;
  
  const promotions = await strapi.db.query('api::promotion.promotion').findMany({
    where: {
      products: { id: productId },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      publishedAt: { $ne: null },
    },
  });

  let isDiscounted = false;
  promotions.forEach((promotion: any) => {
    if (promotion.discount_percentage) {
      const discount = product.default_price * (promotion.discount_percentage / 100);
      effectivePrice = Math.min(effectivePrice, product.default_price - discount);
      isDiscounted = true;
    } else if (promotion.discount_amount) {
      effectivePrice = Math.min(effectivePrice, product.default_price - promotion.discount_amount);
      isDiscounted = true;
    }
  });

  if (isDiscounted) {
    effectivePrice = await roundTo99Cents(effectivePrice);
  } else if (promotions.length === 0 && product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }

  return effectivePrice; // Return as number
}

async function updateCartTotal(cartId: number) {
  if (!cartId) return;

  const cart = await strapi.entityService.findOne('api::cart.cart', cartId, {
    populate: { cart_items: { populate: ['product'] } },
  });

  if (!cart) return;

  const total = await (cart.cart_items || []).reduce(async (sumPromise: Promise<number>, item: any) => {
    const sum = await sumPromise;
    const effectivePrice = await calculateEffectivePrice(strapi, item.product.id);
    return sum + (effectivePrice * (item.quantity || 1));
  }, Promise.resolve(0));

  await strapi.entityService.update('api::cart.cart', cartId, {
    data: { total: Math.round(total * 100) / 100 }, // Keep as number, rounded to 2 decimal places
  });
}