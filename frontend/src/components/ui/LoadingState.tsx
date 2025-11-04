import React from 'react';
import Loader from './Loader';

const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col justify-center items-center h-screen space-y-4 -mt-16">
      <Loader />
      <div className="text-center space-y-2 max-w-md px-4">
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
          AI kami sedang berpikir keras!
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Soal-soal keren akan segera hadir.
        </p>
      </div>
    </div>
  );
};

export default LoadingState;
