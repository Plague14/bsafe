use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::{TriggerType, TransactionType, MembershipTier};

declare_id!("3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv");

#[program]
pub mod bsafe {
    use super::*;

    // ==================== VAULT INSTRUCTIONS ====================

    /// Create a new vault
    pub fn create_vault(ctx: Context<CreateVault>, name: [u8; 32]) -> Result<()> {
        instructions::vault::create::create_vault(ctx, name)
    }

    /// Deposit SOL into the vault
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::vault::deposit::deposit(ctx, amount)
    }

    /// Withdraw SOL from the vault (owner only, or via multisig)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::vault::withdraw::withdraw(ctx, amount)
    }

    // ==================== BENEFICIARY INSTRUCTIONS ====================

    /// Add a beneficiary to the vault
    pub fn add_beneficiary(
        ctx: Context<AddBeneficiary>,
        wallet: Pubkey,
        share_bps: u16,
    ) -> Result<()> {
        instructions::beneficiary::add::add_beneficiary(ctx, wallet, share_bps)
    }

    /// Remove a beneficiary from the vault
    pub fn remove_beneficiary(ctx: Context<RemoveBeneficiary>) -> Result<()> {
        instructions::beneficiary::remove::remove_beneficiary(ctx)
    }

    /// Update a beneficiary's share percentage
    pub fn update_shares(ctx: Context<UpdateShares>, new_share_bps: u16) -> Result<()> {
        instructions::beneficiary::update_shares::update_shares(ctx, new_share_bps)
    }

    // ==================== INHERITANCE INSTRUCTIONS ====================

    /// Create an inheritance plan for the vault
    pub fn create_inheritance_plan(
        ctx: Context<CreateInheritancePlan>,
        trigger_type: TriggerType,
        cooldown_seconds: u64,
        deadman_switch_seconds: u64,
        required_verifications: u8,
    ) -> Result<()> {
        instructions::inheritance::create_plan::create_inheritance_plan(
            ctx,
            trigger_type,
            cooldown_seconds,
            deadman_switch_seconds,
            required_verifications,
        )
    }

    /// Add a verifier to the inheritance plan
    pub fn add_verifier(ctx: Context<AddVerifier>) -> Result<()> {
        instructions::inheritance::verify_proof::add_verifier_handler(ctx)
    }

    /// Submit a death certificate proof
    pub fn submit_death_certificate(
        ctx: Context<SubmitDeathCertificate>,
        document_hash: [u8; 32],
    ) -> Result<()> {
        instructions::inheritance::submit_proof::submit_death_certificate(ctx, document_hash)
    }

    /// Verify a death certificate proof
    pub fn verify_death_certificate(ctx: Context<VerifyDeathCertificate>) -> Result<()> {
        instructions::inheritance::verify_proof::verify_death_certificate(ctx)
    }

    /// Initiate the inheritance process (starts cooldown)
    pub fn initiate_inheritance(ctx: Context<InitiateInheritance>) -> Result<()> {
        instructions::inheritance::initiate::initiate_inheritance(ctx)
    }

    /// Claim inheritance as a beneficiary
    pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
        instructions::inheritance::claim::claim_inheritance(ctx)
    }

    /// Cancel inheritance (owner proves they're alive)
    pub fn cancel_inheritance(ctx: Context<CancelInheritance>) -> Result<()> {
        instructions::inheritance::cancel::cancel_inheritance(ctx)
    }

    /// Reset a cancelled inheritance plan
    pub fn reset_inheritance_plan(ctx: Context<ResetInheritancePlan>) -> Result<()> {
        instructions::inheritance::cancel::reset_handler(ctx)
    }

    // ==================== MULTISIG INSTRUCTIONS ====================

    /// Add a signer to the vault's multisig
    pub fn add_signer(ctx: Context<AddSigner>, new_signer: Pubkey) -> Result<()> {
        instructions::multisig::add_signer::add_signer(ctx, new_signer)
    }

    /// Update the multisig threshold
    pub fn update_threshold(ctx: Context<UpdateThreshold>, new_threshold: u8) -> Result<()> {
        instructions::multisig::add_signer::update_threshold_handler(ctx, new_threshold)
    }

    /// Remove a signer from the vault's multisig
    pub fn remove_signer(ctx: Context<RemoveSigner>) -> Result<()> {
        instructions::multisig::remove_signer::remove_signer(ctx)
    }

    /// Propose a new multisig transaction
    pub fn propose_transaction(
        ctx: Context<ProposeTransaction>,
        tx_type: TransactionType,
        amount: u64,
        destination: Pubkey,
        data: [u8; 32],
    ) -> Result<()> {
        instructions::multisig::propose::propose_transaction(ctx, tx_type, amount, destination, data)
    }

    /// Approve a pending transaction
    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        instructions::multisig::approve::approve_transaction(ctx)
    }

    /// Reject a pending transaction (owner only)
    pub fn reject_transaction(ctx: Context<RejectTransaction>) -> Result<()> {
        instructions::multisig::approve::reject_handler(ctx)
    }

    /// Execute an approved transaction
    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        instructions::multisig::execute::execute_transaction(ctx)
    }

    // ==================== MEMBERSHIP INSTRUCTIONS ====================

    /// Initialize the BSafe treasury (one-time admin setup)
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        instructions::membership::init_treasury::initialize_treasury(ctx)
    }

    /// Create a new membership account (Free tier by default)
    pub fn create_membership(ctx: Context<CreateMembership>) -> Result<()> {
        instructions::membership::create::create_membership(ctx)
    }

    /// Upgrade membership to a higher tier
    pub fn upgrade_membership(
        ctx: Context<UpgradeMembership>,
        target_tier: MembershipTier,
    ) -> Result<()> {
        instructions::membership::upgrade::upgrade_membership(ctx, target_tier)
    }
}
