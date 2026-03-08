import type { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import type { WsMessage } from '../../types.js';

export type BroadcastPayload = Record<string, unknown>;

export interface Broadcaster {
    broadcast: (payload: BroadcastPayload) => void;
    broadcastLegacy: (message: WsMessage) => void;
}

export function createBroadcaster(wss: WebSocketServer): Broadcaster {
    function broadcast(payload: BroadcastPayload): void {
        const serialized = JSON.stringify(payload);
        for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(serialized);
            }
        }
    }

    function broadcastLegacy(message: WsMessage): void {
        broadcast(message as unknown as Record<string, unknown>);
    }

    return { broadcast, broadcastLegacy };
}
