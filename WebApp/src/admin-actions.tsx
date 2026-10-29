import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminWrite, api, getSession, ApiError } from './api';
import { adminUserPath, isAdminSession, type AdminUserDetails } from './admin-contracts';
import { date } from './format';
import { Empty, Heading, Resource, useResource } from './ui';

export interface KycDocument { id: string; userId: string; type: string; status: string; uploadedAt: string; base64File: string }

export function UserActions({user, reload}: {user: AdminUserDetails; reload: () => void}) {
  const [nextRole, setRole] = useState(String(user.userRole)), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef(false);
  const [locked, setLocked] = useState(false);
  const session = getSession(), protectedAccount = !isAdminSession(session) || session?.user.id === user.id || ![0, 1].includes(user.userRole);
  async function change(action: 'role' | 'block' | 'unblock') {
    if (pending.current || locked || protectedAccount || !session) return;
    const label = action === 'role' ? `Change role to ${nextRole === '0' ? 'Investor' : 'Moderator'}` : action === 'block' ? 'Block account access' : 'Unblock account access';
    if (!window.confirm(`${label} for ${user.fullName || user.email} (${user.email})?`)) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const fresh = await api<AdminUserDetails>(adminUserPath(user.id));
      if (fresh.isBlocked !== user.isBlocked || fresh.userRole !== user.userRole) throw new Error('This account changed. Reload the profile before choosing an action.');
      await adminWrite(session, action, user.id, Number(nextRole));
      setMessage('Change saved. Refreshing account detailsвЂ¦'); reload();
    } catch (err) {
      setLocked(true);
      setError(`${err instanceof Error ? err.message : 'Change failed.'} Reload the profile and check the current state before retrying.`);
      // In particular, a toggle must never be replayed after a timeout.
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className="panel admin-actions"><h2>Account management</h2><p className="muted">Changes require confirmation and server authorization.</p>{protectedAccount ? <p>Self-service changes and changes to administrator accounts are unavailable here.</p> : <><label>New role<select value={nextRole} onChange={e => setRole(e.target.value)} disabled={busy}><option value="0">Investor</option><option value="1">Moderator</option></select></label><div className="actions"><button disabled={busy || locked || Number(nextRole) === user.userRole} onClick={() => change('role')}>Change role</button><button disabled={busy || locked} onClick={() => change(user.isBlocked ? 'unblock' : 'block')}>{user.isBlocked ? 'Unblock user' : 'Block user'}</button></div></>}<p className="muted">Assigning Admin requires SuperAdmin authority, which the current API does not expose to this interface.</p>{busy && <p role="status">SavingвЂ¦</p>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}<button disabled={busy} onClick={reload}>Reload profile</button></section>;
}

// Only raster data is rendered. No remote URLs, HTML, SVG or embedded active documents.
function rasterSource(raw: string) {
  if (!raw || raw.length > 14_000_000) return undefined;
  const match = /^(?:data:image\/(png|jpeg|gif|webp);base64,)?([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return undefined;
  const data = match[2].replace(/\s/g, '');
  const mime = data.startsWith('iVBORw0KGgo') ? 'png' : data.startsWith('/9j/') ? 'jpeg' : data.startsWith('R0lGOD') ? 'gif' : data.startsWith('UklGR') ? 'webp' : undefined;
  return mime ? `data:image/${mime};base64,${data}` : undefined;
}
function DocumentReview({doc, reload}: {doc: KycDocument; reload: () => void}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [locked, setLocked] = useState(false), [message, setMessage] = useState('');
  const pending = useRef(false);
  const source = open ? rasterSource(doc.base64File) : undefined;
  const [decoded, setDecoded] = useState(false), [previewFailed, setPreviewFailed] = useState(false);
  async function approve() {
    const session = getSession();
    if (pending.current || locked || !open || !decoded || previewFailed || doc.status !== 'pending' || !isAdminSession(session) || !session) return;
    if (!window.confirm(`Approve ${doc.type} for user ${doc.userId}? Approval also generates and emails a contract.`)) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const current = await api<KycDocument[]>('/kyc/pending');
      const fresh = current.find(item => item.id === doc.id);
      if (!fresh || fresh.userId !== doc.userId || fresh.base64File !== doc.base64File || fresh.type !== doc.type) throw new Error('The document changed or was already processed. Reload the queue.');
      await adminWrite(session, 'approve', doc.id);
      setLocked(true); setMessage('Approval saved.'); reload();
    } catch (err) {
      setLocked(true);
      setError(`${err instanceof Error ? err.message : 'Approval failed.'} Reload and verify document status before any further action.${err instanceof ApiError && err.status >= 500 ? ' Approval may have been saved before contract delivery failed.' : ''}`);
    } finally { pending.current = false; setBusy(false); }
  }
  return <article className="panel kyc-document"><h2>{doc.type}</h2><dl><dt>Document ID</dt><dd className="identifier">{doc.id}</dd><dt>User</dt><dd><Link to={`/admin/users/${encodeURIComponent(doc.userId)}`}>{doc.userId}</Link></dd><dt>Status</dt><dd>{doc.status}</dd><dt>Uploaded</dt><dd>{date(doc.uploadedAt)}</dd></dl><button aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)}>{open ? 'Hide document' : 'View document'}</button>{open && <div className="kyc-preview">{source ? <><img src={source} alt={`${doc.type} document for review`} onLoad={() => setDecoded(true)} onError={() => { setPreviewFailed(true); setDecoded(false); }}/>{previewFailed && <p role="alert">The document image could not be displayed. Approval is unavailable.</p>}</> : <p>Preview unavailable. Only PNG, JPEG, GIF and WebP images up to 10 MB are supported. Use the existing trusted review workflow for other formats.</p>}</div>}{doc.status === 'pending' && <div className="actions"><button disabled={!open || !source || !decoded || previewFailed || busy || locked} onClick={approve}>{busy ? 'ApprovingвЂ¦' : 'Approve KYC'}</button><button disabled title="The current API cannot store a rejection reason">Reject KYC unavailable</button></div>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}</article>;
}
export function UserKyc({id}: {id: string}) {
  const resource = useResource<KycDocument[]>(`/kyc/user/${encodeURIComponent(id)}`);
  return <section><h2>User KYC documents</h2><p className="muted">Reject with a reason is unavailable because the current API cannot store the reason.</p><Resource resource={resource}>{docs => docs.length ? docs.map(doc => <DocumentReview key={doc.id} doc={doc} reload={resource.retry}/>) : <Empty title="No KYC documents"/>}</Resource></section>;
}
export function AdminKyc() {
  const resource = useResource<KycDocument[]>('/kyc/pending');
  return <><Heading title="KYC review" description="Review pending identity documents before approving. Approval generates and emails a contract."/><p className="panel">Rejection with a reason is unavailable: the current API neither accepts nor stores a reason. Use your existing review workflow for rejection.</p><button onClick={resource.retry}>Reload queue</button><Resource resource={resource}>{docs => docs.length ? <div className="kyc-list">{docs.map(doc => <DocumentReview key={doc.id} doc={doc} reload={resource.retry}/>)}</div> : <Empty title="No pending KYC documents"/>}</Resource></>;
}
