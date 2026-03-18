// ============================================================
// Agent Safety Module
// ============================================================
// This is the most critical module in the system. It prevents
// agents from spending more than their configured limits.
//
// Why is this necessary?
// AI agents are autonomous — they make spending decisions without
// human approval for each transaction. Without guardrails, a bug
// or misconfiguration could drain the wallet. The safety module
// enforces hard limits that agents CANNOT bypass.
//
// Three tiers of protection:
//   1. Per-transaction limit: Max amount for any single payment
//   2. Per-hour limit: Rolling hourly spending cap
//   3. Total lifetime limit: Absolute max the agent can ever spend
//
// When a limit is hit, the agent pauses and emits a
// safety:limit_reached event. The user must approve via the
// dashboard before the agent continues.
// ============================================================

import { DEFAULT_SAFETY_LIMITS, now } from "@fiber-agent-pay/core";

export interface SafetyLimits {
  maxPerTx: bigint;
  maxPerHour: bigint;
  maxTotal: bigint;
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  /** Which limit was hit */
  limitType?: "per_tx" | "per_hour" | "total";
}

/**
 * Tracks spending and enforces limits for a single agent.
 *
 * Each agent gets its own SafetyGuard instance. The guard
 * maintains an in-memory ledger of recent transactions
 * (timestamped amounts) for rolling-window calculations.
 *
 * Why in-memory instead of a database?
 * For a hackathon, in-memory is simple and fast. In production,
 * you'd persist this to survive restarts. But the on-chain
 * record (Fiber payments) is the ultimate source of truth.
 */
export class SafetyGuard {
  private limits: SafetyLimits;
  private totalSpent: bigint = 0n;
  /** Rolling ledger: [timestamp, amount] pairs for hourly tracking */
  private recentPayments: Array<{ timestamp: number; amount: bigint }> = [];

  constructor(limits?: Partial<SafetyLimits>) {
    this.limits = {
      maxPerTx: limits?.maxPerTx ?? DEFAULT_SAFETY_LIMITS.maxPerTx,
      maxPerHour: limits?.maxPerHour ?? DEFAULT_SAFETY_LIMITS.maxPerHour,
      maxTotal: limits?.maxTotal ?? DEFAULT_SAFETY_LIMITS.maxTotal,
    };
  }

  /**
   * Check if a payment of the given amount is allowed.
   *
   * This is a DRY RUN — it doesn't record the payment.
   * Call recordPayment() after the payment succeeds.
   *
   * Why separate check and record?
   * The payment might fail at the Fiber level. We don't want to
   * count failed payments against the spending limit.
   *
   * @param amount - Proposed payment amount in shannons
   * @returns Whether the payment is allowed, and why not if blocked
   */
  check(amount: bigint): SafetyCheckResult {
    // Check 1: Per-transaction limit
    if (amount > this.limits.maxPerTx) {
      return {
        allowed: false,
        reason: `Amount ${amount} exceeds per-tx limit of ${this.limits.maxPerTx}`,
        limitType: "per_tx",
      };
    }

    // Check 2: Hourly rolling window
    const oneHourAgo = now() - 3_600_000;
    const hourlySpent = this.recentPayments
      .filter((p) => p.timestamp > oneHourAgo)
      .reduce((sum, p) => sum + p.amount, 0n);

    if (hourlySpent + amount > this.limits.maxPerHour) {
      return {
        allowed: false,
        reason: `Hourly spend ${hourlySpent + amount} would exceed limit of ${this.limits.maxPerHour}`,
        limitType: "per_hour",
      };
    }

    // Check 3: Lifetime total
    if (this.totalSpent + amount > this.limits.maxTotal) {
      return {
        allowed: false,
        reason: `Total spend ${this.totalSpent + amount} would exceed limit of ${this.limits.maxTotal}`,
        limitType: "total",
      };
    }

    return { allowed: true };
  }

  /**
   * Record a successful payment against the spending limits.
   * Call this AFTER the Fiber payment confirms, not before.
   */
  recordPayment(amount: bigint): void {
    const timestamp = now();
    this.totalSpent += amount;
    this.recentPayments.push({ timestamp, amount });

    // Prune entries older than 1 hour to prevent memory growth
    const oneHourAgo = timestamp - 3_600_000;
    this.recentPayments = this.recentPayments.filter(
      (p) => p.timestamp > oneHourAgo,
    );
  }

  /** Total amount spent by this agent (lifetime) */
  getTotalSpent(): bigint {
    return this.totalSpent;
  }

  /** Amount spent in the last hour */
  getHourlySpent(): bigint {
    const oneHourAgo = now() - 3_600_000;
    return this.recentPayments
      .filter((p) => p.timestamp > oneHourAgo)
      .reduce((sum, p) => sum + p.amount, 0n);
  }

  /** Current configured limits */
  getLimits(): SafetyLimits {
    return { ...this.limits };
  }
}
