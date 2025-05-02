import React, { useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Message from '../components/Message';

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, setToken } = useAuth();
  const { messages, loading, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = React.useState('');

  useEffect(() => {
    // Check for token in URL
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      // Remove token from URL
      searchParams.delete('token');
      setSearchParams(searchParams);
    } else if (!token) {
      navigate('/login');
    }
  }, [token, navigate, searchParams, setSearchParams, setToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setInput('');
    await sendMessage(input);
   
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
      {/* Header */}
      <header className="bg-[#1DB954] text-white px-6 py-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">Spotify AI Assistant</h1>
        <button
          onClick={handleLogout}
          className="text-sm hover:underline"
        >
          Logout
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 justify-center overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-32">
            <p className="text-xl font-medium mb-2">Welcome to Spotify AI Assistant 🎧</p>
            <p className="mb-4">Ask me to find songs, playlists, or add songs to your queue.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <Message key={idx} role={msg.role} content={msg.content} />
          ))
        )}
        <div ref={messagesEndRef} />
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
    </div>
  );
}
