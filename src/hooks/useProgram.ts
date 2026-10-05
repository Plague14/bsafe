import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { useCallback, useRef, useState } from 'react';
import { PROGRAM_ID, TIMER_UNIT_SECONDS } from '../lib/constants';
import {
  findVaultPDA, findVaultTreasuryPDA, findBeneficiaryPDA, findInheritancePlanPDA, findProofPDA,
  findVerifierPDA, findSignerPDA, findMultisigTxPDA, findMembershipPDA, findBsafeTreasuryPDA, nameToBytes32,
} from '../lib/pda';
import { describeError } from '../lib/errors';
import { translate, useI18n } from '../i18n';
import { sha256 } from '@noble/hashes/sha256';
import bs58 from 'bs58';

export interface Vault {
  address: PublicKey;
  treasury: PublicKey;
  owner: PublicKey;
  balance: number;
  /** Balance tracked in the vault account (lamports); used as the multisig proposal nonce */
  trackedBalanceLamports: bigint;
  name: string;
  status: 'active' | 'locked' | 'inheritance';
  signerCount: number;
  multisigEnabled: boolean;
  multisigThreshold: number;
  beneficiaryCount: number;
  lastActivity: number;
  createdAt: number;
}

export interface Beneficiary {
  address: PublicKey;
  vault: PublicKey;
  wallet: PublicKey;
  shareBps: number; // Share in basis points (0-10000)
  sharePercent: number; // Share as percentage (0-100)
  status: 'active' | 'removed' | 'claimed';
  index: number;
  claimedAmount: number;
  addedAt: number;
}

export type TriggerType = 'deathCertificate' | 'deadmanSwitch' | 'both';
export type InheritanceStatusType = 'configured' | 'proofSubmitted' | 'cooldownActive' | 'claimReady' | 'completed' | 'cancelled';

export interface InheritancePlan {
  address: PublicKey;
  vault: PublicKey;
  status: InheritanceStatusType;
  triggerType: TriggerType;
  cooldownSeconds: number;
  deadmanSwitchSeconds: number;
  triggeredAt: number;
  cooldownEndsAt: number;
  distributionAmount: number;
  requiredVerifications: number;
  currentVerifications: number;
  createdAt: number;
}

export interface MultisigSigner {
  address: PublicKey;
  vault: PublicKey;
  signer: PublicKey;
  index: number;
  isActive: boolean;
  addedAt: number;
}

export type MultisigTxStatus = 'pending' | 'approved' | 'executed' | 'cancelled';

export interface MultisigTransaction {
  address: PublicKey;
  vault: PublicKey;
  txType: number; // 0 = Withdrawal
  status: MultisigTxStatus;
  amount: number; // SOL
  destination: PublicKey;
  proposer: PublicKey;
  threshold: number;
  approvalCount: number;
  approvals: bigint; // bitmask by signer index
  proposedAt: number;
  executedAt: number;
}

export interface Verifier {
  address: PublicKey;
  inheritancePlan: PublicKey;
  verifier: PublicKey;
  hasVerified: boolean;
  verifiedAt: number;
}

export interface DeathCertificateProof {
  address: PublicKey;
  inheritancePlan: PublicKey;
  documentHash: string; // hex
  submittedBy: PublicKey;
  submittedAt: number;
  verified: boolean;
  verificationCount: number;
}

/** A vault seen from a beneficiary's or verifier's perspective. */
export interface InheritanceView {
  vault: Vault;
  plan: InheritancePlan | null;
  proof: DeathCertificateProof | null;
  beneficiary: Beneficiary | null; // set when the connected wallet is an heir
  verifier: Verifier | null; // set when the connected wallet is a verifier
}

// Generate Anchor instruction discriminator
function getInstructionDiscriminator(instructionName: string): Buffer {
  const hash = sha256(`global:${instructionName}`);
  return Buffer.from(hash.slice(0, 8));
}

// Anchor account discriminator, base58-encoded for getProgramAccounts memcmp filters
function accountFilter(accountName: string) {
  const disc = Buffer.from(sha256(`account:${accountName}`).slice(0, 8));
  return { memcmp: { offset: 0, bytes: bs58.encode(disc) } };
}

function parseVault(pubkey: PublicKey, data: Buffer, treasuryLamports: number): Vault {
  const status = data[72];
  const [treasury] = findVaultTreasuryPDA(pubkey);
  return {
    address: pubkey,
    treasury,
    owner: new PublicKey(data.slice(8, 40)),
    balance: treasuryLamports / LAMPORTS_PER_SOL,
    trackedBalanceLamports: data.readBigUInt64LE(73),
    name: new TextDecoder().decode(data.slice(40, 72)).replace(/\0+$/, ''),
    status: status === 0 ? 'active' : status === 1 ? 'locked' : 'inheritance',
    signerCount: data[84],
    multisigEnabled: data[82] === 1,
    multisigThreshold: data[83],
    beneficiaryCount: data[81],
    lastActivity: Number(data.readBigInt64LE(85)) * 1000,
    createdAt: Number(data.readBigInt64LE(93)) * 1000,
  };
}

function parseBeneficiary(pubkey: PublicKey, data: Buffer): Beneficiary {
  const shareBps = data.readUInt16LE(72);
  const status = data[74];
  return {
    address: pubkey,
    vault: new PublicKey(data.slice(8, 40)),
    wallet: new PublicKey(data.slice(40, 72)),
    shareBps,
    sharePercent: shareBps / 100,
    status: status === 0 ? 'active' : status === 1 ? 'removed' : 'claimed',
    index: data[75],
    claimedAmount: Number(data.readBigUInt64LE(76)) / LAMPORTS_PER_SOL,
    addedAt: Number(data.readBigInt64LE(84)) * 1000,
  };
}

function parseVerifier(pubkey: PublicKey, data: Buffer): Verifier {
  return {
    address: pubkey,
    inheritancePlan: new PublicKey(data.slice(8, 40)),
    verifier: new PublicKey(data.slice(40, 72)),
    hasVerified: data[72] === 1,
    verifiedAt: Number(data.readBigInt64LE(73)) * 1000,
  };
}

function parseProof(pubkey: PublicKey, data: Buffer): DeathCertificateProof {
  return {
    address: pubkey,
    inheritancePlan: new PublicKey(data.slice(8, 40)),
    documentHash: Buffer.from(data.slice(40, 72)).toString('hex'),
    submittedBy: new PublicKey(data.slice(72, 104)),
    submittedAt: Number(data.readBigInt64LE(104)) * 1000,
    verified: data[112] === 1,
    verificationCount: data[113],
  };
}

function parseSigner(pubkey: PublicKey, data: Buffer): MultisigSigner {
  return {
    address: pubkey,
    vault: new PublicKey(data.slice(8, 40)),
    signer: new PublicKey(data.slice(40, 72)),
    index: data[72],
    isActive: data[73] === 1,
    addedAt: Number(data.readBigInt64LE(74)) * 1000,
  };
}

function parseMultisigTx(pubkey: PublicKey, data: Buffer): MultisigTransaction {
  const statusMap: MultisigTxStatus[] = ['pending', 'approved', 'executed', 'cancelled'];
  return {
    address: pubkey,
    vault: new PublicKey(data.slice(8, 40)),
    txType: data[48],
    status: statusMap[data[49]] ?? 'pending',
    amount: Number(data.readBigUInt64LE(50)) / LAMPORTS_PER_SOL,
    destination: new PublicKey(data.slice(58, 90)),
    proposer: new PublicKey(data.slice(122, 154)),
    threshold: data[154],
    approvalCount: data[155],
    approvals: data.readBigUInt64LE(156),
    proposedAt: Number(data.readBigInt64LE(164)) * 1000,
    executedAt: Number(data.readBigInt64LE(172)) * 1000,
  };
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Current UI language, read through a ref so callbacks always see the latest choice
  const { lang } = useI18n();
  const langRef = useRef(lang);
  langRef.current = lang;

  /** Signs and sends one BSafe instruction; returns the signature or null (error set). */
  const sendIx = useCallback(async (
    name: string,
    args: Buffer,
    keys: TransactionInstruction['keys'],
    failureMessage: string,
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const instruction = new TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data: Buffer.concat([getInstructionDiscriminator(name), args]),
      });
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`${name}:`, signature);
      return signature;
    } catch (err) {
      console.error(`Failed ${name}:`, err);
      setError(describeError(err, failureMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const fetchVault = useCallback(async (address: PublicKey): Promise<Vault | null> => {
    const info = await connection.getAccountInfo(address);
    if (!info) return null;
    const [treasury] = findVaultTreasuryPDA(address);
    return parseVault(address, info.data, await connection.getBalance(treasury));
  }, [connection]);

  const getVaults = useCallback(async (): Promise<Vault[]> => {
    if (!wallet.publicKey) return [];

    try {
      setLoading(true);
      setError(null);

      // Vault account size: 8 (discriminator) + 32 + 32 + 1 + 8 + 1 + 1 + 1 + 1 + 8 + 8 + 1 + 32 + 32 = 166
      const VAULT_SIZE = 166;

      // Get all program accounts owned by the user
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: VAULT_SIZE },
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: wallet.publicKey.toBase58(),
            },
          },
        ],
      });

      const vaults: Vault[] = [];

      for (const { pubkey, account } of accounts) {
        const [treasury] = findVaultTreasuryPDA(pubkey);
        let treasuryBalance = 0;
        try {
          treasuryBalance = await connection.getBalance(treasury);
        } catch {
          // Treasury might not exist yet
        }
        vaults.push(parseVault(pubkey, account.data, treasuryBalance));
      }

      return vaults;
    } catch (err) {
      console.error('Error fetching vaults:', err);
      setError(describeError(err, 'Failed to fetch vaults', langRef.current));
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  const createVault = useCallback(async (name: string): Promise<PublicKey | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const nameBytes = nameToBytes32(name);
      const [vaultPDA] = findVaultPDA(wallet.publicKey, nameBytes);

      // Build instruction data: discriminator + name (32 bytes)
      const discriminator = getInstructionDiscriminator('create_vault');
      const instructionData = Buffer.concat([discriminator, Buffer.from(nameBytes)]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vaultPDA, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Vault created:', vaultPDA.toBase58(), 'tx:', signature);
      return vaultPDA;
    } catch (err) {
      console.error('Failed to create vault:', err);
      setError(describeError(err, 'Failed to create vault', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const depositToVault = useCallback(async (vault: PublicKey, amount: number): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [treasuryPDA] = findVaultTreasuryPDA(vault);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      // Build instruction data: discriminator + amount (u64)
      const discriminator = getInstructionDiscriminator('deposit');
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(BigInt(lamports));
      const instructionData = Buffer.concat([discriminator, amountBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: treasuryPDA, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Deposited to vault:', vault.toBase58(), 'tx:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to deposit:', err);
      setError(describeError(err, 'Failed to deposit', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const getBalance = useCallback(async (address: PublicKey): Promise<number> => {
    try {
      const balance = await connection.getBalance(address);
      return balance / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }, [connection]);

  const requestAirdrop = useCallback(async (amount: number = 1): Promise<string | null> => {
    if (!wallet.publicKey) return null;

    try {
      setLoading(true);
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        amount * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);
      return signature;
    } catch (err) {
      console.error('Airdrop failed:', err);
      setError(translate(langRef.current, 'dashboard.airdropFailed'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  const getBeneficiaries = useCallback(async (vault: PublicKey): Promise<Beneficiary[]> => {
    try {
      setLoading(true);
      setError(null);

      // Beneficiary account size: 8 + 32 + 32 + 2 + 1 + 1 + 8 + 8 + 1 + 32 = 125
      const BENEFICIARY_SIZE = 125;

      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: BENEFICIARY_SIZE },
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: vault.toBase58(),
            },
          },
        ],
      });

      return accounts.map(({ pubkey, account }) => parseBeneficiary(pubkey, account.data));
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setError('Failed to fetch beneficiaries');
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const addBeneficiary = useCallback(async (
    vault: PublicKey,
    beneficiaryWallet: PublicKey,
    sharePercent: number
  ): Promise<PublicKey | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [beneficiaryPDA] = findBeneficiaryPDA(vault, beneficiaryWallet);
      const shareBps = Math.floor(sharePercent * 100); // Convert to basis points

      // Build instruction data: discriminator + wallet (32 bytes) + share_bps (u16)
      const discriminator = getInstructionDiscriminator('add_beneficiary');
      const walletBuffer = beneficiaryWallet.toBuffer();
      const shareBpsBuffer = Buffer.alloc(2);
      shareBpsBuffer.writeUInt16LE(shareBps);
      const instructionData = Buffer.concat([discriminator, walletBuffer, shareBpsBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: beneficiaryPDA, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Beneficiary added:', beneficiaryPDA.toBase58(), 'tx:', signature);
      return beneficiaryPDA;
    } catch (err) {
      console.error('Failed to add beneficiary:', err);
      setError(describeError(err, 'Failed to add beneficiary', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const getInheritancePlan = useCallback(async (vault: PublicKey): Promise<InheritancePlan | null> => {
    try {
      const [planPDA] = findInheritancePlanPDA(vault);
      const accountInfo = await connection.getAccountInfo(planPDA);

      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;

      // Parse inheritance plan data
      const vaultKey = new PublicKey(data.slice(8, 40));
      const status = data[40];
      const triggerType = data[41];
      const cooldownSeconds = Number(data.readBigUInt64LE(42));
      const deadmanSwitchSeconds = Number(data.readBigUInt64LE(50));
      const triggeredAt = Number(data.readBigInt64LE(58));
      const cooldownEndsAt = Number(data.readBigInt64LE(66));
      const distributionAmount = Number(data.readBigUInt64LE(74));
      const requiredVerifications = data[82];
      const currentVerifications = data[83];
      const createdAt = Number(data.readBigInt64LE(84));

      const statusMap: Record<number, InheritanceStatusType> = {
        0: 'configured',
        1: 'proofSubmitted',
        2: 'cooldownActive',
        3: 'claimReady',
        4: 'completed',
        5: 'cancelled',
      };

      const triggerMap: Record<number, TriggerType> = {
        0: 'deathCertificate',
        1: 'deadmanSwitch',
        2: 'both',
      };

      return {
        address: planPDA,
        vault: vaultKey,
        status: statusMap[status] || 'configured',
        triggerType: triggerMap[triggerType] || 'both',
        cooldownSeconds,
        deadmanSwitchSeconds,
        triggeredAt: triggeredAt * 1000,
        cooldownEndsAt: cooldownEndsAt * 1000,
        distributionAmount: distributionAmount / LAMPORTS_PER_SOL,
        requiredVerifications,
        currentVerifications,
        createdAt: createdAt * 1000,
      };
    } catch (err) {
      console.error('Error fetching inheritance plan:', err);
      return null;
    }
  }, [connection]);

  const createInheritancePlan = useCallback(async (
    vault: PublicKey,
    triggerType: TriggerType,
    cooldownUnits: number,
    deadmanSwitchUnits: number,
    requiredVerifications: number
  ): Promise<PublicKey | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);

      // Convert form units (days, or minutes in demo builds) to seconds
      const cooldownSeconds = cooldownUnits * TIMER_UNIT_SECONDS;
      const deadmanSwitchSeconds = deadmanSwitchUnits * TIMER_UNIT_SECONDS;

      // Build instruction data
      const discriminator = getInstructionDiscriminator('create_inheritance_plan');

      // TriggerType enum: 0 = DeathCertificate, 1 = DeadmanSwitch, 2 = Both
      const triggerTypeValue = triggerType === 'deathCertificate' ? 0 : triggerType === 'deadmanSwitch' ? 1 : 2;

      const triggerTypeBuffer = Buffer.alloc(1);
      triggerTypeBuffer.writeUInt8(triggerTypeValue);

      const cooldownBuffer = Buffer.alloc(8);
      cooldownBuffer.writeBigUInt64LE(BigInt(cooldownSeconds));

      const deadmanBuffer = Buffer.alloc(8);
      deadmanBuffer.writeBigUInt64LE(BigInt(deadmanSwitchSeconds));

      const verificationsBuffer = Buffer.alloc(1);
      verificationsBuffer.writeUInt8(requiredVerifications);

      const instructionData = Buffer.concat([
        discriminator,
        triggerTypeBuffer,
        cooldownBuffer,
        deadmanBuffer,
        verificationsBuffer,
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: planPDA, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Inheritance plan created:', planPDA.toBase58(), 'tx:', signature);
      return planPDA;
    } catch (err) {
      console.error('Failed to create inheritance plan:', err);
      setError(describeError(err, 'Failed to create inheritance plan', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const updateBeneficiaryShares = useCallback(async (
    vault: PublicKey,
    beneficiaryAddress: PublicKey,
    newSharePercent: number
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const newShareBps = Math.floor(newSharePercent * 100);

      const discriminator = getInstructionDiscriminator('update_shares');
      const shareBpsBuffer = Buffer.alloc(2);
      shareBpsBuffer.writeUInt16LE(newShareBps);
      const instructionData = Buffer.concat([discriminator, shareBpsBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: beneficiaryAddress, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Beneficiary shares updated:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to update shares:', err);
      setError(describeError(err, 'Failed to update shares', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const initiateInheritance = useCallback(async (
    vault: PublicKey
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);
      const [treasuryPDA] = findVaultTreasuryPDA(vault);
      const [proofPDA] = findProofPDA(planPDA);

      const discriminator = getInstructionDiscriminator('initiate_inheritance');

      // Optional proof account (death certificate trigger); program ID when absent
      const proofInfo = await connection.getAccountInfo(proofPDA);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: planPDA, isSigner: false, isWritable: true },
          { pubkey: treasuryPDA, isSigner: false, isWritable: false },
          { pubkey: proofInfo ? proofPDA : PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: discriminator,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Inheritance initiated:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to initiate inheritance:', err);
      setError(describeError(err, 'Failed to initiate inheritance', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const cancelInheritance = useCallback(async (
    vault: PublicKey
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);
      const [proofPDA] = findProofPDA(planPDA);

      const discriminator = getInstructionDiscriminator('cancel_inheritance');

      // Cancelling closes any death certificate proof so it can't re-trigger inheritance
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: planPDA, isSigner: false, isWritable: true },
          { pubkey: proofPDA, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: discriminator,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Inheritance cancelled:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to cancel inheritance:', err);
      setError(describeError(err, 'Failed to cancel inheritance', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const claimInheritance = useCallback(async (
    vault: PublicKey,
    beneficiaryWallet: PublicKey,
    vaultOwner: PublicKey
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError(translate(langRef.current, 'errors.walletNotConnected'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);
      const [beneficiaryPDA] = findBeneficiaryPDA(vault, beneficiaryWallet);
      const [treasuryPDA] = findVaultTreasuryPDA(vault);
      const [membershipPDA] = findMembershipPDA(vaultOwner);
      const [bsafeTreasuryPDA] = findBsafeTreasuryPDA();

      const discriminator = getInstructionDiscriminator('claim_inheritance');

      // Check if membership account exists
      const membershipInfo = await connection.getAccountInfo(membershipPDA);

      const keys = [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: planPDA, isSigner: false, isWritable: true },
        { pubkey: beneficiaryPDA, isSigner: false, isWritable: true },
        { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      ];

      // Optional account: Anchor expects the program ID in this slot when it's absent
      keys.push({
        pubkey: membershipInfo ? membershipPDA : PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      });

      // Add bsafe treasury and remaining accounts
      keys.push(
        { pubkey: bsafeTreasuryPDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      );

      const instruction = new TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data: discriminator,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Inheritance claimed:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to claim inheritance:', err);
      setError(describeError(err, 'Failed to claim inheritance', langRef.current));
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  // ==================== WITHDRAW ====================

  /** Direct withdrawal by the owner (only when multisig is off or threshold is 1). */
  const withdrawFromVault = useCallback(async (
    vault: PublicKey,
    amount: number,
    destination: PublicKey,
  ): Promise<string | null> => {
    if (!wallet.publicKey) return null;
    const [treasuryPDA] = findVaultTreasuryPDA(vault);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(Math.floor(amount * LAMPORTS_PER_SOL)));
    return sendIx('withdraw', amountBuffer, [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to withdraw');
  }, [sendIx, wallet.publicKey]);

  const removeBeneficiary = useCallback(async (vault: PublicKey, beneficiaryWallet: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [beneficiaryPDA] = findBeneficiaryPDA(vault, beneficiaryWallet);
    return sendIx('remove_beneficiary', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: beneficiaryPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to remove beneficiary');
  }, [sendIx, wallet.publicKey]);

  /** Re-arms a plan the owner cancelled during cooldown. */
  const resetInheritancePlan = useCallback(async (vault: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [planPDA] = findInheritancePlanPDA(vault);
    return sendIx('reset_inheritance_plan', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: planPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ], 'Failed to reset inheritance plan');
  }, [sendIx, wallet.publicKey]);

  // ==================== MULTISIG ====================

  const getSigners = useCallback(async (vault: PublicKey): Promise<MultisigSigner[]> => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [accountFilter('MultisigSigner'), { memcmp: { offset: 8, bytes: vault.toBase58() } }],
      });
      return accounts
        .map(({ pubkey, account }) => parseSigner(pubkey, account.data))
        .sort((a, b) => a.index - b.index);
    } catch (err) {
      console.error('Error fetching signers:', err);
      return [];
    }
  }, [connection]);

  const getMultisigTransactions = useCallback(async (vault: PublicKey): Promise<MultisigTransaction[]> => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [accountFilter('MultisigTransaction'), { memcmp: { offset: 8, bytes: vault.toBase58() } }],
      });
      return accounts
        .map(({ pubkey, account }) => parseMultisigTx(pubkey, account.data))
        .sort((a, b) => b.proposedAt - a.proposedAt);
    } catch (err) {
      console.error('Error fetching multisig transactions:', err);
      return [];
    }
  }, [connection]);

  /** Vaults where the connected wallet is an active co-signer (not necessarily the owner). */
  const getSignerVaults = useCallback(async (): Promise<Vault[]> => {
    if (!wallet.publicKey) return [];
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [accountFilter('MultisigSigner'), { memcmp: { offset: 40, bytes: wallet.publicKey.toBase58() } }],
      });
      const vaults: Vault[] = [];
      for (const { pubkey, account } of accounts) {
        const signer = parseSigner(pubkey, account.data);
        if (!signer.isActive) continue;
        const vault = await fetchVault(signer.vault);
        if (vault) vaults.push(vault);
      }
      return vaults;
    } catch (err) {
      console.error('Error fetching signer vaults:', err);
      return [];
    }
  }, [connection, wallet.publicKey, fetchVault]);

  const addSigner = useCallback(async (vault: PublicKey, newSigner: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [signerPDA] = findSignerPDA(vault, newSigner);
    return sendIx('add_signer', newSigner.toBuffer(), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: signerPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to add signer');
  }, [sendIx, wallet.publicKey]);

  const removeSigner = useCallback(async (vault: PublicKey, signer: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [signerPDA] = findSignerPDA(vault, signer);
    return sendIx('remove_signer', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: signerPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ], 'Failed to remove signer');
  }, [sendIx, wallet.publicKey]);

  const updateThreshold = useCallback(async (vault: PublicKey, threshold: number) => {
    if (!wallet.publicKey) return null;
    return sendIx('update_threshold', Buffer.from([threshold]), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ], 'Failed to update threshold');
  }, [sendIx, wallet.publicKey]);

  /** Proposes a withdrawal; the proposer's approval counts automatically. */
  const proposeWithdrawal = useCallback(async (
    vault: Vault,
    amount: number,
    destination: PublicKey,
  ): Promise<string | null> => {
    if (!wallet.publicKey) return null;
    const [signerPDA] = findSignerPDA(vault.address, wallet.publicKey);
    const [txPDA] = findMultisigTxPDA(vault.address, vault.trackedBalanceLamports + 1n);
    if (await connection.getAccountInfo(txPDA)) {
      setError(translate(langRef.current, 'errors.proposalExists'));
      return null;
    }
    const args = Buffer.alloc(1 + 8 + 32 + 32);
    args[0] = 0; // TransactionType::Withdrawal
    args.writeBigUInt64LE(BigInt(Math.floor(amount * LAMPORTS_PER_SOL)), 1);
    destination.toBuffer().copy(args, 9);
    return sendIx('propose_transaction', args, [
      { pubkey: vault.address, isSigner: false, isWritable: true },
      { pubkey: signerPDA, isSigner: false, isWritable: false },
      { pubkey: txPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to propose transaction');
  }, [connection, sendIx, wallet.publicKey]);

  const approveTransaction = useCallback(async (vault: PublicKey, tx: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [signerPDA] = findSignerPDA(vault, wallet.publicKey);
    return sendIx('approve_transaction', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: signerPDA, isSigner: false, isWritable: false },
      { pubkey: tx, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ], 'Failed to approve transaction');
  }, [sendIx, wallet.publicKey]);

  const rejectTransaction = useCallback(async (vault: PublicKey, tx: PublicKey) => {
    if (!wallet.publicKey) return null;
    return sendIx('reject_transaction', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: tx, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ], 'Failed to reject transaction');
  }, [sendIx, wallet.publicKey]);

  const executeTransaction = useCallback(async (vault: PublicKey, tx: MultisigTransaction) => {
    if (!wallet.publicKey) return null;
    const [treasuryPDA] = findVaultTreasuryPDA(vault);
    return sendIx('execute_transaction', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: tx.address, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: tx.destination, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to execute transaction');
  }, [sendIx, wallet.publicKey]);

  // ==================== VERIFIERS & DEATH CERTIFICATE ====================

  const getVerifiers = useCallback(async (vault: PublicKey): Promise<Verifier[]> => {
    try {
      const [planPDA] = findInheritancePlanPDA(vault);
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [accountFilter('Verifier'), { memcmp: { offset: 8, bytes: planPDA.toBase58() } }],
      });
      return accounts.map(({ pubkey, account }) => parseVerifier(pubkey, account.data));
    } catch (err) {
      console.error('Error fetching verifiers:', err);
      return [];
    }
  }, [connection]);

  const getProof = useCallback(async (vault: PublicKey): Promise<DeathCertificateProof | null> => {
    const [planPDA] = findInheritancePlanPDA(vault);
    const [proofPDA] = findProofPDA(planPDA);
    const info = await connection.getAccountInfo(proofPDA);
    return info ? parseProof(proofPDA, info.data) : null;
  }, [connection]);

  const addVerifier = useCallback(async (vault: PublicKey, verifier: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [planPDA] = findInheritancePlanPDA(vault);
    const [verifierPDA] = findVerifierPDA(planPDA, verifier);
    return sendIx('add_verifier', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: planPDA, isSigner: false, isWritable: false },
      { pubkey: verifierPDA, isSigner: false, isWritable: true },
      { pubkey: verifier, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to add verifier');
  }, [sendIx, wallet.publicKey]);

  /** Heir submits the SHA-256 hash of the death certificate (the document never leaves the browser). */
  const submitDeathCertificate = useCallback(async (vault: PublicKey, documentHash: Uint8Array) => {
    if (!wallet.publicKey) return null;
    const [planPDA] = findInheritancePlanPDA(vault);
    const [beneficiaryPDA] = findBeneficiaryPDA(vault, wallet.publicKey);
    const [proofPDA] = findProofPDA(planPDA);
    return sendIx('submit_death_certificate', Buffer.from(documentHash), [
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: planPDA, isSigner: false, isWritable: true },
      { pubkey: beneficiaryPDA, isSigner: false, isWritable: false },
      { pubkey: proofPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], 'Failed to submit death certificate');
  }, [sendIx, wallet.publicKey]);

  const verifyDeathCertificate = useCallback(async (vault: PublicKey) => {
    if (!wallet.publicKey) return null;
    const [planPDA] = findInheritancePlanPDA(vault);
    const [proofPDA] = findProofPDA(planPDA);
    const [verifierPDA] = findVerifierPDA(planPDA, wallet.publicKey);
    return sendIx('verify_death_certificate', Buffer.alloc(0), [
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: planPDA, isSigner: false, isWritable: true },
      { pubkey: proofPDA, isSigner: false, isWritable: true },
      { pubkey: verifierPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ], 'Failed to verify death certificate');
  }, [sendIx, wallet.publicKey]);

  // ==================== HEIR / VERIFIER VIEW ====================

  /** Vaults where the connected wallet is a beneficiary or a verifier. */
  const getMyInheritances = useCallback(async (): Promise<InheritanceView[]> => {
    if (!wallet.publicKey) return [];
    try {
      setLoading(true);
      setError(null);
      const me = wallet.publicKey.toBase58();
      const [beneficiaryAccounts, verifierAccounts] = await Promise.all([
        connection.getProgramAccounts(PROGRAM_ID, {
          filters: [accountFilter('Beneficiary'), { memcmp: { offset: 40, bytes: me } }],
        }),
        connection.getProgramAccounts(PROGRAM_ID, {
          filters: [accountFilter('Verifier'), { memcmp: { offset: 40, bytes: me } }],
        }),
      ]);

      const byVault = new Map<string, { beneficiary: Beneficiary | null; verifier: Verifier | null }>();
      for (const { pubkey, account } of beneficiaryAccounts) {
        const b = parseBeneficiary(pubkey, account.data);
        if (b.status === 'removed') continue;
        byVault.set(b.vault.toBase58(), { beneficiary: b, verifier: null });
      }
      for (const { pubkey, account } of verifierAccounts) {
        const v = parseVerifier(pubkey, account.data);
        const planInfo = await connection.getAccountInfo(v.inheritancePlan);
        if (!planInfo) continue;
        const vaultKey = new PublicKey(planInfo.data.slice(8, 40)).toBase58();
        const entry = byVault.get(vaultKey) ?? { beneficiary: null, verifier: null };
        entry.verifier = v;
        byVault.set(vaultKey, entry);
      }

      const views: InheritanceView[] = [];
      for (const [vaultKey, roles] of byVault) {
        const vault = await fetchVault(new PublicKey(vaultKey));
        if (!vault) continue;
        views.push({
          vault,
          plan: await getInheritancePlan(vault.address),
          proof: await getProof(vault.address),
          ...roles,
        });
      }
      return views;
    } catch (err) {
      console.error('Error fetching inheritances:', err);
      setError(describeError(err, 'Failed to fetch inheritances', langRef.current));
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, fetchVault, getInheritancePlan, getProof]);

  return {
    connection,
    wallet,
    loading,
    error,
    getVaults,
    getBalance,
    requestAirdrop,
    createVault,
    depositToVault,
    getBeneficiaries,
    addBeneficiary,
    updateBeneficiaryShares,
    getInheritancePlan,
    createInheritancePlan,
    initiateInheritance,
    cancelInheritance,
    claimInheritance,
    withdrawFromVault,
    removeBeneficiary,
    resetInheritancePlan,
    getSigners,
    getSignerVaults,
    getMultisigTransactions,
    addSigner,
    removeSigner,
    updateThreshold,
    proposeWithdrawal,
    approveTransaction,
    rejectTransaction,
    executeTransaction,
    getVerifiers,
    getProof,
    addVerifier,
    submitDeathCertificate,
    verifyDeathCertificate,
    getMyInheritances,
    programId: PROGRAM_ID,
  };
}
