// backend/src/middlewares/rateLimit.js

'use strict';

const { RateLimit, Stores } = require('koa2-ratelimit');
const Redis = require('ioredis');

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.log(`RateLimit Middleware - Connecting to Redis at ${redisHost}:${redisPort}`);

const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
});

redisClient.on('connect', () => {
  console.log(`RateLimit Middleware - Successfully connected to Redis at ${redisHost}:${redisPort}`);
});

redisClient.on('error', (err) => {
  console.error(`RateLimit Middleware - Redis connection error: ${err}`);
});

module.exports = () => {
  return RateLimit.middleware({
    store: new Stores.Redis({
      client: redisClient,
    }),
    interval: { sec: 10 }, // 10 seconds
    max: 100, // limit each IP to 100 requests per interval
    message: 'Too many requests, please try again later.',
    headers: {
      remaining: 'Rate-Limit-Remaining',
      reset: 'Rate-Limit-Reset',
      total: 'Rate-Limit-Total',
    },
  });
};
