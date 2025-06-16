import { Strapi } from '@strapi/strapi';

export default (config: Record<string, any>, { strapi }: { strapi: Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'POST' && ctx.path === '/api/webhook-events') {
      strapi.log.info('Capturing raw body for webhook request');

      // Ensure the body isn't parsed by subsequent middlewares
      ctx.request.body = undefined;

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        ctx.req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        ctx.req.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          ctx.request.rawBody = rawBody;
          strapi.log.debug('Raw body captured successfully');
          resolve();
        });
        ctx.req.on('error', (err) => {
          strapi.log.error('Error capturing raw body:', err);
          reject(err);
        });
      });

      // Prevent strapi::body from consuming the stream
      ctx._readableState = ctx._readableState || {};
      ctx._readableState.ended = true; // Mark stream as ended to skip body parsing
    }
    await next();
  };
};