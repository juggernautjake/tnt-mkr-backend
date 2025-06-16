export default [
  'strapi::errors',
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true,
    },
  },
  {
    name: 'strapi::session',
    config:
      process.env.NODE_ENV === 'production'
        ? {
            provider: 'redis',
            providerOptions: {
              url: process.env.REDIS_URL,
              socket: {
                reconnectStrategy: (retries) => {
                  if (retries > 10) {
                    return new Error('Too many reconnection attempts');
                  }
                  return 1000;
                },
              },
            },
            exclude: ['/api/webhook-events'],
          }
        : {},
  },
  'strapi::query',
  {
    name: 'strapi::logger',
    config: {
      level: 'debug',
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://www.tnt-mkr.com'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Guest-Session', 'Stripe-Signature'],
      credentials: true,
    },
  },
  'strapi::security',
  'strapi::poweredBy',
  'strapi::compression',
  'strapi::responses',
  'strapi::favicon',
  'strapi::public',
];