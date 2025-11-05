import Redis from 'ioredis';
import { REDIS_CONFIG, CACHE_KEYS, ERROR_MESSAGES } from '../config/constants';
import type { Assessment } from '../types';

let redis: Redis | null = null;

/**
 * Get Redis client instance
 * Returns null if Redis is not configured (graceful degradation)
 */
export const getRedisClient = (): Redis | null => {
  // If Redis URL is not configured, return null (app will work without cache)
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not configured, caching disabled');
    return null;
  }

  // Reuse existing connection
  if (redis && redis.status === 'ready') {
    return redis;
  }

  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: REDIS_CONFIG.MAX_RETRIES,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      connectTimeout: REDIS_CONFIG.CONNECT_TIMEOUT,
      lazyConnect: false, // Connect immediately for serverless
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      redis = null;
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    return redis;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    return null;
  }
};

/**
 * Cache Gemini API response for a tutorial
 * @param tutorialId - Tutorial identifier
 * @param quizData - Assessment data to cache
 * @returns True if caching succeeded, false otherwise
 */
export const cacheQuizData = async (
  tutorialId: string,
  quizData: Assessment
): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const key = CACHE_KEYS.QUIZ(tutorialId);
    const value = JSON.stringify({
      ...quizData,
      cachedAt: new Date().toISOString(),
    });
    
    await client.setex(key, REDIS_CONFIG.QUIZ_CACHE_TTL, value);
    console.log(`[Redis] Cached quiz data for tutorial ${tutorialId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Failed to cache quiz data:', error);
    return false;
  }
};

/**
 * Get cached quiz data for a tutorial
 * @param tutorialId - Tutorial identifier
 * @returns Cached assessment or null if not found
 */
export const getCachedQuizData = async (
  tutorialId: string
): Promise<Assessment | null> => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = CACHE_KEYS.QUIZ(tutorialId);
    const cached = await client.get(key);
    
    if (!cached) {
      console.log(`[Redis] Cache miss for tutorial ${tutorialId}`);
      return null;
    }

    console.log(`[Redis] Cache hit for tutorial ${tutorialId}`);
    return JSON.parse(cached) as Assessment;
  } catch (error) {
    console.error('[Redis] Failed to get cached quiz data:', error);
    return null;
  }
};

/**
 * Cache user preferences
 * TTL: 5 minutes (preferences change occasionally)
 */
export const cacheUserPreferences = async (
  userId: string,
  preferences: any
): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const key = `learncheck:prefs:user:${userId}`;
    const value = JSON.stringify({
      ...preferences,
      cachedAt: new Date().toISOString(),
    });
    
    // Cache for 5 minutes
    await client.setex(key, 300, value);
    console.log(`[Redis] Cached preferences for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Failed to cache user preferences:', error);
    return false;
  }
};

/**
 * Get cached user preferences
 * Returns null if not found or Redis unavailable
 */
export const getCachedUserPreferences = async (
  userId: string
): Promise<any | null> => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = `learncheck:prefs:user:${userId}`;
    const cached = await client.get(key);
    
    if (!cached) {
      console.log(`[Redis] Cache miss for user ${userId} preferences`);
      return null;
    }

    console.log(`[Redis] Cache hit for user ${userId} preferences`);
    return JSON.parse(cached);
  } catch (error) {
    console.error('[Redis] Failed to get cached user preferences:', error);
    return null;
  }
};

/**
 * Check if user has exceeded rate limit for quiz generation
 * @param userId - User identifier
 * @returns True if rate limit exceeded, false otherwise
 */
export const isRateLimited = async (userId: string): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false; // No rate limiting if Redis unavailable

  try {
    const key = CACHE_KEYS.RATE_LIMIT(userId);
    const count = await client.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await client.expire(key, REDIS_CONFIG.RATE_LIMIT_WINDOW);
    }
    
    if (count > REDIS_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
      console.warn(
        `[Redis] Rate limit exceeded for user ${userId}: ${count}/${REDIS_CONFIG.RATE_LIMIT_MAX_REQUESTS}`
      );
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Redis] Failed to check rate limit:', error);
    return false; // Fail open (don't block on error)
  }
};

/**
 * Invalidate cache for a specific tutorial
 * Useful for manual cache refresh
 */
export const invalidateTutorialCache = async (
  tutorialId: string
): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const key = `learncheck:quiz:tutorial:${tutorialId}`;
    await client.del(key);
    console.log(`[Redis] Invalidated cache for tutorial ${tutorialId}`);
    return true;
  } catch (error) {
    console.error('[Redis] Failed to invalidate cache:', error);
    return false;
  }
};
