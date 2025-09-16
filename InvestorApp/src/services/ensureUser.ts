// services/ensureUser.ts
import api, { writeLegacyUser } from '../api';
import { loadSession, saveSession } from './sessionStorage';

type Session = {
  accessToken: string;
  refreshToken: string;
  user?: any;
};

export async function ensureUserInSession() {
  const session0 = (await loadSession()) as Session | null;

  // Без валидной сессии — выходим, пусть внешний код решает (GateScreen отправит на Login)
  if (!session0 || !session0.accessToken || !session0.refreshToken) {
    throw new Error('No valid session for ensureUserInSession');
  }

  if (session0.user) return session0.user;

  // Здесь access токен уже должен быть в axios (через setAccessToken/интерсептор)
  const { data: me } = await api.get('/auth/me');

  const session1: Session = { ...session0, user: me };
  await saveSession(session1);

  // На переходный период — синхронизируем AsyncStorage('user') для легаси кода
  await writeLegacyUser({
    accessToken: session1.accessToken,
    refreshToken: session1.refreshToken,
    user: me,
  });

  return me;
}
