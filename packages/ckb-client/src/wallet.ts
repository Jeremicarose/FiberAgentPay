// ============================================================
// Wallet Management
// ============================================================
// Handles secure key storage and HD wallet operations.
//
// Security model for an AI agent wallet:
//   - Private key loaded from environment variable or keystore file
//   - Never logged, never sent over the network
//   - Agents get a signer object, not the raw key
//   - Spending is gated by the safety module (in agents package)
//
// For the hackathon, we use a simple env-based key.
// Production would use encrypted keystore files (like SupeRISE).
// ============================================================

import { ccc } from "@ckb-ccc/core";
import { createCkbClient, createSigner, getAddress, getBalance } from "./client.js";
import { formatCkb } from "@fiber-agent-pay/core";

export interface WalletState {
  address: string;
  balance: bigint;
  balanceFormatted: string;
  isReady: boolean;
}

/**
 * The Wallet class manages the agent's on-chain identity and funds.
 *
 * Why a class instead of standalone functions?
 * The wallet has state (client, signer, address) that needs to be
 * initialized once and reused across many operations. A class
 * bundles this state cleanly. Agents hold a wallet reference
 * and call methods on it.
 */
export class Wallet {
  private client: ccc.Client;
  private signer: ccc.SignerCkbPrivateKey;
  private _address: string = "";
  private _isReady = false;

  /**
   * @param privateKey - Hex-encoded private key
   *
   * The constructor creates the CKB client and signer but does NOT
   * query the network. Call init() to fetch the address and verify
   * connectivity. This split allows synchronous construction and
   * async initialization.
   */
  constructor(privateKey: string) {
    this.client = createCkbClient();
    this.signer = createSigner(this.client, privateKey);
  }

  /**
   * Initialize the wallet by resolving the address from the signer.
   *
   * Why separate from constructor?
   * Getting the address requires an async call (address derivation
   * in CCC may involve network lookups for lock script resolution).
   * Constructors can't be async in JavaScript/TypeScript.
   */
  async init(): Promise<void> {
    this._address = await getAddress(this.signer);
    this._isReady = true;
  }

  /** The wallet's CKB address (testnet: ckt1..., mainnet: ckb1...) */
  get address(): string {
    if (!this._isReady) throw new Error("Wallet not initialized. Call init() first.");
    return this._address;
  }

  /** Whether init() has been called successfully */
  get isReady(): boolean {
    return this._isReady;
  }

  /** The underlying CCC signer — used by transaction building methods */
  getSigner(): ccc.SignerCkbPrivateKey {
    return this.signer;
  }

  /** The underlying CCC client — for direct RPC calls if needed */
  getClient(): ccc.Client {
    return this.client;
  }

  /**
   * Get current balance in shannons.
   *
   * This queries the chain live — not cached. For frequent checks,
   * the server should cache this and refresh periodically.
   */
  async getBalance(): Promise<bigint> {
    return getBalance(this.signer);
  }

  /**
   * Get full wallet state for API/dashboard display.
   */
  async getState(): Promise<WalletState> {
    const balance = await this.getBalance();
    return {
      address: this._address,
      balance,
      balanceFormatted: formatCkb(balance),
      isReady: this._isReady,
    };
  }

  /**
   * Build and send a CKB transfer transaction.
   *
   * CCC's transaction building flow:
   *   1. Create tx with desired outputs (who gets what)
   *   2. completeInputsByCapacity — CCC finds cells to spend
   *   3. completeFeeBy — CCC calculates and adds the fee
   *   4. sendTransaction — signs and broadcasts
   *
   * @param toAddress - Recipient CKB address
   * @param amountShannons - Amount in shannons
   * @returns Transaction hash
   */
  async transfer(toAddress: string, amountShannons: bigint): Promise<string> {
    const { script: toLock } = await ccc.Address.fromString(
      toAddress,
      this.client,
    );

    const tx = ccc.Transaction.from({
      outputs: [{ lock: toLock }],
    });

    // Set the output capacity (amount to send)
    tx.outputs[0].capacity = ccc.fixedPointFrom(amountShannons);

    // CCC auto-selects input cells that cover the output + fee
    await tx.completeInputsByCapacity(this.signer);

    // CCC calculates the optimal fee based on tx size and fee rate
    // 1000 = fee rate in shannons per KB (standard for testnet)
    await tx.completeFeeBy(this.signer, 1000);

    // Sign with our private key and broadcast to the network
    const txHash = await this.signer.sendTransaction(tx);
    return txHash;
  }

  /**
   * Write a payment record on-chain as a CKB Cell.
   *
   * This creates a new cell with:
   *   - Lock script: our wallet's lock (we own the cell)
   *   - Data: serialized payment record (agent ID, amount, timestamp, description)
   *
   * This demonstrates the CKB Cell model:
   *   - Cells hold both value (capacity) and data (outputs_data)
   *   - The capacity field must cover the cell's total byte size
   *   - Minimum cell: 61 CKB (lock script overhead) + data bytes
   *
   * The cell's data is a simple JSON string encoded as hex.
   * A production system would use Molecule serialization, but
   * JSON keeps it readable for hackathon demos.
   *
   * @param record - Payment data to store on-chain
   * @returns Transaction hash
   */
  async writePaymentRecord(record: {
    agentId: string;
    amount: bigint;
    timestamp: number;
    description: string;
  }): Promise<string> {
    // Serialize the record as JSON bytes
    const data = JSON.stringify({
      type: "fiber-agent-payment",
      agentId: record.agentId,
      amount: record.amount.toString(),
      timestamp: record.timestamp,
      description: record.description,
    });
    const dataBytes = new TextEncoder().encode(data);
    const dataHex = "0x" + Array.from(dataBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Get our lock script for the output cell
    const addresses = await this.signer.getAddresses();
    const { script: ourLock } = await ccc.Address.fromString(addresses[0], this.client);

    // Calculate capacity: cell overhead (61 CKB) + data size
    // Each byte of data costs 1 CKB (1e8 shannons)
    const dataCapacity = BigInt(dataBytes.length) * 100_000_000n;
    const cellCapacity = 6_100_000_000n + dataCapacity; // 61 CKB base + data

    const tx = ccc.Transaction.from({
      outputs: [{ lock: ourLock }],
      outputsData: [dataHex],
    });

    tx.outputs[0].capacity = ccc.fixedPointFrom(cellCapacity);

    await tx.completeInputsByCapacity(this.signer);
    await tx.completeFeeBy(this.signer, 1000);

    const txHash = await this.signer.sendTransaction(tx);
    return txHash;
  }
}

/**
 * Create a wallet from the environment variable.
 *
 * Why a factory function?
 * Separates the "where does the key come from" logic from the
 * Wallet class itself. In tests, you'd pass a key directly.
 * In production, you'd read from an encrypted keystore.
 * For the hackathon, env vars are the simplest approach.
 */
export function createWalletFromEnv(): Wallet {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "WALLET_PRIVATE_KEY not set. Add it to your .env file.\n" +
      "Generate one with: ckb-cli account new",
    );
  }
  return new Wallet(privateKey);
}
