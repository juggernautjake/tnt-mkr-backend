import { factories } from '@strapi/strapi';

// Standalone function to calculate effective price
async function calculateEffectivePrice(strapi: any, product: any): Promise<number> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Fetch active promotions for the product
  const promotions = await strapi.db.query('api::promotion.promotion').findMany({
    where: {
      products: { id: product.id },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      publishedAt: { $ne: null },
    },
  });

  let effectivePrice = product.default_price;
  
  // Apply the highest discount from active promotions
  promotions.forEach((promotion: any) => {
    if (promotion.discount_percentage) {
      const discount = product.default_price * (promotion.discount_percentage / 100);
      effectivePrice = Math.min(effectivePrice, product.default_price - discount);
    } else if (promotion.discount_amount) {
      effectivePrice = Math.min(effectivePrice, product.default_price - promotion.discount_amount);
    }
  });

  // If no promotion applies, use discounted_price if on_sale is true
  if (promotions.length === 0 && product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }

  return Number(effectivePrice.toFixed(2));
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async find(ctx: any) {
    const { query } = ctx;
    const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
    
    // Ensure promotions are included in populate
    if (!populate.includes('promotions')) {
      populate.push('promotions');
    }

    const entities = await strapi.entityService.findMany('api::product.product', {
      ...query,
      filters: { ...query.filters, publishedAt: { $ne: null } },
      populate,
    });

    // Add effective_price to each product
    const enhancedEntities = await Promise.all(entities.map(async (entity: any) => ({
      ...entity,
      effective_price: await calculateEffectivePrice(strapi, entity),
    })));

    return this.sanitizeOutput(enhancedEntities, ctx);
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const { query } = ctx;
    const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
    
    // Ensure promotions are included in populate
    if (!populate.includes('promotions')) {
      populate.push('promotions');
    }

    const entity = await strapi.entityService.findOne('api::product.product', id, { ...query, populate });
    if (!entity || !entity.publishedAt) {
      return ctx.notFound('Product not found');
    }

    // Add effective_price to the product
    const enhancedEntity = {
      ...entity,
      effective_price: await calculateEffectivePrice(strapi, entity),
    };

    return this.sanitizeOutput(enhancedEntity, ctx);
  },
}));