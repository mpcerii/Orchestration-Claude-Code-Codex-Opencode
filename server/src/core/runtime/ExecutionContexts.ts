import type { WebSocket } from 'ws';
import type { Broadcaster } from '../events/Broadcaster.js';
import type { RuntimeState } from './RuntimeState.js';

export interface TaskExecutionContext {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
}

export interface SwarmExecutionContext {
    runtimeState: RuntimeState;
    broadcaster: Broadcaster;
}

export interface TaskSocketExecutionContext extends TaskExecutionContext {
    ws: WebSocket;
}
