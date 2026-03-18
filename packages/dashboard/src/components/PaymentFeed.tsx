interface PaymentFeedProps {
  events: unknown[];
}

const EVENT_ICONS: Record<string, string> = {
  "agent:started": ">>",
  "agent:stopped": "[]",
  "agent:paused": "||",
  "agent:error": "!!",
  "channel:opened": "++",
  "channel:closed": "--",
  "payment:sent": "->",
  "payment:received": "<-",
  "safety:warning": "/!",
  "safety:limit_reached": "XX",
  "commerce:service_listed": "**",
  "commerce:request_fulfilled": "OK",
};

const EVENT_COLORS: Record<string, string> = {
  "agent:started": "text-ckb-green",
  "agent:stopped": "text-gray-400",
  "agent:paused": "text-yellow-400",
  "agent:error": "text-red-400",
  "payment:sent": "text-blue-400",
  "payment:received": "text-ckb-green",
  "safety:limit_reached": "text-red-400",
  "commerce:request_fulfilled": "text-purple-400",
};

export function PaymentFeed({ events }: PaymentFeedProps) {
  if (events.length === 0) {
    return (
      <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
        <h2 className="text-sm font-medium text-white mb-3">Live Feed</h2>
        <p className="text-xs text-ckb-muted text-center py-8">
          No events yet. Create and start an agent to see activity here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
      <h2 className="text-sm font-medium text-white mb-3">
        Live Feed
        <span className="ml-2 text-xs text-ckb-muted">({events.length})</span>
      </h2>
      <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
        {events.map((event, i) => {
          const e = event as Record<string, unknown>;
          const type = e.type as string;
          const timestamp = new Date(e.timestamp as number).toLocaleTimeString();
          const icon = EVENT_ICONS[type] ?? "..";
          const color = EVENT_COLORS[type] ?? "text-ckb-muted";
          const agentId = ((e.agentId as string) ?? "").slice(0, 8);

          let detail = "";
          if (type === "payment:sent" || type === "payment:received") {
            const payment = e.payment as Record<string, unknown>;
            const amount = formatShannons(payment?.amount as string);
            detail = amount;
          } else if (type === "agent:error") {
            detail = (e.error as string) ?? "";
          } else if (type === "safety:limit_reached") {
            detail = e.limitType as string;
          }

          return (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-ckb-muted w-16 shrink-0">{timestamp}</span>
              <span className={`w-5 shrink-0 ${color}`}>{icon}</span>
              <span className="text-ckb-muted w-16 shrink-0">{agentId}</span>
              <span className={`${color}`}>{type.replace(":", " ")}</span>
              {detail && (
                <span className="text-ckb-muted truncate">{detail}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatShannons(value: string | undefined): string {
  if (!value || value === "0" || value === "0n") return "0 CKB";
  const clean = value.replace(/n$/, "");
  const num = Number(clean) / 1e8;
  return `${num.toFixed(4)} CKB`;
}
