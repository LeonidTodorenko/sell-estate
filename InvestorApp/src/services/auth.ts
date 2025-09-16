import { decode as atob } from 'base-64'; 

export function parseJwt<T = any>(token?: string | null): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    try {
      // RN без Buffer:
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

/**
 * Возвращает 'admin' | 'user' (или что у тебя на бэке),
 * читая сначала user.role, а если его нет — claim из JWT.
 */
export function getRoleFromUserAndToken(user?: any, accessToken?: string | null): string {
  const roleFromUser =
    user?.role ?? user?.Role ?? user?.roles ?? user?.Roles ?? null;

  if (roleFromUser) return String(roleFromUser).toLowerCase();

  const payload = parseJwt<any>(accessToken);
  const claimRole =
    payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    payload?.role ??
    payload?.roles ??
    null;

  return String(claimRole ?? 'user').toLowerCase();
}
