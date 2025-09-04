// src/services/http.ts
import axios from 'axios';
import { saveSession, loadSession } from './sessionStorage';

export const api = axios.create({
  baseURL: 'https://your.api', // ← ваш адрес
  timeout: 15000,
});

let accessTokenInMemory: string | null = null;
export function setAccessToken(token: string | null) {
  accessTokenInMemory = token;
}

api.interceptors.request.use((config) => {
  if (accessTokenInMemory && config.headers) {
    config.headers.Authorization = `Bearer ${accessTokenInMemory}`;
  }
  return config;
});

let refreshingPromise: Promise<string | null> | null = null;

export async function tryRefresh(refreshToken?: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const token = refreshToken ?? (await loadSession())?.refreshToken;
    if (!token) return null;
    const { data } = await axios.post('https://your.api/auth/refresh', { refreshToken: token });
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retry) {
      original._retry = true;
      refreshingPromise = refreshingPromise ?? (async () => {
        const refreshed = await tryRefresh();
        if (refreshed) {
          setAccessToken(refreshed.accessToken);
          const session = await loadSession();
          await saveSession({ ...(session ?? {} as any), ...refreshed });
          return refreshed.accessToken;
        }
        return null;
      })();

      const newAccess = await refreshingPromise;
      refreshingPromise = null;

      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);
