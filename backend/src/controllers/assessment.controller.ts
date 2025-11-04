
import { Request, Response, NextFunction } from 'express';
import { fetchAssessmentData } from '../services/assessment.service';
import { getUserPreferences } from '../services/dicoding.service';

// Get user preferences only (for initial load)
export const getUserPrefs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = req.query;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid user_id' });
    }

    const userPreferences = await getUserPreferences(user_id);
    res.status(200).json({ userPreferences });
  } catch (error) {
    next(error);
  }
};

// Generate assessment with AI (triggered when user clicks "Mulai Quiz")
export const getAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tutorial_id, user_id } = req.query;

    if (!tutorial_id || typeof tutorial_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid tutorial_id' });
    }

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid user_id' });
    }

    const assessmentData = await fetchAssessmentData(tutorial_id, user_id);
    res.status(200).json(assessmentData);
  } catch (error) {
    next(error);
  }
};
