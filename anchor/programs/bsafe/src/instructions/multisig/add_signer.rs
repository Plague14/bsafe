use anchor_lang::prelude::*;
use crate::state::{Vault, VaultStatus, MultisigSigner};
use crate::errors::BsafeError;

pub const MAX_SIGNERS: u8 = 10;

#[derive(Accounts)]
#[instruction(new_signer: Pubkey)]
pub struct AddSigner<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = MultisigSigner::LEN,
        seeds = [b"signer", vault.key().as_ref(), new_signer.as_ref()],
        bump
    )]
    pub signer_account: Account<'info, MultisigSigner>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn add_signer(ctx: Context<AddSigner>, new_signer: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let signer_account = &mut ctx.accounts.signer_account;
    let clock = Clock::get()?;

    require!(vault.signer_count < MAX_SIGNERS, BsafeError::MaxSignersReached);

    // Initialize signer account
    signer_account.vault = vault.key();
    signer_account.signer = new_signer;
    signer_account.index = vault.signer_count;
    signer_account.is_active = true;
    signer_account.added_at = clock.unix_timestamp;
    signer_account.bump = ctx.bumps.signer_account;

    // Update vault
    vault.signer_count += 1;
    if !vault.multisig_enabled && vault.signer_count > 1 {
        vault.multisig_enabled = true;
        vault.multisig_threshold = 2; // Default to requiring 2 signatures
    }
    vault.update_activity();

    msg!("Added signer {}. Total signers: {}", new_signer, vault.signer_count);

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateThreshold<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive,
        constraint = vault.multisig_enabled @ BsafeError::InvalidThreshold
    )]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

pub fn update_threshold_handler(ctx: Context<UpdateThreshold>, new_threshold: u8) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(
        new_threshold >= 1 && new_threshold <= vault.signer_count,
        BsafeError::InvalidThreshold
    );

    vault.multisig_threshold = new_threshold;
    vault.update_activity();

    msg!("Updated threshold to {} of {} signers", new_threshold, vault.signer_count);

    Ok(())
}
