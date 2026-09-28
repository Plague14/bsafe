use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TransactionStatus {
    Pending,
    Approved,
    Executed,
    Cancelled,
}

impl Default for TransactionStatus {
    fn default() -> Self {
        TransactionStatus::Pending
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TransactionType {
    Withdrawal,
    AddBeneficiary,
    RemoveBeneficiary,
    UpdateShares,
    AddSigner,
    RemoveSigner,
    UpdateThreshold,
}

impl Default for TransactionType {
    fn default() -> Self {
        TransactionType::Withdrawal
    }
}

#[account]
pub struct MultisigSigner {
    /// The vault this signer belongs to
    pub vault: Pubkey,

    /// The signer's public key
    pub signer: Pubkey,

    /// Index in the signers list
    pub index: u8,

    /// Whether this signer is currently active
    pub is_active: bool,

    /// Timestamp when added
    pub added_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl MultisigSigner {
    pub const LEN: usize = 8 + // discriminator
        32 + // vault
        32 + // signer
        1 +  // index
        1 +  // is_active
        8 +  // added_at
        1;   // bump
}

#[account]
#[derive(Default)]
pub struct MultisigTransaction {
    /// The vault this transaction belongs to
    pub vault: Pubkey,

    /// Transaction sequence number (for ordering)
    pub seq_number: u64,

    /// Type of transaction
    pub tx_type: TransactionType,

    /// Current status
    pub status: TransactionStatus,

    /// Amount involved (for withdrawals)
    pub amount: u64,

    /// Destination address (for withdrawals)
    pub destination: Pubkey,

    /// Additional data (for other operations, e.g., new threshold value)
    pub data: [u8; 32],

    /// Who proposed this transaction
    pub proposer: Pubkey,

    /// Number of approvals required
    pub threshold: u8,

    /// Current number of approvals
    pub approval_count: u8,

    /// Bitmap of who has approved (supports up to 64 signers)
    pub approvals: u64,

    /// Timestamp when proposed
    pub proposed_at: i64,

    /// Timestamp when executed (0 if not executed)
    pub executed_at: i64,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Reserved space
    pub _reserved: [u8; 32],
}

impl MultisigTransaction {
    pub const LEN: usize = 8 + // discriminator
        32 + // vault
        8 +  // seq_number
        1 +  // tx_type
        1 +  // status
        8 +  // amount
        32 + // destination
        32 + // data
        32 + // proposer
        1 +  // threshold
        1 +  // approval_count
        8 +  // approvals
        8 +  // proposed_at
        8 +  // executed_at
        1 +  // bump
        32;  // reserved

    /// Check if a signer has already approved
    pub fn has_approved(&self, signer_index: u8) -> bool {
        if signer_index >= 64 {
            return false;
        }
        (self.approvals & (1u64 << signer_index)) != 0
    }

    /// Record an approval from a signer
    pub fn add_approval(&mut self, signer_index: u8) {
        if signer_index < 64 {
            self.approvals |= 1u64 << signer_index;
            self.approval_count += 1;
        }
    }

    /// Check if threshold has been reached
    pub fn is_threshold_reached(&self) -> bool {
        self.approval_count >= self.threshold
    }
}
