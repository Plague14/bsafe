use anchor_lang::prelude::*;
use crate::state::{
    Vault, VaultStatus, InheritancePlan, InheritanceStatus,
    Beneficiary, BeneficiaryStatus, Membership
};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct ClaimInheritance<'info> {
    #[account(
        mut,
        constraint = vault.key() == inheritance_plan.vault @ BsafeError::InvalidAccount,
        constraint = vault.status == VaultStatus::InheritanceInitiated @ BsafeError::InheritanceNotTriggered
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = inheritance_plan.status == InheritanceStatus::CooldownActive ||
                     inheritance_plan.status == InheritanceStatus::ClaimReady
            @ BsafeError::InheritanceNotTriggered
    )]
    pub inheritance_plan: Account<'info, InheritancePlan>,

    #[account(
        mut,
        constraint = beneficiary.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = beneficiary.status == BeneficiaryStatus::Active @ BsafeError::AlreadyClaimed,
        constraint = beneficiary.wallet == claimer.key() @ BsafeError::UnauthorizedBeneficiary
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// CHECK: Vault treasury PDA
    #[account(
        mut,
        seeds = [b"vault_treasury", vault.key().as_ref()],
        bump
    )]
    pub vault_treasury: AccountInfo<'info>,

    /// Membership account of the vault owner (optional - if not provided, assume Free tier)
    #[account(
        seeds = [b"membership", vault.owner.as_ref()],
        bump = membership.bump
    )]
    pub membership: Option<Account<'info, Membership>>,

    /// CHECK: BSafe treasury PDA to receive fees
    #[account(
        mut,
        seeds = [b"bsafe_treasury"],
        bump
    )]
    pub bsafe_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let plan = &mut ctx.accounts.inheritance_plan;
    let beneficiary = &mut ctx.accounts.beneficiary;
    let clock = Clock::get()?;

    // Check cooldown has ended
    require!(
        clock.unix_timestamp >= plan.cooldown_ends_at,
        BsafeError::CooldownNotComplete
    );

    // Update status if this is the first claim after cooldown
    if plan.status == InheritanceStatus::CooldownActive {
        plan.status = InheritanceStatus::ClaimReady;
    }

    // Calculate claim amount
    let gross_claim_amount = beneficiary.calculate_share(plan.distribution_amount);

    require!(gross_claim_amount > 0, BsafeError::InsufficientFunds);

    // Ensure vault has enough balance
    let treasury_balance = ctx.accounts.vault_treasury.lamports();
    require!(treasury_balance >= gross_claim_amount, BsafeError::InsufficientFunds);

    // Calculate fee based on membership tier
    let fee_bps = match &ctx.accounts.membership {
        Some(membership) => {
            // Check if membership is still valid (not expired)
            if membership.expires_at > 0 && clock.unix_timestamp > membership.expires_at {
                // Expired membership - use Free tier fee
                100u16 // 1%
            } else {
                membership.tier.claim_fee_bps()
            }
        },
        None => {
            // No membership account - use Free tier fee (1%)
            100u16
        }
    };

    // Calculate fee and net amounts
    let fee_amount = (gross_claim_amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(BsafeError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(BsafeError::ArithmeticOverflow)? as u64;

    let net_claim_amount = gross_claim_amount
        .checked_sub(fee_amount)
        .ok_or(BsafeError::ArithmeticOverflow)?;

    // Transfer fee to BSafe treasury (if any)
    if fee_amount > 0 {
        **ctx.accounts.vault_treasury.try_borrow_mut_lamports()? -= fee_amount;
        **ctx.accounts.bsafe_treasury.try_borrow_mut_lamports()? += fee_amount;

        msg!("BSafe fee collected: {} lamports ({}%)", fee_amount, fee_bps as f64 / 100.0);
    }

    // Transfer net funds to claimer
    **ctx.accounts.vault_treasury.try_borrow_mut_lamports()? -= net_claim_amount;
    **ctx.accounts.claimer.try_borrow_mut_lamports()? += net_claim_amount;

    // Mark beneficiary as claimed
    beneficiary.status = BeneficiaryStatus::Claimed;
    beneficiary.claimed_amount = net_claim_amount;

    // Update vault balance
    vault.balance = vault.balance.saturating_sub(gross_claim_amount);

    // Check if all beneficiaries have claimed
    // Note: In a real implementation, we'd track this more carefully
    if vault.balance == 0 || ctx.accounts.vault_treasury.lamports() == 0 {
        plan.status = InheritanceStatus::Completed;
        vault.status = VaultStatus::InheritanceCompleted;
    }

    msg!(
        "Beneficiary {} claimed {} lamports net ({}% share, {} fee)",
        ctx.accounts.claimer.key(),
        net_claim_amount,
        beneficiary.share_bps as f64 / 100.0,
        fee_amount
    );

    Ok(())
}
