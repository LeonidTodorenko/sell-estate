// Adapted from InvestorApp services/properties and the corresponding screen DTOs.
export interface Property {
  id: string; title: string; location: string; latitude?: number; longitude?: number; price: number; totalShares: number;
  availableShares: number; listingType: string; status: string;
  imageBase64?: string | null; about?: string | null; expectedYieldText?: string | null;
  expectedCompletionDate?: string | null; plannedSaleDate?: string | null;
  presentationPdfUrl?: string | null; presentationPdfName?: string | null;
}
export interface PropertyImage { id: string; base64Data: string }
export interface Investment { id: string; propertyId: string; shares: number; investedAmount: number; createdAt: string }
export interface Holding { propertyId: string; propertyTitle: string; totalShares: number; totalInvested: number; totalShareValue: number; ownershipPercent: number; monthlyRentalIncome: number }
export interface Totals { walletBalance?: number; investmentValue?: number; pendingApplicationsValue?: number; marketValue?: number; rentalIncome?: number; totalAssets?: number }
export interface ShareOffer { id: string; sellerId: string; propertyId: string; propertyTitle: string; sharesForSale: number; isActive: boolean; expirationDate: string; startPricePerShare?: number; buyoutPricePerShare?: number | null }
export interface Transaction { id: string; type: string; amount: number; shares?: number; propertyId?: string; propertyTitle?: string; timestamp: string; notes?: string }
export interface User { id: string; fullName?: string; email?: string; phone?: string | null; role?: string; isDemo: boolean; demoCode?: string | null }
export interface Session { accessToken: string; refreshToken: string | null; user: User; isDemo: boolean; demoCode: string | null }
