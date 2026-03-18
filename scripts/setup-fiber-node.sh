#!/usr/bin/env bash
# ============================================================
# Fiber Node Setup Script
# ============================================================
# Downloads and configures a Fiber Network node for CKB testnet.
# Run this once to set up the node, then use start-fiber-node.sh
# to launch it.
#
# Prerequisites: curl, tar
# ============================================================

set -euo pipefail

FIBER_VERSION="v0.7.1"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIBER_DIR="$PROJECT_ROOT/fiber-node"

echo "=== Fiber Node Setup ==="
echo "Version: $FIBER_VERSION"
echo "Directory: $FIBER_DIR"
echo ""

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
  Darwin-x86_64)  PLATFORM="x86_64-darwin-portable" ;;
  Darwin-arm64)   PLATFORM="x86_64-darwin-portable" ;; # Rosetta 2
  Linux-x86_64)   PLATFORM="x86_64-linux-portable" ;;
  *)
    echo "Unsupported platform: $OS-$ARCH"
    echo "Download manually from: https://github.com/nervosnetwork/fiber/releases"
    exit 1
    ;;
esac

FILENAME="fnn_${FIBER_VERSION}-${PLATFORM}.tar.gz"
URL="https://github.com/nervosnetwork/fiber/releases/download/${FIBER_VERSION}/${FILENAME}"

mkdir -p "$FIBER_DIR"
cd "$FIBER_DIR"

# Download binary if not already present
if [ -f "fnn" ]; then
  echo "Fiber binary already exists. Skipping download."
else
  echo "Downloading $FILENAME..."
  curl -L -o fnn.tar.gz "$URL"
  echo "Extracting..."
  tar xzf fnn.tar.gz
  echo "Binary ready: $FIBER_DIR/fnn"
fi

# Generate wallet key if not present
mkdir -p "$FIBER_DIR/ckb"
if [ -f "$FIBER_DIR/ckb/key" ]; then
  echo "Wallet key already exists."
else
  echo "Generating wallet private key..."
  KEY="0x$(openssl rand -hex 32)"
  echo "$KEY" > "$FIBER_DIR/ckb/key"
  chmod 600 "$FIBER_DIR/ckb/key"
  echo "Key saved to: $FIBER_DIR/ckb/key"
  echo ""
  echo "IMPORTANT: Fund your Fiber node wallet before opening channels."
  echo "Use the CKB testnet faucet: https://faucet.nervos.org/"
  echo "Your private key is in $FIBER_DIR/ckb/key"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Fund your wallet at https://faucet.nervos.org/"
echo "  2. Run: ./scripts/start-fiber-node.sh"
echo "  3. The node will connect to CKB testnet automatically"
