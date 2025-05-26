import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::promotion.promotion', ({ strapi }) => ({
  async find(ctx) {
    const currentDate = new Date().toISOString().split('T')[0];
    ctx.query = {
      ...ctx.query,
      filters: {
        ...ctx.query.filters,
        start_date: { $lte: currentDate },
        end_date: { $gte: currentDate }
      }
    };
    return super.find(ctx);
  }
}));