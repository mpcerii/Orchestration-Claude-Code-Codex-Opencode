import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsMessage } from '../types';

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const [messages, setMessages] = useState<WsMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        function connect() {
            // Connect directly to the backend WebSocket server
            // In dev: backend runs on 3001; in prod: same host
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
                // Auto-reconnect after 3s
                reconnectRef.current = setTimeout(() => {
                    console.log('[WS] Reconnecting...');
                    connect();
                }, 3000);
            };

            ws.onerror = (err) => {
                console.error('[WS] Error:', err);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WsMessage = JSON.parse(event.data);
                    console.log('[WS] Message:', msg.type, msg.agentName || '');
                    setMessages((prev) => [...prev, msg]);
                } catch (e) {
                    console.error('[WS] Failed to parse:', event.data);
                }
            };
        }

        connect();

        return () => {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, []);

    const send = useCallback((data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const clearMessages = useCallback(() => setMessages([]), []);

    return { messages, connected, send, clearMessages };
}
