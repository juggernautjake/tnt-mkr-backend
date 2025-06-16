import { Strapi } from '@strapi/strapi';

export default (config: Record<string, any>, { strapi }: { strapi: Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'POST' && ctx.path === '/api/webhook-events') {
      strapi.log.info('Capturing raw body for webhook request');
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        ctx.req.on('data', (chunk: Buffer) => chunks.push(chunk));
        ctx.req.on('end', () => resolve());
        ctx.req.on('error', (err) => reject(err));
      });
      ctx.request.rawBody = Buffer.concat(chunks).toString('utf8');
    }
    await next();
  };
};