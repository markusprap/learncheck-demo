
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';
import { useQuizStore } from '../store/useQuizStore';

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

    // Debounce: Prevent rapid-fire requests (wait 200ms between fetches)
    const now = Date.now();
    if (!forceRefresh && now - lastFetchRef.current < 200) {
      console.log('[LearnCheck] Debouncing preference fetch...');
      return;
    }

    lastFetchRef.current = now;
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
        
        // Immediate refetch (give backend 300ms to save)
        fetchTimeoutRef.current = setTimeout(() => {
          fetchPreferences(true);
        }, 300);
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

  // Polling: Check for preference updates every 3 seconds when window is focused
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      console.log('[LearnCheck] Starting preference polling...');
      pollInterval = setInterval(() => {
        fetchPreferences();
      }, 500); // Poll every 500ms for near real-time updates
    };

    const stopPolling = () => {
      if (pollInterval) {
        console.log('[LearnCheck] Stopping preference polling');
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const handleFocus = () => {
      console.log('[LearnCheck] Window focused');
      fetchPreferences(true);
      startPolling();
    };

    const handleBlur = () => {
      console.log('[LearnCheck] Window blurred');
      stopPolling();
    };

    // Start polling if window is already focused
    if (document.hasFocus()) {
      startPolling();
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      stopPolling();
    };
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
    refetchPreferences: () => fetchPreferences(true) // Expose manual refetch
  };
};

export default useQuizData;
