
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';

const useQuizData = (tutorialId: string | null, userId: string | null) => {
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState<boolean>(true);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user preferences with cache busting
  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setIsLoadingPreferences(false);
      return;
    }

    setIsLoadingPreferences(true);
    setError(null);
    try {
      // Add timestamp to prevent caching
      const response = await api.get('/preferences', {
        params: { 
          user_id: userId,
          _t: Date.now() // Cache buster
        },
      });
      setUserPreferences(response.data.userPreferences);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load preferences');
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [userId]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Refetch preferences when window regains focus (user switched back from Dicoding settings)
  useEffect(() => {
    const handleFocus = () => {
      console.log('[LearnCheck] Window focused, refetching preferences...');
      fetchPreferences();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchPreferences]);

  // Generate quiz with AI (called when user clicks "Mulai Quiz")
  const generateQuiz = useCallback(async () => {
    if (!tutorialId || !userId) {
      setError('Missing tutorial_id or user_id');
      return;
    }

    setIsGeneratingQuiz(true);
    setError(null);
    try {
      const response = await api.get('/assessment', {
        params: { tutorial_id: tutorialId, user_id: userId },
      });
      setAssessmentData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to generate quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [tutorialId, userId]);

  return { 
    userPreferences, 
    assessmentData, 
    isLoadingPreferences, 
    isGeneratingQuiz, 
    error, 
    generateQuiz,
    refetchPreferences: fetchPreferences // Expose manual refetch
  };
};

export default useQuizData;
