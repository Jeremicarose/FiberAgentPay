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
    // Fetch fresh data immediately after create/stop/remove
    fetchAgents();
  }

  return (
    <Layout connected={connected}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Agents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Agents</h2>
            <span className="text-xs text-ckb-muted">
              {agents.length} agent{agents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {agents.length === 0 ? (
            <div className="bg-ckb-card border border-ckb-border rounded-lg p-8 text-center">
              <p className="text-ckb-muted text-sm mb-2">No agents yet</p>
              <p className="text-ckb-muted text-xs">
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

          {/* Payment Feed */}
          <PaymentFeed events={events} />
        </div>

        {/* Right column: Controls */}
        <div className="space-y-4">
          <CreateAgent onCreated={handleRefresh} />
          <WalletInfo />

          {/* Quick Stats */}
          <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-white mb-3">Stats</h2>
            <div className="space-y-2">
              <StatRow
                label="Active Agents"
                value={String(
                  agents.filter(
                    (a) =>
                      (a as Record<string, unknown>).status === "running",
                  ).length,
                )}
              />
              <StatRow label="Total Events" value={String(events.length)} />
              <StatRow
                label="Total Payments"
                value={String(
                  events.filter(
                    (e) =>
                      (e as Record<string, unknown>).type === "payment:sent",
                  ).length,
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-ckb-muted">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}
