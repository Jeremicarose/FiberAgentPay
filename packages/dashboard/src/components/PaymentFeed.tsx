interface PaymentFeedProps {
  events: unknown[];
}

const EVENT_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  "agent:started": {
    icon: "\u25B6",
    color: "text-fiber-600",
    bg: "bg-fiber-50",
    label: "Agent started",
  },
  "agent:stopped": {
    icon: "\u25A0",
    color: "text-surface-500",
    bg: "bg-surface-100",
    label: "Agent stopped",
  },
  "agent:paused": {
    icon: "\u275A\u275A",
    color: "text-amber-600",
    bg: "bg-amber-50",
    label: "Agent paused",
  },
  "agent:error": {
    icon: "!",
    color: "text-red-600",
    bg: "bg-red-50",
    label: "Error",
  },
  "channel:opened": {
    icon: "+",
    color: "text-fiber-600",
    bg: "bg-fiber-50",
    label: "Channel opened",
  },
  "channel:closed": {
    icon: "\u2013",
    color: "text-surface-500",
    bg: "bg-surface-100",
    label: "Channel closed",
  },
  "payment:sent": {
    icon: "\u2191",
    color: "text-blue-600",
    bg: "bg-blue-50",
    label: "Payment sent",
  },
  "payment:received": {
    icon: "\u2193",
    color: "text-fiber-600",
    bg: "bg-fiber-50",
    label: "Payment received",
  },
  "safety:warning": {
    icon: "\u26A0",
    color: "text-amber-600",
    bg: "bg-amber-50",
    label: "Safety warning",
  },
  "safety:limit_reached": {
    icon: "\u2716",
    color: "text-red-600",
    bg: "bg-red-50",
    label: "Limit reached",
  },
  "commerce:service_listed": {
    icon: "\u2605",
    color: "text-violet-600",
    bg: "bg-violet-50",
    label: "Service listed",
  },
  "commerce:request_fulfilled": {
    icon: "\u2713",
    color: "text-fiber-600",
    bg: "bg-fiber-50",
    label: "Request fulfilled",
  },
};

export function PaymentFeed({ events }: PaymentFeedProps) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-surface-800">Live Feed</h2>
          {events.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-fiber-50 text-fiber-600 tabular-nums">
              {events.length}
            </span>
          )}
        </div>
        {events.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-fiber-500 status-pulse" />
            <span className="text-[10px] uppercase tracking-wider font-medium text-surface-400">
              Streaming
            </span>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-surface-400 text-sm">{"\u26A1"}</span>
          </div>
          <p className="text-sm text-surface-400">No events yet</p>
          <p className="text-xs text-surface-300 mt-1">
            Create and start an agent to see activity here.
          </p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-100/60">
          {events.map((event, i) => {
            const e = event as Record<string, unknown>;
            const type = e.type as string;
            const timestamp = new Date(
              e.timestamp as number
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const cfg = EVENT_CONFIG[type] ?? {
              icon: "\u00B7",
              color: "text-surface-500",
              bg: "bg-surface-100",
              label: type,
            };
            const agentId = ((e.agentId as string) ?? "").slice(0, 8);

            let detail = "";
            if (type === "payment:sent" || type === "payment:received") {
              const payment = e.payment as Record<string, unknown>;
              detail = formatShannons(payment?.amount as string);
            } else if (type === "agent:error") {
              detail = (e.error as string) ?? "";
            } else if (type === "safety:limit_reached") {
              detail = e.limitType as string;
            }

            return (
              <div
                key={i}
                className="feed-item flex items-center gap-3 px-5 py-3 hover:bg-surface-50/50 transition-colors"
              >
                <span className="font-mono text-[11px] text-surface-300 w-[68px] shrink-0 tabular-nums">
                  {timestamp}
                </span>

                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}
                >
                  {cfg.icon}
                </div>

                <span className="font-mono text-[11px] text-surface-300 w-[60px] shrink-0">
                  {agentId}
                </span>

                <span className="text-xs font-medium text-surface-700 truncate">
                  {cfg.label}
                </span>

                {detail && (
                  <span className={`ml-auto text-xs font-semibold font-mono tabular-nums shrink-0 ${
                    type.startsWith("payment:") ? "text-fiber-600" : "text-surface-400"
                  }`}>
                    {detail}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatShannons(value: string | undefined): string {
  if (!value || value === "0" || value === "0n") return "0 CKB";
  const clean = value.replace(/n$/, "");
  const num = Number(clean) / 1e8;
  return `${num.toFixed(4)} CKB`;
}
