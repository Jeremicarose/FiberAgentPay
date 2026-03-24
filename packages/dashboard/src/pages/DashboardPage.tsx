import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { Layout } from "../components/Layout";
import { AgentCard } from "../components/AgentCard";
import { PaymentFeed } from "../components/PaymentFeed";
import { WalletInfo } from "../components/WalletInfo";
import { CreateAgent } from "../components/CreateAgent";
import { EconomyGraph } from "../components/EconomyGraph";
import { agentsApi } from "../lib/api";

/** Commerce agent presets — duplicated here for the launch button */
const ECONOMY_PRESETS = [
  {
    type: "commerce", name: "Data Provider",
    offeredServices: [{ serviceId: "weather-1", name: "Weather Data", description: "Real-time weather feed", pricePerRequest: "4000000000", category: "data_feed", providerId: "", providerAddress: "", isActive: true }],
    desiredServices: ["computation"], maxPricePerRequest: "10000000000", reinvestPercent: 80,
  },
  {
    type: "commerce", name: "Analyst",
    offeredServices: [{ serviceId: "analysis-1", name: "Market Analysis", description: "AI-powered market analysis", pricePerRequest: "8000000000", category: "computation", providerId: "", providerAddress: "", isActive: true }],
    desiredServices: ["data_feed"], maxPricePerRequest: "10000000000", reinvestPercent: 80,
  },
  {
    type: "commerce", name: "Compute Node",
    offeredServices: [{ serviceId: "compute-1", name: "Fast Compute", description: "Low-cost computation service", pricePerRequest: "2000000000", category: "computation", providerId: "", providerAddress: "", isActive: true }],
    desiredServices: ["computation"], maxPricePerRequest: "10000000000", reinvestPercent: 80,
  },
];

export function DashboardPage() {
  const { agents: wsAgents, events, connected } = useWebSocket();
  const [polledAgents, setPolledAgents] = useState<unknown[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchType, setLaunchType] = useState<"pipeline" | "economy" | null>(null);

  const agents = wsAgents.length > 0 ? wsAgents : polledAgents;

  const fetchAgents = useCallback(async () => {
    try {
      const data = await agentsApi.list();
      setPolledAgents(data);
    } catch { /* Server might not be ready */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const activeCount = agents.filter(
    (a) => (a as Record<string, unknown>).status === "running"
  ).length;

  const onChainTxs = new Set<string>();
  let totalVolumeCkb = 0;
  for (const raw of events) {
    const e = raw as Record<string, unknown>;
    if (e.type !== "payment:sent" && e.type !== "payment:received") continue;
    const payment = e.payment as Record<string, unknown> | undefined;
    const amt = String(payment?.amount ?? "0").replace(/n$/, "");
    totalVolumeCkb += Number(amt) / 1e8;
    const hash = payment?.onChainTxHash as string | undefined;
    if (hash) onChainTxs.add(hash);
  }

  async function handleLaunchPipeline() {
    setLaunching(true);
    setLaunchType("pipeline");
    try {
      await agentsApi.launchPipeline();
      fetchAgents();
    } catch (err) {
      console.error("Pipeline launch failed:", err);
    } finally {
      setLaunching(false);
      setLaunchType(null);
    }
  }

  async function handleLaunchEconomy() {
    setLaunching(true);
    setLaunchType("economy");
    try {
      const ids: string[] = [];
      for (const preset of ECONOMY_PRESETS) {
        const result = await agentsApi.create(preset as Record<string, unknown>) as Record<string, unknown>;
        const config = result.config as Record<string, unknown>;
        ids.push(config.id as string);
      }
      for (const id of ids) {
        await agentsApi.start(id);
      }
      fetchAgents();
    } catch (err) {
      console.error("Launch failed:", err);
    } finally {
      setLaunching(false);
      setLaunchType(null);
    }
  }

  // Build agent name map for the PaymentFeed
  const agentNames: Record<string, string> = {};
  const agentAddressToName: Record<string, string> = {};
  for (const raw of agents) {
    const a = raw as Record<string, unknown>;
    const config = a.config as Record<string, unknown>;
    const id = config.id as string;
    const name = config.name as string;
    agentNames[id] = name;
    const addr = a.address as string;
    if (addr) agentAddressToName[addr] = name;
  }

  return (
    <Layout connected={connected}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* === EMPTY STATE: Welcome Hero === */}
        {agents.length === 0 ? (
          <div className="animate-fade-in">
            <div className="text-center max-w-2xl mx-auto pt-8 pb-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fiber-500 to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-fiber-500/20">
                <span className="text-white text-2xl font-bold">F</span>
              </div>
              <h1 className="text-2xl font-bold text-surface-900 mb-3">
                AI Agent Economy on CKB
              </h1>
              <p className="text-surface-500 text-sm leading-relaxed mb-8 max-w-lg mx-auto">
                Watch autonomous AI agents trade services with each other using real
                cryptocurrency on the CKB blockchain. Every payment is a real
                on-chain transaction you can verify.
              </p>

              {/* Pipeline flow diagram */}
              <div className="grid grid-cols-3 gap-2 mb-8 max-w-lg mx-auto">
                <StepCard step="1" title="Commerce" desc="Agents discover and buy services from each other" />
                <StepCard step="2" title="Stream" desc="Continuous micropayments for ongoing service access" />
                <StepCard step="3" title="DCA" desc="Periodic reinvestment of profits back into the economy" />
              </div>

              {/* Primary: Pipeline Economy */}
              <button
                onClick={handleLaunchPipeline}
                disabled={launching}
                className="px-8 py-3.5 text-base font-bold rounded-xl bg-gradient-to-r from-violet-600 via-fiber-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-fiber-500/25"
              >
                {launching && launchType === "pipeline" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating pipeline (funding wallets...)
                  </span>
                ) : (
                  "Launch Pipeline Economy"
                )}
              </button>
              <p className="text-xs text-surface-400 mt-3">
                Commerce finds opportunity, Stream pays for it, DCA reinvests profits
              </p>

              {/* Secondary: Simple Economy */}
              <button
                onClick={handleLaunchEconomy}
                disabled={launching}
                className="mt-4 px-5 py-2 text-xs font-medium rounded-lg border border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300 disabled:opacity-50 transition-all"
              >
                {launching && launchType === "economy" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-surface-300 border-t-surface-600 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Or launch simple 3-agent commerce economy"
                )}
              </button>
            </div>

            {/* Still show wallet + manual create below */}
            <div className="max-w-sm mx-auto space-y-5">
              <WalletInfo />
            </div>
          </div>
        ) : (
          /* === ACTIVE STATE: Economy Dashboard === */
          <div className="animate-fade-in">
            {/* Live economy banner */}
            {activeCount > 0 && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fiber-50 to-violet-50 border border-fiber-200/50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-fiber-500 status-pulse" />
                  <span className="text-sm font-medium text-surface-700">
                    Economy is live — {activeCount} agent{activeCount !== 1 ? "s" : ""} trading autonomously
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-surface-500">
                  <span>{onChainTxs.size} on-chain tx{onChainTxs.size !== 1 ? "s" : ""}</span>
                  <span>{totalVolumeCkb.toFixed(0)} CKB traded</span>
                </div>
              </div>
            )}

            {/* Compact stat pills */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Pill label="Agents" value={String(agents.length)} />
              <Pill label="Active" value={String(activeCount)} accent={activeCount > 0} />
              <Pill label="On-Chain" value={String(onChainTxs.size)} accent={onChainTxs.size > 0} />
              <Pill label="Volume" value={`${totalVolumeCkb.toFixed(0)} CKB`} accent={totalVolumeCkb > 0} />
            </div>

            {/* Economy visualization */}
            {agents.length >= 2 && (
              <div className="mb-5">
                <EconomyGraph agents={agents} events={events} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: Agents + Feed */}
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-surface-800">Agents</h2>
                    <span className="text-xs text-surface-400">{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {agents.map((agent) => {
                      const a = agent as Record<string, unknown>;
                      const config = a.config as Record<string, unknown>;
                      return (
                        <AgentCard
                          key={config.id as string}
                          agent={a}
                          onRefresh={fetchAgents}
                        />
                      );
                    })}
                  </div>
                </div>

                <PaymentFeed
                  events={events}
                  agentNames={agentNames}
                  agentAddressToName={agentAddressToName}
                />
              </div>

              {/* Right: Create + Wallet */}
              <div className="space-y-5">
                <CreateAgent onCreated={fetchAgents} hasAgents={agents.length > 0} />
                <WalletInfo />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-8 h-8 rounded-full bg-fiber-100 text-fiber-600 flex items-center justify-center mx-auto mb-2 text-xs font-bold">
        {step}
      </div>
      <p className="text-xs font-semibold text-surface-800 mb-1">{title}</p>
      <p className="text-[10px] text-surface-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
      accent ? "bg-fiber-50 border-fiber-200 text-fiber-700" : "bg-white border-surface-200 text-surface-600"
    }`}>
      <span className="text-surface-400 uppercase tracking-wider text-[9px]">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ? "text-fiber-600" : "text-surface-800"}`}>{value}</span>
    </div>
  );
}
