import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function connectRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is required');
  }
  redisClient = new Redis(url);
  return redisClient;
}

/** Экземпляр, созданный в main через connectRedis() — для сервисов (ytdlp и др.). */
export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis is not connected. Call connectRedis() during application startup.');
  }
  return redisClient;
}
