import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, ChevronLeft, Check, Copy, Plus, Trash2, Video, FileText, Mic, Camera, Loader2, Sparkles } from 'lucide-react';
import { Button, Input, Card, StepProgress } from '../../components/ui';
import { useStore } from '../../store';
import { useI18n, type MessageKey } from '../../i18n';

const STEPS: MessageKey[] = ['onboarding.stepWelcome', 'onboarding.stepVault', 'onboarding.stepHeirs', 'onboarding.stepMessage', 'onboarding.stepFinish'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setOnboardingStep, completeOnboarding, addBeneficiary, beneficiaries, removeBeneficiary } = useStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vaultCreated, setVaultCreated] = useState(false);
  const [vaultAddress, setVaultAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', percentage: 50 });
  const [messageType, setMessageType] = useState<'text' | 'video' | 'audio'>('text');
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const { t } = useI18n();

  const usedPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
      setOnboardingStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setOnboardingStep(step - 1);
    }
  };

  const handleCreateVault = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 3000));
    setVaultAddress('secret1abc' + Math.random().toString(36).slice(2, 10) + '...xyz789');
    setVaultCreated(true);
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(vaultAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddBeneficiary = () => {
    if (!form.name || !form.email || usedPercentage + form.percentage > 100) return;
    addBeneficiary({
      id: Math.random().toString(36).slice(2),
      name: form.name,
      email: form.email,
      percentage: form.percentage,
      createdAt: new Date(),
    });
    setForm({ name: '', email: '', percentage: Math.min(50, 100 - usedPercentage - form.percentage) });
  };

  const handleFinish = () => {
    completeOnboarding();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xl font-bold text-primary-600">BSafe</span>
          <button className="text-sm text-gray-500 hover:text-gray-700">{t('nav.logout')}</button>
        </div>

        <StepProgress steps={STEPS.map(s => t(s))} current={step} />

        <div className="mt-8 animate-fade-in">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('onboarding.welcomeTitle')}</h2>
              <p className="text-gray-600">{t('onboarding.welcomeBody')}</p>
              <div className="text-left bg-gray-50 rounded-lg p-4 space-y-2">
                {[t('onboarding.todo1'), t('onboarding.todo2'), t('onboarding.todo3'), t('onboarding.todo4'), t('onboarding.todo5')].map((item, i) => (
                  <p key={i} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    {item}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
                <Shield className="w-4 h-4" />
                {t('onboarding.privacy')}
              </div>
              <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>{t('onboarding.start')}</Button>
            </div>
          )}

          {/* Step 2: Create Vault */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">{t('onboarding.creatingVault')}</h2>
              {!vaultCreated ? (
                <div className="text-center space-y-6">
                  {loading ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">⚡ {t('onboarding.generatingKeys')}</p>
                        <p className="text-sm text-gray-600">🔒 {t('onboarding.creatingContract')}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600">{t('onboarding.createVaultBody')}</p>
                      <Button fullWidth onClick={handleCreateVault}>{t('onboarding.createVault')}</Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-success justify-center">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">{t('onboarding.vaultCreated')}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">{t('onboarding.yourAddress')}</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-sm font-mono text-gray-900">{vaultAddress}</code>
                      <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-200">
                        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 text-center">{t('onboarding.addAssetsLater')}</p>
                </div>
              )}
              {vaultCreated && (
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>{t('onboarding.back')}</Button>
                  <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>{t('onboarding.next')}</Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Beneficiaries */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">{t('onboarding.heirsTitle')}</h2>
              <p className="text-gray-600 text-center">{t('onboarding.heirsBody')}</p>
              
              <div className="space-y-4">
                <Input label={t('onboarding.fullName')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('onboarding.namePlaceholder')} />
                <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={t('onboarding.emailPlaceholder')} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('onboarding.percentage')}</label>
                  <input
                    type="range"
                    min={1}
                    max={100 - usedPercentage}
                    value={form.percentage}
                    onChange={e => setForm({ ...form, percentage: Number(e.target.value) })}
                    className="w-full accent-primary-600"
                  />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{form.percentage}%</span>
                    <span>{t('onboarding.remaining', { percent: 100 - usedPercentage - form.percentage })}</span>
                  </div>
                </div>
                <Button variant="secondary" fullWidth onClick={handleAddBeneficiary} icon={<Plus className="w-4 h-4" />} disabled={!form.name || !form.email || usedPercentage >= 100}>
                  {t('heirs.addTitle')}
                </Button>
              </div>

              {beneficiaries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{t('onboarding.heirsAdded')}</p>
                  {beneficiaries.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{b.name}</p>
                        <p className="text-sm text-gray-500">{b.percentage}%</p>
                      </div>
                      <button onClick={() => removeBeneficiary(b.id)} className="p-1 text-gray-400 hover:text-error">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>{t('onboarding.back')}</Button>
                <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />} disabled={beneficiaries.length === 0}>{t('onboarding.next')}</Button>
              </div>
            </div>
          )}

          {/* Step 4: Message */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">{t('onboarding.messageTitle')}</h2>
              <p className="text-gray-600 text-center">{t('onboarding.messageBody')}</p>

              <div className="flex gap-2">
                {[{ type: 'text', icon: FileText, label: t('messages.text') }, { type: 'video', icon: Video, label: t('messages.video') }, { type: 'audio', icon: Mic, label: t('messages.audio') }].map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setMessageType(opt.type as typeof messageType)}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                      messageType === opt.type ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>

              {messageType === 'text' ? (
                <textarea
                  className="input min-h-[150px] resize-none"
                  placeholder={t('messages.placeholder')}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  {!recording ? (
                    <>
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-500 mb-4">{messageType === 'video' ? t('messages.recordVideo') : t('messages.recordAudio')}</p>
                      <Button onClick={() => { setRecording(true); const i = setInterval(() => setRecordTime(t => t + 1), 1000); setTimeout(() => { clearInterval(i); setRecording(false); }, 5000); }}>
                        🔴 {t('messages.startRecording')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <div className="w-4 h-4 bg-red-500 rounded-full" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900 mb-4">{Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}</p>
                      <Button variant="secondary" onClick={() => setRecording(false)}>⏹ {t('messages.stop')}</Button>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>{t('onboarding.back')}</Button>
                <Button variant="ghost" onClick={handleNext}>{t('onboarding.skip')}</Button>
                <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>{t('heirs.save')}</Button>
              </div>
            </div>
          )}

          {/* Step 5: Finalize */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('onboarding.doneTitle')}</h2>
              <p className="text-gray-600">{t('onboarding.doneBody')}</p>
              
              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('nav.beneficiaries')}</span>
                  <span className="font-medium text-gray-900">{beneficiaries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('onboarding.message')}</span>
                  <span className="font-medium text-gray-900">{message || recordTime > 0 ? `✓ ${t('onboarding.recorded')}` : t('onboarding.notRecorded')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('onboarding.address')}</span>
                  <span className="font-mono text-xs text-gray-900">{vaultAddress.slice(0, 20)}...</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>{t('onboarding.back')}</Button>
                <Button fullWidth onClick={handleFinish} icon={<ChevronRight className="w-5 h-5" />}>{t('onboarding.goDashboard')}</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
