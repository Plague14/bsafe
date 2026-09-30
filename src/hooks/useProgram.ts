import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { useCallback, useState } from 'react';
import { PROGRAM_ID } from '../lib/constants';
import { findVaultPDA, findVaultTreasuryPDA, findBeneficiaryPDA, findInheritancePlanPDA, findProofPDA, findMembershipPDA, findBsafeTreasuryPDA, nameToBytes32 } from '../lib/pda';
import { sha256 } from '@noble/hashes/sha256';

export interface Vault {
  address: PublicKey;
  treasury: PublicKey;
  owner: PublicKey;
  balance: number;
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

// Generate Anchor instruction discriminator
function getInstructionDiscriminator(instructionName: string): Buffer {
  const hash = sha256(`global:${instructionName}`);
  return Buffer.from(hash.slice(0, 8));
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const data = account.data;

        // Parse vault data according to Anchor serialization
        const owner = new PublicKey(data.slice(8, 40));
        const nameBytes = data.slice(40, 72);
        const name = new TextDecoder().decode(nameBytes).replace(/\0+$/, '');
        const status = data[72];
        const beneficiaryCount = data[81];
        const multisigEnabled = data[82] === 1;
        const multisigThreshold = data[83];
        const signerCount = data[84];
        const lastActivity = Number(data.readBigInt64LE(85));
        const createdAt = Number(data.readBigInt64LE(93));

        // Get treasury PDA and balance
        const [treasury] = findVaultTreasuryPDA(pubkey);
        let treasuryBalance = 0;
        try {
          treasuryBalance = await connection.getBalance(treasury);
        } catch {
          // Treasury might not exist yet
        }

        vaults.push({
          address: pubkey,
          treasury,
          owner,
          balance: treasuryBalance / LAMPORTS_PER_SOL,
          name,
          status: status === 0 ? 'active' : status === 1 ? 'locked' : 'inheritance',
          signerCount,
          multisigEnabled,
          multisigThreshold,
          beneficiaryCount,
          lastActivity: lastActivity * 1000,
          createdAt: createdAt * 1000,
        });
      }

      return vaults;
    } catch (err) {
      console.error('Error fetching vaults:', err);
      setError('Failed to fetch vaults');
      return [];
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  const createVault = useCallback(async (name: string): Promise<PublicKey | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to create vault');
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const depositToVault = useCallback(async (vault: PublicKey, amount: number): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to deposit');
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
      setError('Airdrop failed - try the web faucet');
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

      return accounts.map(({ pubkey, account }) => {
        const data = account.data;

        const vaultKey = new PublicKey(data.slice(8, 40));
        const walletKey = new PublicKey(data.slice(40, 72));
        const shareBps = data.readUInt16LE(72);
        const status = data[74];
        const index = data[75];
        const claimedAmount = Number(data.readBigUInt64LE(76));
        const addedAt = Number(data.readBigInt64LE(84));

        return {
          address: pubkey,
          vault: vaultKey,
          wallet: walletKey,
          shareBps,
          sharePercent: shareBps / 100,
          status: status === 0 ? 'active' : status === 1 ? 'removed' : 'claimed',
          index,
          claimedAmount: claimedAmount / LAMPORTS_PER_SOL,
          addedAt: addedAt * 1000,
        };
      });
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
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to add beneficiary');
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
    cooldownDays: number,
    deadmanSwitchDays: number,
    requiredVerifications: number
  ): Promise<PublicKey | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);

      // Convert to seconds
      const cooldownSeconds = cooldownDays * 24 * 60 * 60;
      const deadmanSwitchSeconds = deadmanSwitchDays * 24 * 60 * 60;

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
      setError(err instanceof Error ? err.message : 'Failed to create inheritance plan');
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
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to update shares');
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const initiateInheritance = useCallback(async (
    vault: PublicKey
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to initiate inheritance');
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const cancelInheritance = useCallback(async (
    vault: PublicKey
  ): Promise<string | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const [planPDA] = findInheritancePlanPDA(vault);

      const discriminator = getInstructionDiscriminator('cancel_inheritance');

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: planPDA, isSigner: false, isWritable: true },
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

      console.log('Inheritance cancelled:', signature);
      return signature;
    } catch (err) {
      console.error('Failed to cancel inheritance:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel inheritance');
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
      setError('Wallet not connected');
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
      setError(err instanceof Error ? err.message : 'Failed to claim inheritance');
      return null;
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

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
    programId: PROGRAM_ID,
  };
}
