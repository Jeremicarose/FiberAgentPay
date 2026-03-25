import { useState, useEffect, useRef, useCallback } from "react";

interface AgentNode {
  id: string;
  name: string;
  type: string;
  status: string;
  address: string;
  balance: string;
  earnings: string;
  totalSpent: string;
}

interface PaymentArc {
  id: string;
  fromId: string;
  toId: string;
  amount: string;
  timestamp: number;
}

const TYPE_COLORS: Record<string, { stroke: string; fill: string; label: string }> = {
  dca: { stroke: "#00CC9B", fill: "rgba(0,204,155,0.12)", label: "DCA" },
  stream: { stroke: "#3b82f6", fill: "rgba(59,130,246,0.12)", label: "Stream" },
  commerce: { stroke: "#8b5cf6", fill: "rgba(139,92,246,0.12)", label: "Commerce" },
};

function parseAgent(raw: unknown): AgentNode | null {
  const a = raw as Record<string, unknown>;
  const config = a.config as Record<string, unknown> | undefined;
  if (!config?.id) return null;
  return {
    id: config.id as string,
    name: (config.name as string) || "",
    type: (config.type as string) || "dca",
    status: (a.status as string) || "idle",
    address: (a.address as string) || "",
    balance: (a.balance as string) || "0",
    earnings: (a.earnings as string) || "0",
    totalSpent: (a.totalSpent as string) || "0",
  };
}

function fmtCkb(val: string): string {
  if (!val || val === "0" || val === "0n") return "0";
  const n = Number(val.replace(/n$/, "")) / 1e8;
  return n.toFixed(2);
}

const ARC_LIFETIME = 3500;

export function EconomyGraph({ agents: rawAgents, events }: { agents: unknown[]; events: unknown[] }) {
  const agents = rawAgents.map(parseAgent).filter(Boolean) as AgentNode[];
  const [arcs, setArcs] = useState<PaymentArc[]>([]);
  const processedRef = useRef(new Set<string>());
  const svgRef = useRef<SVGSVGElement>(null);

  // Process new payment events into animated arcs
  useEffect(() => {
    if (agents.length < 2) return;
    const addressMap = new Map(agents.map((a) => [a.address, a.id]));

    for (const raw of events) {
      const e = raw as Record<string, unknown>;
      if (e.type !== "payment:sent") continue;
      const payment = e.payment as Record<string, unknown> | undefined;
      if (!payment?.recipientAddress) continue;
      const recipientAddr = payment.recipientAddress as string;
      const senderId = e.agentId as string;
      const receiverId = addressMap.get(recipientAddr);
      if (!receiverId || receiverId === senderId) continue;

      const key = `${senderId}-${e.timestamp}`;
      if (processedRef.current.has(key)) continue;
      processedRef.current.add(key);

      const arc: PaymentArc = {
        id: key,
        fromId: senderId,
        toId: receiverId,
        amount: String(payment.amount ?? "0"),
        timestamp: Date.now(),
      };
      setArcs((prev) => [...prev, arc]);
    }
  }, [events, agents]);

  // Expire old arcs
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - ARC_LIFETIME;
      setArcs((prev) => prev.filter((a) => a.timestamp > cutoff));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Responsive sizing
  const [dims, setDims] = useState({ w: 600, h: 440 });
  const containerRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: Math.max(380, Math.min(500, r.width * 0.6)) });
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const cx = dims.w / 2;
  const cy = dims.h / 2;
  const radius = Math.min(cx, cy) - 90;

  // Position agents in a circle
  const positions = agents.map((_, i) => {
    const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });

  const idxMap = new Map(agents.map((a, i) => [a.id, i]));

  return (
    <div
      ref={containerRef}
      className="bg-surface-900 rounded-2xl border border-surface-700/50 overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-700/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-surface-100">Economy Flow</h2>
            {arcs.length > 0 && (
              <span className="flex items-center gap-2 text-xs font-semibold text-fiber-400">
                <span className="w-2 h-2 rounded-full bg-fiber-400 status-pulse" />
                {arcs.length} active
              </span>
            )}
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-surface-500">
            {agents.length} node{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-sm text-surface-400 mt-1">
          Agents discover and buy services from each other. Arrows show real CKB payments on the blockchain.
        </p>
      </div>

      {agents.length < 2 ? (
        <div className="flex items-center justify-center py-16 text-surface-500 text-sm">
          Create 2+ agents to see the economy graph
        </div>
      ) : (
        <>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          width="100%"
          height={dims.h}
          className="block"
        >
          <defs>
            {/* Glow filter for active connections */}
            <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Arrowhead */}
            <marker id="arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,4 L0,8 Z" fill="#00CC9B" opacity="0.9" />
            </marker>
            {/* Subtle grid pattern */}
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Faint connection lines between all agents */}
          {agents.map((_, i) =>
            agents.map((_, j) => {
              if (j <= i) return null;
              return (
                <line
                  key={`bg-${i}-${j}`}
                  x1={positions[i].x} y1={positions[i].y}
                  x2={positions[j].x} y2={positions[j].y}
                  stroke="rgba(148,163,184,0.06)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              );
            }),
          )}

          {/* Active payment arcs */}
          {arcs.map((arc) => {
            const fi = idxMap.get(arc.fromId);
            const ti = idxMap.get(arc.toId);
            if (fi === undefined || ti === undefined) return null;
            const from = positions[fi];
            const to = positions[ti];
            const age = (Date.now() - arc.timestamp) / ARC_LIFETIME;
            const opacity = Math.max(0, 1 - age * age);

            // Offset line slightly so bidirectional arcs don't overlap
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len * 4;
            const ny = dx / len * 4;

            // Shorten line to not overlap node circles
            const nodeR = 50;
            const ratio = nodeR / len;
            const sx = from.x + dx * ratio + nx;
            const sy = from.y + dy * ratio + ny;
            const ex = to.x - dx * ratio + nx;
            const ey = to.y - dy * ratio + ny;

            const midX = (sx + ex) / 2;
            const midY = (sy + ey) / 2 - 12;

            return (
              <g key={arc.id} opacity={opacity}>
                {/* Glow line */}
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="#00CC9B" strokeWidth="2.5"
                  filter="url(#arc-glow)"
                  markerEnd="url(#arrow)"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="40" to="0" dur="0.8s"
                    repeatCount="indefinite"
                  />
                </line>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="#00CC9B" strokeWidth="1.5"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow)"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="40" to="0" dur="0.8s"
                    repeatCount="indefinite"
                  />
                </line>

                {/* Traveling dot */}
                <circle r="3" fill="#00CC9B">
                  <animateMotion
                    dur="0.9s"
                    repeatCount="indefinite"
                    path={`M${sx},${sy} L${ex},${ey}`}
                  />
                </circle>

                {/* Amount label */}
                <rect
                  x={midX - 34} y={midY - 10}
                  width="68" height="20" rx="4"
                  fill="rgba(0,204,155,0.15)" stroke="#00CC9B" strokeWidth="0.5"
                />
                <text
                  x={midX} y={midY + 4}
                  textAnchor="middle" fontSize="11"
                  fontFamily="JetBrains Mono, monospace" fontWeight="700"
                  fill="#00CC9B"
                >
                  {fmtCkb(arc.amount)} CKB
                </text>
              </g>
            );
          })}

          {/* Agent nodes */}
          {agents.map((agent, i) => {
            const pos = positions[i];
            const tc = TYPE_COLORS[agent.type] || TYPE_COLORS.dca;
            const isRunning = agent.status === "running";

            return (
              <g key={agent.id}>
                {/* Outer pulse ring for running agents */}
                {isRunning && (
                  <circle cx={pos.x} cy={pos.y} r="54" fill="none" stroke={tc.stroke} strokeWidth="1.5" opacity="0.3">
                    <animate attributeName="r" values="50;62;50" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.08;0.3" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Node background */}
                <circle cx={pos.x} cy={pos.y} r="50" fill={tc.fill} stroke={tc.stroke} strokeWidth={isRunning ? 2.5 : 1.5} opacity={isRunning ? 1 : 0.6} />

                {/* Agent name */}
                <text
                  x={pos.x} y={pos.y - 12}
                  textAnchor="middle" fontSize="13"
                  fontFamily="DM Sans, sans-serif" fontWeight="700"
                  fill="#f1f5f9"
                >
                  {agent.name.length > 14 ? agent.name.slice(0, 13) + "\u2026" : agent.name}
                </text>

                {/* Type badge */}
                <text
                  x={pos.x} y={pos.y + 4}
                  textAnchor="middle" fontSize="10"
                  fontFamily="JetBrains Mono, monospace" fontWeight="600"
                  fill={tc.stroke} opacity="0.9"
                >
                  {tc.label}
                </text>

                {/* Balance */}
                <text
                  x={pos.x} y={pos.y + 20}
                  textAnchor="middle" fontSize="11"
                  fontFamily="JetBrains Mono, monospace" fontWeight="600"
                  fill="#94a3b8"
                >
                  {fmtCkb(agent.balance)} CKB
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend + hint */}
        <div className="px-6 py-3 border-t border-surface-700/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            {Object.entries(TYPE_COLORS).map(([key, tc]) => (
              <span key={key} className="flex items-center gap-2 text-xs font-medium text-surface-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tc.stroke }} />
                {tc.label}
              </span>
            ))}
          </div>
          {agents.every((a) => a.status !== "running") && (
            <span className="text-xs text-surface-500 italic">
              Start agents to see payments flow
            </span>
          )}
        </div>
        </>
      )}
    </div>
  );
}
