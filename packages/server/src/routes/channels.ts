// ============================================================
// Channel API Routes
// ============================================================
// Endpoints for Fiber payment channel management.
// These proxy requests to the Fiber node, adding our own
// error handling and response formatting on top.
//
// Endpoints:
//   GET    /channels          — List all channels
//   POST   /channels          — Open a new channel
//   POST   /channels/:id/close — Close a channel
//   GET    /channels/:id      — Get channel details
// ============================================================

import { Hono } from "hono";
import { FiberChannelManager, FiberClient } from "@fiber-agent-pay/fiber-client";
import { jsonStringify } from "@fiber-agent-pay/core";

export function createChannelRoutes(fiberClient: FiberClient): Hono {
  const app = new Hono();
  const channelManager = new FiberChannelManager(fiberClient);

  /** GET /channels — List all open channels */
  app.get("/", async (c) => {
    try {
      const channels = await channelManager.listChannels();
      return c.text(
        jsonStringify({ success: true, data: channels, timestamp: Date.now() }),
        200,
        { "Content-Type": "application/json" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  /**
   * POST /channels — Open a new channel
   *
   * Body: { peerId, fundingAmount, public?, udtTypeScript? }
   *
   * The caller must connect to the peer first. In practice,
   * the agent handles peer connection as part of its startup.
   */
  app.post("/", async (c) => {
    try {
      const body = await c.req.json();
      const { peerId, fundingAmount, ...options } = body;

      if (!peerId || !fundingAmount) {
        return c.json(
          { success: false, error: "peerId and fundingAmount are required" },
          400,
        );
      }

      const result = await channelManager.openChannel(
        peerId,
        fundingAmount,
        options,
      );

      return c.json({ success: true, data: result, timestamp: Date.now() }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  /** GET /channels/:id — Get specific channel info */
  app.get("/:id", async (c) => {
    try {
      const channel = await channelManager.getChannel(c.req.param("id"));
      if (!channel) {
        return c.json({ success: false, error: "Channel not found" }, 404);
      }
      return c.text(
        jsonStringify({ success: true, data: channel, timestamp: Date.now() }),
        200,
        { "Content-Type": "application/json" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  /**
   * POST /channels/:id/close — Close a channel
   *
   * Body: { closeScript, feeRate?, force? }
   */
  app.post("/:id/close", async (c) => {
    try {
      const body = await c.req.json();
      await channelManager.shutdownChannel(
        c.req.param("id"),
        body.closeScript,
        body.feeRate,
        body.force ?? false,
      );
      return c.json({ success: true, timestamp: Date.now() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: message }, 500);
    }
  });

  return app;
}
