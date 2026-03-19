// ============================================================
// Base Agent — Abstract Foundation for All Agent Types
// ============================================================
// Every agent (DCA, Stream, Commerce) extends this class.
// It provides the common lifecycle, event system, and safety
// enforcement that all agents share.
//
// The lifecycle state machine:
//   idle ──start()──► running ──pause()──► paused
//                        │                   │
//                    stop()             resume()──► running
//                        │                   │
//                        ▼              stop()──► stopped
//                     stopped
//                        ▲
//                   error ──stop()──┘
//
// Key design principle: agents are event-driven.
// Instead of returning values, they emit events. The server
// subscribes to these events and forwards them to the dashboard
// via WebSocket. This decouples agents from the transport layer.
// ============================================================

import { EventEmitter } from "node:events";
import {
  type AgentConfig,
  type AgentState,
  type AgentStatus,
  type AgentEvent,
  type FiberPayment,
  now,
  generateId,
} from "@fiber-agent-pay/core";
import { FiberClient, FiberChannelManager, FiberPaymentManager } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { SafetyGuard, type SafetyLimits } from "./safety.js";

/**
 * Typed event emitter for agent events.
 *
 * Why extend EventEmitter instead of using a custom pub/sub?
 * Node's EventEmitter is battle-tested, supports multiple listeners,
 * and integrates naturally with async/await patterns. No need to
 * reinvent this wheel.
 */
export interface AgentEvents {
  event: [AgentEvent];
  stateChange: [AgentState];
}

export abstract class BaseAgent extends EventEmitter {
  protected status: AgentStatus = "idle";
  protected channelId?: string;
  protected totalSpent: bigint = 0n;
  protected paymentCount: number = 0;
  protected lastPaymentAt?: number;
  protected error?: string;
  protected createdAt: number;
  protected updatedAt: number;

  // Infrastructure — injected so agents don't create their own connections
  protected fiberClient: FiberClient;
  protected channelManager: FiberChannelManager;
  protected paymentManager: FiberPaymentManager;
  protected wallet: Wallet;
  protected safety: SafetyGuard;

  // Abort controller for graceful shutdown
  protected abortController: AbortController;

  constructor(
    public readonly config: AgentConfig,
    fiberClient: FiberClient,
    wallet: Wallet,
    safetyLimits?: Partial<SafetyLimits>,
  ) {
    super();
    this.createdAt = now();
    this.updatedAt = now();

    this.fiberClient = fiberClient;
    this.channelManager = new FiberChannelManager(fiberClient);
    this.paymentManager = new FiberPaymentManager(fiberClient);
    this.wallet = wallet;

    // Each agent gets its own safety guard with its configured limits
    this.safety = new SafetyGuard({
      maxPerTx: safetyLimits?.maxPerTx ?? config.maxPerTx,
      maxPerHour: safetyLimits?.maxPerHour ?? config.maxPerHour,
      maxTotal: safetyLimits?.maxTotal ?? config.maxTotal,
    });

    this.abortController = new AbortController();
  }

  /** Whether the Fiber node is reachable */
  protected fiberConnected = false;
  /** Our Fiber node's public key (for self-invoices) */
  protected nodePublicKey?: string;

  /**
   * Start the agent. This:
   *   1. Checks Fiber connectivity
   *   2. Optionally sets up a payment channel
   *   3. Changes status to "running"
   *   4. Calls the subclass's execute() method
   *   5. Catches errors and transitions to "error" status
   */
  async start(): Promise<void> {
    if (this.status === "running") return;
    if (this.status === "stopped") {
      throw new Error("Cannot restart a stopped agent. Create a new one.");
    }

    // Check Fiber connectivity before starting
    try {
      this.fiberConnected = await this.fiberClient.isConnected();
      if (this.fiberConnected) {
        const nodeInfo = await this.channelManager.getNodeInfo();
        this.nodePublicKey = nodeInfo.node_id;
        console.log(`[Agent ${this.config.id}] Fiber connected — node: ${this.nodePublicKey?.slice(0, 16)}...`);
      } else {
        console.log(`[Agent ${this.config.id}] Fiber not available — running in simulation mode`);
      }
    } catch {
      console.log(`[Agent ${this.config.id}] Fiber check failed — running in simulation mode`);
      this.fiberConnected = false;
    }

    // Set up channel if peer is configured and Fiber is available
    if (this.fiberConnected && this.config.peerId) {
      try {
        await this.setupChannel();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Agent ${this.config.id}] Channel setup failed: ${msg} — continuing without channel`);
      }
    }

    this.setStatus("running");
    this.emitEvent({ type: "agent:started", agentId: this.config.id, timestamp: now() });

    try {
      await this.execute();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error = message;
      this.setStatus("error");
      this.emitEvent({
        type: "agent:error",
        agentId: this.config.id,
        error: message,
        timestamp: now(),
      });
    }
  }

  /**
   * Set up a Fiber payment channel with the configured peer.
   *
   * Flow:
   *   1. Connect to peer via multiaddr
   *   2. Open channel with configured funding amount
   *   3. Wait for channel to reach CHANNEL_READY state
   */
  private async setupChannel(): Promise<void> {
    if (!this.config.peerId) return;

    console.log(`[Agent ${this.config.id}] Connecting to peer: ${this.config.peerId.slice(0, 30)}...`);
    await this.channelManager.connectPeer(this.config.peerId);

    console.log(`[Agent ${this.config.id}] Opening channel with ${this.config.channelFunding} shannons...`);
    const fundingHex = "0x" + this.config.channelFunding.toString(16);
    const result = await this.channelManager.openChannel(
      this.config.peerId,
      fundingHex,
    );

    console.log(`[Agent ${this.config.id}] Channel opening: ${result.temporary_channel_id}`);
    const channel = await this.channelManager.waitForChannelReady(
      result.temporary_channel_id,
      120_000, // 2 min timeout for testnet
    );
    this.channelId = channel.channel_id;
    console.log(`[Agent ${this.config.id}] Channel ready: ${this.channelId}`);
  }

  /** Pause the agent (can be resumed) */
  pause(): void {
    if (this.status !== "running") return;
    this.setStatus("paused");
    this.emitEvent({ type: "agent:paused", agentId: this.config.id, timestamp: now() });
  }

  /** Resume a paused agent */
  resume(): void {
    if (this.status !== "paused") return;
    this.setStatus("running");
    this.emitEvent({ type: "agent:started", agentId: this.config.id, timestamp: now() });
  }

  /** Stop the agent permanently */
  async stop(): Promise<void> {
    this.abortController.abort();
    this.setStatus("stopped");
    this.emitEvent({ type: "agent:stopped", agentId: this.config.id, timestamp: now() });
  }

  /**
   * The core strategy logic — implemented by each agent type.
   *
   * This is where DCA schedules purchases, Stream sends
   * micropayments, and Commerce handles marketplace interactions.
   *
   * The method should respect:
   *   - this.abortController.signal (for graceful shutdown)
   *   - this.status (pause when "paused")
   *   - this.safety.check() (before every payment)
   */
  protected abstract execute(): Promise<void>;

  /**
   * Safely execute a payment with safety checks.
   *
   * All agents call this instead of paymentManager directly.
   * This ensures every payment goes through the safety guard.
   *
   * @param invoice - Fiber invoice to pay
   * @param amount - Amount in shannons (for safety check)
   * @returns The payment result, or null if blocked by safety
   */
  protected async safePayment(
    invoice: string,
    amount: bigint,
  ): Promise<FiberPayment | null> {
    const check = this.safety.check(amount);

    if (!check.allowed) {
      this.emitEvent({
        type: "safety:limit_reached",
        agentId: this.config.id,
        limitType: check.limitType!,
        timestamp: now(),
      });
      this.pause();
      return null;
    }

    const result = await this.paymentManager.sendPayment(invoice);

    if (result.status === "Success" || result.status === "Created") {
      this.safety.recordPayment(amount);
      this.totalSpent += amount;
      this.paymentCount++;
      this.lastPaymentAt = now();

      const payment: FiberPayment = {
        id: generateId(),
        agentId: this.config.id,
        channelId: this.channelId ?? "",
        amount,
        paymentHash: result.payment_hash,
        status: result.status === "Success" ? "completed" : "pending",
        direction: "outbound",
        timestamp: now(),
      };

      this.emitEvent({
        type: "payment:sent",
        agentId: this.config.id,
        payment,
        timestamp: now(),
      });

      return payment;
    }

    return null;
  }

  /** Get the current state snapshot for API/dashboard */
  getState(): AgentState {
    return {
      config: this.config,
      status: this.status,
      channelId: this.channelId,
      totalSpent: this.totalSpent,
      paymentCount: this.paymentCount,
      lastPaymentAt: this.lastPaymentAt,
      error: this.error,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Helper to wait while respecting abort signal and pause state */
  protected async waitInterval(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), ms);

      this.abortController.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve(false);
      }, { once: true });
    });
  }

  /** Helper to check if agent should continue running */
  protected shouldContinue(): boolean {
    return this.status === "running" && !this.abortController.signal.aborted;
  }

  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.updatedAt = now();
    this.emit("stateChange", this.getState());
  }

  protected emitEvent(event: AgentEvent): void {
    this.emit("event", event);
  }
}
