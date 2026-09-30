//! LiteSVM harness for the BSafe program.
//!
//! Loads the compiled `target/deploy/bsafe.so` and builds Anchor instructions by hand
//! (discriminator + borsh args), so tests exercise the exact binary that gets deployed.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_address::Address;
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;
use std::str::FromStr;

pub type Pubkey = Address;

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const DAY: i64 = 24 * 60 * 60;

pub fn program_id() -> Pubkey {
    Pubkey::from_str("3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv").unwrap()
}

pub fn system_program() -> Pubkey {
    Pubkey::default()
}

// ---------------------------------------------------------------- enums (borsh u8)

#[derive(Clone, Copy)]
#[repr(u8)]
pub enum TriggerType {
    DeathCertificate = 0,
    DeadmanSwitch = 1,
    Both = 2,
}

#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u8)]
pub enum VaultStatus {
    Active = 0,
    Locked = 1,
    InheritanceInitiated = 2,
    InheritanceCompleted = 3,
}

#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u8)]
pub enum InheritanceStatus {
    Configured = 0,
    ProofSubmitted = 1,
    CooldownActive = 2,
    ClaimReady = 3,
    Completed = 4,
    Cancelled = 5,
}

// ---------------------------------------------------------------- PDAs

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &program_id()).0
}

pub fn vault_pda(owner: &Pubkey, name: &[u8; 32]) -> Pubkey {
    pda(&[b"vault", owner.as_ref(), name])
}
pub fn vault_treasury_pda(vault: &Pubkey) -> Pubkey {
    pda(&[b"vault_treasury", vault.as_ref()])
}
pub fn beneficiary_pda(vault: &Pubkey, wallet: &Pubkey) -> Pubkey {
    pda(&[b"beneficiary", vault.as_ref(), wallet.as_ref()])
}
pub fn inheritance_pda(vault: &Pubkey) -> Pubkey {
    pda(&[b"inheritance", vault.as_ref()])
}
pub fn proof_pda(plan: &Pubkey) -> Pubkey {
    pda(&[b"proof", plan.as_ref()])
}
pub fn verifier_pda(plan: &Pubkey, verifier: &Pubkey) -> Pubkey {
    pda(&[b"verifier", plan.as_ref(), verifier.as_ref()])
}
pub fn signer_pda(vault: &Pubkey, signer: &Pubkey) -> Pubkey {
    pda(&[b"signer", vault.as_ref(), signer.as_ref()])
}
pub fn multisig_tx_pda(vault: &Pubkey, vault_balance: u64) -> Pubkey {
    pda(&[b"multisig_tx", vault.as_ref(), &(vault_balance + 1).to_le_bytes()])
}
pub fn bsafe_treasury_pda() -> Pubkey {
    pda(&[b"bsafe_treasury"])
}
pub fn membership_pda(owner: &Pubkey) -> Pubkey {
    pda(&[b"membership", owner.as_ref()])
}

pub fn name32(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[..s.len()].copy_from_slice(s.as_bytes());
    out
}

// ---------------------------------------------------------------- instruction builders

fn discriminator(name: &str) -> [u8; 8] {
    let hash = Sha256::digest(format!("global:{name}").as_bytes());
    hash[..8].try_into().unwrap()
}

fn ix(name: &str, args: &[u8], accounts: Vec<AccountMeta>) -> Instruction {
    let mut data = discriminator(name).to_vec();
    data.extend_from_slice(args);
    Instruction { program_id: program_id(), accounts, data }
}

fn w(k: Pubkey) -> AccountMeta {
    AccountMeta::new(k, false)
}
fn ws(k: Pubkey) -> AccountMeta {
    AccountMeta::new(k, true)
}
fn r(k: Pubkey) -> AccountMeta {
    AccountMeta::new_readonly(k, false)
}
fn rs(k: Pubkey) -> AccountMeta {
    AccountMeta::new_readonly(k, true)
}
/// Anchor encodes a missing `Option<Account>` as the program id.
fn none() -> AccountMeta {
    AccountMeta::new_readonly(program_id(), false)
}

pub fn create_vault(owner: &Pubkey, name: &[u8; 32]) -> Instruction {
    let vault = vault_pda(owner, name);
    ix("create_vault", name, vec![w(vault), ws(*owner), r(system_program())])
}

pub fn deposit(vault: &Pubkey, depositor: &Pubkey, amount: u64) -> Instruction {
    ix(
        "deposit",
        &amount.to_le_bytes(),
        vec![w(*vault), w(vault_treasury_pda(vault)), ws(*depositor), r(system_program())],
    )
}

pub fn withdraw(vault: &Pubkey, owner: &Pubkey, destination: &Pubkey, amount: u64) -> Instruction {
    ix(
        "withdraw",
        &amount.to_le_bytes(),
        vec![
            w(*vault),
            w(vault_treasury_pda(vault)),
            ws(*owner),
            w(*destination),
            r(system_program()),
        ],
    )
}

pub fn add_beneficiary(vault: &Pubkey, owner: &Pubkey, wallet: &Pubkey, share_bps: u16) -> Instruction {
    let mut args = wallet.to_bytes().to_vec();
    args.extend_from_slice(&share_bps.to_le_bytes());
    ix(
        "add_beneficiary",
        &args,
        vec![w(*vault), w(beneficiary_pda(vault, wallet)), ws(*owner), r(system_program())],
    )
}

pub fn create_inheritance_plan(
    vault: &Pubkey,
    owner: &Pubkey,
    trigger: TriggerType,
    cooldown_seconds: u64,
    deadman_seconds: u64,
    required_verifications: u8,
) -> Instruction {
    let mut args = vec![trigger as u8];
    args.extend_from_slice(&cooldown_seconds.to_le_bytes());
    args.extend_from_slice(&deadman_seconds.to_le_bytes());
    args.push(required_verifications);
    ix(
        "create_inheritance_plan",
        &args,
        vec![w(*vault), w(inheritance_pda(vault)), ws(*owner), r(system_program())],
    )
}

pub fn add_verifier(vault: &Pubkey, owner: &Pubkey, verifier: &Pubkey) -> Instruction {
    let plan = inheritance_pda(vault);
    ix(
        "add_verifier",
        &[],
        vec![
            r(*vault),
            r(plan),
            w(verifier_pda(&plan, verifier)),
            r(*verifier),
            ws(*owner),
            r(system_program()),
        ],
    )
}

pub fn submit_death_certificate(vault: &Pubkey, submitter: &Pubkey, document_hash: [u8; 32]) -> Instruction {
    let plan = inheritance_pda(vault);
    ix(
        "submit_death_certificate",
        &document_hash,
        vec![
            r(*vault),
            w(plan),
            r(beneficiary_pda(vault, submitter)),
            w(proof_pda(&plan)),
            ws(*submitter),
            r(system_program()),
        ],
    )
}

pub fn verify_death_certificate(vault: &Pubkey, verifier: &Pubkey) -> Instruction {
    let plan = inheritance_pda(vault);
    ix(
        "verify_death_certificate",
        &[],
        vec![r(*vault), w(plan), w(proof_pda(&plan)), w(verifier_pda(&plan, verifier)), rs(*verifier)],
    )
}

pub fn initiate_inheritance(vault: &Pubkey, initiator: &Pubkey, with_proof: bool) -> Instruction {
    let plan = inheritance_pda(vault);
    let proof = if with_proof { r(proof_pda(&plan)) } else { none() };
    ix(
        "initiate_inheritance",
        &[],
        vec![w(*vault), w(plan), r(vault_treasury_pda(vault)), proof, rs(*initiator)],
    )
}

pub fn claim_inheritance(vault: &Pubkey, claimer: &Pubkey) -> Instruction {
    ix(
        "claim_inheritance",
        &[],
        vec![
            w(*vault),
            w(inheritance_pda(vault)),
            w(beneficiary_pda(vault, claimer)),
            w(vault_treasury_pda(vault)),
            none(),
            w(bsafe_treasury_pda()),
            ws(*claimer),
            r(system_program()),
        ],
    )
}

pub fn cancel_inheritance(vault: &Pubkey, owner: &Pubkey) -> Instruction {
    let plan = inheritance_pda(vault);
    ix(
        "cancel_inheritance",
        &[],
        vec![w(*vault), w(plan), w(proof_pda(&plan)), ws(*owner), r(system_program())],
    )
}

pub fn reset_inheritance_plan(vault: &Pubkey, owner: &Pubkey) -> Instruction {
    ix("reset_inheritance_plan", &[], vec![w(*vault), w(inheritance_pda(vault)), rs(*owner)])
}

pub fn initialize_treasury(authority: &Pubkey) -> Instruction {
    ix(
        "initialize_treasury",
        &[],
        vec![w(bsafe_treasury_pda()), ws(*authority), r(system_program())],
    )
}

pub fn add_signer(vault: &Pubkey, owner: &Pubkey, new_signer: &Pubkey) -> Instruction {
    ix(
        "add_signer",
        new_signer.as_ref(),
        vec![w(*vault), w(signer_pda(vault, new_signer)), ws(*owner), r(system_program())],
    )
}

pub fn remove_signer(vault: &Pubkey, owner: &Pubkey, signer: &Pubkey) -> Instruction {
    ix("remove_signer", &[], vec![w(*vault), w(signer_pda(vault, signer)), ws(*owner)])
}

pub fn update_threshold(vault: &Pubkey, owner: &Pubkey, threshold: u8) -> Instruction {
    ix("update_threshold", &[threshold], vec![w(*vault), rs(*owner)])
}

/// Proposes a withdrawal. `vault_balance` is the vault's tracked balance (used as PDA nonce).
pub fn propose_withdrawal(
    vault: &Pubkey,
    proposer: &Pubkey,
    vault_balance: u64,
    amount: u64,
    destination: &Pubkey,
) -> Instruction {
    let mut args = vec![0u8]; // TransactionType::Withdrawal
    args.extend_from_slice(&amount.to_le_bytes());
    args.extend_from_slice(destination.as_ref());
    args.extend_from_slice(&[0u8; 32]);
    ix(
        "propose_transaction",
        &args,
        vec![
            w(*vault),
            r(signer_pda(vault, proposer)),
            w(multisig_tx_pda(vault, vault_balance)),
            ws(*proposer),
            r(system_program()),
        ],
    )
}

pub fn approve_transaction(vault: &Pubkey, approver: &Pubkey, tx: &Pubkey) -> Instruction {
    ix(
        "approve_transaction",
        &[],
        vec![r(*vault), r(signer_pda(vault, approver)), w(*tx), rs(*approver)],
    )
}

pub fn execute_transaction(vault: &Pubkey, executor: &Pubkey, tx: &Pubkey, destination: &Pubkey) -> Instruction {
    ix(
        "execute_transaction",
        &[],
        vec![
            w(*vault),
            w(*tx),
            w(vault_treasury_pda(vault)),
            w(*destination),
            rs(*executor),
            r(system_program()),
        ],
    )
}

// ---------------------------------------------------------------- test environment

pub struct Env {
    pub svm: LiteSVM,
}

impl Env {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new();
        // BSAFE_SO lets the same suite run against another binary (e.g. a dump of devnet)
        let so = std::env::var("BSAFE_SO").unwrap_or_else(|_| {
            concat!(env!("CARGO_MANIFEST_DIR"), "/../target/deploy/bsafe.so").to_string()
        });
        svm.add_program_from_file(program_id(), &so)
            .unwrap_or_else(|e| panic!("load {so} (run anchor build first): {e:?}"));
        Env { svm }
    }

    pub fn funded(&mut self, sol: u64) -> Keypair {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), sol * LAMPORTS_PER_SOL).unwrap();
        kp
    }

    /// Sends a transaction; on failure returns the program logs joined into one string.
    pub fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(
            ixs,
            Some(&signers[0].pubkey()),
            signers,
            self.svm.latest_blockhash(),
        );
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    pub fn ok(&mut self, ixs: &[Instruction], signers: &[&Keypair]) {
        if let Err(e) = self.send(ixs, signers) {
            panic!("transaction failed:\n{e}");
        }
    }

    /// Asserts the transaction fails and its logs contain `expected` (e.g. an Anchor error name).
    pub fn fails_with(&mut self, ixs: &[Instruction], signers: &[&Keypair], expected: &str) {
        match self.send(ixs, signers) {
            Ok(()) => panic!("expected failure containing {expected:?}, but transaction succeeded"),
            Err(e) => assert!(e.contains(expected), "expected {expected:?} in:\n{e}"),
        }
    }

    pub fn balance(&self, key: &Pubkey) -> u64 {
        self.svm.get_balance(key).unwrap_or(0)
    }

    pub fn data(&self, key: &Pubkey) -> Vec<u8> {
        self.svm.get_account(key).expect("account exists").data
    }

    pub fn warp_forward(&mut self, seconds: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp += seconds;
        clock.slot += 1;
        self.svm.set_sysvar(&clock);
    }

    // Account readers (offsets follow the Anchor account layouts, after the 8-byte discriminator)

    pub fn vault_status(&self, vault: &Pubkey) -> u8 {
        self.data(vault)[72]
    }
    pub fn vault_balance(&self, vault: &Pubkey) -> u64 {
        u64::from_le_bytes(self.data(vault)[73..81].try_into().unwrap())
    }
    pub fn vault_total_share_bps(&self, vault: &Pubkey) -> u16 {
        u16::from_le_bytes(self.data(vault)[102..104].try_into().unwrap())
    }
    pub fn plan_status(&self, vault: &Pubkey) -> u8 {
        self.data(&inheritance_pda(vault))[40]
    }
}

impl Default for Env {
    fn default() -> Self {
        Self::new()
    }
}
