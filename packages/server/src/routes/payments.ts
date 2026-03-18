// ============================================================
// Payment API Routes
// ============================================================
// Endpoints for payment history and invoice management.
//
// Endpoints:
//   GET    /payments          — List payment history
//   POST   /payments/invoice  — Create a new invoice
//   GET    /payments/:hash    — Get payment status
// ============================================================

import { Hono } from "hono";
import { FiberPaymentManager, FiberClient } from "@fiber-agent-pay/fiber-client";
import { jsonStringify } from "@fiber-agent-pay/core";

/**
 * In-memory payment ledger.
 *
 * Stores all payments made by agents. In production this would
 * be a database, but for the hackathon in-memory is sufficient.
 * The Fiber node also keeps its own payment records.
 */
export interface PaymentRecord {
  paymentHash: string;
  agentId: string;
  amount: string;
  status: string;
  direction: string;
  timestamp: number;
  description?: string;
}

const paymentHistory: PaymentRecord[] = [];

/** Add a payment to the ledger (called by agent event handlers) */
export function recordPayment(record: PaymentRecord): void {
  paymentHistory.push(record);
}

export function createPaymentRoutes(fiberClient: FiberClient): Hono {
  const app = new Hono();
  const paymentManager = new FiberPaymentManager(fiberClient);

  /** GET /payments — List all recorded payments */
  app.get("/", (c) => {
    const limit = Number(c.req.query("limit") ?? 100);
    const offset = Number(c.req.query("offset") ?? 0);
    const agentId = c.req.query("agentId");

    let filtered = paymentHistory;
    if (agentId) {
      filtered = filtered.filter((p) => p.agentId === agentId);
    }

    const total = filtered.length;
    const payments = filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);

    return c.text(
      jsonStringify({
        success: true,
        data: { payments, total, limit, offset },
        timestamp: Date.now(),
      }),
      200,
      { "Content-Type": "application/json" },
    );
  });

  /**
   * POST /payments/invoice — Create a new Fiber invoice
   *
   * Body: { amount, description?, currency? }
   */
  app.post("/invoice", async (c) => {
    try {
      const body = await c.req.json();
      const result = await paymentManager.createInvoice(body.amount, {
        description: body.description,
        currency: body.currency,
      });
      return c.text(
        jsonStringify({ success: true, data: result, timestamp: Date.now() }),
        201,
        { "Content-Type": "application/json" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  /** GET /payments/:hash — Check payment status */
  app.get("/:hash", async (c) => {
    try {
      const status = await paymentManager.getPaymentStatus(c.req.param("hash"));
      return c.text(
        jsonStringify({ success: true, data: status, timestamp: Date.now() }),
        200,
        { "Content-Type": "application/json" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  return app;
}
