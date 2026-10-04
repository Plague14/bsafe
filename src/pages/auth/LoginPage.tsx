import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Clock, ArrowLeft } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';
import { useStore } from '../../store';
import { useI18n } from '../../i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(900);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    // Simula envio do Magic Link
    await new Promise(r => setTimeout(r, 1500));
    setSent(true);
    setLoading(false);
    
    // Simula recebimento do link
    setTimeout(() => {
      setUser({
        id: '1',
        name: email.split('@')[0],
        email,
        subscriptionTier: 'premium',
        kycStatus: 'pending',
        createdAt: new Date(),
      });
      navigate('/onboarding');
    }, 3000);
    
    // Countdown
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 0) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
        </Link>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-600 mb-2">BSafe</h1>
          <p className="text-gray-600">{sent ? t('login.emailSent') : t('login.signIn')}</p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t('login.yourEmail')}
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              {t('login.continueEmail')}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">{t('login.or')}</span>
              </div>
            </div>
            
            <Button type="button" variant="secondary" fullWidth>
              {t('login.continueGoogle')}
            </Button>
            
            <p className="text-xs text-center text-gray-500">
              {t('login.agreePrefix')}{' '}
              <a href="#" className="text-primary-600 hover:underline">{t('login.terms')}</a> {t('login.and')}{' '}
              <a href="#" className="text-primary-600 hover:underline">{t('login.privacy')}</a>
            </p>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <p className="text-gray-600 mb-2">{t('login.sentTo')}</p>
              <p className="font-semibold text-gray-900">{email}</p>
            </div>
            <p className="text-sm text-gray-500">
              {t('login.checkInbox')}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{t('login.expiresIn', { time: formatTime(countdown) })}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-primary-600">
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span>{t('login.waiting')}</span>
            </div>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setSent(false)}
            >
              {t('login.resend')}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
