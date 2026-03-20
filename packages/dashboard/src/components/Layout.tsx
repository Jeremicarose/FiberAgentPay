import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
  connected?: boolean;
}

export function Layout({ children, connected }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen relative">
      {/* Background gradient blobs */}
      <div className="gradient-bg" />

      {/* Header */}
      <header className="relative z-10 border-b border-surface-200/60 bg-white/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fiber-500 to-fiber-600 flex items-center justify-center shadow-glow group-hover:shadow-lg group-hover:shadow-fiber-500/20 transition-shadow">
                <span className="text-white font-bold text-sm tracking-tight">
                  F
                </span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-surface-900 tracking-tight">
                  Fiber<span className="text-fiber-500">AgentPay</span>
                </h1>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/" active={location.pathname === "/"}>
                Home
              </NavLink>
              <NavLink
                to="/dashboard"
                active={location.pathname === "/dashboard"}
              >
                Dashboard
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-surface-100 text-surface-500 border border-surface-200">
              CKB Testnet
            </span>
            {connected !== undefined && (
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
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10">{children}</main>
    </div>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "text-fiber-700 bg-fiber-50"
          : "text-surface-500 hover:text-surface-700 hover:bg-surface-100"
      }`}
    >
      {children}
    </Link>
  );
}
