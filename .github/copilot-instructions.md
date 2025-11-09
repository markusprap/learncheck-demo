# LearnCheck! AI Quiz Generator

AI-powered quiz generator using Gemini 2.5 Flash for Dicoding tutorials. Monorepo deployed on Vercel with React frontend + Express backend.

## Architecture Overview

**Monorepo Structure** (`vercel.json` handles routing)
- `frontend/` → React 18 + Vite + Zustand (dev: port 5173)
- `backend/` → Express + TypeScript API (dev: port 4000, prod: Vercel serverless)
- Route pattern: `/api/*` → backend, everything else → frontend static files

**Data Flow** (end-to-end)
```
User opens quiz → Frontend calls /api/v1/assessment
  ↓
Backend fetches tutorial HTML (Dicoding API) + user preferences in parallel
  ↓
Parse HTML → Extract text → Send to Gemini with structured schema
  ↓
Return 3 questions (Indonesian) → Frontend displays + persists to localStorage
```

## Critical Patterns

### 1. Gemini AI with Structured Output (backend/src/services/gemini.service.ts)

**MUST USE:** `@google/genai` v1.28.0 (NOT `@google/generative-ai` - old package!)

```typescript
import { GoogleGenAI, Type } from '@google/genai';

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: assessmentSchema  // Enforces 3 questions × 4 choices
  }
});
```

**Why Schema Matters:** Without schema, AI returns unpredictable formats (inconsistent keys, varying structure). Schema forces exact structure every time.

**Output Rules** (see lines 75-95):
- All content MUST be Indonesian (casual but professional tone)
- Explanation format: `"Main explanation. Hint: Study recommendation."`
- Frontend splits on `"Hint:"` for separate display sections
- Prompt engineering is highly specific to ensure consistency

### 2. Zustand + Dynamic localStorage Proxy (frontend/src/store/useQuizStore.ts)

**The Problem:** Zustand's `persist` middleware can't access dynamic state inside `getStorage()` function.

**The Solution:** Proxy storage object with reference to `get()` function:

```typescript
const dynamicStorage = {
  _get: (() => ({})) as () => QuizState & QuizActions,  // Replaced later
  getItem: (name) => localStorage.getItem(dynamicStorage._get().storageKey || name),
  setItem: (name, value) => localStorage.setItem(dynamicStorage._get().storageKey || name, value),
  // ...
};
```

**Why This Works:** Proxy references `_get()` which gets replaced with store's actual `get()` function, enabling dynamic storage key access.

**Storage Key Pattern:** `learncheck-${userId}-${tutorialId}` (per-user per-tutorial isolation)

**Initialize Flow:**
1. Call `initialize(userId, tutorialId)` before quiz starts (REQUIRED)
2. Generate storage key → Check localStorage for existing state
3. Restore previous progress OR start fresh with default state

**Persistence Strategy:**
- ✅ Persisted: `selectedAnswers`, `submittedAnswers`, `currentQuestionIndex`, `quizOver`
- ❌ NOT persisted: `questions` (always fresh from backend), `revealAnswers` (UI state only)

### 3. Dual Entry Points for Vercel Serverless (backend/)

**GOTCHA:** Vercel serverless functions CANNOT call `.listen()`

```typescript
// ❌ WRONG - backend/src/index.ts (Vercel entry)
app.listen(4000);  // ERROR! Vercel handles this automatically

// ✅ CORRECT - backend/src/index.ts
export default app;  // Just export, Vercel wraps it

// ✅ CORRECT - backend/src/server.ts (local dev only)
app.listen(4000);  // OK for development
```

**Environment Loading GOTCHA:** `dotenv.config()` MUST be at the top of `app.ts` before ANY imports. Why? `gemini.service.ts` reads `process.env.GEMINI_API_KEY` during module initialization. If `dotenv` loads later, API key won't be available.

**Service Layer Architecture:**
- `assessment.service.ts` → Orchestrator (coordinates all services)
- `gemini.service.ts` → AI generation with structured output
- `dicoding.service.ts` → External API client (tutorial content + user prefs)

**Performance Pattern:** Use `Promise.all()` for parallel fetching:
```typescript
// ✅ Fast (~1.5s) - parallel
const [tutorialHtml, userPreferences] = await Promise.all([
  getTutorialContent(tutorialId),
  getUserPreferences(userId)
]);

// ❌ Slow (~3s) - sequential
const html = await getTutorialContent(tutorialId);      // wait 1.5s
const prefs = await getUserPreferences(userId);         // wait 1.5s more
```

### 4. Real-Time Preferences Without Blocking Quiz (frontend/src/hooks/useQuizData.ts)

**Key UX Pattern:** User preferences (theme, font size) must update silently without disrupting active quiz.

```typescript
if (questions.length > 0 && !silentUpdate) {
  console.log('Skipping fetch - quiz in progress');
  return;  // Don't interrupt user!
}
```

**Event-Driven Updates:**
- Listen to `postMessage` events from parent window (Dicoding iframe)
- React to `focus` events for cross-tab synchronization
- Debounce 500ms to prevent rapid-fire requests (`QUIZ_CONFIG.DEBOUNCE_MS`)
- Add timestamp to requests for cache busting

**Three Update Triggers:**
1. First load → Fetch with loading spinner
2. User changes settings in Dicoding → `postMessage` triggers silent update
3. User returns to tab → `focus` event triggers silent update

## Development Workflows

**Local Setup:**
```bash
# Terminal 1 - Backend
cd backend
npm install
cp .env.example .env  # Add GEMINI_API_KEY
npm run dev  # Runs ts-node-dev on src/server.ts → http://localhost:4000

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev  # Vite dev server → http://localhost:5173
```

**Environment Variables** (backend `.env`):
```env
GEMINI_API_KEY=AIzaSy...  # REQUIRED - Get from https://ai.google.dev/
REDIS_URL=rediss://...     # OPTIONAL - See REDIS.md (12x faster caching)
PORT=4000                  # OPTIONAL - Defaults to 4000
```

**Testing API Locally:**
```bash
curl http://localhost:4000/  # Health check
curl "http://localhost:4000/api/v1/preferences?user_id=1"
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"  # ~15s
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1&fresh=true"
```

**Build for Production:**
```bash
cd backend && npm run build   # TypeScript → dist/
cd frontend && npm run build  # Vite build → dist/
```

## Common Editing Scenarios

**Modifying AI Prompt/Schema:**
1. Edit `backend/src/services/gemini.service.ts` → Update `assessmentSchema` or prompt text
2. Ensure schema matches `Assessment` type in `backend/src/types/index.ts`
3. Test locally, watch console logs for generation flow and timing

**Adding New API Endpoint:**
1. Create controller function in `backend/src/controllers/`
2. Define route in `backend/src/routes/` and register in `routes/index.ts`
3. Add endpoint constant to `frontend/src/config/constants.ts`
4. Implement API call in `frontend/src/services/api.ts`

**Deploying to Vercel:**
- Verify `backend/src/index.ts` only exports `app` (no `.listen()` call)
- Test serverless locally: `vercel dev` in project root
- `vercel.json` defines build commands and route rewrites for monorepo

## Key Files Reference

| File | Purpose | Critical Pattern |
|------|---------|------------------|
| `backend/src/services/gemini.service.ts` | AI generation | Structured output schema enforcement |
| `backend/src/services/assessment.service.ts` | Service orchestration | Parallel fetching with Promise.all() |
| `backend/src/app.ts` | Express app setup | dotenv.config() FIRST before imports |
| `backend/src/index.ts` | Vercel entry point | Export only, NO .listen() |
| `backend/src/server.ts` | Local dev entry | Has .listen() for development |
| `frontend/src/store/useQuizStore.ts` | State management | Dynamic storage proxy pattern |
| `frontend/src/hooks/useQuizData.ts` | Data fetching | Silent updates during quiz |
| `vercel.json` | Deployment config | Monorepo routing rules |

## Conventions & Patterns

- **TypeScript:** Strict mode enabled, explicit types for all exports and API responses
- **Logging:** Extensive `console.log` statements in services for debugging (not removed in production)
- **Error Handling:** Silent failures during quiz, visible errors only on initial load
- **Indonesian Content:** All AI-generated quiz content in Bahasa Indonesia (casual + professional tone)
- **No Tests Yet:** Add tests if modifying critical orchestration or state logic
- **Tutorial Docs:** Full Indonesian tutorials in `docs/docs/tutorial/` (7 step-by-step files)
