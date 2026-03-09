/**
 * Events Routes - Endpunkte für Event-Verwaltung
 */

import { Router } from 'express';
import { RunEventRepository } from '../../db/repositories/RunEventRepository.js';
import { mapStudioEvent } from '../mappers/index.js';

const router = Router({ mergeParams: true });
const runEventRepository = new RunEventRepository();

// GET /studio/runs/:id/events - Events eines Runs abrufen
router.get('/', (req, res) => {
  res.json(runEventRepository.listByRunId(req.params.id).map(mapStudioEvent));
});

export default router;
