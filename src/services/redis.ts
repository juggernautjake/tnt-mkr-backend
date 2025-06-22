// src/services/redis.ts
import { createClient, RedisClientType } from 'redis';

export default (): RedisClientType => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      tls: true, // Enable TLS for secure connection
      rejectUnauthorized: false, // Allow self-signed certificates
      keepAlive: 5000, // Increased to 5 seconds for stability
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          console.error('Too many reconnection attempts. Giving up.');
          return new Error('Too many reconnection attempts');
        }
        return Math.min(retries * 100, 3000); // Exponential backoff, max 3 seconds
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