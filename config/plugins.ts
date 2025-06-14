export default ({ env }) => ({
  "rest-cache": {
    enabled: true,
    provider: {
      name: "redis",
      options: {
        url: env("REDIS_URL"),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Too many reconnection attempts');
            }
            return 1000; // Reconnect after 1 second
          },
        },
      },
    },
    strategy: {
      keysPrefix: "strapi_",
      ttl: 300, // Cache for 5 minutes
      contentTypes: ["api::product.product"],
    },
  },
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_CLOUD_NAME'),
        api_key: env('CLOUDINARY_API_KEY'),
        api_secret: env('CLOUDINARY_API_SECRET'),
      },
      actionOptions: {
        upload: {},
        delete: {},
      },
    },
  },
  email: {
    config: {
      provider: 'mailgun',
      providerOptions: {
        key: env('MAILGUN_API_KEY'),
        domain: env('MAILGUN_DOMAIN'),
        url: env('MAILGUN_URL', 'https://api.mailgun.net'),
      },
      settings: {
        defaultFrom: env('DEFAULT_FROM_EMAIL'),
        defaultReplyTo: env('DEFAULT_REPLY_TO_EMAIL'),
      },
    },
  },
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
      jwt: { expiresIn: '7d' },
      email: {
        confirmation: {
          enabled: true,
          from: env('DEFAULT_FROM_EMAIL'),
          replyTo: env('DEFAULT_REPLY_TO_EMAIL'),
          action: 'Confirm your account',
          url: env('FRONTEND_URL') + '/confirmation/confirm-email',
        },
      },
    },
  },
});