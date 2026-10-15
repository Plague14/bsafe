// Deploys the deployer account (first run), declares BSafe and deploys it to Sepolia.
// Usage: node deploy.mjs [--prod]   (default: demo timers, minutes instead of days)
import fs from 'node:fs';
import path from 'node:path';
import { Account, CallData, json, cairo } from 'starknet';
import {
  ROOT, provider, loadOrCreateKey, strkBalance, isDeployed, fmt,
  OZ_ACCOUNT_CLASS_HASH, STRK_SEPOLIA,
} from './common.mjs';

const demoMode = !process.argv.includes('--prod');
const key = loadOrCreateKey();
const account = new Account({ provider, address: key.address, signer: key.privateKey });

const balance = await strkBalance(key.address);
console.log(`Deployer ${key.address} — ${fmt(balance)} STRK`);
if (balance === 0n) {
  console.error('Fund this address with Sepolia STRK first: https://starknet-faucet.vercel.app');
  process.exit(1);
}

if (!(await isDeployed(key.address))) {
  console.log('Deploying the account contract...');
  const { transaction_hash } = await account.deployAccount({
    classHash: OZ_ACCOUNT_CLASS_HASH,
    constructorCalldata: key.constructorCalldata,
    addressSalt: key.publicKey,
  });
  await provider.waitForTransaction(transaction_hash);
  console.log('  account deployed:', transaction_hash);
}

const target = path.join(ROOT, 'target', 'dev');
const sierra = json.parse(fs.readFileSync(path.join(target, 'bsafe_BSafe.contract_class.json'), 'utf8'));
const casm = json.parse(fs.readFileSync(path.join(target, 'bsafe_BSafe.compiled_contract_class.json'), 'utf8'));

console.log('Declaring BSafe...');
const declared = await account.declareIfNot({ contract: sierra, casm });
if (declared.transaction_hash) await provider.waitForTransaction(declared.transaction_hash);
console.log('  class hash:', declared.class_hash);

const STRK = 10n ** 18n;
const constructorCalldata = new CallData(sierra.abi).compile('constructor', {
  admin: key.address,
  treasury: key.address,
  payment_token: STRK_SEPOLIA,
  premium_price: cairo.uint256(50n * STRK),
  concierge_price: cairo.uint256(1000n * STRK),
  demo_mode: demoMode,
});

console.log(`Deploying BSafe (demo_mode=${demoMode})...`);
const deployed = await account.deployContract({ classHash: declared.class_hash, constructorCalldata });
await provider.waitForTransaction(deployed.transaction_hash);
console.log('  contract:', deployed.contract_address);

const out = {
  network: 'sepolia',
  contract: deployed.contract_address,
  classHash: declared.class_hash,
  deployTx: deployed.transaction_hash,
  admin: key.address,
  paymentToken: STRK_SEPOLIA,
  demoMode,
  deployedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(ROOT, 'deployments', 'sepolia.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Saved deployments/sepolia.json');
console.log(`Voyager: https://sepolia.voyager.online/contract/${deployed.contract_address}`);
