// ============================================================
// Shared Utility Functions
// ============================================================
// Pure functions used across all packages. No side effects,
// no dependencies — just computation. This keeps the module
// lightweight and easy to test.
// ============================================================

import { CKB_UNIT } from "./config.js";

/**
 * Convert CKB to shannons (the smallest unit).
 * Like converting dollars to cents, but with 8 decimal places.
 *
 * Why bigint throughout?
 * JavaScript's Number type loses precision above 2^53 (~9 * 10^15).
 * That's only 90 million CKB — easy to exceed with real balances.
 * bigint has no upper limit, so it's safe for all amounts.
 *
 * @example ckbToShannons(1.5) → 150000000n
 */
export function ckbToShannons(ckb: number): bigint {
  return BigInt(Math.round(ckb * Number(CKB_UNIT)));
}

/**
 * Convert shannons to CKB (human-readable).
 * @example shannonsToCkb(150000000n) → 1.5
 */
export function shannonsToCkb(shannons: bigint): number {
  return Number(shannons) / Number(CKB_UNIT);
}

/**
 * Format shannons as a human-readable CKB string.
 * @example formatCkb(150000000n) → "1.50 CKB"
 */
export function formatCkb(shannons: bigint): string {
  return `${shannonsToCkb(shannons).toFixed(2)} CKB`;
}

/**
 * Generate a unique ID.
 * Uses crypto.randomUUID() which is available in Node 20+.
 *
 * Why not nanoid or uuid package?
 * Node 20 ships crypto.randomUUID() natively — zero dependencies.
 * For a hackathon, avoiding extra deps keeps things simple.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Sleep for a given number of milliseconds.
 * Used by agents for interval-based scheduling.
 *
 * Returns a promise so agents can `await sleep(1000)` between payments
 * without blocking the event loop (unlike a busy-wait loop).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff.
 *
 * Why exponential backoff?
 * If a Fiber node is temporarily unavailable, hammering it with retries
 * makes things worse. Doubling the delay (1s → 2s → 4s → 8s) gives
 * the node time to recover while still retrying promptly.
 *
 * @param fn - The async operation to retry
 * @param maxRetries - Maximum number of attempts (default 3)
 * @param baseDelay - Initial delay in ms (default 1000, doubles each retry)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Current Unix timestamp in milliseconds.
 * Used for all timing in agent state and events.
 */
export function now(): number {
  return Date.now();
}

/**
 * Safely parse a bigint from various input formats.
 * Fiber RPC returns hex strings ("0x..."), CKB RPCs return hex or decimal.
 * This normalizes all of them to bigint.
 *
 * @example parseBigInt("0x5f5e100") → 100000000n
 * @example parseBigInt("100000000") → 100000000n
 * @example parseBigInt(100000000n) → 100000000n
 */
export function parseBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  // Handle hex strings from RPC responses
  if (value.startsWith("0x")) return BigInt(value);
  return BigInt(value);
}

/**
 * Truncate a hex string for display (e.g., tx hashes, channel IDs).
 * @example truncateHex("0xabcdef1234567890") → "0xabcd...7890"
 */
export function truncateHex(hex: string, chars = 4): string {
  if (hex.length <= chars * 2 + 4) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}

/**
 * JSON serializer that handles bigint.
 * Standard JSON.stringify throws on bigint. This converts them to strings
 * with a "n" suffix so they can be deserialized back.
 *
 * Why not a custom replacer in every JSON.stringify call?
 * Centralizing it here prevents the common bug of forgetting the replacer
 * and getting "TypeError: Do not know how to serialize a BigInt."
 */
export function jsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === "bigint" ? `${value.toString()}n` : value,
  );
}

/**
 * JSON deserializer that restores bigint values.
 * Parses strings ending in "n" back to bigint.
 */
export function jsonParse<T = unknown>(json: string): T {
  return JSON.parse(json, (_key, value) => {
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as T;
}
