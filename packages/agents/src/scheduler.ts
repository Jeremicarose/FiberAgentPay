// ============================================================
// Agent Scheduler
// ============================================================
// Manages the lifecycle of all agent instances in the system.
// Think of it as the "process manager" for agents — like PM2
// manages Node processes, the scheduler manages agents.
//
// Responsibilities:
//   - Create agents from config (factory pattern)
//   - Track all running/paused/stopped agents
//   - Forward events from agents to the server layer
//   - Provide a unified API for the REST endpoints
//
// Why a central scheduler instead of standalone agents?
// The server needs a single place to query "all agents" and
// their states. Without a scheduler, each route handler would
// need to manage its own agent references.
// ============================================================

import { EventEmitter } from "node:events";
import {
  type AgentConfig,
  type AgentEvent,
  type AgentState,
  type DCAAgentConfig,
  type StreamAgentConfig,
  type CommerceAgentConfig,
} from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { BaseAgent } from "./base-agent.js";
import { DCAAgent } from "./dca-agent.js";
import { StreamAgent } from "./stream-agent.js";
import { CommerceAgent } from "./commerce-agent.js";

export class AgentScheduler extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private fiberClient: FiberClient;
  private wallet: Wallet;

  /**
   * @param fiberClient - Shared Fiber connection for all agents
   * @param wallet - Shared wallet for all agents
   *
   * Why shared connections?
   * All agents use the same Fiber node and wallet. Creating
   * separate connections per agent would waste resources and
   * make it harder to track total spending across agents.
   */
  constructor(fiberClient: FiberClient, wallet: Wallet) {
    super();
    this.fiberClient = fiberClient;
    this.wallet = wallet;
  }

  /**
   * Create and register a new agent from config.
   *
   * Uses a factory pattern — the config's `type` field determines
   * which agent class to instantiate. TypeScript's discriminated
   * union on AgentConfig means each branch gets the correct
   * config type automatically.
   *
   * @param config - Agent configuration (DCA, Stream, or Commerce)
   * @returns The created agent instance
   */
  createAgent(config: AgentConfig): BaseAgent {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent with ID ${config.id} already exists`);
    }

    let agent: BaseAgent;

    switch (config.type) {
      case "dca":
        agent = new DCAAgent(
          config as DCAAgentConfig,
          this.fiberClient,
          this.wallet,
        );
        break;
      case "stream":
        agent = new StreamAgent(
          config as StreamAgentConfig,
          this.fiberClient,
          this.wallet,
        );
        break;
      case "commerce":
        agent = new CommerceAgent(
          config as CommerceAgentConfig,
          this.fiberClient,
          this.wallet,
        );
        break;
      default:
        throw new Error(`Unknown agent type: ${(config as AgentConfig).type}`);
    }

    // Forward agent events to the scheduler's listeners
    // The server subscribes to scheduler events and pushes
    // them to WebSocket clients (the dashboard)
    agent.on("event", (event: AgentEvent) => {
      this.emit("agentEvent", event);
    });

    agent.on("stateChange", (state: AgentState) => {
      this.emit("agentStateChange", state);
    });

    this.agents.set(config.id, agent);

    // Emit a state change so WebSocket sends a fresh snapshot
    // to all connected dashboards immediately
    this.emit("agentStateChange", agent.getState());

    return agent;
  }

  /** Get an agent by ID */
  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /** Get all agents' current states */
  getAllStates(): AgentState[] {
    return Array.from(this.agents.values()).map((a) => a.getState());
  }

  /** Start an agent by ID */
  async startAgent(id: string): Promise<void> {
    const agent = this.getAgentOrThrow(id);
    await agent.start();
  }

  /** Stop an agent by ID */
  async stopAgent(id: string): Promise<void> {
    const agent = this.getAgentOrThrow(id);
    await agent.stop();
  }

  /** Pause an agent by ID */
  pauseAgent(id: string): void {
    const agent = this.getAgentOrThrow(id);
    agent.pause();
  }

  /** Resume an agent by ID */
  resumeAgent(id: string): void {
    const agent = this.getAgentOrThrow(id);
    agent.resume();
  }

  /** Remove a stopped agent from the registry */
  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      const state = agent.getState();
      if (state.status === "running" || state.status === "paused") {
        throw new Error("Cannot remove a running/paused agent. Stop it first.");
      }
      agent.removeAllListeners();
      this.agents.delete(id);
      // Notify dashboards that an agent was removed
      this.emit("agentStateChange", null);
    }
  }

  /** Stop all agents (graceful shutdown) */
  async stopAll(): Promise<void> {
    const running = Array.from(this.agents.values()).filter(
      (a) => a.getState().status === "running" || a.getState().status === "paused",
    );
    await Promise.all(running.map((a) => a.stop()));
  }

  private getAgentOrThrow(id: string): BaseAgent {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    return agent;
  }
}
