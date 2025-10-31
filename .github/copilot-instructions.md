# LearnCheck! AI Coding Assistant Guide

This guide provides essential information for AI coding assistants to effectively contribute to the LearnCheck! codebase.

## Architecture Overview

This is a full-stack monorepo with a React frontend and a Node.js/Express backend.

-   **Frontend**: Located in the root directory and `frontend/`. It's built with React, Vite, and TypeScript. State management is handled by Zustand (`frontend/src/store/useQuizStore.ts`). UI components are in `frontend/src/components/`.
-   **Backend**: Located in the `backend/` directory. It's a Node.js/Express application written in TypeScript. It provides a REST API for the frontend.
-   **AI Integration**: The backend uses the Google Gemini API for generating assessments. The core logic is in `backend/src/services/gemini.service.ts`.
-   **Data Flow**: The frontend calls the backend API. The backend may call external services (like Dicoding for content, handled in `backend/src/services/dicoding.service.ts`) and the Gemini API, then returns the processed data to the frontend.

## Developer Workflow

### Environment Setup

1.  **API Keys**: You need a Gemini API key.
2.  Create a `.env.local` file in the root directory and add `GEMINI_API_KEY=your_key_here`.
3.  Create a `.env` file in the `backend/` directory and add `GEMINI_API_KEY=your_key_here`.

### Running the Application

-   **Frontend (Root)**:
    -   Install dependencies: `npm install`
    -   Run dev server: `npm run dev` (http://localhost:3000)

-   **Backend**:
    -   `cd backend`
    -   Install dependencies: `npm install`
    -   Run dev server: `npm run dev`

### Building for Production

-   **Frontend**: `npm run build`
-   **Backend**: `cd backend && npm run build`

## Key Files and Conventions

-   **API Routes**: Backend routes are defined in `backend/src/routes/`. The main routes for assessments are in `backend/src/routes/assessment.routes.ts`.
-   **Services**: Business logic is encapsulated in services in `backend/src/services/`.
    -   `assessment.service.ts`: Orchestrates the assessment generation process.
    -   `gemini.service.ts`: Handles all interactions with the Gemini API.
    -   `dicoding.service.ts`: Fetches or scrapes data from the Dicoding platform, using `utils/htmlParser.ts`.
-   **State Management (Frontend)**: The `frontend/src/store/useQuizStore.ts` file manages the global state for the quiz using Zustand. When adding new state related to the quiz, modify this file.
-   **API Calls (Frontend)**: All frontend API calls to the backend are centralized in `frontend/src/services/api.ts`.
-   **Error Handling**: The backend uses a centralized error handler in `backend/src/utils/errorHandler.ts`.

When working on the codebase, please adhere to these patterns and conventions.
