import { useState } from "react";
import { agentsApi } from "../lib/api";

interface CreateAgentProps {
  onCreated: () => void;
}

const AGENT_TYPES = [
  {
    key: "dca" as const,
    label: "DCA",
    icon: "\u21BB",
    desc: "Periodic fixed-amount purchases",
    color: "fiber",
  },
  {
    key: "stream" as const,
    label: "Stream",
    icon: "\u2192",
    desc: "Pay-per-second micropayments",
    color: "blue",
  },
  {
    key: "commerce" as const,
    label: "Commerce",
    icon: "\u2194",
    desc: "Agent-to-agent marketplace",
    color: "violet",
  },
];

const COLOR_MAP: Record<string, { selected: string; idle: string }> = {
  fiber: {
    selected: "border-fiber-500 bg-fiber-50 ring-1 ring-fiber-200",
    idle: "border-surface-200 hover:border-fiber-300 hover:bg-fiber-50/30",
  },
  blue: {
    selected: "border-blue-500 bg-blue-50 ring-1 ring-blue-200",
    idle: "border-surface-200 hover:border-blue-300 hover:bg-blue-50/30",
  },
  violet: {
    selected: "border-violet-500 bg-violet-50 ring-1 ring-violet-200",
    idle: "border-surface-200 hover:border-violet-300 hover:bg-violet-50/30",
  },
};

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
            amountPerInterval: "100000000",
            intervalMs: 10000,
            totalPurchases: 10,
          };
          break;
        case "stream":
          config = {
            type: "stream",
            name: "Stream Agent",
            amountPerTick: "1000000",
            tickIntervalMs: 1000,
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
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100">
        <h2 className="text-sm font-semibold text-surface-800">
          Create Agent
        </h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Type selector cards */}
        <div className="space-y-2">
          {AGENT_TYPES.map((t) => {
            const isSelected = type === t.key;
            const colors = COLOR_MAP[t.color];
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-150 text-left ${
                  isSelected ? colors.selected : colors.idle
                }`}
              >
                <span className="text-base">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-surface-800">
                    {t.label}
                  </span>
                  <p className="text-[11px] text-surface-400 mt-0.5 truncate">
                    {t.desc}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-fiber-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">
                      {"\u2713"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-fiber-500 to-fiber-600 text-white hover:from-fiber-600 hover:to-fiber-700 disabled:opacity-50 transition-all duration-150 shadow-sm shadow-fiber-500/20"
        >
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating...
            </span>
          ) : (
            `Create ${type.toUpperCase()} Agent`
          )}
        </button>
      </div>
    </div>
  );
}
