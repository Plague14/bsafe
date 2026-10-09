# BSafe Android app

Native Android client for BSafe (React Native + Expo), talking to the same devnet program as the web app.
Wallets connect through the Solana Mobile Wallet Adapter, so it works with Phantom, Solflare and the Seeker Seed Vault.

## Features

- **Vaults:** create, deposit, withdraw, and get devnet SOL from the faucet
- **Heirs:** add or remove heirs with percentage shares (must total 100%)
- **Inheritance plan:** deadman switch, death certificate or both; cooldown with "Prove I'm alive"; verifiers
- **My inheritances:** heirs submit the certificate hash (the file never leaves the phone), verifiers compare and confirm, then trigger and claim
- **Multisig:** signers, threshold, propose / approve / execute / reject withdrawals
- **Languages:** English by default, Portuguese (BR) toggle

## Layout

- `src/lib/program.ts` — account parsers, readers and instruction builders (mirrors `src/hooks/useProgram.ts` in the web app)
- `src/wallet/` — Mobile Wallet Adapter session, shared vault state, action runner
- `src/app/` — Expo Router screens
- `scripts/devnet-check.ts` — runs the program client against devnet with throwaway keys:
  `FUNDER=<funded keypair json> npx tsx scripts/devnet-check.ts`

## Building the APK

Requirements: Node 20+, JDK 17, Android SDK with platform 36, build-tools 36, NDK 27.1 and CMake.

```bash
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/`.
On Windows, build from a short path (e.g. `C:\bm`); otherwise the native build hits the 260-character path limit.

Optional environment variables:

- `EXPO_PUBLIC_RPC_URL` — a dedicated devnet RPC (the public one is rate-limited)
- `EXPO_PUBLIC_DEMO_TIMERS=false` — use day-based timers when pointing at a production program build

Release builds are currently signed with the debug key; generate a release keystore before publishing to the Solana dApp Store.
