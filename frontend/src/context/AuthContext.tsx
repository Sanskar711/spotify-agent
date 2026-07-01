import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../utils/api';

export interface UserProfile {
  id: string;
  spotifyId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  product?: string;
}

interface AuthContextType {
  session: string | null;
  user: UserProfile | null;
  loadingUser: boolean;
  login: (sessionToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<string | null>(() => localStorage.getItem('session_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(!!localStorage.getItem('session_token'));

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      // Session invalid/expired — clear it.
      localStorage.removeItem('session_token');
      setSession(null);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      setLoadingUser(true);
      fetchMe();
    } else {
      setUser(null);
      setLoadingUser(false);
    }
  }, [session, fetchMe]);

  const login = useCallback((sessionToken: string) => {
    localStorage.setItem('session_token', sessionToken);
    setSession(sessionToken);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('session_token');
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loadingUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
