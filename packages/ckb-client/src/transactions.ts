// ============================================================
// Transaction Building Helpers
// ============================================================
// Higher-level transaction utilities specific to FiberAgentPay.
// These build on top of the CCC SDK's primitives for common
// operations like funding channels and checking tx status.
// ============================================================

import { ccc } from "@ckb-ccc/core";
import type { Wallet } from "./wallet.js";

/**
 * Wait for a transaction to be committed on-chain.
 *
 * After sending a tx (e.g., channel funding), it goes through:
 *   pending → proposed → committed
 *
 * "committed" means it's in a block and considered final.
 * On testnet, this takes ~10-30 seconds (1-3 blocks).
 *
 * Why poll instead of subscribe?
 * CKB RPC doesn't offer native tx subscription. Polling with
 * a reasonable interval (5s) is the standard approach and is
 * used by all CKB SDKs internally.
 *
 * @param client - CCC client for RPC calls
 * @param txHash - Hash of the transaction to watch
 * @param timeoutMs - Max wait (default: 5 minutes)
 * @param pollIntervalMs - How often to check (default: 5 seconds)
 * @returns The confirmed transaction status
 */
export async function waitForTransaction(
  client: ccc.Client,
  txHash: string,
  timeoutMs: number = 300_000,
  pollIntervalMs: number = 5_000,
): Promise<"committed"> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const tx = await client.getTransaction(txHash);
      if (tx && tx.status === "committed") {
        return "committed";
      }
    } catch {
      // Transaction might not be indexed yet — keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Transaction ${txHash} was not committed within ${timeoutMs}ms`,
  );
}

/**
 * Get the lock script for the wallet's address.
 *
 * The lock script is the "owner" of cells on CKB. It defines
 * who can spend the cell. For our wallet, it's a secp256k1
 * lock (the standard "single owner" lock).
 *
 * This is needed when closing Fiber channels — we specify
 * where to send our balance with the close_script parameter.
 */
export async function getWalletLockScript(
  wallet: Wallet,
): Promise<{ codeHash: string; hashType: string; args: string }> {
  const client = wallet.getClient();
  const { script } = await ccc.Address.fromString(wallet.address, client);

  return {
    codeHash: script.codeHash,
    hashType: script.hashType,
    args: script.args,
  };
}

/**
 * Convert our wallet's lock script to the Fiber RPC format.
 *
 * CCC uses camelCase (codeHash), Fiber RPC uses snake_case (code_hash).
 * This bridges the format difference.
 */
export async function getWalletLockScriptForFiber(
  wallet: Wallet,
): Promise<{ code_hash: string; hash_type: string; args: string }> {
  const lock = await getWalletLockScript(wallet);
  return {
    code_hash: lock.codeHash,
    hash_type: lock.hashType,
    args: lock.args,
  };
}

/**
 * Check if the wallet has enough CKB for a channel funding operation.
 *
 * A channel funding requires:
 *   - The funding amount itself
 *   - Transaction fee (~0.001 CKB typically)
 *   - A change cell (minimum 61 CKB to create)
 *
 * So the wallet needs at least: fundingAmount + 61 CKB + fee buffer
 *
 * @param wallet - The wallet to check
 * @param fundingAmount - Desired channel funding in shannons
 * @returns Whether the wallet has sufficient balance
 */
export async function hasEnoughForChannelFunding(
  wallet: Wallet,
  fundingAmount: bigint,
): Promise<{ enough: boolean; balance: bigint; required: bigint }> {
  const balance = await wallet.getBalance();
  const MIN_CHANGE_CELL = 6_100_000_000n; // 61 CKB in shannons
  const FEE_BUFFER = 100_000n; // 0.001 CKB — generous fee buffer
  const required = fundingAmount + MIN_CHANGE_CELL + FEE_BUFFER;

  return {
    enough: balance >= required,
    balance,
    required,
  };
}
