import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Layout } from "./components/Layout";
import { AgentCard } from "./components/AgentCard";
import { PaymentFeed } from "./components/PaymentFeed";
import { WalletInfo } from "./components/WalletInfo";
import { CreateAgent } from "./components/CreateAgent";
import { agentsApi } from "./lib/api";

export function App() {
  const { agents: wsAgents, events, connected } = useWebSocket();
  const [polledAgents, setPolledAgents] = useState<unknown[]>([]);

  // Use WebSocket agents when available, fall back to polled agents
  const agents = wsAgents.length > 0 ? wsAgents : polledAgents;

  // Fetch agents from REST API as a fallback / initial load
  const fetchAgents = useCallback(async () => {
    try {
      const data = await agentsApi.list();
      setPolledAgents(data);
    } catch {
      // Server might not be ready yet
    }
  }, []);

  // Poll on mount and periodically as backup
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
  const paymentCount = events.filter(
    (e) => (e as Record<string, unknown>).type === "payment:sent"
  ).length;

  return (
    <Layout connected={connected}>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Agents" value={String(agents.length)} icon={"\u2B22"} />
        <StatCard
          label="Active"
          value={String(activeCount)}
          icon={"\u25B6"}
          accent={activeCount > 0}
        />
        <StatCard label="Events" value={String(events.length)} icon={"\u26A1"} />
        <StatCard
          label="Payments"
          value={String(paymentCount)}
          icon={"\u2191"}
          accent={paymentCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Agents + Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agents section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-surface-800">
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
                  Create a DCA, Stream, or Commerce agent to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Payment Feed */}
          <PaymentFeed events={events} />
        </div>

        {/* Right column: Controls */}
        <div className="space-y-6">
          <CreateAgent onCreated={handleRefresh} />
          <WalletInfo />
        </div>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 px-5 py-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-medium text-surface-400">
          {label}
        </span>
        <span className={`text-sm ${accent ? "text-fiber-500" : "text-surface-300"}`}>
          {icon}
        </span>
      </div>
      <p
        className={`text-2xl font-bold tracking-tight tabular-nums ${
          accent ? "text-fiber-600" : "text-surface-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
