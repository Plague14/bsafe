use anchor_lang::prelude::*;
use crate::state::{Vault, Beneficiary, BeneficiaryStatus, VaultStatus};
use crate::errors::BsafeError;

#[derive(Accounts)]
pub struct UpdateShares<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = beneficiary.vault == vault.key() @ BsafeError::InvalidAccount,
        constraint = beneficiary.status == BeneficiaryStatus::Active @ BsafeError::BeneficiaryNotFound
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    pub owner: Signer<'info>,
}

pub fn update_shares(ctx: Context<UpdateShares>, new_share_bps: u16) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let beneficiary = &mut ctx.accounts.beneficiary;

    require!(new_share_bps > 0 && new_share_bps <= 10000, BsafeError::InvalidSharePercentage);

    let old_share = beneficiary.share_bps;

    // Calculate new total: subtract old share, add new share
    let new_total = vault.total_share_bps
        .checked_sub(old_share)
        .ok_or(BsafeError::ArithmeticOverflow)?
        .checked_add(new_share_bps)
        .ok_or(BsafeError::ArithmeticOverflow)?;

    // Validate new total doesn't exceed 100%
    require!(new_total <= 10000, BsafeError::InvalidShareSum);

    // Update beneficiary share
    beneficiary.share_bps = new_share_bps;

    // Update vault total
    vault.total_share_bps = new_total;
    vault.update_activity();

    msg!(
        "Updated beneficiary {} share: {}% -> {}% (total: {}%)",
        beneficiary.wallet,
        old_share as f64 / 100.0,
        new_share_bps as f64 / 100.0,
        new_total as f64 / 100.0
    );

    Ok(())
}

/// Validate that all beneficiary shares sum to 100% (10000 bps)
/// This is called client-side or via a separate instruction
pub fn validate_shares_sum(shares: &[u16]) -> Result<()> {
    let total: u32 = shares.iter().map(|&s| s as u32).sum();
    require!(total == 10000, BsafeError::InvalidShareSum);
    Ok(())
}
