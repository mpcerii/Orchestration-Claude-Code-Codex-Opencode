import cors from 'cors';
import express from 'express';
import apiRouter from '../routes/api.js';
import studioRouter from '../studio/router.js';

export function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use('/api', apiRouter);
    app.use('/api', studioRouter);

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'ai-swarm-studio', timestamp: new Date().toISOString() });
    });

    return app;
}
