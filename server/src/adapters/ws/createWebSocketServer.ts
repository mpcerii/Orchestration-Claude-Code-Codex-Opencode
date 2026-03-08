import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { executeTaskFromSocket } from '../../controllers/taskExecution.js';
import { createBroadcaster } from '../../core/events/Broadcaster.js';
import type { RuntimeState } from '../../core/runtime/RuntimeState.js';
import { onStudioEvent } from '../../studio/service.js';

export function createWebSocketServer(server: Server, runtimeState: RuntimeState) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    const broadcaster = createBroadcaster(wss);

    const unsubscribeStudioEvents = onStudioEvent((event) => {
        broadcaster.broadcast({ type: 'studio.event', event });
    });

    wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'studio.connected', connectedAt: new Date().toISOString() }));

        ws.on('message', async (raw) => {
            try {
                const data = JSON.parse(raw.toString()) as { type?: string; taskId?: string };
                await executeTaskFromSocket(data, { runtimeState, broadcaster, ws });
            } catch (error) {
                console.error('Failed to parse websocket message', error);
            }
        });
    });

    return { wss, broadcaster, dispose: unsubscribeStudioEvents };
}
