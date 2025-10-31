
import React from 'react';
import { useQuizStore } from '../../store/useQuizStore';
import { Question, Option } from '../../types';
import Card from '../../components/ui/Card';
import { CheckCircle2, XCircle } from 'lucide-react';

interface QuestionProps {
  question: Question;
}

const QuestionComponent: React.FC<QuestionProps> = ({ question }) => {
  const { selectedAnswers, selectAnswer, revealAnswers } = useQuizStore();
  const selectedOptionId = selectedAnswers[question.id];

  const getOptionClasses = (option: Option) => {
    let classes = 'p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-between';
    
    const isSelected = selectedOptionId === option.id;

    if (!revealAnswers) {
        // Before revealing answers
        classes += ' border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';
        if (isSelected) {
            classes += ' bg-blue-100 dark:bg-blue-900 border-blue-500';
        }
    } else {
        // After revealing answers
        const isCorrect = option.id === question.correctOptionId;
        if (isCorrect) {
            classes += ' bg-green-100 dark:bg-green-900 border-green-500';
        } else if (isSelected && !isCorrect) {
            classes += ' bg-red-100 dark:bg-red-900 border-red-500';
        } else {
            classes += ' border-slate-300 dark:border-slate-700 opacity-60';
        }
    }
    return classes;
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-6">{question.questionText}</h2>
      <div className="space-y-4">
        {question.options.map((option) => (
          <div
            key={option.id}
            className={getOptionClasses(option)}
            onClick={() => !revealAnswers && selectAnswer(question.id, option.id)}
          >
            <span>{option.text}</span>
            {revealAnswers && option.id === question.correctOptionId && <CheckCircle2 className="text-green-500" />}
            {revealAnswers && selectedOptionId === option.id && option.id !== question.correctOptionId && <XCircle className="text-red-500" />}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default QuestionComponent;
