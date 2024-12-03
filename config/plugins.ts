// backend/config/plugins.ts

export default ({ env }) => ({
  email: {
    config: {
      provider: 'mailgun',
      providerOptions: {
        key: env('MAILGUN_API_KEY'),
        domain: env('MAILGUN_DOMAIN'),
        url:
          env('MAILGUN_REGION') === 'EU'
            ? 'https://api.eu.mailgun.net'
            : 'https://api.mailgun.net',
      },
      settings: {
        defaultFrom: env('DEFAULT_EMAIL_FROM'),
        defaultReplyTo: env('DEFAULT_EMAIL_REPLY_TO'),
      },
    },
  },
  graphql: {
    config: {
      endpoint: '/graphql',
      playgroundAlways: true,
      shadowCRUD: true,
      depthLimit: 10,
      amountLimit: 100,
    },
  },
  redis: {
    config: {
      connections: {
        default: {
          connection: {
            host: env('REDIS_HOST', 'redis'),
            port: env.int('REDIS_PORT', 6379),
            password: env('REDIS_PASSWORD', undefined), // Uncomment if Redis is secured
          },
          settings: {
            debug: true,
          },
        },
      },
    },
  },
  'rest-cache': {
    config: {
      enabled: true,
      provider: {
        name: 'redis',
        options: {
          max: 32767,
          connection: 'default',
        },
      },
      strategy: {
        enableEtagSupport: true,
        logs: true,
        clearRelatedCache: true,
        maxAge: 60000, // 1 minute in milliseconds
        contentTypes: [
          'api::user.user', // Replace with your actual content types
          // Add other content types you wish to cache
        ],
      },
    },
  },
});
