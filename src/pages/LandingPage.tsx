import { Link, useNavigate } from 'react-router-dom';
import { Shield, Zap, Lock, Users, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { Button, WalletButton, LanguageToggle } from '../components/ui';
import { useI18n } from '../i18n';

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

  const features = [
    { icon: Lock, title: t('landing.featNonCustodialTitle'), desc: t('landing.featNonCustodialBody') },
    { icon: Zap, title: t('landing.featOnChainTitle'), desc: t('landing.featOnChainBody') },
    { icon: Shield, title: t('landing.featMultisigTitle'), desc: t('landing.featMultisigBody') },
    { icon: Users, title: t('landing.featInheritanceTitle'), desc: t('landing.featInheritanceBody') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" aria-label="BSafe">
            <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-10 h-10 rounded-lg" />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navFeatures')}</a>
            <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navHow')}</a>
            <a href="#sobre" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{t('landing.navAbout')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-primary-200 rounded-full text-primary-700 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
            {t('landing.badge')}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            {t('landing.heroTitle')}{' '}
            <span className="text-primary-600">{t('landing.heroHighlight')}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t('landing.heroBody')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WalletButton />
            <a href="#como-funciona">
              <Button variant="secondary" size="lg">
                {t('landing.seeHow')}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-gray-200">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '100%', label: t('landing.statNonCustodial') },
            { value: '< 1s', label: t('landing.statTxTime') },
            { value: '$0.001', label: t('landing.statFee') },
            { value: '24/7', label: t('landing.statAvailable') },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-primary-600 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">{t('landing.howTitle')}</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            {t('landing.howBody')}
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: t('landing.step1Title'), time: t('landing.step1Time'), desc: t('landing.step1Body') },
              { step: '2', title: t('landing.step2Title'), time: t('landing.step2Time'), desc: t('landing.step2Body') },
              { step: '3', title: t('landing.step3Title'), time: t('landing.step3Time'), desc: t('landing.step3Body') },
            ].map((item, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-gray-200 shadow-subtle">
                <div className="w-16 h-16 rounded-full bg-primary-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-primary-600 font-medium mb-2">{item.time}</p>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 px-4 bg-primary-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">{t('landing.featuresTitle')}</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 p-6 bg-white rounded-xl border border-primary-100 shadow-subtle">
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inheritance Types */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">{t('landing.triggersTitle')}</h2>
          <p className="text-gray-600 text-center mb-12">
            {t('landing.triggersBody')}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: t('landing.triggerDeadmanTitle'), desc: t('landing.triggerDeadmanBody'), icon: '⏰' },
              { title: t('landing.triggerCertificateTitle'), desc: t('landing.triggerCertificateBody'), icon: '📜' },
              { title: t('landing.triggerHybridTitle'), desc: t('landing.triggerHybridBody'), icon: '🔀' },
            ].map((item, i) => (
              <div key={i} className="p-6 bg-white rounded-xl border border-gray-200 shadow-subtle text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 bg-primary-600 rounded-2xl shadow-elevated">
            <Wallet className="w-12 h-12 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">{t('landing.ctaTitle')}</h2>
            <p className="text-primary-100 mb-6">
              {t('landing.ctaBody')}
            </p>
            <div className="wallet-on-blue">
              <WalletButton />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="sobre" className="py-12 px-4 border-t border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-9 h-9 rounded-lg" />
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="https://github.com/Plague14/bsafe" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">GitHub</a>
            <a href="https://github.com/Plague14/bsafe/blob/master/docs/USER_GUIDE.md" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">Docs</a>
            <a href="https://explorer.solana.com/address/3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv?cluster=devnet" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 transition-colors">Explorer</a>
          </div>
          <p className="text-sm text-gray-500">
            {t('landing.builtFor')}
          </p>
        </div>
      </footer>
    </div>
  );
}
