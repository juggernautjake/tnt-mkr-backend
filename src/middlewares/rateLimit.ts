import { Strapi } from '@strapi/strapi';

export default (
  config: { maxRequests?: number; windowSeconds?: number },
  { strapi }: { strapi: Strapi }
) => {
  const maxRequests = config.maxRequests || 500; // Default to 500 if not specified
  const windowSeconds = config.windowSeconds || 60; // Default to 1 minute

  return async (ctx: any, next: any) => {
    // Use x-guest-session header if available, fallback to IP
    let identifier = ctx.request.headers['x-guest-session'] || ctx.request.ip;
    if (!identifier) {
      return ctx.badRequest('Identifier (guest session or IP) is required');
    }

    const redis = strapi.redis;
    if (!redis) {
      strapi.log.warn('Redis not available, skipping rate limiting');
      return await next();
    }

    const key = `rate:${identifier}`;
    let count: string | null;
    try {
      count = await redis.get(key);
    } catch (err) {
      strapi.log.error('Error accessing Redis:', err);
      return ctx.internalServerError('Rate limiting error');
    }

    if (count && parseInt(count) >= maxRequests) {
      strapi.log.info(`Rate limit exceeded for ${identifier}: ${count}/${maxRequests}`);
      return ctx.forbidden('Too many requests');
    }

    await next();

    // Only update count if the response status is 200
    if (ctx.response.status === 200) {
      try {
        if (!count) {
          await redis.set(key, 1, { EX: windowSeconds });
        } else {
          await redis.incr(key);
        }
      } catch (err) {
        strapi.log.error('Error updating rate limit count in Redis:', err);
      }
    }
  };
};