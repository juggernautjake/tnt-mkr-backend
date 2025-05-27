export default [
  'strapi::errors',
  {
    name: 'strapi::session',
    config:
      process.env.NODE_ENV === 'production'
        ? {
            provider: 'redis',
            providerOptions: {
              url: process.env.REDIS_URL,
            },
          }
        : {},
  },
  'strapi::query',
  'strapi::body',
  {
    name: 'strapi::logger',
    config: {
      level: 'debug',
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://www.tnt-mkr.com', 'https://tnt-mkr-frontend-cj5f.vercel.app'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true,
    },
  },
  {
    name: 'strapi::security',
  },
  'strapi::poweredBy',
  'strapi::compression',
  'strapi::responses',
  'strapi::favicon',
  'strapi::public',
];