import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Message from '../components/Message';
import Settings from '../components/Settings';
import ShazamButton from '../components/ShazamButton';

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, user, loadingUser, login, logout } = useAuth();
  const { messages, loading, sendMessage, pushAssistant, clearMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Capture the session token returned by the backend after Spotify login.
  useEffect(() => {
    const urlSession = searchParams.get('session');
    if (urlSession) {
      login(urlSession);
      searchParams.delete('session');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, login]);

  // Redirect to login once we know there is no session.
  useEffect(() => {
    if (!session && !searchParams.get('session')) {
      navigate('/login');
    }
  }, [session, navigate, searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const value = input;
    setInput('');
    await sendMessage(value);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="bg-[#1DB954] text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-sm">
              {(user?.displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="leading-tight">
            <h1 className="text-base font-bold">Spotify AI Assistant</h1>
            <p className="text-xs opacity-90">
              {loadingUser ? 'Loading…' : user?.displayName ? `Hi, ${user.displayName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShazamButton onResult={pushAssistant} />
          <button onClick={() => setShowSettings(true)} className="text-sm px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30">
            ⚙ Settings
          </button>
          <button onClick={clearMessages} className="text-sm px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30" title="Clear chat">
            Clear
          </button>
          <button onClick={handleLogout} className="text-sm hover:underline">
            Logout
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-24">
              <p className="text-xl font-medium mb-2">Welcome to Spotify AI Assistant 🎧</p>
              <p className="mb-4">Ask for songs by artist, genre, album, keyword, or a vibe.</p>
              <p className="text-sm">Try: “recommend chill songs like Bon Iver” · “add Blinding Lights to my queue” · tap 🎤 to identify a song playing near you.</p>
            </div>
          ) : (
            messages.map((msg, idx) => <Message key={idx} role={msg.role} content={msg.content} />)
          )}
          {loading && (
            <div className="flex justify-start mb-2">
              <div className="rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-gray-400">Thinking…</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 p-4 mb-6">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto w-full">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about music..."
            className="flex-1 bg-[#2a2a2a] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-[#1DB954] text-white px-4 py-2 rounded-lg hover:bg-[#1ed760] disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
