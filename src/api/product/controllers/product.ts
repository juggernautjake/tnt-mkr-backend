import { factories } from '@strapi/strapi';

// Function to calculate effective price based on active promotions
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
  let maxDiscount = 0;

  promotions.forEach((promotion: any) => {
    let discount = 0;
    if (promotion.discount_percentage) {
      discount = product.default_price * (promotion.discount_percentage / 100);
    } else if (promotion.discount_amount) {
      discount = promotion.discount_amount;
    }
    if (discount > maxDiscount) {
      maxDiscount = discount;
    }
  });

  if (maxDiscount > 0) {
    effectivePrice = product.default_price - maxDiscount;
  } else if (product.on_sale && product.discounted_price) {
    effectivePrice = product.discounted_price;
  }

  return Number(effectivePrice.toFixed(2));
}

// Function to determine if the product is on sale and if it's a preorder sale
async function getSaleDetails(strapi: any, product: any): Promise<{ on_sale: boolean; is_preorder_sale: boolean }> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const promotions = await strapi.db.query('api::promotion.promotion').findMany({
    where: {
      products: { id: product.id },
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate },
      publishedAt: { $ne: null },
    },
  });

  const on_sale = promotions.length > 0 || (product.on_sale && product.discounted_price);
  const is_preorder_sale = promotions.some((promo: any) => promo.is_preorder);

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

    const enhancedEntities = await Promise.all(entities.map(async (entity: any) => {
      const { on_sale, is_preorder_sale } = await getSaleDetails(strapi, entity);
      const effective_price = await calculateEffectivePrice(strapi, entity);
      return {
        ...entity,
        effective_price,
        on_sale,
        is_preorder_sale,
      };
    }));

    return this.sanitizeOutput(enhancedEntities, ctx);
  },

  async findOne(ctx: any) {
    const { id } = ctx.params;
    const { query } = ctx;
    const populate = query.populate ? query.populate.split(',') : ['thumbnail_image', 'colors', 'promotions'];
    
    if (!populate.includes('promotions')) {
      populate.push('promotions');
    }

    const entity = await strapi.entityService.findOne('api::product.product', id, { ...query, populate });
    if (!entity || !entity.publishedAt) {
      return ctx.notFound('Product not found');
    }

    const { on_sale, is_preorder_sale } = await getSaleDetails(strapi, entity);
    const effective_price = await calculateEffectivePrice(strapi, entity);
    const enhancedEntity = {
      ...entity,
      effective_price,
      on_sale,
      is_preorder_sale,
    };

    return this.sanitizeOutput(enhancedEntity, ctx);
  },
}));