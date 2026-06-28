import React, { createContext, useEffect, useState, useMemo } from 'react';
import { loadSession, saveSession, clearSession, Session } from '../services/sessionStorage';
import { api, setAccessToken, tryRefresh } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthState = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  state: AuthState;
  session: Session | null;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (s: Session | null) => Promise<void>;
  continueAsGuest: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({} as any);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>('loading');
  const [session, setSessionState] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadSession();

      if (!stored) {
        setState('signedOut');
        return;
      }

      const refreshed = await tryRefresh(stored.refreshToken).catch(() => null);
      const effective = refreshed ?? stored;

      if (effective?.accessToken) {
        setAccessToken(effective.accessToken);
        setSessionState(effective);
        setIsGuest(false);

        if (refreshed) await saveSession(effective);

        setState('signedIn');
      } else {
        await clearSession();
        setAccessToken(null);
        setSessionState(null);
        setIsGuest(false);
        setState('signedOut');
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    session,
    isGuest,

    continueAsGuest: async () => {
      await clearSession();
      await AsyncStorage.removeItem('user');

      setAccessToken(null);
      setSessionState(null);
      setIsGuest(true);
      setState('signedIn');
    },

    setSession: async (s) => {
      setSessionState(s);

      if (s) {
        setIsGuest(false);
        setAccessToken(s.accessToken);
        await saveSession(s);
        setState('signedIn');
      } else {
        await clearSession();
        await AsyncStorage.removeItem('user');

        setAccessToken(null);
        setSessionState(null);
        setIsGuest(false);
        setState('signedOut');
      }
    },

    signIn: async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('user', JSON.stringify(res.data));

      const { accessToken, refreshToken, user } = res.data;

      await saveSession({ accessToken, refreshToken, user });
      setAccessToken(accessToken);
      setSessionState({ accessToken, refreshToken, user });
      setIsGuest(false);
      setState('signedIn');
    },

    signOut: async () => {
      try {
        if (session?.refreshToken) {
          await api.post('/auth/logout', { refreshToken: session.refreshToken });
        }
      } catch {}

      await clearSession();
      await AsyncStorage.removeItem('user');

      setAccessToken(null);
      setSessionState(null);
      setIsGuest(false);
      setState('signedOut');
    },
  }), [state, session, isGuest]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};