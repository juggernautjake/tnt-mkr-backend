export default [
  'strapi::errors',
  'global::rawBody', // Must come before strapi::body to capture raw body first
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
            exclude: ['/api/webhook-events'], // Bypass session for webhook
          }
        : {},
  },
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      // Explicitly exclude webhook endpoint from body parsing
      include: [], // Only parse body for specified routes (optional)
      exclude: ['/api/webhook-events'], // Ensure no parsing for webhooks
    },
  },
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