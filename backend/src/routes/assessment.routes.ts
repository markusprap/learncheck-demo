
import { Router } from 'express';
import { getAssessment } from '../controllers/assessment.controller';

const router = Router();

router.get('/', getAssessment);

export default router;
