import { factories } from '@strapi/strapi';

// Utility function to normalize fields input
function normalizeFields(fieldsInput: any): string[] {
  if (typeof fieldsInput === 'string') {
    return fieldsInput.split(',').filter(field => field !== 'is_preorder_sale');
  } else if (fieldsInput && typeof fieldsInput === 'object') {
    return Object.values(fieldsInput)
      .filter((field: any) => typeof field === 'string' && field !== 'is_preorder_sale') as string[];
  } else {
    return ['id', 'name', 'default_price', 'effective_price', 'slug', 'on_sale'];
  }
}

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
    try {
      const { query } = ctx;
      const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
      if (!populate.includes('promotions')) {
        populate.push('promotions');
      }

      // Use the utility function to get fields
      const fields = normalizeFields(query.fields);

      const entities = await strapi.entityService.findMany('api::product.product', {
        ...query,
        fields,
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
          is_preorder_sale, // Calculated, not fetched directly
        };
      });

      return this.sanitizeOutput(enhancedEntities, ctx);
    } catch (error) {
      console.error('Error in product find method:', error);
      ctx.status = 500;
      return { error: { status: 500, name: 'InternalServerError', message: 'Failed to fetch products', details: error.message } };
    }
  },

  async findOne(ctx: any) {
    try {
      const { id } = ctx.params;
      const { query } = ctx;
      const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
      if (!populate.includes('promotions')) {
        populate.push('promotions');
      }

      // Use the utility function to get fields
      const fields = normalizeFields(query.fields);

      const entity = await strapi.entityService.findOne('api::product.product', id, {
        ...query,
        fields,
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
        is_preorder_sale, // Calculated based on promotions
      };

      return this.sanitizeOutput(enhancedEntity, ctx);
    } catch (error) {
      console.error('Error in product findOne method:', error);
      ctx.status = 500;
      return { error: { status: 500, name: 'InternalServerError', message: 'Failed to fetch product', details: error.message } };
    }
  },
}));