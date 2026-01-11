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
                  return 1000; // Reconnect after 1 second
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
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Guest-Session', 'Stripe-Signature'],
      credentials: true,
    },
  },
  'strapi::security',
  'strapi::poweredBy',
  {
    name: 'strapi::compression',
  },
  'strapi::responses',
  'strapi::favicon',
  'strapi::public',
  {
    name: 'global::rateLimit',
    config: {
      maxRequests: 500,
      windowSeconds: 60,
    },
  },
];