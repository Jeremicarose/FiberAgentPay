import { agentsApi } from "../lib/api";

interface AgentCardProps {
  agent: Record<string, unknown>;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-gray-500",
  running: "bg-ckb-green",
  paused: "bg-yellow-500",
  stopped: "bg-gray-600",
  error: "bg-red-500",
};

const TYPE_LABELS: Record<string, string> = {
  dca: "DCA",
  stream: "Stream",
  commerce: "Commerce",
};

export function AgentCard({ agent, onRefresh }: AgentCardProps) {
  const config = agent.config as Record<string, unknown>;
  const status = agent.status as string;
  const id = config.id as string;
  const type = config.type as string;

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
    <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-ckb-green/20 text-ckb-green">
            {TYPE_LABELS[type] ?? type}
          </span>
          <h3 className="text-sm font-medium text-white">
            {config.name as string}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] ?? "bg-gray-500"}`} />
          <span className="text-xs text-ckb-muted capitalize">{status}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-xs text-ckb-muted">Spent</p>
          <p className="text-sm font-mono text-white">
            {formatShannons(agent.totalSpent as string)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ckb-muted">Payments</p>
          <p className="text-sm font-mono text-white">
            {String(agent.paymentCount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ckb-muted">Channel</p>
          <p className="text-sm font-mono text-white truncate">
            {agent.channelId
              ? truncate(agent.channelId as string)
              : "—"}
          </p>
        </div>
      </div>

      {/* Error display */}
      {agent.error && (
        <div className="mb-3 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {agent.error as string}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status === "idle" && (
          <ActionButton onClick={() => handleAction("start")} color="green">
            Start
          </ActionButton>
        )}
        {status === "running" && (
          <>
            <ActionButton onClick={() => handleAction("pause")} color="yellow">
              Pause
            </ActionButton>
            <ActionButton onClick={() => handleAction("stop")} color="red">
              Stop
            </ActionButton>
          </>
        )}
        {status === "paused" && (
          <>
            <ActionButton onClick={() => handleAction("resume")} color="green">
              Resume
            </ActionButton>
            <ActionButton onClick={() => handleAction("stop")} color="red">
              Stop
            </ActionButton>
          </>
        )}
        {(status === "stopped" || status === "error") && (
          <ActionButton onClick={() => agentsApi.remove(id).then(onRefresh)} color="gray">
            Remove
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  color,
  children,
}: {
  onClick: () => void;
  color: "green" | "yellow" | "red" | "gray";
  children: React.ReactNode;
}) {
  const colors = {
    green: "bg-ckb-green/20 text-ckb-green hover:bg-ckb-green/30",
    yellow: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30",
    red: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
    gray: "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${colors[color]}`}
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

function truncate(hex: string, chars = 4): string {
  if (hex.length <= chars * 2 + 4) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}
