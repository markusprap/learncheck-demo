import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';
import type { AssessmentResponse, UserPreferences } from '../types';

/**
 * Fetch or generate assessment data for a tutorial
 * @param tutorialId - Tutorial identifier
 * @param userId - User identifier
 * @param skipCache - If true, bypass cache and generate fresh quiz (parameter kept for API compatibility)
 * @returns Assessment with user preferences
 * @throws Error if generation fails
 */
export const fetchAssessmentData = async (
  tutorialId: string,
  userId: string,
  skipCache: boolean = false
): Promise<AssessmentResponse> => {
  console.log(`[Assessment] Generating quiz for tutorial ${tutorialId}`);

  // Fetch tutorial content and user preferences in parallel
  const [tutorialHtml, userPreferences] = await Promise.all([
    getTutorialContent(tutorialId),
    getUserPreferences(userId),
  ]);

  // Parse HTML to clean text
  const textContent = parseHtmlContent(tutorialHtml);
  
  // Generate quiz with Gemini AI
  console.log(`[Gemini] Generating fresh quiz for tutorial ${tutorialId}`);
  const assessment = await generateAssessmentQuestions(textContent);

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
