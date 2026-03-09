/**
 * Memory Routes - Endpunkte für Memory-Verwaltung
 */

import { Router } from 'express';
import { MemoryRepository } from '../../db/repositories/MemoryRepository.js';
import { mapStudioMemory } from '../mappers/index.js';

const router = Router();
const memoryRepository = new MemoryRepository();

// GET /studio/memory/search - Memory durchsuchen
router.get('/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (!query) {
    res.json([]);
    return;
  }
  res.json(memoryRepository.search(query).map(mapStudioMemory));
});

// POST /studio/memory/facts - Fakt erstellen
router.post('/facts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'fact',
    title,
    content,
  })));
});

// POST /studio/memory/decisions - Entscheidung erstellen
router.post('/decisions', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'decision',
    title,
    content,
  })));
});

// POST /studio/memory/artifacts - Artefakt erstellen
router.post('/artifacts', (req, res) => {
  const { title, content, scope } = req.body ?? {};
  res.status(201).json(mapStudioMemory(memoryRepository.create({
    scopeType: 'project',
    scopeId: scope ?? 'default',
    memoryType: 'artifact',
    title,
    content,
  })));
});

export default router;
