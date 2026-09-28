use anchor_lang::prelude::*;
use crate::state::{Vault, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
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
    pub owner: Signer<'info>,

    /// CHECK: Destination account for withdrawal
    #[account(mut)]
    pub destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(amount > 0, BsafeError::InsufficientFunds);
    require!(vault.balance >= amount, BsafeError::InsufficientFunds);

    // For simple withdrawals without multisig, owner can withdraw directly
    // If multisig is enabled, this should go through propose/approve flow
    require!(!vault.multisig_enabled || vault.multisig_threshold == 1,
        BsafeError::ThresholdNotReached);

    // Transfer SOL from vault treasury PDA
    let vault_key = vault.key();
    let seeds = &[
        b"vault_treasury",
        vault_key.as_ref(),
        &[ctx.bumps.vault_treasury],
    ];
    let signer_seeds = &[&seeds[..]];

    **ctx.accounts.vault_treasury.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.destination.try_borrow_mut_lamports()? += amount;

    // Update vault balance tracking
    vault.balance = vault.balance.checked_sub(amount)
        .ok_or(BsafeError::ArithmeticOverflow)?;
    vault.update_activity();

    msg!("Withdrew {} lamports from vault", amount);

    Ok(())
}
