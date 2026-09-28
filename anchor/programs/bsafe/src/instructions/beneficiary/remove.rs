use anchor_lang::prelude::*;
use crate::state::{Vault, Beneficiary, BeneficiaryStatus, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct RemoveBeneficiary<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = beneficiary.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = beneficiary.status == BeneficiaryStatus::Active @ BsafeError::BeneficiaryNotFound,
        close = owner
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn remove_beneficiary(ctx: Context<RemoveBeneficiary>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let beneficiary = &ctx.accounts.beneficiary;

    msg!("Removing beneficiary {} ({}% share)", beneficiary.wallet, beneficiary.share_bps as f64 / 100.0);

    // Update vault count and total shares
    vault.beneficiary_count = vault.beneficiary_count.saturating_sub(1);
    vault.total_share_bps = vault.total_share_bps.saturating_sub(beneficiary.share_bps);
    vault.update_activity();

    // Account will be closed automatically via the close constraint

    Ok(())
}
