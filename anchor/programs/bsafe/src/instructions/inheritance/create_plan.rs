use anchor_lang::prelude::*;
use crate::state::{Vault, InheritancePlan, InheritanceStatus, TriggerType, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct CreateInheritancePlan<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = InheritancePlan::LEN,
        seeds = [b"inheritance", vault.key().as_ref()],
        bump
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_inheritance_plan(
    ctx: Context<CreateInheritancePlan>,
    trigger_type: TriggerType,
    cooldown_seconds: u64,
    deadman_switch_seconds: u64,
    required_verifications: u8,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let plan = &mut ctx.accounts.inheritance_plan;
    let clock = Clock::get()?;

    // Validate that at least one beneficiary exists
    require!(
        vault.beneficiary_count > 0,
        BsafeError::BeneficiaryNotFound
    );

    // Validate that all beneficiary shares sum to exactly 100% (10000 bps)
    require!(
        vault.total_share_bps == 10000,
        BsafeError::InvalidShareSum
    );

    // Validate cooldown (minimum 1 day, maximum 365 days)
    require!(
        cooldown_seconds >= 86400 && cooldown_seconds <= 31536000,
        BsafeError::InvalidCooldownPeriod
    );

    // Validate deadman switch (minimum 30 days, maximum 5 years)
    let min_deadman = 30 * 24 * 60 * 60; // 30 days
    let max_deadman = 5 * 365 * 24 * 60 * 60; // 5 years
    require!(
        deadman_switch_seconds >= min_deadman && deadman_switch_seconds <= max_deadman,
        BsafeError::InvalidCooldownPeriod
    );

    // Require at least 1 verification, max 10
    require!(
        required_verifications >= 1 && required_verifications <= 10,
        BsafeError::InsufficientVerifications
    );

    plan.vault = vault.key();
    plan.status = InheritanceStatus::Configured;
    plan.trigger_type = trigger_type;
    plan.cooldown_seconds = cooldown_seconds;
    plan.deadman_switch_seconds = deadman_switch_seconds;
    plan.triggered_at = 0;
    plan.cooldown_ends_at = 0;
    plan.distribution_amount = 0;
    plan.required_verifications = required_verifications;
    plan.current_verifications = 0;
    plan.created_at = clock.unix_timestamp;
    plan.bump = ctx.bumps.inheritance_plan;

    vault.update_activity();

    msg!("Inheritance plan created for vault {} with {} beneficiaries totaling 100% share",
         vault.key(), vault.beneficiary_count);

    Ok(())
}
