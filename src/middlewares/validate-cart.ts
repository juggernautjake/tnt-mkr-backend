// src/middlewares/validate-cart.ts
import { Strapi } from '@strapi/strapi';

export default (config: Record<string, any>, { strapi }: { strapi: Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    strapi.log.debug('global::validate-cart: Validating cart request');
    const { data } = ctx.request.body || {};

    if (!data || data.total === undefined || data.total === null) {
      strapi.log.error('global::validate-cart: Total is missing or null in request body');
      return ctx.badRequest('Total field is required and cannot be null');
    }

    strapi.log.debug('global::validate-cart: Validation passed');
    await next();
  };
};