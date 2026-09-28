use anchor_lang::prelude::*;
use crate::state::{
    Vault, VaultStatus, InheritancePlan, InheritanceStatus,
    DeathCertificateProof, TriggerType
};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct InitiateInheritance<'info> {
    #[account(
        mut,
        constraint = vault.key() == inheritance_plan.vault @ BsafeError::InvalidAccount
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    /// CHECK: Vault treasury PDA to get balance
    #[account(
        seeds = [b"vault_treasury", vault.key().as_ref()],
        bump
    )]
    pub vault_treasury: AccountInfo<'info>,

    /// Proof is optional - required for death certificate trigger, not for deadman switch
    pub proof: Option<Account<'info, DeathCertificateProof>>,

    pub initiator: Signer<'info>,
}

pub fn initiate_inheritance(ctx: Context<InitiateInheritance>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let plan = &mut ctx.accounts.inheritance_plan;
    let clock = Clock::get()?;

    // Ensure inheritance hasn't already been triggered
    require!(
        plan.status == InheritanceStatus::Configured ||
        plan.status == InheritanceStatus::ProofSubmitted,
        BsafeError::InheritanceAlreadyTriggered
    );

    let trigger_valid: bool;

    match plan.trigger_type {
        TriggerType::DeathCertificate => {
            // Require verified proof
            if let Some(proof) = &ctx.accounts.proof {
                require!(proof.verified, BsafeError::ProofNotVerified);
                trigger_valid = true;
            } else {
                return Err(BsafeError::ProofNotVerified.into());
            }
        }
        TriggerType::DeadmanSwitch => {
            // Check if owner has been inactive long enough
            let inactivity_duration = clock.unix_timestamp - vault.last_activity;
            require!(
                inactivity_duration >= plan.deadman_switch_seconds as i64,
                BsafeError::OwnerStillActive
            );
            trigger_valid = true;
        }
        TriggerType::Both => {
            // Either method works
            if let Some(proof) = &ctx.accounts.proof {
                if proof.verified {
                    trigger_valid = true;
                } else {
                    // Check deadman switch
                    let inactivity_duration = clock.unix_timestamp - vault.last_activity;
                    trigger_valid = inactivity_duration >= plan.deadman_switch_seconds as i64;
                }
            } else {
                // Check deadman switch
                let inactivity_duration = clock.unix_timestamp - vault.last_activity;
                require!(
                    inactivity_duration >= plan.deadman_switch_seconds as i64,
                    BsafeError::OwnerStillActive
                );
                trigger_valid = true;
            }
        }
    }

    require!(trigger_valid, BsafeError::InheritanceNotTriggered);

    // Snapshot the vault balance for distribution
    let treasury_balance = ctx.accounts.vault_treasury.lamports();

    // Update inheritance plan
    plan.status = InheritanceStatus::CooldownActive;
    plan.triggered_at = clock.unix_timestamp;
    plan.cooldown_ends_at = clock.unix_timestamp + plan.cooldown_seconds as i64;
    plan.distribution_amount = treasury_balance;

    // Lock the vault
    vault.status = VaultStatus::InheritanceInitiated;

    msg!(
        "Inheritance initiated. Cooldown ends at {}. Distribution amount: {} lamports",
        plan.cooldown_ends_at,
        plan.distribution_amount
    );

    Ok(())
}
