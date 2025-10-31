
import React, { useEffect, useMemo } from 'react';
import useQuizData from './hooks/useQuizData';
import Quiz from './features/quiz/Quiz';
import QuizContainer from './components/layout/QuizContainer';
import Loader from './components/ui/Loader';
import { useQuizStore } from './store/useQuizStore';
import { Question as QuestionType } from './types';


const App: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorialId = urlParams.get('tutorial_id');
  const userId = urlParams.get('user_id');

  const { data, isLoading, error } = useQuizData(tutorialId, userId);

  const setQuestions = useQuizStore(state => state.setQuestions);
  const initialize = useQuizStore(state => state.initialize);

  // Initialize the store once data is available
  useEffect(() => {
    if (data && userId && tutorialId) {
      initialize(userId, tutorialId);
      setQuestions(data.assessment.questions as QuestionType[]);
    }
  }, [data, userId, tutorialId, setQuestions, initialize]);

  const quizKey = useMemo(() => `${userId}-${tutorialId}`, [userId, tutorialId]);

  const renderContent = () => {
    if (!tutorialId || !userId) {
      return <div className="text-red-500 p-4 text-center font-bold">Error: tutorial_id and user_id are required query parameters.</div>;
    }

    if (isLoading) {
      return <div className="flex justify-center items-center h-screen"><Loader /></div>;
    }

    if (error) {
      return <div className="text-red-500 p-4 text-center font-bold">Error fetching assessment: {error}</div>;
    }

    if (data) {
      return <Quiz key={quizKey} />;
    }

    return null;
  };
  
  return (
    <main className="bg-slate-50 dark:bg-slate-900 min-h-screen">
       {data?.userPreferences ? (
        <QuizContainer preferences={data.userPreferences}>
          {renderContent()}
        </QuizContainer>
      ) : (
        renderContent()
      )}
    </main>
  );
};

export default App;
