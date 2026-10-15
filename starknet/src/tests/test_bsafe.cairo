use starknet::ContractAddress;
use starknet::syscalls::deploy_syscall;
use starknet::testing::{set_block_timestamp, set_contract_address};
use crate::bsafe::{BSafe, IBSafeDispatcher, IBSafeDispatcherTrait};
use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use crate::types::{
    BeneficiaryStatus, InheritanceStatus, MembershipTier, TransactionStatus, TransactionType,
    TriggerType, VaultStatus,
};
use super::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20};

const DAY: u64 = 24 * 60 * 60;
const T0: u64 = 1_000_000;
const ONE: u256 = 1_000_000_000_000_000_000; // 1 token, 18 decimals

fn addr(name: felt252) -> ContractAddress {
    name.try_into().unwrap()
}

fn admin() -> ContractAddress {
    addr('admin')
}
fn treasury() -> ContractAddress {
    addr('treasury')
}
fn owner() -> ContractAddress {
    addr('owner')
}
fn heir1() -> ContractAddress {
    addr('heir1')
}
fn heir2() -> ContractAddress {
    addr('heir2')
}
fn verifier1() -> ContractAddress {
    addr('verifier1')
}
fn verifier2() -> ContractAddress {
    addr('verifier2')
}
fn cosigner() -> ContractAddress {
    addr('cosigner')
}
fn stranger() -> ContractAddress {
    addr('stranger')
}

#[derive(Drop, Copy)]
struct Env {
    bsafe: IBSafeDispatcher,
    token: IERC20Dispatcher,
    mock: IMockERC20Dispatcher,
}

fn setup_with(demo_mode: bool) -> Env {
    set_block_timestamp(T0);
    let (token_addr, _) = deploy_syscall(
        MockERC20::TEST_CLASS_HASH.try_into().unwrap(), 0, array![].span(), false,
    )
        .unwrap();
    let mut calldata: Array<felt252> = array![];
    calldata.append(admin().into());
    calldata.append(treasury().into());
    calldata.append(token_addr.into());
    // premium = 50 tokens, concierge = 1000 tokens (u256 = low, high)
    calldata.append(50 * 1_000_000_000_000_000_000);
    calldata.append(0);
    calldata.append(1000 * 1_000_000_000_000_000_000);
    calldata.append(0);
    calldata.append(if demo_mode {
        1
    } else {
        0
    });
    let (bsafe_addr, _) = deploy_syscall(
        BSafe::TEST_CLASS_HASH.try_into().unwrap(), 0, calldata.span(), false,
    )
        .unwrap();

    let env = Env {
        bsafe: IBSafeDispatcher { contract_address: bsafe_addr },
        token: IERC20Dispatcher { contract_address: token_addr },
        mock: IMockERC20Dispatcher { contract_address: token_addr },
    };
    env.mock.mint(owner(), 10_000 * ONE);
    set_contract_address(owner());
    env.mock.approve(bsafe_addr, 10_000 * ONE);
    env
}

fn setup() -> Env {
    setup_with(false)
}

/// Vault with 100 tokens and two heirs at 60/40
fn funded_vault(env: Env) -> u64 {
    set_contract_address(owner());
    let id = env.bsafe.create_vault('Family', env.token.contract_address);
    env.bsafe.deposit(id, 100 * ONE);
    env.bsafe.add_beneficiary(id, heir1(), 6000);
    env.bsafe.add_beneficiary(id, heir2(), 4000);
    id
}

// ==================== VAULT ====================

#[test]
fn test_create_deposit_withdraw() {
    let env = setup();
    set_contract_address(owner());
    let id = env.bsafe.create_vault('Savings', env.token.contract_address);
    assert_eq!(id, 1);
    env.bsafe.deposit(id, 10 * ONE);
    assert_eq!(env.bsafe.get_vault(id).balance, 10 * ONE);
    assert_eq!(env.token.balance_of(env.bsafe.contract_address), 10 * ONE);

    env.bsafe.withdraw(id, 4 * ONE, stranger());
    assert_eq!(env.bsafe.get_vault(id).balance, 6 * ONE);
    assert_eq!(env.token.balance_of(stranger()), 4 * ONE);
    assert_eq!(env.bsafe.get_owner_vaults(owner()), array![1]);
}

#[test]
#[should_panic(expected: ('Caller is not the owner', 'ENTRYPOINT_FAILED'))]
fn test_withdraw_not_owner() {
    let env = setup();
    let id = funded_vault(env);
    set_contract_address(stranger());
    env.bsafe.withdraw(id, ONE, stranger());
}

#[test]
#[should_panic(expected: ('Insufficient funds', 'ENTRYPOINT_FAILED'))]
fn test_withdraw_more_than_balance() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.withdraw(id, 101 * ONE, owner());
}

// ==================== BENEFICIARIES ====================

#[test]
#[should_panic(expected: ('Shares must not exceed 100%', 'ENTRYPOINT_FAILED'))]
fn test_shares_over_100() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.add_beneficiary(id, stranger(), 1);
}

#[test]
fn test_remove_and_readd_beneficiary() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.remove_beneficiary(id, heir2());
    let v = env.bsafe.get_vault(id);
    assert_eq!(v.beneficiary_count, 1);
    assert_eq!(v.total_share_bps, 6000);
    env.bsafe.update_shares(id, heir1(), 7000);
    env.bsafe.add_beneficiary(id, heir2(), 3000);
    let v = env.bsafe.get_vault(id);
    assert_eq!(v.total_share_bps, 10000);
    // heir2 is listed once even after being re-added
    assert_eq!(v.beneficiary_list_len, 2);
    assert_eq!(env.bsafe.get_heir_vaults(heir2()), array![id]);
}

#[test]
#[should_panic(expected: ('Shares must sum to 100%', 'ENTRYPOINT_FAILED'))]
fn test_plan_requires_full_allocation() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.remove_beneficiary(id, heir2());
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
}

// ==================== DEADMAN SWITCH ====================

#[test]
fn test_deadman_full_flow_with_fee() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, 7 * DAY, 30 * DAY, 0);

    // Owner goes silent for 30 days; anyone may trigger
    set_block_timestamp(T0 + 30 * DAY);
    set_contract_address(stranger());
    env.bsafe.initiate_inheritance(id);
    let plan = env.bsafe.get_plan(id);
    assert_eq!(plan.status, InheritanceStatus::CooldownActive);
    assert_eq!(plan.distribution_amount, 100 * ONE);
    assert_eq!(env.bsafe.get_vault(id).status, VaultStatus::InheritanceInitiated);

    set_block_timestamp(T0 + 37 * DAY);
    set_contract_address(heir1());
    env.bsafe.claim_inheritance(id);
    // 60 tokens gross, 1% fee (Free tier)
    assert_eq!(env.token.balance_of(heir1()), 594 * ONE / 10);
    assert_eq!(env.token.balance_of(treasury()), 6 * ONE / 10);
    assert_eq!(env.bsafe.get_beneficiary(id, heir1()).status, BeneficiaryStatus::Claimed);

    set_contract_address(heir2());
    env.bsafe.claim_inheritance(id);
    assert_eq!(env.token.balance_of(heir2()), 396 * ONE / 10);
    assert_eq!(env.token.balance_of(env.bsafe.contract_address), 0);
    assert_eq!(env.bsafe.get_plan(id).status, InheritanceStatus::Completed);
    assert_eq!(env.bsafe.get_vault(id).status, VaultStatus::InheritanceCompleted);
}

#[test]
#[should_panic(expected: ('Owner still active', 'ENTRYPOINT_FAILED'))]
fn test_deadman_too_early() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 30 * DAY - 1);
    env.bsafe.initiate_inheritance(id);
}

#[test]
#[should_panic(expected: ('Owner still active', 'ENTRYPOINT_FAILED'))]
fn test_heartbeat_resets_deadman() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 20 * DAY);
    env.bsafe.heartbeat(id);
    set_block_timestamp(T0 + 31 * DAY);
    env.bsafe.initiate_inheritance(id);
}

#[test]
#[should_panic(expected: ('Cooldown not complete', 'ENTRYPOINT_FAILED'))]
fn test_claim_during_cooldown() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, 7 * DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 30 * DAY);
    env.bsafe.initiate_inheritance(id);
    set_contract_address(heir1());
    env.bsafe.claim_inheritance(id);
}

#[test]
#[should_panic(expected: ('Already claimed', 'ENTRYPOINT_FAILED'))]
fn test_double_claim() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 30 * DAY);
    env.bsafe.initiate_inheritance(id);
    set_block_timestamp(T0 + 31 * DAY);
    set_contract_address(heir1());
    env.bsafe.claim_inheritance(id);
    env.bsafe.claim_inheritance(id);
}

#[test]
#[should_panic(expected: ('Caller is not a beneficiary', 'ENTRYPOINT_FAILED'))]
fn test_stranger_cannot_claim() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 30 * DAY);
    env.bsafe.initiate_inheritance(id);
    set_block_timestamp(T0 + 31 * DAY);
    set_contract_address(stranger());
    env.bsafe.claim_inheritance(id);
}

#[test]
#[should_panic(expected: ('Invalid cooldown period', 'ENTRYPOINT_FAILED'))]
fn test_production_rejects_short_timers() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, 60, 30 * DAY, 0);
}

#[test]
fn test_demo_mode_allows_short_timers() {
    let env = setup_with(true);
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, 60, 120, 0);
    set_block_timestamp(T0 + 120);
    env.bsafe.initiate_inheritance(id);
    set_block_timestamp(T0 + 180);
    set_contract_address(heir1());
    env.bsafe.claim_inheritance(id);
    assert_eq!(env.token.balance_of(heir1()), 594 * ONE / 10);
}

// ==================== DEATH CERTIFICATE ====================

fn certificate_plan(env: Env) -> u64 {
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::DeathCertificate, 7 * DAY, 365 * DAY, 2);
    env.bsafe.add_verifier(id, verifier1());
    env.bsafe.add_verifier(id, verifier2());
    id
}

#[test]
fn test_certificate_cancel_and_reverify() {
    let env = setup();
    let id = certificate_plan(env);

    set_contract_address(heir1());
    env.bsafe.submit_death_certificate(id, 'doc-hash-1');
    set_contract_address(verifier1());
    env.bsafe.verify_death_certificate(id);
    assert!(!env.bsafe.get_proof(id).verified);
    set_contract_address(verifier2());
    env.bsafe.verify_death_certificate(id);
    assert!(env.bsafe.get_proof(id).verified);

    set_contract_address(heir2());
    env.bsafe.initiate_inheritance(id);
    assert_eq!(env.bsafe.get_plan(id).status, InheritanceStatus::CooldownActive);

    // The owner is alive: cancel during the cooldown
    set_block_timestamp(T0 + DAY);
    set_contract_address(owner());
    env.bsafe.cancel_inheritance(id);
    assert_eq!(env.bsafe.get_plan(id).status, InheritanceStatus::Cancelled);
    assert_eq!(env.bsafe.get_vault(id).status, VaultStatus::Active);
    assert!(!env.bsafe.get_proof(id).verified);

    // After a reset, a new certificate can be verified by the same verifiers
    env.bsafe.reset_inheritance_plan(id);
    set_contract_address(heir1());
    env.bsafe.submit_death_certificate(id, 'doc-hash-2');
    set_contract_address(verifier1());
    env.bsafe.verify_death_certificate(id);
    set_contract_address(verifier2());
    env.bsafe.verify_death_certificate(id);
    assert!(env.bsafe.get_proof(id).verified);
    assert_eq!(env.bsafe.get_proof(id).nonce, 2);
}

#[test]
#[should_panic(expected: ('Already verified', 'ENTRYPOINT_FAILED'))]
fn test_verifier_cannot_verify_twice() {
    let env = setup();
    let id = certificate_plan(env);
    set_contract_address(heir1());
    env.bsafe.submit_death_certificate(id, 'doc');
    set_contract_address(verifier1());
    env.bsafe.verify_death_certificate(id);
    env.bsafe.verify_death_certificate(id);
}

#[test]
#[should_panic(expected: ('Proof not verified', 'ENTRYPOINT_FAILED'))]
fn test_initiate_needs_verified_proof() {
    let env = setup();
    let id = certificate_plan(env);
    set_contract_address(heir1());
    env.bsafe.submit_death_certificate(id, 'doc');
    set_contract_address(verifier1());
    env.bsafe.verify_death_certificate(id);
    env.bsafe.initiate_inheritance(id);
}

#[test]
#[should_panic(expected: ('Caller is not a beneficiary', 'ENTRYPOINT_FAILED'))]
fn test_only_heir_submits_certificate() {
    let env = setup();
    let id = certificate_plan(env);
    set_contract_address(stranger());
    env.bsafe.submit_death_certificate(id, 'doc');
}

#[test]
#[should_panic(expected: ('Cooldown already ended', 'ENTRYPOINT_FAILED'))]
fn test_cannot_cancel_after_cooldown() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.create_inheritance_plan(id, TriggerType::Both, DAY, 30 * DAY, 1);
    set_block_timestamp(T0 + 30 * DAY);
    env.bsafe.initiate_inheritance(id);
    set_block_timestamp(T0 + 31 * DAY);
    env.bsafe.cancel_inheritance(id);
}

// ==================== MULTISIG ====================

fn multisig_vault(env: Env) -> u64 {
    let id = funded_vault(env);
    env.bsafe.add_signer(id, owner());
    env.bsafe.add_signer(id, cosigner());
    id
}

#[test]
fn test_multisig_withdrawal() {
    let env = setup();
    let id = multisig_vault(env);
    let v = env.bsafe.get_vault(id);
    assert!(v.multisig_enabled);
    assert_eq!(v.multisig_threshold, 2);

    let tx = env.bsafe.propose_transaction(id, TransactionType::Withdrawal, 25 * ONE, stranger(), 0);
    assert_eq!(env.bsafe.get_transaction(id, tx).status, TransactionStatus::Pending);
    set_contract_address(cosigner());
    env.bsafe.approve_transaction(id, tx);
    assert_eq!(env.bsafe.get_transaction(id, tx).status, TransactionStatus::Approved);
    env.bsafe.execute_transaction(id, tx);
    assert_eq!(env.token.balance_of(stranger()), 25 * ONE);
    assert_eq!(env.bsafe.get_vault(id).balance, 75 * ONE);
    assert_eq!(env.bsafe.get_transaction(id, tx).status, TransactionStatus::Executed);
}

#[test]
#[should_panic(expected: ('Use the multisig flow', 'ENTRYPOINT_FAILED'))]
fn test_multisig_blocks_direct_withdraw() {
    let env = setup();
    let id = multisig_vault(env);
    env.bsafe.withdraw(id, ONE, owner());
}

#[test]
#[should_panic(expected: ('Already approved', 'ENTRYPOINT_FAILED'))]
fn test_multisig_double_approval() {
    let env = setup();
    let id = multisig_vault(env);
    env.bsafe.add_signer(id, stranger());
    env.bsafe.update_threshold(id, 3);
    let tx = env.bsafe.propose_transaction(id, TransactionType::Withdrawal, ONE, owner(), 0);
    env.bsafe.approve_transaction(id, tx);
}

#[test]
#[should_panic(expected: ('Transaction not approved', 'ENTRYPOINT_FAILED'))]
fn test_multisig_execute_without_threshold() {
    let env = setup();
    let id = multisig_vault(env);
    let tx = env.bsafe.propose_transaction(id, TransactionType::Withdrawal, ONE, owner(), 0);
    env.bsafe.execute_transaction(id, tx);
}

#[test]
#[should_panic(expected: ('Caller is not a signer', 'ENTRYPOINT_FAILED'))]
fn test_removed_signer_cannot_approve() {
    let env = setup();
    let id = multisig_vault(env);
    env.bsafe.add_signer(id, stranger());
    let tx = env.bsafe.propose_transaction(id, TransactionType::Withdrawal, ONE, owner(), 0);
    env.bsafe.remove_signer(id, cosigner());
    set_contract_address(cosigner());
    env.bsafe.approve_transaction(id, tx);
}

#[test]
fn test_multisig_threshold_via_proposal() {
    let env = setup();
    let id = multisig_vault(env);
    env.bsafe.add_signer(id, stranger());
    let tx = env.bsafe.propose_transaction(id, TransactionType::UpdateThreshold, 0, owner(), 3);
    set_contract_address(stranger());
    env.bsafe.approve_transaction(id, tx);
    env.bsafe.execute_transaction(id, tx);
    assert_eq!(env.bsafe.get_vault(id).multisig_threshold, 3);
}

// ==================== MEMBERSHIP ====================

#[test]
fn test_premium_has_no_claim_fee() {
    let env = setup();
    let id = funded_vault(env);
    env.bsafe.upgrade_membership(MembershipTier::Premium);
    assert_eq!(env.token.balance_of(treasury()), 50 * ONE);
    assert_eq!(env.bsafe.get_effective_tier(owner()), MembershipTier::Premium);

    env.bsafe.create_inheritance_plan(id, TriggerType::DeadmanSwitch, DAY, 30 * DAY, 0);
    set_block_timestamp(T0 + 30 * DAY);
    env.bsafe.initiate_inheritance(id);
    set_block_timestamp(T0 + 31 * DAY);
    set_contract_address(heir1());
    env.bsafe.claim_inheritance(id);
    assert_eq!(env.token.balance_of(heir1()), 60 * ONE);
    assert_eq!(env.token.balance_of(treasury()), 50 * ONE);
}

#[test]
fn test_concierge_expires_to_free() {
    let env = setup();
    env.bsafe.upgrade_membership(MembershipTier::Concierge);
    assert_eq!(env.bsafe.get_effective_tier(owner()), MembershipTier::Concierge);
    set_block_timestamp(T0 + 366 * DAY);
    assert_eq!(env.bsafe.get_effective_tier(owner()), MembershipTier::Free);
}

#[test]
#[should_panic(expected: ('Invalid membership upgrade', 'ENTRYPOINT_FAILED'))]
fn test_cannot_downgrade_membership() {
    let env = setup();
    env.bsafe.upgrade_membership(MembershipTier::Concierge);
    env.bsafe.upgrade_membership(MembershipTier::Premium);
}

#[test]
#[should_panic(expected: ('Caller is not the admin', 'ENTRYPOINT_FAILED'))]
fn test_only_admin_sets_treasury() {
    let env = setup();
    env.bsafe.set_treasury(stranger());
}
