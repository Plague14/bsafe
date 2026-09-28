use anchor_lang::prelude::*;

#[error_code]
pub enum BsafeError {
    // Vault errors (6000-6099)
    #[msg("Vault is not active")]
    VaultNotActive,

    #[msg("Vault is locked")]
    VaultLocked,

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,

    #[msg("Invalid vault name")]
    InvalidVaultName,

    // Authorization errors (6100-6199)
    #[msg("Unauthorized: only owner can perform this action")]
    UnauthorizedOwner,

    #[msg("Unauthorized: signer not in multisig")]
    UnauthorizedSigner,

    #[msg("Unauthorized: not a valid beneficiary")]
    UnauthorizedBeneficiary,

    #[msg("Unauthorized: not a valid verifier")]
    UnauthorizedVerifier,

    // Beneficiary errors (6200-6299)
    #[msg("Maximum beneficiaries reached")]
    MaxBeneficiariesReached,

    #[msg("Beneficiary already exists")]
    BeneficiaryAlreadyExists,

    #[msg("Beneficiary not found")]
    BeneficiaryNotFound,

    #[msg("Share percentages must sum to 100%")]
    InvalidShareSum,

    #[msg("Share percentage out of range (0-10000)")]
    InvalidSharePercentage,

    #[msg("Beneficiary has already claimed")]
    AlreadyClaimed,

    // Multisig errors (6300-6399)
    #[msg("Maximum signers reached")]
    MaxSignersReached,

    #[msg("Signer already exists")]
    SignerAlreadyExists,

    #[msg("Signer not found")]
    SignerNotFound,

    #[msg("Invalid threshold: must be >= 1 and <= signer count")]
    InvalidThreshold,

    #[msg("Transaction already approved by this signer")]
    AlreadyApproved,

    #[msg("Transaction threshold not reached")]
    ThresholdNotReached,

    #[msg("Transaction already executed")]
    AlreadyExecuted,

    #[msg("Transaction cancelled")]
    TransactionCancelled,

    #[msg("Cannot remove owner from signers")]
    CannotRemoveOwner,

    // Inheritance errors (6400-6499)
    #[msg("Inheritance plan already exists")]
    InheritancePlanExists,

    #[msg("Inheritance not configured")]
    InheritanceNotConfigured,

    #[msg("Inheritance already triggered")]
    InheritanceAlreadyTriggered,

    #[msg("Inheritance not triggered")]
    InheritanceNotTriggered,

    #[msg("Cooldown period not complete")]
    CooldownNotComplete,

    #[msg("Cooldown period has ended, cannot cancel")]
    CooldownEnded,

    #[msg("Invalid cooldown period")]
    InvalidCooldownPeriod,

    #[msg("Proof already submitted")]
    ProofAlreadySubmitted,

    #[msg("Proof not verified")]
    ProofNotVerified,

    #[msg("Verifier already verified")]
    AlreadyVerified,

    #[msg("Insufficient verifications")]
    InsufficientVerifications,

    #[msg("Deadman switch not triggered")]
    DeadmanSwitchNotTriggered,

    #[msg("Owner is still active")]
    OwnerStillActive,

    // General errors (6500-6599)
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Invalid account")]
    InvalidAccount,

    #[msg("Account not initialized")]
    AccountNotInitialized,

    // Membership errors (6600-6699)
    #[msg("Invalid upgrade: cannot upgrade to lower or same tier")]
    InvalidUpgrade,

    #[msg("Maximum vaults reached for this membership tier")]
    MaxVaultsReached,

    #[msg("Membership has expired")]
    MembershipExpired,

    #[msg("Membership not found")]
    MembershipNotFound,
}
