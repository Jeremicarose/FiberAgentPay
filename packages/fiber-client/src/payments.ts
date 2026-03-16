// ============================================================
// Fiber Payment Operations
// ============================================================
// Payments flow through Fiber channels using HTLCs (Hash
// Time-Locked Contracts). The flow:
//
//   1. Payee creates an invoice (new_invoice)
//   2. Invoice encodes: amount, payment_hash, route hints
//   3. Payer calls send_payment with the invoice string
//   4. Fiber routes the payment through the channel network
//   5. Each hop creates an HTLC with the payment_hash
//   6. Payee reveals the preimage → payment settles backward
//
// This module wraps invoice creation and payment sending.
// ============================================================

import { FiberClient } from "./client.js";
import type {
  NewInvoiceParams,
  NewInvoiceResult,
  SendPaymentParams,
  SendPaymentResult,
  GetPaymentParams,
} from "./types.js";

export class FiberPaymentManager {
  constructor(private client: FiberClient) {}

  /**
   * Create a new invoice (payment request).
   *
   * An invoice is how you tell someone "pay me X amount."
   * It encodes the amount, payment hash, and routing info
   * into a single string that the payer passes to send_payment.
   *
   * @param amount - Amount in hex (shannons for CKB, units for UDT)
   * @param options - Invoice metadata
   * @returns The encoded invoice string and parsed details
   *
   * Why "Fibt" currency?
   * Fiber uses "Fibt" for testnet and "Fibb" for mainnet,
   * similar to how Lightning uses "lntb" and "lnbc".
   * This helps wallets route to the correct network.
   */
  async createInvoice(
    amount: string,
    options: {
      description?: string;
      expiry?: string;
      currency?: "Fibt" | "Fibb";
      paymentPreimage?: string;
      udtTypeScript?: NewInvoiceParams["udt_type_script"];
    } = {},
  ): Promise<NewInvoiceResult> {
    const params: NewInvoiceParams = {
      amount,
      currency: options.currency ?? "Fibt",
      description: options.description,
      expiry: options.expiry ?? "0xe10", // 3600 seconds (1 hour)
      final_cltv: "0x28", // 40 blocks — standard safety margin
      hash_algorithm: "sha256",
      payment_preimage: options.paymentPreimage,
      udt_type_script: options.udtTypeScript,
    };
    return this.client.call<NewInvoiceResult>("new_invoice", [params]);
  }

  /**
   * Send a payment using an invoice.
   *
   * This is the primary way to pay someone through Fiber.
   * The node finds a route through the channel graph and
   * creates HTLCs along the path.
   *
   * @param invoice - Encoded invoice string from the payee
   * @param dryRun - If true, checks route/fee without sending
   * @returns Payment status and fee information
   *
   * Payment statuses:
   *   Created  → Payment initiated, finding route
   *   Inflight → HTLCs created, waiting for preimage reveal
   *   Success  → Preimage received, payment settled
   *   Failed   → Route failed or timeout, funds returned
   */
  async sendPayment(
    invoice: string,
    dryRun: boolean = false,
  ): Promise<SendPaymentResult> {
    const params: SendPaymentParams = {
      invoice,
      dry_run: dryRun,
    };
    return this.client.call<SendPaymentResult>("send_payment", [params]);
  }

  /**
   * Send a "keysend" payment — no invoice required.
   *
   * Keysend is useful for agent-to-agent payments where the
   * payer knows the recipient's public key. No invoice exchange
   * needed, making it ideal for automated micropayments.
   *
   * How it works differently from invoice payments:
   * - With invoices: payee creates preimage → payer locks HTLC → payee reveals
   * - With keysend: payer creates preimage → includes it encrypted in the HTLC
   *   → recipient decrypts and claims
   *
   * @param targetPubkey - Recipient's node public key
   * @param amount - Amount in hex (shannons)
   * @param paymentHash - HTLC hash (derived from payer-created preimage)
   */
  async sendKeysendPayment(
    targetPubkey: string,
    amount: string,
    paymentHash: string,
  ): Promise<SendPaymentResult> {
    const params: SendPaymentParams = {
      target_pubkey: targetPubkey,
      amount,
      payment_hash: paymentHash,
    };
    return this.client.call<SendPaymentResult>("send_payment", [params]);
  }

  /**
   * Check the status of a previously sent payment.
   *
   * Use this to poll for payment completion. Agents call this
   * after send_payment to confirm the payment settled.
   *
   * @param paymentHash - The payment hash returned by send_payment
   */
  async getPaymentStatus(paymentHash: string): Promise<SendPaymentResult> {
    const params: GetPaymentParams = { payment_hash: paymentHash };
    return this.client.call<SendPaymentResult>("get_payment", [params]);
  }

  /**
   * Wait for a payment to reach a terminal state (Success or Failed).
   *
   * Payments are asynchronous — send_payment returns immediately
   * with status "Created", then the payment routes through the
   * network. This method polls until completion.
   *
   * @param paymentHash - Payment to watch
   * @param timeoutMs - Max wait (default: 60 seconds)
   * @param pollIntervalMs - Poll frequency (default: 2 seconds)
   */
  async waitForPaymentComplete(
    paymentHash: string,
    timeoutMs: number = 60_000,
    pollIntervalMs: number = 2_000,
  ): Promise<SendPaymentResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.getPaymentStatus(paymentHash);

      if (status.status === "Success" || status.status === "Failed") {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Payment ${paymentHash} did not complete within ${timeoutMs}ms`,
    );
  }
}
