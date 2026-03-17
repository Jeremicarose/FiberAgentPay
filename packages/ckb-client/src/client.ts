// ============================================================
// CKB Client — Base Layer Interaction via CCC SDK
// ============================================================
// CCC ("CKBers' Codebase") is the recommended SDK for CKB.
// It handles the complex parts of CKB development:
//   - Transaction building (inputs, outputs, witnesses)
//   - Cell collection (finding spendable cells)
//   - Fee calculation (auto-adjusts to network conditions)
//   - Signing (secp256k1, multisig, etc.)
//
// We use the base layer for:
//   1. Funding Fiber payment channels (on-chain tx)
//   2. Checking wallet balances
//   3. Withdrawing from closed channels
//
// Most of the action happens off-chain in Fiber, but we need
// the base layer for channel funding and settlement.
// ============================================================

import { ccc } from "@ckb-ccc/core";
import { getNetworkConfig } from "@fiber-agent-pay/core";

/**
 * Create a CCC client connected to the configured CKB network.
 *
 * Why a factory function instead of a singleton?
 * - Tests can create isolated clients with different configs
 * - If the server needs to talk to multiple networks, it can
 *
 * The client is the main entry point for all CKB operations.
 * It connects to both the RPC node (for submitting txs) and
 * the indexer (for querying cells).
 */
export function createCkbClient(): ccc.Client {
  const config = getNetworkConfig();

  // CCC's ClientPublicTestnet connects to Pudge testnet
  // with sensible defaults. For custom URLs, we'd use ClientPublicNode.
  if (config.network === "testnet") {
    return new ccc.ClientPublicTestnet({ url: config.ckb.rpcUrl });
  }

  if (config.network === "mainnet") {
    return new ccc.ClientPublicMainnet({ url: config.ckb.rpcUrl });
  }

  // Devnet — use generic client with custom URL
  return new ccc.ClientPublicTestnet({ url: config.ckb.rpcUrl });
}

/**
 * Create a signer from a private key.
 *
 * A signer combines a private key with a CKB client, giving you
 * the ability to:
 *   - Build transactions (knows your lock script for change)
 *   - Sign transactions (secp256k1 signature)
 *   - Send transactions (submits to the network)
 *
 * The private key should be loaded from env or encrypted keystore,
 * never hardcoded.
 *
 * @param client - CCC client connected to a CKB network
 * @param privateKey - Hex-encoded private key (with or without 0x prefix)
 * @returns A signer ready to build and send transactions
 */
export function createSigner(
  client: ccc.Client,
  privateKey: string,
): ccc.SignerCkbPrivateKey {
  return new ccc.SignerCkbPrivateKey(client, privateKey);
}

/**
 * Get the CKB address for a signer.
 *
 * Addresses encode the lock script in a human-readable format.
 * Testnet addresses start with "ckt1", mainnet with "ckb1".
 */
export async function getAddress(
  signer: ccc.SignerCkbPrivateKey,
): Promise<string> {
  const addresses = await signer.getAddresses();
  return addresses[0];
}

/**
 * Get the balance of a signer's address in shannons.
 *
 * CCC's getBalance returns the total capacity of all cells
 * owned by this signer's lock script. This includes:
 *   - Free capacity (spendable)
 *   - Occupied capacity (used by cell data storage)
 *
 * For our purposes, the total is what matters — it tells us
 * how much CKB is available for channel funding.
 */
export async function getBalance(
  signer: ccc.SignerCkbPrivateKey,
): Promise<bigint> {
  return signer.getBalance();
}
