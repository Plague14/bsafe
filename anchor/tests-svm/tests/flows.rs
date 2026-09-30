//! End-to-end flows against the compiled BSafe program.
//!
//! Run from anchor/tests-svm:  cargo test

use bsafe_svm_tests::*;
use solana_keypair::Keypair;
use solana_signer::Signer;

const SOL: u64 = LAMPORTS_PER_SOL;
const TX_FEE: u64 = 5_000;

struct Setup {
    env: Env,
    owner: Keypair,
    vault: Pubkey,
}

fn setup_vault(deposit_sol: u64) -> Setup {
    let mut env = Env::new();
    let owner = env.funded(20);
    let name = name32("Family Vault");
    let vault = vault_pda(&owner.pubkey(), &name);

    env.ok(&[create_vault(&owner.pubkey(), &name)], &[&owner]);
    if deposit_sol > 0 {
        env.ok(&[deposit(&vault, &owner.pubkey(), deposit_sol * SOL)], &[&owner]);
    }
    Setup { env, owner, vault }
}

#[test]
fn vault_deposit_and_withdraw() {
    let Setup { mut env, owner, vault } = setup_vault(2);
    let treasury = vault_treasury_pda(&vault);
    assert_eq!(env.balance(&treasury), 2 * SOL);
    assert_eq!(env.vault_balance(&vault), 2 * SOL);

    // Withdraw moves SOL out of the system-owned treasury PDA (regression: used to
    // debit lamports directly, which the runtime rejects).
    let dest = Keypair::new().pubkey();
    env.ok(&[withdraw(&vault, &owner.pubkey(), &dest, SOL / 2)], &[&owner]);
    assert_eq!(env.balance(&dest), SOL / 2);
    assert_eq!(env.balance(&treasury), 2 * SOL - SOL / 2);
    assert_eq!(env.vault_balance(&vault), 2 * SOL - SOL / 2);

    // Only the owner can withdraw
    let stranger = env.funded(1);
    env.fails_with(
        &[withdraw(&vault, &stranger.pubkey(), &dest, 1)],
        &[&stranger],
        "UnauthorizedOwner",
    );

    // Cannot withdraw more than the vault holds
    env.fails_with(
        &[withdraw(&vault, &owner.pubkey(), &dest, 5 * SOL)],
        &[&owner],
        "InsufficientFunds",
    );
}

#[test]
fn beneficiary_shares_must_not_exceed_100_percent() {
    let Setup { mut env, owner, vault } = setup_vault(1);
    let a = Keypair::new().pubkey();
    let b = Keypair::new().pubkey();

    env.ok(&[add_beneficiary(&vault, &owner.pubkey(), &a, 6_000)], &[&owner]);
    env.fails_with(
        &[add_beneficiary(&vault, &owner.pubkey(), &b, 5_000)],
        &[&owner],
        "InvalidShareSum",
    );

    // Plan requires exactly 100% allocated
    env.fails_with(
        &[create_inheritance_plan(&vault, &owner.pubkey(), TriggerType::DeadmanSwitch, DAY as u64, 30 * DAY as u64, 1)],
        &[&owner],
        "InvalidShareSum",
    );

    env.ok(&[add_beneficiary(&vault, &owner.pubkey(), &b, 4_000)], &[&owner]);
    assert_eq!(env.vault_total_share_bps(&vault), 10_000);
}

#[test]
fn deadman_switch_inheritance_full_flow() {
    let Setup { mut env, owner, vault } = setup_vault(3);
    let treasury = vault_treasury_pda(&vault);

    // Three heirs with shares that don't divide evenly (rounding dust must not block the last claim)
    let heirs: Vec<Keypair> = (0..3).map(|_| env.funded(1)).collect();
    let shares = [3_333u16, 3_333, 3_334];
    for (heir, share) in heirs.iter().zip(shares) {
        env.ok(&[add_beneficiary(&vault, &owner.pubkey(), &heir.pubkey(), share)], &[&owner]);
    }

    // Protocol fee treasury (one-time admin setup)
    let admin = env.funded(1);
    env.ok(&[initialize_treasury(&admin.pubkey())], &[&admin]);
    let fee_treasury = bsafe_treasury_pda();
    let fee_treasury_start = env.balance(&fee_treasury);

    env.ok(
        &[create_inheritance_plan(&vault, &owner.pubkey(), TriggerType::DeadmanSwitch, DAY as u64, 30 * DAY as u64, 1)],
        &[&owner],
    );
    assert_eq!(env.plan_status(&vault), InheritanceStatus::Configured as u8);

    // Owner still active: cannot trigger
    env.fails_with(
        &[initiate_inheritance(&vault, &heirs[0].pubkey(), false)],
        &[&heirs[0]],
        "OwnerStillActive",
    );

    // 31 days of inactivity -> anyone can trigger the deadman switch
    env.warp_forward(31 * DAY);
    env.ok(&[initiate_inheritance(&vault, &heirs[0].pubkey(), false)], &[&heirs[0]]);
    assert_eq!(env.plan_status(&vault), InheritanceStatus::CooldownActive as u8);
    assert_eq!(env.vault_status(&vault), VaultStatus::InheritanceInitiated as u8);

    // Vault is locked for the owner during inheritance
    let dest = Keypair::new().pubkey();
    env.fails_with(&[withdraw(&vault, &owner.pubkey(), &dest, 1)], &[&owner], "VaultNotActive");

    // Claims blocked until cooldown ends
    env.fails_with(&[claim_inheritance(&vault, &heirs[0].pubkey())], &[&heirs[0]], "CooldownNotComplete");

    env.warp_forward(DAY + 1);

    let distribution = 3 * SOL;
    let mut total_received = 0u64;
    for (heir, share) in heirs.iter().zip(shares) {
        let before = env.balance(&heir.pubkey());
        env.ok(&[claim_inheritance(&vault, &heir.pubkey())], &[heir]);
        // The heir pays the 5000-lamport signature fee for the claim transaction
        let received = env.balance(&heir.pubkey()) + TX_FEE - before;
        let gross = distribution * share as u64 / 10_000;
        // Free tier: 1% protocol fee (last heir also sweeps rounding dust)
        assert!(received >= gross - gross / 100, "heir received {received}, gross {gross}");
        total_received += received;
    }

    // Everything distributed, nothing stuck in the treasury
    assert_eq!(env.balance(&treasury), 0);
    let fees = env.balance(&fee_treasury) - fee_treasury_start;
    assert_eq!(total_received + fees, distribution);
    assert_eq!(env.plan_status(&vault), InheritanceStatus::Completed as u8);
    assert_eq!(env.vault_status(&vault), VaultStatus::InheritanceCompleted as u8);

    // Inheritance is completed: no further (double) claims
    env.fails_with(&[claim_inheritance(&vault, &heirs[0].pubkey())], &[&heirs[0]], "InheritanceNotTriggered");
}

#[test]
fn death_certificate_flow_and_owner_cancel() {
    let Setup { mut env, owner, vault } = setup_vault(2);
    let heir = env.funded(1);
    let verifier = env.funded(1);

    env.ok(&[add_beneficiary(&vault, &owner.pubkey(), &heir.pubkey(), 10_000)], &[&owner]);
    env.ok(
        &[create_inheritance_plan(&vault, &owner.pubkey(), TriggerType::DeathCertificate, 7 * DAY as u64, 90 * DAY as u64, 1)],
        &[&owner],
    );
    env.ok(&[add_verifier(&vault, &owner.pubkey(), &verifier.pubkey())], &[&owner]);

    // Outsiders cannot submit proofs
    let stranger = env.funded(1);
    env.fails_with(
        &[submit_death_certificate(&vault, &stranger.pubkey(), [7u8; 32])],
        &[&stranger],
        "AccountNotInitialized",
    );

    // Unverified proof cannot trigger inheritance
    env.ok(&[submit_death_certificate(&vault, &heir.pubkey(), [7u8; 32])], &[&heir]);
    assert_eq!(env.plan_status(&vault), InheritanceStatus::ProofSubmitted as u8);
    env.fails_with(&[initiate_inheritance(&vault, &heir.pubkey(), true)], &[&heir], "ProofNotVerified");

    // Only a registered verifier can verify
    env.fails_with(
        &[verify_death_certificate(&vault, &stranger.pubkey())],
        &[&stranger],
        "AccountNotInitialized",
    );
    env.ok(&[verify_death_certificate(&vault, &verifier.pubkey())], &[&verifier]);
    env.ok(&[initiate_inheritance(&vault, &heir.pubkey(), true)], &[&heir]);
    assert_eq!(env.plan_status(&vault), InheritanceStatus::CooldownActive as u8);

    // Owner is alive: cancels during cooldown and gets the vault back
    env.warp_forward(2 * DAY);
    env.ok(&[cancel_inheritance(&vault, &owner.pubkey())], &[&owner]);
    assert_eq!(env.plan_status(&vault), InheritanceStatus::Cancelled as u8);
    assert_eq!(env.vault_status(&vault), VaultStatus::Active as u8);

    let dest = Keypair::new().pubkey();
    env.ok(&[withdraw(&vault, &owner.pubkey(), &dest, SOL)], &[&owner]);
    assert_eq!(env.balance(&dest), SOL);

    // Heir cannot claim a cancelled inheritance
    env.warp_forward(30 * DAY);
    env.fails_with(&[claim_inheritance(&vault, &heir.pubkey())], &[&heir], "InheritanceNotTriggered");
}

#[test]
fn owner_cannot_cancel_after_cooldown() {
    let Setup { mut env, owner, vault } = setup_vault(1);
    let heir = env.funded(1);
    env.ok(&[add_beneficiary(&vault, &owner.pubkey(), &heir.pubkey(), 10_000)], &[&owner]);
    env.ok(
        &[create_inheritance_plan(&vault, &owner.pubkey(), TriggerType::DeadmanSwitch, DAY as u64, 30 * DAY as u64, 1)],
        &[&owner],
    );
    env.warp_forward(30 * DAY);
    env.ok(&[initiate_inheritance(&vault, &heir.pubkey(), false)], &[&heir]);
    env.warp_forward(DAY);
    env.fails_with(&[cancel_inheritance(&vault, &owner.pubkey())], &[&owner], "CooldownEnded");

    let admin = env.funded(1);
    env.ok(&[initialize_treasury(&admin.pubkey())], &[&admin]);
    env.ok(&[claim_inheritance(&vault, &heir.pubkey())], &[&heir]);
    assert_eq!(env.balance(&vault_treasury_pda(&vault)), 0);
}

#[test]
fn multisig_counts_only_real_signers() {
    let Setup { mut env, owner, vault } = setup_vault(1);
    let cosigner = env.funded(1);

    // Adding a single co-signer must not enable multisig: the owner has no signer
    // account, so a 2-of-2 requirement could never be met and funds would be stuck.
    env.ok(&[add_signer(&vault, &owner.pubkey(), &cosigner.pubkey())], &[&owner]);
    let dest = Keypair::new().pubkey();
    env.ok(&[withdraw(&vault, &owner.pubkey(), &dest, SOL / 10)], &[&owner]);

    // Threshold can never exceed the number of real signers
    env.fails_with(&[update_threshold(&vault, &owner.pubkey(), 2)], &[&owner], "InvalidThreshold");
}

#[test]
fn multisig_signer_index_not_reused_after_removal() {
    let Setup { mut env, owner, vault } = setup_vault(2);
    let a = env.funded(1);
    let b = env.funded(1);
    let c = env.funded(1);

    env.ok(&[add_signer(&vault, &owner.pubkey(), &a.pubkey())], &[&owner]);
    env.ok(&[add_signer(&vault, &owner.pubkey(), &b.pubkey())], &[&owner]);
    env.ok(&[remove_signer(&vault, &owner.pubkey(), &a.pubkey())], &[&owner]);
    env.ok(&[add_signer(&vault, &owner.pubkey(), &c.pubkey())], &[&owner]);

    // B proposes (auto-approves); C must be able to add the second, distinct approval
    let dest = Keypair::new().pubkey();
    let balance = env.vault_balance(&vault);
    let tx = multisig_tx_pda(&vault, balance);
    env.ok(&[propose_withdrawal(&vault, &b.pubkey(), balance, SOL, &dest)], &[&b]);
    env.ok(&[approve_transaction(&vault, &c.pubkey(), &tx)], &[&c]);
    env.ok(&[execute_transaction(&vault, &b.pubkey(), &tx, &dest)], &[&b]);
    assert_eq!(env.balance(&dest), SOL);
}

#[test]
fn multisig_withdrawal_requires_threshold() {
    let Setup { mut env, owner, vault } = setup_vault(2);
    let cosigner = env.funded(1);

    env.ok(&[add_signer(&vault, &owner.pubkey(), &owner.pubkey())], &[&owner]);
    env.ok(&[add_signer(&vault, &owner.pubkey(), &cosigner.pubkey())], &[&owner]);

    // With 2 signers the threshold becomes 2: direct withdrawals are blocked
    let dest = Keypair::new().pubkey();
    env.fails_with(&[withdraw(&vault, &owner.pubkey(), &dest, SOL)], &[&owner], "ThresholdNotReached");

    let balance = env.vault_balance(&vault);
    let tx = multisig_tx_pda(&vault, balance);
    env.ok(&[propose_withdrawal(&vault, &owner.pubkey(), balance, SOL, &dest)], &[&owner]);

    // Only one approval so far: cannot execute
    env.fails_with(
        &[execute_transaction(&vault, &owner.pubkey(), &tx, &dest)],
        &[&owner],
        "ThresholdNotReached",
    );

    env.ok(&[approve_transaction(&vault, &cosigner.pubkey(), &tx)], &[&cosigner]);
    env.ok(&[execute_transaction(&vault, &owner.pubkey(), &tx, &dest)], &[&owner]);
    assert_eq!(env.balance(&dest), SOL);
    assert_eq!(env.vault_balance(&vault), SOL);

    // Cannot execute twice
    env.fails_with(
        &[execute_transaction(&vault, &owner.pubkey(), &tx, &dest)],
        &[&owner],
        "ThresholdNotReached",
    );
}
