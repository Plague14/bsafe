use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Membership, MembershipTier, BsafeTreasury};
use crate::errors::BsafeError;

#[derive(Accounts)]
#[instruction(target_tier: MembershipTier)]
pub struct UpgradeMembership<'info> {
    #[account(
        mut,
        seeds = [b"membership", owner.key().as_ref()],
        bump = membership.bump,
        has_one = owner @ BsafeError::UnauthorizedOwner
    )]
    pub membership: Account<'info, Membership>,

    /// CHECK: BSafe treasury PDA to receive payment
    #[account(
        mut,
        seeds = [b"bsafe_treasury"],
        bump
    )]
    pub bsafe_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Upgrade membership to a higher tier
pub fn upgrade_membership(
    ctx: Context<UpgradeMembership>,
    target_tier: MembershipTier,
) -> Result<()> {
    let membership = &mut ctx.accounts.membership;
    let clock = Clock::get()?;

    // Validate upgrade path
    require!(
        target_tier != MembershipTier::Free,
        BsafeError::InvalidUpgrade
    );

    // Check current tier allows upgrade
    let current_tier_level = match membership.effective_tier() {
        MembershipTier::Free => 0,
        MembershipTier::Premium => 1,
        MembershipTier::Concierge => 2,
    };

    let target_tier_level = match target_tier {
        MembershipTier::Free => 0,
        MembershipTier::Premium => 1,
        MembershipTier::Concierge => 2,
    };

    require!(
        target_tier_level > current_tier_level,
        BsafeError::InvalidUpgrade
    );

    // Calculate payment amount
    let payment_amount = target_tier.upgrade_price_lamports();

    // Transfer payment to BSafe treasury
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.bsafe_treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, payment_amount)?;

    // Update membership
    membership.tier = target_tier;
    membership.total_paid = membership.total_paid.checked_add(payment_amount)
        .ok_or(BsafeError::ArithmeticOverflow)?;

    // Set expiration for Concierge (1 year)
    if target_tier == MembershipTier::Concierge {
        membership.expires_at = clock.unix_timestamp + (365 * 24 * 60 * 60);
    } else {
        membership.expires_at = 0; // Premium never expires (one-time payment)
    }

    msg!(
        "Membership upgraded to {:?} for {} SOL",
        target_tier,
        payment_amount as f64 / 1_000_000_000.0
    );

    Ok(())
}
