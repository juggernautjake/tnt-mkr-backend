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
              socket: {
                reconnectStrategy: (retries) => {
                  if (retries > 10) {
                    return new Error('Too many reconnection attempts');
                  }
                  return 1000; // Reconnect after 1 second
                },
              },
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
      headers: ['Content-Type', 'Authorization', 'X-Guest-Session'], // Add custom header
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