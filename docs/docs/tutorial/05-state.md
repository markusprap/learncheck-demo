---
sidebar_position: 5
---

# State Management dengan Zustand

Di tutorial ini, kita akan implement state management untuk quiz app dengan Zustand dan localStorage persistence.

## Kenapa Zustand?

### vs Redux
| Feature | Redux | Zustand |
|---------|-------|---------|
| Setup | Complex (actions, reducers, middleware) | Simple (one function) |
| Boilerplate | Banyak | Minimal |
| Bundle Size | 3KB | 1KB |
| Learning Curve | Steep | Gentle |

### vs Context API
| Feature | Context | Zustand |
|---------|---------|---------|
| Performance | Re-render all consumers | Only components that use state |
| DevTools | No | Yes (with middleware) |
| Persistence | Manual | Built-in middleware |

**TL;DR**: Zustand = Redux simplicity + Context performance + localStorage built-in

## The Challenge: Dynamic Storage Keys

Kita butuh **isolate quiz state per user AND per tutorial**:

```typescript
// User 1, Tutorial A → localStorage key: "learncheck-1-A"
// User 1, Tutorial B → localStorage key: "learncheck-1-B"
// User 2, Tutorial A → localStorage key: "learncheck-2-A"
```

**Problem**: Zustand's `persist` middleware can't access dynamic state dalam `getStorage()` function!

```typescript
// ❌ DOESN'T WORK - get() not available in getStorage()
persist(
  (set, get) => ({ ... }),
  {
    name: 'quiz-storage',
    getStorage: () => {
      const state = get(); // ❌ ERROR: get is not defined!
      return localStorage.getItem(state.storageKey);
    }
  }
)
```

**Solution**: Proxy storage pattern! 🎉

## Storage Proxy Pattern (Advanced!)

Buat `frontend/src/store/useQuizStore.ts`:

```typescript

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question } from '../types';

type QuizState = {
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswers: { [questionId: string]: string };
  submittedAnswers: { [questionId: string]: boolean };
  quizOver: boolean;
  revealAnswers: boolean;
  storageKey: string;
};

type QuizActions = {
  setQuestions: (questions: Question[]) => void;
  selectAnswer: (questionId: string, optionId: string) => void;
  submitAnswer: (questionId: string) => void;
  nextQuestion: () => void;
  finishQuiz: () => void;
  reset: () => void;
  initialize: (userId: string, tutorialId: string) => void;
};

// Fix: The original `getStorage` implementation was incorrect because it cannot access
// the store's `get` function. This proxy storage object is a workaround.
// It allows the storage methods (`getItem`, `setItem`) to dynamically access
// the `storageKey` from the store's state.
const dynamicStorage = {
  _get: (() => ({})) as () => QuizState & QuizActions, // This will be replaced by the store's `get` function.

  getItem: (name: string): string | null => {
    const state = dynamicStorage._get();
    return localStorage.getItem(state.storageKey || name);
  },
  setItem: (name: string, value: string): void => {
    const state = dynamicStorage._get();
    localStorage.setItem(state.storageKey || name, value);
  },
  removeItem: (name: string): void => {
    const state = dynamicStorage._get();
    localStorage.removeItem(state.storageKey || name);
  },
};

export const useQuizStore = create<QuizState & QuizActions>()(
  persist(
    (set, get) => {
      // Provide the store's `get` function to our proxy storage.
      dynamicStorage._get = get;
      
      return {
        questions: [],
        currentQuestionIndex: 0,
        selectedAnswers: {},
        submittedAnswers: {},
        quizOver: false,
        revealAnswers: false,
        storageKey: 'quiz-storage',

        initialize: (userId, tutorialId) => {
          const key = `learncheck-${userId}-${tutorialId}`;
          if (get().storageKey === key) {
            return; // Already initialized
          }

          // Fix: The original logic didn't load persisted state. This implementation
          // manually loads the state from localStorage for the new key.
          const savedStateRaw = localStorage.getItem(key);
          let savedState = {};
          if (savedStateRaw) {
            try {
              savedState = JSON.parse(savedStateRaw).state;
            } catch (e) {
              console.error("Failed to parse saved state", e);
            }
          }
          
          set({
            storageKey: key,
            // Set defaults, then overwrite with any saved progress
            currentQuestionIndex: 0,
            selectedAnswers: {},
            submittedAnswers: {},
            quizOver: false,
            ...savedState,
            // Non-persisted state should always be reset
            revealAnswers: false,
          });
        },

        setQuestions: (questions) => set({ 
          // Set questions and ensure quiz is not over (fresh start)
          questions,
          quizOver: false,
          revealAnswers: false,
        }),

        selectAnswer: (questionId, optionId) => {
          if (get().submittedAnswers[questionId]) return;
          set((state) => ({
            selectedAnswers: {
              ...state.selectedAnswers,
              [questionId]: optionId,
            },
          }));
        },

        submitAnswer: (questionId) => {
          set((state) => ({
            submittedAnswers: {
              ...state.submittedAnswers,
              [questionId]: true,
            },
          }));
        },

        nextQuestion: () => {
          const { currentQuestionIndex, questions } = get();
          if (currentQuestionIndex < questions.length - 1) {
              set((state) => ({
                currentQuestionIndex: state.currentQuestionIndex + 1,
              }));
          } else {
              set({ quizOver: true });
          }
        },

        finishQuiz: () => set({ quizOver: true }),

        reset: () => {
          // Keep the storageKey, but reset progress.
          set({
            currentQuestionIndex: 0,
            selectedAnswers: {},
            submittedAnswers: {},
            quizOver: false,
            revealAnswers: false,
          });
        },
      }
    },
    {
      name: 'quiz-storage', // default name, will be dynamically managed
      // Fix: Replaced the incorrect `getStorage` with the working `storage` proxy.
      storage: createJSONStorage(() => dynamicStorage),
      partialize: (state) => ({
        currentQuestionIndex: state.currentQuestionIndex,
        selectedAnswers: state.selectedAnswers,
        submittedAnswers: state.submittedAnswers,
        quizOver: state.quizOver,
      }),
    }
  )
);
```

## Deep Dive: How It Works

### 1. Storage Proxy Object

```typescript
const dynamicStorage = {
  _get: (() => ({})) as () => QuizState & QuizActions,
  
  getItem: (name: string): string | null => {
    const state = dynamicStorage._get(); // ← Access current store state!
    return localStorage.getItem(state.storageKey || name);
  },
  // ... setItem, removeItem
};
```

**Magic**: `_get` property holds reference to store's `get()` function. Saat `getItem()` dipanggil, kita bisa access current `storageKey` dari state!

### 2. Inject `get` Function

```typescript
persist(
  (set, get) => {
    dynamicStorage._get = get; // ← Inject get() into proxy
    
    return {
      // ... state & actions
    };
  }
)
```

Sekarang `dynamicStorage` punya akses ke store state via `get()`.

### 3. Initialize Method (Critical!)

```typescript
initialize: (userId, tutorialId) => {
  const key = `learncheck-${userId}-${tutorialId}`;
  
  // Load persisted state from localStorage
  const savedStateRaw = localStorage.getItem(key);
  let savedState = {};
  if (savedStateRaw) {
    savedState = JSON.parse(savedStateRaw).state;
  }
  
  set({
    storageKey: key,
    currentQuestionIndex: 0, // defaults
    selectedAnswers: {},
    submittedAnswers: {},
    quizOver: false,
    ...savedState, // ← Overwrite dengan saved progress!
  });
}
```

**Flow**:
1. Generate storage key: `learncheck-1-35363`
2. Check localStorage for that key
3. If exists → parse and load saved progress
4. If not → use defaults
5. Set `storageKey` state → proxy uses this for future saves

### 4. Partialize (What to Persist)

```typescript
partialize: (state) => ({
  currentQuestionIndex: state.currentQuestionIndex,
  selectedAnswers: state.selectedAnswers,
  submittedAnswers: state.submittedAnswers,
  quizOver: state.quizOver,
}),
```

**Persisted**:
- ✅ `currentQuestionIndex`: Resume dari question yang sama
- ✅ `selectedAnswers`: User answers preserved
- ✅ `submittedAnswers`: Which questions submitted
- ✅ `quizOver`: Quiz finished or not

**NOT Persisted**:
- ❌ `questions`: Loaded fresh dari API (bisa berubah)
- ❌ `revealAnswers`: UI state, not important
- ❌ `storageKey`: Meta, not quiz progress

### 5. State Actions Explained

#### setQuestions

```typescript
setQuestions: (questions) => set({ 
  questions,
  quizOver: false,  // ← CRITICAL: Reset quiz state
  revealAnswers: false,
})
```

**Why reset `quizOver`?**

Tanpa ini, kalau user klik "Try Again" setelah finish quiz, quiz langsung ke results screen (karena `quizOver: true` masih persist).

#### selectAnswer

```typescript
selectAnswer: (questionId, optionId) => {
  if (get().submittedAnswers[questionId]) return; // ← Prevent change after submit
  set((state) => ({
    selectedAnswers: {
      ...state.selectedAnswers,
      [questionId]: optionId,
    },
  }));
}
```

**Immutable update**: Spread operator untuk create new object (React re-render detection).

#### nextQuestion

```typescript
nextQuestion: () => {
  const { currentQuestionIndex, questions } = get();
  if (currentQuestionIndex < questions.length - 1) {
    set({ currentQuestionIndex: currentQuestionIndex + 1 });
  } else {
    set({ quizOver: true }); // ← Last question → finish quiz
  }
}
```

#### reset

```typescript
reset: () => {
  set({
    currentQuestionIndex: 0,
    selectedAnswers: {},
    submittedAnswers: {},
    quizOver: false,
    revealAnswers: false,
    // ⚠️ KEEP storageKey! Don't reset user/tutorial context
  });
}
```

**Used for**: "Coba Lagi" button (clear progress tapi keep context).

## Usage in Components

### Initialize Store (App.tsx)

```typescript
const App = () => {
  const initialize = useQuizStore(state => state.initialize);
  
  useEffect(() => {
    if (userId && tutorialId) {
      initialize(userId, tutorialId); // ← CRITICAL: Call before quiz starts!
    }
  }, [userId, tutorialId, initialize]);
  
  // ... rest of component
};
```

**MUST call before quiz starts!** Tanpa ini, storage key = default `'quiz-storage'`, semua user share progress! 😱

### Load Questions

```typescript
const App = () => {
  const setQuestions = useQuizStore(state => state.setQuestions);
  
  useEffect(() => {
    if (assessmentData?.assessment?.questions) {
      setQuestions(assessmentData.assessment.questions);
    }
  }, [assessmentData?.assessment, setQuestions]);
};
```

### Select Answer (QuestionComponent)

```typescript
const QuestionComponent = ({ question }) => {
  const selectAnswer = useQuizStore(state => state.selectAnswer);
  const selectedAnswers = useQuizStore(state => state.selectedAnswers);
  
  return (
    <div onClick={() => selectAnswer(question.id, option.id)}>
      {/* ... */}
    </div>
  );
};
```

**Zustand magic**: Only `QuestionComponent` re-renders saat `selectedAnswers` change. Other components unaffected!

### Submit Answer

```typescript
const QuestionComponent = ({ question }) => {
  const submitAnswer = useQuizStore(state => state.submitAnswer);
  const submittedAnswers = useQuizStore(state => state.submittedAnswers);
  
  const handleSubmit = () => {
    if (!submittedAnswers[question.id]) {
      submitAnswer(question.id);
    }
  };
};
```

### Navigate Questions

```typescript
const Quiz = () => {
  const nextQuestion = useQuizStore(state => state.nextQuestion);
  const questions = useQuizStore(state => state.questions);
  const currentQuestionIndex = useQuizStore(state => state.currentQuestionIndex);
  
  const currentQuestion = questions[currentQuestionIndex];
  
  return (
    <div>
      <QuestionComponent question={currentQuestion} />
      <Button onClick={nextQuestion}>Next</Button>
    </div>
  );
};
```

## Testing State Persistence

### Test 1: Resume Quiz After Refresh

1. Start quiz: `http://localhost:5173/?tutorial_id=35363&user_id=1`
2. Answer Question 1
3. Refresh page (F5)
4. **Expected**: Quiz resumes at Question 1 dengan answer preserved

### Test 2: Multiple Users

1. User 1: `?tutorial_id=35363&user_id=1`
   - Answer question 1 → Option A
2. User 2: `?tutorial_id=35363&user_id=2`
   - Answer question 1 → Option B
3. Back to User 1: `?tutorial_id=35363&user_id=1`
   - **Expected**: Still shows Option A selected

### Test 3: Multiple Tutorials

1. Tutorial A: `?tutorial_id=35363&user_id=1`
   - Progress to question 2
2. Tutorial B: `?tutorial_id=99999&user_id=1`
   - Start from question 1
3. Back to Tutorial A: `?tutorial_id=35363&user_id=1`
   - **Expected**: Resume at question 2

## localStorage Structure

Check browser DevTools → Application → Local Storage:

```javascript
// Key: learncheck-1-35363
// Value:
{
  "state": {
    "currentQuestionIndex": 1,
    "selectedAnswers": {
      "q1": "opt2"
    },
    "submittedAnswers": {
      "q1": true
    },
    "quizOver": false
  },
  "version": 0
}
```

## Performance Optimization

### Selector Pattern (Prevent Unnecessary Re-renders)

```typescript
// ❌ BAD - Component re-renders on ANY state change
const Quiz = () => {
  const store = useQuizStore(); // ALL state
  return <div>{store.currentQuestionIndex}</div>;
};

// ✅ GOOD - Only re-renders when currentQuestionIndex changes
const Quiz = () => {
  const currentQuestionIndex = useQuizStore(state => state.currentQuestionIndex);
  return <div>{currentQuestionIndex}</div>;
};
```

### Multiple Selectors

```typescript
const Quiz = () => {
  // Each selector independently tracks changes
  const questions = useQuizStore(state => state.questions);
  const currentIndex = useQuizStore(state => state.currentQuestionIndex);
  const nextQuestion = useQuizStore(state => state.nextQuestion);
  
  // Re-renders only when questions OR currentIndex change
  // nextQuestion function stable, doesn't cause re-render
};
```

## Common Issues

### Issue 1: State not persisting

**Cause**: `initialize()` not called

**Solution**: Check `useEffect` in App.tsx calls `initialize(userId, tutorialId)`

### Issue 2: Shared state across users

**Cause**: Same `storageKey` for all users

**Solution**: Ensure `initialize()` creates unique key: `learncheck-${userId}-${tutorialId}`

### Issue 3: Old data from different tutorial

**Cause**: `initialize()` not called when params change

**Solution**: Add userId and tutorialId to useEffect deps:
```typescript
useEffect(() => {
  initialize(userId, tutorialId);
}, [userId, tutorialId, initialize]); // ← Deps here!
```

### Issue 4: Quiz immediately finishes

**Cause**: `quizOver: true` persisted, not reset on new quiz

**Solution**: `setQuestions()` should reset `quizOver: false`

## Architecture Summary

```
User navigates to URL with tutorial_id & user_id
    ↓
App.tsx calls initialize(userId, tutorialId)
    ↓
Zustand store:
  - Set storageKey = "learncheck-{userId}-{tutorialId}"
  - Load saved state from localStorage[storageKey]
  - Restore currentQuestionIndex, selectedAnswers, etc.
    ↓
User interacts with quiz (select, submit, next)
    ↓
Zustand actions update state
    ↓
Persist middleware automatically saves to localStorage[storageKey]
    ↓
User refreshes page → State restored from localStorage
```

## Best Practices

### 1. Always Initialize Before Use

```typescript
// ✅ Initialize first
initialize(userId, tutorialId);
setQuestions(questions);

// ❌ Don't use store before initialize
setQuestions(questions); // Wrong storage key!
initialize(userId, tutorialId);
```

### 2. Reset State on New Quiz

```typescript
const handleStartQuiz = () => {
  reset(); // ← Clear old progress
  setQuizStarted(true);
  generateQuiz();
};
```

### 3. Keep storageKey Immutable During Quiz

```typescript
// ❌ DON'T change storageKey mid-quiz
initialize(newUserId, newTutorialId); // Progress lost!

// ✅ Finish quiz first, then navigate
finishQuiz();
window.location.href = `?tutorial_id=${newId}&user_id=${userId}`;
```

## Kesimpulan

Zustand store kita sekarang punya:
- ✅ Dynamic localStorage keys (per user per tutorial)
- ✅ Automatic state persistence
- ✅ Resume quiz after refresh
- ✅ Isolated state (no cross-user contamination)
- ✅ Performance optimized (selector pattern)
- ✅ Type-safe (TypeScript interfaces)

**Innovation**: Storage proxy pattern untuk solve Zustand limitation dengan dynamic keys!

## Next Steps

State management done! Sekarang kita implement **real-time preference updates** dari Dicoding classroom.

Lanjut ke [Real-time Preferences dengan postMessage](./06-realtime.md) →
