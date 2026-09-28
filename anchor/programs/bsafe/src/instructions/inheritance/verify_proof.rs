use anchor_lang::prelude::*;
use crate::state::{
    Vault, InheritancePlan, InheritanceStatus,
    DeathCertificateProof, Verifier
};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct VerifyDeathCertificate<'info> {
    #[account(
        constraint = vault.key() == inheritance_plan.vault @ BsafeError::InvalidAccount
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = inheritance_plan.status == InheritanceStatus::ProofSubmitted @ BsafeError::InheritanceNotTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    #[account(
        mut,
        constraint = proof.inheritance_plan == inheritance_plan.key() @ BsafeError::InvalidAccount,
        constraint = !proof.verified @ BsafeError::ProofNotVerified
    )]
    pub proof: Account<'info, DeathCertificateProof>,

    #[account(
        mut,
        constraint = verifier_account.inheritance_plan == inheritance_plan.key() @ BsafeError::InvalidAccount,
        constraint = verifier_account.verifier == verifier.key() @ BsafeError::UnauthorizedVerifier,
        constraint = !verifier_account.has_verified @ BsafeError::AlreadyVerified
    )]
    pub verifier_account: Account<'info, Verifier>,

    pub verifier: Signer<'info>,
}

pub fn verify_death_certificate(ctx: Context<VerifyDeathCertificate>) -> Result<()> {
    let plan = &mut ctx.accounts.inheritance_plan;
    let proof = &mut ctx.accounts.proof;
    let verifier_account = &mut ctx.accounts.verifier_account;
    let clock = Clock::get()?;

    // Mark verifier as having verified
    verifier_account.has_verified = true;
    verifier_account.verified_at = clock.unix_timestamp;

    // Increment verification counts
    proof.verification_count += 1;
    plan.current_verifications += 1;

    msg!(
        "Verification {} of {} received from {}",
        plan.current_verifications,
        plan.required_verifications,
        ctx.accounts.verifier.key()
    );

    // Check if we have enough verifications
    if plan.current_verifications >= plan.required_verifications {
        proof.verified = true;
        msg!("Proof verified! Required verifications reached.");
    }

    Ok(())
}

/// Add a verifier to the inheritance plan (called by owner during setup)
#[derive(Accounts)]
pub struct AddVerifier<'info> {
    #[account(
        has_one = owner @ BsafeError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = inheritance_plan.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = inheritance_plan.status == InheritanceStatus::Configured @ BsafeError::InheritanceAlreadyTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    #[account(
        init,
        payer = owner,
        space = Verifier::LEN,
        seeds = [b"verifier", inheritance_plan.key().as_ref(), verifier_pubkey.key().as_ref()],
        bump
    )]
    pub verifier_account: Account<'info, Verifier>,

    /// CHECK: The verifier's public key
    pub verifier_pubkey: AccountInfo<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn add_verifier_handler(ctx: Context<AddVerifier>) -> Result<()> {
    let verifier_account = &mut ctx.accounts.verifier_account;

    verifier_account.inheritance_plan = ctx.accounts.inheritance_plan.key();
    verifier_account.verifier = ctx.accounts.verifier_pubkey.key();
    verifier_account.has_verified = false;
    verifier_account.verified_at = 0;
    verifier_account.bump = ctx.bumps.verifier_account;

    msg!(
        "Added verifier {} to inheritance plan",
        ctx.accounts.verifier_pubkey.key()
    );

    Ok(())
}
