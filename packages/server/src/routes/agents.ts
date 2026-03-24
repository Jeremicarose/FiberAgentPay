// ============================================================
// Agent API Routes
// ============================================================
// REST endpoints for creating, managing, and monitoring agents.
// These are the main interface between the dashboard and the
// agent framework.
//
// Endpoints:
//   POST   /agents          — Create a new agent
//   GET    /agents          — List all agents with their states
//   GET    /agents/:id      — Get a specific agent's state
//   POST   /agents/:id/start  — Start an agent
//   POST   /agents/:id/stop   — Stop an agent
//   POST   /agents/:id/pause  — Pause an agent
//   POST   /agents/:id/resume — Resume a paused agent
//   DELETE /agents/:id      — Remove a stopped agent
// ============================================================

import { Hono } from "hono";
import {
  type AgentConfig,
  type DCAAgentConfig,
  type StreamAgentConfig,
  type CommerceAgentConfig,
  generateId,
  DEFAULT_SAFETY_LIMITS,
  DEFAULT_CHANNEL_FUNDING,
  jsonStringify,
} from "@fiber-agent-pay/core";
import { AgentScheduler } from "@fiber-agent-pay/agents";

/**
 * Create agent routes bound to a scheduler instance.
 *
 * Why a factory function instead of direct route definitions?
 * The routes need a reference to the scheduler (dependency injection).
 * A factory function accepts the scheduler and returns configured routes.
 * This keeps routes testable — pass a mock scheduler in tests.
 */
export function createAgentRoutes(scheduler: AgentScheduler): Hono {
  const app = new Hono();

  /**
   * POST /agents — Create a new agent
   *
   * Accepts a JSON body with the agent type and configuration.
   * Returns the created agent's initial state.
   *
   * The request body shape depends on the agent type:
   *   { type: "dca", amountPerInterval: "1000000", intervalMs: 10000, ... }
   *   { type: "stream", amountPerTick: "1000", tickIntervalMs: 1000, ... }
   *   { type: "commerce", offeredServices: [...], desiredServices: [...], ... }
   */
  app.post("/", async (c) => {
    const body = await c.req.json();
    const id = generateId();

    // Build the full config with defaults for fields not provided
    let config: AgentConfig;

    switch (body.type) {
      case "dca":
        config = {
          id,
          name: body.name ?? `DCA Agent ${id.slice(0, 8)}`,
          type: "dca",
          maxPerTx: BigInt(body.maxPerTx ?? DEFAULT_SAFETY_LIMITS.maxPerTx),
          maxPerHour: BigInt(body.maxPerHour ?? DEFAULT_SAFETY_LIMITS.maxPerHour),
          maxTotal: BigInt(body.maxTotal ?? DEFAULT_SAFETY_LIMITS.maxTotal),
          peerId: body.peerId ?? "",
          channelFunding: BigInt(body.channelFunding ?? DEFAULT_CHANNEL_FUNDING),
          amountPerInterval: BigInt(body.amountPerInterval),
          intervalMs: body.intervalMs ?? 10000,
          totalPurchases: body.totalPurchases ?? 0,
          recipientAddress: body.recipientAddress ?? "",
          udtTypeScriptHash: body.udtTypeScriptHash,
        } satisfies DCAAgentConfig;
        break;

      case "stream":
        config = {
          id,
          name: body.name ?? `Stream Agent ${id.slice(0, 8)}`,
          type: "stream",
          maxPerTx: BigInt(body.maxPerTx ?? DEFAULT_SAFETY_LIMITS.maxPerTx),
          maxPerHour: BigInt(body.maxPerHour ?? DEFAULT_SAFETY_LIMITS.maxPerHour),
          maxTotal: BigInt(body.maxTotal ?? DEFAULT_SAFETY_LIMITS.maxTotal),
          peerId: body.peerId ?? "",
          channelFunding: BigInt(body.channelFunding ?? DEFAULT_CHANNEL_FUNDING),
          amountPerTick: BigInt(body.amountPerTick),
          tickIntervalMs: body.tickIntervalMs ?? 1000,
          recipient: body.recipient ?? "",
          description: body.description,
        } satisfies StreamAgentConfig;
        break;

      case "commerce":
        config = {
          id,
          name: body.name ?? `Commerce Agent ${id.slice(0, 8)}`,
          type: "commerce",
          maxPerTx: BigInt(body.maxPerTx ?? DEFAULT_SAFETY_LIMITS.maxPerTx),
          maxPerHour: BigInt(body.maxPerHour ?? DEFAULT_SAFETY_LIMITS.maxPerHour),
          maxTotal: BigInt(body.maxTotal ?? DEFAULT_SAFETY_LIMITS.maxTotal),
          peerId: body.peerId ?? "",
          channelFunding: BigInt(body.channelFunding ?? DEFAULT_CHANNEL_FUNDING),
          offeredServices: body.offeredServices ?? [],
          desiredServices: body.desiredServices ?? [],
          maxPricePerRequest: BigInt(body.maxPricePerRequest ?? "1000000"),
          useAINegotiation: body.useAINegotiation ?? false,
          reinvestPercent: body.reinvestPercent ?? 80,
        } satisfies CommerceAgentConfig;
        break;

      default:
        return c.json({ success: false, error: `Unknown agent type: ${body.type}` }, 400);
    }

    const agent = await scheduler.createAgent(config);
    const state = agent.getState();

    return c.text(jsonStringify({ success: true, data: state, timestamp: Date.now() }), 201, {
      "Content-Type": "application/json",
    });
  });

  /** GET /agents — List all agents */
  app.get("/", (c) => {
    const states = scheduler.getAllStates();
    return c.text(jsonStringify({ success: true, data: states, timestamp: Date.now() }), 200, {
      "Content-Type": "application/json",
    });
  });

  /** GET /agents/:id — Get specific agent state */
  app.get("/:id", (c) => {
    const agent = scheduler.getAgent(c.req.param("id"));
    if (!agent) {
      return c.json({ success: false, error: "Agent not found" }, 404);
    }
    return c.text(jsonStringify({ success: true, data: agent.getState(), timestamp: Date.now() }), 200, {
      "Content-Type": "application/json",
    });
  });

  /** POST /agents/:id/start */
  app.post("/:id/start", async (c) => {
    try {
      await scheduler.startAgent(c.req.param("id"));
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 400);
    }
  });

  /** POST /agents/:id/stop */
  app.post("/:id/stop", async (c) => {
    try {
      await scheduler.stopAgent(c.req.param("id"));
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 400);
    }
  });

  /** POST /agents/:id/pause */
  app.post("/:id/pause", (c) => {
    try {
      scheduler.pauseAgent(c.req.param("id"));
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 400);
    }
  });

  /** POST /agents/:id/resume */
  app.post("/:id/resume", (c) => {
    try {
      scheduler.resumeAgent(c.req.param("id"));
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 400);
    }
  });

  /** DELETE /agents/:id — Remove a stopped agent */
  app.delete("/:id", (c) => {
    try {
      scheduler.removeAgent(c.req.param("id"));
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 400);
    }
  });

  return app;
}
