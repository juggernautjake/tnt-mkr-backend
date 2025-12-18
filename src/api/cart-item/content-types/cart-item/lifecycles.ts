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

async function calculateEffectivePriceForItem(strapi: any, item: any): Promise<number> {
  // Check if this is an additional part purchase
  if (item.is_additional_part && item.cart_item_parts && item.cart_item_parts.length === 1) {
    const partData = item.cart_item_parts[0].product_part;
    if (!partData) {
      // Fallback to stored effective_price if part data not populated
      return item.effective_price || 0;
    }
    
    // Fetch the full part to get pricing
    const part = await strapi.entityService.findOne('api::product-part.product-part', partData.id, {});
    if (!part) {
      return item.effective_price || 0;
    }
    
    let effectivePrice = part.discounted_price && part.discounted_price < part.price 
      ? part.discounted_price 
      : part.price;
    
    if (part.discounted_price && part.discounted_price < part.price) {
      effectivePrice = await roundTo99Cents(effectivePrice);
    }
    
    return effectivePrice;
  }
  
  // Full product purchase - calculate based on product pricing and promotions
  if (!item.product?.id) {
    return item.effective_price || 0;
  }
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  const product = await strapi.entityService.findOne('api::product.product', item.product.id, {
    populate: ['promotions'],
  });

  if (!product) {
    throw new Error(`Product with ID ${item.product.id} not found`);
  }

  let effectivePrice = product.default_price;
  
  const promotions = await strapi.db.query('api::promotion.promotion').findMany({
    where: {
      products: { id: item.product.id },
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

  return effectivePrice;
}

async function updateCartTotal(cartId: number) {
  if (!cartId) return;

  const cart = await strapi.entityService.findOne('api::cart.cart', cartId, {
    populate: { 
      cart_items: { 
        populate: ['product', 'cart_item_parts.product_part'] 
      } 
    },
  });

  if (!cart) return;

  const total = await (cart.cart_items || []).reduce(async (sumPromise: Promise<number>, item: any) => {
    const sum = await sumPromise;
    const effectivePrice = await calculateEffectivePriceForItem(strapi, item);
    return sum + (effectivePrice * (item.quantity || 1));
  }, Promise.resolve(0));

  await strapi.entityService.update('api::cart.cart', cartId, {
    data: { total: Math.round(total * 100) / 100 },
  });
}