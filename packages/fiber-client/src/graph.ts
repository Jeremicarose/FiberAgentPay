// ============================================================
// Fiber Network Graph Queries
// ============================================================
// The network graph is a map of all public nodes and channels.
// Agents use this for:
//   - Service discovery (commerce agent finds other agents)
//   - Route planning (understanding network topology)
//   - Health monitoring (checking connectivity)
// ============================================================

import { FiberClient } from "./client.js";
import type {
  GraphNodesParams,
  GraphNode,
  GraphChannelsParams,
  GraphChannel,
} from "./types.js";

export class FiberGraphManager {
  constructor(private client: FiberClient) {}

  /**
   * List nodes in the Fiber network graph.
   *
   * Returns public nodes that have announced themselves.
   * The commerce agent uses this to discover other agents
   * offering services on the network.
   *
   * @param limit - Max nodes to return (for pagination)
   * @param after - Cursor for pagination (node_id of last result)
   */
  async getNodes(limit?: number, after?: string): Promise<GraphNode[]> {
    const params: GraphNodesParams = { limit, after };
    const result = await this.client.call<{ nodes: GraphNode[] }>(
      "graph_nodes",
      [params],
    );
    return result.nodes;
  }

  /**
   * List channels in the network graph.
   *
   * Shows all public channels between nodes, including capacity
   * and last-updated timestamps. Useful for understanding how
   * much liquidity is available in the network.
   *
   * @param limit - Max channels to return
   * @param after - Cursor for pagination
   */
  async getChannels(
    limit?: number,
    after?: string,
  ): Promise<GraphChannel[]> {
    const params: GraphChannelsParams = { limit, after };
    const result = await this.client.call<{ channels: GraphChannel[] }>(
      "graph_channels",
      [params],
    );
    return result.channels;
  }
}
