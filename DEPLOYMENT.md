# BSafe - Deployment Info

## 🚀 Devnet Deployment

| Field | Value |
|-------|-------|
| **Program ID** | `3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv` |
| **Network** | Solana Devnet |
| **RPC URL** | `https://api.devnet.solana.com` |
| **Explorer** | [View Program](https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet) |
| **Deploy Date** | 2026-09-18 |
| **Deploy TX** | `5KCrfpkHMh6y4xVU9ASUadCjey2RZCWaQhScr11ujM3oxXyXi1cn31jko2rLBbkqVwAdbseY2iZKZgJSchHRyr75` |

## Program Features

### Vault Management
- `create_vault` — Create a new vault with owner
- `deposit` — Deposit SOL into vault
- `withdraw` — Withdraw SOL (requires multisig if enabled)

### Beneficiary Management
- `add_beneficiary` — Add beneficiary with share percentage (basis points)
- `remove_beneficiary` — Remove beneficiary
- `update_shares` — Update beneficiary share allocation

### Multisig
- `add_signer` — Add co-signer to vault
- `remove_signer` — Remove co-signer
- `update_threshold` — Update approval threshold
- `propose_transaction` — Propose a transaction
- `approve_transaction` — Approve pending transaction
- `reject_transaction` — Reject transaction (owner only)
- `execute_transaction` — Execute approved transaction

### Digital Inheritance
- `create_inheritance_plan` — Configure inheritance plan
- `add_verifier` — Add death certificate verifier
- `submit_death_certificate` — Submit proof of death
- `verify_death_certificate` — Verify submitted proof
- `initiate_inheritance` — Start cooldown period
- `claim_inheritance` — Claim share after cooldown
- `cancel_inheritance` — Cancel (owner proves alive)
- `reset_inheritance_plan` — Reset cancelled plan

## Frontend Integration

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv');
const RPC_URL = 'https://api.devnet.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');
```

## PDA Seeds

| Account | Seeds |
|---------|-------|
| Vault | `["vault", owner.pubkey]` |
| Vault Treasury | `["vault_treasury", vault.pubkey]` |
| Beneficiary | `["beneficiary", vault.pubkey, wallet.pubkey]` |
| Inheritance Plan | `["inheritance", vault.pubkey]` |
| Death Certificate Proof | `["proof", inheritance_plan.pubkey]` |
| Verifier | `["verifier", inheritance_plan.pubkey, verifier.pubkey]` |
| Multisig Signer | `["signer", vault.pubkey, signer.pubkey]` |
| Multisig Transaction | `["multisig_tx", vault.pubkey, nonce]` |

## Build & Deploy Commands

```bash
# Build (via Docker)
docker run --rm -v Z:\HD_1\DFK\BSafe\bsafe-clean\bsafe-clean\anchor:/workdir -w /workdir rust:latest bash /workdir/docker-build.sh

# Deploy
solana program deploy anchor/target/deploy/bsafe.so

# Check program
solana program show 3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv
```

## Deployer Wallet

- **Address:** `7oZZF58zWcNW1cGEmXLhJasAY8dUCB4qwp5WBJ39Gzod`
- **Keypair:** `anchor/deployer-keypair.json` (DO NOT COMMIT)
- **Network:** Devnet
