import { agentsApi } from "../lib/api";

interface AgentCardProps {
  agent: Record<string, unknown>;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  idle: { color: "text-surface-500", bg: "bg-surface-100", dot: "bg-surface-400", label: "Idle" },
  running: { color: "text-fiber-700", bg: "bg-fiber-50", dot: "bg-fiber-500", label: "Running" },
  paused: { color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-400", label: "Paused" },
  stopped: { color: "text-surface-500", bg: "bg-surface-100", dot: "bg-surface-400", label: "Stopped" },
  error: { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-400", label: "Error" },
};

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; border: string }> = {
  dca: { label: "DCA", icon: "\u21BB", color: "text-fiber-600", border: "border-fiber-300" },
  stream: { label: "Stream", icon: "\u2192", color: "text-blue-600", border: "border-blue-300" },
  commerce: { label: "Commerce", icon: "\u2194", color: "text-violet-600", border: "border-violet-300" },
};

export function AgentCard({ agent, onRefresh }: AgentCardProps) {
  const config = agent.config as Record<string, unknown>;
  const status = agent.status as string;
  const id = config.id as string;
  const type = config.type as string;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const typeCfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.dca;

  const address = (agent.address as string) || "";
  const earnings = agent.earnings as string | undefined;
  const balance = agent.balance as string | undefined;
  const spent = agent.totalSpent as string | undefined;

  const earningsNum = parseShannons(earnings);
  const spentNum = parseShannons(spent);
  const net = earningsNum - spentNum;

  async function handleAction(action: "start" | "stop" | "pause" | "resume") {
    try {
      switch (action) {
        case "start": await agentsApi.start(id); break;
        case "stop": await agentsApi.stop(id); break;
        case "pause": await agentsApi.pause(id); break;
        case "resume": await agentsApi.resume(id); break;
      }
      onRefresh();
    } catch (err) {
      console.error(`Failed to ${action} agent:`, err);
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-card card-interactive border p-4 animate-fade-in ${
      status === "running" ? "border-fiber-200/80" : "border-surface-200/50"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-base ${typeCfg.color}`}>{typeCfg.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-surface-800 truncate">
              {config.name as string}
            </h3>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${status === "running" ? "status-pulse" : ""}`} />
          {statusCfg.label}
        </div>
      </div>

      {/* Wallet address */}
      {address && (
        <div className="mb-2.5 px-2 py-1 bg-surface-50 rounded-md">
          <p className="text-[10px] font-mono text-surface-400 truncate">{address}</p>
        </div>
      )}

      {/* Economy stats — 2x2 grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        <MiniStat label="Earned" value={formatShannons(earnings)} color="text-fiber-600" />
        <MiniStat label="Spent" value={formatShannons(spent)} color="text-blue-600" />
        <MiniStat label="Balance" value={formatShannons(balance)} color="text-surface-700" />
        <MiniStat
          label="Net P&L"
          value={`${net >= 0 ? "+" : ""}${(net / 1e8).toFixed(0)} CKB`}
          color={net >= 0 ? "text-fiber-600" : "text-red-500"}
        />
      </div>

      {/* Error display */}
      {agent.error ? (
        <div className="mb-2.5 px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg text-[10px] text-red-600 leading-relaxed">
          {String(agent.error)}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-1.5">
        {status === "idle" && (
          <ActionButton onClick={() => handleAction("start")} variant="primary">Start</ActionButton>
        )}
        {status === "running" && (
          <>
            <ActionButton onClick={() => handleAction("pause")} variant="warning">Pause</ActionButton>
            <ActionButton onClick={() => handleAction("stop")} variant="danger">Stop</ActionButton>
          </>
        )}
        {status === "paused" && (
          <>
            <ActionButton onClick={() => handleAction("resume")} variant="primary">Resume</ActionButton>
            <ActionButton onClick={() => handleAction("stop")} variant="danger">Stop</ActionButton>
          </>
        )}
        {(status === "stopped" || status === "error") && (
          <ActionButton onClick={() => agentsApi.remove(id).then(onRefresh)} variant="ghost">Remove</ActionButton>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-50 rounded-lg px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider font-medium text-surface-400">{label}</p>
      <p className={`text-xs font-semibold truncate tabular-nums ${color ?? "text-surface-800"}`}>{value}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  variant,
  children,
}: {
  onClick: () => void;
  variant: "primary" | "warning" | "danger" | "ghost";
  children: React.ReactNode;
}) {
  const styles = {
    primary: "bg-fiber-500 text-white hover:bg-fiber-600 shadow-sm shadow-fiber-500/20",
    warning: "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
    danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
    ghost: "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all duration-150 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function formatShannons(value: string | undefined): string {
  if (!value || value === "0" || value === "0n") return "0 CKB";
  const clean = value.replace(/n$/, "");
  const num = Number(clean) / 1e8;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k CKB`;
  return `${num.toFixed(0)} CKB`;
}

function parseShannons(value: string | undefined): number {
  if (!value || value === "0" || value === "0n") return 0;
  return Number(value.replace(/n$/, ""));
}
