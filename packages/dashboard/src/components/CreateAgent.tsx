import { useState } from "react";
import { agentsApi } from "../lib/api";

interface CreateAgentProps {
  onCreated: () => void;
}

export function CreateAgent({ onCreated }: CreateAgentProps) {
  const [type, setType] = useState<"dca" | "stream" | "commerce">("dca");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setCreating(true);
    setError("");

    try {
      let config: Record<string, unknown>;

      switch (type) {
        case "dca":
          config = {
            type: "dca",
            name: "DCA Agent",
            amountPerInterval: "100000000", // 1 CKB
            intervalMs: 10000, // 10 seconds
            totalPurchases: 10,
          };
          break;
        case "stream":
          config = {
            type: "stream",
            name: "Stream Agent",
            amountPerTick: "1000000", // 0.01 CKB
            tickIntervalMs: 1000, // 1 second
            recipient: "stream-demo",
            description: "Demo streaming payment",
          };
          break;
        case "commerce":
          config = {
            type: "commerce",
            name: "Commerce Agent",
            offeredServices: [
              {
                serviceId: "data-feed-1",
                name: "CKB Price Feed",
                description: "Real-time CKB price data",
                pricePerRequest: "1000000",
                category: "data_feed",
              },
            ],
            desiredServices: ["computation", "oracle"],
            maxPricePerRequest: "5000000",
            useAINegotiation: false,
          };
          break;
      }

      await agentsApi.create(config);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
      <h2 className="text-sm font-medium text-white mb-3">Create Agent</h2>

      <div className="flex gap-2 mb-3">
        {(["dca", "stream", "commerce"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              type === t
                ? "bg-ckb-green text-black"
                : "bg-ckb-dark text-ckb-muted hover:text-white border border-ckb-border"
            }`}
          >
            {t === "dca" ? "DCA" : t === "stream" ? "Stream" : "Commerce"}
          </button>
        ))}
      </div>

      <div className="mb-3 text-xs text-ckb-muted">
        {type === "dca" && "Periodic fixed-amount purchases via Fiber micropayments"}
        {type === "stream" && "Continuous pay-per-second micropayment stream"}
        {type === "commerce" && "Agent-to-agent marketplace for data and services"}
      </div>

      {error && (
        <div className="mb-3 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full px-4 py-2 text-sm font-medium rounded bg-ckb-green text-black hover:bg-ckb-green/90 disabled:opacity-50 transition-colors"
      >
        {creating ? "Creating..." : `Create ${type.toUpperCase()} Agent`}
      </button>
    </div>
  );
}
