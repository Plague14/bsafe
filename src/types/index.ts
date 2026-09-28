export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  vaultAddress?: string;
  viewingKey?: string;
  subscriptionTier: 'free' | 'basic' | 'premium' | 'enterprise';
  kycStatus: 'pending' | 'verified' | 'rejected';
  createdAt: Date;
}

export interface Beneficiary {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  percentage: number;
  message?: string;
  cid?: string;
  createdAt: Date;
}

export interface Asset {
  symbol: string;
  name: string;
  balance: number;
  valueBRL: number;
  valueUSD: number;
  change24h: number;
  address: string;
  icon: string;
}

export interface Document {
  id: string;
  type: 'text' | 'video' | 'audio';
  title: string;
  cid: string;
  duration?: number;
  size: number;
  forBeneficiary?: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
