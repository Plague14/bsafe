use anchor_lang::prelude::*;
use crate::state::{
    Vault, VaultStatus, MultisigSigner, MultisigTransaction,
    TransactionStatus, TransactionType
};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct ProposeTransaction<'info> {
    #[account(
        mut,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive,
        constraint = vault.multisig_enabled @ BsafeError::InvalidThreshold
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = signer_account.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = signer_account.is_active @ BsafeError::UnauthorizedSigner,
        constraint = signer_account.signer == proposer.key() @ BsafeError::UnauthorizedSigner
    )]
    pub signer_account: Account<'info, MultisigSigner>,

    #[account(
        init,
        payer = proposer,
        space = MultisigTransaction::LEN,
        seeds = [
            b"multisig_tx",
            vault.key().as_ref(),
            &(vault.balance + 1).to_le_bytes() // Use balance+1 as a simple nonce
        ],
        bump
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn propose_transaction(
    ctx: Context<ProposeTransaction>,
    tx_type: TransactionType,
    amount: u64,
    destination: Pubkey,
    data: [u8; 32],
) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let signer = &ctx.accounts.signer_account;
    let transaction = &mut ctx.accounts.transaction;
    let clock = Clock::get()?;

    // For withdrawals, validate amount
    if tx_type == TransactionType::Withdrawal {
        require!(amount > 0, BsafeError::InsufficientFunds);
        require!(amount <= vault.balance, BsafeError::InsufficientFunds);
    }

    // Initialize transaction
    transaction.vault = vault.key();
    transaction.seq_number = clock.unix_timestamp as u64; // Simple sequence
    transaction.tx_type = tx_type;
    transaction.status = TransactionStatus::Pending;
    transaction.amount = amount;
    transaction.destination = destination;
    transaction.data = data;
    transaction.proposer = ctx.accounts.proposer.key();
    transaction.threshold = vault.multisig_threshold;
    transaction.approval_count = 1; // Proposer automatically approves
    transaction.approvals = 1u64 << signer.index; // Mark proposer as approved
    transaction.proposed_at = clock.unix_timestamp;
    transaction.executed_at = 0;
    transaction.bump = ctx.bumps.transaction;

    msg!(
        "Transaction proposed by {}. Type: {:?}. Requires {} approvals.",
        ctx.accounts.proposer.key(),
        tx_type,
        vault.multisig_threshold
    );

    Ok(())
}
