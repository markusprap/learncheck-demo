
import { useState, useEffect } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';

const useQuizData = (tutorialId: string | null, userId: string | null) => {
  const [data, setData] = useState<AssessmentData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tutorialId || !userId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get('/assessment', {
          params: { tutorial_id: tutorialId, user_id: userId },
        });
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tutorialId, userId]);

  return { data, isLoading, error };
};

export default useQuizData;
