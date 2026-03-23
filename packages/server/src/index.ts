// ============================================================
// FiberAgentPay Server — Entry Point
// ============================================================
// Wires together all packages into a running HTTP + WebSocket
// server. This is the single process that:
//   - Serves the REST API (Hono on port 3001)
//   - Runs the WebSocket server (ws on port 3002)
//   - Manages the agent scheduler
//   - Connects to the Fiber node and CKB network
//
// Startup sequence:
//   1. Load environment variables
//   2. Initialize wallet (CKB connection)
//   3. Connect to Fiber node
//   4. Create agent scheduler
//   5. Start HTTP server with all routes
//   6. Start WebSocket server
// ============================================================

import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env from project root (two levels up from packages/server/)
config({ path: resolve(import.meta.dirname, "../../../.env") });
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { SERVER_PORT, WS_PORT } from "@fiber-agent-pay/core";
import { FiberClient } from "@fiber-agent-pay/fiber-client";
import { Wallet } from "@fiber-agent-pay/ckb-client";
import { AgentScheduler } from "@fiber-agent-pay/agents";
import { createAgentRoutes } from "./routes/agents.js";
import { createChannelRoutes } from "./routes/channels.js";
import { createPaymentRoutes, recordPayment } from "./routes/payments.js";
import { createWalletRoutes } from "./routes/wallet.js";
import { createWebSocketServer } from "./websocket.js";
import { logger, errorHandler } from "./middleware.js";

async function main() {
  console.log("=== FiberAgentPay Server ===");
  console.log(`Environment: ${process.env.NETWORK ?? "testnet"}`);

  // --- Initialize wallet ---
  let wallet: Wallet;
  const privateKey = process.env.WALLET_PRIVATE_KEY;

  if (privateKey) {
    wallet = new Wallet(privateKey);
    await wallet.init();
    console.log(`Wallet: ${wallet.address}`);
    const state = await wallet.getState();
    console.log(`Balance: ${state.balanceFormatted}`);
  } else {
    console.warn(
      "WARNING: WALLET_PRIVATE_KEY not set. Wallet features disabled.\n" +
      "Set it in .env to enable CKB transactions.",
    );
    // Create a dummy wallet for development without a key
    // The server still starts, but wallet/channel operations will fail
    wallet = new Wallet(
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
    try {
      await wallet.init();
    } catch {
      console.warn("Wallet init failed (expected without real key)");
    }
  }

  // --- Connect to Fiber node ---
  const fiberRpcUrl = process.env.FIBER_RPC_URL ?? "http://127.0.0.1:8227";
  const fiberClient = new FiberClient(fiberRpcUrl);

  const fiberConnected = await fiberClient.isConnected();
  if (fiberConnected) {
    console.log(`Fiber node: connected at ${fiberRpcUrl}`);
  } else {
    console.warn(
      `WARNING: Fiber node not reachable at ${fiberRpcUrl}\n` +
      "Channel and payment operations will fail until a Fiber node is available.",
    );
  }

  // --- Create agent scheduler ---
  const scheduler = new AgentScheduler(fiberClient, wallet);

  // Record payments from agent events into the payment ledger
  scheduler.on("agentEvent", (event) => {
    if (event.type === "payment:sent" || event.type === "payment:received") {
      recordPayment({
        paymentHash: event.payment.paymentHash,
        agentId: event.agentId,
        amount: event.payment.amount.toString(),
        status: event.payment.status,
        direction: event.payment.direction,
        timestamp: event.timestamp,
        onChainTxHash: event.payment.onChainTxHash,
        recipientAddress: event.payment.recipientAddress,
      });
    }
  });

  // --- Build HTTP server ---
  const app = new Hono();

  // Middleware
  app.use("*", cors());
  app.use("*", logger);
  app.use("*", errorHandler);

  // Health check
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      fiber: fiberConnected,
      wallet: wallet.isReady,
      timestamp: Date.now(),
    }),
  );

  // Mount route groups
  app.route("/agents", createAgentRoutes(scheduler));
  app.route("/channels", createChannelRoutes(fiberClient));
  app.route("/payments", createPaymentRoutes(fiberClient));
  app.route("/wallet", createWalletRoutes(wallet));

  // --- Start servers ---
  serve({ fetch: app.fetch, port: SERVER_PORT }, () => {
    console.log(`HTTP server: http://localhost:${SERVER_PORT}`);
  });

  createWebSocketServer(scheduler);

  console.log("\nReady! Dashboard can connect to:");
  console.log(`  API:       http://localhost:${SERVER_PORT}`);
  console.log(`  WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`  Health:    http://localhost:${SERVER_PORT}/health`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    await scheduler.stopAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
