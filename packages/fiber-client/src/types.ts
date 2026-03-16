// ============================================================
// Fiber Network RPC Types
// ============================================================
// These types mirror the Fiber node's JSON-RPC API exactly.
// All hex values are strings ("0x...") because that's what the
// RPC returns. We convert to bigint at the client boundary
// (in client.ts) so the rest of our codebase works with
// native types.
// ============================================================

/** CKB script structure — used in channel open/close operations */
export interface FiberScript {
  code_hash: string;
  hash_type: "type" | "data" | "data1" | "data2";
  args: string;
}

// --- connect_peer ---

export interface ConnectPeerParams {
  /** Multiaddr format: /ip4/<ip>/tcp/<port>/p2p/<peer_id> */
  address: string;
}

// --- open_channel ---

export interface OpenChannelParams {
  /** Peer ID (must be connected first via connect_peer) */
  peer_id: string;
  /** Funding amount in hex (shannons) */
  funding_amount: string;
  /** Whether this channel is announced to the network (default: true) */
  public?: boolean;
  /** If funding with a UDT token instead of native CKB */
  funding_udt_type_script?: FiberScript;
  /** Script used when channel is closed */
  shutdown_script?: FiberScript;
  /** Commitment delay epoch */
  commitment_delay_epoch?: string;
  /** Fee rate in shannons per kilo-bytes */
  funding_fee_rate?: string;
}

export interface OpenChannelResult {
  temporary_channel_id: string;
}

// --- list_channels ---

export interface ListChannelsParams {
  /** Filter by peer ID (optional) */
  peer_id?: string;
}

export interface ChannelInfo {
  channel_id: string;
  peer_id: string;
  state: {
    state_name: string;
    state_flags: string[];
  };
  local_balance: string;
  remote_balance: string;
  offered_tlc_balance: string;
  received_tlc_balance: string;
  is_public: boolean;
  channel_outpoint?: string;
  /** Number of pending HTLCs */
  pending_tlcs: number;
  created_at: string;
}

export interface ListChannelsResult {
  channels: ChannelInfo[];
}

// --- shutdown_channel ---

export interface ShutdownChannelParams {
  channel_id: string;
  close_script: FiberScript;
  fee_rate: string;
  /** Force close (unilateral) if true */
  force?: boolean;
}

// --- new_invoice ---

export interface NewInvoiceParams {
  /** Amount in hex (shannons or UDT units) */
  amount: string;
  /** Currency code: "Fibt" for testnet, "Fibb" for mainnet */
  currency: "Fibt" | "Fibb";
  description?: string;
  /** Expiry in hex (seconds) */
  expiry?: string;
  /** Final CLTV delta in hex */
  final_cltv?: string;
  /** Payment preimage (32 bytes hex) — if not provided, node generates one */
  payment_preimage?: string;
  /** Hash algorithm for payment hash */
  hash_algorithm?: "sha256" | "ckb_hash";
  /** UDT type script if invoice is for a UDT */
  udt_type_script?: FiberScript;
}

export interface NewInvoiceResult {
  invoice_address: string;
  invoice: {
    currency: string;
    amount: string;
    payment_hash: string;
    signature: string;
    data: {
      timestamp: string;
      payment_hash: string;
      attrs: Array<{
        Description?: string;
        ExpiryTime?: { secs: number; nanos: number };
        FinalHtlcTimeout?: number;
        PayeePublicKey?: string;
        HashAlgorithm?: string;
        UdtScript?: string;
      }>;
    };
  };
}

// --- send_payment ---

export interface SendPaymentParams {
  /** Encoded invoice string from the payee */
  invoice?: string;
  /** Amount to pay in hex (overrides invoice amount if set) */
  amount?: string;
  /** Payment hash for keysend (no-invoice) payments */
  payment_hash?: string;
  /** Destination node public key (for keysend) */
  target_pubkey?: string;
  /** Dry run — checks route and fee without sending */
  dry_run?: boolean;
  /** UDT type script for UDT payments */
  udt_type_script?: FiberScript;
}

export interface SendPaymentResult {
  payment_hash: string;
  status: "Created" | "Inflight" | "Success" | "Failed";
  created_at: string;
  last_updated_at: string;
  failed_error: string | null;
  fee: string;
}

// --- get_payment ---

export interface GetPaymentParams {
  payment_hash: string;
}

// --- node_info ---

export interface NodeInfoResult {
  version: string;
  commit_hash: string;
  public_key: string;
  node_name: string;
  peer_id: string;
  addresses: string[];
  chain_hash: string;
  open_channel_auto_accept_min_ckb_funding_amount: string;
  auto_accept_channel_ckb_funding_amount: string;
  default_tlc_expiry_delta: string;
  tlc_min_value: string;
  tlc_max_value: string;
  tlc_fee_proportional_millionths: string;
  channel_count: number;
  pending_channel_count: number;
  peers_count: number;
}

// --- graph_nodes / graph_channels ---

export interface GraphNodesParams {
  limit?: number;
  after?: string;
}

export interface GraphNode {
  alias: string;
  node_id: string;
  addresses: string[];
  timestamp: string;
  chain_hash: string;
}

export interface GraphChannelsParams {
  limit?: number;
  after?: string;
}

export interface GraphChannel {
  channel_outpoint: string;
  funding_tx_block_number: string;
  node1: string;
  node2: string;
  last_updated_timestamp: string;
  created_timestamp: string;
  capacity: string;
  chain_hash: string;
  udt_type_script?: FiberScript;
}

// --- Generic JSON-RPC ---

export interface JsonRpcRequest {
  id: number;
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
}

export interface JsonRpcResponse<T = unknown> {
  id: number;
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
