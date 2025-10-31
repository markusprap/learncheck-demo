
import { Router } from 'express';
import assessmentRouter from './assessment.routes';

const router = Router();

router.use('/assessment', assessmentRouter);

export default router;
