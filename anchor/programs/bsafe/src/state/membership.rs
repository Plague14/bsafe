use anchor_lang::prelude::*;

/// Membership tiers for BSafe users
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MembershipTier {
    /// Free tier - 1% claim fee, 1 vault, 3 beneficiaries
    Free,
    /// Premium tier - No claim fee, 5 vaults, 10 beneficiaries
    Premium,
    /// Concierge tier - No claim fee, unlimited vaults/beneficiaries, VIP support
    Concierge,
}

impl Default for MembershipTier {
    fn default() -> Self {
        MembershipTier::Free
    }
}

impl MembershipTier {
    /// Get the claim fee in basis points (100 = 1%)
    pub fn claim_fee_bps(&self) -> u16 {
        match self {
            MembershipTier::Free => 100,      // 1%
            MembershipTier::Premium => 0,     // 0%
            MembershipTier::Concierge => 0,   // 0%
        }
    }

    /// Get maximum number of vaults allowed
    pub fn max_vaults(&self) -> u8 {
        match self {
            MembershipTier::Free => 1,
            MembershipTier::Premium => 5,
            MembershipTier::Concierge => 255, // Unlimited
        }
    }

    /// Get maximum number of beneficiaries per vault
    pub fn max_beneficiaries(&self) -> u8 {
        match self {
            MembershipTier::Free => 3,
            MembershipTier::Premium => 10,
            MembershipTier::Concierge => 50, // High limit
        }
    }

    /// Get upgrade price in lamports
    pub fn upgrade_price_lamports(&self) -> u64 {
        match self {
            MembershipTier::Free => 0,
            MembershipTier::Premium => 1_000_000_000,      // 1 SOL
            MembershipTier::Concierge => 50_000_000_000,   // 50 SOL
        }
    }
}

/// User membership account
#[account]
#[derive(Default)]
pub struct Membership {
    /// The user's wallet
    pub owner: Pubkey,

    /// Current membership tier
    pub tier: MembershipTier,

    /// Number of vaults created by this user
    pub vault_count: u8,

    /// Timestamp when membership was created
    pub created_at: i64,

    /// Timestamp when membership expires (0 = never for Premium, timestamp for Concierge)
    pub expires_at: i64,

    /// Total amount paid in lamports
    pub total_paid: u64,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Reserved space for future upgrades
    pub _reserved: [u8; 64],
}

impl Membership {
    pub const LEN: usize = 8 +  // discriminator
        32 + // owner
        1 +  // tier
        1 +  // vault_count
        8 +  // created_at
        8 +  // expires_at
        8 +  // total_paid
        1 +  // bump
        64;  // reserved

    /// Check if membership is active (not expired)
    pub fn is_active(&self) -> bool {
        if self.expires_at == 0 {
            return true; // Never expires
        }
        let clock = Clock::get().unwrap();
        clock.unix_timestamp < self.expires_at
    }

    /// Check if user can create more vaults
    pub fn can_create_vault(&self) -> bool {
        self.vault_count < self.tier.max_vaults()
    }

    /// Get effective tier (downgrades to Free if expired)
    pub fn effective_tier(&self) -> MembershipTier {
        if self.is_active() {
            self.tier
        } else {
            MembershipTier::Free
        }
    }
}

/// BSafe Treasury account for collecting fees
#[account]
pub struct BsafeTreasury {
    /// Authority that can withdraw from treasury
    pub authority: Pubkey,

    /// Total fees collected in lamports
    pub total_collected: u64,

    /// Total withdrawn in lamports
    pub total_withdrawn: u64,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl BsafeTreasury {
    pub const LEN: usize = 8 +  // discriminator
        32 + // authority
        8 +  // total_collected
        8 +  // total_withdrawn
        1;   // bump
}
