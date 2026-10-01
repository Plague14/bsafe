import { Link, useNavigate } from 'react-router-dom';
import { Shield, Zap, Lock, Users, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { Button, WalletButton } from '../components/ui';

const features = [
  { icon: Lock, title: 'Non-Custodial', desc: 'Você mantém controle total. Suas chaves, seus ativos.' },
  { icon: Zap, title: 'On-Chain', desc: 'Tudo registrado na blockchain Solana. Transparente e imutável.' },
  { icon: Shield, title: 'Multisig', desc: 'Múltiplas assinaturas para máxima segurança.' },
  { icon: Users, title: 'Herança Digital', desc: 'Transfira ativos automaticamente para seus herdeiros.' },
];

export function LandingPage() {
  const { connected } = useWallet();
  const navigate = useNavigate();

  // Redirect to dashboard if already connected
  useEffect(() => {
    if (connected) {
      navigate('/dashboard');
    }
  }, [connected, navigate]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-9 h-9 rounded-lg" />
            <span className="text-xl font-bold text-primary-700">BSafe</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Recursos</a>
            <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Como Funciona</a>
            <a href="#sobre" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Sobre</a>
          </nav>
          <WalletButton />
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-primary-200 rounded-full text-primary-700 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
            Deployed on Solana Devnet
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Carteira Multisig com{' '}
            <span className="text-primary-600">Herança Digital</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Proteja seus ativos Solana com múltiplas assinaturas e configure a transferência automática para seus herdeiros.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WalletButton />
            <a href="#como-funciona">
              <Button variant="secondary" size="lg">
                Ver como funciona
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 border-y border-gray-200">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '100%', label: 'Non-Custodial' },
            { value: '< 1s', label: 'Tempo de TX' },
            { value: '$0.001', label: 'Taxa média' },
            { value: '24/7', label: 'Disponível' },
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
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Como funciona?</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Três passos simples para proteger seus ativos e garantir a transferência para seus herdeiros.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Conecte sua Wallet', time: '10 seg', desc: 'Use Phantom, Solflare ou qualquer carteira Solana compatível.' },
              { step: '2', title: 'Crie um Vault', time: '2 min', desc: 'Configure seu cofre seguro com multisig e adicione beneficiários.' },
              { step: '3', title: 'Configure Herança', time: '5 min', desc: 'Defina o plano de herança com deadman switch ou verificação de óbito.' },
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
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Recursos</h2>
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
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Tipos de Trigger</h2>
          <p className="text-gray-600 text-center mb-12">
            Escolha como a herança será ativada
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Deadman Switch',
                desc: 'Ativação automática após período de inatividade (30 dias a 5 anos).',
                icon: '⏰',
              },
              {
                title: 'Certidão de Óbito',
                desc: 'Verificadores confirmam a autenticidade do documento.',
                icon: '📜',
              },
              {
                title: 'Híbrido',
                desc: 'Combina ambos os métodos para máxima flexibilidade.',
                icon: '🔀',
              },
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
            <h2 className="text-2xl font-bold text-white mb-4">Pronto para começar?</h2>
            <p className="text-primary-100 mb-6">
              Conecte sua carteira e crie seu primeiro vault em minutos.
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
          <span className="flex items-center gap-2">
            <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-7 h-7 rounded-md" />
            <span className="text-lg font-bold text-primary-700">BSafe</span>
          </span>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-primary-600 transition-colors">GitHub</a>
            <a href="#" className="hover:text-primary-600 transition-colors">Docs</a>
            <a href="#" className="hover:text-primary-600 transition-colors">Discord</a>
          </div>
          <p className="text-sm text-gray-500">
            Built for Colosseum Hackathon 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
