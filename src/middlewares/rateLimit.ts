import { Strapi } from '@strapi/strapi';

export default (
  config: { maxRequests?: number; windowSeconds?: number },
  { strapi }: { strapi: Strapi }
) => {
  const maxRequests = config.maxRequests || 5;
  const windowSeconds = config.windowSeconds || 3600; // 1 hour

  return async (ctx: any, next: any) => {
    // Attempt to get an identifier from email (in body or query); fallback to IP address
    let identifier = ctx.request.body?.email || ctx.request.query?.email;
    if (!identifier) {
      identifier = ctx.request.ip;
    }
    if (!identifier) {
      return ctx.badRequest('Identifier (email or IP) is required');
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
