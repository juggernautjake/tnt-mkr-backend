import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::user-custom-case.user-custom-case', ({ strapi }) => ({
  async getPublicCases(ctx: any) {
    const cases = await strapi.entityService.findMany('api::user-custom-case.user-custom-case', {
      filters: { public: true, publishedAt: { $ne: null } },
      populate: ['product', 'selected_colors', 'engravings'],
    });
    return cases;
  },
}));
