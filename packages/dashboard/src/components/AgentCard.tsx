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

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  dca: { label: "DCA", icon: "\u21BB", color: "text-fiber-700", bg: "bg-fiber-50 border-fiber-200" },
  stream: { label: "Stream", icon: "\u2192", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  commerce: { label: "Commerce", icon: "\u2194", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
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

  // Calculate net profit/loss
  const earningsNum = parseShannons(earnings);
  const spentNum = parseShannons(spent);
  const net = earningsNum - spentNum;

  async function handleAction(action: "start" | "stop" | "pause" | "resume") {
    try {
      switch (action) {
        case "start":
          await agentsApi.start(id);
          break;
        case "stop":
          await agentsApi.stop(id);
          break;
        case "pause":
          await agentsApi.pause(id);
          break;
        case "resume":
          await agentsApi.resume(id);
          break;
      }
      onRefresh();
    } catch (err) {
      console.error(`Failed to ${action} agent:`, err);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card card-interactive border border-surface-200/50 p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg ${typeCfg.bg}`}>
            <span className={typeCfg.color}>{typeCfg.icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-800">
              {config.name as string}
            </h3>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${typeCfg.color}`}>
              {typeCfg.label} Agent
            </span>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${status === "running" ? "status-pulse" : ""}`} />
          {statusCfg.label}
        </div>
      </div>

      {/* Agent address */}
      {address && (
        <div className="mb-3 px-3 py-1.5 bg-surface-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-wider font-medium text-surface-400 mb-0.5">Wallet</p>
          <p className="text-[11px] font-mono text-surface-500 truncate">{address}</p>
        </div>
      )}

      {/* Economy stats */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <StatCell
          label="Earned"
          value={formatShannons(earnings)}
          color="text-fiber-600"
        />
        <StatCell
          label="Spent"
          value={formatShannons(spent)}
          color="text-blue-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCell
          label="Balance"
          value={formatShannons(balance)}
          color="text-surface-800"
        />
        <StatCell
          label="Net P&L"
          value={`${net >= 0 ? "+" : ""}${(net / 1e8).toFixed(2)} CKB`}
          color={net >= 0 ? "text-fiber-600" : "text-red-500"}
        />
      </div>

      {/* Payment count */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-[10px] uppercase tracking-wider font-medium text-surface-400">
          Payments
        </span>
        <span className="text-xs font-semibold text-surface-700 tabular-nums">
          {String(agent.paymentCount)}
        </span>
      </div>

      {/* Error display */}
      {agent.error ? (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 leading-relaxed">
          {String(agent.error)}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {status === "idle" && (
          <ActionButton onClick={() => handleAction("start")} variant="primary">
            Start
          </ActionButton>
        )}
        {status === "running" && (
          <>
            <ActionButton onClick={() => handleAction("pause")} variant="warning">
              Pause
            </ActionButton>
            <ActionButton onClick={() => handleAction("stop")} variant="danger">
              Stop
            </ActionButton>
          </>
        )}
        {status === "paused" && (
          <>
            <ActionButton onClick={() => handleAction("resume")} variant="primary">
              Resume
            </ActionButton>
            <ActionButton onClick={() => handleAction("stop")} variant="danger">
              Stop
            </ActionButton>
          </>
        )}
        {(status === "stopped" || status === "error") && (
          <ActionButton onClick={() => agentsApi.remove(id).then(onRefresh)} variant="ghost">
            Remove
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-surface-50 rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider font-medium text-surface-400 mb-0.5">
        {label}
      </p>
      <p className={`text-sm font-semibold truncate tabular-nums ${color ?? "text-surface-800"}`}>
        {value}
      </p>
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
    primary:
      "bg-fiber-500 text-white hover:bg-fiber-600 shadow-sm shadow-fiber-500/20",
    warning:
      "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
    danger:
      "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
    ghost:
      "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700",
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function formatShannons(value: string | undefined): string {
  if (!value || value === "0" || value === "0n") return "0 CKB";
  const clean = value.replace(/n$/, "");
  const num = Number(clean) / 1e8;
  return `${num.toFixed(2)} CKB`;
}

function parseShannons(value: string | undefined): number {
  if (!value || value === "0" || value === "0n") return 0;
  return Number(value.replace(/n$/, ""));
}
