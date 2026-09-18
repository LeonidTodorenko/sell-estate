import { demoTopUpContract } from './financial-contracts';
import { isExpired, normalizeSession } from './session';
import type { Session } from './types';
import { authPaths, confirmationPath, registrationPayload, resetPayload, forgotPayload, type Registration } from './onboarding-contracts';

// Public onboarding never attaches a session token or replays a mutation.
export const loadCaptcha = () => request<{id:string;expression:string}>(authPaths.captcha);
export const register = (form:Registration) => request(authPaths.register, undefined, registrationPayload(form));
export const forgotPassword = (email:string) => request(authPaths.forgot, undefined, forgotPayload(email));
export const resetPassword = (token:string,password:string,confirm:string) => request(authPaths.reset, undefined, resetPayload(token,password,confirm));
export const confirmEmail = (token:string) => request(confirmationPath(token));

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || 'https://sell-estate.onrender.com/api').replace(/\/+$/, '');
const KEY = 'ownersclub.web.session.v1';
const listeners = new Set<() => void>();
let session: Session | null = null;
try { const raw = localStorage.getItem(KEY); if (raw) session = normalizeSession(JSON.parse(raw)); } catch { try { localStorage.removeItem(KEY); } catch { /* Storage can be disabled by the browser. */ } }
export const getSession = () => session;
export const subscribeSession = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function save(value: Session | null) {
  // Do not report a persisted sign-in if browser storage failed.
  if (value) localStorage.setItem(KEY, JSON.stringify(value)); else { try { localStorage.removeItem(KEY); } catch { /* Always clear the in-memory session on sign-out. */ } }
  session = value; listeners.forEach(fn => fn());
}
window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== null) return;
  try { session = event.newValue ? normalizeSession(JSON.parse(event.newValue)) : null; } catch { session = null; }
  listeners.forEach(fn => fn());
});
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function request<T>(path: string, token?: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 45000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : undefined; } catch { data = undefined; }
    if (!response.ok) {
      const detail = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      throw new ApiError(typeof detail.message === 'string' ? detail.message : typeof detail.title === 'string' ? detail.title : `Request failed (${response.status}). Please try again.`, response.status);
    }
    if (raw && data === undefined) throw new ApiError('The API returned an unexpected response format.', response.status);
    return data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'The request timed out. The server may be waking up; please retry.' : 'Cannot reach the API. Check your connection. The server may also need to allow this website (CORS).', 0);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
let refreshing: Promise<Session | null> | null = null;
async function refresh(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const before = session;
  if (!before?.refreshToken || before.isDemo) { save(null); return null; }
  refreshing = (async () => {
    try {
      const result = await request('/auth/refresh', undefined, { refreshToken: before.refreshToken });
      if (session !== before) return session;
      const next = normalizeSession(result, before);
      if (!next.refreshToken) throw new ApiError('The API did not return a refresh token.', 401);
      save(next); return next;
    } catch (error) {
      if (session === before && (!(error instanceof ApiError) || error.status === 401 || error.status === 403)) save(null);
      throw error;
    }
  })();
  try { return await refreshing; } finally { refreshing = null; }
}
export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  let current = session;
  const requestedUserId = current?.user.id;
  const requestedDemo = current?.isDemo;
  if (current && isExpired(current)) current = await refresh();
  if (!current) throw new ApiError('Your session has expired. Please sign in again.', 401);
  if (current.user.id !== requestedUserId || current.isDemo !== requestedDemo) throw new ApiError('The active account changed. Please reload this page.', 401);
  try { return await request<T>(path, current.accessToken, undefined, signal); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || signal?.aborted) throw error;
    // Another concurrent request may already have rotated the token.
    const next = session !== current ? session : await refresh();
    if (!next || next.user.id !== current.user.id || next.isDemo !== current.isDemo) throw error;
    try { return await request<T>(path, next.accessToken, undefined, signal); }
    catch (retryError) { if (retryError instanceof ApiError && retryError.status === 401 && session === next) save(null); throw retryError; }
  }
}
export async function signIn(email: string, password: string) {
  const data = await request('/auth/login', undefined, { email: email.trim(), password });
  save(normalizeSession(data));
}
// Never replay a possibly accepted KYC upload.
export async function uploadKyc(expected: Session, body: { userId: string; type: string; base64File: string; status: string }) {
  let current = session;
  const matches = (value: Session | null) => value?.user.id === expected.user.id && value?.isDemo === expected.isDemo;
  if (!matches(current) || body.userId !== expected.user.id) throw new ApiError('The active account changed. Reload before uploading.', 401);
  if (current && isExpired(current)) current = await refresh();
  if (!current || !matches(current)) throw new ApiError('Your session has expired. Please sign in again.', 401);
  return request('/kyc/upload', current.accessToken, body);
}
export async function signOut() {
  const previous = session; save(null);
  if (previous?.refreshToken) {
    try { await request('/auth/logout', undefined, { refreshToken: previous.refreshToken }); }
    catch { return 'Signed out on this device. The server could not revoke the session; it will expire automatically.'; }
  }
}

// Account writes are scoped to the captured identity and are never automatically replayed.
export async function updateProfile(expected: Session, body: { fullName: string; email: string; phoneNumber: string; address: string }) {
  let current = session;
  const matches = (value: Session | null) => value?.user.id === expected.user.id && value?.isDemo === expected.isDemo;
  if (!matches(current)) throw new ApiError('The active account changed. Reload before saving.', 401);
  if (current && isExpired(current)) current = await refresh();
  if (!current || !matches(current)) throw new ApiError('Your session has expired. Please sign in again.', 401);
  return request(`/users/${encodeURIComponent(current.user.id)}/update-profile`, current.accessToken, body);
}


// Community messages are explicit user actions; never replay a POST after a 401.
export async function communityWrite(expected: Session, action: 'chat' | 'invite', body: {recipientId: string; content: string} | {email: string}) {
  let current = session;
  const matches = (value: Session | null) => value?.user.id === expected.user.id && value?.isDemo === expected.isDemo;
  if (expected.isDemo || !matches(current)) throw new ApiError('This action is unavailable for the active account.', 403);
  if (current && isExpired(current)) current = await refresh();
  if (!current || current.isDemo || !matches(current)) throw new ApiError('Your session changed. Reload before sending.', 401);
  return request(action === 'chat' ? '/chat/send' : '/referrals/invite', current.accessToken, body);
}

// Only the audited sandbox top-up is allowed. Never replay a financial POST.
let financialPending = false;
export async function demoTopUp(expected: Session, amount: number) {
  if (financialPending) throw new ApiError('A top-up is already in progress. Check your transactions.', 409);
  financialPending = true;
  try {
  demoTopUpContract(expected, session, amount);
  let current = session;
  if (current && isExpired(current)) current = await refresh();
  const contract = demoTopUpContract(expected, current, amount);
  if (!current) throw new ApiError('Please sign in again.', 401);
  const result = await request<{message:string;walletBalance:number;isDemo:boolean}>(contract.path, current.accessToken, contract.body);
  demoTopUpContract(expected, session, amount);
  if (result?.isDemo !== true || !Number.isFinite(result.walletBalance) || typeof result.message !== 'string') throw new ApiError('Unexpected sandbox response. Check your transaction history.', 0);
  window.dispatchEvent(new Event('financial-data-changed'));
  return result;
  } finally { financialPending = false; }
}

