import { translate, type Lang } from '../i18n';

// Program error messages, generated from anchor/target/idl/bsafe.json (43 errors).

export const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Vault is not active", // VaultNotActive
  6001: "Vault is locked", // VaultLocked
  6002: "Insufficient funds in vault", // InsufficientFunds
  6003: "Invalid vault name", // InvalidVaultName
  6004: "Unauthorized: only owner can perform this action", // UnauthorizedOwner
  6005: "Unauthorized: signer not in multisig", // UnauthorizedSigner
  6006: "Unauthorized: not a valid beneficiary", // UnauthorizedBeneficiary
  6007: "Unauthorized: not a valid verifier", // UnauthorizedVerifier
  6008: "Maximum beneficiaries reached", // MaxBeneficiariesReached
  6009: "Beneficiary already exists", // BeneficiaryAlreadyExists
  6010: "Beneficiary not found", // BeneficiaryNotFound
  6011: "Share percentages must sum to 100%", // InvalidShareSum
  6012: "Share percentage out of range (0-10000)", // InvalidSharePercentage
  6013: "Beneficiary has already claimed", // AlreadyClaimed
  6014: "Maximum signers reached", // MaxSignersReached
  6015: "Signer already exists", // SignerAlreadyExists
  6016: "Signer not found", // SignerNotFound
  6017: "Invalid threshold: must be >= 1 and <= signer count", // InvalidThreshold
  6018: "Transaction already approved by this signer", // AlreadyApproved
  6019: "Transaction threshold not reached", // ThresholdNotReached
  6020: "Transaction already executed", // AlreadyExecuted
  6021: "Transaction cancelled", // TransactionCancelled
  6022: "Cannot remove owner from signers", // CannotRemoveOwner
  6023: "Inheritance plan already exists", // InheritancePlanExists
  6024: "Inheritance not configured", // InheritanceNotConfigured
  6025: "Inheritance already triggered", // InheritanceAlreadyTriggered
  6026: "Inheritance not triggered", // InheritanceNotTriggered
  6027: "Cooldown period not complete", // CooldownNotComplete
  6028: "Cooldown period has ended, cannot cancel", // CooldownEnded
  6029: "Invalid cooldown period", // InvalidCooldownPeriod
  6030: "Proof already submitted", // ProofAlreadySubmitted
  6031: "Proof not verified", // ProofNotVerified
  6032: "Verifier already verified", // AlreadyVerified
  6033: "Insufficient verifications", // InsufficientVerifications
  6034: "Deadman switch not triggered", // DeadmanSwitchNotTriggered
  6035: "Owner is still active", // OwnerStillActive
  6036: "Arithmetic overflow", // ArithmeticOverflow
  6037: "Invalid account", // InvalidAccount
  6038: "Account not initialized", // AccountNotInitialized
  6039: "Invalid upgrade: cannot upgrade to lower or same tier", // InvalidUpgrade
  6040: "Maximum vaults reached for this membership tier", // MaxVaultsReached
  6041: "Membership has expired", // MembershipExpired
  6042: "Membership not found", // MembershipNotFound
};

/** Turns a wallet/RPC error into a readable message, decoding BSafe custom error codes. */
export function describeError(err: unknown, fallback: string, lang: Lang = 'en'): string {
  const text = err instanceof Error ? err.message : String(err ?? '');
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) {
    const code = parseInt(hex[1], 16);
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  }
  if (/429|Too many requests/i.test(text)) return translate(lang, 'errors.rateLimited');
  if (/User rejected/i.test(text)) return translate(lang, 'errors.userRejected');
  if (/insufficient (funds|lamports)/i.test(text)) return translate(lang, 'errors.insufficientFunds');
  return text || fallback;
}
