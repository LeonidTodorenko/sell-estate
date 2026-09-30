import type { Session } from './types.ts';

export interface AdminStats {
  investors: number;
  totalInvestments: number;
  totalProperties: number;
  totalRentalIncome: number;
  pendingWithdrawals: number;
  pendingKyc: number;
}

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  userRole: number;
  userRoleText: string;
  permissions: number;
  permissionsText: string[];
  isBlocked: boolean;
  isEmailConfirmed: boolean;
  createdAt: string;
}

export type AdminUserDetails = AdminUserSummary;

export interface AdminInvestment {
  id: string;
  userId: string;
  propertyId: string;
  shares: number;
  investedAmount: number;
  createdAt: string;
}

export interface AdminDemoAccount {
  id: string;
  demoCode: string;
  fullName: string;
  email: string;
  walletBalance: number;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
  expiresAt?: string | null;
}

export interface AdminLog {
  id: string;
  userId: string;
  userName?: string | null;
  action: string;
  details: string;
  timestamp: string;
}

export interface AdminLogPage {
  total: number;
  page: number;
  pageSize: number;
  items: AdminLog[];
}

export const isAdminSession = (session: Session | null) =>
  Boolean(session && !session.isDemo && session.user.role?.trim().toLowerCase() === 'admin');

export function adminUsersPath(query = '') {
  const value = query.trim();
  return value ? `/admin/users?${new URLSearchParams({ query: value })}` : '/admin/users';
}

export const adminUserPath = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export function adminLogsPath(action: string, userName: string, page: number, pageSize = 20) {
  const params = new URLSearchParams({ page: String(Math.max(1, Math.floor(page))), pageSize: String(pageSize) });
  if (action.trim()) params.set('action', action.trim());
  if (userName.trim()) params.set('userName', userName.trim());
  return `/admin/stats/logs?${params}`;
}

export const adminLogPages = (result: AdminLogPage) =>
  Math.max(1, Math.ceil(Math.max(0, result.total) / Math.max(1, result.pageSize)));
