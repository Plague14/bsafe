use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BeneficiaryStatus {
    Active,
    Removed,
    Claimed,
}

impl Default for BeneficiaryStatus {
    fn default() -> Self {
        BeneficiaryStatus::Active
    }
}

#[account]
#[derive(Default)]
pub struct Beneficiary {
    /// The vault this beneficiary belongs to
    pub vault: Pubkey,

    /// The wallet address of the beneficiary
    pub wallet: Pubkey,

    /// Share percentage (0-10000, representing 0.00% to 100.00%)
    /// Using basis points for precision
    pub share_bps: u16,

    /// Current status of the beneficiary
    pub status: BeneficiaryStatus,

    /// Index of this beneficiary in the vault's list
    pub index: u8,

    /// Amount claimed (in lamports)
    pub claimed_amount: u64,

    /// Timestamp when the beneficiary was added
    pub added_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 32],
}

impl Beneficiary {
    pub const LEN: usize = 8 + // discriminator
        32 + // vault
        32 + // wallet
        2 +  // share_bps
        1 +  // status
        1 +  // index
        8 +  // claimed_amount
        8 +  // added_at
        1 +  // bump
        32;  // reserved

    /// Calculate the amount this beneficiary should receive based on share
    pub fn calculate_share(&self, total_amount: u64) -> u64 {
        ((total_amount as u128) * (self.share_bps as u128) / 10000) as u64
    }
}
