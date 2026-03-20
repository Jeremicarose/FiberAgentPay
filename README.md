# FiberAgentPay

AI agents that autonomously execute micropayment strategies via [Fiber Network](https://fiber.world) payment channels on [CKB](https://nervos.org).

Built for the **Claw & Order: CKB AI Agent Hackathon**.

---

## What It Does

FiberAgentPay lets you create autonomous AI agents that manage micropayments through Fiber Network — a Lightning Network-style Layer 2 on CKB. Three agent types are available:

| Agent | Strategy | Example |
|-------|----------|---------|
| **DCA** | Periodic fixed-amount purchases | Buy 1 CKB every 10 seconds, 100 times |
| **Stream** | Continuous pay-per-second micropayments | Stream 0.01 CKB/second for API access |
| **Commerce** | Agent-to-agent marketplace | Agents buy/sell data feeds for micropayments |

Each agent has built-in safety limits (per-transaction, per-hour, lifetime caps), can be paused/resumed from the dashboard, and logs every payment in real time.

---

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- **CKB testnet private key** (instructions below)

Optional (for real Fiber payments):
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
pnpm --filter @fiber-agent-pay/server dev
# Look for: Wallet: ckt1q...
# Copy that address
```

Then visit **https://faucet.nervos.org/** and request funds for your address (100,000 CKB).

### 4. Build and start

```bash
# Build all packages
pnpm build

# Start the server + dashboard
pnpm dev
```

### 5. Open the dashboard

Go to **http://localhost:5173** (or the port shown in terminal).

You'll see:
- **Create Agent** panel — pick DCA, Stream, or Commerce
- **Agent cards** — show status, payments, and controls (Start/Pause/Stop)
- **Live Feed** — real-time stream of all agent events and payments
- **Wallet** — your CKB address and balance
- **Stats** — active agents, total events, total payments

### 6. Create your first agent

1. Click **DCA** in the Create Agent panel
2. Click **Create DCA Agent**
3. Click **Start** on the new agent card
4. Watch the Live Feed — you'll see payment events every 10 seconds

---

## Running with a Fiber Node

Without a Fiber node, agents run in **simulation mode** — they track payments locally but don't create real on-chain invoices. With a Fiber node running, agents create real Fiber testnet invoices for each payment.

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

When agents run, the logs will show real Fiber invoices:

```
[Agent abc123] Fiber connected — node: 02e0da7a...
[Agent abc123] Invoice created: fibt1000000001pcs...
[DCA Agent abc123] Purchase 1/10: 1.00 CKB — Total: 1.00 CKB
```

---

## Project Structure

```
FiberAgentPay/
├── packages/
│   ├── core/           # Shared types, config, utilities
│   ├── fiber-client/   # Fiber Network JSON-RPC client
│   ├── ckb-client/     # CKB SDK wrapper (wallet, transactions)
│   ├── agents/         # Agent implementations (DCA, Stream, Commerce)
│   ├── server/         # Hono HTTP + WebSocket server
│   └── dashboard/      # React + Tailwind real-time dashboard
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
│  Agent cards, Live Feed, Wallet, Stats      │
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
│  │  ┌─────┐ ┌────────┐ ┌────────┐ │        │
│  │  │ DCA │ │ Stream │ │Commerce│ │        │
│  │  └──┬──┘ └───┬────┘ └───┬────┘ │        │
│  │     └────────┼──────────┘      │        │
│  │              ▼                  │        │
│  │        Safety Guard             │        │
│  │   (per-tx, hourly, lifetime)    │        │
│  └─────────────┬───────────────────┘        │
└────────────────┼────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────┐          ┌──────────────┐
│  Fiber   │          │  CKB Testnet │
│  Node    │          │  (on-chain)  │
│ :8227    │          │              │
│ Invoices │          │  Wallet      │
│ Channels │          │  Balance     │
│ Payments │          │  Funding     │
└──────────┘          └──────────────┘
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status (Fiber + wallet connectivity) |
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
| `GET` | `/wallet` | Wallet info and balance |

---

## Agent Safety

Every agent enforces three-tier spending limits:

| Limit | Default | Purpose |
|-------|---------|---------|
| Per-transaction | 10 CKB | Prevent single large payments |
| Per-hour | 100 CKB | Rate limiting |
| Lifetime total | 1,000 CKB | Budget cap |

When a limit is hit, the agent **auto-pauses** and emits a `safety:limit_reached` event. You can resume it from the dashboard after reviewing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | CKB Testnet (Nervos) |
| L2 Payments | Fiber Network (Lightning-style channels) |
| CKB SDK | @ckb-ccc/core |
| Backend | Hono (TypeScript HTTP framework) |
| Real-time | WebSocket (ws library) |
| Frontend | React + Vite + Tailwind CSS |
| Language | TypeScript throughout |

---

## License

MIT
