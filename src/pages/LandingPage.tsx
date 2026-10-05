import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Github, FlaskConical, Radio, ArrowDown, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { lazy, Suspense, useEffect } from 'react';
import { Button, WalletButton, LanguageToggle } from '../components/ui';
import {
  ProblemSection, HowItWorksSection, SplitSimulator, TriggersSection, UnderTheHoodSection, Reveal,
} from '../components/landing/sections';
import { useI18n } from '../i18n';

// three.js is loaded on demand so the hero text paints immediately
const HeroScene = lazy(() => import('../components/landing/HeroScene'));

export function LandingPage() {
  const { connected } = useWallet();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Redirect to dashboard if already connected
  useEffect(() => {
    if (connected) {
      navigate('/dashboard');
    }
  }, [connected, navigate]);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/70">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" aria-label="BSafe">
            <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-10 h-10 rounded-lg" />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navHow')}</a>
            <a href="#recursos" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navFeatures')}</a>
            <a href="#simulador" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navSimulator')}</a>
            <a href="#sobre" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navAbout')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="hidden sm:block"><WalletButton /></div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 landing-grid-bg pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[38rem] h-[38rem] rounded-full bg-primary-100/70 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-48 -left-32 w-[30rem] h-[30rem] rounded-full bg-cyan-100/60 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 items-center min-h-[calc(100vh-8rem)]">
          <div className="text-center lg:text-left min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-primary-200 rounded-full text-primary-700 text-sm mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-primary-600 pulse-dot" />
              {t('landing.badge')}
            </div>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
              {t('landing.heroTitle')}{' '}
              <span className="text-gradient-brand">{t('landing.heroHighlight')}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
              {t('landing.heroBody')}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start wallet-lg">
              <WalletButton />
              <a href="#como-funciona">
                <Button variant="secondary" size="lg" icon={<ArrowDown className="w-4 h-4" />}>
                  {t('landing.seeHow')}
                </Button>
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 justify-center lg:justify-start text-sm text-gray-600">
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-600" />{t('landing.trustNonCustodial')}</li>
              <li className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary-600" />{t('landing.trustTests')}</li>
              <li className="flex items-center gap-2"><Github className="w-4 h-4 text-primary-600" />{t('landing.trustOpenSource')}</li>
              <li className="flex items-center gap-2"><Radio className="w-4 h-4 text-primary-600" />{t('landing.trustDevnet')}</li>
            </ul>
          </div>

          <div className="relative min-w-0 h-[380px] md:h-[520px] lg:h-[600px]">
            <Suspense fallback={<div className="w-full h-full" />}>
              <HeroScene />
            </Suspense>
            {/* Floating labels around the scene */}
            <div className="hidden md:flex absolute top-10 left-2 items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-card text-sm float-slow">
              <Wallet className="w-4 h-4 text-primary-600" />
              <span className="font-medium text-gray-900">{t('landing.floatVault')}</span>
            </div>
            <div className="hidden md:flex absolute bottom-16 right-2 items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-card text-sm float-slow" style={{ animationDelay: '1.5s' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0891B2' }} />
              <span className="font-medium text-gray-900">{t('landing.floatHeirs')}</span>
            </div>
          </div>
        </div>
      </section>

      <ProblemSection />
      <HowItWorksSection />
      <TriggersSection />
      <SplitSimulator />
      <UnderTheHoodSection />

      {/* CTA */}
      <section className="py-24 px-4">
        <Reveal className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden p-10 md:p-14 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 rounded-3xl shadow-elevated text-center">
            <div className="absolute inset-0 opacity-30 landing-grid-bg pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('landing.ctaTitle')}</h2>
              <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">{t('landing.ctaBody')}</p>
              <div className="wallet-on-blue wallet-lg inline-block">
                <WalletButton />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-9 h-9 rounded-lg" />
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="https://github.com/Plague14/bsafe" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">GitHub</a>
            <a href="https://github.com/Plague14/bsafe/blob/master/docs/USER_GUIDE.md" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">Docs</a>
            <a href="https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">Explorer</a>
          </div>
          <p className="text-sm text-gray-500">{t('landing.builtFor')}</p>
        </div>
      </footer>
    </div>
  );
}
