import { useEffect, useRef, useState } from 'react';
import { api, getSession, subscribeSession } from './api';
import { imageUrl } from './format';
import type { EditableProfile } from './activity-contracts';
import type { PropertyImage, Session } from './types';

// Share requests across repeated holdings. Clear on account changes; cap retained media.
const cache = new Map<string, Promise<PropertyImage[]>>();
subscribeSession(() => cache.clear());
window.addEventListener('property-images-changed', () => cache.clear());
function loadImages(id: string) {
  let request = cache.get(id);
  if (!request) {
    request = api<PropertyImage[]>(`/properties/${encodeURIComponent(id)}/images`).then(data => {
      if (!Array.isArray(data)) throw new Error('Invalid image response');
      return data.filter(item => item && typeof item.id === 'string' && typeof item.base64Data === 'string' && imageUrl(item.base64Data));
    });
    cache.set(id, request);
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    const current = request;
    request.catch(() => { if (cache.get(id) === current) cache.delete(id); });
  }
  return request;
}
function useImages(id: string, visible: boolean) {
  const [state, setState] = useState<{ id: string; data?: PropertyImage[]; error?: boolean }>({id});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    const owner = getSession();
    const sameOwner = () => owner?.user.id === getSession()?.user.id && owner?.isDemo === getSession()?.isDemo;
    setState({id});
    loadImages(id).then(data => { if (active && sameOwner()) setState({id, data}); })
      .catch(() => { if (active && sameOwner()) setState({id, error:true}); });
    return () => { active = false; };
  }, [id, visible, revision]);
  return { data: state.id === id ? state.data : undefined, error: state.id === id && state.error,
    retry: () => { cache.delete(id); setRevision(n => n + 1); } };
}
function Photo({ raw, title, compact = false }: { raw?: string; title: string; compact?: boolean }) {
  const source = imageUrl(raw);
  const [failed, setFailed] = useState<string>();
  return <div className={`property-photo${compact ? ' compact' : ''}`}>
    {source && failed !== source ? <img src={source} alt={compact ? '' : title} loading="lazy" onError={() => setFailed(source)}/> : <div className="photo-fallback" role="img" aria-label={`No photo available for ${title}`}><svg aria-hidden="true" viewBox="0 0 48 48"><path d="M8 40V18L24 7l16 11v22H8Zm10 0V26h12v14M14 19h4m12 0h4"/></svg>{!compact && <span>No photo available</span>}</div>}
  </div>;
}
export function PropertyPhoto({id, title, compact = false}: {id:string;title:string;compact?:boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, {rootMargin:'200px'});
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const images = useImages(id, visible);
  return <div ref={ref} className={compact ? 'photo-wrap compact' : 'photo-wrap'}><Photo raw={images.data?.[0]?.base64Data} title={title} compact={compact}/>{images.error && !compact && <button className="photo-retry" onClick={images.retry}>Retry photo</button>}</div>;
}
export function PropertyGallery({id,title}: {id:string;title:string}) {
  const images = useImages(id, true);
  const [selected, setSelected] = useState(0);
  const data = images.data || [];
  const index = Math.min(selected, Math.max(0,data.length-1));
  return <section className="property-gallery" aria-label="Property photos"><Photo raw={data[index]?.base64Data} title={`${title} — photo ${index+1}`}/>
    {images.error ? <p className="muted">Photos could not be loaded. <button onClick={images.retry}>Retry photos</button></p> : !images.data ? <p role="status">Loading photos…</p> : data.length > 0 && <><p className="muted" aria-live="polite">Photo {index+1} of {data.length}</p><div className="gallery-thumbnails">{data.map((img,i) => <button key={img.id} aria-label={`Show photo ${i+1}`} aria-pressed={index===i} onClick={() => setSelected(i)}><Photo raw={img.base64Data} title={`Photo ${i+1}`} compact/></button>)}</div></>}
  </section>;
}
export function Avatar({raw,name,compact=false}: {raw?:string|null;name?:string;compact?:boolean}) {
  const source=imageUrl(raw), [failed,setFailed]=useState<string>();
  return source && failed!==source ? <img className={`avatar${compact?' avatar-small':''}`} src={source} alt="Your avatar" onError={()=>setFailed(source)}/> : <span className={`avatar${compact?' avatar-small':''}`} role="img" aria-label="Your avatar initials">{(name || 'OwnersClub').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</span>;
}
export function HeaderAvatar({session}: {session:Session}) {
  const [raw,setRaw]=useState(session.user.avatarBase64);
  useEffect(()=>{
    const controller=new AbortController();
    let changed=false;
    if (!session.user.avatarBase64) api<EditableProfile>(`/users/${encodeURIComponent(session.user.id)}`,controller.signal).then(user=>{if(!controller.signal.aborted && !changed)setRaw(user.avatarBase64);}).catch(()=>{});
    const update=(event:Event)=>{changed=true;setRaw((event as CustomEvent<string>).detail);};window.addEventListener('avatar-changed',update);return()=>{controller.abort();window.removeEventListener('avatar-changed',update);};},[]);
  return <Avatar raw={raw} name={session.user.fullName || session.user.email} compact/>;
}
