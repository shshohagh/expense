import React, { useState, useEffect, useRef } from 'react';
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
import Ledger from './components/Ledger';
import BudgetManagement from './components/BudgetManagement';
import Settings from './components/Settings';
import Loans from './components/Loans';
import ClientReceivables from './components/ClientReceivables';
import Quotations from './components/Quotations';
import BorrowerManagement from './components/BorrowerManagement';
import PublicQuotationView from './components/PublicQuotationView';
import { Transaction } from './types';
import { subscribeToTransactions, getTransactions, processRecurringTransactions } from './services/firestoreService';
import { t, formatCurrency } from './utils/i18n';
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
  FileText,
  Wallet as WalletIcon,
  Target,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Settings as SettingsIcon,
  BookOpen,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'transactions' | 'loans' | 'borrowers' | 'client_receivables' | 'quotations' | 'admin' | 'profile' | 'categories' | 'recurring' | 'activity' | 'reports' | 'ledger' | 'monthly_cash_flow' | 'annual_breakdown' | 'budgets' | 'settings';

export default function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [publicQuotationId, setPublicQuotationId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [shouldOpenNewTransaction, setShouldOpenNewTransaction] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('q');
    if (qId) {
      setPublicQuotationId(qId);
    }
  }, []);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [topBalance, setTopBalance] = useState<number | null>(null);
  const [showTopBalance, setShowTopBalance] = useState(false);
  const topBalanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  const navItems = React.useMemo(() => [
    { id: 'dashboard', label: t('dashboard', lang), icon: LayoutDashboard },
    { id: 'transactions', label: t('transactions', lang), icon: Receipt },
    { id: 'client_receivables', label: 'Client Receivables', icon: Users },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'borrowers', label: 'Borrowers', icon: Users },
    { id: 'loans', label: 'Loans', icon: Coins },
    { id: 'budgets', label: t('budgets', lang), icon: Target },
    { 
      id: 'reports', 
      label: t('reports', lang), 
      icon: FileText, 
      hasChildren: true 
    },
    { id: 'ledger', label: 'Ledger', icon: BookOpen, parentId: 'reports' },
    { id: 'monthly_cash_flow', label: 'Monthly Cash Flow', icon: FileText, parentId: 'reports' },
    { id: 'annual_breakdown', label: 'Annual Breakdown', icon: FileText, parentId: 'reports' },
    { id: 'activity', label: 'Activity', icon: History, parentId: 'reports' },
    { id: 'recurring', label: t('recurring', lang), icon: Repeat },
    ...(user?.permissions?.includes('manage_categories') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'categories', label: t('categories', lang), icon: Tags }
    ] : []),
    ...(user?.permissions?.includes('view_admin_panel') || user?.role === 'SUPER_ADMIN' ? [
      { id: 'admin', label: t('admin', lang), icon: Users }
    ] : []),
    { id: 'profile', label: t('profile', lang), icon: UserCircle },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ], [lang, user?.permissions, user?.role]);

  const topLevelItems = React.useMemo(() => {
    return navItems.filter((item: any) => !item.parentId);
  }, [navItems]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToTransactions(user.id.toString(), (data) => {
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const fetchBalance = async () => {
    if (!user?.id) return;
    try {
      const transactions = await getTransactions(user.id.toString());
      const activeTransactions = transactions.filter((t: any) => t.status === 'ACTIVE' || !t.status);
      const income = activeTransactions.filter((t: any) => t.type === 'INCOME').reduce((acc: number, t: any) => acc + t.amount, 0);
      const expense = activeTransactions.filter((t: any) => t.type === 'EXPENSE').reduce((acc: number, t: any) => acc + t.amount, 0);
      setTopBalance(income - expense);
    } catch (error) {
      console.error(error);
    }
  };

  const handleTopWalletClick = () => {
    fetchBalance();
    setShowTopBalance(true);
    if (topBalanceTimeoutRef.current) clearTimeout(topBalanceTimeoutRef.current);
    topBalanceTimeoutRef.current = setTimeout(() => setShowTopBalance(false), 5000);
  };

  useEffect(() => {
    return () => {
      if (topBalanceTimeoutRef.current) clearTimeout(topBalanceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      processRecurringTransactions(user.id.toString());
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N for New Transaction
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setCurrentView('transactions');
        setShouldOpenNewTransaction(true);
      }
      // Ctrl+K placeholder for Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        console.log('Search functionality not implemented');
      }

      // Alt + 1-9 shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          const targetIndex = num - 1;
          const targetItem = topLevelItems[targetIndex];
          if (targetItem) {
            e.preventDefault();
            if (targetItem.hasChildren) {
              setOpenMenus(prev => {
                const next = new Set(prev);
                if (next.has(targetItem.id)) next.delete(targetItem.id);
                else next.add(targetItem.id);
                return next;
              });
            } else {
              setCurrentView(targetItem.id as View);
            }
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [topLevelItems]);

  if (publicQuotationId) {
    return (
      <PublicQuotationView 
        quotationId={publicQuotationId} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth theme={theme} toggleTheme={toggleTheme} />;
  }

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
            <button 
              onClick={handleTopWalletClick}
              className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-zinc-900 hover:scale-105 active:scale-95 transition-transform shadow-sm"
              title="Click to see balance"
            >
              <WalletIcon size={20} />
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight hidden sm:block leading-none">Expensy</span>
              <AnimatePresence>
                {showTopBalance && topBalance !== null && (
                  <motion.span 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 leading-none mt-1"
                  >
                    {formatCurrency(topBalance, currency, lang)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{user?.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-xs overflow-hidden">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed left-0 top-16 bottom-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 hidden lg:flex flex-col z-40 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto scrollbar-hide">
              {navItems.filter((item: any) => !item.parentId || openMenus.has(item.parentId)).map((item: any) => {
                const topLevelIndex = topLevelItems.findIndex((t: any) => t.id === item.id);
                const shortcutNum = topLevelIndex !== -1 && topLevelIndex < 9 ? topLevelIndex + 1 : null;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.hasChildren) {
                        const next = new Set(openMenus);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        setOpenMenus(next);
                      } else {
                        setCurrentView(item.id as View);
                      }
                      if (isSidebarCollapsed) {
                        setIsSidebarCollapsed(false);
                      }
                    }}
                    title={isSidebarCollapsed ? item.label : ''}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all group ${
                      currentView === item.id 
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg shadow-zinc-900/10' 
                        : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                    } ${isSidebarCollapsed ? 'justify-center' : ''} ${item.parentId ? 'ml-8' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <item.icon size={20} className="shrink-0" />
                      {!isSidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="truncate text-left"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </div>
                    {!isSidebarCollapsed && shortcutNum && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-xs select-none">
                        Alt+{shortcutNum}
                      </span>
                    )}
                    {item.hasChildren && !isSidebarCollapsed && (
                      <span className="shrink-0 text-[10px] ml-1 group-hover:hidden">
                        {openMenus.has(item.id) ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                );
              })}
        </nav>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <button 
            onClick={logout}
            title={isSidebarCollapsed ? t('logout', lang) : ''}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 transition-all ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span>{t('logout', lang)}</span>}
          </button>
          
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-zinc-900 z-[70] lg:hidden border-r border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-bold text-xl tracking-tight">Expensy</span>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {navItems.filter((item: any) => !item.parentId || openMenus.has(item.parentId)).map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.hasChildren) {
                        const next = new Set(openMenus);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        setOpenMenus(next);
                      } else {
                        setCurrentView(item.id as View);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-base font-medium transition-all ${
                      currentView === item.id 
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg' 
                        : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    } ${item.parentId ? 'ml-8' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon size={22} />
                      {item.label}
                    </div>
                    {item.hasChildren && (
                      <span className="shrink-0">
                        {openMenus.has(item.id) ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-base font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                >
                  <LogOut size={22} />
                  {t('logout', lang)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main 
        className={`transition-all duration-300 pt-16 min-h-screen ${
          isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
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
              {currentView === 'transactions' && (
                <Transactions 
                  shouldOpenNewTransaction={shouldOpenNewTransaction} 
                  onOpenNewTransactionComplete={() => setShouldOpenNewTransaction(false)} 
                />
              )}
              {currentView === 'client_receivables' && <ClientReceivables />}
              {currentView === 'quotations' && <Quotations />}
              {currentView === 'borrowers' && <BorrowerManagement />}
              {currentView === 'loans' && <Loans />}
              {currentView === 'recurring' && <RecurringTransactions />}
              {currentView === 'ledger' && <Ledger transactions={transactions} currency={currency} lang={lang} />}
              {currentView === 'monthly_cash_flow' && <Reports focusedReport="monthly" />}
              {currentView === 'annual_breakdown' && <Reports focusedReport="annual" />}
              {currentView === 'categories' && <CategoryManagement />}
              {currentView === 'admin' && <AdminPanel />}
              {currentView === 'profile' && <Profile />}
              {currentView === 'activity' && <UserActivity />}
              {currentView === 'reports' && <Reports />}
              {currentView === 'budgets' && <BudgetManagement />}
              {currentView === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
