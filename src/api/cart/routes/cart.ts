import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::cart.cart', {
  config: {
    find: { auth: false },
    create: { auth: false },
    update: { auth: false },
  },
});