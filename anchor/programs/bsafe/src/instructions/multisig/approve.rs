use anchor_lang::prelude::*;
use crate::state::{
    Vault, VaultStatus, MultisigSigner, MultisigTransaction, TransactionStatus
};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    #[account(
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        constraint = signer_account.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = signer_account.is_active @ BsafeError::UnauthorizedSigner,
        constraint = signer_account.signer == approver.key() @ BsafeError::UnauthorizedSigner
    )]
    pub signer_account: Account<'info, MultisigSigner>,

    #[account(
        mut,
        constraint = transaction.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = transaction.status == TransactionStatus::Pending @ BsafeError::AlreadyExecuted
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    pub approver: Signer<'info>,
}

pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
    let signer = &ctx.accounts.signer_account;
    let transaction = &mut ctx.accounts.transaction;

    // Check if already approved by this signer
    require!(
        !transaction.has_approved(signer.index),
        BsafeError::AlreadyApproved
    );

    // Add approval
    transaction.add_approval(signer.index);

    msg!(
        "Transaction approved by {}. Approvals: {}/{}",
        ctx.accounts.approver.key(),
        transaction.approval_count,
        transaction.threshold
    );

    // Check if threshold reached
    if transaction.is_threshold_reached() {
        transaction.status = TransactionStatus::Approved;
        msg!("Transaction threshold reached! Ready for execution.");
    }

    Ok(())
}

#[derive(Accounts)]
pub struct RejectTransaction<'info> {
    #[account(
        has_one = owner @ BsafeError::UnauthorizedOwner
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = transaction.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = transaction.status == TransactionStatus::Pending @ BsafeError::AlreadyExecuted
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    pub owner: Signer<'info>,
}

pub fn reject_handler(ctx: Context<RejectTransaction>) -> Result<()> {
    let transaction = &mut ctx.accounts.transaction;

    transaction.status = TransactionStatus::Cancelled;

    msg!("Transaction cancelled by owner");

    Ok(())
}
