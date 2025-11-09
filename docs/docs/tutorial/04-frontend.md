---
sidebar_position: 4
---

# Frontend dengan React & Vite

Di tutorial ini, kita akan build frontend React dengan Vite yang display quiz, handle user interaction, dan apply user preferences.

## 🎯 What We're Building

Frontend app yang bisa:
1. **Fetch quiz data** dari backend API
2. **Display questions** satu-satu dengan multiple choice options
3. **Handle user answers** dengan feedback (benar/salah)
4. **Apply user preferences** (theme, font, layout) real-time
5. **Save progress** ke localStorage (per user + per tutorial)

## 🔗 Full Data Flow (Backend → Frontend)

```
BACKEND (Port 4000)
assessment.controller → assessment.service → dicoding + gemini
    ↓ (HTTP Response)
{
  assessment: { questions: [...] },
  userPreferences: { theme: "dark", ... }
}
    ↓
FRONTEND (Port 5173)
    ↓
api.ts (axios client)
- POST /api/v1/assessment/generate
- Receive JSON response
    ↓
useQuizData.ts (custom hook)
- fetchQuestions() → call api.ts
- setQuestions() → store to Zustand
- applyPreferences() → update CSS variables
    ↓
useQuizStore.ts (Zustand state)
- Store: questions, selectedAnswers, submittedAnswers
- Persist to localStorage: "learncheck-{userId}-{tutorialId}"
    ↓
App.tsx (main component)
- Read from Zustand: const {questions} = useQuizStore()
- Render UI based on state
    ↓
QuestionComponent
- Display question text
- Display 4 options as buttons
- Handle onClick → updateSelectedAnswer()
- Show feedback after submit
    ↓
User sees quiz on screen!
```

## 📂 File Creation Order (Frontend)

**Step 1: Configuration & Setup**
```
1. tailwind.config.js       ← Custom colors (primary-50 to primary-950)
2. postcss.config.js         ← Tailwind + autoprefixer
3. src/index.css             ← @tailwind directives
4. src/types.ts              ← TypeScript interfaces matching backend
```

**Step 2: Services & API**
```
5. src/config/constants.ts   ← API_BASE_URL
6. src/services/api.ts       ← Axios instance + fetchAssessment()
```

**Step 3: State Management**
```
7. src/store/useQuizStore.ts ← Zustand store (questions, answers, persistence)
```

**Step 4: Custom Hooks**
```
8. src/hooks/useQuizData.ts  ← Data fetching + preference application
```

**Step 5: UI Components (Reusable)**
```
9. src/components/ui/Card.tsx          ← Container dengan shadow
10. src/components/ui/Button.tsx       ← Styled button
11. src/components/ui/Loader.tsx       ← Spinning loader
12. src/components/ui/LoadingState.tsx ← Loading text + loader
```

**Step 6: Main Application**
```
13. src/App.tsx      ← Main component (renders everything!)
14. src/main.tsx     ← Entry point (ReactDOM.render)
```

### Kenapa Urutan Ini?

```
Config files DULU
    ↓ (Types dibutuhkan services)
TypeScript types
    ↓ (API butuh constants)
Services & API
    ↓ (Hooks pakai store + services)
State management
    ↓ (Hooks pakai store)
Custom hooks
    ↓ (Components pakai hooks)
UI components
    ↓ (App.tsx gabungin semua)
Main Application
```
```
13. src/App.tsx      ← Main component (renders everything!)
14. src/main.tsx     ← Entry point (ReactDOM.render)
```

### Kenapa Urutan Ini?

```
Config files DULU
    ↓ (Types diperlukan services)
TypeScript types
    ↓ (API butuh constants)
```

## Kenapa React + Vite?

## Step-by-step: How to create `useQuizData.ts` (the hook)

1. Create the file and imports

```ts
// frontend/src/hooks/useQuizData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';
import { useQuizStore } from '../store/useQuizStore';
import { QUIZ_CONFIG, API_ENDPOINTS } from '../config/constants';
```

Kenapa: `useQuizData` berada di antara API dan UI. Hook ini fetch preferences, trigger quiz generation, dan koordinasi dengan `useQuizStore` supaya data dan UI tetap konsisten.

2. Tanggung jawab hook ini

- Fetch user preferences (load awal + on demand)
- Listen ke event `postMessage` dan `focus` untuk refresh preferences
- Respect progress quiz (jangan interrupt quiz yang lagi dikerjain; pakai `silentUpdate`)
- Trigger quiz generation via API dan set assessment yang dikembalikan ke local state
- Expose flags: `isLoadingPreferences`, `isGeneratingQuiz`, `error` dan functions `generateQuiz()` dan `refetchPreferences()`

3. Detail implementasi kunci (map ke functions yang akan kamu implement)

- `fetchPreferences(forceRefresh = false, silentUpdate = false)`
  - Tambah cache-busting param (`_t`) waktu fetching
  - Pakai debounce (`QUIZ_CONFIG.DEBOUNCE_MS`) supaya gak fetch berulang-ulang
  - Kalau `silentUpdate` true, update preferences tanpa toggle loading UI (dipakai selama quiz)

- `generateQuiz(isRetry = false)`
  - Panggil `GET /api/v1/assessment` dengan `tutorial_id` dan `user_id`
  - Pakai `fresh=true` waktu retry untuk bypass cache
  - Set `assessmentData` local state (hook gak persist answers — store yang handle itu)

- `useEffect` untuk listener `postMessage`
  - Pada message `preference-updated`: schedule debounced `fetchPreferences(true, isInQuiz)`

- `useEffect` untuk window `focus`
  - Waktu focus, jalankan silent refresh kalau quiz lagi jalan, atau normal refresh kalau idle

4. Cara hook ini bicara dengan store (`useQuizStore`)

- Hook baca `questions = useQuizStore(state => state.questions)` cuma untuk cek apakah quiz sedang jalan, jadi bisa tahu harus pakai silent updates atau enggak.
- Setelah `generateQuiz()` dapat `assessment` dari backend, hook panggil `useQuizStore.getState().initialize(userId, tutorialId)` (kalau belum initialized) dan `useQuizStore.getState().setQuestions(assessment.questions)` untuk simpan questions dan enable persistence.

Kenapa gak biarkan hook yang fully manage questions? Separation of concerns:
- Hook = data fetching dan ephemeral UI flags
- Store = persistent quiz state dan user interactions

5. Contoh minimal API usage di dalam hook

```ts
const response = await api.get(API_ENDPOINTS.ASSESSMENT, { params: { tutorial_id: tutorialId, user_id: userId } });
setAssessmentData(response.data);
// Persist questions ke store
useQuizStore.getState().initialize(userId, tutorialId);
useQuizStore.getState().setQuestions(response.data.assessment.questions);
```

6. Testing dan pengecekan manual

- Manual: buka app, panggil `generateQuiz()` dari console dan cek `useQuizStore.getState().questions` sudah terisi.
- Ide unit test: mock response `api.get` dan assert hook return flags yang benar serta expose `generateQuiz`.

---

Tambahkan hook ini setelah kamu punya store, jadi bisa langsung panggil `initialize()` dan `setQuestions()` setelah generation.


### React
- **Component-based**: UI dipecah jadi komponen kecil yang reusable
- **Declarative**: Kamu describe apa yang mau ditampilin, React yang handle sisanya
- **Rich Ecosystem**: Banyak library pendukung (state management, routing, dll.)

### Vite
- **Super Cepat**: Hot Module Replacement (HMR) ~50ms
- **No Config**: Works out of the box untuk React + TypeScript
- **Modern**: ES modules, optimized build

Alternatif: Create React App (CRA) tapi lebih lambat dan bloated.

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Main component (468 lines!)
│   ├── index.css             # Tailwind directives
│   ├── types.ts              # TypeScript interfaces
│   ├── components/
│   │   ├── layout/           # Layout components (future)
│   │   └── ui/               # Reusable UI components
│   │       ├── Card.tsx
│   │       ├── Button.tsx
│   │       ├── Loader.tsx
│   │       └── LoadingState.tsx
│   ├── config/
│   │   └── constants.ts      # Frontend constants
│   ├── features/
│   │   └── quiz/             # Quiz-specific components (future)
│   ├── hooks/
│   │   └── useQuizData.ts    # Custom hook untuk data fetching
│   ├── services/
│   │   └── api.ts            # Axios instance
│   └── store/
│       └── useQuizStore.ts   # Zustand state management
├── index.html                # HTML entry point
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
└── package.json
```

## Setup Tailwind CSS (BUILD SYSTEM, NOT CDN!)

**CRITICAL**: Kita pakai Tailwind **build system**, BUKAN CDN!

### Kenapa?

❌ **CDN Approach** (jangan pakai):
```html
<!-- index.html -->
<script src="https://cdn.tailwindcss.com"></script>
```
Masalahnya:
- Custom colors TIDAK work (`primary-500`, dll)
- Production bundle besar (include semua Tailwind classes)
- Loading time lebih lambat

✅ **Build System** (yang kita pakai):
```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Keuntungannya:
- Custom colors WORK! 
- Production bundle kecil (only used classes)
- Loading time lebih cepat

### Setup Steps

File `tailwind.config.js` udah dibuat di Tutorial 01. Sekarang buat `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Simple tapi CRITICAL!** Tiga directives ini inject Tailwind classes ke CSS build kamu.

## Entry Point: main.tsx

Buat file `frontend/src/main.tsx`:

```tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Penjelasan**:
- `import './index.css'`: **CRITICAL!** Load Tailwind CSS
- `React.StrictMode`: Enable extra checks during development
- `ReactDOM.createRoot`: React 18 concurrent rendering

## API Configuration

Buat `frontend/src/services/api.ts`:

```typescript

import axios from 'axios';

// TODO: Replace with environment variable for production
const API_BASE_URL = '/api/v1'; // Vercel will redirect this to your backend

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

**Kenapa `/api/v1`?**

Vercel routing di `vercel.json`:
```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "/backend/src/index.ts" }
  ]
}
```

Request ke `/api/v1/assessment` → routed ke backend serverless function!

## Frontend Constants

Buat `frontend/src/config/constants.ts`:

```typescript
/**
 * Frontend application constants
 */

export const QUIZ_CONFIG = {
  TIMER_DURATION_MINUTES: 5,
  TOTAL_QUESTIONS: 3,
  DEBOUNCE_MS: 200,
  POSTMESSAGE_DELAY_MS: 300, // Delay for parent window message handling
} as const;

export const STORAGE_CONFIG = {
  KEY_PREFIX: 'learncheck',
} as const;

export const API_ENDPOINTS = {
  PREFERENCES: '/preferences',
  ASSESSMENT: '/assessment',
} as const;

export const THEME_OPTIONS = ['dark', 'light'] as const;
export const FONT_SIZE_OPTIONS = ['small', 'medium', 'large'] as const;
export const FONT_STYLE_OPTIONS = ['default', 'serif', 'mono'] as const;
export const LAYOUT_WIDTH_OPTIONS = ['fullWidth', 'standard'] as const;
```

## TypeScript Types

Buat `frontend/src/types.ts`:

```typescript
export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  questionText: string;
  options: Option[];
  correctOptionId: string;
  explanation: string;
}

export interface Assessment {
  questions: Question[];
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  fontStyle: 'default' | 'serif' | 'mono';
  layoutWidth: 'fullWidth' | 'standard';
}

export interface AssessmentData {
  assessment: Assessment;
  userPreferences: UserPreferences;
  fromCache: boolean;
}
```

## Reusable UI Components

### Card Component

Buat `frontend/src/components/ui/Card.tsx`:

```tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};

export default Card;
```

### Button Component

Buat `frontend/src/components/ui/Button.tsx`:

```tsx
import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary-600 text-white',
    secondary: 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-50',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
```

**Kenapa `clsx`?**

```tsx
// ❌ String concatenation (ugly)
className={`base ${variant === 'primary' ? 'bg-primary' : 'bg-secondary'} ${disabled ? 'opacity-50' : ''}`}

// ✅ clsx (clean)
className={clsx('base', {
  'bg-primary': variant === 'primary',
  'bg-secondary': variant === 'secondary',
  'opacity-50': disabled
})}
```

### Loader Component

Buat `frontend/src/components/ui/Loader.tsx`:

```tsx
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default Loader;
```

### LoadingState Component

Buat `frontend/src/components/ui/LoadingState.tsx`:

```tsx
import React from 'react';
import Card from './Card';
import Loader from './Loader';

const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="p-8 text-center max-w-md">
        <Loader />
        <p className="mt-4 text-lg font-semibold">Membuat Kuis Untukmu...</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          AI sedang menganalisis materi dan membuat pertanyaan yang relevan. Mohon tunggu sebentar...
        </p>
      </Card>
    </div>
  );
};

export default LoadingState;
```

## Main App Component Structure

File `App.tsx` kita lumayan besar (468 lines), jadi kita breakdown jadi sections:

### 1. Imports & Types

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQuizStore } from './store/useQuizStore';
import useQuizData from './hooks/useQuizData';
import { Question, Option } from './types';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import Card from './components/ui/Card';
import Button from './components/ui/Button';
import Loader from './components/ui/Loader';
import LoadingState from './components/ui/LoadingState';
```

### 2. Progress Bar Component

```tsx
const ProgressBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary dark:bg-primary-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
};
```

### 3. QuizContainer (Apply User Preferences)

```tsx
const QuizContainer: React.FC<QuizContainerProps> = ({ preferences, children, isEmbedded = false }) => {
  // Apply dark mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);
  
  // Build container classes based on preferences
  const containerClasses: string[] = [
    'text-slate-900 dark:text-slate-50 transition-colors duration-300',
    isEmbedded ? 'min-h-full p-3 sm:p-4' : 'min-h-screen p-4 sm:p-6 lg:p-8'
  ];
  
  // Apply font size
  if (preferences.fontSize === 'small') containerClasses.push('text-sm');
  else if (preferences.fontSize === 'large') containerClasses.push('text-lg');
  else containerClasses.push('text-base');

  // Apply font style
  if (preferences.fontStyle === 'serif') containerClasses.push('font-serif');
  else if (preferences.fontStyle === 'mono') containerClasses.push('font-mono');
  
  const contentWidthClass = preferences.layoutWidth === 'fullWidth' ? 'max-w-full' : 'max-w-4xl';

  return (
    <div className={containerClasses.join(' ')}>
      <div className={`mx-auto ${contentWidthClass}`}>
        {children}
      </div>
    </div>
  );
};
```

**User Preferences Explained**:

1. **Theme (dark/light)**: Toggle `dark` class di `<html>`
2. **Font Size**: Apply `text-sm`, `text-base`, atau `text-lg`
3. **Font Style**: Apply `font-serif`, `font-mono`, atau default
4. **Layout Width**: `max-w-4xl` (standard) atau `max-w-full` (full width)

### 4. Intro Screen

```tsx
const Intro: React.FC<IntroProps> = ({ onStart, isLoading = false }) => (
    <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-lg text-center">
            <h1 className="text-3xl font-bold mb-2">Siap Uji Pemahamanmu?</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
                Setelah membaca materi, yuk cek seberapa jauh kamu sudah paham. 
                Kuis singkat ini dibuat oleh AI khusus untukmu berdasarkan materi yang baru saja kamu pelajari.
            </p>
            <div className="flex justify-center">
                <Button onClick={onStart} size="lg" disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader />
                            <span>Memuat...</span>
                        </div>
                    ) : 'Mulai Cek Pemahaman!'}
                </Button>
            </div>
        </Card>
    </div>
);
```

### 5. Question Component (The Heart!)

Ini component paling complex. Handle:
- Display question & options
- Answer selection
- Submit answer
- Show correct/incorrect feedback
- Display explanation & hint

```tsx
const QuestionComponent: React.FC<QuestionProps> = ({ question }) => {
  const { 
    selectedAnswers, 
    selectAnswer,
    submittedAnswers,
    submitAnswer,
    nextQuestion,
    questions,
    currentQuestionIndex
  } = useQuizStore();

  const selectedOptionId = selectedAnswers[question.id];
  const isSubmitted = submittedAnswers[question.id];
  const isAnswerSelected = selectedAnswers.hasOwnProperty(question.id);
  const isCorrect = isSubmitted && selectedOptionId === question.correctOptionId;

  // Split explanation and hint
  const explanationParts = question.explanation.split('Hint:');
  const mainExplanation = explanationParts[0].trim();
  const hintText = explanationParts.length > 1 ? explanationParts[1].trim() : null;
  
  // Random feedback prefix
  const feedbackPrefix = useMemo(() => {
    if (!isSubmitted) return '';
    const correctPrefixes = [
      "Mantap, jawabanmu benar! ",
      "Tepat sekali! ",
      "Keren, kamu paham konsepnya! "
    ];
    const incorrectPrefixes = [
      "Hampir benar! Coba kita lihat lagi yuk. ",
      "Belum tepat, tapi jangan khawatir, ini bagian dari belajar. "
    ];
    const prefixes = isCorrect ? correctPrefixes : incorrectPrefixes;
    return prefixes[Math.floor(Math.random() * prefixes.length)];
  }, [isSubmitted, isCorrect]);

  return (
    <Card className="overflow-hidden">
      {/* Feedback Header (after submit) */}
      {isSubmitted && (
        <div className={clsx('p-4 sm:p-5 border-b-2', {
          'bg-red-50 dark:bg-red-900/30 border-red-500': !isCorrect,
          'bg-green-50 dark:bg-green-900/30 border-green-500': isCorrect,
        })}>
          <h3 className={clsx('font-bold text-lg flex items-center gap-2', {
            'text-red-700 dark:text-red-300': !isCorrect,
            'text-green-700 dark:text-green-300': isCorrect,
          })}>
            {!isCorrect ? <XCircle size={22} /> : <CheckCircle2 size={22} />}
            <span>{!isCorrect ? 'Salah' : 'Benar'}</span>
          </h3>
        </div>
      )}
      
      {/* Question & Options */}
      <div className="p-4 sm:p-6">
        <p className="text-xl md:text-2xl font-bold mb-6">{question.questionText}</p>
        <div className="space-y-4">
          {question.options.map((option) => (
            <div
              key={option.id}
              className={/* dynamic classes based on selected/correct */}
              onClick={() => selectAnswer(question.id, option.id)}
            >
              <span>{option.text}</span>
              {/* Show checkmark/x icon after submit */}
            </div>
          ))}
        </div>
      </div>
      
      {/* Explanation (after submit) */}
      {isSubmitted && (
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50">
           <h4 className="font-bold mb-2">Penjelasan</h4>
           <p>{feedbackPrefix + mainExplanation}</p>
           
           {/* Hint Section */}
           {hintText && (
             <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/40 rounded-lg flex">
                <Lightbulb className="h-5 w-5 text-primary-500 mr-3" />
                <div>
                  <h5 className="font-semibold text-sm">Hint</h5>
                  <p className="text-sm">{hintText}</p>
                </div>
             </div>
           )}
        </div>
      )}

      {/* Action Button */}
      <div className="p-4 sm:p-6 flex justify-end">
        <Button onClick={handleButtonClick} disabled={!isAnswerSelected}>
          {isSubmitted
            ? (currentQuestionIndex === questions.length - 1 ? 'Lihat Hasil' : 'Soal Berikutnya')
            : 'Kirim Jawaban'}
        </Button>
      </div>
    </Card>
  );
};
```

### 6. Quiz Component (Orchestrator)

```tsx
const Quiz: React.FC<QuizProps> = ({ onTryAgain, onGoToIntro }) => {
  const { questions, currentQuestionIndex, quizOver } = useQuizStore();
  const finishQuiz = useQuizStore(state => state.finishQuiz);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes

  // Timer countdown
  useEffect(() => {
    if (quizOver || timeLeft <= 0) {
      if (timeLeft <= 0) finishQuiz();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizOver, finishQuiz]);

  if (quizOver) {
    return <Results onTryAgain={onTryAgain} onGoToIntro={onGoToIntro} />;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isTimeCritical = timeLeft <= 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">
          Pertanyaan {currentQuestionIndex + 1} dari {questions.length}
        </span>
        <span className={clsx('text-sm font-mono', {
          'text-red-600 font-bold': isTimeCritical,
        })}>
          {formattedTime}
        </span>
      </div>
      <ProgressBar value={currentQuestionIndex + 1} max={questions.length} />
      <QuestionComponent question={currentQuestion} />
    </div>
  );
};
```

### 7. Results Component

```tsx
const Results: React.FC<ResultsProps> = ({ onTryAgain, onGoToIntro }) => {
  const { questions, selectedAnswers } = useQuizStore();

  const score = useMemo(() => questions.reduce((acc, question) => {
    return selectedAnswers[question.id] === question.correctOptionId ? acc + 1 : acc;
  }, 0), [questions, selectedAnswers]);

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  // Dynamic message based on score
  const { title, subtitle } = useMemo(() => {
    if (percentage === 100) return {
      title: "Luar Biasa! Pemahaman Sempurna!",
      subtitle: "Kamu benar-benar menguasai materi ini."
    };
    if (percentage >= 80) return {
      title: "Kerja Bagus! Kamu di Jalur yang Tepat!",
      subtitle: "Pemahamanmu sudah sangat solid."
    };
    // ... more cases
  }, [percentage]);

  return (
    <div className="space-y-8 flex flex-col items-center">
      <Card className="p-6 text-center w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-slate-600 mb-4">{subtitle}</p>
        <p className="text-6xl font-bold my-4">{percentage}%</p>
        <p>Kamu menjawab {score} dari {questions.length} soal dengan benar.</p>
      </Card>
      
      <div className="flex items-center gap-4">
        <Button onClick={onGoToIntro} variant="secondary">Kembali ke Awal</Button>
        <Button onClick={onTryAgain}>Coba Lagi</Button>
      </div>
    </div>
  );
};
```

### 8. Main App Component

```tsx
const App: React.FC = () => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tutorialId = urlParams.get('tutorial_id');
  const userId = urlParams.get('user_id');
  
  const [quizStarted, setQuizStarted] = useState(false);
  const { userPreferences, assessmentData, isGeneratingQuiz, error, generateQuiz } = useQuizData(tutorialId, userId);
  
  const initialize = useQuizStore(state => state.initialize);
  const setQuestions = useQuizStore(state => state.setQuestions);
  const reset = useQuizStore(state => state.reset);

  // Initialize Zustand with userId and tutorialId
  useEffect(() => {
    if (userId && tutorialId) {
      initialize(userId, tutorialId);
    }
  }, [userId, tutorialId, initialize]);

  // Load questions when data arrives
  useEffect(() => {
    if (assessmentData?.assessment?.questions) {
      setQuestions(assessmentData.assessment.questions);
    }
  }, [assessmentData?.assessment, setQuestions]);

  const handleStartQuiz = async () => {
    if (isGeneratingQuiz || quizStarted) return;
    reset();
    setQuizStarted(true);
    await generateQuiz(); // Generate quiz
  };

  const handleTryAgain = async () => {
    reset();
    setQuizStarted(false);
    await new Promise(resolve => setTimeout(resolve, 100));
    setQuizStarted(true);
    await generateQuiz(true); // Retry with fresh=true
  };

  // Detect iframe embed
  const isEmbedded = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  const renderContent = () => {
    // Missing params error
    if (!tutorialId || !userId) {
      return <div className="text-red-500 p-4">Parameter tidak lengkap</div>;
    }

    // Intro screen
    if (!quizStarted) {
      return <Intro onStart={handleStartQuiz} isLoading={isGeneratingQuiz} />;
    }
    
    // Loading state while generating
    if (quizStarted && isGeneratingQuiz) {
      return <LoadingState />;
    }
    
    // Error state
    if (error) {
      return <div className="text-red-500">Error: {error}</div>;
    }
    
    // Quiz ready!
    if (assessmentData?.assessment) {
      return <Quiz onTryAgain={handleTryAgain} onGoToIntro={() => setQuizStarted(false)} />;
    }
  };
  
  return (
    <main className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      {userPreferences ? (
        <QuizContainer preferences={userPreferences} isEmbedded={isEmbedded}>
          {renderContent()}
        </QuizContainer>
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <Loader />
        </div>
      )}
    </main>
  );
};

export default App;
```

## Test Frontend

```bash
cd frontend
npm run dev
```

Open browser: `http://localhost:5173/?tutorial_id=35363&user_id=1`

Alur yang diharapkan:
1. Loading spinner (fetch preferences) ~0.5s
2. Intro screen dengan tombol "Mulai Cek Pemahaman!"
3. Klik tombol → Loading state "Membuat Kuis Untukmu..." ~15s
4. Quiz muncul dengan 3 pertanyaan
5. Jawab pertanyaan, lihat feedback
6. Results screen dengan skor

## Masalah Umum

### Issue 1: Custom colors tidak work

**Penyebab**: Tailwind CDN masih ada di `index.html`

**Solusi**: Hapus CDN, pastikan `index.css` di-import di `main.tsx`

### Issue 2: Dark mode tidak work

**Penyebab**: Kurang `dark` class di HTML

**Solusi**: Cek `QuizContainer` apply dark class dengan benar

### Issue 3: Icons tidak muncul

**Penyebab**: `lucide-react` belum diinstall

**Solusi**: 
```bash
npm install lucide-react
```

## Kesimpulan

Frontend kita sekarang punya:
- ✅ Tailwind build system (custom colors work!)
- ✅ User preference support (theme, font, layout)
- ✅ Interactive quiz dengan feedback
- ✅ Timer countdown (5 minutes)
- ✅ Results screen dengan dynamic messages
- ✅ Reusable UI components
- ✅ Type-safe dengan TypeScript

## Next Steps

Frontend UI udah jadi! Sekarang kita implement **state management** dengan Zustand untuk persist quiz progress.

Lanjut ke [State Management dengan Zustand](./05-state.md) →
