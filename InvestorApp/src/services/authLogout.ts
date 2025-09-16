 
import { loadSession, clearSession } from '../services/sessionStorage';
import { api, setAccessToken } from '../api';

export async function performLogout(navigateToLogin: () => void) {
  try {
    const stored = await loadSession();
    const rt = stored?.refreshToken;
    await clearSession();
    setAccessToken(null);
    if (rt) { try { await api.post('/auth/logout', { refreshToken: rt }); } catch {} }
  } finally {
    navigateToLogin();
  }
}
