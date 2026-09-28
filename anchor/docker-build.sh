#!/bin/bash
set -e

echo "Installing Solana CLI..."
curl -sSfL https://release.anza.xyz/stable/install | sh
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

echo "Solana version:"
solana --version

echo "Installing Anchor CLI..."
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

echo "Building BSafe program..."
cd /workdir
anchor build

echo "Build complete!"
ls -la target/deploy/
