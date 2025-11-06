// Load environment variables FIRST (before any imports)
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import mainRouter from './routes';
import { errorHandler } from './utils/errorHandler';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());

// Main Router
app.use('/api/v1', mainRouter);

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('LearnCheck! Backend is healthy.');
});

// Error Handler
app.use(errorHandler);

export default app;
