
import { Request, Response, NextFunction } from 'express';
import { fetchAssessmentData } from '../services/assessment.service';

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
