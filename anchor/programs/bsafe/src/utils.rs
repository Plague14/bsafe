use anchor_lang::prelude::*;
use anchor_lang::system_program;

/// Transfer lamports out of a vault treasury PDA.
///
/// The treasury is a data-less PDA owned by the System Program (it only ever
/// receives SOL via `system_program::transfer` in `deposit`), so the program
/// cannot debit its lamports directly — it must CPI into the System Program
/// and sign with the PDA seeds.
pub fn transfer_from_vault_treasury<'info>(
    vault_treasury: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    vault_key: &Pubkey,
    treasury_bump: u8,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[b"vault_treasury", vault_key.as_ref(), &[treasury_bump]];
    let signer_seeds = &[seeds];

    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            system_program::Transfer {
                from: vault_treasury.clone(),
                to: to.clone(),
            },
            signer_seeds,
        ),
        amount,
    )
}

/// Convert a string to a fixed-size byte array for vault names
pub fn string_to_bytes32(s: &str) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    let s_bytes = s.as_bytes();
    let len = std::cmp::min(s_bytes.len(), 32);
    bytes[..len].copy_from_slice(&s_bytes[..len]);
    bytes
}

/// Convert a fixed-size byte array back to a string
pub fn bytes32_to_string(bytes: &[u8; 32]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(32);
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

/// Calculate basis points from percentage
/// e.g., 50.5% -> 5050 bps
pub fn percent_to_bps(percent: f64) -> u16 {
    (percent * 100.0) as u16
}

/// Calculate percentage from basis points
/// e.g., 5050 bps -> 50.5%
pub fn bps_to_percent(bps: u16) -> f64 {
    bps as f64 / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_conversion() {
        let name = "My Vault";
        let bytes = string_to_bytes32(name);
        let result = bytes32_to_string(&bytes);
        assert_eq!(result, name);
    }

    #[test]
    fn test_bps_conversion() {
        assert_eq!(percent_to_bps(100.0), 10000);
        assert_eq!(percent_to_bps(50.0), 5000);
        assert_eq!(percent_to_bps(33.33), 3333);

        assert_eq!(bps_to_percent(10000), 100.0);
        assert_eq!(bps_to_percent(5000), 50.0);
    }
}
