// ============================================================
// Fiber Channel Management
// ============================================================
// Payment channels are the core of Fiber Network. Two parties
// lock CKB on-chain, then transact unlimited times off-chain.
// Channels only settle on-chain when closed, so the cost is:
//   - 1 on-chain tx to open
//   - unlimited free off-chain payments
//   - 1 on-chain tx to close
//
// This module wraps the channel lifecycle:
//   connect_peer → open_channel → (payments) → shutdown_channel
// ============================================================

import { FiberClient } from "./client.js";
import type {
  ConnectPeerParams,
  OpenChannelParams,
  OpenChannelResult,
  ListChannelsParams,
  ListChannelsResult,
  ShutdownChannelParams,
  ChannelInfo,
  NodeInfoResult,
} from "./types.js";

/**
 * High-level channel management API.
 *
 * Why a separate class instead of methods on FiberClient?
 * Separation of concerns — FiberClient handles transport (JSON-RPC),
 * this class handles channel business logic. This lets us:
 *   - Test channel logic without a real RPC connection (mock FiberClient)
 *   - Keep FiberClient lean and reusable for other modules
 */
export class FiberChannelManager {
  constructor(private client: FiberClient) {}

  /**
   * Connect to a peer node before opening a channel.
   *
   * Fiber requires an active peer connection before you can open
   * a channel with them. This is like dialing a phone before
   * you can start a conversation.
   *
   * @param address - Multiaddr format: /ip4/<ip>/tcp/<port>/p2p/<peer_id>
   *                  Example: "/ip4/18.162.235.225/tcp/8119/p2p/QmXen3..."
   */
  async connectPeer(address: string): Promise<void> {
    const params: ConnectPeerParams = { address };
    await this.client.call<null>("connect_peer", [params]);
  }

  /**
   * Open a payment channel with a connected peer.
   *
   * This creates an on-chain funding transaction that locks CKB.
   * Once confirmed (~30s on testnet), the channel moves to CHANNEL_READY
   * and off-chain payments can begin.
   *
   * @param peerId - The peer's ID (from their multiaddr)
   * @param fundingAmount - How much CKB to lock in the channel (hex shannons)
   * @param options - Additional channel parameters
   * @returns Temporary channel ID (replaced by permanent ID once funded)
   *
   * Why "temporary" channel ID?
   * The real channel ID is derived from the funding transaction's outpoint,
   * which doesn't exist until the tx is confirmed on-chain. The temporary
   * ID is used to track the channel during the funding process.
   */
  async openChannel(
    peerId: string,
    fundingAmount: string,
    options: Partial<Pick<OpenChannelParams, "public" | "funding_udt_type_script" | "shutdown_script" | "funding_fee_rate">> = {},
  ): Promise<OpenChannelResult> {
    const params: OpenChannelParams = {
      peer_id: peerId,
      funding_amount: fundingAmount,
      public: options.public ?? true,
      ...options,
    };
    return this.client.call<OpenChannelResult>("open_channel", [params]);
  }

  /**
   * List all payment channels, optionally filtered by peer.
   *
   * Returns live channel state including balances, HTLC count,
   * and channel status. This is the primary way to monitor
   * channel health.
   */
  async listChannels(peerId?: string): Promise<ChannelInfo[]> {
    const params: ListChannelsParams = peerId ? { peer_id: peerId } : {};
    const result = await this.client.call<ListChannelsResult>("list_channels", [params]);
    return result.channels;
  }

  /**
   * Get a specific channel by ID.
   * Convenience method — filters the list_channels result.
   */
  async getChannel(channelId: string): Promise<ChannelInfo | undefined> {
    const channels = await this.listChannels();
    return channels.find((ch) => ch.channel_id === channelId);
  }

  /**
   * Close a channel cooperatively.
   *
   * Cooperative close (force=false):
   *   Both parties agree on final balances → single on-chain tx
   *   This is the normal, happy-path close. Fast and cheap.
   *
   * Force close (force=true):
   *   Unilateral close — used if the peer is unresponsive.
   *   Broadcasts the latest commitment tx. Has a timelock delay
   *   before funds are spendable (the "commitment_delay_epoch").
   *   Use only as a last resort.
   *
   * @param channelId - The channel to close
   * @param closeScript - Where to send our balance after close
   * @param feeRate - Fee rate for the closing tx (hex, shannons/KB)
   * @param force - Whether to force-close (default: false)
   */
  async shutdownChannel(
    channelId: string,
    closeScript: ShutdownChannelParams["close_script"],
    feeRate: string = "0x3FC",
    force: boolean = false,
  ): Promise<void> {
    const params: ShutdownChannelParams = {
      channel_id: channelId,
      close_script: closeScript,
      fee_rate: feeRate,
      force,
    };
    await this.client.call<null>("shutdown_channel", [params]);
  }

  /**
   * Get information about the local Fiber node.
   * Includes peer ID, public key, connected peers count, etc.
   */
  async getNodeInfo(): Promise<NodeInfoResult> {
    return this.client.call<NodeInfoResult>("node_info");
  }

  /**
   * Wait for a channel to reach CHANNEL_READY state.
   *
   * After opening, a channel goes through:
   *   CHANNEL_NEGOTIATING → (funding tx confirmed) → CHANNEL_READY
   *
   * This polls list_channels until the channel is ready or timeout.
   * Used by agents before they start sending payments.
   *
   * @param channelId - The temporary or permanent channel ID
   * @param timeoutMs - Maximum wait time (default: 5 minutes)
   * @param pollIntervalMs - How often to check (default: 5 seconds)
   */
  async waitForChannelReady(
    channelId: string,
    timeoutMs: number = 300_000,
    pollIntervalMs: number = 5_000,
  ): Promise<ChannelInfo> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const channels = await this.listChannels();
      const channel = channels.find(
        (ch) =>
          ch.channel_id === channelId &&
          ch.state.state_name === "CHANNEL_READY",
      );
      if (channel) return channel;

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Channel ${channelId} did not reach READY state within ${timeoutMs}ms`,
    );
  }
}
