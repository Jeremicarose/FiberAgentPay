import { type ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  connected: boolean;
}

export function Layout({ children, connected }: LayoutProps) {
  return (
    <div className="min-h-screen relative">
      {/* Background gradient blobs */}
      <div className="gradient-bg" />

      {/* Header */}
      <header className="relative z-10 border-b border-surface-200/60 bg-white/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fiber-500 to-fiber-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm tracking-tight">F</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
                Fiber<span className="text-fiber-500">AgentPay</span>
              </h1>
              <p className="text-xs text-surface-400 -mt-0.5">
                AI Micropayment Agents on CKB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-surface-100 text-surface-500 border border-surface-200">
              CKB Testnet
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connected ? "bg-fiber-500" : "bg-red-400"
                  }`}
                />
                {connected && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-fiber-500 status-pulse" />
                )}
              </div>
              <span className="text-xs font-medium text-surface-500">
                {connected ? "Live" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
