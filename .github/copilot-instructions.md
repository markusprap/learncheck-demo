# LearnCheck! AI Coding Assistant Guide

Essential knowledge for AI agents working with the LearnCheck! codebase.

## Architecture Overview

**Dual Frontend Setup**: This monorepo has TWO frontend implementations:
1. **Root (`index.tsx`)**: 797-line single-file React app with embedded services - used for quick prototyping
2. **`frontend/` directory**: Structured React app with proper separation of concerns - **production implementation**

**Backend**: Node.js/Express API in `backend/` providing assessment generation endpoints.

**Data Flow**: Frontend → Backend API (`/api/v1/assessment`) → Dicoding Mock Service (content scraping) + Gemini AI (question generation) → Frontend

**Deployment**: Vercel-optimized monorepo. `vercel.json` rewrites `/api/*` to backend, all else to frontend.

## Critical Patterns

### Gemini API Integration (`backend/src/services/gemini.service.ts`)
- Uses `@google/genai` package (NOT `@google/generative-ai`)
- API initialization: `new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})`
- Structured output with JSON schema using `Type` enum for validation (see `assessmentSchema`)
- Model: `gemini-2.5-flash` configured in `backend/src/config/constants.ts`
- Model call: `ai.models.generateContent()` with `responseMimeType: "application/json"`
- **Language**: All questions/explanations MUST be in Indonesian (Bahasa Indonesia)
- **Question format**: 3 multiple-choice questions, 4 options each
- **Explanation format**: Must end with "Hint:" followed by specific learning recommendation

### State Management (`frontend/src/store/useQuizStore.ts`)
- **Zustand with dynamic localStorage keys**: Uses `storageKey` pattern `learncheck-${userId}-${tutorialId}`
- **Critical**: `initialize()` method must be called before quiz starts to set correct storage key and load persisted progress
- Custom storage proxy (`dynamicStorage`) allows per-user/per-tutorial state isolation
- **Why proxy pattern**: Zustand's `persist` middleware can't access dynamic state in `getStorage()`, so we use a proxy that references `get()` function
- State includes: questions, currentQuestionIndex, selectedAnswers, submittedAnswers, quizOver, revealAnswers

### Backend Service Architecture
- **Parallel data fetching**: `assessment.service.ts` uses `Promise.all()` to fetch tutorial content and user preferences simultaneously
- **HTML parsing**: `cheerio` library extracts clean text from Dicoding HTML (see `htmlParser.ts`)
- **Route structure**: `/api/v1` prefix in `app.ts`, routes organized in `routes/index.ts`
- **Two entry points**: `server.ts` for local dev (with `app.listen()`), `index.ts` for Vercel (exports app only)

### Caching Strategy (Redis - Optional)
- **Note**: Redis caching code removed but infrastructure mentioned in `REDIS.md`
- `skipCache` parameter kept in API for compatibility but not actively used
````markdown
# LearnCheck! — Copilot instructions (concise)

This short guide helps AI coding agents be productive in this repo. Focus on the files and patterns below when making changes.

1. Architecture (quick)
	- `frontend/` — production React + Vite app (use this for UI changes).
	- `backend/` — Express TypeScript API exposing `/api/v1/*`.
	- Vercel: `vercel.json` routes `/api/*` to the backend serverless function (backend must export the Express app; DO NOT call `app.listen()` in `index.ts`).

2. Key developer commands
	- Frontend dev: `cd frontend && npm install && npm run dev` (Vite on :5173)
	- Backend dev: `cd backend && npm install && npm run dev` (uses `ts-node-dev` and runs `src/server.ts` on :4000)
	- Build backend: `cd backend && npm run build` (outputs `dist`)

3. Critical project patterns
	- Gemini integration: `backend/src/services/gemini.service.ts`. Uses `@google/genai` and model name defined in `backend/src/config/constants.ts` (e.g. `gemini-2.5-flash`). Keep outputs JSON-parseable.
	- Two backend entrypoints: `server.ts` (local dev, calls `app.listen`) and `index.ts` (Vercel export — no listen()).
	- Zustand storage: `frontend/src/store/useQuizStore.ts` uses a dynamic localStorage key pattern `learncheck-${userId}-${tutorialId}`. Call `initialize(userId, tutorialId)` before starting a quiz.
	- HTML parsing: `backend/src/utils/htmlParser.ts` uses `cheerio` to extract tutorial text before sending to Gemini.

4. Environment and integration
	- Required env (backend): `GEMINI_API_KEY`; optional `REDIS_URL` (see `REDIS.md`).
	- Dicoding mock service base URL is in `backend/src/config/constants.ts` — use existing endpoints for tutorial content and user prefs during dev.

5. Editing guidance and examples
	- If touching AI code: run local generation flow (frontend -> backend `/assessment`) and inspect logs in backend (`console.log` statements present in services).
	- When changing backend exports for Vercel, ensure `backend/src/index.ts` exports `app` (not `listen`). See `backend/src/server.ts` for local usage.
	- For UI text and hint format: generated item explanations expect an explanation that ends with `Hint:`; frontend splits on `Hint:` in `frontend/src/App.tsx`.

6. Conventions
	- TypeScript strict mode is used. Keep explicit types for exported functions and API responses.
	- No test runner configured; add tests if you modify critical orchestration logic.

Files to check first: `backend/src/services/gemini.service.ts`, `backend/src/services/assessment.service.ts`, `backend/src/config/constants.ts`, `frontend/src/store/useQuizStore.ts`, `frontend/src/hooks/useQuizData.ts`, `vercel.json`.

If anything here is unclear or you want more detail about a specific flow (e.g., generation, caching, embedding), tell me which area and I will expand with concrete examples and code snippets.
````

