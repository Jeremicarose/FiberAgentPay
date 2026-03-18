// ============================================================
// CKB Client — Barrel Export
// ============================================================

export { createCkbClient, createSigner, getAddress, getBalance } from "./client.js";
export { Wallet, createWalletFromEnv } from "./wallet.js";
export type { WalletState } from "./wallet.js";
export {
  waitForTransaction,
  getWalletLockScript,
  getWalletLockScriptForFiber,
  hasEnoughForChannelFunding,
} from "./transactions.js";
