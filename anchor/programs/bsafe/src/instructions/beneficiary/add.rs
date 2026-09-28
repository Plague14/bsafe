use anchor_lang::prelude::*;
use crate::state::{Vault, Beneficiary, BeneficiaryStatus, VaultStatus};
use crate::errors::BsafeError;

pub const MAX_BENEFICIARIES: u8 = 10;

#[derive(Accounts)]
#[instruction(wallet: Pubkey, share_bps: u16)]
pub struct AddBeneficiary<'info> {
    #[account(
        mut,
        has_one = owner @ BsafeError::UnauthorizedOwner,
        constraint = vault.status == VaultStatus::Active @ BsafeError::VaultNotActive
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = Beneficiary::LEN,
        seeds = [b"beneficiary", vault.key().as_ref(), wallet.as_ref()],
        bump
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn add_beneficiary(ctx: Context<AddBeneficiary>, wallet: Pubkey, share_bps: u16) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let beneficiary = &mut ctx.accounts.beneficiary;
    let clock = Clock::get()?;

    // Validate constraints
    require!(vault.beneficiary_count < MAX_BENEFICIARIES, BsafeError::MaxBeneficiariesReached);
    require!(share_bps > 0 && share_bps <= 10000, BsafeError::InvalidSharePercentage);

    // Validate that adding this share won't exceed 100%
    let new_total = vault.total_share_bps.checked_add(share_bps)
        .ok_or(BsafeError::ArithmeticOverflow)?;
    require!(new_total <= 10000, BsafeError::InvalidShareSum);

    // Initialize beneficiary
    beneficiary.vault = vault.key();
    beneficiary.wallet = wallet;
    beneficiary.share_bps = share_bps;
    beneficiary.status = BeneficiaryStatus::Active;
    beneficiary.index = vault.beneficiary_count;
    beneficiary.claimed_amount = 0;
    beneficiary.added_at = clock.unix_timestamp;
    beneficiary.bump = ctx.bumps.beneficiary;

    // Update vault
    vault.beneficiary_count += 1;
    vault.total_share_bps = new_total;
    vault.update_activity();

    msg!("Added beneficiary {} with {}% share (total: {}%)",
         wallet, share_bps as f64 / 100.0, new_total as f64 / 100.0);

    Ok(())
}
