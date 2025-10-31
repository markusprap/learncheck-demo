
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question } from '../types';

type QuizState = {
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswers: { [questionId: string]: string };
  quizOver: boolean;
  revealAnswers: boolean; // To control showing correct/incorrect answers per question
  storageKey: string;
};

type QuizActions = {
  setQuestions: (questions: Question[]) => void;
  selectAnswer: (questionId: string, optionId: string) => void;
  nextQuestion: () => void;
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
        quizOver: false,
        revealAnswers: false,
        storageKey: 'quiz-storage',

        initialize: (userId, tutorialId) => {
          const key = `learncheck-${userId}-${tutorialId}`;
          if (get().storageKey === key) {
            return;
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
            quizOver: false,
            ...savedState,
            // Non-persisted state should always be reset
            revealAnswers: false,
          });
        },

        setQuestions: (questions) => set({ 
          // Fix: The original implementation reset progress. This now only sets the questions,
          // preserving progress that might have been loaded by `initialize`.
          questions,
        }),

        selectAnswer: (questionId, optionId) => {
          set((state) => ({
            selectedAnswers: {
              ...state.selectedAnswers,
              [questionId]: optionId,
            },
          }));
        },

        nextQuestion: () => {
          const { currentQuestionIndex, questions } = get();

          // Reveal answers for the current question
          set({ revealAnswers: true });

          // Delay moving to the next question to let user see feedback
          setTimeout(() => {
              if (currentQuestionIndex < questions.length - 1) {
                  set((state) => ({
                    currentQuestionIndex: state.currentQuestionIndex + 1,
                    revealAnswers: false, // Hide feedback for the next question
                  }));
              } else {
                  set({ quizOver: true, revealAnswers: false });
              }
          }, 1200);
        },

        reset: () => {
          // Keep the storageKey, but reset progress.
          set({
            currentQuestionIndex: 0,
            selectedAnswers: {},
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
        quizOver: state.quizOver,
      }),
    }
  )
);
