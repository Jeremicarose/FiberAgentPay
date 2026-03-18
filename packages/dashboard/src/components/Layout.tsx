import { type ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
  connected: boolean;
}

export function Layout({ children, connected }: LayoutProps) {
  return (
    <div className="min-h-screen bg-ckb-dark">
      {/* Header */}
      <header className="border-b border-ckb-border bg-ckb-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ckb-green/20 flex items-center justify-center">
              <span className="text-ckb-green font-bold text-sm">F</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">FiberAgentPay</h1>
              <p className="text-xs text-ckb-muted">AI Micropayment Agents on CKB</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-ckb-muted">CKB Testnet</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-ckb-green animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-ckb-muted">
                {connected ? "Live" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
