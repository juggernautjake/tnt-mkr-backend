export default [
  'strapi::errors',
  'global::rawBody', // New middleware to capture raw body
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
            // Bypass session for webhook endpoint
            exclude: ['/api/webhook-events'],
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
      origin: ['https://www.tnt-mkr.com'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'X-Guest-Session', 'Stripe-Signature'], 
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