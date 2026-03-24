import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { Layout } from "../components/Layout";
import { AgentCard } from "../components/AgentCard";
import { PaymentFeed } from "../components/PaymentFeed";
import { WalletInfo } from "../components/WalletInfo";
import { CreateAgent } from "../components/CreateAgent";
import { EconomyGraph } from "../components/EconomyGraph";
import { agentsApi } from "../lib/api";

export function DashboardPage() {
  const { agents: wsAgents, events, connected } = useWebSocket();
  const [polledAgents, setPolledAgents] = useState<unknown[]>([]);

  const agents = wsAgents.length > 0 ? wsAgents : polledAgents;

  const fetchAgents = useCallback(async () => {
    try {
      const data = await agentsApi.list();
      setPolledAgents(data);
    } catch {
      // Server might not be ready yet
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  function handleRefresh() {
    fetchAgents();
  }

  const activeCount = agents.filter(
    (a) => (a as Record<string, unknown>).status === "running"
  ).length;
  const paymentEvents = events.filter(
    (e) => {
      const type = (e as Record<string, unknown>).type as string;
      return type === "payment:sent" || type === "payment:received";
    }
  );
  const onChainCount = paymentEvents.filter((e) => {
    const payment = (e as Record<string, unknown>).payment as Record<string, unknown> | undefined;
    return !!payment?.onChainTxHash;
  }).length;

  // Calculate total economy volume
  const totalVolume = paymentEvents.reduce((sum, e) => {
    const payment = (e as Record<string, unknown>).payment as Record<string, unknown> | undefined;
    const amt = String(payment?.amount ?? "0").replace(/n$/, "");
    return sum + Number(amt) / 1e8;
  }, 0);

  return (
    <Layout connected={connected}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Compact stats row */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <Pill label="Agents" value={String(agents.length)} />
          <Pill label="Active" value={String(activeCount)} accent={activeCount > 0} />
          <Pill label="On-Chain TXs" value={String(onChainCount)} accent={onChainCount > 0} />
          <Pill label="Volume" value={`${totalVolume.toFixed(0)} CKB`} accent={totalVolume > 0} />
          <Pill label="Events" value={String(events.length)} />
        </div>

        {/* Economy visualization — hero section */}
        {agents.length >= 2 && (
          <div className="mb-5">
            <EconomyGraph agents={agents} events={events} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: Agents + Feed */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-surface-800">
                  Agents
                </h2>
                <span className="text-xs font-medium text-surface-400">
                  {agents.length} agent{agents.length !== 1 ? "s" : ""}
                </span>
              </div>

              {agents.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-surface-400 text-xl">{"\u2B22"}</span>
                  </div>
                  <p className="text-sm font-medium text-surface-600 mb-1">
                    No agents yet
                  </p>
                  <p className="text-xs text-surface-400">
                    Create Commerce agents to launch the economy.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {agents.map((agent) => {
                    const a = agent as Record<string, unknown>;
                    const config = a.config as Record<string, unknown>;
                    return (
                      <AgentCard
                        key={config.id as string}
                        agent={a}
                        onRefresh={handleRefresh}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <PaymentFeed events={events} />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <CreateAgent onCreated={handleRefresh} />
            <WalletInfo />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
      accent
        ? "bg-fiber-50 border-fiber-200 text-fiber-700"
        : "bg-white border-surface-200 text-surface-600"
    }`}>
      <span className="text-surface-400 uppercase tracking-wider text-[9px]">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ? "text-fiber-600" : "text-surface-800"}`}>
        {value}
      </span>
    </div>
  );
}
