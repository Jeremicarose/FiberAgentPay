// ============================================================
// Network Configuration & Constants
// ============================================================
// Centralizes all network endpoints, chain parameters, and
// default values. Every package reads from here instead of
// hardcoding values — single place to switch between
// testnet/mainnet/devnet.
// ============================================================

/**
 * CKB network identifiers.
 * We default to testnet for the hackathon.
 */
export type NetworkType = "mainnet" | "testnet" | "devnet";

export interface NetworkConfig {
  network: NetworkType;
  ckb: {
    rpcUrl: string;
    indexerUrl: string;
  };
  fiber: {
    rpcUrl: string;
  };
}

/**
 * Builds a NetworkConfig from environment variables with sensible defaults.
 *
 * Why a function instead of a const?
 * - Environment variables may be loaded after module initialization (e.g., dotenv)
 * - A function re-reads process.env on each call, ensuring fresh values
 * - Makes testing easier — just set env vars before calling
 */
export function getNetworkConfig(): NetworkConfig {
  const network = (process.env.NETWORK ?? "testnet") as NetworkType;

  const defaults: Record<NetworkType, NetworkConfig> = {
    testnet: {
      network: "testnet",
      ckb: {
        rpcUrl: "https://testnet.ckbapp.dev/rpc",
        indexerUrl: "https://testnet.ckbapp.dev/indexer",
      },
      fiber: {
        rpcUrl: "http://127.0.0.1:8227",
      },
    },
    devnet: {
      network: "devnet",
      ckb: {
        rpcUrl: "http://127.0.0.1:8114",
        indexerUrl: "http://127.0.0.1:8116",
      },
      fiber: {
        rpcUrl: "http://127.0.0.1:8227",
      },
    },
    mainnet: {
      network: "mainnet",
      ckb: {
        rpcUrl: "https://mainnet.ckbapp.dev/rpc",
        indexerUrl: "https://mainnet.ckbapp.dev/indexer",
      },
      fiber: {
        rpcUrl: "http://127.0.0.1:8227",
      },
    },
  };

  const config = defaults[network];

  // Allow env overrides for any endpoint
  return {
    ...config,
    ckb: {
      rpcUrl: process.env.CKB_RPC_URL ?? config.ckb.rpcUrl,
      indexerUrl: process.env.CKB_INDEXER_URL ?? config.ckb.indexerUrl,
    },
    fiber: {
      rpcUrl: process.env.FIBER_RPC_URL ?? config.fiber.rpcUrl,
    },
  };
}

// --- Constants ---

/** 1 CKB = 10^8 shannons (like 1 BTC = 10^8 satoshis) */
export const CKB_UNIT = 100_000_000n;

/**
 * Minimum CKB for a cell: 61 CKB.
 * A basic CKB cell occupies 61 bytes, and CKB requires 1 CKB per byte
 * of on-chain storage. This is the minimum to create any cell.
 */
export const MIN_CELL_CAPACITY = 61n * CKB_UNIT;

/**
 * Default safety limits for agents.
 * Conservative starting point — users can raise these via the dashboard.
 * All values in shannons.
 */
export const DEFAULT_SAFETY_LIMITS = {
  maxPerTx: 100n * CKB_UNIT,     // 100 CKB max per single payment (must exceed 61 CKB min cell)
  maxPerHour: 2000n * CKB_UNIT,  // 2000 CKB max per hour
  maxTotal: 10000n * CKB_UNIT,   // 10000 CKB max total spend
} as const;

/** Default Fiber channel funding: 100 CKB */
export const DEFAULT_CHANNEL_FUNDING = 100n * CKB_UNIT;

/** Server defaults */
export const SERVER_PORT = Number(process.env.PORT ?? 3001);
export const WS_PORT = Number(process.env.WS_PORT ?? 3002);

/** CKB Testnet faucet for automated funding */
export const TESTNET_FAUCET_URL = "https://faucet.nervos.org";

