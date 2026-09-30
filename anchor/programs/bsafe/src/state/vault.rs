use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Locked,
    InheritanceInitiated,
    InheritanceCompleted,
}

impl Default for VaultStatus {
    fn default() -> Self {
        VaultStatus::Active
    }
}

#[account]
#[derive(Default)]
pub struct Vault {
    /// The owner of the vault (primary signer)
    pub owner: Pubkey,

    /// Name of the vault (max 32 bytes)
    pub name: [u8; 32],

    /// Current status of the vault
    pub status: VaultStatus,

    /// Total SOL balance in lamports (tracked for reference, actual balance is on PDA)
    pub balance: u64,

    /// Number of beneficiaries
    pub beneficiary_count: u8,

    /// Whether multisig is enabled
    pub multisig_enabled: bool,

    /// Threshold for multisig operations (if enabled)
    pub multisig_threshold: u8,

    /// Number of signers for multisig
    pub signer_count: u8,

    /// Last activity timestamp (for deadman switch)
    pub last_activity: i64,

    /// Timestamp when the vault was created
    pub created_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Total share allocation in basis points (should sum to 10000 for 100%)
    pub total_share_bps: u16,

    /// Monotonic index for the next multisig signer (approval bitmask position).
    /// Never reused after a signer is removed, so approval bits can't collide.
    pub next_signer_index: u8,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 29],
    pub _reserved2: [u8; 32],
}

impl Vault {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        32 + // name
        1 +  // status
        8 +  // balance
        1 +  // beneficiary_count
        1 +  // multisig_enabled
        1 +  // multisig_threshold
        1 +  // signer_count
        8 +  // last_activity
        8 +  // created_at
        1 +  // bump
        2 +  // total_share_bps
        1 +  // next_signer_index
        29 + // reserved
        32;  // reserved2

    pub fn update_activity(&mut self) {
        self.last_activity = Clock::get().unwrap().unix_timestamp;
    }

    /// Check if all shares are fully allocated (100% = 10000 bps)
    pub fn is_fully_allocated(&self) -> bool {
        self.total_share_bps == 10000
    }
}
