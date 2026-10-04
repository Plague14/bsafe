import { useState } from 'react';
import { Plus, Video, FileText, Mic, Play, Trash2, Camera, Square, Clock } from 'lucide-react';
import { Card, Button, Modal } from '../../components/ui';
import { useStore } from '../../store';
import { useI18n } from '../../i18n';

export function MessagesPage() {
  const { documents, addDocument, removeDocument, beneficiaries } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [messageType, setMessageType] = useState<'text' | 'video' | 'audio'>('text');
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState('all');
  const { t, locale } = useI18n();

  const handleSave = () => {
    addDocument({
      id: Math.random().toString(36).slice(2),
      type: messageType,
      title: messageType === 'text' ? t('messages.letter') : messageType === 'video' ? t('messages.video') : t('messages.audio'),
      cid: 'QmExample...',
      duration: messageType !== 'text' ? recordTime : undefined,
      size: 1024,
      createdAt: new Date(),
      forBeneficiary: selectedBeneficiary === 'all' ? undefined : selectedBeneficiary,
    });
    setModalOpen(false);
    setMessage('');
    setRecordTime(0);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('messages.confirmDelete'))) removeDocument(id);
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.messages')}</h1>
          <p className="text-gray-500">{t('messages.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} icon={<Plus className="w-4 h-4" />}>{t('messages.new')}</Button>
      </div>

      <Card className="bg-primary-50 border-primary-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{t('messages.leaveTitle')}</h3>
            <p className="text-sm text-gray-600">{t('messages.leaveBody')}</p>
          </div>
        </div>
      </Card>

      {documents.length > 0 ? (
        <div className="space-y-4">
          {documents.map(doc => (
            <Card key={doc.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  doc.type === 'video' ? 'bg-blue-100 text-blue-600' :
                  doc.type === 'audio' ? 'bg-amber-100 text-amber-600' : 'bg-primary-100 text-primary-600'
                }`}>
                  {doc.type === 'video' ? <Video className="w-6 h-6" /> : doc.type === 'audio' ? <Mic className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {doc.type === 'video' ? t('messages.video') : doc.type === 'audio' ? t('messages.audio') : t('messages.letter')}
                    {doc.forBeneficiary ? ` ${t('messages.forName', { name: beneficiaries.find(b => b.id === doc.forBeneficiary)?.name ?? '' })}` : ` ${t('messages.forAll')}`}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {doc.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(doc.duration)}</span>}
                    <span>{new Date(doc.createdAt).toLocaleDateString(locale)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" icon={<Play className="w-4 h-4" />}>{t('messages.view')}</Button>
                <button onClick={() => handleDelete(doc.id)} className="p-2 rounded-lg text-gray-400 hover:text-error hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.emptyTitle')}</h3>
          <p className="text-gray-500 mb-6">{t('messages.emptyBody')}</p>
          <Button onClick={() => setModalOpen(true)} icon={<Plus className="w-4 h-4" />}>{t('messages.recordFirst')}</Button>
        </Card>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setMessage(''); setRecordTime(0); }}
        title={t('messages.new')}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={messageType === 'text' ? !message : recordTime === 0}>{t('heirs.save')}</Button>
          </div>
        }
      >
        <div className="space-y-6">
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
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('messages.recipient')}</label>
            <select className="input" value={selectedBeneficiary} onChange={e => setSelectedBeneficiary(e.target.value)}>
              <option value="all">{t('messages.allHeirs')}</option>
              {beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {messageType === 'text' ? (
            <textarea className="input min-h-[200px] resize-none" placeholder={t('messages.placeholder')} value={message} onChange={e => setMessage(e.target.value)} />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              {!recording ? (
                <>
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">{messageType === 'video' ? t('messages.recordVideo') : t('messages.recordAudio')}</p>
                  <Button onClick={() => { setRecording(true); const i = setInterval(() => setRecordTime(t => t + 1), 1000); setTimeout(() => { clearInterval(i); setRecording(false); }, 5000); }}>
                    🔴 {t('messages.startRecording')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <div className="w-4 h-4 bg-red-500 rounded-full" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-4">{formatDuration(recordTime)}</p>
                  <Button variant="secondary" icon={<Square className="w-4 h-4" />} onClick={() => setRecording(false)}>{t('messages.stop')}</Button>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
