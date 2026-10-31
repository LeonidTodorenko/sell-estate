import { sha256 } from '@noble/hashes/sha256';

type Payload = { propertyId: string; requestedShares: number; [key: string]: unknown };
type Store = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export type PurchaseIntent = { id: string; payload: Payload; credential: string; uncertain: boolean; conflict?: boolean };
export const pendingMessage = 'An investment purchase is unresolved. Retry the saved purchase with the same PIN/password. Do not create another purchase. Check applications and transactions; contact support if it remains unresolved.';
export const conflictMessage = 'Purchase conflict (409). The saved key has been retained. Do not create a new purchase; reconcile this purchase with support using its reference.';
export function jwtOwner(claims: Record<string, unknown> | null): string {
  const id = claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? claims?.sub ?? claims?.nameid;
  if (typeof id !== 'string' || !id || claims?.isDemo === true || claims?.isDemo === 'true') throw new Error('Investment retry protection requires an authenticated live account. Demo purchases are unavailable.');
  return id.toLowerCase();
}
function digest(value: string) {
  const bytes = Uint8Array.from(unescape(encodeURIComponent(value)), c => c.charCodeAt(0));
  return Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function canonical(p: Payload) { return JSON.stringify(Object.keys(p).sort().map(k => [k, p[k]])); }
export function createPurchaseIntents(store: Store, uuid: () => string) {
  const busy = new Set<string>();
  const key = (owner: string) => `ownersclub.investment.apply.v1:${owner}`;
  async function read(owner: string): Promise<PurchaseIntent | null> {
    const raw = await store.getItem(key(owner));
    if (!raw) return null;
    const p = JSON.parse(raw) as PurchaseIntent;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id) || !p.payload || typeof p.payload.propertyId !== 'string' || !p.payload.propertyId || !Number.isSafeInteger(p.payload.requestedShares) || p.payload.requestedShares <= 0 || typeof p.uncertain !== 'boolean' || !/^[0-9a-f]{64}$/.test(p.credential)) throw new Error('Saved purchase is unreadable. Contact support before purchasing.');
    return p;
  }
  return { read, async submit<T>(owner: string, payload: Payload, secret: string, send: (intent: PurchaseIntent) => Promise<T>): Promise<T> {
    if (!owner || !payload.propertyId || !Number.isSafeInteger(payload.requestedShares) || payload.requestedShares <= 0 || !secret.trim()) throw new Error('Enter a valid property, whole number of shares and PIN/password.');
    if (busy.has(owner)) throw new Error('An investment request is already being sent.');
    busy.add(owner);
    try {
      let intent = await read(owner);
      if (intent && (canonical(intent.payload) !== canonical(payload) || intent.credential !== digest(intent.id + secret))) throw new Error(pendingMessage);
      if (intent?.conflict) throw new Error(conflictMessage + ' Reference: ' + intent.id);
      if (!intent) {
        const id = uuid();
        intent = { id, payload, credential: digest(id + secret), uncertain: false };
        await store.setItem(key(owner), JSON.stringify(intent)); // Persistence must succeed BEFORE the POST.
      }
      const wasUncertain = intent.uncertain;
      // A process death at any point after this durable write must be treated as response lost.
      intent.uncertain = true;
      await store.setItem(key(owner), JSON.stringify(intent));
      let result: T;
      try { result = await send(intent); }
      catch (e) {
        const status = (e as {status?: number; response?: {status?: number}})?.response?.status ?? (e as {status?: number})?.status;
        if (status === 409) {
          intent.conflict = true;
          await store.setItem(key(owner), JSON.stringify(intent));
          throw new Error(conflictMessage + ' Reference: ' + intent.id);
        }
        // A later validation/auth rejection cannot prove an earlier timed-out attempt failed.
        if (!wasUncertain && (status === 400 || status === 401 || status === 403 || status === 404 || status === 422)) await store.removeItem(key(owner));
        throw e;
      }
      await store.removeItem(key(owner));
      return result;
    } finally { busy.delete(owner); }
  }};
}
