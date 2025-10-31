
import { getTutorialContent, getUserPreferences } from './dicoding.service';
import { generateAssessmentQuestions } from './gemini.service';
import { parseHtmlContent } from '../utils/htmlParser';

export const fetchAssessmentData = async (tutorialId: string, userId: string) => {
  // Fetch in parallel
  const [tutorialHtml, userPreferences] = await Promise.all([
    getTutorialContent(tutorialId),
    getUserPreferences(userId),
  ]);

  // Parse HTML to get clean text
  const textContent = parseHtmlContent(tutorialHtml);
  
  // Generate questions using Gemini API
  const assessment = await generateAssessmentQuestions(textContent);

  return {
    assessment,
    userPreferences,
  };
};
