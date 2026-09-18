export interface Application { id: string; propertyId: string; propertyTitle: string; requestedAmount: number; requestedShares: number; approvedAmount?: number | null; approvedShares?: number | null; status: string | null; isPriority: boolean; stepNumber: number; createdAt: string }
export interface Trade { timestamp: string; shares: number; pricePerShare: number; propertyId: string; propertyTitle: string; buyerId: string; sellerId: string }
export interface Bid { id: string; offerId: string; bidderId: string; bidPricePerShare: number; shares: number; createdAt: string }
export interface GroupedShares { propertyId: string; propertyTitle: string; shares: number; totalInvested: number; averagePrice: number; buybackPricePerShare: number | null }
export interface EditableProfile { id: string; fullName: string; email: string; phoneNumber?: string; address?: string }
export const applicationStatus = (status: string | null) => status ?? 'Pending';
export const applicationsPath = (id: string) => `/applications/user/${encodeURIComponent(id)}`;
export function selectTrades(rows: Trade[], id: string, side: 'buy' | 'sell' | 'all') { return rows.filter(t => side === 'all' || (side === 'buy' ? t.buyerId : t.sellerId) === id).sort((a,b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); }
export function profilePayload(profile: EditableProfile, email: string, isDemo: boolean) { return { fullName: profile.fullName, email: isDemo ? email : profile.email, phoneNumber: profile.phoneNumber || '', address: profile.address || '' }; }
