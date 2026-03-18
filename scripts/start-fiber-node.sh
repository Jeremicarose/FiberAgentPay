#!/usr/bin/env bash
# ============================================================
# Start Fiber Node
# ============================================================
# Launches the Fiber Network node with testnet configuration.
#
# The node will:
#   - Listen for P2P connections on port 8228
#   - Serve JSON-RPC on port 8227 (localhost only)
#   - Connect to CKB testnet via https://testnet.ckbapp.dev/
#   - Auto-discover peers via testnet bootnodes
#
# Usage:
#   ./scripts/start-fiber-node.sh          # foreground
#   ./scripts/start-fiber-node.sh &        # background
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIBER_DIR="$PROJECT_ROOT/fiber-node"

if [ ! -f "$FIBER_DIR/fnn" ]; then
  echo "Fiber binary not found. Run setup first:"
  echo "  ./scripts/setup-fiber-node.sh"
  exit 1
fi

if [ ! -f "$FIBER_DIR/ckb/key" ]; then
  echo "Wallet key not found. Run setup first:"
  echo "  ./scripts/setup-fiber-node.sh"
  exit 1
fi

echo "=== Starting Fiber Node ==="
echo "RPC:  http://127.0.0.1:8227"
echo "P2P:  0.0.0.0:8228"
echo "Chain: testnet"
echo ""

cd "$FIBER_DIR"
RUST_LOG="${RUST_LOG:-info}" exec ./fnn \
  -c config/testnet/config.yml \
  -d .
