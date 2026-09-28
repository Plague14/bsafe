import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Beneficiary, Asset, Document, Notification } from '../types';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  onboardingStep: number;
  onboardingCompleted: boolean;
  beneficiaries: Beneficiary[];
  assets: Asset[];
  documents: Document[];
  notifications: Notification[];
  sidebarOpen: boolean;
  
  setUser: (user: User | null) => void;
  logout: () => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  addBeneficiary: (b: Beneficiary) => void;
  updateBeneficiary: (id: string, b: Partial<Beneficiary>) => void;
  removeBeneficiary: (id: string) => void;
  addDocument: (d: Document) => void;
  removeDocument: (id: string) => void;
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      onboardingStep: 1,
      onboardingCompleted: false,
      beneficiaries: [],
      assets: [
        { symbol: 'BTC', name: 'Bitcoin', balance: 0.5, valueBRL: 175000, valueUSD: 32000, change24h: 2.5, icon: '₿', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
        { symbol: 'ETH', name: 'Ethereum', balance: 2.3, valueBRL: 27600, valueUSD: 5040, change24h: -1.2, icon: 'Ξ', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
        { symbol: 'SCRT', name: 'Secret', balance: 1000, valueBRL: 2500, valueUSD: 456, change24h: 5.1, icon: '🔒', address: 'secret1abc123def456ghi789jkl012mno345' },
      ],
      documents: [],
      notifications: [],
      sidebarOpen: true,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false, beneficiaries: [], documents: [], notifications: [] }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      addBeneficiary: (b) => set((s) => ({ beneficiaries: [...s.beneficiaries, b] })),
      updateBeneficiary: (id, data) => set((s) => ({ beneficiaries: s.beneficiaries.map(b => b.id === id ? { ...b, ...data } : b) })),
      removeBeneficiary: (id) => set((s) => ({ beneficiaries: s.beneficiaries.filter(b => b.id !== id) })),
      addDocument: (d) => set((s) => ({ documents: [...s.documents, d] })),
      removeDocument: (id) => set((s) => ({ documents: s.documents.filter(d => d.id !== id) })),
      addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'bsafe-storage' }
  )
);
