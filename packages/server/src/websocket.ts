// ============================================================
// WebSocket Server for Real-Time Events
// ============================================================
// The dashboard needs live updates — agent status changes,
// payment events, safety warnings. Polling the REST API would
// be wasteful and laggy. WebSocket gives us push-based
// real-time delivery.
//
// Architecture:
//   Agent emits event → Scheduler forwards → WS server broadcasts
//   → All connected dashboards receive instantly
//
// Why a separate WS server instead of upgrading Hono?
// Hono's Node adapter doesn't natively support WebSocket upgrade.
// Running ws on a separate port is simpler and more reliable.
// The dashboard connects to both the HTTP API and WS server.
// ============================================================

import { WebSocketServer, WebSocket } from "ws";
import { type AgentEvent, jsonStringify, WS_PORT } from "@fiber-agent-pay/core";
import { AgentScheduler } from "@fiber-agent-pay/agents";

export function createWebSocketServer(scheduler: AgentScheduler): WebSocketServer {
  const wss = new WebSocketServer({ port: WS_PORT });

  console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);

  // Track connected clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`Dashboard connected (${clients.size} clients)`);

    // Send current state snapshot on connect
    // This lets the dashboard hydrate immediately without
    // waiting for the next event
    const snapshot = {
      type: "snapshot",
      agents: scheduler.getAllStates(),
      timestamp: Date.now(),
    };
    ws.send(jsonStringify(snapshot));

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`Dashboard disconnected (${clients.size} clients)`);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
      clients.delete(ws);
    });
  });

  /**
   * Broadcast an event to all connected dashboards.
   *
   * Uses readyState check to avoid sending to closing/closed sockets.
   * Dead sockets are cleaned up on the next "close" event.
   */
  function broadcast(data: unknown): void {
    const message = jsonStringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // Forward all agent events to connected dashboards
  scheduler.on("agentEvent", (event: AgentEvent) => {
    broadcast(event);
  });

  scheduler.on("agentStateChange", () => {
    // Send full state snapshot on any change
    // This is slightly wasteful (could send just the delta)
    // but ensures the dashboard is always in sync
    broadcast({
      type: "snapshot",
      agents: scheduler.getAllStates(),
      timestamp: Date.now(),
    });
  });

  return wss;
}
