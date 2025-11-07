---
sidebar_position: 2
---

# Backend API dengan Express

Di tutorial ini, kita akan membangun REST API menggunakan Express.js untuk serve data kuis dan preferences user.

## 🎯 Apa Yang Akan Kita Bangun?

Backend API yang:
1. **Fetch data tutorial** dari Dicoding Mock API
2. **Fetch user preferences** (theme, font, layout)
3. **Generate quiz questions** menggunakan Gemini AI
4. **Return combined data** ke frontend dalam format JSON

## 📊 Data Flow Overview

Sebelum coding, pahami dulu alur datanya:

```
User buka quiz di browser
        ↓
Frontend hit: POST /api/v1/assessment/generate
        ↓
BACKEND CONTROLLER (assessment.controller.ts)
- Validate request (userId, tutorialId)
- Call service layer ↓
        ↓
BACKEND SERVICE (assessment.service.ts)
- Parallel fetch: [Tutorial Content, User Preferences]
        ↓
DICODING SERVICE (dicoding.service.ts)
├─→ GET /tutorials/{id} → HTML content
└─→ GET /users/{id}/preferences → JSON preferences
        ↓
HTML PARSER (htmlParser.ts)
- Clean HTML → Plain text
        ↓
GEMINI SERVICE (gemini.service.ts)
- Send text → Gemini AI
- Get back: 3 quiz questions (JSON)
        ↓
BACKEND SERVICE (combine data)
- Merge: {questions, preferences, timestamp}
        ↓
BACKEND CONTROLLER (send response)
- Return JSON to frontend
        ↓
Frontend display quiz
```

## 🏗️ Order of Creation (Urutan Buat File)

**PENTING**: Urutan ini penting! Jangan random bikin file, karena ada dependency.

### Step 1: Foundation (Config & Types)
```
1. backend/src/config/constants.ts      ← API URLs, model names
2. backend/src/types/index.ts           ← TypeScript interfaces
```
**Why first?** File lain akan import constants dan types ini.

### Step 2: Utilities (Helpers)
```
3. backend/src/utils/errorHandler.ts    ← Error middleware
4. backend/src/utils/htmlParser.ts      ← HTML cleaner
```
**Why now?** Services butuh utils ini.

### Step 3: External Services (API Clients)
```
5. backend/src/services/dicoding.service.ts  ← Fetch dari Dicoding
6. backend/src/services/gemini.service.ts    ← Gemini AI integration
```
**Why now?** Assessment service akan pakai kedua service ini.

### Step 4: Business Logic (Core Service)
```
7. backend/src/services/assessment.service.ts  ← Orchestration logic
```
**Why now?** Ini yang combine dicoding + gemini + htmlParser.

### Step 5: HTTP Layer (Controllers & Routes)
```
8. backend/src/controllers/assessment.controller.ts  ← HTTP handlers
9. backend/src/routes/assessment.routes.ts           ← Route definitions
10. backend/src/routes/index.ts                      ← Main router
```
**Why now?** Controller pakai service, routes pakai controller.

### Step 6: Express App Setup
```
11. backend/src/app.ts     ← Express app (dotenv + middleware + routes)
12. backend/src/server.ts  ← Local dev entry point
13. backend/src/index.ts   ← Vercel serverless entry point
```
**Why last?** App import semua routes, server/index import app.

## 🔗 File Dependencies (Siapa Import Siapa)

```
app.ts
 ├─ imports dotenv (FIRST!)
 ├─ imports express
 ├─ imports cors
 ├─ imports routes/index.ts
 │   └─ imports routes/assessment.routes.ts
 │       └─ imports controllers/assessment.controller.ts
 │           ├─ imports services/assessment.service.ts
 │           │   ├─ imports services/dicoding.service.ts
 │           │   │   └─ imports axios
 │           │   ├─ imports services/gemini.service.ts
 │           │   │   ├─ imports @google/genai
 │           │   │   └─ imports types/index.ts
 │           │   ├─ imports utils/htmlParser.ts
 │           │   │   └─ imports cheerio
 │           │   └─ imports types/index.ts
 │           └─ imports config/constants.ts
 └─ imports utils/errorHandler.ts

server.ts → imports app.ts (+ calls app.listen)
index.ts → imports app.ts (exports app, NO listen)
```

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

### 🤔 Why We Need This File?

**Problem**: Magic strings dan numbers scattered di codebase
```typescript
// ❌ BAD: Magic strings everywhere
fetch('https://learncheck-dicoding-mock-...'); // Line 45
fetch('https://learncheck-dicoding-mock-...'); // Line 128 (typo!)
model: 'gemini-2.5-flash' // Line 67
model: 'gemini-2-flash'   // Line 201 (different version!)
```

**Solution**: Single source of truth
```typescript
// ✅ GOOD: One place to manage
export const API_CONFIG = {
  DICODING_BASE_URL: '...',  // Change once, affects everywhere
  GEMINI_MODEL: 'gemini-2.5-flash',
}
```

**Benefits**:
- 🔄 Easy to update (change model version in 1 place)
- 🐛 Less bugs (no typos in URLs)
- 📖 Readable (named constants explain meaning)

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

### 🤔 Why We Need This File?

**Problem**: Tanpa types, bugs muncul di runtime
```typescript
// ❌ Without types
const prefs = await getUserPrefs();
console.log(prefs.theem); // Typo! Runtime error
console.log(prefs.fontSize); // undefined, expected 'small' | 'medium' | 'large'
```

**Solution**: Type safety catches bugs at compile time
```typescript
// ✅ With types
const prefs: UserPreferences = await getUserPrefs();
console.log(prefs.theem); // ⚠️ TypeScript error: Property 'theem' does not exist
console.log(prefs.theme);  // ✅ Autocomplete works!
```

**Benefits**:
- 🐛 Catch typos before runtime
- 🧠 Better IDE autocomplete
- 📝 Self-documenting code
- 🔄 Easier refactoring

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

### 🤔 Why We Need Routes?

**Problem**: All endpoints in one big file = maintenance nightmare
```typescript
// ❌ BAD: Everything in app.ts
app.get('/api/v1/assessment', handler1);
app.get('/api/v1/preferences', handler2);
app.post('/api/v1/users', handler3);
app.put('/api/v1/users/:id', handler4);
// ... 50 more routes
```

**Solution**: Modular routing by feature
```typescript
// ✅ GOOD: Organized by domain
routes/
  index.ts          ← Main router (mounts all sub-routers)
  assessment.routes.ts  ← All assessment-related routes
  users.routes.ts       ← All user-related routes (future)
```

**Benefits**:
- 📁 Organized by feature/domain
- 🔍 Easy to find routes
- 👥 Multiple devs can work on different route files
- 🧪 Easier to test individual route modules

### File 1: Main Router

Buat `backend/src/routes/index.ts`:

```typescript

import { Router } from 'express';
import assessmentRouter from './assessment.routes';

const router = Router();

// Mount assessment routes (includes /preferences and /assessment)
router.use('/', assessmentRouter);

export default router;
```

### File 2: Assessment Routes

**Why separate file?** All assessment-related endpoints in one place.

**Route Design Decisions**:
- `GET /preferences` - Simple, only fetch user settings
- `GET /assessment` - Complex, fetch + generate + combine data

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

### 🤔 Why We Need Controllers?

**Problem**: Mixing HTTP logic dengan business logic = messy code
```typescript
// ❌ BAD: Everything in route handler
app.get('/assessment', async (req, res) => {
  // HTTP validation
  if (!req.query.user_id) return res.status(400).json({error: '...'});
  
  // Business logic
  const html = await fetch('...');
  const text = parseHTML(html);
  const questions = await generateWithAI(text);
  
  // HTTP response
  res.json({data: questions});
});
```

**Solution**: Separate concerns dengan layers
```typescript
// ✅ GOOD: Clear separation
// Route: Define URL pattern
router.get('/assessment', getAssessment);

// Controller: Handle HTTP (validate, call service, respond)
export const getAssessment = async (req, res) => {
  const {user_id} = req.query;
  if (!user_id) return res.status(400).json({error: '...'});
  
  const data = await fetchAssessmentData(user_id); // Service
  res.json(data);
};

// Service: Pure business logic
export const fetchAssessmentData = async (userId) => {
  // Focus on WHAT to do, not HTTP stuff
};
```

**Benefits**:
- 🎯 Controller = HTTP layer (request/response/validation)
- 💼 Service = Business logic (reusable, testable)
- 🧪 Easy to unit test services (no HTTP mocking needed)
- 🔄 Services can be called from controllers, CLI, cron jobs, etc.

### Controller Responsibilities

✅ **Controller SHOULD**:
- Validate request parameters
- Extract data from `req.query`/`req.body`
- Call service layer functions
- Send HTTP responses (status codes + JSON)
- Catch errors and pass to error middleware

❌ **Controller SHOULD NOT**:
- Make external API calls directly
- Contain complex business logic
- Parse HTML or process data
- Know about Gemini API or database details

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

### 🤔 Why We Need Service Layer?

**Problem**: Semua logic di controller = tidak reusable
```typescript
// ❌ BAD: Logic stuck in HTTP context
app.get('/assessment', async (req, res) => {
  const html = await fetch('dicoding...');
  const text = parseHTML(html);
  const questions = await generateAI(text);
  res.json(questions);
});

// Mau pakai logic yang sama di CLI script?
// Mau pakai di cron job?
// Mau unit test tanpa HTTP?
// CANNOT! Logic tied to Express req/res
```

**Solution**: Extract pure business logic ke service
```typescript
// ✅ GOOD: Reusable, testable business logic
// Service (pure function, no HTTP)
export const fetchAssessmentData = async (userId, tutorialId) => {
  const html = await fetch('dicoding...');
  const text = parseHTML(html);
  const questions = await generateAI(text);
  return {questions, userId, tutorialId};
};

// Controller (thin wrapper)
app.get('/assessment', async (req, res) => {
  const data = await fetchAssessmentData(req.query.userId, req.query.tutorialId);
  res.json(data);
});

// CLI script (reuse same logic!)
const data = await fetchAssessmentData('user123', 'tutorial456');
console.log(data);

// Unit test (no HTTP mocking!)
const result = await fetchAssessmentData('testUser', 'testTutorial');
expect(result.questions).toHaveLength(3);
```

**Benefits**:
- 🔄 **Reusable**: Can be called from controllers, CLI, cron jobs, tests
- 🧪 **Testable**: Pure functions, easy to unit test
- 🎯 **Single Responsibility**: Each service does ONE thing well
- 🧩 **Composable**: Services can call other services

### Service Architecture Pattern

```
assessment.service.ts (Orchestrator)
    ↓
Coordinates multiple services:
    ├─→ dicoding.service.ts (External API client)
    ├─→ gemini.service.ts (AI client)
    └─→ htmlParser.ts (Data transformer)
```

**Why this pattern?**
- `assessment.service` = **Business logic** (orchestrate the flow)
- `dicoding.service` = **External API** (talk to Dicoding)
- `gemini.service` = **AI integration** (talk to Gemini)
- `htmlParser` = **Data transformation** (HTML → text)

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
