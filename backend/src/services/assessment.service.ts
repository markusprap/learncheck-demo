
import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';
import { 
  getCachedQuizData, 
  cacheQuizData,
  isRateLimited 
} from './redis.service';

export const fetchAssessmentData = async (tutorialId: string, userId: string) => {
  // Check rate limit (max 5 quiz generations per minute per user)
  const rateLimited = await isRateLimited(userId, 5, 60);
  if (rateLimited) {
    throw new Error('Rate limit exceeded. Please wait a moment before generating another quiz.');
  }

  // Try to get cached quiz data first
  const cachedQuiz = await getCachedQuizData(tutorialId);
  if (cachedQuiz) {
    console.log(`[Cache] Using cached quiz for tutorial ${tutorialId}`);
    
    // Still fetch fresh user preferences (they change more often)
    const userPreferences = await getUserPreferences(userId);
    
    return {
      assessment: cachedQuiz,
      userPreferences,
      fromCache: true,
    };
  }

  // Fetch in parallel
  const [tutorialHtml, userPreferences] = await Promise.all([
    getTutorialContent(tutorialId),
    getUserPreferences(userId),
  ]);

  // Parse HTML to get clean text
  const textContent = parseHtmlContent(tutorialHtml);
  
  // Generate questions using Gemini API
  console.log(`[Gemini] Generating fresh quiz for tutorial ${tutorialId}`);
  const assessment = await generateAssessmentQuestions(textContent);

  // Cache the generated quiz (fire and forget)
  cacheQuizData(tutorialId, assessment).catch(err => 
    console.error('[Cache] Failed to cache quiz data:', err)
  );

  return {
    assessment,
    userPreferences,
    fromCache: false,
  };
};

export const fetchUserPreferences = async (userId: string) => {
  // IMPORTANT: Don't cache user preferences!
  // Preferences change frequently (real-time user interactions)
  // and API call is fast (~200ms), so always fetch fresh data
  console.log(`[Preferences] Fetching fresh preferences for user ${userId}`);
  return await getUserPreferences(userId);
};
