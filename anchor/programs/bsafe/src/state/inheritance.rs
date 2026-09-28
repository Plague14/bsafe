use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum InheritanceStatus {
    /// Plan is configured but not triggered
    Configured,
    /// Death certificate submitted, awaiting verification
    ProofSubmitted,
    /// Proof verified, cooldown period started
    CooldownActive,
    /// Cooldown complete, claims can be made
    ClaimReady,
    /// All claims completed
    Completed,
    /// Owner cancelled the inheritance (proved alive)
    Cancelled,
}

impl Default for InheritanceStatus {
    fn default() -> Self {
        InheritanceStatus::Configured
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TriggerType {
    /// Manual trigger via death certificate
    DeathCertificate,
    /// Automatic trigger if owner doesn't interact for X days
    DeadmanSwitch,
    /// Both methods can trigger
    Both,
}

impl Default for TriggerType {
    fn default() -> Self {
        TriggerType::Both
    }
}

#[account]
#[derive(Default)]
pub struct InheritancePlan {
    /// The vault this plan belongs to
    pub vault: Pubkey,

    /// Current status of the inheritance
    pub status: InheritanceStatus,

    /// Type of trigger configured
    pub trigger_type: TriggerType,

    /// Cooldown period in seconds (time owner has to cancel after trigger)
    /// Default: 30 days = 2592000 seconds
    pub cooldown_seconds: u64,

    /// Deadman switch inactivity period in seconds
    /// Default: 365 days = 31536000 seconds
    pub deadman_switch_seconds: u64,

    /// Timestamp when the inheritance was triggered
    pub triggered_at: i64,

    /// Timestamp when cooldown ends and claims can begin
    pub cooldown_ends_at: i64,

    /// Total amount to be distributed (snapshot at trigger time)
    pub distribution_amount: u64,

    /// Number of required verifications for death certificate
    pub required_verifications: u8,

    /// Current number of verifications received
    pub current_verifications: u8,

    /// Timestamp when the plan was created
    pub created_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 32],
    pub _reserved2: [u8; 32],
}

impl InheritancePlan {
    pub const LEN: usize = 8 + // discriminator
        32 + // vault
        1 +  // status
        1 +  // trigger_type
        8 +  // cooldown_seconds
        8 +  // deadman_switch_seconds
        8 +  // triggered_at
        8 +  // cooldown_ends_at
        8 +  // distribution_amount
        1 +  // required_verifications
        1 +  // current_verifications
        8 +  // created_at
        1 +  // bump
        32 + // reserved
        32;  // reserved2

    pub const DEFAULT_COOLDOWN_SECONDS: u64 = 30 * 24 * 60 * 60; // 30 days
    pub const DEFAULT_DEADMAN_SWITCH_SECONDS: u64 = 365 * 24 * 60 * 60; // 365 days

    /// Check if cooldown period has ended
    pub fn is_cooldown_complete(&self) -> bool {
        let now = Clock::get().unwrap().unix_timestamp;
        now >= self.cooldown_ends_at
    }
}

#[account]
pub struct DeathCertificateProof {
    /// The inheritance plan this proof belongs to
    pub inheritance_plan: Pubkey,

    /// Hash of the death certificate document (SHA256)
    pub document_hash: [u8; 32],

    /// Who submitted the proof
    pub submitted_by: Pubkey,

    /// Timestamp when submitted
    pub submitted_at: i64,

    /// Whether this proof has been verified
    pub verified: bool,

    /// Number of verifications received
    pub verification_count: u8,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Reserved space
    pub _reserved: [u8; 32],
}

impl DeathCertificateProof {
    pub const LEN: usize = 8 + // discriminator
        32 + // inheritance_plan
        32 + // document_hash
        32 + // submitted_by
        8 +  // submitted_at
        1 +  // verified
        1 +  // verification_count
        1 +  // bump
        32;  // reserved
}

#[account]
pub struct Verifier {
    /// The inheritance plan this verifier is authorized for
    pub inheritance_plan: Pubkey,

    /// The verifier's public key
    pub verifier: Pubkey,

    /// Whether this verifier has already verified
    pub has_verified: bool,

    /// Timestamp when verified (0 if not verified)
    pub verified_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl Verifier {
    pub const LEN: usize = 8 + // discriminator
        32 + // inheritance_plan
        32 + // verifier
        1 +  // has_verified
        8 +  // verified_at
        1;   // bump
}
