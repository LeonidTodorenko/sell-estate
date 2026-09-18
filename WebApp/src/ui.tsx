import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
export function useResource<T>(path: string) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>({ path });
  const [revision, setRevision] = useState(0);
  useEffect(() => { const invalidate = () => setRevision(n => n + 1); window.addEventListener('financial-data-changed', invalidate); return () => window.removeEventListener('financial-data-changed', invalidate); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ path });
    api<T>(path, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ path, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ path, error: error instanceof Error ? error.message : 'Something went wrong.' });
    });
    return () => controller.abort();
  }, [path, revision]);
  return { data: state.path === path ? state.data : undefined, error: state.path === path ? state.error : undefined, retry: () => setRevision(n => n + 1) };
}
export function Resource<T>({ resource, children }: { resource: ReturnType<typeof useResource<T>>; children: (data: T) => ReactNode }) {
  if (resource.error) return <div className="state error" role="alert"><h3>Unable to load data</h3><p>{resource.error}</p><button onClick={resource.retry}>Try again</button></div>;
  if (resource.data === undefined) return <div className="state" role="status"><span className="loading-dot"/> Loading…</div>;
  return <>{children(resource.data)}</>;
}
export function Empty({ title = 'Nothing here yet', children }: { title?: string; children?: ReactNode }) { return <div className="state"><h3>{title}</h3>{children && <p>{children}</p>}</div>; }
export function Heading({ title, description, children }: { title: string; description: string; children?: ReactNode }) { return <header className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{children}</header>; }
export function Metric({ label, value }: { label: string; value: ReactNode }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

