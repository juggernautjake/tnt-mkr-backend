import { factories } from '@strapi/strapi';

// Calculate effective price using pre-fetched promotions
function calculateEffectivePrice(product: any, promotions: any[]): number {
  const productPromotions = promotions.filter(promo =>
    promo.products.some(p => p.id === product.id)
  );
  let effectivePrice = product.default_price;
  let maxDiscount = 0;

  productPromotions.forEach(promo => {
    const discount = promo.discount_percentage
      ? product.default_price * (promo.discount_percentage / 100)
      : promo.discount_amount || 0;
    maxDiscount = Math.max(maxDiscount, discount);
  });

  if (maxDiscount > 0) {
    effectivePrice = product.default_price - maxDiscount;
  } else if (product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }

  return Number(effectivePrice.toFixed(2));
}

// Determine sale details using pre-fetched promotions
function getSaleDetails(product: any, promotions: any[]): { on_sale: boolean; is_preorder_sale: boolean } {
  const productPromotions = promotions.filter(promo =>
    promo.products.some(p => p.id === product.id)
  );
  const on_sale = productPromotions.length > 0 || (product.on_sale && product.discounted_price);
  const is_preorder_sale = productPromotions.some(promo => promo.is_preorder);
  return { on_sale, is_preorder_sale };
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async find(ctx: any) {
    const { query } = ctx;
    const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
    if (!populate.includes('promotions')) {
      populate.push('promotions');
    }

    const entities = await strapi.entityService.findMany('api::product.product', {
      ...query,
      filters: { ...query.filters, publishedAt: { $ne: null } },
      populate,
    });

    // Batch fetch all active promotions once
    const currentDate = new Date().toISOString().split('T')[0];
    const promotions = await strapi.db.query('api::promotion.promotion').findMany({
      where: {
        start_date: { $lte: currentDate },
        end_date: { $gte: currentDate },
        publishedAt: { $ne: null },
      },
      populate: ['products'],
    });

    // Enhance entities with calculated fields
    const enhancedEntities = entities.map(entity => {
      const effective_price = calculateEffectivePrice(entity, promotions);
      const { on_sale, is_preorder_sale } = getSaleDetails(entity, promotions);
      return {
        ...entity,
        effective_price,
        on_sale,
        is_preorder_sale,
      };
    });

    return this.sanitizeOutput(enhancedEntities, ctx);
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const { query } = ctx;
    const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
    if (!populate.includes('promotions')) {
      populate.push('promotions');
    }

    const entity = await strapi.entityService.findOne('api::product.product', id, {
      ...query,
      populate,
    });
    if (!entity || !entity.publishedAt) {
      return ctx.notFound('Product not found');
    }

    // Batch fetch all active promotions once
    const currentDate = new Date().toISOString().split('T')[0];
    const promotions = await strapi.db.query('api::promotion.promotion').findMany({
      where: {
        start_date: { $lte: currentDate },
        end_date: { $gte: currentDate },
        publishedAt: { $ne: null },
      },
      populate: ['products'],
    });

    const effective_price = calculateEffectivePrice(entity, promotions);
    const { on_sale, is_preorder_sale } = getSaleDetails(entity, promotions);
    const enhancedEntity = {
      ...entity,
      effective_price,
      on_sale,
      is_preorder_sale,
    };

    return this.sanitizeOutput(enhancedEntity, ctx);
  },
}));