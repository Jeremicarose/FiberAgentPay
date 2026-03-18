// ============================================================
// Wallet API Routes
// ============================================================
// Endpoints for wallet information and balance queries.
//
// Endpoints:
//   GET  /wallet         — Get wallet address and balance
//   POST /wallet/transfer — Send CKB to an address
// ============================================================

import { Hono } from "hono";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { jsonStringify } from "@fiber-agent-pay/core";

export function createWalletRoutes(wallet: Wallet): Hono {
  const app = new Hono();

  /** GET /wallet — Get wallet address and balance */
  app.get("/", async (c) => {
    try {
      const state = await wallet.getState();
      return c.text(
        jsonStringify({ success: true, data: state, timestamp: Date.now() }),
        200,
        { "Content-Type": "application/json" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  /**
   * POST /wallet/transfer — Send CKB
   *
   * Body: { toAddress, amount }
   * Amount is in shannons (string to support bigint).
   *
   * This is a direct on-chain transfer, NOT a Fiber payment.
   * Used for funding channels or moving funds between wallets.
   */
  app.post("/transfer", async (c) => {
    try {
      const body = await c.req.json();
      if (!body.toAddress || !body.amount) {
        return c.json(
          { success: false, error: "toAddress and amount are required" },
          400,
        );
      }

      const txHash = await wallet.transfer(
        body.toAddress,
        BigInt(body.amount),
      );

      return c.json({
        success: true,
        data: { txHash },
        timestamp: Date.now(),
      }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  return app;
}
