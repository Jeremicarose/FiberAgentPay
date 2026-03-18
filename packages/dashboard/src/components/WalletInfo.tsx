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
    <div className="bg-ckb-card border border-ckb-border rounded-lg p-4">
      <h2 className="text-sm font-medium text-white mb-3">Wallet</h2>

      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : !wallet ? (
        <p className="text-xs text-ckb-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-ckb-muted">Address</p>
            <p className="text-xs font-mono text-white break-all">
              {wallet.address as string}
            </p>
          </div>
          <div>
            <p className="text-xs text-ckb-muted">Balance</p>
            <p className="text-lg font-mono font-semibold text-ckb-green">
              {wallet.balanceFormatted as string}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                wallet.isReady ? "bg-ckb-green" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-ckb-muted">
              {wallet.isReady ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
