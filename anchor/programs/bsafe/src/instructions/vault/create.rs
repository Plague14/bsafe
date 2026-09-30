use anchor_lang::prelude::*;
use crate::state::{Vault, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
#[instruction(name: [u8; 32])]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [b"vault", owner.key().as_ref(), &name],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_vault(ctx: Context<CreateVault>, name: [u8; 32]) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    // Validate name is not empty
    require!(name.iter().any(|&b| b != 0), BsafeError::InvalidVaultName);

    vault.owner = ctx.accounts.owner.key();
    vault.name = name;
    vault.status = VaultStatus::Active;
    vault.balance = 0;
    vault.beneficiary_count = 0;
    vault.multisig_enabled = false;
    vault.multisig_threshold = 1;
    // Counts MultisigSigner accounts only; the owner joins by adding their own wallet
    vault.signer_count = 0;
    vault.last_activity = clock.unix_timestamp;
    vault.created_at = clock.unix_timestamp;
    vault.bump = ctx.bumps.vault;

    msg!("Vault created: {:?}", vault.key());

    Ok(())
}
