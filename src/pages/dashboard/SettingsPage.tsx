import { useState } from 'react';
import { User, Shield, Bell, Eye, EyeOff, Copy, Check, Smartphone, Monitor, LogOut } from 'lucide-react';
import { Card, Button, Input } from '../../components/ui';
import { useStore } from '../../store';

const tabs = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'security', label: 'Segurança', icon: Shield },
  { id: 'notifications', label: 'Notificações', icon: Bell },
];

const sessions = [
  { device: 'Chrome (Windows)', location: 'São Paulo', time: 'Agora', current: true },
  { device: 'iPhone (iOS)', location: 'São Paulo', time: '2h atrás', current: false },
];

export function SettingsPage() {
  const { user } = useStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });

  const viewingKey = 'api_key_sk_live_abcdef123456789xyz5Jx2';

  const copyKey = () => {
    navigator.clipboard.writeText(viewingKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie sua conta e preferências</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit p-4">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <Card header={<span className="font-semibold text-gray-900">👤 Perfil</span>}>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700">
                    {form.name?.charAt(0) || 'U'}
                  </div>
                  <Button variant="secondary" size="sm">Alterar foto</Button>
                </div>
                <Input label="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <div>
                  <Input label="Email" value={form.email} disabled />
                  <p className="text-sm text-success mt-1">✓ Verificado</p>
                </div>
                <Input label="Telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+55 11 98765-4321" />
                <Button>Salvar Alterações</Button>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <>
              <Card header={<span className="font-semibold text-gray-900">🔐 Autenticação</span>}>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked disabled className="accent-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">Magic Link</p>
                        <p className="text-sm text-gray-500">Login por email (ativo)</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="accent-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">2FA via SMS</p>
                        <p className="text-sm text-gray-500">Verificação por SMS</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">Configurar</Button>
                  </label>
                  <label className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="accent-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">2FA via Authenticator</p>
                        <p className="text-sm text-gray-500">Google Authenticator, Authy</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">Configurar</Button>
                  </label>
                </div>
              </Card>

              <Card header={<span className="font-semibold text-gray-900">🔑 Viewing Keys</span>}>
                <p className="text-sm text-gray-500 mb-4">Sua viewing key permite acessar dados do seu cofre.</p>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <code className="flex-1 text-sm font-mono">{showKey ? viewingKey : '••••••••••••••••••••••••••••••••'}</code>
                  <button onClick={() => setShowKey(!showKey)} className="p-2 rounded-lg hover:bg-gray-200">
                    {showKey ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                  </button>
                  <button onClick={copyKey} className="p-2 rounded-lg hover:bg-gray-200">
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <div className="mt-4">
                  <Button size="sm" variant="secondary">Regenerar</Button>
                </div>
              </Card>

              <Card header={<span className="font-semibold text-gray-900">📱 Sessões Ativas</span>}>
                <div className="space-y-3">
                  {sessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {s.device.includes('Chrome') ? <Monitor className="w-5 h-5 text-gray-400" /> : <Smartphone className="w-5 h-5 text-gray-400" />}
                        <div>
                          <p className="font-medium text-gray-900">
                            {s.device}
                            {s.current && <span className="ml-2 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">atual</span>}
                          </p>
                          <p className="text-sm text-gray-500">{s.time} • {s.location}</p>
                        </div>
                      </div>
                      {!s.current && <Button size="sm" variant="ghost" className="text-error">Encerrar</Button>}
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="mt-4 text-error" icon={<LogOut className="w-4 h-4" />}>Encerrar todas as outras sessões</Button>
              </Card>
            </>
          )}

          {activeTab === 'notifications' && (
            <Card header={<span className="font-semibold text-gray-900">🔔 Preferências de Notificações</span>}>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Email</h4>
                  <div className="space-y-2">
                    {['Depósitos e saques', 'Mudanças na herança', 'Renovações de plano', 'Newsletter (semanal)'].map((item, i) => (
                      <label key={item} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" defaultChecked={i < 3} className="accent-primary-600" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Push (Browser)</h4>
                  <div className="space-y-2">
                    {['Transações importantes', 'Todas as atividades'].map((item, i) => (
                      <label key={item} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" defaultChecked={i === 0} className="accent-primary-600" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">SMS</h4>
                  <div className="space-y-2">
                    {['Alertas de segurança', 'Transações'].map((item, i) => (
                      <label key={item} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" defaultChecked={i === 0} className="accent-primary-600" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button>Salvar Preferências</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
