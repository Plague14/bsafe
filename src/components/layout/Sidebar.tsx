import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Wallet, MessageSquare, CreditCard, Settings, X, LogOut } from 'lucide-react';
import { useStore } from '../../store';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/beneficiaries', icon: Users, label: 'Herdeiros' },
  { to: '/dashboard/assets', icon: Wallet, label: 'Ativos' },
  { to: '/dashboard/messages', icon: MessageSquare, label: 'Mensagens' },
  { to: '/dashboard/plans', icon: CreditCard, label: 'Planos' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, logout } = useStore();

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden" onClick={toggleSidebar} />
      )}
      <aside className={clsx(
        'fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100">
          <span className="text-xl font-bold text-primary-600">BSafe</span>
          <button onClick={toggleSidebar} className="lg:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <button
            onClick={() => { logout(); window.location.href = '/'; }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
