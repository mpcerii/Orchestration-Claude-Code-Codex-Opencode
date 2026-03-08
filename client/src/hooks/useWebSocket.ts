import { useEffect, useRef, useState, useCallback } from 'react';
import type { SocketMessage, WsMessage, StudioEvent } from '../types';

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const [messages, setMessages] = useState<WsMessage[]>([]);
    const [studioEvents, setStudioEvents] = useState<StudioEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const dismountedRef = useRef(false);

    useEffect(() => {
        dismountedRef.current = false;

        function connect() {
            if (dismountedRef.current) return;

            const isDev = window.location.port === '5173' || window.location.port === '5174';
            const wsHost = isDev ? `${window.location.hostname}:3001` : window.location.host;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${wsHost}/ws`;

            console.log(`[WS] Connecting to ${wsUrl}...`);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected ✓');
                setConnected(true);
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected');
                setConnected(false);
                if (!dismountedRef.current) {
                    reconnectRef.current = setTimeout(() => {
                        console.log('[WS] Reconnecting...');
                        connect();
                    }, 3000);
                }
            };

            ws.onerror = (err) => {
                console.error('[WS] Error:', err);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: SocketMessage = JSON.parse(event.data);
                    if (msg.type === 'studio.event') {
                        setStudioEvents((prev) => [...prev, msg.event]);
                        return;
                    }

                    if (msg.type === 'studio.connected') {
                        return;
                    }

                    setMessages((prev) => [...prev, msg]);
                } catch (e) {
                    console.error('[WS] Failed to parse:', event.data);
                }
            };
        }

        connect();

        return () => {
            dismountedRef.current = true;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, []);

    const send = useCallback((data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setStudioEvents([]);
    }, []);

    return { messages, studioEvents, connected, send, clearMessages };
}
