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
  GEMINI_MODEL: 'gemini-2.5-flash',
  REQUEST_TIMEOUT: 30000, // 30 seconds
} as const;

export const ERROR_MESSAGES = {
  INVALID_TUTORIAL_ID: 'Missing or invalid tutorial_id',
  INVALID_USER_ID: 'Missing or invalid user_id',
  GEMINI_GENERATION_FAILED: 'Failed to generate assessment questions.',
  EMPTY_GEMINI_RESPONSE: 'Empty response from Gemini API',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;
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
import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';
import type { AssessmentResponse, UserPreferences } from '../types';

/**
 * Fetch or generate assessment data for a tutorial
 */
export const fetchAssessmentData = async (
  tutorialId: string,
  userId: string,
  skipCache: boolean = false
): Promise<AssessmentResponse> => {
  console.log(`[Assessment] Generating quiz for tutorial ${tutorialId}`);

  // Fetch tutorial content and user preferences in parallel
  const [tutorialHtml, userPreferences] = await Promise.all([
    getTutorialContent(tutorialId),
    getUserPreferences(userId),
  ]);

  // Parse HTML to clean text
  const textContent = parseHtmlContent(tutorialHtml);
  
  // Generate quiz with Gemini AI
  console.log(`[Gemini] Generating fresh quiz for tutorial ${tutorialId}`);
  const assessment = await generateAssessmentQuestions(textContent);

  return {
    assessment,
    userPreferences,
    fromCache: false,
  };
};

/**
 * Fetch fresh user preferences (not cached for real-time updates)
 */
export const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  console.log(`[Preferences] Fetching fresh preferences for user ${userId}`);
  return await getUserPreferences(userId);
};
```

Buat `backend/src/services/dicoding.service.ts`:

```typescript
import axios from 'axios';

const DICODING_API_BASE_URL = 'https://learncheck-dicoding-mock-666748076441.europe-west1.run.app/api';

const dicodingApi = axios.create({
  baseURL: DICODING_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getTutorialContent = async (tutorialId: string): Promise<string> => {
  try {
    console.log('[Dicoding API] Fetching tutorial content for ID:', tutorialId);
    
    const response = await dicodingApi.get('/tutorials/' + tutorialId);
    const htmlContent = response.data?.data?.content;
    
    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('Invalid response format from Dicoding API: missing content field');
    }
    
    console.log('[Dicoding API] Successfully fetched tutorial content');
    return htmlContent;
    
  } catch (error: any) {
    console.error('[Dicoding API] Error fetching tutorial content:', error.message);
    if (error.response) {
      console.error('[Dicoding API] Response status:', error.response.status);
    }
    throw new Error('Failed to fetch tutorial content: ' + error.message);
  }
};

export const getUserPreferences = async (userId: string): Promise<any> => {
  try {
    console.log('[Dicoding API] Fetching user preferences for ID:', userId);
    
    const response = await dicodingApi.get('/users/' + userId + '/preferences');
    const preferences = response.data?.data?.preference;
    
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Invalid response format from Dicoding API: missing preference field');
    }
    
    console.log('[Dicoding API] Successfully fetched user preferences');
    return preferences;
    
  } catch (error: any) {
    console.error('[Dicoding API] Error fetching user preferences:', error.message);
    if (error.response) {
      console.error('[Dicoding API] Response status:', error.response.status);
    }
    throw new Error('Failed to fetch user preferences: ' + error.message);
  }
};
```

## Controllers Layer

Buat `backend/src/controllers/assessment.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import { fetchAssessmentData, fetchUserPreferences } from '../services/assessment.service';
import { ERROR_MESSAGES, HTTP_STATUS } from '../config/constants';

/**
 * GET /api/v1/assessment
 * Generate or retrieve quiz for a tutorial
 */
export const getAssessment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tutorial_id, user_id, fresh } = req.query;

    if (!tutorial_id || !user_id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_TUTORIAL_ID,
      });
      return;
    }

    const skipCache = fresh === 'true';
    const data = await fetchAssessmentData(
      tutorial_id as string,
      user_id as string,
      skipCache
    );

    res.status(HTTP_STATUS.OK).json(data);
  } catch (error: any) {
    console.error('[Controller] Error in getAssessment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error.message || 'Failed to generate assessment',
    });
  }
};

/**
 * GET /api/v1/preferences
 * Fetch user preferences from Dicoding
 */
export const getPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_USER_ID,
      });
      return;
    }

    const userPreferences = await fetchUserPreferences(user_id as string);

    res.status(HTTP_STATUS.OK).json({ userPreferences });
  } catch (error: any) {
    console.error('[Controller] Error in getPreferences:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error.message || 'Failed to fetch preferences',
    });
  }
};
```

## Routes Layer

Buat `backend/src/routes/assessment.routes.ts`:

```typescript
import { Router } from 'express';
import { getAssessment, getPreferences } from '../controllers/assessment.controller';

const router = Router();

router.get('/assessment', getAssessment);
router.get('/preferences', getPreferences);

export default router;
```

Buat `backend/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import assessmentRoutes from './assessment.routes';

const router = Router();

router.use('/', assessmentRoutes);

export default router;
```

## Utils Layer

Buat `backend/src/utils/htmlParser.ts`:

```typescript
import * as cheerio from 'cheerio';

/**
 * Parse HTML content to clean text
 */
export const parseHtmlContent = (html: string): string => {
  const $ = cheerio.load(html);
  
  // Remove script and style tags
  $('script, style').remove();
  
  // Get text content
  const text = $('body').text();
  
  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
};
```

Buat `backend/src/utils/errorHandler.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Error]', err.message);
  console.error('[Stack]', err.stack);

  res.status(500).json({
    error: err.message || 'Internal server error',
  });
};
```

## Test API

Test dengan curl:

```bash
# Test assessment
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"

# Test preferences
curl "http://localhost:4000/api/v1/preferences?user_id=1"
```

Response assessment:

```json
{
  "assessment": {
    "questions": [
      {
        "id": "q1",
        "questionText": "Apa itu React?",
        "options": [...
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
│   └── gemini.service.ts     # Gemini AI client
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
- ✅ Simple & reliable (no external dependencies)

Di tutorial berikutnya, kita akan integrate Google Gemini AI!

## Next Steps

Lanjut ke [Integrasi Gemini AI](./03-gemini.md) →

