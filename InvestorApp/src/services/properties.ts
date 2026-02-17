import api from '../api';

export type MediaType = 'image' | 'video';
export type PropertyMedia = { id: string; type: MediaType; url?: string | null; base64Data?: string | null };
export type PropertyImage = { id: string; base64Data: string };

export type Property = {
  id: string;
  price: number;
  location: string;
  availableShares: number;
  listingType: string;
  latitude: number;
  longitude: number;
  title: string;
  images?: PropertyImage[];
  media?: PropertyMedia[];
  priorityInvestorId?: string;
  hasPaymentPlan?: boolean;
  expectedCompletionDate?: string | null;
  videoUrl?: string | null;
};

type ApiMedia = { id: string; type: number; url?: string | null; base64Data?: string | null };

export async function fetchPropertiesWithExtras(limitExtras = 8): Promise<Property[]> {
  const res = await api.get('/properties');
  const list: Property[] = Array.isArray(res.data) ? res.data : [];

  const first = list.slice(0, limitExtras);
  const rest = list.slice(limitExtras);

  const withExtras = await Promise.all(
    first.map(async (p) => {
      const [imgRes, mediaRes, planRes] = await Promise.all([
        api.get(`/properties/${p.id}/images`),
        api.get(`/properties/${p.id}/media`),
        api.get(`/properties/${p.id}/payment-plans`),
      ]);

      const rawMedia = Array.isArray(mediaRes.data) ? mediaRes.data : [];
 
     const normalizedMedia = rawMedia.map((m: any) => {
        const raw = m.type;  
        const typeString = String(raw).toLowerCase(); // "2" | "video" | "image"

        const uri = (m.base64Data ?? m.url ?? '').trim();
        const byExt = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(uri);

        const isVideo = typeString === '2' || typeString === 'video' || byExt;

        return {
          id: m.id,
          type: isVideo ? 'video' : 'image',
          url: m.url ?? null,
          base64Data: m.base64Data ?? null,
        };
      });


      return {
        ...p,
        images: Array.isArray(imgRes.data) ? imgRes.data : [],
        media: normalizedMedia,
        hasPaymentPlan: (planRes.data ?? []).length > 0,
      };
    })
  );

  const merged = [...withExtras, ...rest].sort((a, b) => a.title.localeCompare(b.title));
  return merged;
}
