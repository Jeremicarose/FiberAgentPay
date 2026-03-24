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

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; border: string; desc: string }> = {
  dca: { label: "DCA", icon: "\u21BB", color: "text-fiber-600", border: "border-fiber-300", desc: "Makes periodic purchases on a schedule" },
  stream: { label: "Stream", icon: "\u2192", color: "text-blue-600", border: "border-blue-300", desc: "Sends continuous micropayments over time" },
  commerce: { label: "Commerce", icon: "\u2194", color: "text-violet-600", border: "border-violet-300", desc: "Buys and sells services with other agents" },
};

/** Pipeline-specific role descriptions (matched by agent name) */
const PIPELINE_ROLES: Record<string, string> = {
  "Payment Stream": "Continuously pays Data Provider for service access",
  "Reinvestor": "Periodically reinvests profits into Payment Stream",
  "Data Provider": "Sells weather data, earns from Analyst and Stream",
  "Analyst": "Buys data feeds, sells market analysis",
};

export function AgentCard({ agent, onRefresh }: AgentCardProps) {
  const config = agent.config as Record<string, unknown>;
  const status = agent.status as string;
  const id = config.id as string;
  const type = config.type as string;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const typeCfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.dca;
  const agentName = (config.name as string) || "";
  const roleDesc = PIPELINE_ROLES[agentName] || typeCfg.desc;

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
    <div className={`bg-white rounded-2xl shadow-card card-interactive border p-5 animate-fade-in ${
      status === "running" ? "border-fiber-200/80" : "border-surface-200/50"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xl ${typeCfg.color}`}>{typeCfg.icon}</span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-surface-900 truncate">
              {config.name as string}
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">{roleDesc}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot} ${status === "running" ? "status-pulse" : ""}`} />
          {statusCfg.label}
        </div>
      </div>

      {/* Wallet address */}
      {address && (
        <div className="mb-3 px-3 py-1.5 bg-surface-50 rounded-lg">
          <p className="text-xs font-mono text-surface-400 truncate">{address}</p>
        </div>
      )}

      {/* Economy stats — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <MiniStat label="Revenue" value={formatShannons(earnings)} color="text-fiber-600" />
        <MiniStat label="Spent" value={formatShannons(spent)} color="text-blue-600" />
        <MiniStat label="Wallet" value={formatShannons(balance)} color="text-surface-700" />
        <MiniStat
          label="Profit"
          value={`${net >= 0 ? "+" : ""}${(net / 1e8).toFixed(0)} CKB`}
          color={net >= 0 ? "text-fiber-600" : "text-red-500"}
        />
      </div>

      {/* Error display */}
      {agent.error ? (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 leading-relaxed">
          {String(agent.error)}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-2">
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
    <div className="bg-surface-50 rounded-xl px-3 py-2">
      <p className="text-xs uppercase tracking-wider font-semibold text-surface-400 mb-0.5">{label}</p>
      <p className={`text-sm font-bold truncate tabular-nums ${color ?? "text-surface-800"}`}>{value}</p>
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
      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${styles[variant]}`}
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
