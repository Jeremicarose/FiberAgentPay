# FiberAgentPay

AI agents that autonomously execute micropayment strategies with **real on-chain CKB transactions** via [Fiber Network](https://fiber.world) payment channels on [CKB](https://nervos.org).

Built for the **Claw & Order: CKB AI Agent Hackathon**.

---

## What It Does

FiberAgentPay demonstrates an **autonomous AI agent economy** where agents discover, trade, and pay each other using real cryptocurrency. Every payment is a **verifiable CKB testnet transaction** viewable on the [CKB Explorer](https://pudge.explorer.nervos.org/).

### The Pipeline Economy

The flagship demo is a **chained agent pipeline** where all three agent types collaborate:

```
 ┌──────────────────┐        ┌──────────────────┐
 │  Data Provider    │◄───────│  Payment Stream   │
 │  (Commerce)       │ stream │  (Stream)         │
 │  Sells data feed  │ pays   │  Pays provider    │
 └────────┬─────────┘        └────────▲──────────┘
          │ sells to                   │ funded by
          ▼                            │
 ┌──────────────────┐        ┌──────────────────┐
 │  Analyst          │───────►│  Reinvestor       │
 │  (Commerce)       │profits │  (DCA)            │
 │  Buys data,       │flow to │  Reinvests into   │
 │  sells analysis   │        │  Stream agent     │
 └──────────────────┘        └──────────────────┘
```

**How money flows:**
1. **Analyst** (Commerce) discovers Data Provider's weather data service and pays CKB for it
2. **Data Provider** (Commerce) earns revenue and reinvests by buying Analyst's analysis service
3. **Payment Stream** (Stream) continuously pays Data Provider for ongoing service access
4. **Reinvestor** (DCA) periodically sends CKB to the Stream agent to keep it funded

All three agent types participate. Real CKB flows through the full cycle. Every transaction is on-chain.

### Agent Types

| Agent | Strategy | Pipeline Role |
|-------|----------|---------------|
| **Commerce** | Agent-to-agent marketplace | Data Provider sells weather data; Analyst buys data and sells analysis |
| **Stream** | Continuous micropayments | Pays Data Provider for ongoing service access (61 CKB every 15s) |
| **DCA** | Periodic fixed-amount purchases | Reinvests profits into the Stream agent (61 CKB every 20s) |

### How CKB Is Used

- **Cell Model**: Every agent payment creates a real CKB cell (UTXO). Cells hold both capacity (value) and data.
- **On-Chain Payment Records**: When an agent stops, it writes a summary cell to CKB containing a JSON record of all activity in the cell's `outputs_data` field.
- **Lock Scripts**: All transactions use `secp256k1_blake160_sighash_all` for signature-verified ownership.
- **CCC SDK**: Transactions are built with `@ckb-ccc/core` — `Transaction.from()` → `completeInputsByCapacity()` → `completeFeeBy()` → `sendTransaction()`.
- **Fiber Network**: L2 payment channel invoices for off-chain micropayments between channel peers.

Each agent has built-in safety limits (per-transaction, per-hour, lifetime caps), can be paused/resumed from the dashboard, and logs every payment in real time with clickable explorer links.

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- **CKB testnet private key** (instructions below)

Optional (for Fiber L2 payments):
- **Fiber node** binary ([setup script included](#running-with-a-fiber-node))

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Jeremicarose/FiberAgentPay.git
cd FiberAgentPay
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your private key:

```env
WALLET_PRIVATE_KEY=0x<your-testnet-private-key>
```

Don't have a key? Generate one:

```bash
# Option A: Use openssl
echo "0x$(openssl rand -hex 32)"

# Option B: Use Node.js
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Fund your wallet

Get testnet CKB from the faucet. First, find your address:

```bash
pnpm build
pnpm --filter @fiber-agent-pay/server dev
# Look for: Wallet: ckt1q...
# Copy that address
```

Then visit **https://faucet.nervos.org/** and request funds for your address (100,000 CKB recommended).

### 4. Build and start

```bash
# Build all packages
pnpm build

# Start the server
node packages/server/dist/index.js

# In another terminal, start the dashboard
pnpm --filter @fiber-agent-pay/dashboard dev
```

### 5. Launch the Pipeline Economy

Go to **http://localhost:5173** and click **Launch Pipeline Economy**.

This creates 4 agents wired together, funds each with 500 CKB from your wallet, and starts them all:
- **Data Provider** (Commerce) — sells weather data at 40 CKB/request
- **Analyst** (Commerce) — buys data feeds, sells analysis at 80 CKB/request
- **Payment Stream** (Stream) — continuously pays Data Provider 61 CKB every 15 seconds
- **Reinvestor** (DCA) — sends 61 CKB to the Stream agent every 20 seconds

Within seconds you'll see:
- **Economy Graph** — 4 nodes with animated payment arrows showing money flow
- **Live Feed** — real-time events: commerce trades, stream payments, DCA reinvestments
- **On-Chain Transactions** — clickable links to verify each payment on CKB Explorer
- **Agent Cards** — wallet balances, revenue, spending, and profit for each agent

### Alternative: Simple 3-Agent Economy

If you prefer a simpler demo, click **"Or launch simple 3-agent commerce economy"** to create 3 Commerce agents that trade services with each other.

---

## On-Chain Verification

Every agent payment creates a real CKB transaction. You can verify them:

**In the dashboard**: Each payment in the Live Feed shows a clickable link like `0x64407e85...b5139a13 ↗` that opens the transaction on [CKB Testnet Explorer](https://pudge.explorer.nervos.org/).

**Via the API**:
```bash
# List all on-chain transactions
curl http://localhost:3001/payments/onchain
```

**On-chain payment record cells**: When an agent stops, it writes a summary cell containing JSON data:
```json
{
  "type": "fiber-agent-payment",
  "agentId": "abc123",
  "amount": "183000000",
  "timestamp": 1774266360930,
  "description": "Agent summary: 3 payments, 3 on-chain txs"
}
```

This data is stored in CKB's `outputs_data` field — demonstrating the Cell model's ability to hold arbitrary data alongside value.

### Minimum Cell Capacity

CKB requires a minimum of 61 CKB per cell. For micropayment agents (Stream, Commerce) where individual payments are smaller than 61 CKB, the system transfers the minimum cell size on-chain while tracking the actual micropayment amount in the agent's ledger. An on-chain cooldown of 30 seconds prevents rapid-fire agents from overwhelming L1.

---

## Running with a Fiber Node

Without a Fiber node, agents create **real CKB L1 transactions** for every payment. With a Fiber node, agents also create Fiber L2 invoices for off-chain payment proofs.

### Setup

```bash
# Download and configure the Fiber node
./scripts/setup-fiber-node.sh

# Start the node (runs on ports 8227 RPC + 8228 P2P)
./scripts/start-fiber-node.sh
```

The setup script:
- Downloads the `fnn` v0.7.1 binary for your platform
- Uses the official CKB testnet configuration
- Generates a wallet key (encrypted with `FIBER_SECRET_KEY_PASSWORD`)

### Fund the Fiber node wallet

The Fiber node has its own wallet for channel funding. Fund it the same way — get the address from the node info and use the faucet:

```bash
curl -s -X POST http://127.0.0.1:8227 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"node_info","params":[],"id":1}'
# Look for default_funding_lock_script.args — that's the lock arg
```

### Verify connection

Start the FiberAgentPay server. You should see:

```
Fiber node: connected at http://127.0.0.1:8227
```

And `GET /health` returns `"fiber": true`.

---

## Project Structure

```
FiberAgentPay/
├── packages/
│   ├── core/           # Shared types, config, utilities
│   ├── fiber-client/   # Fiber Network JSON-RPC client
│   ├── ckb-client/     # CKB SDK wrapper (wallet, transfers, payment records)
│   ├── agents/         # Agent implementations (DCA, Stream, Commerce)
│   │                   #   + Scheduler with createPipeline() orchestration
│   ├── server/         # Hono HTTP + WebSocket server
│   └── dashboard/      # React + Tailwind real-time dashboard
│                       #   Economy Graph, Live Feed, Agent Cards
├── fiber-node/         # Fiber node binary + config (gitignored)
├── scripts/            # Setup and automation scripts
└── .env                # Environment configuration (gitignored)
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Dashboard (React)               │
│     http://localhost:5173                    │
│  Economy Graph + Live Feed + Agent Cards    │
│  Explorer links for on-chain tx hashes      │
└──────┬──────────────────┬───────────────────┘
       │ REST API          │ WebSocket
       ▼                   ▼
┌─────────────────────────────────────────────┐
│           Server (Hono + WS)                │
│     http://localhost:3001                    │
│     ws://localhost:3002                      │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │       Agent Scheduler           │        │
│  │                                 │        │
│  │  Pipeline Economy:              │        │
│  │  Commerce ──► Stream ──► DCA    │        │
│  │  (discover)  (subscribe) (invest)│       │
│  │                                 │        │
│  │     ┌─────┐ ┌────────┐ ┌─────┐ │        │
│  │     │ DCA │ │ Stream │ │Comm.│ │        │
│  │     └──┬──┘ └───┬────┘ └──┬──┘ │        │
│  │        └────────┼─────────┘    │        │
│  │                 ▼              │        │
│  │          Safety Guard          │        │
│  │    (per-tx, hourly, lifetime)  │        │
│  └─────────────┬──────────────────┘        │
└────────────────┼───────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────┐          ┌──────────────┐
│  Fiber   │          │  CKB Testnet │
│  Node    │          │  (on-chain)  │
│ :8227    │          │              │
│ Invoices │          │  Transfers   │
│ Channels │          │  Payment     │
│ L2 Pmts  │          │  Records     │
└──────────┘          │  (Cell data) │
                      └──────────────┘
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status (Fiber + wallet connectivity) |
| `POST` | `/agents/pipeline` | Launch the full pipeline economy (4 agents) |
| `POST` | `/agents` | Create a new agent |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:id` | Get agent details |
| `POST` | `/agents/:id/start` | Start an agent |
| `POST` | `/agents/:id/stop` | Stop an agent |
| `POST` | `/agents/:id/pause` | Pause an agent |
| `POST` | `/agents/:id/resume` | Resume a paused agent |
| `DELETE` | `/agents/:id` | Remove a stopped agent |
| `GET` | `/channels` | List Fiber channels |
| `GET` | `/payments` | Payment history |
| `GET` | `/payments/onchain` | Payments with real CKB tx hashes |
| `GET` | `/payments/:hash` | Payment status by hash |
| `GET` | `/wallet` | Wallet info and balance |

---

## Agent Safety

Every agent enforces three-tier spending limits:

| Limit | Default | Purpose |
|-------|---------|---------|
| Per-transaction | 100 CKB | Prevent single large payments |
| Per-hour | 2,000 CKB | Rate limiting |
| Lifetime total | 10,000 CKB | Budget cap |

When a limit is hit, the agent **auto-pauses** and emits a `safety:limit_reached` event. You can resume it from the dashboard after reviewing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | CKB Testnet (Nervos) — Cell model, UTXO-style |
| L2 Payments | Fiber Network (Lightning-style channels) |
| CKB SDK | @ckb-ccc/core (transaction building, signing) |
| Backend | Hono (TypeScript HTTP framework) |
| Real-time | WebSocket (ws library) |
| Frontend | React + Vite + Tailwind CSS + react-router-dom |
| Language | TypeScript throughout |

---

## License

MIT
