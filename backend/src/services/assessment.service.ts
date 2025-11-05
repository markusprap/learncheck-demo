import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';
import { getCachedQuizData, cacheQuizData, isRateLimited } from './redis.service';
import { ERROR_MESSAGES } from '../config/constants';
import type { AssessmentResponse, UserPreferences } from '../types';

/**
 * Fetch or generate assessment data for a tutorial
 * @param tutorialId - Tutorial identifier
 * @param userId - User identifier
 * @param skipCache - If true, bypass cache and generate fresh quiz
 * @returns Assessment with user preferences and cache status
 * @throws Error if rate limit exceeded or generation fails
 */
export const fetchAssessmentData = async (
  tutorialId: string,
  userId: string,
  skipCache: boolean = false
): Promise<AssessmentResponse> => {
  // Check rate limit
  const rateLimited = await isRateLimited(userId);
  if (rateLimited) {
    throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
  }

  // Try cache first (unless skipCache is true for retries)
  if (!skipCache) {
    const cachedQuiz = await getCachedQuizData(tutorialId);
    if (cachedQuiz) {
      console.log(`[Cache] Using cached quiz for tutorial ${tutorialId}`);
      const userPreferences = await getUserPreferences(userId);
      
      return {
        assessment: cachedQuiz,
        userPreferences,
        fromCache: true,
      };
    }
  } else {
    console.log(`[Cache] Skipping cache for fresh quiz (retry attempt)`);
  }

  // Generate fresh quiz
  const [tutorialHtml, userPreferences] = await Promise.all([
    getTutorialContent(tutorialId),
    getUserPreferences(userId),
  ]);

  const textContent = parseHtmlContent(tutorialHtml);
  
  console.log(`[Gemini] Generating fresh quiz for tutorial ${tutorialId}`);
  const assessment = await generateAssessmentQuestions(textContent);

  // Cache for next time (fire and forget) - only if not a retry
  if (!skipCache) {
    cacheQuizData(tutorialId, assessment).catch(err => 
      console.error('[Cache] Failed to cache quiz data:', err)
    );
  }

  return {
    assessment,
    userPreferences,
    fromCache: false,
  };
};

/**
 * Fetch fresh user preferences (not cached for real-time updates)
 * @param userId - User identifier
 * @returns User preferences object
 */
export const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  console.log(`[Preferences] Fetching fresh preferences for user ${userId}`);
  return await getUserPreferences(userId);
};
