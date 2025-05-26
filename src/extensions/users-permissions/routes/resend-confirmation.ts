import { Strapi } from '@strapi/strapi';
import createAuthController from '../controllers/auth';

export default ({ strapi }: { strapi: Strapi }) => {
  const authController = createAuthController({ strapi });

  return {
    routes: [
      {
        method: 'POST',
        path: '/auth/resend-confirmation',
        handler: authController.resendConfirmationEmail,
        config: {
          middlewares: ['global::rateLimit'],
          auth: false,
        },
      },
    ],
  };
};