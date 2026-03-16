// ============================================================
// Core Type Definitions for FiberAgentPay
// ============================================================
// Every package in the monorepo imports from here. This ensures
// a single source of truth for data shapes flowing between
// the Fiber client, CKB client, agents, server, and dashboard.
// ============================================================

// --- Agent Types ---

/**
 * The three agent strategies our system supports.
 * - dca: Dollar-cost averaging — periodic fixed-amount purchases
 * - stream: Continuous micropayment streams (pay-per-second/minute)
 * - commerce: Agent-to-agent marketplace (buy/sell data and services)
 */
export type AgentType = "dca" | "stream" | "commerce";

/**
 * Agent lifecycle states. Transitions:
 *   idle → running → paused → running (resume)
 *                  → stopped (terminal)
 *        → error   → running (retry)
 *                  → stopped (give up)
 */
export type AgentStatus = "idle" | "running" | "paused" | "stopped" | "error";

/**
 * Base configuration shared by all agent types.
 * Each agent type extends this with strategy-specific fields.
 */
export interface BaseAgentConfig {
  id: string;
  name: string;
  type: AgentType;
  /** Maximum CKB (in shannons) the agent can spend per transaction */
  maxPerTx: bigint;
  /** Maximum CKB (in shannons) the agent can spend per hour */
  maxPerHour: bigint;
  /** Maximum CKB (in shannons) the agent can spend in total */
  maxTotal: bigint;
  /** Peer ID of the Fiber node to open channels with */
  peerId: string;
  /** Amount to fund the payment channel with (in shannons) */
  channelFunding: bigint;
}

/**
 * DCA Agent Config
 * Executes purchases at fixed intervals. Think "buy $10 of CKB every hour."
 * The agent opens a Fiber channel, then sends micropayments on schedule.
 */
export interface DCAAgentConfig extends BaseAgentConfig {
  type: "dca";
  /** Amount per purchase interval (in shannons) */
  amountPerInterval: bigint;
  /** Interval between purchases (in milliseconds) */
  intervalMs: number;
  /** Total number of purchases to execute. 0 = unlimited until budget runs out */
  totalPurchases: number;
  /** Optional: UDT type script hash for purchasing a specific token */
  udtTypeScriptHash?: string;
}

/**
 * Streaming Payments Agent Config
 * Sends continuous micropayments — like paying per second for an API service.
 * Uses Fiber's sub-cent capabilities for true micropayment streams.
 */
export interface StreamAgentConfig extends BaseAgentConfig {
  type: "stream";
  /** Amount per tick (in shannons). A "tick" is one payment unit. */
  amountPerTick: bigint;
  /** Tick interval (in milliseconds). e.g., 1000 = pay every second */
  tickIntervalMs: number;
  /** Target — who receives the stream. Fiber invoice or peer address */
  recipient: string;
  /** Optional description of what this stream pays for */
  description?: string;
}

/**
 * Commerce Agent Config
 * Participates in an agent-to-agent marketplace.
 * Can both offer services and purchase from other agents.
 */
export interface CommerceAgentConfig extends BaseAgentConfig {
  type: "commerce";
  /** Services this agent offers to the marketplace */
  offeredServices: ServiceListing[];
  /** Types of services this agent is willing to purchase */
  desiredServices: string[];
  /** Maximum price per service request (in shannons) */
  maxPricePerRequest: bigint;
  /** Whether to use Claude AI for intelligent negotiation */
  useAINegotiation: boolean;
}

/** Union of all agent config types for type-safe dispatch */
export type AgentConfig = DCAAgentConfig | StreamAgentConfig | CommerceAgentConfig;

/**
 * Runtime state of an agent instance.
 * Combines config with live operational data.
 */
export interface AgentState {
  config: AgentConfig;
  status: AgentStatus;
  /** Channel ID if one is open */
  channelId?: string;
  /** Total amount spent so far (in shannons) */
  totalSpent: bigint;
  /** Number of payments executed */
  paymentCount: number;
  /** Timestamp of last payment */
  lastPaymentAt?: number;
  /** Error message if status is "error" */
  error?: string;
  /** When the agent was created */
  createdAt: number;
  /** When the agent last changed state */
  updatedAt: number;
}

// --- Fiber Network Types ---

/**
 * Fiber payment channel states.
 * Maps to Fiber node's internal channel state machine.
 */
export type ChannelState =
  | "CHANNEL_NEGOTIATING"  // Initial handshake
  | "CHANNEL_READY"        // Funded and operational
  | "CHANNEL_CLOSING"      // Cooperative close initiated
  | "CHANNEL_CLOSED"       // Settled on-chain
  | "CHANNEL_FORCE_CLOSING"; // Unilateral close

/**
 * Represents a Fiber payment channel between two peers.
 * This is the core data structure for off-chain payments.
 */
export interface FiberChannel {
  channelId: string;
  peerId: string;
  state: ChannelState;
  /** Our balance in this channel (shannons) */
  localBalance: bigint;
  /** Peer's balance in this channel (shannons) */
  remoteBalance: bigint;
  /** Whether this channel is announced to the network graph */
  isPublic: boolean;
  /** On-chain outpoint that funds this channel */
  channelOutpoint?: string;
  /** Pending HTLCs (Hash Time-Locked Contracts) in flight */
  pendingTlcs: number;
  createdAt: number;
}

/**
 * A payment sent or received through a Fiber channel.
 * Recorded in our local database for history and auditing.
 */
export interface FiberPayment {
  id: string;
  /** Which agent initiated this payment */
  agentId: string;
  channelId: string;
  amount: bigint;
  /** Payment hash for HTLC verification */
  paymentHash: string;
  status: "pending" | "completed" | "failed";
  direction: "outbound" | "inbound";
  timestamp: number;
  /** Optional description / memo */
  description?: string;
}

/**
 * A Fiber invoice — a payment request that can be sent to payers.
 * Analogous to Lightning Network invoices.
 */
export interface FiberInvoice {
  /** Encoded invoice string */
  invoice: string;
  paymentHash: string;
  amount: bigint;
  description?: string;
  expiry: number;
  /** Whether this invoice has been paid */
  isPaid: boolean;
  createdAt: number;
}

// --- Commerce / Marketplace Types ---

/**
 * A service listing in the agent marketplace.
 * Agents advertise what they can do and how much they charge.
 */
export interface ServiceListing {
  /** Unique service identifier */
  serviceId: string;
  /** Human-readable name (e.g., "Weather Data Feed") */
  name: string;
  /** Detailed description of the service */
  description: string;
  /** Price per request in shannons */
  pricePerRequest: bigint;
  /** Category for discovery */
  category: ServiceCategory;
  /** Agent ID that offers this service */
  providerId: string;
  /** Whether the service is currently available */
  isActive: boolean;
}

export type ServiceCategory =
  | "data_feed"       // Real-time data streams
  | "computation"     // Processing/analysis tasks
  | "storage"         // Data storage services
  | "oracle"          // External data oracles
  | "other";

/**
 * A request from one agent to another for a service.
 * The commerce agent handles the full lifecycle:
 * discover → request → pay → receive result.
 */
export interface ServiceRequest {
  requestId: string;
  serviceId: string;
  requesterId: string;
  providerId: string;
  /** Payment hash linking this request to a Fiber payment */
  paymentHash?: string;
  status: "pending" | "paid" | "fulfilled" | "failed";
  /** The result data returned by the provider */
  result?: string;
  requestedAt: number;
  fulfilledAt?: number;
}

// --- Event Types ---

/**
 * Events emitted by agents for real-time dashboard updates.
 * The server broadcasts these over WebSocket to connected dashboards.
 */
export type AgentEvent =
  | { type: "agent:started"; agentId: string; timestamp: number }
  | { type: "agent:stopped"; agentId: string; timestamp: number }
  | { type: "agent:paused"; agentId: string; timestamp: number }
  | { type: "agent:error"; agentId: string; error: string; timestamp: number }
  | { type: "channel:opened"; agentId: string; channelId: string; timestamp: number }
  | { type: "channel:closed"; agentId: string; channelId: string; timestamp: number }
  | { type: "payment:sent"; agentId: string; payment: FiberPayment; timestamp: number }
  | { type: "payment:received"; agentId: string; payment: FiberPayment; timestamp: number }
  | { type: "safety:warning"; agentId: string; message: string; timestamp: number }
  | { type: "safety:limit_reached"; agentId: string; limitType: string; timestamp: number }
  | { type: "commerce:service_listed"; agentId: string; service: ServiceListing; timestamp: number }
  | { type: "commerce:request_fulfilled"; agentId: string; request: ServiceRequest; timestamp: number };

// --- API Response Types ---

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/** Wallet info returned by the server */
export interface WalletInfo {
  address: string;
  lockHash: string;
  /** Total balance in shannons */
  totalBalance: bigint;
  /** Available (not locked in channels) balance in shannons */
  availableBalance: bigint;
  /** Amount locked in Fiber channels */
  channelLockedBalance: bigint;
}
