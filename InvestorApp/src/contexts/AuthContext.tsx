// src/context/AuthContext.tsx
import React, { createContext, useEffect, useState, useMemo } from 'react';
import { loadSession, saveSession, clearSession, Session } from '../services/sessionStorage';
import { api, setAccessToken, tryRefresh } from '../services/http';

type AuthState = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  state: AuthState;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (s: Session | null) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({} as any);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>('loading');
  const [session, setSessionState] = useState<Session | null>(null);

  // начальная загрузка
  useEffect(() => {
    (async () => {
      const stored = await loadSession();
      if (!stored) { setState('signedOut'); return; }

      // пробуем обновить токен (на случай, что access уже протух)
      const refreshed = await tryRefresh(stored.refreshToken).catch(() => null);
      const effective = refreshed ?? stored;

      if (effective?.accessToken) {
        setAccessToken(effective.accessToken);
        setSessionState(effective);
        if (refreshed) await saveSession(effective);
        setState('signedIn');
      } else {
        await clearSession();
        setState('signedOut');
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    session,
    setSession: async (s) => {
      setSessionState(s);
      if (s) {
        setAccessToken(s.accessToken);
        await saveSession(s);
        setState('signedIn');
      } else {
        await clearSession();
        setAccessToken(null);
        setState('signedOut');
      }
    },
    signIn: async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = res.data;
      await saveSession({ accessToken, refreshToken, user });
      setAccessToken(accessToken);
      setSessionState({ accessToken, refreshToken, user });
      setState('signedIn');
    },
    signOut: async () => {
      try {
        if (session?.refreshToken) {
          await api.post('/auth/logout', { refreshToken: session.refreshToken });
        }
      } catch {}
      await clearSession();
      setAccessToken(null);
      setSessionState(null);
      setState('signedOut');
    },
  }), [state, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
	