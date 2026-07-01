import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContextType {
  messages: Message[];
  loading: boolean;
  sendMessage: (content: string) => Promise<void>;
  pushAssistant: (content: string) => void;
  clearMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();

  // Load persisted history when a session becomes available.
  useEffect(() => {
    if (!session) {
      setMessages([]);
      return;
    }
    api
      .get('/chat/history')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMessages(res.data.map((m: any) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => {});
  }, [session]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading || !session) return;
      const userMessage = content.trim();
      setLoading(true);
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      try {
        const response = await api.post('/chat', { query: userMessage });
        setMessages((prev) => [...prev, { role: 'assistant', content: response.data.response }]);
      } catch (err: any) {
        const detail = err?.response?.data?.detail || err?.response?.data?.error;
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: detail ? `Something went wrong: ${detail}` : 'Sorry, something went wrong. Please try again.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, session]
  );

  const pushAssistant = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content }]);
  }, []);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    try {
      await api.delete('/chat/history');
    } catch {}
  }, []);

  return (
    <ChatContext.Provider value={{ messages, loading, sendMessage, pushAssistant, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
