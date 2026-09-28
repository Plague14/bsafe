use anchor_lang::prelude::*;
use crate::state::BsafeTreasury;

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = BsafeTreasury::LEN,
        seeds = [b"bsafe_treasury"],
        bump
    )]
    pub treasury: Account<'info, BsafeTreasury>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize the BSafe treasury (one-time setup by admin)
pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;

    treasury.authority = ctx.accounts.authority.key();
    treasury.total_collected = 0;
    treasury.total_withdrawn = 0;
    treasury.bump = ctx.bumps.treasury;

    msg!("BSafe treasury initialized with authority {}", treasury.authority);

    Ok(())
}
