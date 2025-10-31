// --- IMPORTS ---
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
// FIX: Use GoogleGenAI from @google/genai and import Type for schema
import { GoogleGenAI, Type } from "@google/genai";
import * as cheerio from 'cheerio';


// --- TYPES ---
interface UserPreferences {
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
    layoutWidth: 'standard' | 'fullWidth';
    fontStyle: 'default' | 'serif' | 'mono';
}
  
interface Option {
    id: string;
    text: string;
}

interface Question {
    id:string;
    questionText: string;
    options: Option[];
    correctOptionId: string;
    explanation: string;
}
  
// This interface is adjusted for the new data fetching logic
interface QuizData {
    userPreferences: UserPreferences;
    assessment?: {
      questions: Question[];
    };
}

// --- ZUSTAND STORE ---
type QuizState = {
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswers: { [questionId: string]: string };
  submittedAnswers: { [questionId: string]: boolean };
  quizOver: boolean;
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

const dynamicStorage = {
  _get: (() => ({})) as () => QuizState & QuizActions,
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

const useQuizStore = create<QuizState & QuizActions>()(
  persist(
    (set, get) => {
      dynamicStorage._get = get;
      
      return {
        questions: [],
        currentQuestionIndex: 0,
        selectedAnswers: {},
        submittedAnswers: {},
        quizOver: false,
        storageKey: 'quiz-storage',
        initialize: (userId, tutorialId) => {
          const key = `learncheck-${userId}-${tutorialId}`;
          if (get().storageKey === key) return;
          
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
            currentQuestionIndex: 0,
            selectedAnswers: {},
            submittedAnswers: {},
            quizOver: false,
            ...savedState,
          });
        },
        setQuestions: (questions) => set((state) => {
            // Always update questions, even if they exist, for refetch functionality
            return { questions };
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
          set({
            currentQuestionIndex: 0,
            selectedAnswers: {},
            submittedAnswers: {},
            quizOver: false,
            questions: [], // Also clear questions to indicate a full reset
          });
        },
      }
    },
    {
      name: 'quiz-storage',
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


// --- CUSTOM HOOK ---

// --- "BACKEND" LOGIC MOVED TO FRONTEND FOR LIVE PREVIEW ---

const getTutorialContent = async (tutorialId: string): Promise<string> => {
  console.log(`Fetching MOCK tutorial content for ID: ${tutorialId}`);
  // This is a mock response, as there's no live Dicoding API in this environment.
  return Promise.resolve(`
    <html>
      <head><title>Tutorial Mockup</title></head>
      <body>
        <h1>Pengenalan React Hooks</h1>
        <p>React Hooks adalah fungsi yang memungkinkan Anda untuk "mengaitkan" state dan fitur siklus hidup React dari komponen fungsional. Fitur ini diperkenalkan di React 16.8.</p>
        <h2>useState</h2>
        <p>Hooks yang paling sering digunakan adalah useState dan useEffect. useState memungkinkan Anda menambahkan state ke komponen fungsional, yang sebelumnya hanya bisa dilakukan di komponen kelas. useEffect memungkinkan Anda melakukan efek samping (side effects) di komponen fungsional, seperti pengambilan data, langganan (subscriptions), atau mengubah DOM secara manual.</p>
        <p>Sebagai contoh, untuk mendeklarasikan variabel state bernama 'jumlah' yang diinisialisasi ke 0, Anda akan menulis: const [jumlah, setJumlah] = useState(0);. Ini mengembalikan sepasang nilai: state saat ini dan fungsi untuk memperbaruinya.</p>
        <h2>useEffect</h2>
        <p>useEffect digunakan untuk sinkronisasi dengan sistem eksternal. Ini bisa berupa pengambilan data, mengatur langganan, atau mengubah DOM secara manual dari komponen React. Menempatkan useEffect di dalam komponen memungkinkan kita mengakses variabel state atau prop apa pun langsung dari efek tersebut.</p>
      </body>
    </html>
  `);
};

const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
  console.log(`Fetching MOCK user preferences for ID: ${userId}`);
   // This is a mock response.
  return Promise.resolve({
    theme: 'dark',
    fontSize: 'large',
    layoutWidth: 'fullWidth',
    fontStyle: 'default',
  });
};

const parseHtmlContent = (html: string): string => {
  const $ = cheerio.load(html);
  const text = $('body').text();
  return text.replace(/\s\s+/g, ' ').trim();
};


const generateAssessmentQuestions = async (textContent: string) => {
  // FIX: Use GoogleGenAI from @google/genai
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});
  
  // FIX: Use Type enum for schema definition
  const assessmentSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "Sebuah array berisi 3 pertanyaan pilihan ganda.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "ID unik untuk pertanyaan, contoh: 'q1'." },
                    questionText: { type: Type.STRING, description: "Teks pertanyaan." },
                    options: {
                        type: Type.ARRAY,
                        description: "Sebuah array berisi 4 pilihan jawaban.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "ID unik untuk pilihan, contoh: 'opt1'." },
                                text: { type: Type.STRING, description: "Teks jawaban." }
                            },
                            required: ["id", "text"]
                        }
                    },
                    correctOptionId: { type: Type.STRING, description: "ID dari pilihan jawaban yang benar." },
                    explanation: { type: Type.STRING, description: "Penjelasan netral yang fokus pada konsep, menjelaskan mengapa jawaban benar dan yang lain salah. Harus diakhiri dengan 'Hint:' diikuti petunjuk." }
                },
                required: ["id", "questionText", "options", "correctOptionId", "explanation"]
            }
        }
    },
    required: ["questions"]
  };

  const prompt = `
    Berdasarkan konten berikut, buatkan 3 pertanyaan pilihan ganda dalam Bahasa Indonesia untuk menguji pemahaman.
    Setiap pertanyaan harus memiliki 4 pilihan jawaban.
    Untuk setiap pertanyaan, sertakan teks pertanyaan, 4 pilihan jawaban (masing-masing dengan ID unik seperti 'opt1', 'opt2', dst.), ID dari pilihan yang benar, dan sebuah penjelasan.
    
    Penting: Ikuti aturan ini saat membuat penjelasan:
    - Mulai penjelasan secara langsung tanpa kalimat pembuka yang bersifat menilai seperti "Tepat sekali!" atau "Kurang tepat.". Penjelasan harus fokus pada konsepnya.
    - Jelaskan mengapa jawaban yang benar itu benar dan mengapa pilihan-pilihan lain salah, merujuk ke konsep inti dari materi.
    - Jaga agar penjelasan singkat (maksimal 3 kalimat).
    - Setelah penjelasan utama, tambahkan "Hint:" diikuti dengan satu kalimat rekomendasi untuk mempelajari kembali topik spesifik yang relevan dengan pertanyaan ini. Contoh: "Untuk lebih paham, coba pelajari lagi materi tentang state di React."
    - Tulis dalam Bahasa Indonesia yang kasual namun profesional.
    
    Gunakan gaya bahasa yang santai dan mudah dimengerti untuk seluruh soal.

    Konten:
    ---
    ${textContent}
    ---
  `;

  try {
    // FIX: Use ai.models.generateContent instead of getGenerativeModel
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: assessmentSchema,
        },
    });

    // FIX: Access response text via .text property
    const jsonText = response.text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating assessment from Gemini:", error);
    throw new Error("Gagal membuat soal-soal dari AI.");
  }
};


const useQuizData = (tutorialId: string | null, userId: string | null, enabled: boolean) => {
  const [data, setData] = useState<QuizData | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefetchIndex(prevIndex => prevIndex + 1);
  }, []);

  // Fetch preferences on initial mount
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const fetchPreferences = async () => {
      setError(null);
      try {
        const userPreferences = await getUserPreferences(userId);
        if (isMounted) {
          setData({ userPreferences });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Gagal memuat preferensi pengguna.');
        }
      }
    };

    fetchPreferences();
    return () => { isMounted = false; };
  }, [userId, refetchIndex]);

  // Fetch assessment only when enabled (quiz started)
  useEffect(() => {
    if (!tutorialId || !userId || !enabled) {
      setIsAssessmentLoading(false);
      return;
    }

    let isMounted = true;
    const fetchAssessment = async () => {
      setIsAssessmentLoading(true);
      setError(null);
      try {
        const tutorialHtml = await getTutorialContent(tutorialId);
        const textContent = parseHtmlContent(tutorialHtml);
        const assessment = await generateAssessmentQuestions(textContent);
        if (isMounted) {
          setData(prevData => prevData ? { ...prevData, assessment } : null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Gagal membuat soal-soal.');
        }
      } finally {
        if (isMounted) {
          setIsAssessmentLoading(false);
        }
      }
    };

    fetchAssessment();
    return () => { isMounted = false; };
  }, [tutorialId, userId, refetchIndex, enabled]);

  return { data, isLoading: isAssessmentLoading, error, refetch };
};

// --- UI COMPONENTS ---
const Loader: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-slate-500">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
const Card: React.FC<CardProps> = ({ className, ...props }) => (
    <div className={twMerge('rounded-xl border bg-white text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50', className)} {...props} />
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}
const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'default', ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800';
  
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-50 dark:hover:text-slate-50 data-[state=open]:bg-transparent dark:data-[state=open]:bg-transparent',
  };

  const sizes = {
      default: 'h-10 py-2 px-4',
      sm: 'h-9 px-3 rounded-md',
      lg: 'h-11 px-8 rounded-md text-base'
  }

  return <button className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))} {...props} />;
};

const ProgressBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div
          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
};


// --- LAYOUT COMPONENT ---
interface QuizContainerProps {
  preferences: UserPreferences;
  children: React.ReactNode;
}
const QuizContainer: React.FC<QuizContainerProps> = ({ preferences, children }) => {
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);
  
  const containerClasses: string[] = ['min-h-screen p-4 sm:p-6 lg:p-8 text-slate-900 dark:text-slate-50 transition-colors duration-300'];
  if (preferences.fontSize === 'small') containerClasses.push('text-sm');
  else if (preferences.fontSize === 'large') containerClasses.push('text-lg');
  else containerClasses.push('text-base');

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

// --- FEATURE COMPONENTS ---
interface ResultsProps {
    onTryAgain: () => void;
    onGoToIntro: () => void;
}
const Results: React.FC<ResultsProps> = ({ onTryAgain, onGoToIntro }) => {
  const { questions, selectedAnswers } = useQuizStore();

  const score = React.useMemo(() => questions.reduce((acc, question) => {
    return selectedAnswers[question.id] === question.correctOptionId ? acc + 1 : acc;
  }, 0), [questions, selectedAnswers]);

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const { title, subtitle } = useMemo(() => {
    if (percentage === 100) {
      return {
        title: "Luar Biasa! Pemahaman Sempurna!",
        subtitle: "Kamu benar-benar menguasai materi ini. Terus pertahankan semangat belajarmu yang membara!"
      };
    }
    if (percentage >= 80) {
      return {
        title: "Kerja Bagus! Kamu di Jalur yang Tepat!",
        subtitle: "Pemahamanmu sudah sangat solid. Tinggal sedikit lagi polesan untuk jadi master!"
      };
    }
    if (percentage >= 50) {
      return {
        title: "Sudah Cukup Baik! Terus Asah Lagi!",
        subtitle: "Dasar-dasarnya sudah kamu pegang. Coba pelajari lagi bagian yang masih ragu untuk pemahaman yang lebih dalam."
      };
    }
    return {
      title: "Jangan Menyerah, Ini Baru Permulaan!",
      subtitle: "Setiap ahli pernah menjadi pemula. Ini adalah kesempatan emas untuk meninjau kembali materi dan membangun fondasi yang lebih kuat."
    };
  }, [percentage]);

  return (
    <div className="space-y-8 flex flex-col items-center">
      <Card className="p-6 text-center w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">{subtitle}</p>
        <p className="text-lg text-slate-600 dark:text-slate-400">Skor Akhir</p>
        <p className="text-6xl font-bold my-4">{percentage}%</p>
        <p className="text-slate-600 dark:text-slate-400">Kamu menjawab {score} dari {questions.length} soal dengan benar.</p>
      </Card>
      
      <div className="text-center mt-4 flex items-center justify-center gap-x-4">
        <Button onClick={onGoToIntro} variant="secondary">Kembali ke Awal</Button>
        <Button onClick={onTryAgain}>Coba Lagi</Button>
      </div>
    </div>
  );
};

interface QuestionProps {
  question: Question;
}
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

  const handleButtonClick = () => {
      if (!isSubmitted) {
          submitAnswer(question.id);
      } else {
          nextQuestion();
      }
  };

  const getOptionClasses = (option: Option) => {
    let classes = 'p-4 border rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-between text-left';
    const isSelected = selectedOptionId === option.id;

    if (!isSubmitted) {
        classes += ' border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';
        if (isSelected) classes += ' bg-blue-100 dark:bg-blue-900/50 border-blue-500 ring-2 ring-blue-400 dark:ring-blue-600';
    } else {
        const isCorrectOption = option.id === question.correctOptionId;
        if (isCorrectOption) {
            classes += ' bg-green-50 dark:bg-green-900/30 border-green-500';
        } else if (isSelected && !isCorrectOption) {
            classes += ' bg-red-50 dark:bg-red-900/30 border-red-500';
        } else {
            classes += ' border-slate-300 dark:border-slate-700 opacity-60';
        }
    }
    return classes;
  };

  const explanationParts = question.explanation.split('Hint:');
  const mainExplanation = explanationParts[0].trim();
  const hintText = explanationParts.length > 1 ? explanationParts[1].trim() : null;
  
  const correctPrefixes = [
      "Mantap, jawabanmu benar! ",
      "Tepat sekali! ",
      "Keren, kamu paham konsepnya! ",
      "Betul! Lanjutkan momentum belajarmu! ",
      "Luar biasa, pemahamanmu solid! "
  ];
  
  const incorrectPrefixes = [
      "Hampir benar! Coba kita lihat lagi yuk. ",
      "Belum tepat, tapi jangan khawatir, ini bagian dari belajar. ",
      "Oops, masih kurang pas. Yuk kita bedah bareng! ",
      "Sedikit lagi! Coba perhatikan penjelasan berikut. ",
      "Jawabanmu keliru, tapi ini kesempatan bagus untuk belajar. "
  ];

  const feedbackPrefix = useMemo(() => {
    if (!isSubmitted) return '';
    const prefixes = isCorrect ? correctPrefixes : incorrectPrefixes;
    return prefixes[Math.floor(Math.random() * prefixes.length)];
  }, [isSubmitted, isCorrect]);

  const fullExplanation = feedbackPrefix + mainExplanation;

  return (
    <Card className="overflow-hidden">
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
      <div className="p-4 sm:p-6">
        <p className="text-xl md:text-2xl font-bold mb-6">{question.questionText}</p>
        <div className="space-y-4">
          {question.options.map((option) => (
            <div
              key={option.id}
              className={getOptionClasses(option)}
              onClick={() => selectAnswer(question.id, option.id)}
              role="radio"
              aria-checked={selectedOptionId === option.id}
              tabIndex={isSubmitted ? -1 : 0}
            >
              <span>{option.text}</span>
              {isSubmitted && option.id === question.correctOptionId && <CheckCircle2 className="text-green-500" />}
              {isSubmitted && selectedOptionId === option.id && option.id !== question.correctOptionId && <XCircle className="text-red-500" />}
            </div>
          ))}
        </div>
      </div>
      
      {isSubmitted && (
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
           <h4 className="font-bold text-base mb-2">Penjelasan</h4>
           <p className="text-sm text-slate-700 dark:text-slate-300">{fullExplanation}</p>
           {hintText && (
             <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg flex items-start">
                <Lightbulb className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-semibold text-sm text-blue-800 dark:text-blue-200">Hint</h5>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{hintText}</p>
                </div>
             </div>
           )}
        </div>
      )}

      <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/30">
        <Button onClick={handleButtonClick} disabled={!isAnswerSelected}>
          {isSubmitted
            ? (currentQuestionIndex === questions.length - 1 ? 'Lihat Hasil' : 'Soal Berikutnya')
            : 'Kirim Jawaban'}
        </Button>
      </div>
    </Card>
  );
};

interface QuizProps {
    onTryAgain: () => void;
    onGoToIntro: () => void;
}
const Quiz: React.FC<QuizProps> = ({ onTryAgain, onGoToIntro }) => {
  const { questions, currentQuestionIndex, quizOver } = useQuizStore();
  const finishQuiz = useQuizStore(state => state.finishQuiz);
  const [timeLeft, setTimeLeft] = useState(5 * 60);

  useEffect(() => {
    if (quizOver) {
        return;
    }
    if (timeLeft <= 0) {
        finishQuiz();
        return;
    }
    const timerId = setInterval(() => {
        setTimeLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, quizOver, finishQuiz]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  if (quizOver) return <Results onTryAgain={onTryAgain} onGoToIntro={onGoToIntro} />;

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    // This state can be hit during refetch
    return null;
  }
  
  return (
    <div className="space-y-4">
       <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
            <p className="text-slate-700 dark:text-slate-300 font-mono text-base tracking-wider">{formatTime(timeLeft)}</p>
            <p className="text-slate-500 dark:text-slate-400">
                Soal {currentQuestionIndex + 1} dari {questions.length}
            </p>
        </div>
        <ProgressBar value={currentQuestionIndex + 1} max={questions.length} />
      </div>
      <QuestionComponent question={currentQuestion} />
    </div>
  );
};

interface IntroProps {
    onStart: () => void;
}
const Intro: React.FC<IntroProps> = ({ onStart }) => (
    <div className="flex flex-col justify-center items-center h-screen text-center -mt-16">
        <Card className="p-8 max-w-lg">
            <h1 className="text-3xl font-bold mb-2">Siap Uji Pemahamanmu?</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
                Setelah membaca materi, yuk cek seberapa jauh kamu sudah paham. Kuis singkat ini dibuat oleh AI khusus untukmu berdasarkan materi yang baru saja kamu pelajari.
            </p>
            <Button onClick={onStart} size="lg">Mulai Cek Pemahaman!</Button>
        </Card>
    </div>
);


// --- ROOT COMPONENT ---
const App: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  // Add defaults for preview environment
  const tutorialId = urlParams.get('tutorial_id') || 'react-hooks-101';
  const userId = urlParams.get('user_id') || 'user-123';
  
  const [quizStarted, setQuizStarted] = useState(false);
  const { data, isLoading, error, refetch } = useQuizData(tutorialId, userId, quizStarted);

  const initialize = useQuizStore(state => state.initialize);
  const setQuestions = useQuizStore(state => state.setQuestions);
  const reset = useQuizStore(state => state.reset);

  const handleTryAgain = () => {
    reset();
    refetch();
  };
  
  const handleGoToIntro = () => {
    setQuizStarted(false);
    reset();
  };

  useEffect(() => {
    if (userId && tutorialId) {
      initialize(userId, tutorialId);
    }
  }, [userId, tutorialId, initialize]);


  useEffect(() => {
    if (data?.assessment?.questions) {
      setQuestions(data.assessment.questions as Question[]);
    }
  }, [data?.assessment, setQuestions]);

  const quizKey = useMemo(() => `${userId}-${tutorialId}`, [userId, tutorialId]);

  const renderContent = () => {
    if (!quizStarted) {
        return <Intro onStart={() => setQuizStarted(true)} />;
    }
    if (isLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-screen space-y-4 -mt-16">
            <Loader />
            <p className="text-slate-500 dark:text-slate-400 text-center">AI kami sedang berpikir keras! <br/> Soal-soal keren akan segera hadir.</p>
        </div>
      );
    }
    if (error && !data?.assessment) {
      return <div className="text-red-500 p-4 text-center font-bold">Oops, gagal memuat kuis: {error}</div>;
    }
    if (data?.assessment) {
      return <Quiz key={quizKey} onTryAgain={handleTryAgain} onGoToIntro={handleGoToIntro} />;
    }
    if (!tutorialId || !userId) {
        return <div className="text-red-500 p-4 text-center font-bold">Error: `tutorial_id` dan `user_id` wajib ada di URL. Contoh: `?tutorial_id=1&user_id=1`</div>;
    }
    return null;
  };
  
  return (
    <main className="bg-slate-50 dark:bg-slate-900 min-h-screen">
       {data?.userPreferences ? (
        <QuizContainer preferences={data.userPreferences}>
          {renderContent()}
        </QuizContainer>
      ) : error ? (
        <div className="min-h-screen flex items-center justify-center p-4 text-center text-red-500 font-bold">
            Gagal memuat preferensi pengguna: {error}
        </div>
      ) : (
         <div className="min-h-screen flex items-center justify-center">
            <Loader />
         </div>
      )}
    </main>
  );
};

// --- RENDER APP ---
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