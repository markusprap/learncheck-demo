
import React from 'react';
import { useQuizStore } from '../../store/useQuizStore';
import QuestionComponent from './Question';
import Results from './Results';
import Button from '../../components/ui/Button';

const Quiz: React.FC = () => {
  const { questions, currentQuestionIndex, quizOver, nextQuestion, selectedAnswers } = useQuizStore();

  if (quizOver) {
    return <Results />;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswerSelected = selectedAnswers.hasOwnProperty(currentQuestion?.id);

  if (!currentQuestion) {
    return <div className="text-center p-8">No questions available.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        Question {currentQuestionIndex + 1} of {questions.length}
      </div>
      <QuestionComponent question={currentQuestion} />
      <div className="flex justify-center mt-6">
        <Button onClick={nextQuestion} disabled={!isAnswerSelected}>
          {currentQuestionIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
        </Button>
      </div>
    </div>
  );
};

export default Quiz;
