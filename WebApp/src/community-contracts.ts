// Contracts from InvestorApp MyProperties, InviteFriend, Personal and Chat screens.
export const communityPaths = (id: string) => ({
  properties: `/properties/my-properties/${encodeURIComponent(id)}`,
  club: `/share-offers/${encodeURIComponent(id)}/club-info`,
  totals: `/users/${encodeURIComponent(id)}/total-assets`,
  withdrawals: `/withdrawals/user/${encodeURIComponent(id)}`,
  unread: `/messages/unread-count/${encodeURIComponent(id)}`,
});
export interface OwnedProperty { propertyId: string; propertyTitle: string; totalShares: number; totalInvested: number }
export interface ClubInfo { status?: string; totalAssets?: number; baseFee?: number; withReferralFee?: number; canInvite?: boolean; referrerRewardPercent?: number; referrerRewardYears?: number }
export interface ClubTotals { clubStatus?: string; clubFeePercent?: number; hasReferrer?: boolean; baseFeePercent?: number; referralFeePercent?: number }
export interface Invite { id: string; inviteeEmail: string; createdAt: string; expiresAt: string; acceptedAt?: string | null; status: string }
export interface Withdrawal { id: string; amount: number; status: string; createdAt: string }
export interface ChatMessage { id: string; senderId: string; recipientId: string; content: string; sentAt: string }
export function fee(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? `${Number((value * 100).toFixed(4))}%` : 'Unavailable'; }
export function mapLink(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}
export function messagePayload(isDemo: boolean, recipientId: string, content: string) {
  if (isDemo) throw new Error('Live support chat is disabled in Demo Mode.');
  if (!recipientId || !content.trim()) throw new Error('Enter a message and wait for support to load.');
  return { recipientId, content: content.trim() };
}
export function invitePayload(isDemo: boolean, canInvite: boolean, email: string) {
  if (isDemo || !canInvite) throw new Error('Invitations are unavailable for this account.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email.');
  return { email: email.trim() };
}
