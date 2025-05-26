// src/services/redis.ts
import { createClient, RedisClientType } from 'redis';

export default (): RedisClientType => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Too many reconnection attempts. Giving up.');
          return new Error('Too many reconnection attempts');
        }
        return 1000; // Reconnect after 1 second
      },
    },
  }) as RedisClientType;

  client.on('connect', () => {
    console.log('Redis connected successfully');
  });

  client.on('error', (err: Error) => {
    console.error('Redis Client Error:', err);
  });

  (async () => {
    try {
      await client.connect();
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
    }
  })();

  return client;
};