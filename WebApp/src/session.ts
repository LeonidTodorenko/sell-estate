import type { Session } from './types.ts';
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' ? value as RecordValue : {};
const text = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const flag = (value: unknown): boolean | undefined => value === true || value === 'true' ? true : value === false || value === 'false' ? false : undefined;
export function parseJwt(token: string): RecordValue {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return object(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), c => c.charCodeAt(0)))));
  } catch { return {}; }
}
// JWT decoding is for UI/session metadata only. The API validates the signature.
export function normalizeSession(raw: unknown, previous?: Session): Session {
  const data = object(raw), user = object(data.user);
  const token = text(data.accessToken ?? data.token ?? data.jwt);
  if (!token) throw new Error('The sign-in response did not contain an access token.');
  const claims = parseJwt(token);
  const id = text(user.id ?? user.userId ?? data.userId ?? data.id ?? claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? claims.sub ?? claims.nameid ?? previous?.user.id);
  if (!id) throw new Error('The sign-in response did not contain a user ID.');
  const isDemo = flag(claims.isDemo) ?? flag(data.isDemo) ?? flag(user.isDemo) ?? previous?.isDemo ?? false;
  if (previous && (id !== previous.user.id || isDemo !== previous.isDemo)) throw new Error('The refreshed session does not match this account. Please sign in again.');
  const demoCode = text(data.demoCode ?? user.demoCode ?? claims.demoCode) ?? previous?.demoCode ?? null;
  return {
    accessToken: token,
    refreshToken: isDemo ? null : text(data.refreshToken ?? data.refresh_token ?? data.refresh) ?? null,
    isDemo, demoCode,
    user: { id, isDemo, demoCode,
      fullName: text(user.fullName ?? data.fullName) ?? previous?.user.fullName,
      email: text(user.email ?? data.email ?? claims.email) ?? previous?.user.email,
      role: text(user.role ?? data.role ?? claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? claims.role) ?? previous?.user.role,
      phone: text(user.phone ?? data.phone) ?? previous?.user.phone,
    },
  };
}
export function isExpired(session: Session, now = Date.now()) {
  const exp = parseJwt(session.accessToken).exp;
  return typeof exp !== 'number' || exp * 1000 <= now;
}
