# BSafe on Starknet

Cairo port of the BSafe program: multisig vaults with on-chain digital inheritance.
Same model as the Solana version (vaults, heirs with shares, deadman switch, death
certificate with verifiers, owner cancel window, multisig, membership tiers with a 1%
claim fee on the free tier), adapted to Starknet:

- **Any ERC-20 per vault**: STRK, ETH, USDC.
- **Multicall**: approve + deposit + add heir + create plan in one transaction.
- **Heartbeat**: the owner proves they are alive without moving funds.
- **Pro rata claims** against the shares active at trigger time; the last heir takes
  the rounding dust, so a completed vault always ends at exactly zero.
- **Overflow-safe by default**: Cairo integer arithmetic panics on overflow.

## Sepolia

| | |
|---|---|
| Contract | [`0x5f13f2fd…0145a5`](https://sepolia.voyager.online/contract/0x5f13f2fd32b77f938bde11362cc7cee0499f0aee5562e54a2bfc8b5a0145a5) |
| Class hash | `0x6b2d6c63f44ee87ca3832145597ae9ac1166fe2a64a0d787713511594d93540` |
| Mode | `demo_mode = true` (minimum timers in minutes instead of days) |

End-to-end run on Sepolia (`scripts/smoke.mjs`): the owner funds a vault with 10 STRK and
names an heir in one multicall, goes silent; the heir triggers the deadman switch, waits
out the cooldown and claims 9.9 STRK (1% fee to the treasury). Transactions are in
[`deployments/sepolia-smoke.json`](deployments/sepolia-smoke.json):
[setup multicall](https://sepolia.voyager.online/tx/0x3416d9b9aa9facec718078d03c6b0bb4a6f104eb833e9f77a89041b72a7274a) ·
[initiate](https://sepolia.voyager.online/tx/0x67a2a18c242c010762e7f02111ef8dbeb49264a99e817fb95461f2c9d4f5229) ·
[claim](https://sepolia.voyager.online/tx/0x434e93951a18e3b840614e705f30607fd66303d1e6bde25c30b8ce9f1a4516b)

## Build and test

Requires [Scarb](https://docs.swmansion.com/scarb/) 2.21.

```bash
scarb build
scarb test
```

29 tests cover vault funds, beneficiary shares, the deadman switch, death certificate
verification (including re-verification after a cancel), the cancel window, multisig
proposals and approvals, and membership fees.

## Deploy

```bash
cd scripts
npm install
node account.mjs        # creates the deployer key in ../.env and prints the address to fund
node deploy.mjs         # demo timers; add --prod for production minimums
node smoke.mjs          # end-to-end inheritance on the deployed contract
```

Set `STARKNET_RPC_URL` to use another Sepolia RPC.
