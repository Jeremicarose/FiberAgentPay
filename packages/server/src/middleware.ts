// ============================================================
// Server Middleware
// ============================================================
// Hono middleware for CORS, error handling, and request logging.
//
// Why Hono over Express?
// Hono is TypeScript-native, 10x lighter than Express, and
// runs on any JS runtime (Node, Bun, Deno, Cloudflare Workers).
// For a hackathon, it means less boilerplate and faster iteration.
// ============================================================

import { type Context, type Next } from "hono";

/**
 * Request logging middleware.
 * Logs method, path, status, and response time.
 */
export async function logger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`);
}

/**
 * Error handling middleware.
 * Catches unhandled errors and returns a structured JSON response
 * instead of crashing the server or leaking stack traces.
 */
export async function errorHandler(c: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`Error: ${message}`);
    c.status(500);
    c.header("Content-Type", "application/json");
    // Use c.body to set response directly since we already set status
    const body = JSON.stringify({
      success: false,
      error: message,
      timestamp: Date.now(),
    });
    c.res = new Response(body, {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
