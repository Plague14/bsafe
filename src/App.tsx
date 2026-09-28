import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletProvider';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { DashboardLayout } from './components/layout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { BeneficiariesPage } from './pages/dashboard/BeneficiariesPage';
import { AssetsPage } from './pages/dashboard/AssetsPage';
import { MessagesPage } from './pages/dashboard/MessagesPage';
import { PlansPage } from './pages/dashboard/PlansPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="beneficiaries" element={<BeneficiariesPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
