// ============================================================
// DCA (Dollar-Cost Averaging) Agent
// ============================================================
// Executes periodic fixed-amount purchases via Fiber micropayments.
//
// How DCA works in traditional finance:
//   Buy $100 of BTC every Monday, regardless of price.
//   Over time, you average out the highs and lows.
//
// How we adapt it for Fiber micropayments:
//   Instead of weekly $100, we can do $0.001 every 10 seconds.
//   Fiber's sub-cent payment capability makes this possible.
//   The agent opens a channel, then sends micropayments on a
//   timer until the budget is exhausted or manually stopped.
//
// Flow:
//   1. Open Fiber channel with configured funding
//   2. Loop: wait interval → send micropayment → repeat
//   3. Stop when: budget exhausted | purchase count reached | user stops
//   4. Close channel and settle on-chain
// ============================================================

import {
  type DCAAgentConfig,
  now,
  sleep,
  formatCkb,
} from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { BaseAgent } from "./base-agent.js";
import type { SafetyLimits } from "./safety.js";

export class DCAAgent extends BaseAgent {
  declare config: DCAAgentConfig;
  private purchasesMade: number = 0;

  constructor(
    config: DCAAgentConfig,
    fiberClient: FiberClient,
    wallet: Wallet,
    safetyLimits?: Partial<SafetyLimits>,
  ) {
    super(config, fiberClient, wallet, safetyLimits);
  }

  /**
   * Core DCA execution loop.
   *
   * The loop is intentionally simple:
   *   while (should continue) → wait → pay → repeat
   *
   * Complexity is handled by the base class:
   *   - safePayment() checks spending limits
   *   - waitInterval() respects abort signals
   *   - shouldContinue() checks pause/stop state
   *
   * Why not use setInterval?
   * setInterval doesn't play well with async operations.
   * If a payment takes longer than the interval, setInterval
   * would queue up overlapping payments. A while loop with
   * await ensures payments are sequential and predictable.
   */
  protected async execute(): Promise<void> {
    console.log(
      `[DCA Agent ${this.config.id}] Starting — ` +
      `${formatCkb(this.config.amountPerInterval)} every ${this.config.intervalMs}ms, ` +
      `${this.config.totalPurchases || "unlimited"} purchases`,
    );

    // Main DCA loop
    while (this.shouldContinue()) {
      // Check if we've hit the purchase count limit
      if (
        this.config.totalPurchases > 0 &&
        this.purchasesMade >= this.config.totalPurchases
      ) {
        console.log(
          `[DCA Agent ${this.config.id}] Completed all ${this.config.totalPurchases} purchases`,
        );
        break;
      }

      // Wait for the configured interval
      // waitInterval returns false if the agent is stopped during the wait
      const shouldProceed = await this.waitInterval(this.config.intervalMs);
      if (!shouldProceed) break;

      // Skip if paused (but don't exit the loop — we'll resume)
      while (this.status === "paused") {
        await sleep(1000);
        if (this.abortController.signal.aborted) return;
      }

      // Execute the micropayment
      try {
        // In a real implementation, we'd create/use an invoice from
        // the target peer. For the hackathon demo, we simulate the
        // payment flow through the channel.
        const payment = await this.safePayment(
          // The invoice would come from the counterparty
          // For demo purposes, we use a placeholder that the
          // Fiber client will handle
          `dca-payment-${this.config.id}-${this.purchasesMade}`,
          this.config.amountPerInterval,
        );

        if (payment) {
          this.purchasesMade++;
          console.log(
            `[DCA Agent ${this.config.id}] Purchase ${this.purchasesMade}` +
            `${this.config.totalPurchases ? `/${this.config.totalPurchases}` : ""}: ` +
            `${formatCkb(this.config.amountPerInterval)} — ` +
            `Total: ${formatCkb(this.totalSpent)}`,
          );
        } else {
          // Payment blocked by safety — agent is now paused
          console.log(
            `[DCA Agent ${this.config.id}] Payment blocked by safety limits. Agent paused.`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[DCA Agent ${this.config.id}] Payment error: ${message}`);
        // Don't crash — log the error and try again next interval
        // Transient errors (network issues) should resolve themselves
        this.emitEvent({
          type: "agent:error",
          agentId: this.config.id,
          error: message,
          timestamp: now(),
        });
      }
    }

    console.log(
      `[DCA Agent ${this.config.id}] Finished — ` +
      `${this.purchasesMade} purchases, ${formatCkb(this.totalSpent)} total`,
    );
  }
}
