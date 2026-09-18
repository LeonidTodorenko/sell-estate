import type { Session } from './types';

// InvestorApp screen contracts; shared endpoints select demo storage from JWT on the server.
export function investorPaths(session: Session) {
  const id = encodeURIComponent(session.user.id);
  if (!id) throw new Error('An authenticated user is required.');
  return {
    kyc: `/kyc/user/${id}`, finance: `/users/${id}/assets-summary`,
    rental: '/users/me/rent-income-history', inbox: `/messages/inbox/${id}`,
    reports: session.isDemo ? '/demo/monthly-reports' : null,
  };
}
export interface KycDocument { id: string; type: string; base64File: string; status: string; uploadedAt: string }
export type DocumentType = 'passport' | 'driver_license';
export function kycStatus(docs: KycDocument[], type: DocumentType) {
  const latest = docs.filter(d => d.type === type).sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)).slice(0, 2);
  if (latest.length === 2 && latest.every(d => d.status === 'approved')) return 'approved';
  if (latest.length === 2 && latest.some(d => d.status === 'pending')) return 'pending';
  if (latest.length === 2 && latest.some(d => d.status === 'rejected')) return 'rejected';
  return latest.length ? 'incomplete' : 'not_submitted';
}
export function kycPayload(session: Session, type: DocumentType, base64File: string) {
  if (!session.user.id || !base64File) throw new Error('A session and document are required.');
  return { userId: session.user.id, type, base64File, status: 'pending' };
}
export interface HistoryPoint { date: string; total: number }
export interface FinanceStats { walletBalance: number; investmentValue: number; totalAssets: number; rentalIncome: number; combinedHistory?: HistoryPoint[]; equityHistory?: HistoryPoint[]; rentIncomeHistory?: HistoryPoint[] }
export interface RentalEntry { title: string; timestamp: string; amount: number }
export interface MonthlyReport { id: string; reportMonth: string; walletBalance: number; investmentValue: number; rentalIncome: number; totalCapital: number; capitalChange: number }
export interface InboxMessage { id: string; title: string; content: string; createdAt: string; isRead: boolean }
export function inDateRange(value: string, from: string, to: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) && (!from || time >= new Date(`${from}T00:00:00`).getTime()) && (!to || time <= new Date(`${to}T23:59:59.999`).getTime());
}
