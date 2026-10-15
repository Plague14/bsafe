use starknet::{ClassHash, ContractAddress};
use crate::types::{
    Beneficiary, DeathCertificateProof, InheritancePlan, Membership, MembershipTier,
    MultisigTransaction, Signer, TransactionType, TriggerType, Vault, Verifier,
};

#[starknet::interface]
pub trait IBSafe<TContractState> {
    // ---------- vault ----------
    fn create_vault(ref self: TContractState, name: felt252, token: ContractAddress) -> u64;
    /// Caller must `approve` the vault token first (one multicall from the wallet)
    fn deposit(ref self: TContractState, vault_id: u64, amount: u256);
    fn withdraw(ref self: TContractState, vault_id: u64, amount: u256, to: ContractAddress);
    /// Owner proves they are alive without moving funds (resets the deadman switch)
    fn heartbeat(ref self: TContractState, vault_id: u64);

    // ---------- beneficiaries ----------
    fn add_beneficiary(
        ref self: TContractState, vault_id: u64, wallet: ContractAddress, share_bps: u16,
    );
    fn remove_beneficiary(ref self: TContractState, vault_id: u64, wallet: ContractAddress);
    fn update_shares(
        ref self: TContractState, vault_id: u64, wallet: ContractAddress, new_share_bps: u16,
    );

    // ---------- inheritance ----------
    fn create_inheritance_plan(
        ref self: TContractState,
        vault_id: u64,
        trigger_type: TriggerType,
        cooldown_seconds: u64,
        deadman_seconds: u64,
        required_verifications: u8,
    );
    fn add_verifier(ref self: TContractState, vault_id: u64, verifier: ContractAddress);
    fn submit_death_certificate(ref self: TContractState, vault_id: u64, document_hash: felt252);
    fn verify_death_certificate(ref self: TContractState, vault_id: u64);
    fn initiate_inheritance(ref self: TContractState, vault_id: u64);
    fn claim_inheritance(ref self: TContractState, vault_id: u64);
    fn cancel_inheritance(ref self: TContractState, vault_id: u64);
    fn reset_inheritance_plan(ref self: TContractState, vault_id: u64);

    // ---------- multisig ----------
    fn add_signer(ref self: TContractState, vault_id: u64, signer: ContractAddress);
    fn remove_signer(ref self: TContractState, vault_id: u64, signer: ContractAddress);
    fn update_threshold(ref self: TContractState, vault_id: u64, new_threshold: u8);
    fn propose_transaction(
        ref self: TContractState,
        vault_id: u64,
        tx_type: TransactionType,
        amount: u256,
        destination: ContractAddress,
        new_threshold: u8,
    ) -> u64;
    fn approve_transaction(ref self: TContractState, vault_id: u64, tx_id: u64);
    fn reject_transaction(ref self: TContractState, vault_id: u64, tx_id: u64);
    fn execute_transaction(ref self: TContractState, vault_id: u64, tx_id: u64);

    // ---------- membership ----------
    fn upgrade_membership(ref self: TContractState, target_tier: MembershipTier);

    // ---------- admin ----------
    fn set_treasury(ref self: TContractState, treasury: ContractAddress);
    fn set_prices(ref self: TContractState, premium_price: u256, concierge_price: u256);
    fn transfer_admin(ref self: TContractState, new_admin: ContractAddress);
    fn upgrade(ref self: TContractState, new_class_hash: ClassHash);

    // ---------- views ----------
    fn get_vault(self: @TContractState, vault_id: u64) -> Vault;
    fn get_vault_count(self: @TContractState) -> u64;
    fn get_beneficiary(self: @TContractState, vault_id: u64, wallet: ContractAddress) -> Beneficiary;
    fn get_beneficiary_at(self: @TContractState, vault_id: u64, index: u8) -> ContractAddress;
    fn get_plan(self: @TContractState, vault_id: u64) -> InheritancePlan;
    fn get_proof(self: @TContractState, vault_id: u64) -> DeathCertificateProof;
    fn get_verifier(self: @TContractState, vault_id: u64, verifier: ContractAddress) -> Verifier;
    fn get_verifier_at(self: @TContractState, vault_id: u64, index: u8) -> ContractAddress;
    fn get_signer(self: @TContractState, vault_id: u64, signer: ContractAddress) -> Signer;
    fn get_signer_at(self: @TContractState, vault_id: u64, index: u8) -> ContractAddress;
    fn get_transaction(self: @TContractState, vault_id: u64, tx_id: u64) -> MultisigTransaction;
    fn get_membership(self: @TContractState, user: ContractAddress) -> Membership;
    fn get_effective_tier(self: @TContractState, user: ContractAddress) -> MembershipTier;
    /// Vault ids by role, for the dashboard. Lists are append-only: re-check the role.
    fn get_owner_vaults(self: @TContractState, owner: ContractAddress) -> Array<u64>;
    fn get_heir_vaults(self: @TContractState, wallet: ContractAddress) -> Array<u64>;
    fn get_signer_vaults(self: @TContractState, signer: ContractAddress) -> Array<u64>;
    fn get_verifier_vaults(self: @TContractState, verifier: ContractAddress) -> Array<u64>;
    fn get_config(
        self: @TContractState,
    ) -> (ContractAddress, ContractAddress, ContractAddress, u256, u256, bool);
}

pub mod Errors {
    pub const VAULT_NOT_FOUND: felt252 = 'Vault not found';
    pub const NOT_OWNER: felt252 = 'Caller is not the owner';
    pub const NOT_ADMIN: felt252 = 'Caller is not the admin';
    pub const VAULT_NOT_ACTIVE: felt252 = 'Vault is not active';
    pub const INVALID_NAME: felt252 = 'Invalid vault name';
    pub const ZERO_ADDRESS: felt252 = 'Zero address';
    pub const ZERO_AMOUNT: felt252 = 'Amount must be positive';
    pub const INSUFFICIENT_FUNDS: felt252 = 'Insufficient funds';
    pub const TRANSFER_FAILED: felt252 = 'Token transfer failed';
    pub const MULTISIG_REQUIRED: felt252 = 'Use the multisig flow';
    pub const MAX_BENEFICIARIES: felt252 = 'Max beneficiaries reached';
    pub const INVALID_SHARE: felt252 = 'Invalid share percentage';
    pub const INVALID_SHARE_SUM: felt252 = 'Shares must not exceed 100%';
    pub const SHARES_NOT_100: felt252 = 'Shares must sum to 100%';
    pub const BENEFICIARY_EXISTS: felt252 = 'Beneficiary already added';
    pub const BENEFICIARY_NOT_FOUND: felt252 = 'Beneficiary not found';
    pub const PLAN_EXISTS: felt252 = 'Plan already exists';
    pub const PLAN_NOT_FOUND: felt252 = 'Plan not found';
    pub const INVALID_COOLDOWN: felt252 = 'Invalid cooldown period';
    pub const INVALID_DEADMAN: felt252 = 'Invalid deadman period';
    pub const INVALID_VERIFICATIONS: felt252 = 'Invalid verification count';
    pub const ALREADY_TRIGGERED: felt252 = 'Inheritance already triggered';
    pub const NOT_TRIGGERED: felt252 = 'Inheritance not triggered';
    pub const VERIFIER_EXISTS: felt252 = 'Verifier already added';
    pub const NOT_VERIFIER: felt252 = 'Caller is not a verifier';
    pub const ALREADY_VERIFIED: felt252 = 'Already verified';
    pub const PROOF_NOT_VERIFIED: felt252 = 'Proof not verified';
    pub const NO_VERIFIERS: felt252 = 'Add verifiers first';
    pub const OWNER_STILL_ACTIVE: felt252 = 'Owner still active';
    pub const NOT_BENEFICIARY: felt252 = 'Caller is not a beneficiary';
    pub const ALREADY_CLAIMED: felt252 = 'Already claimed';
    pub const COOLDOWN_ACTIVE: felt252 = 'Cooldown not complete';
    pub const COOLDOWN_ENDED: felt252 = 'Cooldown already ended';
    pub const NOT_CANCELLED: felt252 = 'Plan is not cancelled';
    pub const MAX_SIGNERS: felt252 = 'Max signers reached';
    pub const SIGNER_EXISTS: felt252 = 'Signer already added';
    pub const NOT_SIGNER: felt252 = 'Caller is not a signer';
    pub const SIGNER_NOT_FOUND: felt252 = 'Signer not found';
    pub const CANNOT_REMOVE_OWNER: felt252 = 'Cannot remove the owner';
    pub const INVALID_THRESHOLD: felt252 = 'Invalid threshold';
    pub const MULTISIG_DISABLED: felt252 = 'Multisig not enabled';
    pub const TX_NOT_FOUND: felt252 = 'Transaction not found';
    pub const TX_NOT_PENDING: felt252 = 'Transaction not pending';
    pub const TX_NOT_APPROVED: felt252 = 'Transaction not approved';
    pub const ALREADY_APPROVED: felt252 = 'Already approved';
    pub const INVALID_UPGRADE: felt252 = 'Invalid membership upgrade';
}

#[starknet::contract]
pub mod BSafe {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::replace_class_syscall;
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};
    use crate::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::types::{
        BPS_DENOMINATOR, Beneficiary, BeneficiaryStatus, CONCIERGE_DURATION,
        DeathCertificateProof, InheritancePlan, InheritanceStatus, MAX_BENEFICIARIES,
        MAX_COOLDOWN, MAX_DEADMAN, MAX_SIGNERS, MAX_SIGNER_INDEX, MAX_VERIFICATIONS, MIN_COOLDOWN,
        MIN_COOLDOWN_DEMO, MIN_DEADMAN, MIN_DEADMAN_DEMO, Membership, MembershipTier,
        MultisigTransaction, Signer, TransactionStatus, TransactionType, TriggerType, Vault,
        VaultStatus, Verifier, bit, tier_fee_bps, tier_level,
    };
    use super::{Errors, IBSafe};

    #[storage]
    struct Storage {
        admin: ContractAddress,
        treasury: ContractAddress,
        payment_token: ContractAddress,
        premium_price: u256,
        concierge_price: u256,
        demo_mode: bool,
        vault_count: u64,
        vaults: Map<u64, Vault>,
        beneficiaries: Map<(u64, ContractAddress), Beneficiary>,
        beneficiary_list: Map<(u64, u8), ContractAddress>,
        plans: Map<u64, InheritancePlan>,
        proofs: Map<u64, DeathCertificateProof>,
        verifiers: Map<(u64, ContractAddress), Verifier>,
        verifier_list: Map<(u64, u8), ContractAddress>,
        signers: Map<(u64, ContractAddress), Signer>,
        signer_list: Map<(u64, u8), ContractAddress>,
        transactions: Map<(u64, u64), MultisigTransaction>,
        memberships: Map<ContractAddress, Membership>,
        // role indexes: (account, i) -> vault id
        owner_vaults: Map<(ContractAddress, u32), u64>,
        owner_vault_count: Map<ContractAddress, u32>,
        heir_vaults: Map<(ContractAddress, u32), u64>,
        heir_vault_count: Map<ContractAddress, u32>,
        signer_vaults: Map<(ContractAddress, u32), u64>,
        signer_vault_count: Map<ContractAddress, u32>,
        verifier_vaults: Map<(ContractAddress, u32), u64>,
        verifier_vault_count: Map<ContractAddress, u32>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        VaultCreated: VaultCreated,
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        Heartbeat: Heartbeat,
        BeneficiaryAdded: BeneficiaryAdded,
        BeneficiaryRemoved: BeneficiaryRemoved,
        SharesUpdated: SharesUpdated,
        PlanCreated: PlanCreated,
        VerifierAdded: VerifierAdded,
        ProofSubmitted: ProofSubmitted,
        ProofVerified: ProofVerified,
        InheritanceInitiated: InheritanceInitiated,
        InheritanceClaimed: InheritanceClaimed,
        InheritanceCancelled: InheritanceCancelled,
        PlanReset: PlanReset,
        SignerAdded: SignerAdded,
        SignerRemoved: SignerRemoved,
        ThresholdUpdated: ThresholdUpdated,
        TransactionProposed: TransactionProposed,
        TransactionApproved: TransactionApproved,
        TransactionRejected: TransactionRejected,
        TransactionExecuted: TransactionExecuted,
        MembershipUpgraded: MembershipUpgraded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultCreated {
        #[key]
        pub vault_id: u64,
        #[key]
        pub owner: ContractAddress,
        pub name: felt252,
        pub token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub vault_id: u64,
        pub from: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        #[key]
        pub vault_id: u64,
        pub to: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Heartbeat {
        #[key]
        pub vault_id: u64,
        pub at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BeneficiaryAdded {
        #[key]
        pub vault_id: u64,
        #[key]
        pub wallet: ContractAddress,
        pub share_bps: u16,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BeneficiaryRemoved {
        #[key]
        pub vault_id: u64,
        #[key]
        pub wallet: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SharesUpdated {
        #[key]
        pub vault_id: u64,
        #[key]
        pub wallet: ContractAddress,
        pub share_bps: u16,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PlanCreated {
        #[key]
        pub vault_id: u64,
        pub trigger_type: TriggerType,
        pub cooldown_seconds: u64,
        pub deadman_seconds: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VerifierAdded {
        #[key]
        pub vault_id: u64,
        #[key]
        pub verifier: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofSubmitted {
        #[key]
        pub vault_id: u64,
        pub submitted_by: ContractAddress,
        pub document_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofVerified {
        #[key]
        pub vault_id: u64,
        pub verifier: ContractAddress,
        pub verifications: u8,
        pub required: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InheritanceInitiated {
        #[key]
        pub vault_id: u64,
        pub initiator: ContractAddress,
        pub cooldown_ends_at: u64,
        pub distribution_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InheritanceClaimed {
        #[key]
        pub vault_id: u64,
        #[key]
        pub beneficiary: ContractAddress,
        pub net_amount: u256,
        pub fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InheritanceCancelled {
        #[key]
        pub vault_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PlanReset {
        #[key]
        pub vault_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignerAdded {
        #[key]
        pub vault_id: u64,
        #[key]
        pub signer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SignerRemoved {
        #[key]
        pub vault_id: u64,
        #[key]
        pub signer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ThresholdUpdated {
        #[key]
        pub vault_id: u64,
        pub threshold: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransactionProposed {
        #[key]
        pub vault_id: u64,
        #[key]
        pub tx_id: u64,
        pub proposer: ContractAddress,
        pub tx_type: TransactionType,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransactionApproved {
        #[key]
        pub vault_id: u64,
        #[key]
        pub tx_id: u64,
        pub approver: ContractAddress,
        pub approvals: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransactionRejected {
        #[key]
        pub vault_id: u64,
        #[key]
        pub tx_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransactionExecuted {
        #[key]
        pub vault_id: u64,
        #[key]
        pub tx_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MembershipUpgraded {
        #[key]
        pub user: ContractAddress,
        pub tier: MembershipTier,
        pub paid: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        treasury: ContractAddress,
        payment_token: ContractAddress,
        premium_price: u256,
        concierge_price: u256,
        demo_mode: bool,
    ) {
        assert(!admin.is_zero() && !treasury.is_zero(), Errors::ZERO_ADDRESS);
        assert(!payment_token.is_zero(), Errors::ZERO_ADDRESS);
        self.admin.write(admin);
        self.treasury.write(treasury);
        self.payment_token.write(payment_token);
        self.premium_price.write(premium_price);
        self.concierge_price.write(concierge_price);
        self.demo_mode.write(demo_mode);
    }

    #[abi(embed_v0)]
    impl BSafeImpl of IBSafe<ContractState> {
        // ==================== VAULT ====================

        fn create_vault(ref self: ContractState, name: felt252, token: ContractAddress) -> u64 {
            assert(name != 0, Errors::INVALID_NAME);
            assert(!token.is_zero(), Errors::ZERO_ADDRESS);
            let owner = get_caller_address();
            let now = get_block_timestamp();
            let vault_id = self.vault_count.read() + 1;
            self.vault_count.write(vault_id);

            self
                .vaults
                .write(
                    vault_id,
                    Vault {
                        owner,
                        name,
                        token,
                        status: VaultStatus::Active,
                        balance: 0,
                        beneficiary_count: 0,
                        beneficiary_list_len: 0,
                        total_share_bps: 0,
                        multisig_enabled: false,
                        multisig_threshold: 1,
                        signer_count: 0,
                        next_signer_index: 0,
                        signer_list_len: 0,
                        tx_count: 0,
                        last_activity: now,
                        created_at: now,
                    },
                );
            let n = self.owner_vault_count.read(owner);
            self.owner_vaults.write((owner, n), vault_id);
            self.owner_vault_count.write(owner, n + 1);

            self.emit(VaultCreated { vault_id, owner, name, token });
            vault_id
        }

        fn deposit(ref self: ContractState, vault_id: u64, amount: u256) {
            assert(amount > 0, Errors::ZERO_AMOUNT);
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            let caller = get_caller_address();

            vault.balance += amount;
            // Only the owner's own actions count as proof of life
            if caller == vault.owner {
                vault.last_activity = get_block_timestamp();
            }
            self.vaults.write(vault_id, vault);

            let ok = IERC20Dispatcher { contract_address: vault.token }
                .transfer_from(caller, starknet::get_contract_address(), amount);
            assert(ok, Errors::TRANSFER_FAILED);
            self.emit(Deposited { vault_id, from: caller, amount });
        }

        fn withdraw(ref self: ContractState, vault_id: u64, amount: u256, to: ContractAddress) {
            assert(amount > 0, Errors::ZERO_AMOUNT);
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(!vault.multisig_enabled || vault.multisig_threshold == 1, Errors::MULTISIG_REQUIRED);
            assert(vault.balance >= amount, Errors::INSUFFICIENT_FUNDS);

            vault.balance -= amount;
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);

            self.pay(vault.token, to, amount);
            self.emit(Withdrawn { vault_id, to, amount });
        }

        fn heartbeat(ref self: ContractState, vault_id: u64) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            let now = get_block_timestamp();
            vault.last_activity = now;
            self.vaults.write(vault_id, vault);
            self.emit(Heartbeat { vault_id, at: now });
        }

        // ==================== BENEFICIARIES ====================

        fn add_beneficiary(
            ref self: ContractState, vault_id: u64, wallet: ContractAddress, share_bps: u16,
        ) {
            assert(!wallet.is_zero(), Errors::ZERO_ADDRESS);
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(vault.beneficiary_count < MAX_BENEFICIARIES, Errors::MAX_BENEFICIARIES);
            assert(share_bps > 0 && share_bps <= BPS_DENOMINATOR, Errors::INVALID_SHARE);
            let new_total = vault.total_share_bps + share_bps;
            assert(new_total <= BPS_DENOMINATOR, Errors::INVALID_SHARE_SUM);

            let existing = self.beneficiaries.read((vault_id, wallet));
            assert(
                existing.status == BeneficiaryStatus::None
                    || existing.status == BeneficiaryStatus::Removed,
                Errors::BENEFICIARY_EXISTS,
            );
            // First time this wallet joins the vault: list it and index it for the heir
            if existing.status == BeneficiaryStatus::None {
                self.beneficiary_list.write((vault_id, vault.beneficiary_list_len), wallet);
                vault.beneficiary_list_len += 1;
                let n = self.heir_vault_count.read(wallet);
                self.heir_vaults.write((wallet, n), vault_id);
                self.heir_vault_count.write(wallet, n + 1);
            }

            self
                .beneficiaries
                .write(
                    (vault_id, wallet),
                    Beneficiary {
                        share_bps,
                        status: BeneficiaryStatus::Active,
                        claimed_amount: 0,
                        added_at: get_block_timestamp(),
                    },
                );
            vault.beneficiary_count += 1;
            vault.total_share_bps = new_total;
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(BeneficiaryAdded { vault_id, wallet, share_bps });
        }

        fn remove_beneficiary(ref self: ContractState, vault_id: u64, wallet: ContractAddress) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            let mut b = self.beneficiaries.read((vault_id, wallet));
            assert(b.status == BeneficiaryStatus::Active, Errors::BENEFICIARY_NOT_FOUND);

            vault.beneficiary_count -= 1;
            vault.total_share_bps -= b.share_bps;
            vault.last_activity = get_block_timestamp();
            b.status = BeneficiaryStatus::Removed;
            b.share_bps = 0;
            self.beneficiaries.write((vault_id, wallet), b);
            self.vaults.write(vault_id, vault);
            self.emit(BeneficiaryRemoved { vault_id, wallet });
        }

        fn update_shares(
            ref self: ContractState, vault_id: u64, wallet: ContractAddress, new_share_bps: u16,
        ) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(new_share_bps > 0 && new_share_bps <= BPS_DENOMINATOR, Errors::INVALID_SHARE);
            let mut b = self.beneficiaries.read((vault_id, wallet));
            assert(b.status == BeneficiaryStatus::Active, Errors::BENEFICIARY_NOT_FOUND);

            let new_total = vault.total_share_bps - b.share_bps + new_share_bps;
            assert(new_total <= BPS_DENOMINATOR, Errors::INVALID_SHARE_SUM);
            b.share_bps = new_share_bps;
            vault.total_share_bps = new_total;
            vault.last_activity = get_block_timestamp();
            self.beneficiaries.write((vault_id, wallet), b);
            self.vaults.write(vault_id, vault);
            self.emit(SharesUpdated { vault_id, wallet, share_bps: new_share_bps });
        }

        // ==================== INHERITANCE ====================

        fn create_inheritance_plan(
            ref self: ContractState,
            vault_id: u64,
            trigger_type: TriggerType,
            cooldown_seconds: u64,
            deadman_seconds: u64,
            required_verifications: u8,
        ) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(
                self.plans.read(vault_id).status == InheritanceStatus::None, Errors::PLAN_EXISTS,
            );
            assert(vault.beneficiary_count > 0, Errors::BENEFICIARY_NOT_FOUND);
            assert(vault.total_share_bps == BPS_DENOMINATOR, Errors::SHARES_NOT_100);

            let demo = self.demo_mode.read();
            let min_cooldown = if demo {
                MIN_COOLDOWN_DEMO
            } else {
                MIN_COOLDOWN
            };
            let min_deadman = if demo {
                MIN_DEADMAN_DEMO
            } else {
                MIN_DEADMAN
            };
            assert(
                cooldown_seconds >= min_cooldown && cooldown_seconds <= MAX_COOLDOWN,
                Errors::INVALID_COOLDOWN,
            );
            assert(
                deadman_seconds >= min_deadman && deadman_seconds <= MAX_DEADMAN,
                Errors::INVALID_DEADMAN,
            );
            // Deadman-only plans ignore verifications; certificate plans need 1..=10
            let uses_certificate = trigger_type != TriggerType::DeadmanSwitch;
            if uses_certificate {
                assert(
                    required_verifications >= 1 && required_verifications <= MAX_VERIFICATIONS,
                    Errors::INVALID_VERIFICATIONS,
                );
            }

            let now = get_block_timestamp();
            self
                .plans
                .write(
                    vault_id,
                    InheritancePlan {
                        status: InheritanceStatus::Configured,
                        trigger_type,
                        cooldown_seconds,
                        deadman_seconds,
                        required_verifications: if uses_certificate {
                            required_verifications
                        } else {
                            0
                        },
                        current_verifications: 0,
                        verifier_count: 0,
                        triggered_at: 0,
                        cooldown_ends_at: 0,
                        distribution_amount: 0,
                        share_total_snapshot: 0,
                        beneficiaries_snapshot: 0,
                        claims_count: 0,
                        created_at: now,
                    },
                );
            vault.last_activity = now;
            self.vaults.write(vault_id, vault);
            self.emit(PlanCreated { vault_id, trigger_type, cooldown_seconds, deadman_seconds });
        }

        fn add_verifier(ref self: ContractState, vault_id: u64, verifier: ContractAddress) {
            assert(!verifier.is_zero(), Errors::ZERO_ADDRESS);
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            let mut plan = self.plans.read(vault_id);
            assert(plan.status != InheritanceStatus::None, Errors::PLAN_NOT_FOUND);
            assert(plan.status == InheritanceStatus::Configured, Errors::ALREADY_TRIGGERED);
            assert(!self.verifiers.read((vault_id, verifier)).exists, Errors::VERIFIER_EXISTS);

            self
                .verifiers
                .write((vault_id, verifier), Verifier { exists: true, verified_nonce: 0, verified_at: 0 });
            self.verifier_list.write((vault_id, plan.verifier_count), verifier);
            plan.verifier_count += 1;
            self.plans.write(vault_id, plan);

            let n = self.verifier_vault_count.read(verifier);
            self.verifier_vaults.write((verifier, n), vault_id);
            self.verifier_vault_count.write(verifier, n + 1);

            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(VerifierAdded { vault_id, verifier });
        }

        fn submit_death_certificate(ref self: ContractState, vault_id: u64, document_hash: felt252) {
            assert(document_hash != 0, Errors::INVALID_NAME);
            self.read_vault(vault_id);
            let mut plan = self.plans.read(vault_id);
            assert(plan.status != InheritanceStatus::None, Errors::PLAN_NOT_FOUND);
            assert(plan.status == InheritanceStatus::Configured, Errors::ALREADY_TRIGGERED);
            assert(plan.trigger_type != TriggerType::DeadmanSwitch, Errors::INVALID_VERIFICATIONS);
            assert(plan.verifier_count >= plan.required_verifications, Errors::NO_VERIFIERS);
            let caller = get_caller_address();
            let b = self.beneficiaries.read((vault_id, caller));
            assert(b.status == BeneficiaryStatus::Active, Errors::NOT_BENEFICIARY);

            let prev = self.proofs.read(vault_id);
            self
                .proofs
                .write(
                    vault_id,
                    DeathCertificateProof {
                        document_hash,
                        submitted_by: caller,
                        submitted_at: get_block_timestamp(),
                        verified: false,
                        nonce: prev.nonce + 1,
                    },
                );
            plan.status = InheritanceStatus::ProofSubmitted;
            plan.current_verifications = 0;
            self.plans.write(vault_id, plan);
            self.emit(ProofSubmitted { vault_id, submitted_by: caller, document_hash });
        }

        fn verify_death_certificate(ref self: ContractState, vault_id: u64) {
            self.read_vault(vault_id);
            let mut plan = self.plans.read(vault_id);
            assert(plan.status == InheritanceStatus::ProofSubmitted, Errors::NOT_TRIGGERED);
            let mut proof = self.proofs.read(vault_id);
            assert(!proof.verified, Errors::ALREADY_VERIFIED);
            let caller = get_caller_address();
            let mut v = self.verifiers.read((vault_id, caller));
            assert(v.exists, Errors::NOT_VERIFIER);
            // A verifier confirms each proof once; a newer proof (after a cancel) can be
            // confirmed again
            assert(v.verified_nonce < proof.nonce, Errors::ALREADY_VERIFIED);

            v.verified_nonce = proof.nonce;
            v.verified_at = get_block_timestamp();
            self.verifiers.write((vault_id, caller), v);

            plan.current_verifications += 1;
            if plan.current_verifications >= plan.required_verifications {
                proof.verified = true;
                self.proofs.write(vault_id, proof);
            }
            self.plans.write(vault_id, plan);
            self
                .emit(
                    ProofVerified {
                        vault_id,
                        verifier: caller,
                        verifications: plan.current_verifications,
                        required: plan.required_verifications,
                    },
                );
        }

        fn initiate_inheritance(ref self: ContractState, vault_id: u64) {
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            let mut plan = self.plans.read(vault_id);
            assert(plan.status != InheritanceStatus::None, Errors::PLAN_NOT_FOUND);
            assert(
                plan.status == InheritanceStatus::Configured
                    || plan.status == InheritanceStatus::ProofSubmitted,
                Errors::ALREADY_TRIGGERED,
            );
            // Someone must be left to inherit
            assert(vault.beneficiary_count > 0, Errors::BENEFICIARY_NOT_FOUND);

            let now = get_block_timestamp();
            let proof_verified = plan.status == InheritanceStatus::ProofSubmitted
                && self.proofs.read(vault_id).verified;
            let deadman_elapsed = now >= vault.last_activity + plan.deadman_seconds;
            match plan.trigger_type {
                TriggerType::DeathCertificate => assert(proof_verified, Errors::PROOF_NOT_VERIFIED),
                TriggerType::DeadmanSwitch => assert(deadman_elapsed, Errors::OWNER_STILL_ACTIVE),
                TriggerType::Both => assert(
                    proof_verified || deadman_elapsed, Errors::OWNER_STILL_ACTIVE,
                ),
            }

            plan.status = InheritanceStatus::CooldownActive;
            plan.triggered_at = now;
            plan.cooldown_ends_at = now + plan.cooldown_seconds;
            plan.distribution_amount = vault.balance;
            plan.share_total_snapshot = vault.total_share_bps;
            plan.beneficiaries_snapshot = vault.beneficiary_count;
            plan.claims_count = 0;
            vault.status = VaultStatus::InheritanceInitiated;
            self.plans.write(vault_id, plan);
            self.vaults.write(vault_id, vault);
            self
                .emit(
                    InheritanceInitiated {
                        vault_id,
                        initiator: get_caller_address(),
                        cooldown_ends_at: plan.cooldown_ends_at,
                        distribution_amount: plan.distribution_amount,
                    },
                );
        }

        fn claim_inheritance(ref self: ContractState, vault_id: u64) {
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::InheritanceInitiated, Errors::NOT_TRIGGERED);
            let mut plan = self.plans.read(vault_id);
            assert(
                plan.status == InheritanceStatus::CooldownActive
                    || plan.status == InheritanceStatus::ClaimReady,
                Errors::NOT_TRIGGERED,
            );
            assert(get_block_timestamp() >= plan.cooldown_ends_at, Errors::COOLDOWN_ACTIVE);
            let caller = get_caller_address();
            let mut b = self.beneficiaries.read((vault_id, caller));
            assert(b.status != BeneficiaryStatus::Claimed, Errors::ALREADY_CLAIMED);
            assert(b.status == BeneficiaryStatus::Active, Errors::NOT_BENEFICIARY);

            plan.status = InheritanceStatus::ClaimReady;
            plan.claims_count += 1;
            // Pro rata against the shares active at trigger time. The last heir also takes
            // the rounding dust, so the vault always ends at exactly zero.
            let mut gross = if plan.claims_count == plan.beneficiaries_snapshot {
                vault.balance
            } else {
                plan.distribution_amount
                    * b.share_bps.into()
                    / plan.share_total_snapshot.into()
            };
            if gross > vault.balance {
                gross = vault.balance;
            }
            assert(gross > 0, Errors::INSUFFICIENT_FUNDS);

            let fee_bps = tier_fee_bps(self.effective_tier(vault.owner));
            let fee = gross * fee_bps.into() / BPS_DENOMINATOR.into();
            let net = gross - fee;

            vault.balance -= gross;
            if plan.claims_count == plan.beneficiaries_snapshot || vault.balance == 0 {
                plan.status = InheritanceStatus::Completed;
                vault.status = VaultStatus::InheritanceCompleted;
            }
            b.status = BeneficiaryStatus::Claimed;
            b.claimed_amount = net;
            self.beneficiaries.write((vault_id, caller), b);
            self.plans.write(vault_id, plan);
            self.vaults.write(vault_id, vault);

            if fee > 0 {
                self.pay(vault.token, self.treasury.read(), fee);
            }
            self.pay(vault.token, caller, net);
            self.emit(InheritanceClaimed { vault_id, beneficiary: caller, net_amount: net, fee });
        }

        fn cancel_inheritance(ref self: ContractState, vault_id: u64) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            let mut plan = self.plans.read(vault_id);
            let now = get_block_timestamp();
            // The owner can refute a pending certificate, or cancel during the cooldown
            if plan.status == InheritanceStatus::CooldownActive {
                assert(now < plan.cooldown_ends_at, Errors::COOLDOWN_ENDED);
            } else {
                assert(plan.status == InheritanceStatus::ProofSubmitted, Errors::NOT_TRIGGERED);
            }

            // Invalidate the certificate so it can't be reused to trigger again
            let mut proof = self.proofs.read(vault_id);
            proof.verified = false;
            proof.document_hash = 0;
            self.proofs.write(vault_id, proof);

            plan.status = InheritanceStatus::Cancelled;
            plan.triggered_at = 0;
            plan.cooldown_ends_at = 0;
            plan.distribution_amount = 0;
            plan.current_verifications = 0;
            plan.claims_count = 0;
            vault.status = VaultStatus::Active;
            vault.last_activity = now;
            self.plans.write(vault_id, plan);
            self.vaults.write(vault_id, vault);
            self.emit(InheritanceCancelled { vault_id });
        }

        fn reset_inheritance_plan(ref self: ContractState, vault_id: u64) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            let mut plan = self.plans.read(vault_id);
            assert(plan.status == InheritanceStatus::Cancelled, Errors::NOT_CANCELLED);
            plan.status = InheritanceStatus::Configured;
            vault.last_activity = get_block_timestamp();
            self.plans.write(vault_id, plan);
            self.vaults.write(vault_id, vault);
            self.emit(PlanReset { vault_id });
        }

        // ==================== MULTISIG ====================

        fn add_signer(ref self: ContractState, vault_id: u64, signer: ContractAddress) {
            assert(!signer.is_zero(), Errors::ZERO_ADDRESS);
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(vault.signer_count < MAX_SIGNERS, Errors::MAX_SIGNERS);
            assert(vault.next_signer_index < MAX_SIGNER_INDEX, Errors::MAX_SIGNERS);
            let mut s = self.signers.read((vault_id, signer));
            assert(!s.active, Errors::SIGNER_EXISTS);

            if !s.listed {
                self.signer_list.write((vault_id, vault.signer_list_len), signer);
                vault.signer_list_len += 1;
                let n = self.signer_vault_count.read(signer);
                self.signer_vaults.write((signer, n), vault_id);
                self.signer_vault_count.write(signer, n + 1);
            }
            // A re-added signer gets a fresh index, so old approval bits can't count for them
            s = Signer {
                active: true,
                listed: true,
                index: vault.next_signer_index,
                added_at: get_block_timestamp(),
            };
            self.signers.write((vault_id, signer), s);
            vault.signer_count += 1;
            vault.next_signer_index += 1;
            if !vault.multisig_enabled && vault.signer_count > 1 {
                vault.multisig_enabled = true;
                vault.multisig_threshold = 2;
            }
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(SignerAdded { vault_id, signer });
        }

        fn remove_signer(ref self: ContractState, vault_id: u64, signer: ContractAddress) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(signer != vault.owner, Errors::CANNOT_REMOVE_OWNER);
            let mut s = self.signers.read((vault_id, signer));
            assert(s.active, Errors::SIGNER_NOT_FOUND);

            s.active = false;
            self.signers.write((vault_id, signer), s);
            vault.signer_count -= 1;
            if vault.multisig_threshold > vault.signer_count {
                vault.multisig_threshold = vault.signer_count;
            }
            if vault.signer_count <= 1 {
                vault.multisig_enabled = false;
                vault.multisig_threshold = 1;
            }
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(SignerRemoved { vault_id, signer });
        }

        fn update_threshold(ref self: ContractState, vault_id: u64, new_threshold: u8) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(vault.multisig_enabled, Errors::MULTISIG_DISABLED);
            assert(
                new_threshold >= 1 && new_threshold <= vault.signer_count, Errors::INVALID_THRESHOLD,
            );
            vault.multisig_threshold = new_threshold;
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(ThresholdUpdated { vault_id, threshold: new_threshold });
        }

        fn propose_transaction(
            ref self: ContractState,
            vault_id: u64,
            tx_type: TransactionType,
            amount: u256,
            destination: ContractAddress,
            new_threshold: u8,
        ) -> u64 {
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            assert(vault.multisig_enabled, Errors::MULTISIG_DISABLED);
            let caller = get_caller_address();
            let s = self.signers.read((vault_id, caller));
            assert(s.active, Errors::NOT_SIGNER);
            match tx_type {
                TransactionType::Withdrawal => {
                    assert(amount > 0, Errors::ZERO_AMOUNT);
                    assert(amount <= vault.balance, Errors::INSUFFICIENT_FUNDS);
                    assert(!destination.is_zero(), Errors::ZERO_ADDRESS);
                },
                TransactionType::UpdateThreshold => {
                    assert(
                        new_threshold >= 1 && new_threshold <= vault.signer_count,
                        Errors::INVALID_THRESHOLD,
                    );
                },
            }

            let tx_id = vault.tx_count + 1;
            vault.tx_count = tx_id;
            let now = get_block_timestamp();
            // The proposer approves implicitly
            let status = if vault.multisig_threshold <= 1 {
                TransactionStatus::Approved
            } else {
                TransactionStatus::Pending
            };
            self
                .transactions
                .write(
                    (vault_id, tx_id),
                    MultisigTransaction {
                        tx_type,
                        status,
                        amount,
                        destination,
                        new_threshold,
                        proposer: caller,
                        threshold: vault.multisig_threshold,
                        approval_count: 1,
                        approvals: bit(s.index),
                        proposed_at: now,
                        executed_at: 0,
                    },
                );
            if caller == vault.owner {
                vault.last_activity = now;
            }
            self.vaults.write(vault_id, vault);
            self.emit(TransactionProposed { vault_id, tx_id, proposer: caller, tx_type });
            tx_id
        }

        fn approve_transaction(ref self: ContractState, vault_id: u64, tx_id: u64) {
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            let caller = get_caller_address();
            let s = self.signers.read((vault_id, caller));
            assert(s.active, Errors::NOT_SIGNER);
            let mut t = self.transactions.read((vault_id, tx_id));
            assert(t.status != TransactionStatus::None, Errors::TX_NOT_FOUND);
            assert(t.status == TransactionStatus::Pending, Errors::TX_NOT_PENDING);
            let mask = bit(s.index);
            assert(t.approvals & mask == 0, Errors::ALREADY_APPROVED);

            t.approvals = t.approvals | mask;
            t.approval_count += 1;
            if t.approval_count >= t.threshold {
                t.status = TransactionStatus::Approved;
            }
            self.transactions.write((vault_id, tx_id), t);
            if caller == vault.owner {
                vault.last_activity = get_block_timestamp();
                self.vaults.write(vault_id, vault);
            }
            self
                .emit(
                    TransactionApproved {
                        vault_id, tx_id, approver: caller, approvals: t.approval_count,
                    },
                );
        }

        fn reject_transaction(ref self: ContractState, vault_id: u64, tx_id: u64) {
            let mut vault = self.read_vault(vault_id);
            self.assert_owner(@vault);
            let mut t = self.transactions.read((vault_id, tx_id));
            assert(t.status != TransactionStatus::None, Errors::TX_NOT_FOUND);
            assert(
                t.status == TransactionStatus::Pending || t.status == TransactionStatus::Approved,
                Errors::TX_NOT_PENDING,
            );
            t.status = TransactionStatus::Cancelled;
            self.transactions.write((vault_id, tx_id), t);
            vault.last_activity = get_block_timestamp();
            self.vaults.write(vault_id, vault);
            self.emit(TransactionRejected { vault_id, tx_id });
        }

        fn execute_transaction(ref self: ContractState, vault_id: u64, tx_id: u64) {
            let mut vault = self.read_vault(vault_id);
            assert(vault.status == VaultStatus::Active, Errors::VAULT_NOT_ACTIVE);
            let caller = get_caller_address();
            assert(self.signers.read((vault_id, caller)).active, Errors::NOT_SIGNER);
            let mut t = self.transactions.read((vault_id, tx_id));
            assert(t.status != TransactionStatus::None, Errors::TX_NOT_FOUND);
            assert(t.status == TransactionStatus::Approved, Errors::TX_NOT_APPROVED);

            let now = get_block_timestamp();
            t.status = TransactionStatus::Executed;
            t.executed_at = now;
            self.transactions.write((vault_id, tx_id), t);
            if caller == vault.owner {
                vault.last_activity = now;
            }
            match t.tx_type {
                TransactionType::Withdrawal => {
                    assert(vault.balance >= t.amount, Errors::INSUFFICIENT_FUNDS);
                    vault.balance -= t.amount;
                    self.vaults.write(vault_id, vault);
                    self.pay(vault.token, t.destination, t.amount);
                    self.emit(Withdrawn { vault_id, to: t.destination, amount: t.amount });
                },
                TransactionType::UpdateThreshold => {
                    // Signers may have been removed since the proposal
                    assert(
                        t.new_threshold >= 1 && t.new_threshold <= vault.signer_count,
                        Errors::INVALID_THRESHOLD,
                    );
                    vault.multisig_threshold = t.new_threshold;
                    self.vaults.write(vault_id, vault);
                    self.emit(ThresholdUpdated { vault_id, threshold: t.new_threshold });
                },
            }
            self.emit(TransactionExecuted { vault_id, tx_id });
        }

        // ==================== MEMBERSHIP ====================

        fn upgrade_membership(ref self: ContractState, target_tier: MembershipTier) {
            let caller = get_caller_address();
            let current = self.effective_tier(caller);
            assert(target_tier != MembershipTier::Free, Errors::INVALID_UPGRADE);
            assert(tier_level(target_tier) > tier_level(current), Errors::INVALID_UPGRADE);

            let price = match target_tier {
                MembershipTier::Free => 0,
                MembershipTier::Premium => self.premium_price.read(),
                MembershipTier::Concierge => self.concierge_price.read(),
            };
            let mut m = self.memberships.read(caller);
            m.tier = target_tier;
            m.total_paid += price;
            m
                .expires_at =
                    if target_tier == MembershipTier::Concierge {
                        get_block_timestamp() + CONCIERGE_DURATION
                    } else {
                        0
                    };
            self.memberships.write(caller, m);

            if price > 0 {
                let ok = IERC20Dispatcher { contract_address: self.payment_token.read() }
                    .transfer_from(caller, self.treasury.read(), price);
                assert(ok, Errors::TRANSFER_FAILED);
            }
            self.emit(MembershipUpgraded { user: caller, tier: target_tier, paid: price });
        }

        // ==================== ADMIN ====================

        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self.assert_admin();
            assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);
            self.treasury.write(treasury);
        }

        fn set_prices(ref self: ContractState, premium_price: u256, concierge_price: u256) {
            self.assert_admin();
            self.premium_price.write(premium_price);
            self.concierge_price.write(concierge_price);
        }

        fn transfer_admin(ref self: ContractState, new_admin: ContractAddress) {
            self.assert_admin();
            assert(!new_admin.is_zero(), Errors::ZERO_ADDRESS);
            self.admin.write(new_admin);
        }

        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.assert_admin();
            replace_class_syscall(new_class_hash).unwrap();
        }

        // ==================== VIEWS ====================

        fn get_vault(self: @ContractState, vault_id: u64) -> Vault {
            self.vaults.read(vault_id)
        }

        fn get_vault_count(self: @ContractState) -> u64 {
            self.vault_count.read()
        }

        fn get_beneficiary(
            self: @ContractState, vault_id: u64, wallet: ContractAddress,
        ) -> Beneficiary {
            self.beneficiaries.read((vault_id, wallet))
        }

        fn get_beneficiary_at(self: @ContractState, vault_id: u64, index: u8) -> ContractAddress {
            self.beneficiary_list.read((vault_id, index))
        }

        fn get_plan(self: @ContractState, vault_id: u64) -> InheritancePlan {
            self.plans.read(vault_id)
        }

        fn get_proof(self: @ContractState, vault_id: u64) -> DeathCertificateProof {
            self.proofs.read(vault_id)
        }

        fn get_verifier(self: @ContractState, vault_id: u64, verifier: ContractAddress) -> Verifier {
            self.verifiers.read((vault_id, verifier))
        }

        fn get_verifier_at(self: @ContractState, vault_id: u64, index: u8) -> ContractAddress {
            self.verifier_list.read((vault_id, index))
        }

        fn get_signer(self: @ContractState, vault_id: u64, signer: ContractAddress) -> Signer {
            self.signers.read((vault_id, signer))
        }

        fn get_signer_at(self: @ContractState, vault_id: u64, index: u8) -> ContractAddress {
            self.signer_list.read((vault_id, index))
        }

        fn get_transaction(
            self: @ContractState, vault_id: u64, tx_id: u64,
        ) -> MultisigTransaction {
            self.transactions.read((vault_id, tx_id))
        }

        fn get_membership(self: @ContractState, user: ContractAddress) -> Membership {
            self.memberships.read(user)
        }

        fn get_effective_tier(self: @ContractState, user: ContractAddress) -> MembershipTier {
            self.effective_tier(user)
        }

        fn get_owner_vaults(self: @ContractState, owner: ContractAddress) -> Array<u64> {
            let mut ids = array![];
            let n = self.owner_vault_count.read(owner);
            for i in 0..n {
                ids.append(self.owner_vaults.read((owner, i)));
            }
            ids
        }

        fn get_heir_vaults(self: @ContractState, wallet: ContractAddress) -> Array<u64> {
            let mut ids = array![];
            let n = self.heir_vault_count.read(wallet);
            for i in 0..n {
                ids.append(self.heir_vaults.read((wallet, i)));
            }
            ids
        }

        fn get_signer_vaults(self: @ContractState, signer: ContractAddress) -> Array<u64> {
            let mut ids = array![];
            let n = self.signer_vault_count.read(signer);
            for i in 0..n {
                ids.append(self.signer_vaults.read((signer, i)));
            }
            ids
        }

        fn get_verifier_vaults(self: @ContractState, verifier: ContractAddress) -> Array<u64> {
            let mut ids = array![];
            let n = self.verifier_vault_count.read(verifier);
            for i in 0..n {
                ids.append(self.verifier_vaults.read((verifier, i)));
            }
            ids
        }

        fn get_config(
            self: @ContractState,
        ) -> (ContractAddress, ContractAddress, ContractAddress, u256, u256, bool) {
            (
                self.admin.read(),
                self.treasury.read(),
                self.payment_token.read(),
                self.premium_price.read(),
                self.concierge_price.read(),
                self.demo_mode.read(),
            )
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn read_vault(self: @ContractState, vault_id: u64) -> Vault {
            let vault = self.vaults.read(vault_id);
            assert(!vault.owner.is_zero(), Errors::VAULT_NOT_FOUND);
            vault
        }

        fn assert_owner(self: @ContractState, vault: @Vault) {
            assert(get_caller_address() == *vault.owner, Errors::NOT_OWNER);
        }

        fn assert_admin(self: @ContractState) {
            assert(get_caller_address() == self.admin.read(), Errors::NOT_ADMIN);
        }

        fn effective_tier(self: @ContractState, user: ContractAddress) -> MembershipTier {
            let m = self.memberships.read(user);
            if m.expires_at != 0 && get_block_timestamp() >= m.expires_at {
                MembershipTier::Free
            } else {
                m.tier
            }
        }

        fn pay(ref self: ContractState, token: ContractAddress, to: ContractAddress, amount: u256) {
            let ok = IERC20Dispatcher { contract_address: token }.transfer(to, amount);
            assert(ok, Errors::TRANSFER_FAILED);
        }
    }
}
