---
sidebar_position: 5
---

# State Management dengan Zustand

State management itu penting banget untuk aplikasi yang kompleks. Kita pakai **Zustand** karena lebih simple dari Redux tapi tetap powerful!

## Kenapa Zustand?

Bandingkan dengan Redux:

**Redux**:
```typescript
// Butuh: actions, reducers, store, provider
// 50+ lines code untuk simple counter
```

**Zustand**:
```typescript
// Cuma butuh 10 lines!
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}));
```

Simpel kan? 😄

## Install Zustand

```bash
npm install zustand
```

## Quiz Store

Buat `src/store/useQuizStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Question } from '../types';

interface QuizState {
  // State
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswers: Record<string, string>;
  submittedAnswers: Record<string, boolean>;
  quizOver: boolean;
  revealAnswers: boolean;
  timerExpired: boolean;
  
  // Storage key (dynamic per user/tutorial)
  storageKey: string;
  
  // Actions
  initialize: (userId: string, tutorialId: string) => void;
  setQuestions: (questions: Question[]) => void;
  selectAnswer: (questionId: string, optionId: string) => void;
  submitAnswer: (questionId: string) => void;
  nextQuestion: () => void;
  finishQuiz: () => void;
  reset: () => void;
}

const dynamicStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    return str ? JSON.parse(str) : null;
  },
  setItem: (name: string, value: any) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      // Initial state
      questions: [],
      currentQuestionIndex: 0,
      selectedAnswers: {},
      submittedAnswers: {},
      quizOver: false,
      revealAnswers: false,
      timerExpired: false,
      storageKey: 'learncheck-default',
      
      // Initialize with dynamic storage key
      initialize: (userId: string, tutorialId: string) => {
        const storageKey = `learncheck-${userId}-${tutorialId}`;
        set({ storageKey });
        
        // Load persisted state for this user/tutorial
        const saved = dynamicStorage.getItem(storageKey);
        if (saved?.state) {
          set(saved.state);
        }
      },
      
      setQuestions: (questions) => set({ questions }),
      
      selectAnswer: (questionId, optionId) => {
        const { selectedAnswers } = get();
        set({
          selectedAnswers: {
            ...selectedAnswers,
            [questionId]: optionId,
          },
        });
      },
      
      submitAnswer: (questionId) => {
        const { submittedAnswers } = get();
        set({
          submittedAnswers: {
            ...submittedAnswers,
            [questionId]: true,
          },
        });
      },
      
      nextQuestion: () => {
        const { currentQuestionIndex, questions } = get();
        const nextIndex = currentQuestionIndex + 1;
        
        if (nextIndex >= questions.length) {
          set({ quizOver: true, revealAnswers: true });
        } else {
          set({ currentQuestionIndex: nextIndex });
        }
      },
      
      finishQuiz: () => {
        set({ quizOver: true, revealAnswers: true });
      },
      
      reset: () => {
        const { storageKey } = get();
        set({
          questions: [],
          currentQuestionIndex: 0,
          selectedAnswers: {},
          submittedAnswers: {},
          quizOver: false,
          revealAnswers: false,
          timerExpired: false,
        });
        dynamicStorage.removeItem(storageKey);
      },
    }),
    {
      name: 'quiz-storage',
      storage: dynamicStorage,
    }
  )
);
```

## Penjelasan Detail

### 1. Persist Middleware

```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: 'quiz-storage',
    storage: dynamicStorage,
  }
)
```

Ini auto-save state ke localStorage! Jadi kalau user refresh halaman, progress nya tidak hilang.

### 2. Dynamic Storage Key

```typescript
storageKey: `learncheck-${userId}-${tutorialId}`
```

Kenapa dynamic?
- User A tutorial 123: `learncheck-1-123`
- User A tutorial 456: `learncheck-1-456`
- User B tutorial 123: `learncheck-2-123`

Setiap kombinasi user+tutorial punya storage sendiri! Jadi tidak bentrok.

### 3. State Structure

**questions**: Array of Question objects dari API
**currentQuestionIndex**: Soal nomor berapa yang sedang ditampilkan (0-2)
**selectedAnswers**: Record jawaban yang dipilih user
```typescript
{
  "q1": "option-a",
  "q2": "option-c"
}
```

**submittedAnswers**: Record soal yang sudah disubmit
```typescript
{
  "q1": true,
  "q2": true
}
```

**quizOver**: Boolean, apakah kuis sudah selesai?
**revealAnswers**: Boolean, tampilkan jawaban benar?

### 4. Actions

**initialize**: Set storage key, load saved progress
**setQuestions**: Isi pertanyaan dari API
**selectAnswer**: User pilih jawaban
**submitAnswer**: User submit jawaban (tampilkan penjelasan)
**nextQuestion**: Lanjut ke soal berikutnya
**finishQuiz**: Selesai, tampilkan hasil
**reset**: Reset semua state, hapus dari localStorage

## Cara Pakai di Component

```typescript
import { useQuizStore } from './store/useQuizStore';

function Quiz() {
  // Get state
  const questions = useQuizStore(state => state.questions);
  const currentIndex = useQuizStore(state => state.currentQuestionIndex);
  
  // Get actions
  const selectAnswer = useQuizStore(state => state.selectAnswer);
  const submitAnswer = useQuizStore(state => state.submitAnswer);
  
  // Use it!
  const currentQuestion = questions[currentIndex];
  
  return (
    <div>
      <h2>{currentQuestion.text}</h2>
      {currentQuestion.options.map(option => (
        <button onClick={() => selectAnswer(currentQuestion.id, option.id)}>
          {option.text}
        </button>
      ))}
      <button onClick={() => submitAnswer(currentQuestion.id)}>
        Submit
      </button>
    </div>
  );
}
```

## Keuntungan Zustand

### 1. No Provider Hell

Redux:
```typescript
<Provider store={store}>
  <App />
</Provider>
```

Zustand:
```typescript
<App /> // Langsung pakai!
```

### 2. TypeScript Support

Auto-complete works perfectly! IDE tahu semua state dan actions.

### 3. Selective Re-render

```typescript
// Only re-render when questions change
const questions = useQuizStore(state => state.questions);

// Only re-render when currentIndex change
const currentIndex = useQuizStore(state => state.currentQuestionIndex);
```

Component cuma re-render kalau data yang dipakai berubah. Efficient!

### 4. DevTools

Install Zustand DevTools browser extension untuk debug:
- Lihat state real-time
- Time-travel debugging
- Action logs

## Testing State

Buat file test `src/test-store.ts`:

```typescript
import { useQuizStore } from './store/useQuizStore';

// Initialize
useQuizStore.getState().initialize('user1', 'tutorial123');

// Set questions
useQuizStore.getState().setQuestions([
  {
    id: 'q1',
    text: 'What is React?',
    options: [
      { id: 'a', text: 'A library' },
      { id: 'b', text: 'A framework' }
    ],
    correctOptionId: 'a',
    explanation: 'React is a JavaScript library'
  }
]);

// Select answer
useQuizStore.getState().selectAnswer('q1', 'a');

// Check state
console.log(useQuizStore.getState().selectedAnswers); // { q1: 'a' }
```

## Performa Tips

### 1. Jangan Subscribe ke Root State

❌ **Bad**:
```typescript
const state = useQuizStore(); // Re-render on ANY change!
```

✅ **Good**:
```typescript
const questions = useQuizStore(state => state.questions); // Only when questions change
```

### 2. Use Shallow Comparison

Untuk multiple values:

```typescript
import { shallow } from 'zustand/shallow';

const { questions, currentIndex } = useQuizStore(
  state => ({ 
    questions: state.questions, 
    currentIndex: state.currentQuestionIndex 
  }),
  shallow
);
```

### 3. Memoize Derived State

```typescript
const currentQuestion = useMemo(
  () => questions[currentQuestionIndex],
  [questions, currentQuestionIndex]
);
```

## Kesimpulan

State management dengan Zustand:
- ✅ Simple API (no boilerplate)
- ✅ TypeScript friendly
- ✅ Persist to localStorage
- ✅ Dynamic storage key per user/tutorial
- ✅ Selective re-renders (performance!)

Di tutorial berikutnya, kita akan handle real-time preference updates!

## Next Steps

Lanjut ke [Real-Time Preferences](./06-realtime.md) →
