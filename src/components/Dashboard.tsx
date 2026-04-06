import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Budget } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { formatCurrency, t } from '../utils/i18n';
import { 
  ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, 
  Eye, EyeOff, Target, PiggyBank, Percent, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToTransactions, subscribeToBudgets } from '../services/firestoreService';

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  const toggleBalance = () => {
    setShowBalance(!showBalance);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!showBalance) {
      timeoutRef.current = setTimeout(() => setShowBalance(false), 5000);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const unsubTransactions = subscribeToTransactions(user.id.toString(), (data) => {
      setTransactions(data);
      setLoading(false);
    });

    const unsubBudgets = subscribeToBudgets(user.id.toString(), (data) => {
      setBudgets(data);
    });

    return () => {
      unsubTransactions();
      unsubBudgets();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user?.id]);

  const activeTransactions = transactions.filter(t => t.status === 'ACTIVE' || !t.status);

  const totalIncome = activeTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = activeTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);

  const balance = totalIncome - totalExpense;

  // Monthly Summary Calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTransactions = activeTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisMonthIncome = thisMonthTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0);

  const thisMonthExpense = thisMonthTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  const thisMonthSavings = thisMonthIncome - thisMonthExpense;
  const savingsRate = thisMonthIncome > 0 ? (thisMonthSavings / thisMonthIncome) * 100 : 0;

  // Prepare chart data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayTransactions = activeTransactions.filter(t => t.date === date);
    return {
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      income: dayTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0),
      expense: dayTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0),
    };
  });

  const categoryData = activeTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc: any[], t) => {
      const catName = t.categoryName || 'Unknown';
      const existing = acc.find(item => item.name === catName);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: catName, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard', lang)}</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your finances.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <ArrowUpCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('income', lang)}</p>
              <h2 className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome, currency, lang)}</h2>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
              <Target size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('budgets', lang)}</p>
              <h2 className="text-2xl font-bold text-purple-600">{formatCurrency(totalBudget, currency, lang)}</h2>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl">
              <ArrowDownCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('expense', lang)}</p>
              <h2 className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense, currency, lang)}</h2>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={toggleBalance}
          whileTap={{ scale: 0.98 }}
          className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {t('total_balance', lang)}
                {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
              </p>
              <h2 className="text-2xl font-bold transition-all duration-300">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={showBalance ? 'visible' : 'hidden'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    {showBalance ? formatCurrency(balance, currency, lang) : '••••••'}
                  </motion.span>
                </AnimatePresence>
              </h2>
            </div>
          </div>
          {!showBalance && (
            <div className="absolute inset-0 bg-blue-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Tap to show</span>
            </div>
          )}
        </motion.div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <Calendar size={18} />
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            {new Date().toLocaleDateString(lang, { month: 'long', year: 'numeric' })} Summary
          </h2>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Income</p>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
                <TrendingUp size={14} />
              </div>
            </div>
            <h3 className="text-xl font-bold">{formatCurrency(thisMonthIncome, currency, lang)}</h3>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Expense</p>
              <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg">
                <TrendingDown size={14} />
              </div>
            </div>
            <h3 className="text-xl font-bold">{formatCurrency(thisMonthExpense, currency, lang)}</h3>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Savings</p>
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                <PiggyBank size={14} />
              </div>
            </div>
            <h3 className={`text-xl font-bold ${thisMonthSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(thisMonthSavings, currency, lang)}
            </h3>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Savings Rate</p>
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg">
                <Percent size={14} />
              </div>
            </div>
            <h3 className="text-xl font-bold">{savingsRate.toFixed(1)}%</h3>
            <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }}
                className="h-full bg-amber-500"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-semibold mb-6">Weekly Trends</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency, lang, { maximumFractionDigits: 0 })} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value, currency, lang)}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name={t('income', lang)} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name={t('expense', lang)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-lg font-semibold mb-6">Expenses by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, currency, lang)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
