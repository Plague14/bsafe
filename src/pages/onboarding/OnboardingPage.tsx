import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, ChevronLeft, Check, Copy, Plus, Trash2, Video, FileText, Mic, Camera, Loader2, Sparkles } from 'lucide-react';
import { Button, Input, Card, StepProgress } from '../../components/ui';
import { useStore } from '../../store';

const STEPS = ['Bem-vindo', 'Criar Cofre', 'Herdeiros', 'Mensagem', 'Finalizar'];

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
          <button className="text-sm text-gray-500 hover:text-gray-700">Sair</button>
        </div>

        <StepProgress steps={STEPS} current={step} />

        <div className="mt-8 animate-fade-in">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Bem-vindo ao BSafe</h2>
              <p className="text-gray-600">Configure sua herança digital em apenas 5 minutos.</p>
              <div className="text-left bg-gray-50 rounded-lg p-4 space-y-2">
                {['Criar seu cofre seguro', 'Adicionar herdeiros', 'Gravar uma mensagem', 'Validar sua identidade', 'Escolher seu plano'].map((item, i) => (
                  <p key={i} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    {item}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
                <Shield className="w-4 h-4" />
                Seus dados são 100% privados e encriptados. Nós nunca os vemos.
              </div>
              <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>Começar</Button>
            </div>
          )}

          {/* Step 2: Create Vault */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">Criando seu cofre</h2>
              {!vaultCreated ? (
                <div className="text-center space-y-6">
                  {loading ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">⚡ Gerando chaves...</p>
                        <p className="text-sm text-gray-600">🔒 Criando contrato...</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600">Vamos criar seu cofre seguro na blockchain.</p>
                      <Button fullWidth onClick={handleCreateVault}>Criar Cofre</Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-success justify-center">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Cofre criado com sucesso!</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500 mb-2">Seu endereço (para receber ativos):</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-sm font-mono text-gray-900">{vaultAddress}</code>
                      <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-200">
                        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 text-center">Você pode adicionar ativos agora ou depois</p>
                </div>
              )}
              {vaultCreated && (
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>Voltar</Button>
                  <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>Próximo</Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Beneficiaries */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">Seus Herdeiros</h2>
              <p className="text-gray-600 text-center">Quem vai receber seus ativos?</p>
              
              <div className="space-y-4">
                <Input label="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="João Silva" />
                <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="joao@email.com" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Percentual (%)</label>
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
                    <span>Restante: {100 - usedPercentage - form.percentage}%</span>
                  </div>
                </div>
                <Button variant="secondary" fullWidth onClick={handleAddBeneficiary} icon={<Plus className="w-4 h-4" />} disabled={!form.name || !form.email || usedPercentage >= 100}>
                  Adicionar Herdeiro
                </Button>
              </div>

              {beneficiaries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Herdeiros adicionados:</p>
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
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>Voltar</Button>
                <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />} disabled={beneficiaries.length === 0}>Próximo</Button>
              </div>
            </div>
          )}

          {/* Step 4: Message */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center">Sua Mensagem</h2>
              <p className="text-gray-600 text-center">Deixe uma mensagem para seus herdeiros (opcional)</p>

              <div className="flex gap-2">
                {[{ type: 'text', icon: FileText, label: 'Texto' }, { type: 'video', icon: Video, label: 'Vídeo' }, { type: 'audio', icon: Mic, label: 'Áudio' }].map(opt => (
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
                  placeholder="Escreva sua mensagem aqui..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  {!recording ? (
                    <>
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-500 mb-4">{messageType === 'video' ? 'Grave um vídeo' : 'Grave um áudio'}</p>
                      <Button onClick={() => { setRecording(true); const i = setInterval(() => setRecordTime(t => t + 1), 1000); setTimeout(() => { clearInterval(i); setRecording(false); }, 5000); }}>
                        🔴 Iniciar Gravação
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <div className="w-4 h-4 bg-red-500 rounded-full" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900 mb-4">{Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}</p>
                      <Button variant="secondary" onClick={() => setRecording(false)}>⏹ Parar</Button>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>Voltar</Button>
                <Button variant="ghost" onClick={handleNext}>Pular</Button>
                <Button fullWidth onClick={handleNext} icon={<ChevronRight className="w-5 h-5" />}>Salvar</Button>
              </div>
            </div>
          )}

          {/* Step 5: Finalize */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Tudo pronto!</h2>
              <p className="text-gray-600">Seu cofre está configurado e protegido.</p>
              
              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Herdeiros</span>
                  <span className="font-medium text-gray-900">{beneficiaries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Mensagem</span>
                  <span className="font-medium text-gray-900">{message || recordTime > 0 ? '✓ Gravada' : 'Não gravada'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Endereço</span>
                  <span className="font-mono text-xs text-gray-900">{vaultAddress.slice(0, 20)}...</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack} icon={<ChevronLeft className="w-5 h-5" />}>Voltar</Button>
                <Button fullWidth onClick={handleFinish} icon={<ChevronRight className="w-5 h-5" />}>Ir para Dashboard</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
