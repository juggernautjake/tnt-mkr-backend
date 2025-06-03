/**
 * cart-item-part router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::cart-item-part.cart-item-part', {
  config: {
    create: { auth: false },
  },
});