---
sidebar_position: 5
---

# State Management dengan Zustand

Di tutorial ini, kita akan implement state management untuk quiz app dengan Zustand dan localStorage persistence.

## 🎯 Masalah Apa yang Kita Pecahkan?

Tanpa state management:
```tsx
// ❌ Props drilling nightmare!
<App>
  <QuizContainer questions={questions} onAnswer={handleAnswer} onSubmit={handleSubmit}>
    <Question question={q} selectedAnswer={selected} onAnswer={handleAnswer}>
      <Option option={opt} selected={selected} onClick={handleClick} />
    </Question>
  </QuizContainer>
</App>

// Setiap component harus pass props ke bawah!
// Ubah prop → update 5 components
```

Dengan Zustand:
```tsx
// ✅ Akses langsung dari mana saja!
function Question() {
  const { questions, selectAnswer } = useQuizStore(); // Tanpa props!
}

function Option() {
  const { selectedAnswers } = useQuizStore(); // Akses langsung!
}
```

## 🔗 Di Mana State Fit dalam Flow

```
User interaksi dengan UI
    ↓
Component panggil: selectAnswer('q1', 'opt2')
    ↓
ZUSTAND STORE (useQuizStore.ts)
- Update state: selectedAnswers['q1'] = 'opt2'
- Trigger re-render HANYA untuk components yang pakai selectedAnswers
- Persist ke localStorage: "learncheck-{userId}-{tutorialId}"
    ↓
Semua components yang pakai useQuizStore() auto ke-update
    ↓
UI reflect state baru
```

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

**Ringkasan**: Zustand = Redux yang simpel + Context yang perform + localStorage built-in

## The Challenge: Dynamic Storage Keys

### 🤔 Kenapa Kita Butuh Dynamic Keys?

**Masalah**: localStorage key yang sama untuk semua user/tutorial
```typescript
// ❌ JELEK: Satu key untuk semuanya
localStorage: {
  "quiz-storage": {
    user1: { tutorial35363: {answers: {...}}, tutorial35364: {answers: {...}} },
    user2: { tutorial35363: {answers: {...}}, tutorial35364: {answers: {...}} },
  }
}

// Masalahnya:
// - User 1 buka tutorial A → load SEMUA data user (lambat!)
// - Ganti tutorial → harus reload entire object
// - Risiko data corruption kalau 2 tab edit key yang sama
```

**Solusi**: Key terpisah per user + tutorial
```typescript
// ✅ BAGUS: Keys yang terisolasi
localStorage: {
  "learncheck-user1-tutorial35363": {answers: {...}, progress: 2},
  "learncheck-user1-tutorial35364": {answers: {...}, progress: 0},
  "learncheck-user2-tutorial35363": {answers: {...}, progress: 1},
}

// Keuntungannya:
// - Loading cepat (hanya load data yang dibutuhkan)
// - Gak ada cross-contamination antar quiz
// - Separation of concerns yang bersih
```

### 🤔 Limitasi Zustand

Kita butuh **isolate quiz state per user DAN per tutorial**:

```typescript
// User 1, Tutorial A → localStorage key: "learncheck-1-35363"
// User 1, Tutorial B → localStorage key: "learncheck-1-35364"
// User 2, Tutorial A → localStorage key: "learncheck-2-35363"
```

**Masalah**: Zustand's `persist` middleware gak bisa akses dynamic state dalam function `getStorage()`!

```typescript
// ❌ GAK JALAN - get() tidak tersedia di getStorage()
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

**Solusi**: Proxy storage pattern! 🎉

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

### Step-by-step: Cara membuat `useQuizStore.ts`

1. Buat file dan import dependencies

```ts
// frontend/src/store/useQuizStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question } from '../types';
```

Kenapa: Import ini kasih kamu store builder (`create`), persistence middleware (`persist`) dan JSON storage wrapper jadi bisa plug dynamic storage proxy kita.

2. Define state dan actions types

```ts
type QuizState = { questions: Question[]; currentQuestionIndex: number; selectedAnswers: Record<string,string>; submittedAnswers: Record<string,boolean>; quizOver: boolean; revealAnswers: boolean; storageKey: string; };
type QuizActions = { setQuestions: (q: Question[]) => void; selectAnswer: (qid: string, optId: string) => void; submitAnswer: (qid: string) => void; nextQuestion: () => void; finishQuiz: () => void; reset: () => void; initialize: (userId: string, tutorialId: string) => void; };
```

Kenapa: Explicit types bikin store predictable dan enable IDE autocomplete. `initialize` penting karena storage key dynamic per user+tutorial.

3. Implement `dynamicStorage` proxy

```ts
// dynamicStorage provide getItem/setItem/removeItem tapi delegate ke store.get() saat ini
const dynamicStorage = { _get: (() => ({})) as () => QuizState & QuizActions, getItem(name){ const s = dynamicStorage._get(); return localStorage.getItem(s.storageKey || name); }, setItem(name, value){ const s = dynamicStorage._get(); localStorage.setItem(s.storageKey || name, value); }, removeItem(name){ const s = dynamicStorage._get(); localStorage.removeItem(s.storageKey || name); } };
```

Kenapa: Zustand's `persist` gak bisa akses store `get` saat initialization; proxy kasih store untuk set `get` sendiri ke proxy jadi storage methods bisa resolve dynamic key saat runtime.

4. Buat store dengan `persist(...)`

```ts
export const useQuizStore = create<QuizState & QuizActions>()(
  persist((set, get) => { dynamicStorage._get = get; return { /* initial state + actions */ } }, { name: 'quiz-storage', storage: createJSONStorage(() => dynamicStorage), partialize: state => ({ currentQuestionIndex: state.currentQuestionIndex, selectedAnswers: state.selectedAnswers, submittedAnswers: state.submittedAnswers, quizOver: state.quizOver }) })
);
```

Kenapa: Kita wire `dynamicStorage._get = get;` jadi proxy bisa cari `storageKey`. `partialize` control apa yang di-persist (kita gak persist ephemeral flags kayak `revealAnswers`).

5. Key actions yang harus diimplementasikan (apa yang dilakukan)

- `initialize(userId, tutorialId)` — compute `learncheck-${userId}-${tutorialId}`; kalau beda dari `storageKey` sekarang, load saved state dari `localStorage` dan set, kalau enggak ya no-op. Jamin isolasi per-user-per-tutorial.
- `setQuestions(questions)` — set array questions dan reset quiz progress flags (fresh start).
- `selectAnswer(questionId, optionId)` — record selected answer kecuali sudah submitted.
- `submitAnswer(questionId)` — mark question sebagai submitted (dipakai untuk prevent ubah jawaban setelah submit).
- `nextQuestion()` — advance `currentQuestionIndex`; set `quizOver` kalau sudah sampai akhir.
- `finishQuiz()` — mark `quizOver = true`.
- `reset()` — clear progress tapi keep `storageKey`.

Kenapa: List tanggung jawab ini bantu implementor tahu harus code apa dan kenapa.

6. Detail persistence

- Store pakai `createJSONStorage(() => dynamicStorage)` jadi persisted data ditulis/dibaca pakai `storageKey` saat ini.
- Saat `initialize`, kita manual load saved state dari localStorage untuk key baru dan merge ke current state untuk avoid kehilangan progress saat switch user atau tutorial.

Kenapa: Ini jamin persisted state milik user+tutorial yang benar dan avoid konflik.

7. Testing store

- Manual test: buka frontend, panggil `useQuizStore.getState().initialize('1','35363')` di console dan inspect localStorage key `learncheck-1-35363`.
- Ide unit test: mock `localStorage`, panggil actions berurutan (setQuestions → selectAnswer → submitAnswer → nextQuestion) dan assert bentuk state.

---

Sekarang store sudah jelas, selanjutnya kita jelasin bagaimana `useQuizData` konsumsi store dan dimana buat hook-nya.


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

### 3. Initialize Method (Penting!)

```typescript
initialize: (userId, tutorialId) => {
  const key = `learncheck-${userId}-${tutorialId}`;
  
  // Load persisted state dari localStorage
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

**Alur**:
1. Generate storage key: `learncheck-1-35363`
2. Cek localStorage untuk key itu
3. Kalau ada → parse dan load saved progress
4. Kalau enggak → pakai defaults
5. Set state `storageKey` → proxy pakai ini untuk saves selanjutnya

### 4. Partialize (Apa yang Di-Persist)

```typescript
partialize: (state) => ({
  currentQuestionIndex: state.currentQuestionIndex,
  selectedAnswers: state.selectedAnswers,
  submittedAnswers: state.submittedAnswers,
  quizOver: state.quizOver,
}),
```

**Yang Di-Persist**:
- ✅ `currentQuestionIndex`: Resume dari question yang sama
- ✅ `selectedAnswers`: Jawaban user tersimpan
- ✅ `submittedAnswers`: Question mana yang sudah submit
- ✅ `quizOver`: Quiz selesai atau belum

**TIDAK Di-Persist**:
- ❌ `questions`: Load fresh dari API (bisa berubah)
- ❌ `revealAnswers`: UI state, gak penting
- ❌ `storageKey`: Meta, bukan quiz progress

### 5. Penjelasan State Actions

#### setQuestions

```typescript
setQuestions: (questions) => set({ 
  questions,
  quizOver: false,  // ← PENTING: Reset quiz state
  revealAnswers: false,
})
```

**Kenapa reset `quizOver`?**

Tanpa ini, kalau user klik "Try Again" setelah finish quiz, quiz langsung ke results screen (karena `quizOver: true` masih persist).

#### selectAnswer

```typescript
selectAnswer: (questionId, optionId) => {
  if (get().submittedAnswers[questionId]) return; // ← Prevent ubah setelah submit
  set((state) => ({
    selectedAnswers: {
      ...state.selectedAnswers,
      [questionId]: optionId,
    },
  }));
}
```

**Immutable update**: Spread operator untuk create object baru (React re-render detection).

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
    // ⚠️ KEEP storageKey! Jangan reset user/tutorial context
  });
}
```

**Dipakai untuk**: Tombol "Coba Lagi" (clear progress tapi keep context).

## Penggunaan di Components

### Initialize Store (App.tsx)

```typescript
const App = () => {
  const initialize = useQuizStore(state => state.initialize);
  
  useEffect(() => {
    if (userId && tutorialId) {
      initialize(userId, tutorialId); // ← PENTING: Panggil sebelum quiz dimulai!
    }
  }, [userId, tutorialId, initialize]);
  
  // ... rest of component
};
```

**WAJIB dipanggil sebelum quiz dimulai!** Tanpa ini, storage key = default `'quiz-storage'`, semua user share progress! 😱

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

**Zustand magic**: Hanya `QuestionComponent` yang re-render saat `selectedAnswers` berubah. Components lain gak terpengaruh!

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

### Test 1: Resume Quiz Setelah Refresh

1. Mulai quiz: `http://localhost:5173/?tutorial_id=35363&user_id=1`
2. Jawab Question 1
3. Refresh page (F5)
4. **Yang diharapkan**: Quiz resume di Question 1 dengan answer tersimpan

### Test 2: Multiple Users

1. User 1: `?tutorial_id=35363&user_id=1`
   - Jawab question 1 → Option A
2. User 2: `?tutorial_id=35363&user_id=2`
   - Jawab question 1 → Option B
3. Balik ke User 1: `?tutorial_id=35363&user_id=1`
   - **Yang diharapkan**: Masih tampil Option A selected

### Test 3: Multiple Tutorials

1. Tutorial A: `?tutorial_id=35363&user_id=1`
   - Progress ke question 2
2. Tutorial B: `?tutorial_id=99999&user_id=1`
   - Mulai dari question 1
3. Balik ke Tutorial A: `?tutorial_id=35363&user_id=1`
   - **Yang diharapkan**: Resume di question 2

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

### Selector Pattern (Prevent Re-render yang Gak Perlu)

```typescript
// ❌ JELEK - Component re-render pada SETIAP state change
const Quiz = () => {
  const store = useQuizStore(); // ALL state
  return <div>{store.currentQuestionIndex}</div>;
};

// ✅ BAGUS - Hanya re-render saat currentQuestionIndex berubah
const Quiz = () => {
  const currentQuestionIndex = useQuizStore(state => state.currentQuestionIndex);
  return <div>{currentQuestionIndex}</div>;
};
```

### Multiple Selectors

```typescript
const Quiz = () => {
  // Setiap selector independently track changes
  const questions = useQuizStore(state => state.questions);
  const currentIndex = useQuizStore(state => state.currentQuestionIndex);
  const nextQuestion = useQuizStore(state => state.nextQuestion);
  
  // Re-render hanya saat questions ATAU currentIndex berubah
  // nextQuestion function stable, gak cause re-render
};
```

## Masalah Umum

### Issue 1: State tidak persist

**Penyebab**: `initialize()` tidak dipanggil

**Solusi**: Cek `useEffect` di App.tsx panggil `initialize(userId, tutorialId)`

### Issue 2: Shared state antar user

**Penyebab**: `storageKey` yang sama untuk semua user

**Solusi**: Pastikan `initialize()` create unique key: `learncheck-${userId}-${tutorialId}`

### Issue 3: Data lama dari tutorial berbeda

**Penyebab**: `initialize()` tidak dipanggil saat params berubah

**Solusi**: Tambah userId dan tutorialId ke useEffect deps:
```typescript
useEffect(() => {
  initialize(userId, tutorialId);
}, [userId, tutorialId, initialize]); // ← Deps di sini!
```

### Issue 4: Quiz langsung selesai

**Penyebab**: `quizOver: true` persist, gak di-reset pada quiz baru

**Solusi**: `setQuestions()` harus reset `quizOver: false`

## Ringkasan Arsitektur

```
User navigasi ke URL dengan tutorial_id & user_id
    ↓
App.tsx panggil initialize(userId, tutorialId)
    ↓
Zustand store:
  - Set storageKey = "learncheck-{userId}-{tutorialId}"
  - Load saved state dari localStorage[storageKey]
  - Restore currentQuestionIndex, selectedAnswers, dll.
    ↓
User interaksi dengan quiz (select, submit, next)
    ↓
Zustand actions update state
    ↓
Persist middleware auto save ke localStorage[storageKey]
    ↓
User refresh page → State restored dari localStorage
```

## Best Practices

### 1. Selalu Initialize Sebelum Dipakai

```typescript
// ✅ Initialize dulu
initialize(userId, tutorialId);
setQuestions(questions);

// ❌ Jangan pakai store sebelum initialize
setQuestions(questions); // Wrong storage key!
initialize(userId, tutorialId);
```

### 2. Reset State pada Quiz Baru

```typescript
const handleStartQuiz = () => {
  reset(); // ← Clear progress lama
  setQuizStarted(true);
  generateQuiz();
};
```

### 3. Keep storageKey Immutable Selama Quiz

```typescript
// ❌ JANGAN ubah storageKey mid-quiz
initialize(newUserId, newTutorialId); // Progress hilang!

// ✅ Finish quiz dulu, baru navigate
finishQuiz();
window.location.href = `?tutorial_id=${newId}&user_id=${userId}`;
```

## Kesimpulan

Zustand store kita sekarang punya:
- ✅ Dynamic localStorage keys (per user per tutorial)
- ✅ Automatic state persistence
- ✅ Resume quiz setelah refresh
- ✅ Isolated state (gak ada cross-user contamination)
- ✅ Performance optimized (selector pattern)
- ✅ Type-safe (TypeScript interfaces)

**Inovasi**: Storage proxy pattern untuk solve limitasi Zustand dengan dynamic keys!

## Next Steps

State management selesai! Sekarang kita implement **real-time preference updates** dari Dicoding classroom.

Lanjut ke [Real-time Preferences dengan postMessage](./06-realtime.md) →
