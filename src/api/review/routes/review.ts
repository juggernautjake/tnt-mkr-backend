import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::review.review', {
  config: {
    create: {
      auth: {
        scope: ['authenticated'],
      },
    },
  },
});
