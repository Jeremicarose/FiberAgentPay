// ============================================================
// API Client for Dashboard → Server Communication
// ============================================================
// Wraps fetch calls to the backend with consistent error
// handling and response parsing.
//
// The Vite dev server proxies /api/* to http://localhost:3001
// so we don't need CORS during development. In production,
// both are served from the same origin.
// ============================================================

const API_BASE = "/api";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await res.text();

  // Parse with bigint-aware reviver
  const json: ApiResponse<T> = JSON.parse(text, (_key, value) => {
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return value; // Keep as string for display (React can't render bigint)
    }
    return value;
  });

  if (!json.success) {
    throw new Error(json.error ?? "Unknown error");
  }

  return json.data as T;
}

// --- Agent endpoints ---

export const agentsApi = {
  list: () => request<unknown[]>("/agents"),

  get: (id: string) => request<unknown>(`/agents/${id}`),

  create: (config: Record<string, unknown>) =>
    request<unknown>("/agents", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  start: (id: string) =>
    request<void>(`/agents/${id}/start`, { method: "POST" }),

  stop: (id: string) =>
    request<void>(`/agents/${id}/stop`, { method: "POST" }),

  pause: (id: string) =>
    request<void>(`/agents/${id}/pause`, { method: "POST" }),

  resume: (id: string) =>
    request<void>(`/agents/${id}/resume`, { method: "POST" }),

  remove: (id: string) =>
    request<void>(`/agents/${id}`, { method: "DELETE" }),

  /** Launch the full pipeline economy: Commerce→Stream→DCA */
  launchPipeline: () =>
    request<{ ids: string[] }>("/agents/pipeline", { method: "POST" }),
};

// --- Channel endpoints ---

export const channelsApi = {
  list: () => request<unknown[]>("/channels"),

  open: (config: Record<string, unknown>) =>
    request<unknown>("/channels", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  close: (id: string, config: Record<string, unknown>) =>
    request<void>(`/channels/${id}/close`, {
      method: "POST",
      body: JSON.stringify(config),
    }),
};

// --- Payment endpoints ---

export const paymentsApi = {
  list: (params?: { limit?: number; offset?: number; agentId?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.agentId) query.set("agentId", params.agentId);
    return request<{ payments: unknown[]; total: number }>(
      `/payments?${query.toString()}`,
    );
  },
};

// --- Wallet endpoints ---

export const walletApi = {
  get: () => request<unknown>("/wallet"),

  transfer: (toAddress: string, amount: string) =>
    request<{ txHash: string }>("/wallet/transfer", {
      method: "POST",
      body: JSON.stringify({ toAddress, amount }),
    }),
};

// --- Health ---

export const healthApi = {
  check: () => request<{ status: string; fiber: boolean; wallet: boolean }>("/health"),
};
