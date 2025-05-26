import { Strapi } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError, ValidationError } = errors;

export default ({ strapi }: { strapi: Strapi }) => ({
  async register(ctx) {
    const { username, email, password, guestSessionId } = ctx.request.body;

    if (!username || !email || !password) {
      throw new ValidationError('Username, email, and password are required');
    }

    try {
      const user = await strapi.plugins['users-permissions'].services.user.add({
        username,
        email,
        password,
        provider: 'local',
        confirmed: false,
      });

      // Store guestSessionId temporarily
      if (guestSessionId) {
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: { pendingGuestSession: guestSessionId },
        });
      }

      await strapi.plugins['users-permissions'].services.user.sendConfirmationEmail(user);

      return ctx.send({
        message: 'Registration successful. Please check your email to confirm your account.',
      });
    } catch (error) {
      strapi.log.error('Error during registration:', error);
      throw new ApplicationError('Failed to register user', { cause: error });
    }
  },

  async emailConfirmation(ctx) {
    const { confirmation: token } = ctx.query;

    if (!token) {
      return ctx.badRequest('Confirmation token is required');
    }

    try {
      const userService = strapi.plugin('users-permissions').service('user');
      const user = await userService.findOne({ confirmationToken: token });

      if (!user) {
        return ctx.badRequest('Invalid confirmation token');
      }

      // Confirm the user
      await userService.edit(user.id, { confirmed: true, confirmationToken: null });

      // Associate guest cart if exists
      const guestSessionId = user.pendingGuestSession;
      if (guestSessionId) {
        const carts = await strapi.entityService.findMany('api::cart.cart', {
          filters: { guest_session: guestSessionId, status: 'active' },
        });

        if (carts.length > 0) {
          const cart = carts[0];
          await strapi.entityService.update('api::cart.cart', cart.id, {
            data: { user: user.id, guest_session: null },
          });
        }

        // Clear pendingGuestSession
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: { pendingGuestSession: null },
        });
      }

      return ctx.redirect(`${process.env.FRONTEND_URL}/confirmation/success`);
    } catch (error) {
      strapi.log.error('Error confirming email:', error);
      return ctx.redirect(`${process.env.FRONTEND_URL}/confirmation/error`);
    }
  },

  async resendConfirmationEmail(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    try {
      const user = await strapi
        .plugin('users-permissions')
        .service('user')
        .fetch({ email });

      if (!user) {
        return ctx.send({ message: 'Confirmation email resent successfully!' });
      }

      if (user.confirmed) {
        throw new ValidationError('Your account is already confirmed.');
      }

      await strapi
        .plugin('users-permissions')
        .service('user')
        .sendConfirmationEmail(user);

      return ctx.send({ message: 'Confirmation email resent successfully!' });
    } catch (error) {
      strapi.log.error('Error resending confirmation email:', error);
      throw new ApplicationError('Failed to resend confirmation email', { cause: error });
    }
  },
});