
import React from 'react';
import { useQuizStore } from '../../store/useQuizStore';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { CheckCircle2, XCircle } from 'lucide-react';

const Results: React.FC = () => {
  const { questions, selectedAnswers, reset } = useQuizStore();

  const score = questions.reduce((acc, question) => {
    return selectedAnswers[question.id] === question.correctOptionId ? acc + 1 : acc;
  }, 0);

  const percentage = Math.round((score / questions.length) * 100);

  return (
    <div className="space-y-8">
      <Card className="p-6 text-center">
        <h1 className="text-3xl font-bold mb-2">Quiz Complete!</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">Your Score</p>
        <p className="text-6xl font-bold my-4">{percentage}%</p>
        <p className="text-slate-600 dark:text-slate-400">You answered {score} out of {questions.length} questions correctly.</p>
      </Card>
      
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Review Your Answers</h2>
        {questions.map((question) => {
          const userAnswerId = selectedAnswers[question.id];
          const isCorrect = userAnswerId === question.correctOptionId;
          const correctOption = question.options.find(opt => opt.id === question.correctOptionId);
          const userAnswer = question.options.find(opt => opt.id === userAnswerId);

          return (
            <Card key={question.id} className="p-6">
                <h3 className="font-bold text-lg mb-2">{question.questionText}</h3>
                <div className={`flex items-start p-3 rounded-md mb-3 ${isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                    {isCorrect ? <CheckCircle2 className="text-green-600 dark:text-green-400 mt-1 mr-3 flex-shrink-0" /> : <XCircle className="text-red-600 dark:text-red-400 mt-1 mr-3 flex-shrink-0" />}
                    <div>
                        <p className="font-semibold">{isCorrect ? 'Correct!' : 'Incorrect'}</p>
                        <p className="text-sm">Your answer: {userAnswer?.text || 'Not answered'}</p>
                        {!isCorrect && <p className="text-sm">Correct answer: {correctOption?.text}</p>}
                    </div>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-md">
                    <p className="font-semibold text-sm">Explanation</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{question.explanation}</p>
                </div>
            </Card>
          )
        })}
      </div>

      <div className="text-center mt-8">
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
};

export default Results;
