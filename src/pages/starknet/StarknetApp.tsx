import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, CheckCircle2, ExternalLink, FileCheck2, HeartPulse, Loader2, Plus, RefreshCw,
  Trash2, Users, Vault as VaultIcon, Wallet, XCircle,
} from 'lucide-react';
import type { Call } from 'starknet';
import { Button, Card, Input, LanguageToggle } from '../../components/ui';
import { useI18n } from '../../i18n';
import {
  SN_CONTRACT, SN_DEFAULTS, SN_DEMO_MODE, SN_FAUCET, SN_TIMER_UNIT, SN_TOKENS, snExplorer,
} from '../../starknet/config';
import {
  calls, chainNow, formatAmount, getBeneficiaries, getBeneficiary, getHeirVaultIds, getOwnerVaultIds, getPlan,
  getProof, getTokenBalance, getVault, getVerifier, getVerifierVaultIds, getVerifiers, hashDocument,
  parseAmount, shortAddr, type SnBeneficiary, type SnPlan, type SnProof, type SnVault,
  type SnVerifier, type TriggerType,
} from '../../starknet/client';
import { SnWalletProvider, useSnWallet } from '../../starknet/wallet';
import { describeSnError } from '../../starknet/walletUtils';
import { fill, snCopy, type SnCopy } from './copy';

// ==================== shared bits ====================

function useCopy(): SnCopy {
  return snCopy[useI18n().lang];
}

// Offset between the latest block timestamp and this browser's clock, so countdowns
// (and the buttons they unlock) follow chain time even when the local clock drifts
let clockOffset = 0;
let offsetRequest: Promise<void> | null = null;
function syncClock() {
  offsetRequest ??= chainNow()
    .then(chain => {
      clockOffset = chain - Math.floor(Date.now() / 1000);
    })
    .catch(() => {
      offsetRequest = null;
    });
}

function useNow() {
  const read = () => Math.floor(Date.now() / 1000) + clockOffset;
  const [now, setNow] = useState(read);
  useEffect(() => {
    syncClock();
    const id = setInterval(() => setNow(read()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function duration(seconds: number, c: SnCopy) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return fill(c.ago.s, { n: s });
  if (s < 3600) return `${fill(c.ago.m, { n: Math.floor(s / 60) })} ${fill(c.ago.s, { n: s % 60 })}`;
  if (s < 86400) return fill(c.ago.h, { n: Math.floor(s / 3600) });
  return fill(c.ago.d, { n: Math.floor(s / 86400) });
}

type Toast = { kind: 'ok' | 'error'; text: string; tx?: string };

interface TxState {
  busy: string | null;
  run: (key: string, c: Call | Call[]) => Promise<boolean>;
  toast: Toast | null;
  clear: () => void;
}

function useTx(onDone: () => void): TxState {
  const { execute } = useSnWallet();
  const c = useCopy();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const run = useCallback(
    async (key: string, call: Call | Call[]) => {
      setBusy(key);
      setToast(null);
      try {
        const tx = await execute(call);
        setToast({ kind: 'ok', text: c.toast.done, tx });
        onDone();
        return true;
      } catch (err) {
        const reason = describeSnError(err);
        setToast({ kind: 'error', text: reason === 'cancelled' ? c.toast.cancelled : `${c.toast.error}: ${reason}` });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [execute, c, onDone],
  );

  return { busy, run, toast, clear: () => setToast(null) };
}

function ToastView({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  const c = useCopy();
  if (!toast) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 animate-slide-up">
      <div
        className={clsx(
          'flex items-start gap-3 rounded-xl border bg-white p-4 shadow-elevated',
          toast.kind === 'ok' ? 'border-green-200' : 'border-red-200',
        )}
      >
        {toast.kind === 'ok' ? (
          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-medium text-gray-900 break-words">{toast.text}</p>
          {toast.tx && (
            <a href={snExplorer.tx(toast.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-600 hover:underline mt-1">
              {c.toast.view} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="close">
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'gray' && 'bg-gray-100 text-gray-700',
        tone === 'blue' && 'bg-primary-50 text-primary-700',
        tone === 'green' && 'bg-green-50 text-green-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
        tone === 'red' && 'bg-red-50 text-red-700',
      )}
    >
      {children}
    </span>
  );
}

const isAddress = (v: string) => /^0x[0-9a-fA-F]{1,64}$/.test(v.trim());

function SectionTitle({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
        <span className="text-primary-600">{icon}</span>
        {children}
      </h3>
      {right}
    </div>
  );
}

// ==================== header / connect ====================

function Header() {
  const c = useCopy();
  const { address, walletName, disconnect } = useSnWallet();
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="text-xl font-bold text-primary-600">BSafe</Link>
          <span className="hidden sm:inline"><Pill tone="blue">{c.badge}</Pill></span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {address && (
            <button
              onClick={disconnect}
              title={c.disconnect}
              aria-label={`${c.disconnect} ${address}`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 sm:px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Wallet className="w-4 h-4 text-primary-600" />
              <span className="hidden sm:inline font-mono">{shortAddr(address)}</span>
              {walletName && <span className="hidden md:inline text-gray-400">· {walletName}</span>}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function ConnectView() {
  const c = useCopy();
  const { wallets, connect, connecting, refreshWallets } = useSnWallet();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
        <VaultIcon className="w-7 h-7 text-primary-600" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{c.heroTitle}</h1>
      <p className="text-gray-600 text-lg mb-8">{c.heroText}</p>

      {wallets.length === 0 ? (
        <div className="space-y-3">
          <p className="text-gray-700">{c.noWallet}</p>
          <Button variant="secondary" onClick={refreshWallets} icon={<RefreshCw className="w-4 h-4" />}>{c.refresh}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {wallets.map(w => (
            <Button
              key={w.id}
              loading={connecting}
              onClick={async () => {
                setError(null);
                try {
                  await connect(w);
                } catch (err) {
                  setError(describeSnError(err));
                }
              }}
              icon={
                typeof w.icon === 'string' && w.icon ? (
                  <img src={w.icon} alt="" className="w-5 h-5 rounded" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )
              }
            >
              {connecting ? c.connecting : `${c.connect} · ${w.name}`}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-10 space-y-1 text-sm text-gray-500">
        {SN_DEMO_MODE && <p>{c.demoNote}</p>}
        <p>
          <a className="text-primary-600 hover:underline" href={SN_FAUCET} target="_blank" rel="noreferrer">{c.faucet}</a>
          {' · '}
          <a className="text-primary-600 hover:underline" href={snExplorer.contract(SN_CONTRACT)} target="_blank" rel="noreferrer">
            {c.contract} {shortAddr(SN_CONTRACT)}
          </a>
        </p>
        <p>
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary-600"><ArrowLeft className="w-3.5 h-3.5" /> {c.back}</Link>
        </p>
      </div>
    </div>
  );
}

// ==================== vaults (owner) ====================

function CreateVault({ tx }: { tx: TxState }) {
  const c = useCopy();
  const [name, setName] = useState('');
  const [token, setToken] = useState(SN_TOKENS[0].address);
  const valid = /^[\x20-\x7e]{1,31}$/.test(name.trim());

  return (
    <Card>
      <SectionTitle icon={<Plus className="w-5 h-5" />}>{c.create.title}</SectionTitle>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        onSubmit={async e => {
          e.preventDefault();
          if (!valid) return;
          if (await tx.run('create', calls.createVault(name.trim(), token))) setName('');
        }}
      >
        <Input
          label={c.create.name}
          placeholder={c.create.namePh}
          value={name}
          maxLength={31}
          onChange={e => setName(e.target.value)}
          error={name && !valid ? c.create.nameError : undefined}
        />
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-gray-700">{c.create.token}</span>
          <select className="input" value={token} onChange={e => setToken(e.target.value)}>
            {SN_TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={!valid} loading={tx.busy === 'create'}>{c.create.submit}</Button>
      </form>
    </Card>
  );
}

function VaultsTab({ address }: { address: string }) {
  const c = useCopy();
  const [vaults, setVaults] = useState<SnVault[] | null>(null);
  const [selected, setSelected] = useState<bigint | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  const tx = useTx(reload);
  const known = useRef<Set<bigint> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = await getOwnerVaultIds(address);
      const list = await Promise.all(ids.map(getVault));
      if (!alive) return;
      list.sort((a, b) => Number(b.id - a.id));
      const created = known.current ? list.find(v => !known.current!.has(v.id)) : undefined;
      known.current = new Set(list.map(v => v.id));
      setVaults(list);
      setSelected(s => created?.id ?? (s !== null && list.some(v => v.id === s) ? s : list[0]?.id ?? null));
    })().catch(() => alive && setVaults([]));
    return () => {
      alive = false;
    };
  }, [address, version]);

  const current = vaults?.find(v => v.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <CreateVault tx={tx} />
      {vaults === null ? (
        <Loading />
      ) : vaults.length === 0 ? (
        <p className="text-gray-500 text-center py-6">{c.empty}</p>
      ) : (
        <>
          {vaults.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {vaults.map(v => (
                <button
                  key={v.id.toString()}
                  onClick={() => setSelected(v.id)}
                  className={clsx(
                    'shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    v.id === selected ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  {v.name} · {formatAmount(v.balance, v.token.decimals, 2)} {v.token.symbol}
                </button>
              ))}
            </div>
          )}
          {current && <VaultDetail key={current.id.toString()} vault={current} address={address} tx={tx} version={version} />}
        </>
      )}
      <ToastView toast={tx.toast} onClose={tx.clear} />
    </div>
  );
}

function VaultDetail({ vault, address, tx, version }: { vault: SnVault; address: string; tx: TxState; version: number }) {
  const c = useCopy();
  const now = useNow();
  const [heirs, setHeirs] = useState<SnBeneficiary[]>([]);
  const [plan, setPlan] = useState<SnPlan | null>(null);
  const [verifiers, setVerifiers] = useState<SnVerifier[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint>(0n);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, p, bal] = await Promise.all([
        getBeneficiaries(vault),
        getPlan(vault.id),
        getTokenBalance(vault.token.address, address),
      ]);
      const v = await getVerifiers(vault.id, p.verifierCount);
      if (!alive) return;
      setHeirs(h);
      setPlan(p);
      setWalletBalance(bal);
      setVerifiers(v);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [vault, address, version]);

  const active = vault.status === 'Active';
  const statusTone = vault.status === 'Active' ? 'green' : vault.status === 'InheritanceInitiated' ? 'amber' : 'gray';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{vault.name} · #{vault.id.toString()}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatAmount(vault.balance, vault.token.decimals)} <span className="text-lg text-gray-500">{vault.token.symbol}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {c.vault.lastActivity}: {duration(now - vault.lastActivity, c)}
            </p>
          </div>
          <Pill tone={statusTone}>{c.vaultStatus[vault.status]}</Pill>
        </div>
        {active && (
          <div className="grid gap-4 sm:grid-cols-2 mt-6">
            <AmountAction
              label={c.vault.deposit}
              hint={`${c.vault.wallet}: ${formatAmount(walletBalance, vault.token.decimals)} ${vault.token.symbol}`}
              max={walletBalance}
              decimals={vault.token.decimals}
              busy={tx.busy === 'deposit'}
              onSubmit={amount => tx.run('deposit', calls.deposit(vault, amount))}
            />
            <AmountAction
              label={c.vault.withdraw}
              variant="secondary"
              max={vault.balance}
              decimals={vault.token.decimals}
              busy={tx.busy === 'withdraw'}
              onSubmit={amount => tx.run('withdraw', calls.withdraw(vault.id, amount, address))}
            />
          </div>
        )}
        {active && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" icon={<HeartPulse className="w-4 h-4" />} loading={tx.busy === 'heartbeat'} onClick={() => tx.run('heartbeat', calls.heartbeat(vault.id))}>
              {c.vault.heartbeat}
            </Button>
            <span className="text-xs text-gray-500">{c.vault.heartbeatHint}</span>
          </div>
        )}
      </Card>

      <HeirsCard vault={vault} heirs={heirs} tx={tx} editable={active && (!plan || plan.status === 'None' || plan.status === 'Configured' || plan.status === 'Cancelled')} />
      {plan && <PlanCard vault={vault} plan={plan} verifiers={verifiers} tx={tx} now={now} />}
    </div>
  );
}

function AmountAction({
  label, hint, max, decimals, busy, onSubmit, variant = 'primary',
}: {
  label: string; hint?: string; max: bigint; decimals: number; busy: boolean;
  onSubmit: (amount: bigint) => Promise<boolean>; variant?: 'primary' | 'secondary';
}) {
  const c = useCopy();
  const [value, setValue] = useState('');
  let amount: bigint | null = null;
  try {
    amount = value ? parseAmount(value, decimals) : null;
  } catch {
    amount = null;
  }
  const valid = amount !== null && amount > 0n && amount <= max;

  return (
    <form
      className="space-y-1.5"
      onSubmit={async e => {
        e.preventDefault();
        if (valid && (await onSubmit(amount!))) setValue('');
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <button type="button" className="text-primary-600 hover:underline text-xs" onClick={() => setValue(formatAmount(max, decimals, decimals))}>
          {c.vault.max}
        </button>
      </div>
      <div className="flex gap-2">
        <input className="input" inputMode="decimal" placeholder="0.0" value={value} onChange={e => setValue(e.target.value)} />
        <Button type="submit" variant={variant} disabled={!valid} loading={busy}>{label}</Button>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </form>
  );
}

function HeirsCard({ vault, heirs, tx, editable }: { vault: SnVault; heirs: SnBeneficiary[]; tx: TxState; editable: boolean }) {
  const c = useCopy();
  const [wallet, setWallet] = useState('');
  const [share, setShare] = useState('');
  const remaining = 100 - vault.totalShareBps / 100;
  const pct = Number(share.replace(',', '.'));
  const valid = isAddress(wallet) && pct > 0 && pct <= remaining + 1e-9;
  const visible = heirs.filter(h => h.status !== 'None' && h.status !== 'Removed');

  return (
    <Card>
      <SectionTitle icon={<Users className="w-5 h-5" />} right={<Pill tone={vault.totalShareBps === 10000 ? 'green' : 'amber'}>{fill(c.heirs.allocated, { n: vault.totalShareBps / 100 })}</Pill>}>
        {c.heirs.title}
      </SectionTitle>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">{c.heirs.none}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map(h => (
            <li key={h.wallet} className="flex items-center justify-between gap-3 py-3">
              <span className="font-mono text-sm text-gray-800 truncate">{shortAddr(h.wallet)}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{h.shareBps / 100}%</span>
                {h.status === 'Claimed' && <Pill tone="green">{c.heirs.claimed}</Pill>}
                {editable && h.status === 'Active' && (
                  <button
                    className="text-gray-400 hover:text-error disabled:opacity-50"
                    title={c.heirs.remove}
                    disabled={tx.busy !== null}
                    onClick={() => tx.run(`rm-${h.wallet}`, calls.removeBeneficiary(vault.id, h.wallet))}
                  >
                    {tx.busy === `rm-${h.wallet}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && remaining > 0 && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end mt-4"
          onSubmit={async e => {
            e.preventDefault();
            if (!valid) return;
            if (await tx.run('add-heir', calls.addBeneficiary(vault.id, wallet.trim(), Math.round(pct * 100)))) {
              setWallet('');
              setShare('');
            }
          }}
        >
          <Input label={c.heirs.address} value={wallet} onChange={e => setWallet(e.target.value)} className="font-mono text-sm" />
          <Input label={c.heirs.share} inputMode="decimal" placeholder={String(remaining)} value={share} onChange={e => setShare(e.target.value)} />
          <Button type="submit" disabled={!valid} loading={tx.busy === 'add-heir'}>{c.heirs.add}</Button>
        </form>
      )}
    </Card>
  );
}

function PlanCard({ vault, plan, verifiers, tx, now }: { vault: SnVault; plan: SnPlan; verifiers: SnVerifier[]; tx: TxState; now: number }) {
  const c = useCopy();
  const unitLabel = SN_DEMO_MODE ? c.plan.unit.min : c.plan.unit.day;
  const [trigger, setTrigger] = useState<TriggerType>('DeadmanSwitch');
  const [cooldown, setCooldown] = useState(String(SN_DEFAULTS.cooldown));
  const [deadman, setDeadman] = useState(String(SN_DEFAULTS.deadman));
  const [verifications, setVerifications] = useState('1');
  const [verifier, setVerifier] = useState('');

  if (plan.status === 'None') {
    const ready = vault.totalShareBps === 10000;
    return (
      <Card>
        <SectionTitle icon={<FileCheck2 className="w-5 h-5" />}>{c.plan.title}</SectionTitle>
        {!ready ? (
          <p className="text-sm text-gray-500">{c.plan.needs100}</p>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={e => {
              e.preventDefault();
              void tx.run(
                'plan',
                calls.createPlan(
                  vault.id,
                  trigger,
                  Math.round(Number(cooldown) * SN_TIMER_UNIT),
                  Math.round(Number(deadman) * SN_TIMER_UNIT),
                  trigger === 'DeadmanSwitch' ? 0 : Number(verifications),
                ),
              );
            }}
          >
            <label className="space-y-1.5 sm:col-span-2">
              <span className="block text-sm font-medium text-gray-700">{c.plan.trigger}</span>
              <select className="input" value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)}>
                {(['DeadmanSwitch', 'DeathCertificate', 'Both'] as TriggerType[]).map(t => (
                  <option key={t} value={t}>{c.plan.triggers[t]}</option>
                ))}
              </select>
            </label>
            <Input label={`${c.plan.deadman} (${unitLabel})`} inputMode="numeric" value={deadman} onChange={e => setDeadman(e.target.value)} />
            <Input label={`${c.plan.cooldown} (${unitLabel})`} inputMode="numeric" value={cooldown} onChange={e => setCooldown(e.target.value)} />
            {trigger !== 'DeadmanSwitch' && (
              <Input label={c.plan.verifications} type="number" min={1} max={10} value={verifications} onChange={e => setVerifications(e.target.value)} />
            )}
            <div className="sm:col-span-2">
              <Button type="submit" loading={tx.busy === 'plan'}>{c.plan.create}</Button>
            </div>
          </form>
        )}
      </Card>
    );
  }

  const deadmanAt = vault.lastActivity + plan.deadmanSeconds;
  const usesCertificate = plan.triggerType !== 'DeadmanSwitch';
  const usesDeadman = plan.triggerType !== 'DeathCertificate';
  const tone = plan.status === 'Configured' ? 'green' : plan.status === 'Completed' ? 'gray' : plan.status === 'Cancelled' ? 'gray' : 'amber';

  return (
    <Card>
      <SectionTitle icon={<FileCheck2 className="w-5 h-5" />} right={<Pill tone={tone}>{c.plan.statuses[plan.status]}</Pill>}>
        {c.plan.title}
      </SectionTitle>
      <dl className="grid gap-3 sm:grid-cols-3 text-sm">
        <div><dt className="text-gray-500">{c.plan.trigger}</dt><dd className="font-medium text-gray-900">{c.plan.triggers[plan.triggerType]}</dd></div>
        <div><dt className="text-gray-500">{c.plan.deadman}</dt><dd className="font-medium text-gray-900">{duration(plan.deadmanSeconds, c)}</dd></div>
        <div><dt className="text-gray-500">{c.plan.cooldown}</dt><dd className="font-medium text-gray-900">{duration(plan.cooldownSeconds, c)}</dd></div>
      </dl>

      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
        {plan.status === 'Configured' && usesDeadman && (deadmanAt > now ? fill(c.plan.triggersIn, { t: duration(deadmanAt - now, c) }) : c.plan.triggerReady)}
        {plan.status === 'Configured' && !usesDeadman && fill(c.plan.progress, { a: 0, b: plan.requiredVerifications })}
        {plan.status === 'ProofSubmitted' && fill(c.plan.progress, { a: plan.currentVerifications, b: plan.requiredVerifications })}
        {plan.status === 'CooldownActive' && (plan.cooldownEndsAt > now ? fill(c.plan.cooldownEnds, { t: duration(plan.cooldownEndsAt - now, c) }) : c.plan.claimOpen)}
        {plan.status === 'ClaimReady' && c.plan.claimOpen}
        {plan.status === 'Completed' && c.plan.statuses.Completed}
        {plan.status === 'Cancelled' && c.plan.statuses.Cancelled}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {(plan.status === 'ProofSubmitted' || (plan.status === 'CooldownActive' && plan.cooldownEndsAt > now)) && (
          <Button loading={tx.busy === 'cancel'} onClick={() => tx.run('cancel', calls.cancel(vault.id))} icon={<HeartPulse className="w-4 h-4" />}>
            {c.plan.cancel}
          </Button>
        )}
        {plan.status === 'Cancelled' && (
          <Button variant="secondary" loading={tx.busy === 'reset'} onClick={() => tx.run('reset', calls.reset(vault.id))}>{c.plan.reset}</Button>
        )}
      </div>

      {usesCertificate && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {c.plan.verifiers} · {fill(c.plan.progress, { a: plan.currentVerifications, b: plan.requiredVerifications })}
          </p>
          <ul className="space-y-1 mb-3">
            {verifiers.map(v => (
              <li key={v.address} className="font-mono text-sm text-gray-700">{shortAddr(v.address)}</li>
            ))}
          </ul>
          {plan.status === 'Configured' && (
            <form
              className="flex gap-2"
              onSubmit={async e => {
                e.preventDefault();
                if (isAddress(verifier) && (await tx.run('verifier', calls.addVerifier(vault.id, verifier.trim())))) setVerifier('');
              }}
            >
              <input className="input font-mono text-sm" placeholder={c.plan.verifierAddress} value={verifier} onChange={e => setVerifier(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={!isAddress(verifier)} loading={tx.busy === 'verifier'}>{c.plan.addVerifier}</Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

// ==================== heir view ====================

interface HeirEntry {
  vault: SnVault;
  plan: SnPlan;
  me: SnBeneficiary;
  proof: SnProof;
}

function InheritancesTab({ address }: { address: string }) {
  const c = useCopy();
  const now = useNow();
  const [entries, setEntries] = useState<HeirEntry[] | null>(null);
  const [version, setVersion] = useState(0);
  const tx = useTx(useCallback(() => setVersion(v => v + 1), []));

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = await getHeirVaultIds(address);
      const list = await Promise.all(
        ids.map(async id => {
          const [vault, plan, me, proof] = await Promise.all([getVault(id), getPlan(id), getBeneficiary(id, address), getProof(id)]);
          return { vault, plan, me, proof };
        }),
      );
      if (alive) setEntries(list.filter(e => e.me.status === 'Active' || e.me.status === 'Claimed'));
    })().catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [address, version]);

  if (entries === null) return <Loading />;
  if (entries.length === 0) return <p className="text-gray-500 text-center py-10">{c.inh.empty}</p>;

  return (
    <div className="space-y-4">
      {entries.map(e => (
        <HeirCard key={e.vault.id.toString()} entry={e} tx={tx} now={now} />
      ))}
      <ToastView toast={tx.toast} onClose={tx.clear} />
    </div>
  );
}

function HeirCard({ entry, tx, now }: { entry: HeirEntry; tx: TxState; now: number }) {
  const c = useCopy();
  const { vault, plan, me, proof } = entry;
  const id = vault.id;
  const key = (k: string) => `${k}-${id}`;
  const deadmanAt = vault.lastActivity + plan.deadmanSeconds;
  const usesDeadman = plan.triggerType !== 'DeathCertificate';
  const usesCertificate = plan.triggerType !== 'DeadmanSwitch';
  const canInitiate =
    vault.status === 'Active' &&
    ((plan.status === 'Configured' && usesDeadman && now >= deadmanAt) ||
      (plan.status === 'ProofSubmitted' && (proof.verified || (usesDeadman && now >= deadmanAt))));
  const canClaim =
    me.status === 'Active' && (plan.status === 'CooldownActive' || plan.status === 'ClaimReady') && now >= plan.cooldownEndsAt;
  const estimate = plan.distributionAmount > 0n ? plan.distributionAmount : vault.balance;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{vault.name}</p>
          <p className="text-sm text-gray-500">
            {c.inh.owner}: <span className="font-mono">{shortAddr(vault.owner)}</span>
          </p>
        </div>
        <Pill tone={plan.status === 'Configured' ? 'green' : plan.status === 'None' ? 'gray' : 'amber'}>{c.plan.statuses[plan.status]}</Pill>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
        <div>
          <dt className="text-gray-500">{c.inh.share}</dt>
          <dd className="font-semibold text-gray-900">{me.shareBps / 100}%</dd>
        </div>
        <div>
          <dt className="text-gray-500">{c.vault.balance}</dt>
          <dd className="font-semibold text-gray-900">{formatAmount(estimate, vault.token.decimals)} {vault.token.symbol}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
        {plan.status === 'None' && c.inh.notArmed}
        {plan.status === 'Configured' && usesDeadman && (deadmanAt > now ? fill(c.plan.triggersIn, { t: duration(deadmanAt - now, c) }) : c.plan.triggerReady)}
        {plan.status === 'Configured' && !usesDeadman && c.plan.statuses.Configured}
        {plan.status === 'ProofSubmitted' && fill(c.plan.progress, { a: plan.currentVerifications, b: plan.requiredVerifications })}
        {plan.status === 'CooldownActive' && (plan.cooldownEndsAt > now ? fill(c.plan.cooldownEnds, { t: duration(plan.cooldownEndsAt - now, c) }) : c.plan.claimOpen)}
        {plan.status === 'ClaimReady' && c.plan.claimOpen}
        {plan.status === 'Completed' && c.plan.statuses.Completed}
        {plan.status === 'Cancelled' && c.plan.statuses.Cancelled}
        {me.status === 'Claimed' && <span className="block font-medium text-success mt-1">{fill(c.inh.claimed, { a: `${formatAmount(me.claimedAmount, vault.token.decimals)} ${vault.token.symbol}` })}</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {canInitiate && (
          <Button loading={tx.busy === key('init')} onClick={() => tx.run(key('init'), calls.initiate(id))}>{c.plan.initiate}</Button>
        )}
        {canClaim && (
          <Button loading={tx.busy === key('claim')} onClick={() => tx.run(key('claim'), calls.claim(id))}>{c.inh.claim}</Button>
        )}
      </div>

      {usesCertificate && plan.status === 'Configured' && vault.status === 'Active' && (
        <label className="mt-4 block space-y-1.5">
          <span className="block text-sm font-medium text-gray-700">{c.inh.certFile}</span>
          <input
            type="file"
            disabled={tx.busy !== null}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) await tx.run(key('cert'), calls.submitCertificate(id, await hashDocument(file)));
            }}
          />
          {tx.busy === key('cert') && <Loader2 className="w-4 h-4 animate-spin text-primary-600" />}
        </label>
      )}
    </Card>
  );
}

// ==================== verifier view ====================

interface VerifyEntry {
  vault: SnVault;
  plan: SnPlan;
  proof: SnProof;
  verifiedNonce: number;
}

function VerifyTab({ address }: { address: string }) {
  const c = useCopy();
  const [entries, setEntries] = useState<VerifyEntry[] | null>(null);
  const [version, setVersion] = useState(0);
  const tx = useTx(useCallback(() => setVersion(v => v + 1), []));

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = await getVerifierVaultIds(address);
      const list = await Promise.all(
        ids.map(async id => {
          const [vault, plan, proof, me] = await Promise.all([getVault(id), getPlan(id), getProof(id), getVerifier(id, address)]);
          return { vault, plan, proof, verifiedNonce: me.verifiedNonce };
        }),
      );
      if (alive) setEntries(list);
    })().catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [address, version]);

  if (entries === null) return <Loading />;
  if (entries.length === 0) return <p className="text-gray-500 text-center py-10">{c.ver.empty}</p>;

  return (
    <div className="space-y-4">
      {entries.map(({ vault, plan, proof, verifiedNonce }) => {
        const pending = plan.status === 'ProofSubmitted' && !proof.verified;
        const mine = verifiedNonce >= proof.nonce && proof.nonce > 0;
        return (
          <Card key={vault.id.toString()}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{vault.name}</p>
                <p className="text-sm text-gray-500">{c.inh.owner}: <span className="font-mono">{shortAddr(vault.owner)}</span></p>
              </div>
              <Pill tone={pending ? 'amber' : 'gray'}>{c.plan.statuses[plan.status]}</Pill>
            </div>
            {pending ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-700">
                  {c.ver.hash}: <span className="font-mono break-all">{proof.documentHash}</span>
                </p>
                <p className="text-sm text-gray-500">{fill(c.plan.progress, { a: plan.currentVerifications, b: plan.requiredVerifications })}</p>
                {mine ? (
                  <p className="text-sm text-success font-medium">{c.ver.done}</p>
                ) : (
                  <Button loading={tx.busy === `v-${vault.id}`} onClick={() => tx.run(`v-${vault.id}`, calls.verifyCertificate(vault.id))}>{c.ver.verify}</Button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">{c.ver.waiting}</p>
            )}
          </Card>
        );
      })}
      <ToastView toast={tx.toast} onClose={tx.clear} />
    </div>
  );
}

// ==================== shell ====================

function Loading() {
  const c = useCopy();
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin" /> {c.loading}
    </div>
  );
}

type Tab = 'vaults' | 'inheritances' | 'verify';

function ConnectedView({ address }: { address: string }) {
  const c = useCopy();
  const { wrongNetwork } = useSnWallet();
  const [tab, setTab] = useState<Tab>('vaults');
  const [nonce, setNonce] = useState(0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {wrongNetwork && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{c.wrongNetwork}</div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div role="tablist" className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {(['vaults', 'inheritances', 'verify'] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors',
                tab === t ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-primary-700',
              )}
            >
              {c.tabs[t]}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={() => setNonce(n => n + 1)}>{c.refresh}</Button>
      </div>

      <div key={`${tab}-${nonce}`}>
        {tab === 'vaults' && <VaultsTab address={address} />}
        {tab === 'inheritances' && <InheritancesTab address={address} />}
        {tab === 'verify' && <VerifyTab address={address} />}
      </div>

      <p className="mt-10 text-center text-xs text-gray-500">
        {SN_DEMO_MODE && <>{c.demoNote} · </>}
        <a className="hover:text-primary-600" href={snExplorer.contract(SN_CONTRACT)} target="_blank" rel="noreferrer">{c.contract} {shortAddr(SN_CONTRACT)}</a>
        {' · '}
        <a className="hover:text-primary-600" href={SN_FAUCET} target="_blank" rel="noreferrer">{c.faucet}</a>
      </p>
    </div>
  );
}

function Shell() {
  const { address } = useSnWallet();
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {address ? <ConnectedView address={address} /> : <ConnectView />}
    </div>
  );
}

export default function StarknetApp() {
  return (
    <SnWalletProvider>
      <Shell />
    </SnWalletProvider>
  );
}
