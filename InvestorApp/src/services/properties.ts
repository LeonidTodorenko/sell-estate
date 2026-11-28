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
  canApply?: boolean;
  status?: string;
  expectedCompletionDate?: string | null;
  videoUrl?: string | null;
  about?: string | null;
  expectedYieldText?: string | null;
  plannedSaleDate?: string | null;
  presentationPdfUrl?: string | null;
presentationPdfName?: string | null;
};

type ApiMedia = { id: string; type: number; url?: string | null; base64Data?: string | null };

export async function fetchPropertiesWithExtras(
  limitExtras = 8,
  silentLoading = false,
  includeInvestmentAvailability = false,
): Promise<Property[]> {
  const res = await api.get('/properties', {silentLoading} as any);
  const list: Property[] = Array.isArray(res.data)
    ? res.data.map((property: Property) => ({
        ...property,
        title: property.title?.trim() || 'Property',
        location: property.location?.trim() || '',
      }))
    : [];

  const first = list.slice(0, limitExtras);
  const rest = list.slice(limitExtras);

  const withExtras = await Promise.all(
    first.map(async (p) => {
      const plan = () => api.get<unknown[]>(`/properties/${p.id}/payment-plans`, {silentLoading} as any)
        .then(result => ({ hasPaymentPlan: Array.isArray(result.data) && result.data.length > 0, canApply: false }));
      const availability = includeInvestmentAvailability
        ? api.get<{ canApply: boolean; stages: unknown[] }>(`/investment-workflow/properties/${p.id}`, {silentLoading} as any)
          .then(result => ({
            hasPaymentPlan: Array.isArray(result.data?.stages) && result.data.stages.length > 0,
            canApply: result.data?.canApply === true,
          }))
          .catch(plan)
        : plan();
      const [imgRes, mediaRes, purchase] = await Promise.all([
        api.get(`/properties/${p.id}/images`, {silentLoading} as any),
        api.get(`/properties/${p.id}/media`, {silentLoading} as any),
        availability,
      ]);

      const rawMedia = Array.isArray(mediaRes.data) ? mediaRes.data : [];
 
     const normalizedMedia = rawMedia.map((m: ApiMedia): PropertyMedia => {
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
        ...purchase,
      };
    })
  );

  const merged = [...withExtras, ...rest].sort((a, b) => a.title.localeCompare(b.title));
  return merged;
}
