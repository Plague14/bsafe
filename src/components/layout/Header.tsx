import { Link, useLocation } from 'react-router-dom';
import { Menu, Bell, Settings } from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui';
import { WalletButton, WalletStatus } from '../ui/WalletButton';

interface HeaderProps {
  variant?: 'landing' | 'app';
}

export function Header({ variant = 'landing' }: HeaderProps) {
  const location = useLocation();
  const { toggleSidebar, notifications } = useStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  if (variant === 'landing') {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary-600">BSafe</Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Recursos</a>
            <a href="#precos" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Preços</a>
            <a href="#sobre" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Sobre</a>
          </nav>
          <Link to="/onboarding">
            <Button size="sm">Entrar →</Button>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 lg:pl-64">
      <div className="h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={toggleSidebar} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500">
            {location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.split('/').pop()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <WalletStatus />
          <Link to="/dashboard/settings" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary-600 rounded-full" />
            )}
          </Link>
          <Link to="/dashboard/settings" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <Settings className="w-5 h-5" />
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
