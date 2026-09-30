# BSafe - Deployment Info

## 🚀 Devnet Deployment

| Field | Value |
|-------|-------|
| **Program ID** | `3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv` |
| **Network** | Solana Devnet |
| **RPC URL** | `https://api.devnet.solana.com` |
| **Explorer** | [View Program](https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet) |
| **Deploy Date** | 2026-09-30 (upgrade; original deploy 2026-09-18) |
| **Deploy TX** | `5BEAiGDMpGCWz3om1GATPHo9gTt7dZadGynqRtcQLzMvTcTKdc6s5cvz7pd7vNHsuER9wpZaGQBvsinfyx8jsYEp` |
| **Fee Treasury PDA** | `HMos1xQatoZYHXq8jLtMixhWkAkfeUmLRXaCQe7UR4av` (initialized) |

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
| Vault | `["vault", owner.pubkey, name (32 bytes)]` |
| Vault Treasury | `["vault_treasury", vault.pubkey]` |
| Beneficiary | `["beneficiary", vault.pubkey, wallet.pubkey]` |
| Inheritance Plan | `["inheritance", vault.pubkey]` |
| Death Certificate Proof | `["proof", inheritance_plan.pubkey]` |
| Verifier | `["verifier", inheritance_plan.pubkey, verifier.pubkey]` |
| Multisig Signer | `["signer", vault.pubkey, signer.pubkey]` |
| Multisig Transaction | `["multisig_tx", vault.pubkey, nonce]` |

## Build & Deploy Commands

Everything builds natively on Windows; toolchains and caches live on `Z:` (nothing on `C:`).

```bash
# Build program (.so) + IDL (target/idl/bsafe.json, target/types/bsafe.ts)
anchoruild.bat

# Integration tests: run the compiled bsafe.so in LiteSVM (vault, inheritance, multisig)
cd anchor/tests-svm && cargo test

# Upgrade the devnet program (upgrade authority = deployer wallet)
solana -u devnet program deploy anchor/target/deploy/bsafe.so   --program-id 3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv   -k anchor/deployer-keypair.json --upgrade-authority anchor/deployer-keypair.json

# Check program
solana -u devnet program show 3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv
```

Build notes:
- `build.bat` runs `anchor build --no-idl` then `anchor/scripts/build-idl.py`. Anchor 0.30.1's
  own IDL step compiles with `--cfg procmacro2_semver_exempt`, which fails on current Rust.
- The Windows SDK libs come from the `Microsoft.Windows.SDK.CPP.x64` NuGet package extracted
  to `Z:\HD_1\DFK\BSafe\winsdk\lib` (`build.bat` sets `LIB`/`INCLUDE`).
- The release profile uses `opt-level = "s"` so the `.so` fits the program's allocated size.

## Deployer Wallet

- **Address:** `7oZZF58zWcNW1cGEmXLhJasAY8dUCB4qwp5WBJ39Gzod`
- **Keypair:** `anchor/deployer-keypair.json` (DO NOT COMMIT)
- **Network:** Devnet
