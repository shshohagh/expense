import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import AdminPanel from './components/AdminPanel';
import CategoryManagement from './components/CategoryManagement';
import RecurringTransactions from './components/RecurringTransactions';
import Profile from './components/Profile';
import { t } from './utils/i18n';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  UserCircle, 
  LogOut, 
  Menu, 
  X,
  Cloud,
  Tags,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'transactions' | 'admin' | 'profile' | 'categories' | 'recurring';

export default function App() {
  const { isAuthenticated, isLoading, user, logout, token } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    { id: 'recurring', label: t('recurring', lang), icon: Repeat },
    ...(user?.permissions?.includes('manage_categories') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'categories', label: t('categories', lang), icon: Tags }
    ] : []),
    ...(user?.permissions?.includes('view_admin_panel') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'admin', label: t('admin', lang), icon: Users }
    ] : []),
    { id: 'profile', label: t('profile', lang), icon: UserCircle },
  ];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/auth/google/url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { url } = await res.json();
      
      const authWindow = window.open(url, 'google_oauth', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          alert('Google Drive connected! Syncing database...');
          // In a real app, you'd trigger the actual upload here
          fetch('/api/sync/google-drive', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json()).then(data => {
            alert(data.message || 'Sync complete!');
          });
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 hidden lg:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 text-zinc-900 dark:text-white">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-zinc-900">
              <Wallet size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight">Expensy</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
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
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 transition-all disabled:opacity-50"
          >
            <Cloud size={20} />
            {syncing ? 'Syncing...' : 'Cloud Backup'}
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 transition-all"
          >
            <LogOut size={20} />
            {t('logout', lang)}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-zinc-900">
            <Wallet size={20} />
          </div>
          <span className="font-bold text-lg">Expensy</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-zinc-500"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-30 bg-white dark:bg-zinc-900 lg:hidden pt-20 px-4"
          >
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-lg font-medium ${
                    currentView === item.id 
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' 
                      : 'text-muted-foreground'
                  }`}
                >
                  <item.icon size={24} />
                  {item.label}
                </button>
              ))}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={handleSync}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-lg font-medium text-emerald-600"
                >
                  <Cloud size={24} />
                  Cloud Backup
                </button>
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-lg font-medium text-rose-600"
                >
                  <LogOut size={24} />
                  {t('logout', lang)}
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:ml-64 pt-20 lg:pt-0 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
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
