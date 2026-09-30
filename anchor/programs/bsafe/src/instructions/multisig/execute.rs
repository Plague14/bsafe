use anchor_lang::prelude::*;
use crate::state::{
    Vault, VaultStatus, MultisigTransaction, TransactionStatus, TransactionType
};
use crate::errors::BsafeError;
use crate::utils::transfer_from_vault_treasury;

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(
        mut,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = transaction.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = transaction.status == TransactionStatus::Approved @ BsafeError::ThresholdNotReached
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    /// CHECK: Vault treasury PDA
    #[account(
        mut,
        seeds = [b"vault_treasury", vault.key().as_ref()],
        bump
    )]
    pub vault_treasury: AccountInfo<'info>,

    /// CHECK: Destination for withdrawals
    #[account(mut)]
    pub destination: AccountInfo<'info>,

    pub executor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let transaction = &mut ctx.accounts.transaction;
    let clock = Clock::get()?;

    // Verify threshold is met
    require!(transaction.is_threshold_reached(), BsafeError::ThresholdNotReached);

    match transaction.tx_type {
        TransactionType::Withdrawal => {
            let amount = transaction.amount;

            // Verify destination matches
            require!(
                ctx.accounts.destination.key() == transaction.destination,
                BsafeError::InvalidAccount
            );

            // Verify balance
            require!(vault.balance >= amount, BsafeError::InsufficientFunds);

            // Transfer SOL
            transfer_from_vault_treasury(
                &ctx.accounts.vault_treasury,
                &ctx.accounts.destination,
                &ctx.accounts.system_program.to_account_info(),
                &vault.key(),
                ctx.bumps.vault_treasury,
                amount,
            )?;

            // Update vault balance
            vault.balance = vault.balance.saturating_sub(amount);

            msg!("Executed withdrawal of {} lamports to {}", amount, transaction.destination);
        }
        TransactionType::UpdateThreshold => {
            // Extract new threshold from data
            let new_threshold = transaction.data[0];
            require!(
                new_threshold >= 1 && new_threshold <= vault.signer_count,
                BsafeError::InvalidThreshold
            );
            vault.multisig_threshold = new_threshold;

            msg!("Updated threshold to {}", new_threshold);
        }
        _ => {
            // Other transaction types (AddBeneficiary, etc.) would be handled here
            // For MVP, we focus on Withdrawal
            msg!("Executed transaction type: {:?}", transaction.tx_type);
        }
    }

    // Mark as executed
    transaction.status = TransactionStatus::Executed;
    transaction.executed_at = clock.unix_timestamp;

    vault.update_activity();

    Ok(())
}
