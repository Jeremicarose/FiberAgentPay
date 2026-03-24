// ============================================================
// Streaming Payments Agent
// ============================================================
// Sends continuous micropayment streams — like paying per second
// for a service. This is where Fiber's sub-cent payment
// capability truly shines.
//
// Real-world use cases:
//   - Pay-per-second for cloud compute ("I used 47.3 seconds")
//   - Streaming payments for API access (pay as you query)
//   - Metered data feeds (pay per data point received)
//   - Subscription replacement (stream $5/month as $0.00019/second)
//
// How it differs from DCA:
//   - DCA buys at intervals with a fixed budget strategy
//   - Streaming pays continuously for an ongoing service
//   - DCA has a target number of purchases
//   - Streaming runs until stopped or budget exhausted
//
// The tick rate controls granularity:
//   tickIntervalMs=1000 + amountPerTick=1000n → 1000 shannons/sec
//   tickIntervalMs=100  + amountPerTick=100n  → 1000 shannons/sec
//   Same rate, but finer granularity = fairer for short sessions
// ============================================================

import {
  type StreamAgentConfig,
  now,
  sleep,
  formatCkb,
} from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { BaseAgent } from "./base-agent.js";
import type { SafetyLimits } from "./safety.js";

export class StreamAgent extends BaseAgent {
  declare config: StreamAgentConfig;
  private tickCount: number = 0;
  private streamStartedAt?: number;

  constructor(
    config: StreamAgentConfig,
    fiberClient: FiberClient,
    wallet: Wallet,
    safetyLimits?: Partial<SafetyLimits>,
  ) {
    super(config, fiberClient, wallet, safetyLimits);
  }

  /**
   * Core streaming execution loop.
   *
   * Each "tick" sends a micropayment through the Fiber channel.
   * The tight loop with small amounts simulates continuous
   * payment streaming.
   *
   * Performance consideration:
   * At tickIntervalMs=100 (10 payments/sec), this is 36,000
   * payments/hour. Fiber handles this easily since payments
   * are off-chain state updates — just signature exchanges
   * between channel peers. No blockchain congestion.
   */
  protected async execute(): Promise<void> {
    this.streamStartedAt = now();

    console.log(
      `[Stream Agent ${this.config.id}] Starting stream — ` +
      `${formatCkb(this.config.amountPerTick)} every ${this.config.tickIntervalMs}ms ` +
      `to ${this.config.recipient}`,
    );

    while (this.shouldContinue()) {
      // Respect pause state
      while (this.status === "paused") {
        await sleep(1000);
        if (this.abortController.signal.aborted) return;
      }

      // Send one tick payment
      try {
        const payment = await this.safePayment(
          `Stream tick #${this.tickCount + 1} to ${this.config.recipient}`,
          this.config.amountPerTick,
          this.config.recipient || undefined,
        );

        if (payment) {
          this.tickCount++;

          // Log every 100 ticks to avoid console spam
          if (this.tickCount % 100 === 0) {
            const elapsed = now() - this.streamStartedAt!;
            const rate = Number(this.totalSpent) / (elapsed / 1000);
            console.log(
              `[Stream Agent ${this.config.id}] ` +
              `${this.tickCount} ticks, ${formatCkb(this.totalSpent)} total, ` +
              `${rate.toFixed(2)} shannons/sec`,
            );
          }
        } else {
          // Safety limit hit — agent paused automatically
          console.log(
            `[Stream Agent ${this.config.id}] Stream paused by safety limits.`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Stream Agent ${this.config.id}] Tick error: ${message}`);
        this.emitEvent({
          type: "agent:error",
          agentId: this.config.id,
          error: message,
          timestamp: now(),
        });
        // Brief backoff on error before retrying
        await sleep(Math.min(this.config.tickIntervalMs * 5, 5000));
      }

      // Wait for next tick
      const shouldProceed = await this.waitInterval(this.config.tickIntervalMs);
      if (!shouldProceed) break;
    }

    const totalDuration = now() - this.streamStartedAt!;
    console.log(
      `[Stream Agent ${this.config.id}] Stream ended — ` +
      `${this.tickCount} ticks over ${(totalDuration / 1000).toFixed(1)}s, ` +
      `${formatCkb(this.totalSpent)} total`,
    );
  }

  /** Get streaming-specific metrics */
  getStreamMetrics() {
    const elapsed = this.streamStartedAt ? now() - this.streamStartedAt : 0;
    return {
      tickCount: this.tickCount,
      elapsedMs: elapsed,
      averageRate:
        elapsed > 0
          ? Number(this.totalSpent) / (elapsed / 1000)
          : 0,
      ...this.getState(),
    };
  }
}
