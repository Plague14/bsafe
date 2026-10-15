use starknet::ContractAddress;

pub const BPS_DENOMINATOR: u16 = 10000;
pub const FREE_TIER_FEE_BPS: u16 = 100; // 1%
pub const MAX_BENEFICIARIES: u8 = 10;
pub const MAX_SIGNERS: u8 = 10;
pub const MAX_SIGNER_INDEX: u8 = 64; // approval bitmap is a u64
pub const MAX_VERIFICATIONS: u8 = 10;
pub const CONCIERGE_DURATION: u64 = 365 * 24 * 60 * 60;

// Timer bounds. A contract deployed with `demo_mode` (testnet demos only) shortens the
// minimums to minutes so the whole inheritance flow can be shown live.
pub const MIN_COOLDOWN: u64 = 24 * 60 * 60; // 1 day
pub const MIN_COOLDOWN_DEMO: u64 = 60; // 1 minute
pub const MAX_COOLDOWN: u64 = 365 * 24 * 60 * 60; // 365 days
pub const MIN_DEADMAN: u64 = 30 * 24 * 60 * 60; // 30 days
pub const MIN_DEADMAN_DEMO: u64 = 2 * 60; // 2 minutes
pub const MAX_DEADMAN: u64 = 5 * 365 * 24 * 60 * 60; // 5 years

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum VaultStatus {
    #[default]
    Active,
    InheritanceInitiated,
    InheritanceCompleted,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum BeneficiaryStatus {
    #[default]
    None,
    Active,
    Removed,
    Claimed,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum InheritanceStatus {
    #[default]
    None,
    Configured,
    ProofSubmitted,
    CooldownActive,
    ClaimReady,
    Completed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum TriggerType {
    #[default]
    DeathCertificate,
    DeadmanSwitch,
    Both,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum TransactionType {
    #[default]
    Withdrawal,
    UpdateThreshold,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum TransactionStatus {
    #[default]
    None,
    Pending,
    Approved,
    Executed,
    Cancelled,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub enum MembershipTier {
    #[default]
    Free,
    Premium,
    Concierge,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Vault {
    pub owner: ContractAddress,
    /// Short string, up to 31 characters
    pub name: felt252,
    /// ERC-20 held by this vault (STRK, ETH, USDC...)
    pub token: ContractAddress,
    pub status: VaultStatus,
    /// Tokens held for this vault (the contract holds every vault's tokens)
    pub balance: u256,
    /// Active beneficiaries
    pub beneficiary_count: u8,
    /// Every wallet ever added, removed ones included (for enumeration)
    pub beneficiary_list_len: u8,
    pub total_share_bps: u16,
    pub multisig_enabled: bool,
    pub multisig_threshold: u8,
    pub signer_count: u8,
    /// Monotonic approval-bitmap position; never reused after a signer is removed
    pub next_signer_index: u8,
    pub signer_list_len: u8,
    pub tx_count: u64,
    /// Last owner action (for the deadman switch)
    pub last_activity: u64,
    pub created_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Beneficiary {
    pub share_bps: u16,
    pub status: BeneficiaryStatus,
    pub claimed_amount: u256,
    pub added_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct InheritancePlan {
    pub status: InheritanceStatus,
    pub trigger_type: TriggerType,
    pub cooldown_seconds: u64,
    pub deadman_seconds: u64,
    pub required_verifications: u8,
    pub current_verifications: u8,
    pub verifier_count: u8,
    pub triggered_at: u64,
    pub cooldown_ends_at: u64,
    /// Vault balance snapshot taken when the inheritance is triggered
    pub distribution_amount: u256,
    /// Sum of active shares at trigger time; shares are paid pro rata against it
    pub share_total_snapshot: u16,
    /// Active beneficiaries at trigger time
    pub beneficiaries_snapshot: u8,
    pub claims_count: u8,
    pub created_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct DeathCertificateProof {
    /// Hash of the off-chain document (e.g. SHA-256 truncated to 251 bits, or Poseidon)
    pub document_hash: felt252,
    pub submitted_by: ContractAddress,
    pub submitted_at: u64,
    pub verified: bool,
    /// Increments on every submission, so a verifier can confirm a newer proof
    pub nonce: u32,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Verifier {
    pub exists: bool,
    /// Proof nonce this verifier last confirmed (0 = never)
    pub verified_nonce: u32,
    pub verified_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Signer {
    pub active: bool,
    pub listed: bool,
    pub index: u8,
    pub added_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct MultisigTransaction {
    pub tx_type: TransactionType,
    pub status: TransactionStatus,
    pub amount: u256,
    pub destination: ContractAddress,
    /// New threshold, for UpdateThreshold
    pub new_threshold: u8,
    pub proposer: ContractAddress,
    pub threshold: u8,
    pub approval_count: u8,
    /// Bit i set = signer with index i approved
    pub approvals: u64,
    pub proposed_at: u64,
    pub executed_at: u64,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Membership {
    pub tier: MembershipTier,
    /// 0 = never expires
    pub expires_at: u64,
    pub total_paid: u256,
}

pub fn tier_level(tier: MembershipTier) -> u8 {
    match tier {
        MembershipTier::Free => 0,
        MembershipTier::Premium => 1,
        MembershipTier::Concierge => 2,
    }
}

pub fn tier_fee_bps(tier: MembershipTier) -> u16 {
    match tier {
        MembershipTier::Free => FREE_TIER_FEE_BPS,
        MembershipTier::Premium => 0,
        MembershipTier::Concierge => 0,
    }
}

/// 2^index as a u64 bitmap mask
pub fn bit(index: u8) -> u64 {
    assert(index < MAX_SIGNER_INDEX, 'Signer index out of range');
    let mut mask: u64 = 1;
    let mut i: u8 = 0;
    while i < index {
        mask = mask * 2;
        i += 1;
    }
    mask
}
