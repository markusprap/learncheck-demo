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

interface QuizContainerProps {
  preferences: any;
  children: React.ReactNode;
  isEmbedded?: boolean;
}

const QuizContainer: React.FC<QuizContainerProps> = ({ preferences, children, isEmbedded = false }) => {
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);
  
  const containerClasses: string[] = [
    'text-slate-900 dark:text-slate-50 transition-colors duration-300',
    isEmbedded ? 'min-h-full p-3 sm:p-4' : 'min-h-screen p-4 sm:p-6 lg:p-8'
  ];
  
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

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizOver, finishQuiz]);

  if (quizOver) {
    return <Results onTryAgain={onTryAgain} onGoToIntro={onGoToIntro} />;
  }

  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    return <div className="text-center p-8">No questions available.</div>;
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const isTimeCritical = timeLeft <= 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Pertanyaan {currentQuestionIndex + 1} dari {questions.length}
        </span>
        <span className={clsx('text-sm font-mono', {
          'text-red-600 dark:text-red-400 font-bold': isTimeCritical,
          'text-slate-600 dark:text-slate-400': !isTimeCritical,
        })}>
          ⏱️ {formattedTime}
        </span>
      </div>
      <ProgressBar value={currentQuestionIndex + 1} max={questions.length} />
      <QuestionComponent question={currentQuestion} />
    </div>
  );
};

interface IntroProps {
    onStart: () => void;
    isLoading?: boolean;
}

const Intro: React.FC<IntroProps> = ({ onStart, isLoading = false }) => (
    <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-lg text-center">
            <h1 className="text-3xl font-bold mb-2">Siap Uji Pemahamanmu?</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
                Setelah membaca materi, yuk cek seberapa jauh kamu sudah paham. Kuis singkat ini dibuat oleh AI khusus untukmu berdasarkan materi yang baru saja kamu pelajari.
            </p>
            <div className="flex justify-center">
                <Button onClick={onStart} size="lg" disabled={isLoading}>
                    {isLoading ? 'Memuat...' : 'Mulai Cek Pemahaman!'}
                </Button>
            </div>
        </Card>
    </div>
);

const App: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorialId = urlParams.get('tutorial_id') || urlParams.get('tutorial');
  const userId = urlParams.get('user_id') || urlParams.get('user');
  
  const [quizStarted, setQuizStarted] = useState(false);
  const { 
    userPreferences, 
    assessmentData, 
    isLoadingPreferences, 
    isGeneratingQuiz, 
    error, 
    generateQuiz 
  } = useQuizData(tutorialId, userId);

  const initialize = useQuizStore(state => state.initialize);
  const setQuestions = useQuizStore(state => state.setQuestions);
  const reset = useQuizStore(state => state.reset);

  const handleStartQuiz = async () => {
    setQuizStarted(true);
    await generateQuiz(); // Trigger AI generation when user clicks "Mulai"
  };

  const handleTryAgain = () => {
    reset();
    setQuizStarted(false);
    setTimeout(() => handleStartQuiz(), 100);
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
    if (assessmentData?.assessment?.questions) {
      setQuestions(assessmentData.assessment.questions as Question[]);
    }
  }, [assessmentData?.assessment, setQuestions]);

  const quizKey = useMemo(() => `${userId}-${tutorialId}`, [userId, tutorialId]);

  // Detect if running in iframe (embedded mode)
  const isEmbedded = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // If we can't access top, we're probably in an iframe
    }
  }, []);

  const renderContent = () => {
    // Check for missing required params
    if (!tutorialId || !userId) {
      return (
        <div className="text-red-500 p-4 text-center font-bold space-y-2">
          <p className="text-xl">⚠️ Parameter Tidak Lengkap</p>
          <p className="text-sm font-normal">
            Embed URL harus menyertakan <code className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded">tutorial_id</code> dan <code className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded">user_id</code>
          </p>
          <p className="text-xs font-normal text-slate-600 dark:text-slate-400 mt-4">
            Contoh: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
              ?tutorial_id=35363&user_id=1
            </code>
          </p>
        </div>
      );
    }

    if (!quizStarted) {
        return <Intro onStart={handleStartQuiz} isLoading={isLoadingPreferences} />;
    }
    if (isGeneratingQuiz) {
      return <LoadingState />;
    }
    if (error && !assessmentData?.assessment) {
      return <div className="text-red-500 p-4 text-center font-bold">Oops, gagal memuat kuis: {error}</div>;
    }
    if (assessmentData?.assessment) {
      return <Quiz key={quizKey} onTryAgain={handleTryAgain} onGoToIntro={handleGoToIntro} />;
    }
    return null;
  };
  
  return (
    <main className={isEmbedded ? "bg-slate-50 dark:bg-slate-900 min-h-full" : "bg-slate-50 dark:bg-slate-900 min-h-screen"}>
       {userPreferences ? (
        <QuizContainer preferences={userPreferences} isEmbedded={isEmbedded}>
          {renderContent()}
        </QuizContainer>
      ) : error ? (
        <div className={`${isEmbedded ? 'min-h-full' : 'min-h-screen'} flex items-center justify-center p-4 text-center text-red-500 font-bold`}>
            Gagal memuat preferensi pengguna: {error}
        </div>
      ) : (
         <div className={`${isEmbedded ? 'min-h-full' : 'min-h-screen'} flex items-center justify-center`}>
            <Loader />
         </div>
      )}
    </main>
  );
};

export default App;
