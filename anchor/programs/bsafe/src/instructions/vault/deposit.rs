use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Vault, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: This is the vault's PDA that holds the SOL
    #[account(
        mut,
        seeds = [b"vault_treasury", vault.key().as_ref()],
        bump
    )]
    pub vault_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, BsafeError::InsufficientFunds);

    let vault = &mut ctx.accounts.vault;

    // Transfer SOL to vault treasury PDA
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.vault_treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;

    // Update vault balance tracking
    vault.balance = vault.balance.checked_add(amount)
        .ok_or(BsafeError::ArithmeticOverflow)?;
    vault.update_activity();

    msg!("Deposited {} lamports to vault", amount);

    Ok(())
}
