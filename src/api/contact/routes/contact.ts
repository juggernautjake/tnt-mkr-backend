import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::contact.contact', {
  config: {
    create: {
      auth: false, // Public endpoint for contact form
    },
  },
});