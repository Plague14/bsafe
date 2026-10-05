import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Lock, ShieldCheck, Users, FileCheck2, Timer, Hourglass, Wallet, Github, ExternalLink,
  KeyRound, FlaskConical, Fingerprint, XCircle, Play, Pause, CheckCircle2,
} from 'lucide-react';
import { useI18n, type MessageKey } from '../../i18n';

// Validated categorical pair (dataviz validator: all checks pass on white)
const HEIR_A = '#2563EB';
const HEIR_B = '#0891B2';
const FEE = '#94A3B8';

/** Adds `is-visible` once the element scrolls into view. */
function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`reveal ${inView ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-wider text-primary-600 mb-3">{children}</p>;
}

/** Animated count-up for headline numbers. */
function CountUp({ to, decimals = 0, active, suffix = '' }: { to: number; decimals?: number; active: boolean; suffix?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1400, 1);
      setValue(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active]);
  return <>{value.toFixed(decimals)}{suffix}</>;
}

// ---------------------------------------------------------------- Problem

export function ProblemSection() {
  const { t } = useI18n();
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const bars = [
    { label: t('landing.statWorry'), value: 89 },
    { label: t('landing.statPlan'), value: 23 },
  ];
  const [hover, setHover] = useState<number | null>(null);

  return (
    <section id="problema" className="py-24 px-4">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <Eyebrow>{t('landing.problemEyebrow')}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.problemTitle')}</h2>
          <p className="text-lg text-gray-600">{t('landing.problemBody')}</p>
        </Reveal>

        <div ref={ref} className="space-y-6">
          {/* Survey: one measure per bar, single hue on a neutral track */}
          <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-card">
            <p className="text-sm font-semibold text-gray-900 mb-5">{t('landing.surveyTitle')}</p>
            <div className="space-y-5" role="list">
              {bars.map((bar, i) => (
                <div
                  key={bar.label}
                  role="listitem"
                  className="relative"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm text-gray-600">{bar.label}</span>
                    <span className="text-2xl font-bold text-gray-900 tabular-nums">
                      <CountUp to={bar.value} active={inView} suffix="%" />
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-[1400ms] ease-out"
                      style={{ width: inView ? `${bar.value}%` : '0%', backgroundColor: i === 0 ? HEIR_A : '#1E40AF' }}
                    />
                  </div>
                  {hover === i && (
                    <div className="absolute -top-9 right-0 px-2.5 py-1 rounded-md bg-gray-900 text-white text-xs shadow-elevated whitespace-nowrap">
                      {t('landing.surveyTooltip', { value: bar.value })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-gray-400">{t('landing.surveySource')}</p>
          </div>

          {/* Headline number */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-elevated">
            <p className="text-sm text-primary-100 mb-1">{t('landing.lostLabel')}</p>
            <p className="text-4xl md:text-5xl font-bold tabular-nums">
              ≈ <CountUp to={3.7} decimals={1} active={inView} />M BTC
            </p>
            <p className="mt-2 text-xs text-primary-200">{t('landing.lostSource')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- How it works

const STEPS: { title: MessageKey; body: MessageKey; icon: typeof Lock }[] = [
  { title: 'landing.step1Title', body: 'landing.step1Body', icon: Lock },
  { title: 'landing.step2Title', body: 'landing.step2Body', icon: FileCheck2 },
  { title: 'landing.step3Title', body: 'landing.step3Body', icon: Hourglass },
  { title: 'landing.step4Title', body: 'landing.step4Body', icon: Users },
];

function StepMock({ step }: { step: number }) {
  const { t } = useI18n();
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute -inset-6 bg-primary-100/60 blur-3xl rounded-full" />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-elevated p-5 float-slow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src="/images/logo-fundo-azul.png" alt="" className="w-7 h-7 rounded-md" />
            <span className="text-sm font-semibold text-gray-900">{t('landing.mockVaultName')}</span>
          </div>
          <span className="text-sm font-bold text-gray-900 tabular-nums">12.50 SOL</span>
        </div>

        {/* Progress across the four stages */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-colors duration-500 ${i <= step ? 'bg-primary-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-2 text-sm">
            {[{ name: 'Heir A', share: 60, color: HEIR_A }, { name: 'Heir B', share: 40, color: HEIR_B }].map(h => (
              <div key={h.name} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                  {h.name}
                </span>
                <span className="font-semibold text-gray-900">{h.share}%</span>
              </div>
            ))}
            <p className="text-xs text-gray-500 pt-1">{t('landing.mockConfigured')}</p>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-2 text-sm">
            <div className="p-2.5 rounded-lg bg-gray-50 font-mono text-[11px] text-gray-600 break-all">
              SHA-256 e058c0a7…873bbbbc
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> {t('landing.mockVerified')}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="flex items-center gap-4">
            <CountdownRing />
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{t('landing.mockCooldown')}</p>
              <p className="text-gray-500">{t('landing.mockCooldownBody')}</p>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2 text-sm">
            {[{ name: 'Heir A', amount: '7.43', color: HEIR_A }, { name: 'Heir B', amount: '4.95', color: HEIR_B }].map(h => (
              <div key={h.name} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                  {h.name}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">+{h.amount} SOL</span>
              </div>
            ))}
            <p className="text-xs text-gray-500 pt-1">{t('landing.mockClaimNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActive(a => (a + 1) % STEPS.length), 3800);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <section id="como-funciona" className="py-24 px-4 bg-gradient-to-b from-white via-primary-50/60 to-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>{t('landing.howEyebrow')}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.howTitle')}</h2>
          <p className="text-lg text-gray-600">{t('landing.howBody')}</p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <ol className="space-y-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === active;
                return (
                  <li key={step.title}>
                    <button
                      type="button"
                      onClick={() => { setActive(i); setPlaying(false); }}
                      className={`w-full text-left flex gap-4 p-4 rounded-xl border transition-all duration-300 ${
                        isActive ? 'bg-white border-primary-200 shadow-card' : 'border-transparent hover:bg-white/70'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                        isActive ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-600'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-primary-600 mb-0.5">0{i + 1}</span>
                        <span className="block font-semibold text-gray-900">{t(step.title)}</span>
                        <span className={`block text-sm text-gray-600 overflow-hidden transition-all duration-300 ${isActive ? 'max-h-24 mt-1' : 'max-h-0'}`}>
                          {t(step.body)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={() => setPlaying(p => !p)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? t('landing.pause') : t('landing.play')}
            </button>
          </Reveal>
          <Reveal delay={150}>
            <StepMock step={active} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Split simulator

export function SplitSimulator() {
  const { t } = useI18n();
  const [amount, setAmount] = useState(10);
  const [shareA, setShareA] = useState(60);
  const [hover, setHover] = useState<string | null>(null);

  // Same rule as the program: each heir's gross share, 1% protocol fee on claims (Free tier)
  const total = Math.max(0, amount);
  const grossA = (total * shareA) / 100;
  const grossB = total - grossA;
  const fee = total * 0.01;
  const segments = [
    { key: 'a', label: t('landing.simHeirA'), share: shareA * 0.99, receives: grossA * 0.99, color: HEIR_A },
    { key: 'b', label: t('landing.simHeirB'), share: (100 - shareA) * 0.99, receives: grossB * 0.99, color: HEIR_B },
    { key: 'fee', label: t('landing.simFee'), share: 1, receives: fee, color: FEE },
  ];

  return (
    <section id="simulador" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>{t('landing.simEyebrow')}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.simTitle')}</h2>
          <p className="text-lg text-gray-600">{t('landing.simBody')}</p>
        </Reveal>

        <Reveal>
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-card p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">{t('landing.simVaultAmount')}</span>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="input pr-14 tabular-nums"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">SOL</span>
                </div>
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                  <span>{t('landing.simSplit')}</span>
                  <span className="tabular-nums text-gray-900">{shareA}% / {100 - shareA}%</span>
                </span>
                <input
                  type="range"
                  min={5}
                  max={95}
                  value={shareA}
                  onChange={e => setShareA(Number(e.target.value))}
                  className="w-full accent-primary-600 mt-3"
                  aria-label={t('landing.simSplit')}
                />
              </label>
            </div>

            {/* Legend (>= 2 series) */}
            <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
              {segments.map(s => (
                <span key={s.key} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>

            {/* Part-to-whole: horizontal stacked bar with 2px gaps and direct labels */}
            <div className="relative">
              <div className="flex h-14 gap-0.5 rounded-lg overflow-hidden" role="img" aria-label={t('landing.simChartLabel')}>
                {segments.map(s => (
                  <div
                    key={s.key}
                    className="h-full flex items-center justify-center text-xs font-semibold text-white transition-[width] duration-500 ease-out cursor-default"
                    style={{ width: `${s.share}%`, backgroundColor: s.color, opacity: hover && hover !== s.key ? 0.55 : 1 }}
                    onMouseEnter={() => setHover(s.key)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {s.share >= 12 && `${s.share.toFixed(1)}%`}
                  </div>
                ))}
              </div>
              {hover && (() => {
                const s = segments.find(x => x.key === hover)!;
                return (
                  <div className="absolute -top-11 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs shadow-elevated whitespace-nowrap">
                    {s.label}: {s.receives.toFixed(3)} SOL ({s.share.toFixed(1)}%)
                  </div>
                );
              })()}
            </div>

            {/* Table view: same numbers, accessible without hover */}
            <table className="w-full mt-6 text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 font-medium">{t('landing.simColRecipient')}</th>
                  <th className="py-2 font-medium text-right">{t('landing.simColShare')}</th>
                  <th className="py-2 font-medium text-right">{t('landing.simColReceives')}</th>
                </tr>
              </thead>
              <tbody>
                {segments.map(s => (
                  <tr key={s.key} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-gray-700">{s.share.toFixed(1)}%</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-gray-900">{s.receives.toFixed(3)} SOL</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-500">{t('landing.simNote')}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Triggers

function CountdownRing() {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="flex-shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#DBEAFE" strokeWidth="6" />
      <circle
        cx="34" cy="34" r={r} fill="none" stroke="#2563EB" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * 0.3} transform="rotate(-90 34 34)"
      >
        <animate attributeName="stroke-dashoffset" values={`${c * 0.05};${c * 0.95};${c * 0.05}`} dur="6s" repeatCount="indefinite" />
      </circle>
      <Timer x="22" y="22" width="24" height="24" color="#2563EB" />
    </svg>
  );
}

function HashTyping() {
  const full = 'e058c0a79569d0427ee7020690b7574665518f2d';
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(full.length);
      return;
    }
    const id = setInterval(() => setN(v => (v >= full.length + 12 ? 0 : v + 1)), 90);
    return () => clearInterval(id);
  }, []);
  return <span className="caret font-mono text-xs text-gray-700 break-all">{full.slice(0, Math.min(n, full.length))}</span>;
}

export function TriggersSection() {
  const { t } = useI18n();
  const cards = [
    {
      icon: Timer,
      title: t('landing.triggerDeadmanTitle'),
      body: t('landing.triggerDeadmanBody'),
      visual: (
        <div className="flex items-center gap-4">
          <CountdownRing />
          <p className="text-sm text-gray-600">{t('landing.triggerDeadmanVisual')}</p>
        </div>
      ),
    },
    {
      icon: Fingerprint,
      title: t('landing.triggerCertificateTitle'),
      body: t('landing.triggerCertificateBody'),
      visual: (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-gray-50"><HashTyping /></div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <ShieldCheck className="w-4 h-4 text-primary-600" /> {t('landing.triggerCertificateVisual')}
          </div>
        </div>
      ),
    },
    {
      icon: XCircle,
      title: t('landing.triggerCancelTitle'),
      body: t('landing.triggerCancelBody'),
      visual: (
        <svg viewBox="0 0 220 60" className="w-full h-14">
          <line x1="10" y1="30" x2="210" y2="30" stroke="#DBEAFE" strokeWidth="4" strokeLinecap="round" />
          <line x1="10" y1="30" x2="130" y2="30" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" className="dash-flow" />
          <circle cx="10" cy="30" r="7" fill="#2563EB" />
          <circle cx="130" cy="30" r="9" fill="#fff" stroke="#2563EB" strokeWidth="3" />
          <path d="M126 26 l8 8 M134 26 l-8 8" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="210" cy="30" r="7" fill="#CBD5E1" />
        </svg>
      ),
    },
  ];

  return (
    <section id="recursos" className="py-24 px-4 bg-primary-50/50">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>{t('landing.triggersEyebrow')}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.triggersTitle')}</h2>
          <p className="text-lg text-gray-600">{t('landing.triggersBody')}</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.title} delay={i * 120}>
                <div className="h-full p-6 bg-white rounded-2xl border border-primary-100 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-600 mb-5 flex-1">{card.body}</p>
                  {card.visual}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Under the hood

export function UnderTheHoodSection() {
  const { t } = useI18n();
  const items: { icon: typeof Lock; title: MessageKey; body: MessageKey }[] = [
    { icon: Wallet, title: 'landing.hood1Title', body: 'landing.hood1Body' },
    { icon: KeyRound, title: 'landing.hood2Title', body: 'landing.hood2Body' },
    { icon: Fingerprint, title: 'landing.hood3Title', body: 'landing.hood3Body' },
    { icon: XCircle, title: 'landing.hood4Title', body: 'landing.hood4Body' },
    { icon: FlaskConical, title: 'landing.hood5Title', body: 'landing.hood5Body' },
    { icon: Github, title: 'landing.hood6Title', body: 'landing.hood6Body' },
  ];
  return (
    <section id="sobre" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>{t('landing.hoodEyebrow')}</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.hoodTitle')}</h2>
          <p className="text-lg text-gray-600">{t('landing.hoodBody')}</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={(i % 3) * 100}>
                <div className="h-full p-5 rounded-2xl border border-gray-200 bg-white hover:border-primary-200 transition-colors">
                  <Icon className="w-5 h-5 text-primary-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">{t(item.title)}</h3>
                  <p className="text-sm text-gray-600">{t(item.body)}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <a href="https://github.com/Plague14/bsafe" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-primary-300 hover:text-primary-700">
            <Github className="w-4 h-4" /> {t('landing.viewCode')}
          </a>
          <a href="https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-primary-300 hover:text-primary-700">
            <ExternalLink className="w-4 h-4" /> {t('landing.viewProgram')}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
