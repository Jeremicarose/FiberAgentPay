// ============================================================
// Fiber Network JSON-RPC Client
// ============================================================
// This is the transport layer — handles making JSON-RPC calls
// to a Fiber Network Node (FNN). All other modules (channels,
// payments, graph) use this for communication.
//
// Why a custom client instead of a library?
// Fiber Network's RPC is specific to nervosnetwork/fiber and
// has no official JS/TS SDK. We build a thin, typed wrapper
// around fetch() that:
//   1. Handles JSON-RPC request/response envelope
//   2. Converts hex strings to bigint at the boundary
//   3. Provides meaningful errors on failure
//   4. Supports connection health checks
// ============================================================

import type { JsonRpcRequest, JsonRpcResponse } from "./types.js";

export class FiberRpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(`Fiber RPC Error ${code}: ${message}`);
    this.name = "FiberRpcError";
  }
}

export class FiberClient {
  private requestId = 0;

  /**
   * @param rpcUrl - URL of the Fiber node's JSON-RPC endpoint
   *                 Default: http://127.0.0.1:8227
   *
   * Why not accept the full NetworkConfig?
   * Single Responsibility — this class only knows about RPC transport.
   * The caller (agents, server) reads the config and passes the URL.
   */
  constructor(private rpcUrl: string = "http://127.0.0.1:8227") {}

  /**
   * Make a raw JSON-RPC call to the Fiber node.
   *
   * This is the single point of contact with the network.
   * Every method in channels.ts, payments.ts, etc. calls this.
   *
   * Why generic <T>?
   * Each RPC method returns a different shape. The caller passes
   * the expected return type, giving us type safety without
   * runtime overhead.
   *
   * @param method - RPC method name (e.g., "open_channel")
   * @param params - Method parameters (wrapped in an array per JSON-RPC spec)
   * @returns The typed result from the RPC response
   * @throws FiberRpcError if the node returns an error
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: JsonRpcRequest = {
      id: ++this.requestId,
      jsonrpc: "2.0",
      method,
      params,
    };

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new FiberRpcError(
        response.status,
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const json = (await response.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new FiberRpcError(
        json.error.code,
        json.error.message,
        json.error.data,
      );
    }

    return json.result as T;
  }

  /**
   * Check if the Fiber node is reachable.
   * Calls node_info which is a lightweight RPC method.
   *
   * Why node_info instead of a ping?
   * Fiber doesn't have a ping RPC. node_info is the lightest
   * method that confirms the node is up and responding.
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.call("node_info");
      return true;
    } catch {
      return false;
    }
  }

  /** Get the RPC URL (useful for logging/debugging) */
  get url(): string {
    return this.rpcUrl;
  }
}
