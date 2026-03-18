// ============================================================
// WebSocket Hook — Real-Time Updates from Server
// ============================================================
// Connects to the WebSocket server and provides live agent
// state and event data to any component that subscribes.
//
// Why a custom hook instead of a library (socket.io, etc.)?
// Our WebSocket protocol is dead simple — JSON messages with
// a "type" field. No need for rooms, namespaces, or reconnection
// strategies that socket.io provides. The native WebSocket API
// + a reconnect loop is all we need.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";

const WS_URL = "ws://localhost:3002";

interface UseWebSocketResult {
  agents: unknown[];
  events: unknown[];
  connected: boolean;
}

export function useWebSocket(): UseWebSocketResult {
  const [agents, setAgents] = useState<unknown[]>([]);
  const [events, setEvents] = useState<unknown[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data, (_key, value) => {
          if (typeof value === "string" && /^\d+n$/.test(value)) {
            return value; // Keep bigint strings as strings for display
          }
          return value;
        });

        // Handle snapshot messages (full state sync)
        if (data.type === "snapshot") {
          setAgents(data.agents ?? []);
          return;
        }

        // Handle individual events (append to feed)
        setEvents((prev) => [data, ...prev].slice(0, 200));
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("WebSocket disconnected, reconnecting in 3s...");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { agents, events, connected };
}
