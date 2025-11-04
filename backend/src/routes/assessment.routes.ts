
import { Router } from 'express';
import { getAssessment, getUserPrefs } from '../controllers/assessment.controller';

const router = Router();

// GET /api/v1/preferences?user_id=xxx - Get user preferences only
router.get('/preferences', getUserPrefs);

// GET /api/v1/assessment?tutorial_id=xxx&user_id=xxx - Generate assessment with AI
router.get('/assessment', getAssessment);

export default router;
