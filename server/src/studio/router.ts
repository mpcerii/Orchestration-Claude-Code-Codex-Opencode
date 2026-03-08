import { Router } from 'express';
import {
  cancelRun,
  createMemoryEntry,
  createRun,
  getRun,
  getStudioBootstrap,
  listRunEvents,
  listRuns,
  listSchedules,
  runScheduleNow,
  searchMemory,
  updateSchedule,
} from './service.js';

const router = Router();

router.get('/studio/bootstrap', (_req, res) => {
  res.json(getStudioBootstrap());
});

router.get('/studio/runs', (_req, res) => {
  res.json(listRuns());
});

router.post('/studio/runs', (req, res) => {
  const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';
  if (!goal) {
    res.status(400).json({ error: 'goal is required' });
    return;
  }
  res.status(201).json(createRun(goal));
});

router.get('/studio/runs/:id', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

router.post('/studio/runs/:id/cancel', (req, res) => {
  const run = cancelRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(run);
});

router.get('/studio/runs/:id/events', (req, res) => {
  res.json(listRunEvents(req.params.id));
});

router.get('/studio/schedules', (_req, res) => {
  res.json(listSchedules());
});

router.patch('/studio/schedules/:id', (req, res) => {
  const schedule = updateSchedule(req.params.id, req.body ?? {});
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }
  res.json(schedule);
});

router.post('/studio/schedules/:id/run-now', (req, res) => {
  const schedule = runScheduleNow(req.params.id);
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }
  res.json(schedule);
});

router.get('/studio/memory/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json(query ? searchMemory(query) : []);
});

router.post('/studio/memory/facts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(createMemoryEntry('fact', title, content, scope));
});

router.post('/studio/memory/decisions', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(createMemoryEntry('decision', title, content, scope));
});

router.post('/studio/memory/artifacts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(createMemoryEntry('artifact', title, content, scope));
});

export default router;
