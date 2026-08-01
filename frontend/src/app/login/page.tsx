'use client';

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const ERRORS: Record<string, string> = {
  auth_failed: 'Spotify login failed. Please try again.',
  auth_failed_token_exchange:
    'Spotify rejected the login. Check the app credentials and that the redirect URI matches exactly.',
  auth_failed_profile: 'Could not read your Spotify profile. Please try again.',
  not_allowlisted:
    "This Spotify account isn't approved for this app yet. The app is in development mode, so the owner has to add your Spotify account email to the allowlist before you can log in.",
  auth_failed_db: 'Signed in with Spotify, but the account database is unreachable. Contact the app owner.',
  auth_failed_session: 'Could not create your session. Please try again.',
  state_mismatch: 'Security check failed — the login took too long. Please try again.',
  no_code: 'No authorization code returned by Spotify.',
  spotify_access_denied: 'You declined the Spotify permissions request.',
};

function messageFor(code: string) {
  if (ERRORS[code]) return ERRORS[code];
  // Spotify passes its own error slugs through as `spotify_<slug>`.
  if (code.startsWith('spotify_')) {
    return `Spotify refused the login (${code.slice(8)}). If this app is in development mode, your account must be added as a test user.`;
  }
  return 'Something went wrong during login.';
}

export default function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate('/app');
  }, [navigate, session]);

  useEffect(() => {
    const e = searchParams.get('error');
    if (e) {
      setError(messageFor(e));
      setDetail(searchParams.get('detail'));
    }
  }, [searchParams]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      const response = await api.get('/auth/login');
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        setError('No authorization URL received.');
        setBusy(false);
      }
    } catch {
      setError('Could not reach the server. Is the backend running?');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center flex flex-col items-center px-6">
        <h1 className="text-4xl font-bold text-white mb-2">Spotify AI Agent</h1>
        <p className="text-gray-400 mb-8">Discover, recognize, and queue music with AI.</p>
        <button
          onClick={handleLogin}
          disabled={busy}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-full flex items-center gap-2"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          {busy ? 'Redirecting…' : 'Login with Spotify'}
        </button>
        {error && (
          <div className="mt-4 max-w-md">
            <p className="text-red-400 text-sm">{error}</p>
            {detail && (
              <p className="text-gray-500 text-xs mt-1 font-mono break-words">{detail}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
