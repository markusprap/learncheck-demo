---
sidebar_position: 7
---

# Redis Caching untuk Performa 12x Lipat

Generate pertanyaan dengan Gemini AI itu LAMA (15-20 detik). Kita pakai Redis untuk cache hasil generation. Hasilnya: **16 detik → 1.3 detik** (12x lebih cepat!)

## Kenapa Perlu Cache?

### Tanpa Cache:
```
User 1 buka tutorial 123: 16 detik (generate)
User 2 buka tutorial 123: 16 detik (generate lagi) ❌
User 3 buka tutorial 123: 16 detik (generate lagi) ❌
```

### Dengan Cache:
```
User 1 buka tutorial 123: 16 detik (generate, save to cache)
User 2 buka tutorial 123: 1.3 detik (ambil dari cache) ✅
User 3 buka tutorial 123: 1.3 detik (ambil dari cache) ✅
```

User pertama "sacrifice" 16 detik, tapi user berikutnya cuma 1.3 detik!

## Setup Upstash Redis

### 1. Buat Account

1. Buka [Upstash Console](https://console.upstash.com/)
2. Sign up (gratis!)
3. Klik "Create Database"
4. Pilih region terdekat (Singapore untuk Indonesia)
5. Pilih "Free Plan" (10,000 commands/hari cukup untuk testing)

### 2. Get Connection URL

Di dashboard, copy **REST URL**:
```
rediss://default:TOKEN@hostname.upstash.io:6379
```

### 3. Add to .env

```env
# backend/.env
REDIS_URL=rediss://default:TOKEN@hostname.upstash.io:6379
```

## Install IORedis

```bash
cd backend
npm install ioredis
```

IORedis adalah client Redis terbaik untuk Node.js:
- Support TypeScript
- Auto-reconnect
- Pipeline support
- Cluster support

## Redis Service

Buat `backend/src/services/redis.service.ts`:

```typescript
import Redis from 'ioredis';

let redis: Redis | null = null;

// Initialize Redis client
const getRedisClient = (): Redis | null => {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not configured, caching disabled');
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: false, // Connect immediately for serverless
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(times * 1000, 5000);
          return delay;
        },
        reconnectOnError: (err) => {
          console.error('[Redis] Connection error:', err.message);
          return true; // Always try to reconnect
        },
      });

      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
      });

      redis.on('error', (err) => {
        console.error('[Redis] Error:', err);
      });

    } catch (error) {
      console.error('[Redis] Failed to initialize:', error);
      redis = null;
    }
  }

  return redis;
};

// Cache quiz data (24 hours TTL)
export const cacheQuizData = async (
  tutorialId: string,
  data: any
): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const key = `quiz:tutorial:${tutorialId}`;
  const TTL = 24 * 60 * 60; // 24 hours in seconds

  try {
    await client.setex(key, TTL, JSON.stringify(data));
    console.log(`[Redis] Cached quiz for tutorial ${tutorialId}`);
  } catch (error) {
    console.error('[Redis] Cache set error:', error);
    // Graceful degradation: app still works without cache
  }
};

// Get cached quiz data
export const getCachedQuizData = async (
  tutorialId: string
): Promise<any | null> => {
  const client = getRedisClient();
  if (!client) return null;

  const key = `quiz:tutorial:${tutorialId}`;

  try {
    const cached = await client.get(key);
    if (cached) {
      console.log(`[Redis] Cache hit for tutorial ${tutorialId}`);
      return JSON.parse(cached);
    }
    console.log(`[Redis] Cache miss for tutorial ${tutorialId}`);
    return null;
  } catch (error) {
    console.error('[Redis] Cache get error:', error);
    return null;
  }
};

// Rate limiting (5 requests per minute per user)
export const isRateLimited = async (userId: string): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false; // No rate limit if Redis unavailable

  const key = `ratelimit:user:${userId}`;
  const limit = 5;
  const window = 60; // seconds

  try {
    const current = await client.incr(key);
    
    if (current === 1) {
      // First request, set expiry
      await client.expire(key, window);
    }

    if (current > limit) {
      console.warn(`[Redis] Rate limit exceeded for user ${userId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Redis] Rate limit error:', error);
    return false; // Fail open
  }
};

// Invalidate cache (for manual refresh)
export const invalidateQuizCache = async (tutorialId: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  const key = `quiz:tutorial:${tutorialId}`;

  try {
    await client.del(key);
    console.log(`[Redis] Invalidated cache for tutorial ${tutorialId}`);
  } catch (error) {
    console.error('[Redis] Cache invalidation error:', error);
  }
};
```

## Penjelasan Detail

### 1. Lazy Initialization

```typescript
if (!redis) {
  redis = new Redis(...);
}
return redis;
```

Singleton pattern. Cuma buat 1 connection, reuse untuk semua requests. **Hemat memory**.

### 2. Connection Options

```typescript
lazyConnect: false // For serverless (Vercel)
```

Vercel functions itu **cold start**. Kalau `lazyConnect: true`, butuh 2 round-trips (connect + command). Kalau `false`, connect langsung pas init. **Faster!**

```typescript
maxRetriesPerRequest: 3
```

Kalau command gagal, retry max 3x sebelum throw error.

```typescript
retryStrategy: (times) => Math.min(times * 1000, 5000)
```

Exponential backoff:
- Attempt 1: wait 1 second
- Attempt 2: wait 2 seconds
- Attempt 3: wait 3 seconds
- Attempt 4+: wait 5 seconds (max)

Ini pattern standard untuk retry logic.

### 3. Cache Key Pattern

```typescript
`quiz:tutorial:${tutorialId}`
```

Example keys:
```
quiz:tutorial:35363
quiz:tutorial:35364
quiz:tutorial:35365
```

Organized! Kalau butuh invalidate semua quiz cache:
```typescript
const keys = await redis.keys('quiz:tutorial:*');
await redis.del(...keys);
```

### 4. TTL (Time To Live)

```typescript
const TTL = 24 * 60 * 60; // 24 hours
await client.setex(key, TTL, data);
```

Cache expire otomatis setelah 24 jam. Kenapa 24 jam?
- Konten tutorial jarang update
- Balance antara freshness & cache hit rate
- Hemat storage

Kalau tutorial update, kita bisa manual invalidate:
```typescript
invalidateQuizCache('35363');
```

### 5. Graceful Degradation

```typescript
if (!client) return null; // App still works!
```

Redis down? No problem! App tetap jalan, cuma jadi lebih lambat (no cache). Better than crashing!

### 6. Rate Limiting

```typescript
const current = await client.incr(key);
if (current > 5) return true; // Rate limited!
```

`INCR` command atomic. Thread-safe counter. Perfect untuk rate limiting!

```
User request 1: counter = 1 ✅
User request 2: counter = 2 ✅
User request 3: counter = 3 ✅
User request 4: counter = 4 ✅
User request 5: counter = 5 ✅
User request 6: counter = 6 ❌ Rate limited!
```

Counter reset otomatis setelah 60 detik.

## Integrasikan ke Assessment Service

Update `backend/src/services/assessment.service.ts`:

```typescript
import { getCachedQuizData, cacheQuizData, isRateLimited } from './redis.service';

export const fetchAssessmentData = async (
  tutorialId: string,
  userId: string,
  skipCache: boolean = false
) => {
  // Check rate limit
  const rateLimited = await isRateLimited(userId);
  if (rateLimited) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  // Try cache first (unless skipCache=true for retry)
  if (!skipCache) {
    const cachedQuiz = await getCachedQuizData(tutorialId);
    if (cachedQuiz) {
      return {
        assessment: cachedQuiz,
        fromCache: true,
      };
    }
  }

  // Cache miss or skip cache, generate new quiz
  console.log('[Assessment] Generating new quiz...');
  
  const [tutorialData, userPrefs] = await Promise.all([
    fetchTutorialContent(tutorialId),
    fetchUserPreferences(userId),
  ]);

  const textContent = parseHTML(tutorialData.content);
  const assessment = await generateAssessmentQuestions(textContent);

  // Save to cache (unless skipCache=true)
  if (!skipCache) {
    await cacheQuizData(tutorialId, assessment);
  }

  return {
    assessment,
    fromCache: false,
  };
};
```

## Performance Comparison

### Before Redis (No Cache):

```
Request 1: 16.2s (Gemini API)
Request 2: 15.8s (Gemini API)
Request 3: 16.5s (Gemini API)
Average: 16.2s
```

### After Redis (With Cache):

```
Request 1: 16.2s (Gemini API, save to cache)
Request 2: 1.3s (Redis cache hit) ✅
Request 3: 1.2s (Redis cache hit) ✅
Request 4: 1.4s (Redis cache hit) ✅
Average: 1.3s (after first request)
```

**12x faster!** 🚀

## Cost Analysis

### Gemini API (Free Tier):
- 15 requests/minute
- 1500 requests/day
- Cost: **$0**

### With Cache (95% hit rate):
- Actual Gemini calls: 75 requests/day (5%)
- Cache hits: 1425 requests/day (95%)
- Cost: **$0** (still within free tier)

Cache bukan cuma faster, tapi juga **hemat cost**!

## Monitoring

Add logging untuk track cache performance:

```typescript
// Track cache hit rate
let cacheHits = 0;
let cacheMisses = 0;

export const getCacheStats = () => ({
  hits: cacheHits,
  misses: cacheMisses,
  hitRate: cacheHits / (cacheHits + cacheMisses),
});
```

Access via endpoint:

```typescript
app.get('/api/v1/cache-stats', (req, res) => {
  res.json(getCacheStats());
});
```

## Testing

```bash
# Test cache
curl "http://localhost:4000/api/v1/assessment?tutorial_id=123&user_id=1"
# First call: ~16 seconds

curl "http://localhost:4000/api/v1/assessment?tutorial_id=123&user_id=1"
# Second call: ~1 second ✅

# Test rate limit
for i in {1..7}; do
  curl "http://localhost:4000/api/v1/assessment?tutorial_id=123&user_id=1"
done
# 6th request: Rate limited! ❌
```

## Troubleshooting

### Redis Connection Failed

Check:
1. REDIS_URL correct?
2. Redis server running? (check Upstash dashboard)
3. Firewall blocking? (Vercel should have access)

### Cache Not Working

Check logs:
```
[Redis] Connected successfully ✅
[Redis] Cache miss for tutorial 123
[Redis] Cached quiz for tutorial 123
[Redis] Cache hit for tutorial 123 ✅
```

No logs? Redis probably not connected.

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  await redis.get(key);
} catch (error) {
  console.error('Redis error:', error);
  return null; // Graceful fallback
}
```

### 2. Set Reasonable TTL

```typescript
const TTL = 24 * 60 * 60; // 24 hours OK
const TTL = 365 * 24 * 60 * 60; // 1 year TOO LONG!
```

### 3. Use Key Namespaces

```typescript
`quiz:tutorial:${id}`     // Good
`ratelimit:user:${id}`    // Good
`${id}`                   // Bad (no namespace)
```

### 4. Monitor Memory Usage

Upstash free tier: **256 MB**

Check usage di dashboard. Kalau full, cache otomatis evict (LRU policy).

## Kesimpulan

Redis caching:
- ✅ 12x performance boost (16s → 1.3s)
- ✅ Hemat Gemini API quota
- ✅ Rate limiting built-in
- ✅ Graceful degradation
- ✅ Production-ready!

## Next Steps

Lanjut ke [Deploy ke Vercel](./08-deployment.md) →
