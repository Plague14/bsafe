use anchor_lang::prelude::*;
use crate::state::{Vault, VaultStatus, InheritancePlan, InheritanceStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct CancelInheritance<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.key() == inheritance_plan.vault @ BsafeError::InvalidAccount
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = inheritance_plan.status == InheritanceStatus::CooldownActive
            @ BsafeError::InheritanceNotTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    /// CHECK: Death certificate proof PDA (may not exist). If present it is closed, so a
    /// certificate the owner refuted by cancelling can't be reused to re-trigger inheritance.
    #[account(
        mut,
        seeds = [b"proof", inheritance_plan.key().as_ref()],
        bump
    )]
    pub proof: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn cancel_inheritance(ctx: Context<CancelInheritance>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let plan = &mut ctx.accounts.inheritance_plan;
    let clock = Clock::get()?;

    // Can only cancel during cooldown period
    require!(
        clock.unix_timestamp < plan.cooldown_ends_at,
        BsafeError::CooldownEnded
    );

    // Invalidate the death certificate (rent goes to the owner)
    let proof = ctx.accounts.proof.to_account_info();
    if proof.owner == ctx.program_id && proof.lamports() > 0 {
        let owner = ctx.accounts.owner.to_account_info();
        **owner.try_borrow_mut_lamports()? += proof.lamports();
        **proof.try_borrow_mut_lamports()? = 0;
        proof.assign(&anchor_lang::system_program::ID);
        proof.realloc(0, false)?;
    }

    // Reset inheritance plan
    plan.status = InheritanceStatus::Cancelled;
    plan.triggered_at = 0;
    plan.cooldown_ends_at = 0;
    plan.distribution_amount = 0;
    plan.current_verifications = 0;

    // Reactivate vault
    vault.status = VaultStatus::Active;
    vault.update_activity();

    msg!(
        "Inheritance cancelled by owner {}. Vault reactivated.",
        ctx.accounts.owner.key()
    );

    Ok(())
}

/// Reset a cancelled inheritance plan to allow reconfiguration
#[derive(Accounts)]
pub struct ResetInheritancePlan<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = inheritance_plan.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = inheritance_plan.status == InheritanceStatus::Cancelled
            @ BsafeError::InheritanceAlreadyTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    pub owner: Signer<'info>,
}

pub fn reset_handler(ctx: Context<ResetInheritancePlan>) -> Result<()> {
    let plan = &mut ctx.accounts.inheritance_plan;
    let vault = &mut ctx.accounts.vault;

    // Reset to configured state
    plan.status = InheritanceStatus::Configured;
    vault.update_activity();

    msg!("Inheritance plan reset to configured state");

    Ok(())
}
