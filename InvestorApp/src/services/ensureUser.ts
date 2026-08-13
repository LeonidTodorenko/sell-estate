// services/ensureUser.ts
import api, { writeLegacyUser } from '../api';
import { loadSession, saveSession } from './sessionStorage';

type Session = {
  accessToken: string;
  refreshToken?: string | null;
  user?: any;
  isDemo?: boolean;
  demoCode?: string | null;
};

export async function ensureUserInSession() {
  const session0 = (await loadSession()) as Session | null;

  // Без валидной сессии — выходим, пусть внешний код решает (GateScreen отправит на Login)
  if (!session0 || !session0.accessToken) {
    throw new Error('No valid session for ensureUserInSession');
  }

  if (session0.user) return session0.user;

  // Здесь access токен уже должен быть в axios (через setAccessToken/интерсептор)
  const { data: me } = await api.get('/auth/me');

  const isDemo = session0.isDemo === true || session0.user?.isDemo === true || me?.isDemo === true;
  const demoCode = session0.demoCode ?? session0.user?.demoCode ?? me?.demoCode ?? null;
  const mergedUser = { ...session0.user, ...me, isDemo, demoCode };
  const session1: Session = { ...session0, isDemo, demoCode, user: mergedUser };
  await saveSession(session1);

  // На переходный период — синхронизируем AsyncStorage('user') для легаси кода
  await writeLegacyUser({
    accessToken: session1.accessToken,
    refreshToken: session1.refreshToken,
    isDemo,
    demoCode,
    user: mergedUser,
  });

  return mergedUser;
}
