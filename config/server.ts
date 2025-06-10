// config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  log: {
    level: 'debug',
  },
  cron: {
    enabled: true, // Added to enable cron jobs
  },
});