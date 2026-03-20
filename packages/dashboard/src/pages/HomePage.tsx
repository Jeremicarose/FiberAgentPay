import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";

const FEATURES = [
  {
    icon: "\u21BB",
    title: "DCA Agent",
    desc: "Dollar-cost averaging with automated periodic purchases. Set an amount, interval, and count — the agent handles the rest via Fiber micropayments.",
    color: "fiber" as const,
  },
  {
    icon: "\u2192",
    title: "Stream Agent",
    desc: "Continuous pay-per-second micropayments for API access, content streaming, or any metered service. Sub-cent granularity at 1-second ticks.",
    color: "blue" as const,
  },
  {
    icon: "\u2194",
    title: "Commerce Agent",
    desc: "Agent-to-agent marketplace where autonomous agents discover, negotiate, and purchase data feeds and computation services from each other.",
    color: "violet" as const,
  },
];

const FEATURE_STYLES = {
  fiber: {
    iconBg: "bg-fiber-50 border-fiber-200",
    iconColor: "text-fiber-600",
    tag: "bg-fiber-50 text-fiber-700 border-fiber-200",
  },
  blue: {
    iconBg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
    tag: "bg-blue-50 text-blue-700 border-blue-200",
  },
  violet: {
    iconBg: "bg-violet-50 border-violet-200",
    iconColor: "text-violet-600",
    tag: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const STEPS = [
  {
    num: "01",
    title: "Create an Agent",
    desc: "Choose from DCA, Stream, or Commerce strategies. Each agent comes with built-in safety limits.",
  },
  {
    num: "02",
    title: "Set Your Strategy",
    desc: "Configure amounts, intervals, and spending caps. Agents enforce per-transaction, hourly, and lifetime limits.",
  },
  {
    num: "03",
    title: "Watch It Execute",
    desc: "Agents create real Fiber Network invoices and execute payments autonomously. Monitor everything in real time.",
  },
];

const TECH = [
  { name: "CKB", desc: "Layer 1" },
  { name: "Fiber Network", desc: "Layer 2" },
  { name: "TypeScript", desc: "Language" },
  { name: "React", desc: "Frontend" },
  { name: "Hono", desc: "Backend" },
  { name: "WebSocket", desc: "Real-time" },
];

export function HomePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-fiber-50 text-fiber-700 border border-fiber-200">
              Built on CKB
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Fiber Network
            </span>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              AI Agents
            </span>
          </div>

          <h2 className="text-5xl sm:text-6xl font-bold text-surface-900 tracking-tight leading-[1.1] mb-6">
            Autonomous micropayments{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fiber-500 to-fiber-600">
              for AI agents.
            </span>
          </h2>

          <p className="text-lg text-surface-500 leading-relaxed mb-10 max-w-2xl">
            FiberAgentPay lets AI agents autonomously execute micropayment
            strategies through Fiber Network — a Lightning Network-style Layer 2
            on CKB. Create agents that buy, stream, and trade without human
            intervention.
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-fiber-500 to-fiber-600 text-white hover:from-fiber-600 hover:to-fiber-700 transition-all shadow-lg shadow-fiber-500/20 hover:shadow-xl hover:shadow-fiber-500/30"
            >
              Open Dashboard
              <span className="text-white/70">{"\u2192"}</span>
            </Link>
            <a
              href="https://github.com/Jeremicarose/FiberAgentPay"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-white text-surface-700 border border-surface-200 hover:border-surface-300 hover:bg-surface-50 transition-all shadow-card"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-surface-900 tracking-tight mb-2">
            Three Agent Strategies
          </h3>
          <p className="text-surface-500">
            Each agent type solves a different micropayment use case.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const styles = FEATURE_STYLES[f.color];
            return (
              <div
                key={f.title}
                className="bg-white rounded-2xl shadow-card border border-surface-200/50 p-6 card-interactive"
              >
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl mb-4 ${styles.iconBg}`}
                >
                  <span className={styles.iconColor}>{f.icon}</span>
                </div>
                <h4 className="text-base font-semibold text-surface-800 mb-2">
                  {f.title}
                </h4>
                <p className="text-sm text-surface-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-surface-900 tracking-tight mb-2">
            How It Works
          </h3>
          <p className="text-surface-500">
            From setup to autonomous execution in three steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(100%+4px)] w-[calc(100%-56px)] h-px bg-surface-200 -translate-x-1/2" />
              )}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fiber-50 to-fiber-100 border border-fiber-200/50 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-fiber-600 font-mono">
                    {step.num}
                  </span>
                </div>
                <div className="pt-1">
                  <h4 className="text-base font-semibold text-surface-800 mb-1">
                    {step.title}
                  </h4>
                  <p className="text-sm text-surface-500 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 p-8 md:p-10">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-surface-900 tracking-tight mb-2">
                Built-in Safety Guards
              </h3>
              <p className="text-surface-500 leading-relaxed">
                Every agent enforces three-tier spending limits. When a limit is
                hit, the agent auto-pauses and emits an event. You stay in
                control at all times.
              </p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <SafetyLimit label="Per Transaction" value="10 CKB" />
              <SafetyLimit label="Per Hour" value="100 CKB" />
              <SafetyLimit label="Lifetime" value="1,000 CKB" />
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-surface-900 tracking-tight mb-2">
            Tech Stack
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {TECH.map((t) => (
            <div
              key={t.name}
              className="px-4 py-2.5 bg-white rounded-xl shadow-card border border-surface-200/50 text-center"
            >
              <p className="text-sm font-semibold text-surface-800">
                {t.name}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-surface-400">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200/60 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fiber-500 to-fiber-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="text-sm font-semibold text-surface-700">
              Fiber<span className="text-fiber-500">AgentPay</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-surface-400">
            <a
              href="https://github.com/Jeremicarose/FiberAgentPay"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-surface-600 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://fiber.world"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-surface-600 transition-colors"
            >
              Fiber Network
            </a>
            <a
              href="https://nervos.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-surface-600 transition-colors"
            >
              Nervos CKB
            </a>
            <span className="text-surface-300">|</span>
            <span>Claw & Order: CKB AI Agent Hackathon</span>
          </div>
        </div>
      </footer>
    </Layout>
  );
}

function SafetyLimit({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-50 rounded-xl p-4 text-center">
      <p className="text-lg font-bold text-surface-800 font-mono mb-1">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider font-medium text-surface-400">
        {label}
      </p>
    </div>
  );
}
