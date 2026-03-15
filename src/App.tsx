import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import AdminPanel from './components/AdminPanel';
import CategoryManagement from './components/CategoryManagement';
import RecurringTransactions from './components/RecurringTransactions';
import Profile from './components/Profile';
import UserActivity from './components/UserActivity';
import Reports from './components/Reports';
import { t } from './utils/i18n';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  UserCircle, 
  LogOut, 
  Menu, 
  X,
  Tags,
  Repeat,
  History,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'transactions' | 'admin' | 'profile' | 'categories' | 'recurring' | 'activity' | 'reports';

export default function App() {
  const { isAuthenticated, isLoading, user, logout, token } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const lang = user?.language || 'en';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  const navItems = [
    { id: 'dashboard', label: t('dashboard', lang), icon: LayoutDashboard },
    { id: 'transactions', label: t('transactions', lang), icon: Receipt },
    { id: 'reports', label: t('reports', lang), icon: FileText },
    { id: 'recurring', label: t('recurring', lang), icon: Repeat },
    { id: 'activity', label: 'Activity', icon: History },
    ...(user?.permissions?.includes('manage_categories') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'categories', label: t('categories', lang), icon: Tags }
    ] : []),
    ...(user?.permissions?.includes('view_admin_panel') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'admin', label: t('admin', lang), icon: Users }
    ] : []),
    { id: 'profile', label: t('profile', lang), icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-50 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-3 text-zinc-900 dark:text-white">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-zinc-900">
              <Wallet size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">Expensy</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{user?.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 hidden lg:flex flex-col z-40">
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentView === item.id 
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg shadow-zinc-900/10' 
                  : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 transition-all"
          >
            <LogOut size={20} />
            {t('logout', lang)}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-16 bottom-0 w-[280px] bg-white dark:bg-zinc-900 z-50 lg:hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col"
            >
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id as View);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-lg font-medium transition-all ${
                      currentView === item.id 
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' 
                        : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <item.icon size={24} />
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-lg font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                >
                  <LogOut size={24} />
                  {t('logout', lang)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && <Dashboard />}
              {currentView === 'transactions' && <Transactions />}
              {currentView === 'recurring' && <RecurringTransactions />}
              {currentView === 'categories' && <CategoryManagement />}
              {currentView === 'admin' && <AdminPanel />}
              {currentView === 'profile' && <Profile />}
              {currentView === 'activity' && <UserActivity />}
              {currentView === 'reports' && <Reports />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Wallet({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
