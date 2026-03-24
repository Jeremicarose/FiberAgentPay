import { useState } from "react";

const EXPLORER_BASE = "https://pudge.explorer.nervos.org/transaction/";

interface PaymentFeedProps {
  events: unknown[];
  agentNames?: Record<string, string>;
  agentAddressToName?: Record<string, string>;
}

type FilterKey = "all" | "payments" | "commerce" | "system";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "payments", label: "Payments" },
  { key: "commerce", label: "Commerce" },
  { key: "system", label: "System" },
];

function getFilterKey(type: string): FilterKey {
  if (type.startsWith("payment:")) return "payments";
  if (type.startsWith("commerce:")) return "commerce";
  return "system";
}

const EVENT_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  "agent:started": { icon: "\u25B6", color: "text-fiber-600", bg: "bg-fiber-50", label: "Started" },
  "agent:stopped": { icon: "\u25A0", color: "text-surface-500", bg: "bg-surface-100", label: "Stopped" },
  "agent:paused": { icon: "\u275A\u275A", color: "text-amber-600", bg: "bg-amber-50", label: "Paused" },
  "agent:error": { icon: "!", color: "text-red-600", bg: "bg-red-50", label: "Error" },
  "channel:opened": { icon: "+", color: "text-fiber-600", bg: "bg-fiber-50", label: "Channel opened" },
  "channel:closed": { icon: "\u2013", color: "text-surface-500", bg: "bg-surface-100", label: "Channel closed" },
  "payment:sent": { icon: "\u2191", color: "text-blue-600", bg: "bg-blue-50", label: "Sent" },
  "payment:received": { icon: "\u2193", color: "text-fiber-600", bg: "bg-fiber-50", label: "Received" },
  "safety:warning": { icon: "\u26A0", color: "text-amber-600", bg: "bg-amber-50", label: "Warning" },
  "safety:limit_reached": { icon: "\u2716", color: "text-red-600", bg: "bg-red-50", label: "Limit hit" },
  "commerce:service_listed": { icon: "\u2605", color: "text-violet-600", bg: "bg-violet-50", label: "Listed" },
  "commerce:request_fulfilled": { icon: "\u2713", color: "text-fiber-600", bg: "bg-fiber-50", label: "Fulfilled" },
};

export function PaymentFeed({ events, agentNames = {}, agentAddressToName = {} }: PaymentFeedProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = filter === "all"
    ? events
    : events.filter((e) => getFilterKey((e as Record<string, unknown>).type as string) === filter);

  // Limit display to 50 most recent
  const displayed = filtered.slice(0, 50);

  // Collect on-chain tx hashes
  const onChainTxs: { hash: string; agentId: string; amount: string; timestamp: number }[] = [];
  for (const raw of events) {
    const e = raw as Record<string, unknown>;
    if (e.type !== "payment:sent" && e.type !== "payment:received") continue;
    const payment = e.payment as Record<string, unknown> | undefined;
    const hash = payment?.onChainTxHash as string | undefined;
    if (hash && !onChainTxs.some((t) => t.hash === hash)) {
      onChainTxs.push({
        hash,
        agentId: ((e.agentId as string) ?? "").slice(0, 8),
        amount: formatShannons(payment?.amount as string),
        timestamp: e.timestamp as number,
      });
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 overflow-hidden">
      {/* Header with filters */}
      <div className="px-5 py-3 border-b border-surface-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-surface-800">Live Feed</h2>
            {events.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-fiber-50 text-fiber-600 tabular-nums">
                {events.length}
              </span>
            )}
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-fiber-500 status-pulse" />
              <span className="text-[10px] uppercase tracking-wider font-medium text-surface-400">Live</span>
            </div>
          )}
        </div>
        {events.length > 0 && (
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  filter === f.key
                    ? "bg-surface-800 text-white"
                    : "text-surface-400 hover:text-surface-600 hover:bg-surface-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* On-chain transactions banner */}
      {onChainTxs.length > 0 && (
        <div className="px-5 py-2.5 bg-fiber-50/50 border-b border-fiber-100/50">
          <p className="text-[10px] uppercase tracking-wider font-medium text-fiber-700 mb-1.5">
            On-Chain Transactions ({onChainTxs.length})
          </p>
          <div className="space-y-1">
            {onChainTxs.slice(0, 5).map((tx) => (
              <a
                key={tx.hash}
                href={`${EXPLORER_BASE}${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 group"
              >
                <span className="font-mono text-[11px] text-fiber-600 group-hover:text-fiber-800 transition-colors">
                  {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                </span>
                <span className="text-[10px] font-semibold text-fiber-500 tabular-nums">
                  {tx.amount} {"\u2197"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Event list */}
      {displayed.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-surface-400">
            {events.length === 0 ? "Waiting for activity..." : "No matching events"}
          </p>
          <p className="text-xs text-surface-300 mt-1">
            {events.length === 0
              ? "Once agents are running, you'll see every payment and trade here in real time."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto divide-y divide-surface-100/60">
          {displayed.map((event, i) => {
            const e = event as Record<string, unknown>;
            const type = e.type as string;
            const timestamp = new Date(e.timestamp as number).toLocaleTimeString([], {
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
            let narrative = "";
            let onChainTxHash: string | undefined;
            const senderName = agentNames[(e.agentId as string) ?? ""] || agentId;
            if (type === "payment:sent" || type === "payment:received") {
              const payment = e.payment as Record<string, unknown>;
              detail = formatShannons(payment?.amount as string);
              onChainTxHash = payment?.onChainTxHash as string | undefined;
              const recipientAddr = payment?.recipientAddress as string | undefined;
              const recipientName = recipientAddr ? (agentAddressToName[recipientAddr] || "") : "";
              if (type === "payment:sent" && recipientName) {
                narrative = `${senderName} paid ${recipientName}`;
              } else if (type === "payment:received") {
                narrative = `${senderName} received payment`;
              }
            } else if (type === "agent:error") {
              detail = (e.error as string) ?? "";
            } else if (type === "commerce:service_listed") {
              narrative = `${senderName} listed a service`;
            } else if (type === "commerce:request_fulfilled") {
              narrative = `${senderName} fulfilled a request`;
            }

            return (
              <div key={i} className="feed-item px-4 py-2 hover:bg-surface-50/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-surface-300 w-[60px] shrink-0 tabular-nums">
                    {timestamp}
                  </span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <span className="text-[11px] font-medium text-surface-600 truncate">
                    {narrative || `${senderName} \u00B7 ${cfg.label}`}
                  </span>
                  {detail && (
                    <span className={`ml-auto text-[11px] font-semibold font-mono tabular-nums shrink-0 ${
                      type.startsWith("payment:") ? "text-fiber-600" : "text-surface-400"
                    }`}>
                      {detail}
                    </span>
                  )}
                </div>
                {onChainTxHash && (
                  <div className="mt-1 ml-[72px]">
                    <a
                      href={`${EXPLORER_BASE}${onChainTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-fiber-500 hover:text-fiber-700 transition-colors"
                    >
                      {onChainTxHash.slice(0, 10)}...{onChainTxHash.slice(-6)} {"\u2197"}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Truncation notice */}
      {filtered.length > 50 && (
        <div className="px-5 py-2 border-t border-surface-100 text-center">
          <span className="text-[10px] text-surface-400">
            Showing 50 of {filtered.length} events
          </span>
        </div>
      )}
    </div>
  );
}

function formatShannons(value: string | undefined): string {
  if (!value || value === "0" || value === "0n") return "0 CKB";
  const clean = value.replace(/n$/, "");
  const num = Number(clean) / 1e8;
  return `${num.toFixed(2)} CKB`;
}
