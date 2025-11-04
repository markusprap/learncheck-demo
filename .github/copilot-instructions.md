# LearnCheck! AI Coding Assistant Guide

Essential knowledge for AI agents working with the LearnCheck! codebase.

## Architecture Overview

**Dual Frontend Setup**: This monorepo has TWO frontend implementations:
1. **Root (`index.tsx`)**: 797-line single-file React app with embedded services - used for quick prototyping
2. **`frontend/` directory**: Structured React app with proper separation of concerns - production implementation

**Backend**: Node.js/Express API in `backend/` providing assessment generation endpoints.

**Data Flow**: Frontend → Backend API (`/api/v1/assessment`) → Dicoding Service (content scraping) + Gemini API (question generation) → Frontend

**Deployment**: Vercel-optimized monorepo. `vercel.json` rewrites `/api/*` to backend, all else to frontend.

## Critical Patterns

### Gemini API Integration (`backend/src/services/gemini.service.ts`)
- Uses `@google/genai` package (NOT `@google/generative-ai`)
- API initialization: `new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})`
- Structured output with JSON schema using `Type` enum for validation
- Model call: `ai.models.generateContent()` with `responseMimeType: "application/json"`
- Generates 3 Indonesian multiple-choice questions with specific explanation format

### State Management (`frontend/src/store/useQuizStore.ts`)
- **Zustand with dynamic localStorage keys**: Uses `storageKey` pattern `learncheck-${userId}-${tutorialId}`
- **Critical**: `initialize()` method must be called before quiz starts to set correct storage key and load persisted progress
- Custom storage proxy (`dynamicStorage`) allows per-user/per-tutorial state isolation
- State includes: questions, currentQuestionIndex, selectedAnswers, quizOver, revealAnswers

### Backend Service Architecture
- **Parallel data fetching**: `assessment.service.ts` uses `Promise.all()` to fetch tutorial content and user preferences simultaneously
- **HTML parsing**: `cheerio` library extracts clean text from Dicoding HTML (see `htmlParser.ts`)
- **Route structure**: `/api/v1` prefix in `app.ts`, routes organized in `routes/index.ts`

## Developer Workflow

**Environment Setup**:
```bash
# Root .env.local (for root frontend)
GEMINI_API_KEY=your_key_here

# backend/.env (for backend)
GEMINI_API_KEY=your_key_here
```

**Running Locally**:
```bash
# Frontend (production structure)
cd frontend && npm install && npm run dev

# Backend (separate terminal)
cd backend && npm install && npm run dev

# Root frontend (prototyping)
npm install && npm run dev  # runs on port 3000
```

**Backend serves**: `http://localhost:PORT` (see `backend/src/index.ts` - exports app for Vercel, no explicit listen)

## Vercel Deployment Config

`vercel.json` defines:
- Backend build: `backend/src/index.ts` with `@vercel/node`
- Frontend build: `frontend/package.json` with `@vercel/static-build`
- Rewrites: `/api/*` → backend, `/*` → frontend static files

**Important**: Backend `index.ts` exports the Express app directly (no `app.listen()`) for Vercel serverless functions.

## Key Files

- **Types**: `frontend/src/types.ts` defines `Question`, `AssessmentData`, `UserPreferences`
- **API client**: `frontend/src/services/api.ts` - axios instance with `/api/v1` base URL
- **Quiz hook**: `frontend/src/hooks/useQuizData.ts` - fetches assessment data with query params `tutorial_id`, `user_id`
- **Error handling**: `backend/src/utils/errorHandler.ts` - Express error middleware returning 500 with error message
