// Exercises src/lib/program.ts against the deployed devnet program with throwaway keys.
// Usage: FUNDER=<path to funded keypair json> npx tsx scripts/devnet-check.ts
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction, type TransactionInstruction } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { RPC_ENDPOINT } from '../src/lib/config';
import { getBeneficiaries, getMultisigTransactions, getMyInheritances, getPlan, getSigners, getVaults, ixs } from '../src/lib/program';
import { vaultPda, nameToBytes32 } from '../src/lib/pda';

const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const funder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.FUNDER!, 'utf8'))));
const owner = Keypair.generate();
const heir = Keypair.generate();
const cosigner = Keypair.generate();

async function send(signer: Keypair, ...instructions: TransactionInstruction[]) {
  return sendAndConfirmTransaction(connection, new Transaction().add(...instructions), [signer]);
}

(async () => {
  await send(funder, SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: owner.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL }));
  const me = owner.publicKey;
  const vault = vaultPda(me, nameToBytes32('App Check'));

  console.log('create_vault', await send(owner, ixs.createVault(me, 'App Check')));
  console.log('deposit', await send(owner, ixs.deposit(me, vault, 0.05)));
  console.log('add_beneficiary', await send(owner, ixs.addBeneficiary(me, vault, heir.publicKey, 100)));
  console.log('create_plan', await send(owner, ixs.createPlan(me, vault, 'deadmanSwitch', 1, 2, 1)));
  console.log('add_signer x2', await send(owner, ixs.addSigner(me, vault, me), ixs.addSigner(me, vault, cosigner.publicKey)));

  let [v] = await getVaults(connection, me);
  console.log('vault parsed:', { name: v.name, balance: v.balance, tracked: v.trackedBalanceLamports.toString(), heirs: v.beneficiaryCount, multisig: v.multisigEnabled, threshold: v.multisigThreshold, signers: v.signerCount, status: v.status });
  console.log('propose', await send(owner, ixs.proposeWithdrawal(me, v, 0.01, me)));

  const heirs = await getBeneficiaries(connection, vault);
  console.log('heirs parsed:', heirs.map(h => ({ wallet: h.wallet.toBase58(), share: h.sharePercent, status: h.status })));
  const plan = await getPlan(connection, vault);
  console.log('plan parsed:', plan && { status: plan.status, trigger: plan.triggerType, cooldown: plan.cooldownSeconds, deadman: plan.deadmanSwitchSeconds, req: plan.requiredVerifications });
  console.log('signers parsed:', (await getSigners(connection, vault)).map(s => ({ signer: s.signer.toBase58().slice(0, 6), index: s.index, active: s.isActive })));
  console.log('proposals parsed:', (await getMultisigTransactions(connection, vault)).map(p => ({ amount: p.amount, status: p.status, approvals: p.approvalCount, threshold: p.threshold })));
  const views = await getMyInheritances(connection, heir.publicKey);
  console.log('heir view:', views.map(x => ({ vault: x.vault.name, share: x.beneficiary?.sharePercent, plan: x.plan?.status })));

  // Leave nothing behind: withdraw needs multisig now, so just report balances
  [v] = await getVaults(connection, me);
  console.log('ALL OK, vault balance', v.balance);
})().catch(err => { console.error('FAILED', err?.logs ?? err); process.exit(1); });
