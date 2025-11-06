import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';
import { useQuizStore } from '../store/useQuizStore';
import { QUIZ_CONFIG, API_ENDPOINTS } from '../config/constants';

/**
 * Custom hook for fetching and managing quiz data with real-time preference updates
 * @param tutorialId - Tutorial identifier
 * @param userId - User identifier
 * @returns Quiz data, preferences, loading states, and quiz generation function
 */
const useQuizData = (tutorialId: string | null, userId: string | null) => {
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState<boolean>(true);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  
  // Get quiz state to prevent refetch during quiz
  const questions = useQuizStore(state => state.questions);

  // Fetch user preferences with cache busting
  const fetchPreferences = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setIsLoadingPreferences(false);
      return;
    }
    
    // CRITICAL: Don't refetch during quiz to prevent state reset
    if (questions.length > 0) {
      console.log('[LearnCheck] Skipping preference fetch - quiz in progress');
      return;
    }

    // Debounce: Prevent rapid-fire requests
    const now = Date.now();
    if (!forceRefresh && now - lastFetchRef.current < QUIZ_CONFIG.DEBOUNCE_MS) {
      console.log('[LearnCheck] Debouncing preference fetch...');
      return;
    }

    lastFetchRef.current = now;
    setIsLoadingPreferences(true);
    setError(null);
    
    try {
      // Add timestamp to prevent caching
      const response = await api.get(API_ENDPOINTS.PREFERENCES, {
        params: { 
          user_id: userId,
          _t: Date.now() // Cache buster
        },
      });
      
      const newPrefs = response.data.userPreferences;
      
      // Check if preferences actually changed
      const prefsChanged = JSON.stringify(userPreferences) !== JSON.stringify(newPrefs);
      
      if (prefsChanged) {
        console.log('[LearnCheck] Preferences updated:', newPrefs);
        setUserPreferences(newPrefs);
      } else {
        console.log('[LearnCheck] Preferences unchanged');
      }
      
    } catch (err: any) {
      console.error('[LearnCheck] Failed to fetch preferences:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load preferences');
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [userId, userPreferences, questions.length]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences(true);
  }, [userId]); // Only depend on userId, not fetchPreferences

  // Listen for messages from parent window (Dicoding Classroom)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Verify origin if needed
      // if (event.origin !== 'https://dicoding.com') return;
      
      if (event.data?.type === 'preference-updated') {
        console.log('[LearnCheck] Received preference update from parent');
        
        // Clear existing timeout
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        
        // Immediate refetch (give backend time to save)
        fetchTimeoutRef.current = setTimeout(() => {
          fetchPreferences(true);
        }, QUIZ_CONFIG.POSTMESSAGE_DELAY_MS);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchPreferences]);

  // Optional: Refresh preferences when window regains focus
  // (only if not during quiz)
  useEffect(() => {
    const handleFocus = () => {
      // Only fetch on focus if not generating quiz and no quiz loaded
      if (!isGeneratingQuiz && questions.length === 0) {
        console.log('[LearnCheck] Window focused - refreshing preferences');
        fetchPreferences(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPreferences, isGeneratingQuiz, questions.length]);

  /**
   * Generate quiz with AI
   * @param isRetry - If true, skip cache and generate fresh questions
   */
  const generateQuiz = useCallback(async (isRetry: boolean = false) => {
    if (!tutorialId || !userId) {
      setError('Missing tutorial_id or user_id');
      return;
    }

    setIsGeneratingQuiz(true);
    setError(null);
    
    try {
      const response = await api.get(API_ENDPOINTS.ASSESSMENT, {
        params: { 
          tutorial_id: tutorialId, 
          user_id: userId,
          ...(isRetry && { fresh: 'true' }) // Add fresh=true for retry attempts
        },
      });
      setAssessmentData(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to generate quiz';
      console.error('[LearnCheck] Quiz generation error:', errorMessage);
      setError(errorMessage);
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
    refetchPreferences: () => fetchPreferences(true) // Expose manual refetch
  };
};

export default useQuizData;
