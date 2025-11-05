/**
 * Application-wide constants
 */

export const API_CONFIG = {
  DICODING_BASE_URL: 'https://learncheck-dicoding-mock-666748076441.europe-west1.run.app/api',
  GEMINI_MODEL: 'gemini-2.5-flash',
  REQUEST_TIMEOUT: 30000, // 30 seconds
} as const;

export const REDIS_CONFIG = {
  QUIZ_CACHE_TTL: 86400, // 24 hours
  RATE_LIMIT_WINDOW: 60, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 5,
  CONNECT_TIMEOUT: 5000,
  MAX_RETRIES: 3,
} as const;

export const CACHE_KEYS = {
  QUIZ: (tutorialId: string) => `learncheck:quiz:tutorial:${tutorialId}`,
  RATE_LIMIT: (userId: string) => `learncheck:ratelimit:${userId}`,
} as const;

export const ERROR_MESSAGES = {
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please wait a moment before generating another quiz.',
  INVALID_TUTORIAL_ID: 'Missing or invalid tutorial_id',
  INVALID_USER_ID: 'Missing or invalid user_id',
  GEMINI_GENERATION_FAILED: 'Failed to generate assessment questions.',
  REDIS_CONNECTION_FAILED: 'Redis connection failed',
  EMPTY_GEMINI_RESPONSE: 'Empty response from Gemini API',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;
