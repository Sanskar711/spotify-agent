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
  /** Post-login onboarding: not dismissable, and saving is the only way out. */
  onboarding?: boolean;
  /** Called after a successful save (onboarding gate uses this to unblock chat). */
  onSaved?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ open, onClose, onboarding = false, onSaved }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [serverFallback, setServerFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.get('/settings/providers').then((r) => setProviders(r.data)).catch(() => {});
    api
      .get('/settings')
      .then((r) => {
        setProvider(r.data.provider || 'gemini');
        setModel(r.data.model || '');
        setHasKey(!!r.data.has_key);
        setServerFallback(!!r.data.server_fallback);
      })
      .catch(() => {});
  }, [open]);

  const current = providers.find((p) => p.id === provider);
  // Reusing a stored key only works while the provider is unchanged.
  const keyRequired = !apiKey.trim() && !hasKey && !serverFallback;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const body: any = { provider, model: model || undefined };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      await api.put('/settings', body);
      setSaved(true);
      setApiKey('');
      setHasKey(hasKey || !!body.apiKey);
      onSaved?.();
      if (onboarding) onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not save your settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onboarding ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#181818] border border-gray-700 p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg font-bold">
            {onboarding ? 'Connect an AI model' : 'AI Model Settings'}
          </h2>
          {!onboarding && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {onboarding
            ? 'One last step — bring your own API key to power the assistant. Gemini and Groq have free tiers.'
            : 'Choose which model answers your messages.'}
        </p>

        <label className="block text-sm mb-1 text-gray-300">Provider</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setModel(''); setHasKey(false); }}
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

        {!hasKey && serverFallback && !apiKey.trim() && (
          <p className="text-xs text-gray-500 mt-2">
            No key needed — this app has a shared key for {current?.label.split(' (')[0] || provider}.
          </p>
        )}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || keyRequired}
          className="mt-5 w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 rounded-lg py-2 font-semibold"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : onboarding ? 'Start chatting' : 'Save'}
        </button>
        {keyRequired && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Paste a key for {current?.label.split(' (')[0] || provider} to continue.
          </p>
        )}
      </div>
    </div>
  );
};

export default Settings;
