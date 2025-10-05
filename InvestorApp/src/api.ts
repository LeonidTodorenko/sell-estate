 
import axios from 'axios';
import { Platform } from 'react-native';
import { saveSession, loadSession } from './services/sessionStorage';


export  const API_BASE_URL =
  Platform.OS === 'android'
    
     ?  'http://10.0.2.2:7019/api'
   // ? 'https://sell-estate.onrender.com/api'
    : 'https://sell-estate.onrender.com/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ======== Access token в оперативной памяти ========
let accessTokenInMemory: string | null = null;
export function setAccessToken(token: string | null) {
  accessTokenInMemory = token;
}

// ЛЕНИВАЯ подгрузка токена при ПЕРВОМ запросе, если память пустая
let triedLoadOnce = false;
async function ensureTokenLoaded() {
  if (!accessTokenInMemory && !triedLoadOnce) {
    triedLoadOnce = true;
    const stored = await loadSession().catch(() => null);
    if (stored?.accessToken) accessTokenInMemory = stored.accessToken;
  }
}

// Подстановка токена в каждый запрос
api.interceptors.request.use(async (config) => {

   // пропускаем auth-эндпоинты
  const url = (config.url || '').toLowerCase();
  if (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')) {
    return config;
  }

  await ensureTokenLoaded();
  if (accessTokenInMemory && config.headers) {
    config.headers.Authorization = `Bearer ${accessTokenInMemory}`;
  }
  return config;
 
});

// ======== Механика refresh ========
let refreshingPromise: Promise<string | null> | null = null;

/**
 * Пытаемся обновить пару токенов по refreshToken.
 * Возвращаем новую пару или null.
 */
export async function tryRefresh(
  refreshTokenArg?: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const stored = await loadSession();
    const token = refreshTokenArg ?? stored?.refreshToken;
    if (!token) return null;

    // рефреш на бэке
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: token,
    });

 // ожидаем, что бэк вернёт новую пару
  const accessToken = data.accessToken ?? data.token ?? data.jwt;
    const refreshToken = data.refreshToken ?? data.refresh_token ?? data.refresh;
    if (!accessToken || !refreshToken) return null;
  

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

// Перехватываем 401 и делаем «тихий» рефреш + ретрай запроса
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config as any;
    const url = (original?.url || '').toLowerCase();
    

     // если это auth-запрос — ничего не рефрешим
    if (url?.includes('/auth/login') || url?.includes('/auth/refresh') || url?.includes('/auth/logout')) {
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    if (status === 401 && !original?._retry) {
      original._retry = true;

      // Один общий промис на время рефреша, чтобы не делать параллельных вызовов
      refreshingPromise =
        refreshingPromise ??
        (async () => {
          const refreshed = await tryRefresh();
          if (refreshed) {
            // запоминаем новый access в памяти
            setAccessToken(refreshed.accessToken);
            // обновляем сессию на диске (user/прочие поля оставляем)
            const prev = (await loadSession()) ?? ({} as any);
            await saveSession({ ...prev, ...refreshed });
            return refreshed.accessToken;
          }
          return null;
        })();

      const newAccess = await refreshingPromise;
      refreshingPromise = null;

      if (newAccess) {
        // подменяем заголовок и ретраим запрос
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
         //  синхронизируем legacy-хранилище
        updateLegacyToken(newAccess);
        return api(original);
      }
    }

    return Promise.reject(error);
  }
);

// ---------- BACKWARD COMPAT (не обязательно, но полезно на переходный период) ----------
/**
 * Если в проекте остались места, ожидающие AsyncStorage.setItem('user', raw),
 * можешь вызвать эту функцию после успешного логина, чтобы положить «старым кодам» ожидаемый формат.
 *
 * Пример:
 *   const raw = (await api.post('/auth/login', {email, password})).data;
 *   await writeLegacyUser(raw);  // положит token/role и т.п. в старом виде в AsyncStorage (если нужно)
 *
 * Лучше постепенно убрать зависимость от этого.
 */
// ---------- BACKWARD COMPAT ---------- пример в MyWithdrawalsScreen !!! todo
export async function writeLegacyUser(raw: any) {
  try {
    const accessToken = raw?.accessToken ?? raw?.token ?? raw?.jwt ?? null;
    // данные юзера могут быть как на корне (старый бэк), так и в raw.user (новый бэк)
    const u = raw?.user ?? raw;

    const legacy = {
      // старое
      token: accessToken,
      userId: u?.id ?? u?.userId ?? null,
      fullName: u?.fullName ?? raw?.fullName ?? null,
      email: u?.email ?? raw?.email ?? null,
      role: u?.role ?? raw?.role ?? 'user',
      avatarBase64: u?.avatarBase64 ?? raw?.avatarBase64 ?? null,
      walletBalance: u?.walletBalance ?? raw?.walletBalance ?? 0,

      // новое
      accessToken: accessToken,
      refreshToken: raw?.refreshToken ?? raw?.refresh_token ?? raw?.refresh ?? null,
      user: u ?? null,
    };

    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('user', JSON.stringify(legacy));
  } catch {}
}

async function updateLegacyToken(accessToken: string) {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const stored = await AsyncStorage.getItem('user');
    if (!stored) return;
    const obj = JSON.parse(stored);
    obj.token = accessToken;          // то, что читает старый код
    obj.accessToken = accessToken;    // на всякий
    await AsyncStorage.setItem('user', JSON.stringify(obj));
  } catch {}
}


export default api;
// import axios from 'axios';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// //const API_BASE_URL = 'http://10.0.2.2:7019/api'; //   Android emulator
//  const API_BASE_URL = 'https://sell-estate.onrender.com/api'; //   deploy test

// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// api.interceptors.request.use(async (config) => {
//   const stored = await AsyncStorage.getItem('user');
//   const user = stored ? JSON.parse(stored) : null;
//   if (user?.token) {
//     config.headers.Authorization = `Bearer ${user?.token}`;
//   }
//   return config;
// });

// export default api;
