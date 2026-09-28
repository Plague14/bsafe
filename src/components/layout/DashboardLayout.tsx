import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
// Removido: import { useStore } from '../../store';

export function DashboardLayout() {
  // Removido: const { isAuthenticated, onboardingCompleted } = useStore();

  // Removido: if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Removido: if (!onboardingCompleted) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header variant="app" />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}