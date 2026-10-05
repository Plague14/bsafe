use anchor_lang::prelude::*;
use crate::state::{Vault, InheritancePlan, InheritanceStatus, TriggerType, VaultStatus};
use crate::errors::BsafeError;

/// Timer bounds. The `demo-timers` feature (devnet demo build only) shortens the minimums to
/// minutes so the whole inheritance flow can be shown live; the default build keeps days.
#[cfg(not(feature = "demo-timers"))]
pub const MIN_COOLDOWN_SECONDS: u64 = 24 * 60 * 60; // 1 day
#[cfg(feature = "demo-timers")]
pub const MIN_COOLDOWN_SECONDS: u64 = 60; // 1 minute
pub const MAX_COOLDOWN_SECONDS: u64 = 365 * 24 * 60 * 60; // 365 days

#[cfg(not(feature = "demo-timers"))]
pub const MIN_DEADMAN_SECONDS: u64 = 30 * 24 * 60 * 60; // 30 days
#[cfg(feature = "demo-timers")]
pub const MIN_DEADMAN_SECONDS: u64 = 2 * 60; // 2 minutes
pub const MAX_DEADMAN_SECONDS: u64 = 5 * 365 * 24 * 60 * 60; // 5 years

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

    // Validate cooldown (default: 1 day to 365 days)
    require!(
        cooldown_seconds >= MIN_COOLDOWN_SECONDS && cooldown_seconds <= MAX_COOLDOWN_SECONDS,
        BsafeError::InvalidCooldownPeriod
    );

    // Validate deadman switch (default: 30 days to 5 years)
    require!(
        deadman_switch_seconds >= MIN_DEADMAN_SECONDS && deadman_switch_seconds <= MAX_DEADMAN_SECONDS,
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
