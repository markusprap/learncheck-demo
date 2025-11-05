---
sidebar_position: 2
---

# Backend API dengan Express

Di tutorial ini, kita akan membangun REST API menggunakan Express.js untuk serve data kuis dan preferences user.

## Kenapa Express?

- **Minimalis**: Code simpel, tidak bloated
- **Flexible**: Bisa custom sesuai kebutuhan
- **Mature**: Library terpercaya, banyak dipakai production
- **Middleware Ecosystem**: CORS, body-parser, dll tinggal plug-and-play

## Setup Express App

Buat file `backend/src/app.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './utils/errorHandler';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handler (must be last!)
app.use(errorHandler);

export default app;
```

### Penjelasan:

**CORS**: Izinkan frontend (port 5173) akses backend (port 4000)
```typescript
app.use(cors());
```

**Body Parser**: Parse JSON request body
```typescript
app.use(express.json());
```

**Routes**: Semua API route di `/api/v1/*`
```typescript
app.use('/api/v1', routes);
```

**Error Handler**: Catch semua error, return JSON response

## Entry Point

Buat `backend/src/index.ts`:

```typescript
import dotenv from 'dotenv';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;

// Only listen in development (Vercel handles this in production)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📖 Health check: http://localhost:${PORT}/health`);
  });
}

// Export for Vercel serverless
export default app;
```

## Constants & Types

Buat `backend/src/config/constants.ts`:

```typescript
export const API_CONFIG = {
  DICODING_BASE_URL: 'https://learncheck-dicoding-mock-666748076441.europe-west1.run.app/api',
  GEMINI_MODEL: 'gemini-2.0-flash-exp',
  REQUEST_TIMEOUT_MS: 30000,
};

export const REDIS_CONFIG = {
  QUIZ_TTL_SECONDS: 24 * 60 * 60, // 24 hours
  RATELIMIT_WINDOW_SECONDS: 60,
  RATELIMIT_MAX_REQUESTS: 5,
  CONNECTION_TIMEOUT_MS: 5000,
  MAX_RETRIES: 3,
};

export const CACHE_KEYS = {
  quiz: (tutorialId: string) => `quiz:tutorial:${tutorialId}`,
  rateLimit: (userId: string) => `ratelimit:user:${userId}`,
};

export const ERROR_MESSAGES = {
  MISSING_PARAMS: 'Missing required parameters',
  TUTORIAL_NOT_FOUND: 'Tutorial not found',
  USER_NOT_FOUND: 'User not found',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  EMPTY_CONTENT: 'Tutorial content is empty',
  EMPTY_GEMINI_RESPONSE: 'Gemini returned empty response',
  GENERATION_FAILED: 'Failed to generate assessment questions',
};

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};
```

Buat `backend/src/types/index.ts`:

```typescript
export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  fontStyle: 'sans' | 'serif' | 'mono';
  layoutWidth: 'standard' | 'fullWidth';
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface Assessment {
  questions: QuizQuestion[];
}

export interface AssessmentResponse {
  assessment: Assessment;
  fromCache: boolean;
}

export interface PreferencesResponse {
  userPreferences: UserPreferences;
}

export interface ErrorResponse {
  message: string;
  status: number;
}
```

## Routing Structure

Buat `backend/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import assessmentRoutes from './assessment.routes';

const router = Router();

// Mount routes
router.use('/', assessmentRoutes);

export default router;
```

Buat `backend/src/routes/assessment.routes.ts`:

```typescript
import { Router } from 'express';
import { getAssessment, getPreferences } from '../controllers/assessment.controller';

const router = Router();

// GET /api/v1/preferences?user_id=123
router.get('/preferences', getPreferences);

// GET /api/v1/assessment?tutorial_id=123&user_id=456
router.get('/assessment', getAssessment);

export default router;
```

## Controllers

Buat `backend/src/controllers/assessment.controller.ts`:

```typescript
import { Request, Response } from 'express';
import { fetchAssessmentData, fetchUserPreferences } from '../services/assessment.service';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';

export const getPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: ERROR_MESSAGES.MISSING_PARAMS,
      });
    }

    const preferences = await fetchUserPreferences(userId);
    
    res.json({ userPreferences: preferences });
  } catch (error: any) {
    console.error('Preferences error:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      message: error.message || 'Failed to fetch preferences',
    });
  }
};

export const getAssessment = async (req: Request, res: Response) => {
  try {
    const tutorialId = req.query.tutorial_id as string;
    const userId = req.query.user_id as string;
    const fresh = req.query.fresh as string;

    if (!tutorialId || !userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: ERROR_MESSAGES.MISSING_PARAMS,
      });
    }

    const skipCache = fresh === 'true';
    const result = await fetchAssessmentData(tutorialId, userId, skipCache);
    
    res.json(result);
  } catch (error: any) {
    console.error('Assessment error:', error);
    
    if (error.message.includes('Rate limit')) {
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        message: error.message,
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      message: error.message || ERROR_MESSAGES.GENERATION_FAILED,
    });
  }
};
```

## Services Layer

Ini layer paling penting! Handle business logic.

Buat `backend/src/services/assessment.service.ts`:

```typescript
import { fetchUserPreferences as fetchDicodingPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { getCachedQuizData, cacheQuizData, isRateLimited } from './redis.service';
import { parseHTML } from '../utils/htmlParser';
import axios from 'axios';
import { API_CONFIG, ERROR_MESSAGES } from '../config/constants';
import type { Assessment, AssessmentResponse, UserPreferences } from '../types';

/**
 * Fetch user preferences from Dicoding API
 */
export const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  return await fetchDicodingPreferences(userId);
};

/**
 * Fetch tutorial content from Dicoding API
 */
const fetchTutorialContent = async (tutorialId: string): Promise<{ content: string }> => {
  const url = `${API_CONFIG.DICODING_BASE_URL}/tutorials/${tutorialId}`;
  
  const response = await axios.get(url, {
    timeout: API_CONFIG.REQUEST_TIMEOUT_MS,
  });

  if (!response.data?.tutorial?.content) {
    throw new Error(ERROR_MESSAGES.TUTORIAL_NOT_FOUND);
  }

  return {
    content: response.data.tutorial.content,
  };
};

/**
 * Generate or retrieve cached assessment data
 */
export const fetchAssessmentData = async (
  tutorialId: string,
  userId: string,
  skipCache: boolean = false
): Promise<AssessmentResponse> => {
  // Check rate limit
  const rateLimited = await isRateLimited(userId);
  if (rateLimited) {
    throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
  }

  // Try cache first (unless skipCache=true for retry)
  if (!skipCache) {
    const cachedQuiz = await getCachedQuizData(tutorialId);
    if (cachedQuiz) {
      console.log('[Assessment] Returning cached quiz');
      return {
        assessment: cachedQuiz,
        fromCache: true,
      };
    }
  } else {
    console.log('[Assessment] Skipping cache (fresh=true)');
  }

  // Cache miss or skip cache, generate new quiz
  console.log('[Assessment] Generating new quiz...');
  
  // Fetch tutorial content
  const tutorialData = await fetchTutorialContent(tutorialId);
  
  // Parse HTML to clean text
  const textContent = parseHTML(tutorialData.content);
  
  if (!textContent || textContent.trim().length === 0) {
    throw new Error(ERROR_MESSAGES.EMPTY_CONTENT);
  }

  // Generate questions with Gemini
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

## Dicoding Service

Buat `backend/src/services/dicoding.service.ts`:

```typescript
import axios from 'axios';
import { API_CONFIG, ERROR_MESSAGES } from '../config/constants';
import type { UserPreferences } from '../types';

/**
 * Fetch user preferences from Dicoding Mock API
 */
export const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const url = `${API_CONFIG.DICODING_BASE_URL}/users/${userId}/preferences`;
  
  try {
    const response = await axios.get(url, {
      timeout: API_CONFIG.REQUEST_TIMEOUT_MS,
    });

    if (!response.data?.preferences) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return response.data.preferences;
  } catch (error: any) {
    console.error('[Dicoding API] Error:', error.message);
    throw new Error(`Failed to fetch user preferences: ${error.message}`);
  }
};
```

## HTML Parser Utility

Buat `backend/src/utils/htmlParser.ts`:

```typescript
import * as cheerio from 'cheerio';

/**
 * Parse HTML content and extract clean text
 * Removes HTML tags, scripts, styles, and extra whitespace
 */
export const parseHTML = (htmlContent: string): string => {
  const $ = cheerio.load(htmlContent);

  // Remove script and style tags
  $('script, style, noscript').remove();

  // Get text content
  let text = $('body').text();

  // If no body tag, get all text
  if (!text) {
    text = $.text();
  }

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')  // Multiple spaces → single space
    .replace(/\n+/g, '\n') // Multiple newlines → single newline
    .trim();

  return text;
};
```

## Error Handler

Buat `backend/src/utils/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../config/constants';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error Handler]:', err);

  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

## Test Backend

Jalankan server:

```bash
cd backend
npm run dev
```

Test endpoints dengan curl:

```bash
# Health check
curl http://localhost:4000/health

# Get preferences
curl "http://localhost:4000/api/v1/preferences?user_id=1"

# Get assessment (first time, will be slow ~16s)
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"

# Get assessment (second time, should be fast ~1s from cache)
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"
```

## API Documentation

### GET /api/v1/preferences

**Query Parameters:**
- `user_id` (required): User ID

**Response:**
```json
{
  "userPreferences": {
    "theme": "dark",
    "fontSize": "medium",
    "fontStyle": "sans",
    "layoutWidth": "standard"
  }
}
```

### GET /api/v1/assessment

**Query Parameters:**
- `tutorial_id` (required): Tutorial ID
- `user_id` (required): User ID
- `fresh` (optional): "true" to skip cache

**Response:**
```json
{
  "assessment": {
    "questions": [
      {
        "id": "q1",
        "text": "Apa itu React?",
        "options": [
          { "id": "a", "text": "Library JavaScript" },
          { "id": "b", "text": "Framework PHP" }
        ],
        "correctOptionId": "a",
        "explanation": "React adalah library JavaScript..."
      }
    ]
  },
  "fromCache": true
}
```

## Struktur Lengkap

```
backend/src/
├── config/
│   └── constants.ts          # Semua konstanta
├── types/
│   └── index.ts              # TypeScript interfaces
├── controllers/
│   └── assessment.controller.ts  # Request handlers
├── routes/
│   ├── index.ts              # Main router
│   └── assessment.routes.ts  # Assessment routes
├── services/
│   ├── assessment.service.ts # Business logic
│   ├── dicoding.service.ts   # Dicoding API client
│   ├── gemini.service.ts     # Gemini AI client
│   └── redis.service.ts      # Redis cache client
├── utils/
│   ├── errorHandler.ts       # Error middleware
│   └── htmlParser.ts         # HTML to text parser
├── app.ts                    # Express app setup
└── index.ts                  # Entry point
```

## Best Practices

### 1. Separation of Concerns

- **Controllers**: Handle HTTP request/response
- **Services**: Business logic
- **Utils**: Helper functions

Jangan campur logic di controller!

### 2. Error Handling

Semua error di-throw, lalu caught di controller:

```typescript
try {
  await someService();
} catch (error) {
  res.status(500).json({ message: error.message });
}
```

### 3. Type Safety

Semua function punya return type:

```typescript
const fetchData = async (): Promise<Data> => {
  // TypeScript knows return type!
}
```

### 4. Environment Variables

Jangan hardcode sensitive data:

```typescript
const apiKey = process.env.GEMINI_API_KEY; // ✅
const apiKey = "AIzaSy..."; // ❌ JANGAN!
```

## Kesimpulan

Backend kita sekarang punya:
- ✅ Clean architecture (MVC pattern)
- ✅ Type-safe dengan TypeScript
- ✅ Error handling yang proper
- ✅ API documentation
- ✅ Ready untuk integrate Gemini & Redis

Di tutorial berikutnya, kita akan integrate Google Gemini AI!

## Next Steps

Lanjut ke [Integrasi Gemini AI](./03-gemini.md) →

