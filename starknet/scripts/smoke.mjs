// End-to-end inheritance on Sepolia against the deployed (demo_mode) contract:
// owner funds a vault, names an heir and goes silent; the heir triggers the deadman
// switch, waits out the cooldown and claims (minus the 1% Free-tier fee).
import fs from 'node:fs';
import path from 'node:path';
import { Account, Contract, CairoCustomEnum, cairo, json, shortString } from 'starknet';
import {
  ROOT, provider, loadOrCreateKey, strkBalance, isDeployed, fmt,
  OZ_ACCOUNT_CLASS_HASH, STRK_SEPOLIA,
} from './common.mjs';

const STRK = 10n ** 18n;
const DEPOSIT = 10n * STRK;
const COOLDOWN = 60;
const DEADMAN = 120;

const deployment = JSON.parse(fs.readFileSync(path.join(ROOT, 'deployments', 'sepolia.json'), 'utf8'));
const { abi } = json.parse(
  fs.readFileSync(path.join(ROOT, 'target', 'dev', 'bsafe_BSafe.contract_class.json'), 'utf8'),
);

const ownerKey = loadOrCreateKey('DEPLOYER_PRIVATE_KEY');
const heirKey = loadOrCreateKey('HEIR_PRIVATE_KEY');
const owner = new Account({ provider, address: ownerKey.address, signer: ownerKey.privateKey });
const heir = new Account({ provider, address: heirKey.address, signer: heirKey.privateKey });
const bsafe = new Contract({ abi, address: deployment.contract, providerOrAccount: provider });

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const explorer = (tx) => `https://sepolia.voyager.online/tx/${tx}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function send(account, calls, label) {
  const { transaction_hash } = await account.execute(calls);
  await provider.waitForTransaction(transaction_hash);
  log(`${label}: ${explorer(transaction_hash)}`);
  return transaction_hash;
}

async function chainNow() {
  const block = await provider.getBlockWithTxHashes('latest');
  return Number(block.timestamp);
}

async function waitUntil(ts, label) {
  for (;;) {
    const now = await chainNow();
    if (now >= ts) return;
    log(`waiting ${ts - now}s for ${label}...`);
    await sleep(Math.min(20, ts - now + 3));
  }
}

const txs = {};

// 1. The heir gets their own account (a little STRK for gas, then deploy)
if (!(await isDeployed(heirKey.address))) {
  txs.fundHeir = await send(owner, [{
    contractAddress: STRK_SEPOLIA,
    entrypoint: 'transfer',
    calldata: [heirKey.address, ...Object.values(cairo.uint256(5n * STRK))],
  }], 'fund heir with 5 STRK');
  const { transaction_hash } = await heir.deployAccount({
    classHash: OZ_ACCOUNT_CLASS_HASH,
    constructorCalldata: heirKey.constructorCalldata,
    addressSalt: heirKey.publicKey,
  });
  await provider.waitForTransaction(transaction_hash);
  txs.deployHeir = transaction_hash;
  log(`heir account deployed: ${explorer(transaction_hash)}`);
}

// 2. Owner creates the vault
txs.createVault = await send(owner, [bsafe.populate('create_vault', {
  name: shortString.encodeShortString('Smoke test'),
  token: STRK_SEPOLIA,
})], 'create_vault');
const vaultId = BigInt(await bsafe.get_vault_count());
log(`vault id ${vaultId}`);

// 3. One multicall: approve + deposit + add heir (100%) + deadman plan
txs.setup = await send(owner, [
  { contractAddress: STRK_SEPOLIA, entrypoint: 'approve',
    calldata: [deployment.contract, ...Object.values(cairo.uint256(DEPOSIT))] },
  bsafe.populate('deposit', { vault_id: vaultId, amount: cairo.uint256(DEPOSIT) }),
  bsafe.populate('add_beneficiary', { vault_id: vaultId, wallet: heirKey.address, share_bps: 10000 }),
  bsafe.populate('create_inheritance_plan', {
    vault_id: vaultId,
    trigger_type: new CairoCustomEnum({ DeadmanSwitch: {} }),
    cooldown_seconds: COOLDOWN,
    deadman_seconds: DEADMAN,
    required_verifications: 0,
  }),
], 'multicall approve + deposit + add_beneficiary + create_inheritance_plan');

// 4. Owner goes silent; the heir triggers the deadman switch
const vault = await bsafe.get_vault(vaultId);
await waitUntil(Number(vault.last_activity) + DEADMAN, 'the deadman switch');
txs.initiate = await send(heir, [bsafe.populate('initiate_inheritance', { vault_id: vaultId })],
  'initiate_inheritance (by heir)');

// 5. Cooldown, then claim
const plan = await bsafe.get_plan(vaultId);
await waitUntil(Number(plan.cooldown_ends_at), 'the cooldown');
const before = await strkBalance(heirKey.address);
txs.claim = await send(heir, [bsafe.populate('claim_inheritance', { vault_id: vaultId })],
  'claim_inheritance (by heir)');
const after = await strkBalance(heirKey.address);

const final = await bsafe.get_vault(vaultId);
log(`heir received ~${fmt(after - before)} STRK (gross 10, 1% fee, minus gas)`);
log(`vault balance ${fmt(BigInt(final.balance))}, status ${final.status.activeVariant()}`);

const out = { network: 'sepolia', contract: deployment.contract, vaultId: vaultId.toString(),
  owner: ownerKey.address, heir: heirKey.address, txs, ranAt: new Date().toISOString() };
fs.writeFileSync(path.join(ROOT, 'deployments', 'sepolia-smoke.json'), JSON.stringify(out, null, 2) + '\n');
log('saved deployments/sepolia-smoke.json');
