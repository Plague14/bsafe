use anchor_lang::prelude::*;
use crate::state::{Membership, MembershipTier};

#[derive(Accounts)]
pub struct CreateMembership<'info> {
    #[account(
        init,
        payer = owner,
        space = Membership::LEN,
        seeds = [b"membership", owner.key().as_ref()],
        bump
    )]
    pub membership: Account<'info, Membership>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Create a new membership account (Free tier by default)
pub fn create_membership(ctx: Context<CreateMembership>) -> Result<()> {
    let membership = &mut ctx.accounts.membership;
    let clock = Clock::get()?;

    membership.owner = ctx.accounts.owner.key();
    membership.tier = MembershipTier::Free;
    membership.vault_count = 0;
    membership.created_at = clock.unix_timestamp;
    membership.expires_at = 0; // Never expires for Free
    membership.total_paid = 0;
    membership.bump = ctx.bumps.membership;

    msg!("Membership created for {}", ctx.accounts.owner.key());

    Ok(())
}
