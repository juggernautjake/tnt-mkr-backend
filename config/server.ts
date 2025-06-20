export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  log: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  cron: {
    enabled: true,
  },
  proxy: env.bool('IS_PRODUCTION', true), // Enforce HTTPS in production
});