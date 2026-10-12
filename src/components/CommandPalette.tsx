import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  ArrowRight, 
  LayoutDashboard, 
  Receipt, 
  Users, 
  FileText, 
  BookOpen, 
  Repeat, 
  Tags, 
  UserCircle, 
  Settings as SettingsIcon, 
  History, 
  Plus, 
  Sun, 
  Moon, 
  Wallet, 
  Download, 
  Sparkles,
  Command,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  SlidersHorizontal,
  CornerDownLeft
} from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency, t } from '../utils/i18n';
import { formatDate } from '../lib/utils';

export type AppView = 
  | 'dashboard' 
  | 'ai_insights'
  | 'transactions' 
  | 'quotations' 
  | 'admin' 
  | 'profile' 
  | 'categories' 
  | 'recurring' 
  | 'activity' 
  | 'reports' 
  | 'ledger' 
  | 'monthly_cash_flow' 
  | 'annual_breakdown' 
  | 'settings';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onSelectTransaction: (transaction: Transaction) => void;
  onNewTransaction: () => void;
  onToggleTheme: () => void;
  onShowBalance: () => void;
  theme: 'light' | 'dark';
  transactions: Transaction[];
  currency: string;
  lang: string;
  userRole?: string;
  userPermissions?: string[];
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Views & Navigation' | 'Transactions' | 'Quick Actions';
  icon: React.ElementType;
  iconColor?: string;
  badge?: string;
  badgeColor?: string;
  amount?: number;
  type?: 'INCOME' | 'EXPENSE';
  keywords?: string[];
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onSelectTransaction,
  onNewTransaction,
  onToggleTheme,
  onShowBalance,
  theme,
  transactions,
  currency,
  lang,
  userRole,
  userPermissions
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'VIEWS' | 'TRANSACTIONS' | 'ACTIONS'>('ALL');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedFilter('ALL');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Views list
  const navigationItems = useMemo(() => {
    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    const canManageCategories = isSuperAdmin || userPermissions?.includes('manage_categories');
    const canViewAdmin = isSuperAdmin || userPermissions?.includes('view_admin_panel');

    const views: Array<{
      id: AppView;
      title: string;
      subtitle: string;
      icon: React.ElementType;
      keywords: string[];
    }> = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Overview of metrics, charts, cash flow, and quick insights',
        icon: LayoutDashboard,
        keywords: ['overview', 'analytics', 'charts', 'summary', 'home', 'main']
      },
      {
        id: 'ai_insights',
        title: 'AI Financial Insights',
        subtitle: 'AI spending category breakdown, financial health score, and budget optimizations',
        icon: Sparkles,
        keywords: ['ai', 'insights', 'budget', 'optimization', 'gemini', 'categories', 'spending', 'savings']
      },
      {
        id: 'transactions',
        title: 'Transactions',
        subtitle: 'Income and expense history with category tags and filters',
        icon: Receipt,
        keywords: ['income', 'expense', 'records', 'money', 'payments', 'spending']
      },
      {
        id: 'ledger',
        title: 'Double Entry Ledger',
        subtitle: 'Debits, credits, accounting journal and CSV export',
        icon: BookOpen,
        keywords: ['bookkeeping', 'debit', 'credit', 'accounting', 'journal', 'export']
      },
      {
        id: 'quotations',
        title: 'Quotations & Estimates',
        subtitle: 'Create, manage, and share price quotations with clients',
        icon: FileText,
        keywords: ['estimates', 'proposals', 'quotes', 'share', 'pdf', 'pricing']
      },
      {
        id: 'reports',
        title: 'Financial Reports',
        subtitle: 'Detailed revenue, expenditure, and category analysis',
        icon: FileText,
        keywords: ['analytics', 'graphs', 'statistics', 'statements', 'tax']
      },
      {
        id: 'monthly_cash_flow',
        title: 'Monthly Cash Flow',
        subtitle: 'Month-by-month inflow vs outflow breakdown',
        icon: FileText,
        keywords: ['monthly', 'cash flow', 'net income', 'trends']
      },
      {
        id: 'annual_breakdown',
        title: 'Annual Breakdown',
        subtitle: 'Year-over-year financial comparisons and fiscal review',
        icon: FileText,
        keywords: ['annual', 'yearly', 'fiscal', 'yoy']
      },
      {
        id: 'recurring',
        title: 'Recurring Transactions',
        subtitle: 'Automated subscriptions, salaries, and recurring bills',
        icon: Repeat,
        keywords: ['subscriptions', 'auto', 'schedule', 'bills', 'rent', 'payroll']
      },
      {
        id: 'activity',
        title: 'User Activity Log',
        subtitle: 'Audit trail of recent account actions and modifications',
        icon: History,
        keywords: ['audit', 'history', 'logs', 'security', 'events']
      },
      ...(canManageCategories ? [{
        id: 'categories' as AppView,
        title: 'Categories Management',
        subtitle: 'Customize income and expense classification tags',
        icon: Tags,
        keywords: ['tags', 'labels', 'custom', 'organize', 'grouping']
      }] : []),
      ...(canViewAdmin ? [{
        id: 'admin' as AppView,
        title: 'Admin Panel',
        subtitle: 'User access control, approvals, and system permissions',
        icon: Users,
        keywords: ['users', 'roles', 'permissions', 'super admin', 'access']
      }] : []),
      {
        id: 'profile',
        title: 'User Profile',
        subtitle: 'Account details, language preferences, and currency settings',
        icon: UserCircle,
        keywords: ['account', 'user', 'password', 'currency', 'language', 'avatar']
      },
      {
        id: 'settings',
        title: 'System Settings',
        subtitle: 'Application configuration, display, and data preferences',
        icon: SettingsIcon,
        keywords: ['config', 'theme', 'options', 'defaults', 'data']
      }
    ];

    return views;
  }, [userRole, userPermissions]);

  // Quick Action items
  const quickActionItems: CommandItem[] = useMemo(() => [
    {
      id: 'action-new-transaction',
      title: 'Create New Transaction',
      subtitle: 'Record an income or expense transaction (Ctrl+N)',
      category: 'Quick Actions',
      icon: Plus,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      badge: 'Ctrl+N',
      keywords: ['add', 'new', 'create', 'expense', 'income', 'payment', 'record'],
      action: () => {
        onClose();
        onNewTransaction();
      }
    },
    {
      id: 'action-toggle-theme',
      title: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      subtitle: `Currently using ${theme} theme`,
      category: 'Quick Actions',
      icon: theme === 'light' ? Moon : Sun,
      iconColor: 'text-amber-500 dark:text-amber-400',
      keywords: ['dark', 'light', 'theme', 'color', 'mode', 'night', 'appearance'],
      action: () => {
        onClose();
        onToggleTheme();
      }
    },
    {
      id: 'action-show-balance',
      title: 'Reveal Quick Wallet Balance',
      subtitle: 'Fetch and display the net balance in the top bar',
      category: 'Quick Actions',
      icon: Wallet,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      keywords: ['balance', 'wallet', 'funds', 'total', 'cash', 'money'],
      action: () => {
        onClose();
        onShowBalance();
      }
    },
    {
      id: 'action-export-ledger',
      title: 'Export Double-Entry Ledger (CSV)',
      subtitle: 'Open the Ledger view to download accounting financial history',
      category: 'Quick Actions',
      icon: Download,
      iconColor: 'text-blue-600 dark:text-blue-400',
      badge: 'CSV',
      keywords: ['export', 'download', 'csv', 'spreadsheet', 'accounting', 'backup'],
      action: () => {
        onClose();
        onNavigate('ledger');
      }
    }
  ], [theme, onClose, onNewTransaction, onToggleTheme, onShowBalance, onNavigate]);

  // Build comprehensive items list based on query
  const allItems: CommandItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();

    // 1. Navigation items
    const navCommandItems: CommandItem[] = navigationItems.map(item => ({
      id: `view-${item.id}`,
      title: item.title,
      subtitle: item.subtitle,
      category: 'Views & Navigation',
      icon: item.icon,
      iconColor: 'text-zinc-700 dark:text-zinc-300',
      keywords: item.keywords,
      action: () => {
        onClose();
        onNavigate(item.id);
      }
    }));

    // 2. Transaction search items
    const activeTransactions = transactions.filter(t => t.status === 'ACTIVE' || !t.status);
    const transactionCommandItems: CommandItem[] = activeTransactions.map(t => {
      const isIncome = t.type === 'INCOME';
      const categoryLabel = (t as any).categoryName || 'General';
      return {
        id: `tx-${t.id}`,
        title: t.description || `${categoryLabel} Transaction`,
        subtitle: `${formatDate(t.date)} • ${categoryLabel} • ${t.type}`,
        category: 'Transactions',
        icon: isIncome ? ArrowDownRight : ArrowUpRight,
        iconColor: isIncome ? 'text-emerald-500' : 'text-rose-500',
        amount: t.amount,
        type: t.type,
        badge: categoryLabel,
        keywords: [
          t.description || '',
          categoryLabel,
          t.type,
          t.date,
          String(t.amount),
          isIncome ? 'income' : 'expense'
        ],
        action: () => {
          onClose();
          onSelectTransaction(t);
        }
      };
    });

    let combined: CommandItem[] = [];

    if (selectedFilter === 'VIEWS') {
      combined = navCommandItems;
    } else if (selectedFilter === 'TRANSACTIONS') {
      combined = transactionCommandItems;
    } else if (selectedFilter === 'ACTIONS') {
      combined = quickActionItems;
    } else {
      combined = [...quickActionItems, ...navCommandItems, ...transactionCommandItems];
    }

    if (!q) {
      // Return curated list when no query
      if (selectedFilter === 'ALL') {
        return [
          ...quickActionItems.slice(0, 2),
          ...navCommandItems.slice(0, 8),
          ...transactionCommandItems.slice(0, 5)
        ];
      }
      return combined.slice(0, 20);
    }

    // Filter items matching query
    return combined.filter(item => {
      const inTitle = item.title.toLowerCase().includes(q);
      const inSub = item.subtitle?.toLowerCase().includes(q);
      const inKeywords = item.keywords?.some(k => k.toLowerCase().includes(q));
      const inBadge = item.badge?.toLowerCase().includes(q);
      const inAmount = item.amount ? String(item.amount).includes(q) : false;
      return inTitle || inSub || inKeywords || inBadge || inAmount;
    }).slice(0, 25);
  }, [query, navigationItems, quickActionItems, transactions, selectedFilter, onClose, onNavigate, onSelectTransaction]);

  // Adjust selectedIndex when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length, query, selectedFilter]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected) {
          selected.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allItems, selectedIndex, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-20 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Command Palette Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        >
          {/* Top Search Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 gap-3">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search views, transactions, or quick actions (e.g. Ledger, Rent, +500)..."
              className="w-full bg-transparent text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X size={16} />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 select-none">
              <span>ESC to exit</span>
            </div>
          </div>

          {/* Quick Scope Filter Chips */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-50/60 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 overflow-x-auto scrollbar-hide text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                selectedFilter === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              All Results
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('VIEWS')}
              className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                selectedFilter === 'VIEWS'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Views ({navigationItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('TRANSACTIONS')}
              className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                selectedFilter === 'TRANSACTIONS'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Transactions ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('ACTIONS')}
              className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                selectedFilter === 'ACTIONS'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Quick Actions
            </button>
          </div>

          {/* Results List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
            {allItems.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <Search size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No results found for "{query}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Try searching for view names like "Transactions", "Ledger", or descriptions from your income and expenses.
                  </p>
                </div>
              </div>
            ) : (
              allItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const IconComponent = item.icon;

                return (
                  <div
                    key={item.id}
                    data-index={index}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        isSelected 
                          ? 'bg-white dark:bg-zinc-900 shadow-xs' 
                          : 'bg-zinc-100/80 dark:bg-zinc-800/60'
                      }`}>
                        <IconComponent size={18} className={item.iconColor || 'text-zinc-600 dark:text-zinc-400'} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
                              {item.badge}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold hidden md:inline-block">
                            {item.category}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side: Amount (for transactions) or Navigate prompt */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.amount !== undefined && (
                        <span className={`text-sm font-bold font-mono ${
                          item.type === 'INCOME' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {item.type === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount, currency, lang)}
                        </span>
                      )}

                      <div className={`p-1 rounded-lg ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-transparent'}`}>
                        <CornerDownLeft size={14} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Shortcuts / Footer Bar */}
          <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded">↓</kbd>
                Navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded">↵</kbd>
                Select
              </span>
            </div>

            <div className="flex items-center gap-2 text-zinc-400">
              <Sparkles size={12} className="text-indigo-500" />
              <span className="hidden sm:inline">Quick Navigation & Transaction Search</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
