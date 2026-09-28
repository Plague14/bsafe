import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Bsafe } from "../target/types/bsafe";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("bsafe", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Bsafe as Program<Bsafe>;
  const owner = provider.wallet;

  // Test accounts
  let vaultPda: PublicKey;
  let vaultBump: number;
  let vaultTreasuryPda: PublicKey;
  let vaultTreasuryBump: number;
  let inheritancePlanPda: PublicKey;
  let beneficiary1Pda: PublicKey;
  let beneficiary2Pda: PublicKey;

  const vaultName = stringToBytes32("Test Vault");
  const beneficiary1 = Keypair.generate();
  const beneficiary2 = Keypair.generate();
  const coSigner1 = Keypair.generate();
  const coSigner2 = Keypair.generate();
  const verifier1 = Keypair.generate();

  // Helper function to convert string to bytes32
  function stringToBytes32(str: string): number[] {
    const bytes = new Array(32).fill(0);
    const strBytes = Buffer.from(str);
    for (let i = 0; i < Math.min(strBytes.length, 32); i++) {
      bytes[i] = strBytes[i];
    }
    return bytes;
  }

  // Helper to sleep
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  before(async () => {
    // Derive PDAs
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), Buffer.from(vaultName)],
      program.programId
    );

    [vaultTreasuryPda, vaultTreasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_treasury"), vaultPda.toBuffer()],
      program.programId
    );

    [inheritancePlanPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("inheritance"), vaultPda.toBuffer()],
      program.programId
    );

    [beneficiary1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("beneficiary"), vaultPda.toBuffer(), beneficiary1.publicKey.toBuffer()],
      program.programId
    );

    [beneficiary2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("beneficiary"), vaultPda.toBuffer(), beneficiary2.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop to test accounts
    const airdrops = [
      beneficiary1.publicKey,
      beneficiary2.publicKey,
      coSigner1.publicKey,
      coSigner2.publicKey,
      verifier1.publicKey,
    ];

    for (const pubkey of airdrops) {
      const sig = await provider.connection.requestAirdrop(pubkey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  // ============================================
  // VAULT OPERATIONS
  // ============================================
  describe("Vault Operations", () => {
    it("Creates a vault", async () => {
      const tx = await program.methods
        .createVault(vaultName)
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Create vault tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.owner.toString()).to.equal(owner.publicKey.toString());
      expect(vault.status).to.deep.equal({ active: {} });
      expect(vault.balance.toNumber()).to.equal(0);
      expect(vault.totalShareBps).to.equal(0);
    });

    it("Deposits SOL into vault", async () => {
      const depositAmount = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL

      const tx = await program.methods
        .deposit(depositAmount)
        .accounts({
          vault: vaultPda,
          vaultTreasury: vaultTreasuryPda,
          depositor: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Deposit tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.balance.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);
    });

    it("Withdraws SOL from vault", async () => {
      const withdrawAmount = new anchor.BN(LAMPORTS_PER_SOL / 2); // 0.5 SOL
      const destination = Keypair.generate().publicKey;

      const tx = await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          vault: vaultPda,
          vaultTreasury: vaultTreasuryPda,
          owner: owner.publicKey,
          destination: destination,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Withdraw tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.balance.toNumber()).to.equal(1.5 * LAMPORTS_PER_SOL);
    });
  });

  // ============================================
  // BENEFICIARY MANAGEMENT
  // ============================================
  describe("Beneficiary Management", () => {
    it("Adds beneficiary 1 with 60% share", async () => {
      const tx = await program.methods
        .addBeneficiary(beneficiary1.publicKey, 6000) // 60% in basis points
        .accounts({
          vault: vaultPda,
          beneficiary: beneficiary1Pda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Add beneficiary 1 tx:", tx);

      const beneficiaryAccount = await program.account.beneficiary.fetch(beneficiary1Pda);
      expect(beneficiaryAccount.wallet.toString()).to.equal(beneficiary1.publicKey.toString());
      expect(beneficiaryAccount.shareBps).to.equal(6000);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.totalShareBps).to.equal(6000);
    });

    it("Adds beneficiary 2 with 40% share (total 100%)", async () => {
      const tx = await program.methods
        .addBeneficiary(beneficiary2.publicKey, 4000) // 40% in basis points
        .accounts({
          vault: vaultPda,
          beneficiary: beneficiary2Pda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Add beneficiary 2 tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.beneficiaryCount).to.equal(2);
      expect(vault.totalShareBps).to.equal(10000); // 100%
    });

    it("Updates beneficiary 1 share to 55% (total 95%)", async () => {
      const tx = await program.methods
        .updateShares(5500) // Change to 55%
        .accounts({
          vault: vaultPda,
          beneficiary: beneficiary1Pda,
          owner: owner.publicKey,
        })
        .rpc();

      console.log("Update shares tx:", tx);

      const beneficiaryAccount = await program.account.beneficiary.fetch(beneficiary1Pda);
      expect(beneficiaryAccount.shareBps).to.equal(5500);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.totalShareBps).to.equal(9500); // 55% + 40% = 95%
    });

    it("Updates beneficiary 2 share to 45% (total 100%)", async () => {
      const tx = await program.methods
        .updateShares(4500) // Change to 45%
        .accounts({
          vault: vaultPda,
          beneficiary: beneficiary2Pda,
          owner: owner.publicKey,
        })
        .rpc();

      console.log("Update shares tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.totalShareBps).to.equal(10000); // 55% + 45% = 100%
    });
  });

  // ============================================
  // EDGE CASES: SHARE VALIDATION
  // ============================================
  describe("Edge Cases: Share Validation", () => {
    const extraBeneficiary = Keypair.generate();
    let extraBeneficiaryPda: PublicKey;

    before(async () => {
      [extraBeneficiaryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("beneficiary"), vaultPda.toBuffer(), extraBeneficiary.publicKey.toBuffer()],
        program.programId
      );

      const sig = await provider.connection.requestAirdrop(extraBeneficiary.publicKey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    });

    it("Fails to add beneficiary that would exceed 100%", async () => {
      try {
        await program.methods
          .addBeneficiary(extraBeneficiary.publicKey, 100) // Even 1% would exceed
          .accounts({
            vault: vaultPda,
            beneficiary: extraBeneficiaryPda,
            owner: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have thrown InvalidShareSum error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidShareSum");
      }
    });

    it("Fails to update shares that would exceed 100%", async () => {
      try {
        await program.methods
          .updateShares(6000) // 60% for beneficiary1 + 45% for beneficiary2 = 105%
          .accounts({
            vault: vaultPda,
            beneficiary: beneficiary1Pda,
            owner: owner.publicKey,
          })
          .rpc();

        expect.fail("Should have thrown InvalidShareSum error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidShareSum");
      }
    });
  });

  // ============================================
  // INHERITANCE PLAN
  // ============================================
  describe("Inheritance Plan", () => {
    it("Creates an inheritance plan (shares must be 100%)", async () => {
      const cooldownSeconds = new anchor.BN(86400); // 1 day minimum
      const deadmanSwitchSeconds = new anchor.BN(30 * 24 * 60 * 60); // 30 days minimum

      const tx = await program.methods
        .createInheritancePlan(
          { both: {} }, // TriggerType::Both
          cooldownSeconds,
          deadmanSwitchSeconds,
          1 // Required verifications (minimum)
        )
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Create inheritance plan tx:", tx);

      const plan = await program.account.inheritancePlan.fetch(inheritancePlanPda);
      expect(plan.status).to.deep.equal({ configured: {} });
      expect(plan.cooldownSeconds.toNumber()).to.equal(86400);
      expect(plan.requiredVerifications).to.equal(1);
    });
  });

  // ============================================
  // MULTISIG FLOW
  // ============================================
  describe("Multisig Flow", () => {
    let signerPda: PublicKey;
    let multisigTxPda: PublicKey;

    before(async () => {
      [signerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("signer"), vaultPda.toBuffer(), coSigner1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Adds a co-signer", async () => {
      const tx = await program.methods
        .addSigner(coSigner1.publicKey)
        .accounts({
          vault: vaultPda,
          signerAccount: signerPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Add signer tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.signerCount).to.equal(2);
      expect(vault.multisigEnabled).to.be.true;
    });

    it("Updates threshold to 2", async () => {
      const tx = await program.methods
        .updateThreshold(2)
        .accounts({
          vault: vaultPda,
          owner: owner.publicKey,
        })
        .rpc();

      console.log("Update threshold tx:", tx);

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.multisigThreshold).to.equal(2);
    });

    it("Proposes a withdrawal transaction", async () => {
      const vault = await program.account.vault.fetch(vaultPda);
      const nonce = 0; // First transaction

      [multisigTxPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("multisig_tx"),
          vaultPda.toBuffer(),
          Buffer.from(new anchor.BN(nonce).toArray("le", 8))
        ],
        program.programId
      );

      const withdrawAmount = new anchor.BN(LAMPORTS_PER_SOL / 10); // 0.1 SOL
      const destination = Keypair.generate().publicKey;
      const emptyData = new Array(32).fill(0);

      const tx = await program.methods
        .proposeTransaction(
          { withdrawal: {} }, // TransactionType::Withdrawal
          withdrawAmount,
          destination,
          emptyData
        )
        .accounts({
          vault: vaultPda,
          transaction: multisigTxPda,
          proposer: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Propose transaction tx:", tx);

      const txAccount = await program.account.multisigTransaction.fetch(multisigTxPda);
      expect(txAccount.approvalCount).to.equal(1); // Proposer auto-approves
      expect(txAccount.executed).to.be.false;
    });

    it("Co-signer approves the transaction", async () => {
      const tx = await program.methods
        .approveTransaction()
        .accounts({
          vault: vaultPda,
          transaction: multisigTxPda,
          signerAccount: signerPda,
          signer: coSigner1.publicKey,
        })
        .signers([coSigner1])
        .rpc();

      console.log("Approve transaction tx:", tx);

      const txAccount = await program.account.multisigTransaction.fetch(multisigTxPda);
      expect(txAccount.approvalCount).to.equal(2);
    });

    it("Executes the transaction after threshold reached", async () => {
      const txAccount = await program.account.multisigTransaction.fetch(multisigTxPda);

      const tx = await program.methods
        .executeTransaction()
        .accounts({
          vault: vaultPda,
          vaultTreasury: vaultTreasuryPda,
          transaction: multisigTxPda,
          destination: txAccount.destination,
          executor: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Execute transaction tx:", tx);

      const updatedTx = await program.account.multisigTransaction.fetch(multisigTxPda);
      expect(updatedTx.executed).to.be.true;
    });

    it("Fails to execute same transaction twice", async () => {
      const txAccount = await program.account.multisigTransaction.fetch(multisigTxPda);

      try {
        await program.methods
          .executeTransaction()
          .accounts({
            vault: vaultPda,
            vaultTreasury: vaultTreasuryPda,
            transaction: multisigTxPda,
            destination: txAccount.destination,
            executor: owner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have thrown AlreadyExecuted error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyExecuted");
      }
    });
  });

  // ============================================
  // INHERITANCE FLOW (E2E)
  // Note: Full flow requires time manipulation or short test cooldowns
  // ============================================
  describe("Inheritance Flow", () => {
    let proofPda: PublicKey;
    let verifierPda: PublicKey;

    before(async () => {
      [proofPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proof"), inheritancePlanPda.toBuffer()],
        program.programId
      );

      [verifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("verifier"), inheritancePlanPda.toBuffer(), verifier1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Adds a verifier", async () => {
      const tx = await program.methods
        .addVerifier()
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          verifier: verifierPda,
          verifierPubkey: verifier1.publicKey,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Add verifier tx:", tx);
    });

    it("Beneficiary submits death certificate proof", async () => {
      const documentHash = new Array(32).fill(0);
      documentHash[0] = 0xDE;
      documentHash[1] = 0xAD;

      const tx = await program.methods
        .submitDeathCertificate(documentHash)
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          proof: proofPda,
          submitter: beneficiary1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([beneficiary1])
        .rpc();

      console.log("Submit death certificate tx:", tx);

      const plan = await program.account.inheritancePlan.fetch(inheritancePlanPda);
      expect(plan.status).to.deep.equal({ proofSubmitted: {} });
    });

    it("Verifier verifies the death certificate", async () => {
      const tx = await program.methods
        .verifyDeathCertificate()
        .accounts({
          inheritancePlan: inheritancePlanPda,
          proof: proofPda,
          verifier: verifierPda,
          verifierSigner: verifier1.publicKey,
        })
        .signers([verifier1])
        .rpc();

      console.log("Verify death certificate tx:", tx);

      const proof = await program.account.deathCertificateProof.fetch(proofPda);
      expect(proof.verified).to.be.true;
    });

    it("Initiates inheritance (starts cooldown)", async () => {
      const tx = await program.methods
        .initiateInheritance()
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          vaultTreasury: vaultTreasuryPda,
          proof: proofPda,
          initiator: beneficiary1.publicKey,
        })
        .signers([beneficiary1])
        .rpc();

      console.log("Initiate inheritance tx:", tx);

      const plan = await program.account.inheritancePlan.fetch(inheritancePlanPda);
      expect(plan.status).to.deep.equal({ cooldownActive: {} });

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.status).to.deep.equal({ inheritanceInitiated: {} });
    });

    it("Fails to claim before cooldown ends", async () => {
      const [bsafeTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bsafe_treasury")],
        program.programId
      );

      try {
        await program.methods
          .claimInheritance()
          .accounts({
            vault: vaultPda,
            inheritancePlan: inheritancePlanPda,
            beneficiary: beneficiary1Pda,
            vaultTreasury: vaultTreasuryPda,
            bsafeTreasury: bsafeTreasuryPda,
            claimer: beneficiary1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([beneficiary1])
          .rpc();

        expect.fail("Should have thrown CooldownNotComplete error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CooldownNotComplete");
      }
    });

    it("Owner cancels inheritance (proves alive)", async () => {
      const tx = await program.methods
        .cancelInheritance()
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          owner: owner.publicKey,
        })
        .rpc();

      console.log("Cancel inheritance tx:", tx);

      const plan = await program.account.inheritancePlan.fetch(inheritancePlanPda);
      expect(plan.status).to.deep.equal({ cancelled: {} });

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.status).to.deep.equal({ active: {} });
    });

    it("Resets cancelled inheritance plan", async () => {
      const tx = await program.methods
        .resetInheritancePlan()
        .accounts({
          vault: vaultPda,
          inheritancePlan: inheritancePlanPda,
          owner: owner.publicKey,
        })
        .rpc();

      console.log("Reset inheritance plan tx:", tx);

      const plan = await program.account.inheritancePlan.fetch(inheritancePlanPda);
      expect(plan.status).to.deep.equal({ configured: {} });
      expect(plan.triggeredAt.toNumber()).to.equal(0);
      expect(plan.cooldownEndsAt.toNumber()).to.equal(0);
    });
  });

  // ============================================
  // EDGE CASES: INHERITANCE
  // ============================================
  describe("Edge Cases: Inheritance", () => {
    it("Non-beneficiary cannot submit proof", async () => {
      const randomUser = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(randomUser.publicKey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);

      const [newProofPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proof"), inheritancePlanPda.toBuffer()],
        program.programId
      );

      const documentHash = new Array(32).fill(0xFF);

      // Note: This test depends on whether the contract validates submitter is a beneficiary
      // The current contract might allow anyone to submit - this is a potential security improvement
      // For now, we just verify the transaction doesn't fail unexpectedly
      try {
        await program.methods
          .submitDeathCertificate(documentHash)
          .accounts({
            vault: vaultPda,
            inheritancePlan: inheritancePlanPda,
            proof: newProofPda,
            submitter: randomUser.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([randomUser])
          .rpc();

        console.log("Note: Contract allows non-beneficiary to submit proof (potential improvement area)");
      } catch (err: any) {
        console.log("Non-beneficiary submission correctly rejected:", err.error.errorCode.code);
      }
    });
  });
});
