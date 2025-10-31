
import React, { useEffect } from 'react';
import { UserPreferences } from '../../types';

interface QuizContainerProps {
  preferences: UserPreferences;
  children: React.ReactNode;
}

const QuizContainer: React.FC<QuizContainerProps> = ({ preferences, children }) => {
  
  // Apply theme class to HTML element for dark mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  // Apply dynamic styles based on preferences
  const containerClasses: string[] = ['min-h-screen p-4 sm:p-6 lg:p-8 text-slate-900 dark:text-slate-50 transition-colors duration-300'];

  switch (preferences.fontSize) {
    case 'small':
      containerClasses.push('text-sm');
      break;
    case 'large':
      containerClasses.push('text-lg');
      break;
    default:
      containerClasses.push('text-base');
  }

  switch (preferences.fontStyle) {
    case 'serif':
      containerClasses.push('font-serif');
      break;
    case 'mono':
      containerClasses.push('font-mono');
      break;
    default:
      // default font is sans-serif via tailwind base styles
      break;
  }
  
  const contentWidthClass = preferences.layoutWidth === 'fullWidth' ? 'max-w-full' : 'max-w-4xl';

  return (
    <div className={containerClasses.join(' ')}>
        <div className={`mx-auto ${contentWidthClass}`}>
            {children}
        </div>
    </div>
  );
};

export default QuizContainer;
