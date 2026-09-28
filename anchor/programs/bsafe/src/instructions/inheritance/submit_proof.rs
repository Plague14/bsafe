use anchor_lang::prelude::*;
use crate::state::{
    Vault, InheritancePlan, InheritanceStatus, Beneficiary,
    BeneficiaryStatus, DeathCertificateProof
};
use crate::errors::BsafeError;

#[derive(Accounts)]
#[instruction(document_hash: [u8; 32])]
pub struct SubmitDeathCertificate<'info> {
    #[account(
        constraint = vault.key() == inheritance_plan.vault @ BsafeError::InvalidAccount
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = inheritance_plan.status == InheritanceStatus::Configured @ BsafeError::InheritanceAlreadyTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    #[account(
        constraint = beneficiary.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = beneficiary.status == BeneficiaryStatus::Active @ BsafeError::UnauthorizedBeneficiary,
        constraint = beneficiary.wallet == submitter.key() @ BsafeError::UnauthorizedBeneficiary
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(
        init,
        payer = submitter,
        space = DeathCertificateProof::LEN,
        seeds = [b"proof", inheritance_plan.key().as_ref()],
        bump
    )]
    pub proof: Account<'info, DeathCertificateProof>,

    #[account(mut)]
    pub submitter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn submit_death_certificate(ctx: Context<SubmitDeathCertificate>, document_hash: [u8; 32]) -> Result<()> {
    let plan = &mut ctx.accounts.inheritance_plan;
    let proof = &mut ctx.accounts.proof;
    let clock = Clock::get()?;

    // Initialize proof
    proof.inheritance_plan = plan.key();
    proof.document_hash = document_hash;
    proof.submitted_by = ctx.accounts.submitter.key();
    proof.submitted_at = clock.unix_timestamp;
    proof.verified = false;
    proof.verification_count = 0;
    proof.bump = ctx.bumps.proof;

    // Update plan status
    plan.status = InheritanceStatus::ProofSubmitted;

    msg!(
        "Death certificate proof submitted by {}. Hash: {:?}",
        ctx.accounts.submitter.key(),
        document_hash
    );

    Ok(())
}
