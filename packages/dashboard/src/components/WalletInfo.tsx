import { useState, useEffect } from "react";
import { walletApi } from "../lib/api";

export function WalletInfo() {
  const [wallet, setWallet] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>("");

  async function fetchWallet() {
    try {
      const data = await walletApi.get();
      setWallet(data as Record<string, unknown>);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    }
  }

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-200/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100">
        <h2 className="text-sm font-semibold text-surface-800">Wallet</h2>
      </div>

      <div className="p-5">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : !wallet ? (
          <div className="flex items-center gap-2 text-surface-400">
            <div className="w-4 h-4 rounded-full border-2 border-surface-300 border-t-transparent animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Balance - hero number */}
            <div className="bg-gradient-to-br from-fiber-50 to-fiber-100/50 rounded-xl p-4 border border-fiber-200/40">
              <p className="text-[10px] uppercase tracking-wider font-medium text-fiber-600/70 mb-1">
                Balance
              </p>
              <p className="text-2xl font-bold font-mono text-fiber-700 tracking-tight tabular-nums">
                {String(wallet.balanceFormatted)}
              </p>
            </div>

            {/* Address */}
            <div>
              <p className="text-[10px] uppercase tracking-wider font-medium text-surface-400 mb-1.5">
                Address
              </p>
              <p className="text-[11px] font-mono text-surface-500 break-all leading-relaxed bg-surface-50 rounded-lg px-3 py-2 border border-surface-200/50">
                {String(wallet.address)}
              </p>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative">
                <div
                  className={`w-2 h-2 rounded-full ${
                    wallet.isReady ? "bg-fiber-500" : "bg-red-400"
                  }`}
                />
                {wallet.isReady && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-fiber-500 status-pulse" />
                )}
              </div>
              <span className="text-xs font-medium text-surface-500">
                {wallet.isReady ? "Connected to CKB Testnet" : "Not connected"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
