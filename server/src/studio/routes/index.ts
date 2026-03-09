import { Router } from 'express';
import runsRouter from './runs.js';
import eventsRouter from './events.js';
import schedulesRouter from './schedules.js';
import memoryRouter from './memory.js';
import { getStudioBootstrap } from '../service.js';

const router = Router();

// Bootstrap endpoint
router.get('/studio/bootstrap', (_req, res) => {
  res.json(getStudioBootstrap());
});

// Modular routes
router.use('/studio/runs', runsRouter);
router.use('/studio/runs/:id/events', eventsRouter);
router.use('/studio/schedules', schedulesRouter);
router.use('/studio/memory', memoryRouter);

export default router;
