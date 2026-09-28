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

    pub owner: Signer<'info>,
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
