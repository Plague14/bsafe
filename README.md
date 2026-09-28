# BSafe - Digital Inheritance for Crypto Assets

> Non-custodial multisig wallet with automated digital inheritance on Solana.

**Built for Colosseum Crypto World's Fair Hackathon 2026**

## The Problem

Over **$100 billion** in cryptocurrency is at risk of being permanently lost when holders pass away without proper succession planning. Traditional inheritance systems fail with crypto because:

- Private keys can't go through probate courts
- Hardware wallets become useless without seed phrases
- Centralized exchanges require lengthy legal processes
- No automated on-chain solution exists for Solana

## The Solution

BSafe is an on-chain inheritance protocol that allows crypto holders to:

- Create secure vaults with multisig control
- Designate beneficiaries with percentage-based distribution
- Configure inheritance triggers (death certificate verification + deadman switch)
- Include a cooldown period for false-trigger protection
- Ensure non-custodial, trustless asset transfer

## How It Works

```
1. CREATE VAULT      2. ADD BENEFICIARIES     3. CONFIGURE PLAN
   +--------+           +--------+               +--------+
   | Vault  |  ------>  |  60%   |  --------->  | 30 day |
   | + SOL  |           |  40%   |              |cooldown|
   +--------+           +--------+               +--------+
                                                      |
                                                      v
4. TRIGGER EVENT     5. COOLDOWN              6. CLAIM
   +--------+           +--------+               +--------+
   | Proof  |  ------>  | Owner  |  --------->  | Funds  |
   | Submit |           | Cancel?|              |Distribute
   +--------+           +--------+               +--------+
```

### Detailed Flow

1. **Create Vault** - Deposit SOL into a PDA-controlled vault
2. **Add Beneficiaries** - Assign wallet addresses with share percentages (must sum to 100%)
3. **Configure Inheritance** - Set trigger type, cooldown period, and deadman switch interval
4. **Trigger Event** - Beneficiary submits proof (death certificate hash), verified by trusted multisig
5. **Cooldown** - Owner has X days to cancel (proves they're alive)
6. **Claim** - After cooldown, beneficiaries withdraw their shares automatically

## Architecture

```mermaid
graph TB
    User[User / Wallet] -->|Connect| Frontend[React Frontend]
    Frontend -->|Sign & Send TX| Program[BSafe Anchor Program]

    Program --> Vault[Vault PDA]
    Program --> Beneficiary[Beneficiary Accounts]
    Program --> Multisig[Multisig Config]
    Program --> Inheritance[Inheritance Plan]

    Vault -->|Holds| SOL[SOL / SPL Tokens]

    subgraph Inheritance Flow
        Beneficiary -->|Submit Proof| DeathCert[Death Certificate Hash]
        DeathCert -->|Verify| Verifiers[Trusted Verifiers Multisig]
        Verifiers -->|Confirm| Cooldown[Cooldown Period]
        Cooldown -->|Expire| Claim[Claim Distribution]
    end

    subgraph Safety
        Owner[Vault Owner] -->|Activity| DeadmanSwitch[Deadman Switch Reset]
        Owner -->|Cancel| Cooldown
    end
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contract | Anchor (Rust) on Solana |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Wallet | Phantom, Solflare via Wallet Adapter |
| Network | Solana Devnet |

## Program ID (Devnet)

```
3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv
```

[View on Solana Explorer](https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet)

## Live Demo

<!-- TODO: Add deployed URL -->

## Screenshots

<!-- TODO: Add screenshots -->

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + Solana CLI + Anchor CLI
- Phantom wallet (browser extension)

### Smart Contract

```bash
cd anchor
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

### Frontend

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Environment

Copy `.env.example` to `.env` and configure if needed:

```bash
cp .env.example .env
```

## Project Structure

```
bsafe/
├── anchor/                    # Smart contract
│   ├── programs/bsafe/src/
│   │   ├── state/            # Account structs
│   │   │   ├── vault.rs
│   │   │   ├── beneficiary.rs
│   │   │   ├── inheritance.rs
│   │   │   ├── multisig_types.rs
│   │   │   └── membership.rs
│   │   ├── instructions/     # Program instructions
│   │   │   ├── vault/
│   │   │   ├── beneficiary/
│   │   │   ├── inheritance/
│   │   │   ├── multisig/
│   │   │   └── membership/
│   │   ├── errors.rs
│   │   └── lib.rs
│   └── tests/
│       └── bsafe.ts
├── src/                       # React frontend
│   ├── components/
│   ├── hooks/
│   │   └── useProgram.ts     # On-chain interactions
│   ├── pages/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── constants.ts
│   │   └── pda.ts
│   └── contexts/
│       └── WalletProvider.tsx
├── docs/
│   ├── USER_GUIDE.md
│   ├── BUSINESS_MODEL.md
│   └── COMPETITOR_ANALYSIS.md
└── public/
    └── images/
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Multisig Vault** | M-of-N signer threshold for withdrawals |
| **Beneficiary Management** | Add/remove/update with percentage shares |
| **Death Certificate Verification** | Hash-based proof verified by trusted parties |
| **Deadman Switch** | Auto-trigger if owner inactive for configurable period |
| **Cooldown Protection** | Owner can cancel false triggers within grace period |
| **On-chain Distribution** | Automatic proportional fund distribution |
| **Membership Tiers** | Free (1% fee), Premium (0% fee), Concierge |

## Security Considerations

- All account validations use Anchor constraints (`has_one`, `signer` checks)
- Overflow protection with checked arithmetic
- Rent recovery on account closure
- 40+ custom error codes for precise failure handling
- Share validation ensures allocations sum to exactly 100%
- Cooldown period prevents hasty or false claims

## Business Model

BSafe uses a freemium model:

| Tier | Price | Claim Fee | Vaults | Beneficiaries |
|------|-------|-----------|--------|---------------|
| Free | $0 | 1% | 1 | 3 |
| Premium | 1 SOL | 0% | 5 | 10 |
| Concierge | 50 SOL/yr | 0% | Unlimited | 50 |

See [BUSINESS_MODEL.md](docs/BUSINESS_MODEL.md) for full details.

## Roadmap

- [x] Core vault and beneficiary management
- [x] Multisig support
- [x] Inheritance flow (trigger, cooldown, claim)
- [x] Membership tiers
- [ ] SPL token support
- [ ] Multi-chain expansion (Ethereum, Base)
- [ ] Mobile app
- [ ] Legal document templates

## Team

Built with passion for the Colosseum Hackathon.

## License

MIT License - see [LICENSE](LICENSE) file.

## Links

- [Solana Explorer](https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet)
- [User Guide](docs/USER_GUIDE.md)
- [Business Model](docs/BUSINESS_MODEL.md)
- [Competitor Analysis](docs/COMPETITOR_ANALYSIS.md)

---

**BSafe** - Because your crypto legacy matters.
