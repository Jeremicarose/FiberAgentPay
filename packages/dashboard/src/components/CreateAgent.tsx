import { useState } from "react";
import { agentsApi } from "../lib/api";

interface CreateAgentProps {
  onCreated: () => void;
  hasAgents?: boolean;
}

type AgentTypeKey = "dca" | "stream" | "commerce";

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

/**
 * Pre-built Commerce agent presets for the 3-agent circular economy.
 * Each sells one service and wants another — forming a trading loop.
 */
const COMMERCE_PRESETS = [
  {
    label: "Data Provider",
    desc: "Sells weather data, buys compute",
    config: {
      type: "commerce",
      name: "Data Provider",
      offeredServices: [{
        serviceId: "weather-1",
        name: "Weather Data",
        description: "Real-time weather feed",
        pricePerRequest: "4000000000",
        category: "data_feed",
        providerId: "",
        providerAddress: "",
        isActive: true,
      }],
      desiredServices: ["computation"],
      maxPricePerRequest: "10000000000",
      reinvestPercent: 80,
    },
  },
  {
    label: "Analyst",
    desc: "Sells analysis, buys data feeds",
    config: {
      type: "commerce",
      name: "Analyst",
      offeredServices: [{
        serviceId: "analysis-1",
        name: "Market Analysis",
        description: "AI-powered market analysis",
        pricePerRequest: "8000000000",
        category: "computation",
        providerId: "",
        providerAddress: "",
        isActive: true,
      }],
      desiredServices: ["data_feed"],
      maxPricePerRequest: "10000000000",
      reinvestPercent: 80,
    },
  },
  {
    label: "Compute Node",
    desc: "Sells cheap compute, buys analysis",
    config: {
      type: "commerce",
      name: "Compute Node",
      offeredServices: [{
        serviceId: "compute-1",
        name: "Fast Compute",
        description: "Low-cost computation service",
        pricePerRequest: "2000000000",
        category: "computation",
        providerId: "",
        providerAddress: "",
        isActive: true,
      }],
      desiredServices: ["computation"],
      maxPricePerRequest: "10000000000",
      reinvestPercent: 80,
    },
  },
];

export function CreateAgent({ onCreated, hasAgents = false }: CreateAgentProps) {
  const [type, setType] = useState<AgentTypeKey>("commerce");
  const [creating, setCreating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(0);

  /** One-click: create all 3 Commerce agents and start them */
  async function handleLaunchEconomy() {
    setLaunching(true);
    setError("");
    try {
      const ids: string[] = [];
      for (const preset of COMMERCE_PRESETS) {
        const result = await agentsApi.create(preset.config) as Record<string, unknown>;
        const config = result.config as Record<string, unknown>;
        ids.push(config.id as string);
      }
      // Start all agents
      for (const id of ids) {
        await agentsApi.start(id);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch economy");
    } finally {
      setLaunching(false);
    }
  }

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
            amountPerInterval: "6100000000",
            intervalMs: 15000,
            totalPurchases: 10,
          };
          break;
        case "stream":
          config = {
            type: "stream",
            name: "Stream Agent",
            amountPerTick: "6100000000",
            tickIntervalMs: 5000,
            recipient: "",
            description: "Demo streaming payment",
          };
          break;
        case "commerce":
          config = COMMERCE_PRESETS[selectedPreset].config;
          break;
      }

      await agentsApi.create(config);
      // Auto-advance preset so next click creates the next agent
      if (type === "commerce") {
        setSelectedPreset((prev) => (prev + 1) % COMMERCE_PRESETS.length);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-100">
        <h2 className="text-lg font-bold text-surface-900">
          Create Agent
        </h2>
      </div>

      {/* One-click economy launcher — only show when no agents exist */}
      {!hasAgents && (
        <>
          <div className="px-6 pt-5 pb-3">
            <button
              onClick={handleLaunchEconomy}
              disabled={launching}
              className="w-full px-4 py-3.5 text-sm font-bold rounded-xl bg-gradient-to-r from-violet-600 via-fiber-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-md shadow-fiber-500/25"
            >
              {launching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Launching Economy...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {"\u26A1"} Launch 3-Agent Economy
                </span>
              )}
            </button>
            <p className="text-xs text-surface-400 text-center mt-2">
              Creates Data Provider + Analyst + Compute Node and starts them
            </p>
          </div>

          <div className="px-6 py-2">
            <div className="border-t border-surface-100" />
            <p className="text-xs font-medium text-surface-400 text-center py-2">or create individually</p>
          </div>
        </>
      )}

      {hasAgents && (
        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-surface-500 text-center">Add another agent to the economy</p>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Type selector cards */}
        <div className="space-y-2">
          {AGENT_TYPES.map((t) => {
            const isSelected = type === t.key;
            const colors = COLOR_MAP[t.color];
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 text-left ${
                  isSelected ? colors.selected : colors.idle
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-surface-800">
                    {t.label}
                  </span>
                  <p className="text-xs text-surface-400 mt-0.5 truncate">
                    {t.desc}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-fiber-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">
                      {"\u2713"}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Commerce preset selector */}
        {type === "commerce" && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider font-bold text-surface-400">
              Agent Role
            </p>
            {COMMERCE_PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => setSelectedPreset(i)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all duration-150 ${
                  selectedPreset === i
                    ? "border-violet-400 bg-violet-50/50 ring-1 ring-violet-200"
                    : "border-surface-200/80 hover:border-violet-200 hover:bg-violet-50/20"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-surface-700">
                    {preset.label}
                  </span>
                  <p className="text-xs text-surface-400 truncate">
                    {preset.desc}
                  </p>
                </div>
                {selectedPreset === i && (
                  <span className="text-violet-500 text-xs font-bold">{"\u2713"}</span>
                )}
              </button>
            ))}
            <p className="text-xs text-surface-400 leading-relaxed mt-1">
              Create all 3 roles, then start them to see the circular economy.
            </p>
          </div>
        )}

        {error && (
          <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full px-4 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-fiber-500 to-fiber-600 text-white hover:from-fiber-600 hover:to-fiber-700 disabled:opacity-50 transition-all duration-150 shadow-sm shadow-fiber-500/20"
        >
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating...
            </span>
          ) : type === "commerce" ? (
            `Create "${COMMERCE_PRESETS[selectedPreset].label}"`
          ) : (
            `Create ${type.toUpperCase()} Agent`
          )}
        </button>
      </div>
    </div>
  );
}
