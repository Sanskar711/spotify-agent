import React, { useEffect, useState } from 'react';
import api from '../utils/api';

interface Provider {
  id: string;
  label: string;
  defaultModel: string;
  keyUrl: string;
  free: boolean;
}

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ open, onClose }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/settings/providers').then((r) => setProviders(r.data)).catch(() => {});
    api
      .get('/settings')
      .then((r) => {
        setProvider(r.data.provider || 'gemini');
        setModel(r.data.model || '');
        setHasKey(!!r.data.has_key);
      })
      .catch(() => {});
  }, [open]);

  const current = providers.find((p) => p.id === provider);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: any = { provider, model: model || undefined };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      await api.put('/settings', body);
      setSaved(true);
      setApiKey('');
      setHasKey(hasKey || !!body.apiKey);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-[#181818] border border-gray-700 p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">AI Model Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <label className="block text-sm mb-1 text-gray-300">Provider</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setModel(''); }}
          className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}{p.free ? ' — free' : ''}
            </option>
          ))}
        </select>

        <label className="block text-sm mb-1 text-gray-300">
          Model <span className="text-gray-500">(optional)</span>
        </label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={current?.defaultModel || 'default'}
          className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
        />

        <label className="block text-sm mb-1 text-gray-300">
          API Key {hasKey && <span className="text-[#1DB954]">(saved — leave blank to keep)</span>}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? '••••••••••••' : 'Paste your API key'}
          className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
        />
        {current && (
          <a href={current.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1DB954] hover:underline">
            Get a {current.free ? 'free ' : ''}{current.label.split(' (')[0]} key →
          </a>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 rounded-lg py-2 font-semibold"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
