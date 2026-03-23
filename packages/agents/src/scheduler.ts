// ============================================================
// Agent Scheduler
// ============================================================
// Manages the lifecycle of all agent instances in the system.
//
// Each agent gets its own wallet (unique private key + CKB address).
// The main wallet funds agent wallets on startup. Agents then
// transact with each other using real on-chain CKB transfers.
//
// This creates a genuine agent economy:
//   earn → spend → reinvest → repeat
// ============================================================

import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
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

/** Amount to fund each agent wallet on start (500 CKB) */
const AGENT_FUNDING_AMOUNT = 50_000_000_000n;

export class AgentScheduler extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private agentWallets: Map<string, Wallet> = new Map();
  private fiberClient: FiberClient;
  private mainWallet: Wallet;

  /**
   * @param fiberClient - Shared Fiber connection for all agents
   * @param mainWallet - The funded main wallet used to seed agent wallets
   */
  constructor(fiberClient: FiberClient, mainWallet: Wallet) {
    super();
    this.fiberClient = fiberClient;
    this.mainWallet = mainWallet;
  }

  /**
   * Create and register a new agent with its own wallet.
   *
   * Each agent gets a unique private key and CKB address.
   * This enables real inter-agent payments where CKB flows
   * between different addresses on-chain.
   */
  async createAgent(config: AgentConfig): Promise<BaseAgent> {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent with ID ${config.id} already exists`);
    }

    // Generate a unique wallet for this agent
    const agentPrivateKey = "0x" + randomBytes(32).toString("hex");
    const agentWallet = new Wallet(agentPrivateKey);
    await agentWallet.init();
    this.agentWallets.set(config.id, agentWallet);

    console.log(`[Scheduler] Agent ${config.id.slice(0, 8)} wallet: ${agentWallet.address}`);

    let agent: BaseAgent;

    switch (config.type) {
      case "dca":
        agent = new DCAAgent(
          config as DCAAgentConfig,
          this.fiberClient,
          agentWallet,
        );
        break;
      case "stream":
        agent = new StreamAgent(
          config as StreamAgentConfig,
          this.fiberClient,
          agentWallet,
        );
        break;
      case "commerce":
        agent = new CommerceAgent(
          config as CommerceAgentConfig,
          this.fiberClient,
          agentWallet,
        );
        break;
      default:
        throw new Error(`Unknown agent type: ${(config as AgentConfig).type}`);
    }

    // Forward agent events to the scheduler's listeners
    agent.on("event", (event: AgentEvent) => {
      this.emit("agentEvent", event);
    });

    agent.on("stateChange", (_state: AgentState) => {
      this.emit("agentStateChange", _state);
    });

    this.agents.set(config.id, agent);

    // Emit a state change so WebSocket sends a fresh snapshot
    this.emit("agentStateChange", agent.getState());

    return agent;
  }

  /**
   * Fund an agent's wallet from the main wallet.
   *
   * Transfers CKB from the main wallet to the agent's unique address.
   * This creates a real on-chain transaction — the agent then has
   * its own funds to spend in the economy.
   */
  async fundAgent(id: string): Promise<string | null> {
    const agentWallet = this.agentWallets.get(id);
    if (!agentWallet) throw new Error(`No wallet for agent ${id}`);

    try {
      const txHash = await this.mainWallet.transfer(
        agentWallet.address,
        AGENT_FUNDING_AMOUNT,
      );
      console.log(
        `[Scheduler] Funded agent ${id.slice(0, 8)} with 500 CKB → tx: ${txHash}`,
      );
      return txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scheduler] Failed to fund agent ${id.slice(0, 8)}: ${msg}`);
      return null;
    }
  }

  /** Get an agent by ID */
  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /** Get all agents' current states */
  getAllStates(): AgentState[] {
    return Array.from(this.agents.values()).map((a) => a.getState());
  }

  /**
   * Start an agent: fund its wallet, then begin execution.
   *
   * The funding transaction needs time to confirm (~10s on testnet).
   * We fire-and-forget the funding — the agent starts immediately
   * and its first on-chain payment will wait for the funding to land.
   */
  async startAgent(id: string): Promise<void> {
    const agent = this.getAgentOrThrow(id);

    // Fund the agent's wallet from main wallet (fire-and-forget)
    // The CKB tx takes ~10s to confirm. The agent starts immediately
    // but its first on-chain transfer will use the funded cells.
    this.fundAgent(id).then(async () => {
      // Refresh the agent's balance after funding lands
      // Wait a bit for the tx to propagate
      await new Promise((r) => setTimeout(r, 15_000));
      await agent.refreshBalance();
      this.emit("agentStateChange", agent.getState());
    }).catch(() => {
      // Funding failed — agent runs but may not have on-chain funds
    });

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
      this.agentWallets.delete(id);
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
