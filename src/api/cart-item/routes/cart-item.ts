import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::cart-item.cart-item', {
  config: {
    create: { auth: false },
    update: { auth: false },
    delete: { auth: false },
    find: { auth: false },
    findOne: { auth: false },
  },
});