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

## Architecture Pattern: Dua Entry Points

**CRITICAL CONCEPT**: Backend kita punya 2 entry points berbeda:

1. **`server.ts`**: Untuk local development (dengan `app.listen()`)
2. **`index.ts`**: Untuk Vercel serverless (export app, NO listen)

### Kenapa Butuh 2 Entry Points?

```typescript
// ❌ SALAH - Jangan listen di serverless!
// backend/src/index.ts (Vercel)
app.listen(4000); // Error! Vercel sudah handle ini

// ✅ BENAR - Export app aja
export default app;
```

Vercel serverless function **TIDAK** boleh `app.listen()`. Vercel sudah handle port management sendiri.

## Setup Express App

**CRITICAL**: dotenv HARUS di-load PERTAMA kali sebelum import apapun!

Buat file `backend/src/app.ts`:

```typescript
// Load environment variables FIRST (before any imports)
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import mainRouter from './routes';
import { errorHandler } from './utils/errorHandler';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());

// Main Router
app.use('/api/v1', mainRouter);

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('LearnCheck! Backend is healthy.');
});

// Error Handler
app.use(errorHandler);

export default app;
```

### Kenapa dotenv di app.ts?

Karena `gemini.service.ts` butuh `process.env.GEMINI_API_KEY` saat module loading. Jika dotenv di `server.ts`, API key belum loaded saat gemini service di-import!

**Module Loading Order**:
```
server.ts imports app.ts
  → app.ts loads dotenv FIRST ✅
  → app.ts imports routes
    → routes imports controllers
      → controllers imports services
        → gemini.service reads process.env.GEMINI_API_KEY ✅
```

## Entry Point: Local Development

Buat `backend/src/server.ts`:

```typescript
import app from './app';
import dotenv from 'dotenv';

// Load environment variables for local development
dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/v1`);
});
```

**Untuk development**: `npm run dev` → runs `server.ts` → calls `app.listen()`

## Entry Point: Vercel Serverless

Buat `backend/src/index.ts`:

```typescript

import app from './app';

// Tidak perlu dotenv.config() karena Vercel menangani environment variables.
// Tidak perlu app.listen() karena Vercel akan menangani servernya.

export default app;
```

**Untuk production**: Vercel imports `index.ts` → exports Express app → Vercel wraps it as serverless function

## Constants & Configuration

Buat `backend/src/config/constants.ts`:

```typescript
/**
 * Application-wide constants
 */

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

## TypeScript Types

Buat `backend/src/types/index.ts`:

```typescript
/**
 * Shared type definitions for the backend
 */

export interface UserPreferences {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  fontStyle: 'default' | 'serif' | 'mono';
  layoutWidth: 'fullWidth' | 'standard';
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface Assessment {
  questions: QuizQuestion[];
  cachedAt?: string;
}

export interface AssessmentResponse {
  assessment: Assessment;
  userPreferences: UserPreferences;
  fromCache: boolean;
}

export interface PreferencesResponse {
  userPreferences: UserPreferences;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
```

## Routing Structure

Buat `backend/src/routes/index.ts`:

```typescript

import { Router } from 'express';
import assessmentRouter from './assessment.routes';

const router = Router();

// Mount assessment routes (includes /preferences and /assessment)
router.use('/', assessmentRouter);

export default router;
```

Buat `backend/src/routes/assessment.routes.ts`:

```typescript

import { Router } from 'express';
import { getAssessment, getUserPrefs } from '../controllers/assessment.controller';

const router = Router();

// GET /api/v1/preferences?user_id=xxx - Get user preferences only
router.get('/preferences', getUserPrefs);

// GET /api/v1/assessment?tutorial_id=xxx&user_id=xxx - Generate assessment with AI
router.get('/assessment', getAssessment);

export default router;
```

## Controllers Layer

Controller handle HTTP request/response, validasi input, call service layer.

Buat `backend/src/controllers/assessment.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { fetchAssessmentData, fetchUserPreferences } from '../services/assessment.service';
import { ERROR_MESSAGES, HTTP_STATUS } from '../config/constants';

/**
 * Get user preferences endpoint
 * @route GET /api/v1/preferences
 * @query user_id - User identifier
 */
export const getUserPrefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        error: ERROR_MESSAGES.INVALID_USER_ID 
      });
    }

    const userPreferences = await fetchUserPreferences(user_id);
    res.status(HTTP_STATUS.OK).json({ userPreferences });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate or fetch cached assessment endpoint
 * @route GET /api/v1/assessment
 * @query tutorial_id - Tutorial identifier
 * @query user_id - User identifier
 * @query fresh - Optional: 'true' to skip cache and generate new questions (for retries)
 */
export const getAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tutorial_id, user_id, fresh } = req.query;

    if (!tutorial_id || typeof tutorial_id !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        error: ERROR_MESSAGES.INVALID_TUTORIAL_ID 
      });
    }

    if (!user_id || typeof user_id !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        error: ERROR_MESSAGES.INVALID_USER_ID 
      });
    }

    // Parse 'fresh' parameter (for retry attempts to get new questions)
    const skipCache = fresh === 'true';
    
    const data = await fetchAssessmentData(tutorial_id, user_id, skipCache);
    res.status(HTTP_STATUS.OK).json(data);
  } catch (error) {
    next(error);
  }
};
```

## Services Layer: Business Logic

Services contain core business logic, external API calls, data processing.

Buat `backend/src/services/assessment.service.ts`:

```typescript
import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';
import type { AssessmentResponse, UserPreferences } from '../types';

/**
 * Fetch or generate assessment data for a tutorial
 * @param tutorialId - Tutorial identifier
 * @param userId - User identifier
 * @param skipCache - If true, bypass cache and generate fresh quiz (parameter kept for API compatibility)
 * @returns Assessment with user preferences
 * @throws Error if generation fails
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
 * @param userId - User identifier
 * @returns User preferences object
 */
export const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  console.log(`[Preferences] Fetching fresh preferences for user ${userId}`);
  return await getUserPreferences(userId);
};
```

### Kenapa Promise.all()?

```typescript
// ❌ Sequential (slow ~3s)
const tutorialHtml = await getTutorialContent(tutorialId); // 1.5s
const userPreferences = await getUserPreferences(userId);  // 1.5s
// Total: 3s

// ✅ Parallel (fast ~1.5s)
const [tutorialHtml, userPreferences] = await Promise.all([
  getTutorialContent(tutorialId),  // 1.5s |
  getUserPreferences(userId),       // 1.5s | concurrent
]);
// Total: 1.5s (fastest of the two)
```

## Dicoding Service: External API Client

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

## Utils: Helper Functions

Buat `backend/src/utils/htmlParser.ts`:

```typescript

import * as cheerio from 'cheerio';

export const parseHtmlContent = (html: string): string => {
  const $ = cheerio.load(html);
  // Extract text from the body, which is a simplistic approach.
  // A more robust solution might target specific elements.
  const text = $('body').text();
  // Clean up whitespace
  return text.replace(/\s\s+/g, ' ').trim();
};
```

Buat `backend/src/utils/errorHandler.ts`:

```typescript

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
};
```

## Test Backend Locally

Jalankan server:

```bash
cd backend
npm run dev
```

Output yang diharapkan:
```
🚀 Backend server running on http://localhost:4000
📡 API endpoint: http://localhost:4000/api/v1
```

Test endpoints dengan curl:

```bash
# Health check
curl http://localhost:4000/

# Get preferences
curl "http://localhost:4000/api/v1/preferences?user_id=1"

# Get assessment (tunggu ~15-20 detik untuk Gemini generate)
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"
```

## API Response Examples

### GET /api/v1/preferences?user_id=1

Response:
```json
{
  "userPreferences": {
    "theme": "dark",
    "fontSize": "medium",
    "fontStyle": "default",
    "layoutWidth": "standard"
  }
}
```

### GET /api/v1/assessment?tutorial_id=35363&user_id=1

Response:
```json
{
  "assessment": {
    "questions": [
      {
        "id": "q1",
        "questionText": "Apa fungsi utama dari React Hooks?",
        "options": [
          { "id": "opt1", "text": "Mengelola state dan lifecycle" },
          { "id": "opt2", "text": "Styling komponen" },
          { "id": "opt3", "text": "Routing aplikasi" },
          { "id": "opt4", "text": "Menangani HTTP requests" }
        ],
        "correctOptionId": "opt1",
        "explanation": "React Hooks memungkinkan functional components menggunakan state dan lifecycle features. Hooks seperti useState dan useEffect menggantikan class components. Hint: Pelajari lagi materi tentang useState dan useEffect di React."
      }
    ]
  },
  "userPreferences": {
    "theme": "dark",
    "fontSize": "medium",
    "fontStyle": "default",
    "layoutWidth": "standard"
  },
  "fromCache": false
}
```

## Architecture Summary

```
Request Flow:
Client → Express Router → Controller → Service → External API/Gemini
                            ↓
                        Validation
                            ↓
                        Response

File Structure:
backend/src/
├── app.ts              # Express app setup (dotenv di sini!)
├── server.ts           # Local dev entry point (dengan app.listen)
├── index.ts            # Vercel serverless entry point (export app)
├── config/
│   └── constants.ts    # Semua konstanta
├── types/
│   └── index.ts        # TypeScript interfaces
├── controllers/
│   └── assessment.controller.ts  # HTTP handlers
├── routes/
│   ├── index.ts
│   └── assessment.routes.ts
├── services/
│   ├── assessment.service.ts     # Business logic
│   ├── dicoding.service.ts       # Dicoding API client
│   └── gemini.service.ts         # Gemini AI client (next tutorial)
└── utils/
    ├── errorHandler.ts           # Error middleware
    └── htmlParser.ts             # HTML parser
```

## Best Practices Yang Diterapkan

### 1. **Environment Variable Loading Order**
```typescript
// ✅ Load dotenv FIRST in app.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
// Now process.env is populated!
```

### 2. **Parallel Data Fetching**
```typescript
// ✅ Fetch in parallel untuk performance
const [html, prefs] = await Promise.all([
  getTutorialContent(tutorialId),
  getUserPreferences(userId),
]);
```

### 3. **Proper Error Handling**
```typescript
// ✅ Throw errors, let middleware handle
if (!data) {
  throw new Error('Data not found');
}
// Error caught by errorHandler middleware
```

### 4. **Type Safety**
```typescript
// ✅ Explicit return types
export const fetchData = async (): Promise<Data> => {
  // TypeScript ensures correct return type
}
```

## Common Issues & Solutions

### Issue 1: "GEMINI_API_KEY is not defined"

**Cause**: dotenv loaded setelah gemini.service di-import

**Solution**: Move dotenv.config() ke TOP of app.ts (before ANY imports)

### Issue 2: "Cannot GET /"

**Cause**: Lupa export app di index.ts

**Solution**: 
```typescript
// backend/src/index.ts
export default app; // ✅
```

### Issue 3: "Port already in use"

**Cause**: Server masih running dari previous session

**Solution**:
```bash
lsof -ti:4000 | xargs kill -9
```

## Kesimpulan

Backend kita sekarang punya:
- ✅ Clean architecture (Controller → Service → External API)
- ✅ Dua entry points (dev vs serverless)
- ✅ dotenv loading yang benar (di app.ts)
- ✅ Parallel data fetching untuk performance
- ✅ Type-safe dengan TypeScript
- ✅ Proper error handling dengan middleware

Di tutorial berikutnya, kita akan integrate Google Gemini AI untuk generate pertanyaan!

## Next Steps

Lanjut ke [Integrasi Gemini AI](./03-gemini.md) →
