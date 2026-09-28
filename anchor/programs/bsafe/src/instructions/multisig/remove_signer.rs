use anchor_lang::prelude::*;
use crate::state::{Vault, VaultStatus, MultisigSigner};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct RemoveSigner<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = signer_account.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = signer_account.is_active @ BsafeError::SignerNotFound,
        constraint = signer_account.signer != vault.owner @ BsafeError::CannotRemoveOwner,
        close = owner
    )]
    pub signer_account: Account<'info, MultisigSigner>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn remove_signer(ctx: Context<RemoveSigner>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let signer = &ctx.accounts.signer_account;

    msg!("Removing signer {}", signer.signer);

    // Update vault
    vault.signer_count = vault.signer_count.saturating_sub(1);

    // Adjust threshold if necessary
    if vault.multisig_threshold > vault.signer_count {
        vault.multisig_threshold = vault.signer_count;
    }

    // Disable multisig if only owner remains
    if vault.signer_count <= 1 {
        vault.multisig_enabled = false;
        vault.multisig_threshold = 1;
    }

    vault.update_activity();

    // Account will be closed via close constraint

    Ok(())
}
