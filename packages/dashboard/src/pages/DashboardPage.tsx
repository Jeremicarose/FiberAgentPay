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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* === EMPTY STATE: Welcome Hero === */}
        {agents.length === 0 ? (
          <div className="animate-fade-in">
            <div className="text-center max-w-3xl mx-auto pt-12 pb-14">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-fiber-500 to-violet-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-fiber-500/25">
                <span className="text-white text-3xl font-black">F</span>
              </div>
              <h1 className="text-5xl font-black text-surface-900 mb-4 tracking-tight">
                AI Agent Economy
              </h1>
              <p className="text-surface-500 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
                Watch autonomous AI agents trade services with each other using real
                cryptocurrency on CKB. Every payment is a verifiable on-chain transaction.
              </p>

              {/* Pipeline flow diagram */}
              <div className="grid grid-cols-3 gap-6 mb-10 max-w-2xl mx-auto">
                <StepCard step="1" title="Commerce" desc="Agents discover and buy services from each other" />
                <StepCard step="2" title="Stream" desc="Continuous micropayments for ongoing service access" />
                <StepCard step="3" title="DCA" desc="Periodic reinvestment of profits back into the economy" />
              </div>

              {/* Primary: Pipeline Economy */}
              <button
                onClick={handleLaunchPipeline}
                disabled={launching}
                className="px-10 py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-violet-600 via-fiber-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-xl shadow-fiber-500/30"
              >
                {launching && launchType === "pipeline" ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating pipeline (funding wallets...)
                  </span>
                ) : (
                  "Launch Pipeline Economy"
                )}
              </button>
              <p className="text-sm text-surface-400 mt-4 font-medium">
                Commerce finds opportunity, Stream pays for it, DCA reinvests profits
              </p>

              {/* Secondary: Simple Economy */}
              <button
                onClick={handleLaunchEconomy}
                disabled={launching}
                className="mt-5 px-6 py-2.5 text-sm font-semibold rounded-xl border border-surface-200 text-surface-500 hover:text-surface-700 hover:border-surface-300 disabled:opacity-50 transition-all"
              >
                {launching && launchType === "economy" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-surface-300 border-t-surface-600 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Or launch simple 3-agent commerce economy"
                )}
              </button>
            </div>

            {/* Still show wallet + manual create below */}
            <div className="max-w-md mx-auto space-y-6">
              <WalletInfo />
            </div>
          </div>
        ) : (
          /* === ACTIVE STATE: Economy Dashboard === */
          <div className="animate-fade-in">
            {/* Live economy banner */}
            {activeCount > 0 && (
              <div className="mb-6 px-6 py-4 rounded-2xl bg-gradient-to-r from-fiber-50 to-violet-50 border border-fiber-200/50 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-fiber-500 status-pulse" />
                  <span className="text-base font-semibold text-surface-800">
                    Economy is live — {activeCount} agent{activeCount !== 1 ? "s" : ""} trading autonomously
                  </span>
                </div>
                <div className="flex items-center gap-5 text-sm font-semibold text-surface-500">
                  <span>{onChainTxs.size} on-chain tx{onChainTxs.size !== 1 ? "s" : ""}</span>
                  <span>{totalVolumeCkb.toFixed(0)} CKB traded</span>
                </div>
              </div>
            )}

            {/* Stat pills */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <Pill label="Agents" value={String(agents.length)} />
              <Pill label="Active" value={String(activeCount)} accent={activeCount > 0} />
              <Pill label="On-Chain" value={String(onChainTxs.size)} accent={onChainTxs.size > 0} />
              <Pill label="Volume" value={`${totalVolumeCkb.toFixed(0)} CKB`} accent={totalVolumeCkb > 0} />
            </div>

            {/* Economy visualization */}
            {agents.length >= 2 && (
              <div className="mb-6">
                <EconomyGraph agents={agents} events={events} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Agents + Feed */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-surface-900">Agents</h2>
                    <span className="text-sm font-medium text-surface-400">{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-6">
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
      <div className="w-11 h-11 rounded-full bg-fiber-100 text-fiber-700 flex items-center justify-center mx-auto mb-3 text-sm font-black">
        {step}
      </div>
      <p className="text-base font-bold text-surface-900 mb-1">{title}</p>
      <p className="text-sm text-surface-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
      accent ? "bg-fiber-50 border-fiber-200 text-fiber-700" : "bg-white border-surface-200 text-surface-600"
    }`}>
      <span className="text-surface-400 uppercase tracking-wider text-xs font-semibold">{label}</span>
      <span className={`font-bold tabular-nums ${accent ? "text-fiber-600" : "text-surface-800"}`}>{value}</span>
    </div>
  );
}
