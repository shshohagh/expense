import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { formatCurrency, t } from '../utils/i18n';
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const activeTransactions = transactions.filter(t => t.status === 'ACTIVE' || !t.status);

  const totalIncome = activeTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = activeTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

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

      <div className="grid gap-4 md:grid-cols-3">
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
          className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('total_balance', lang)}</p>
              <h2 className="text-2xl font-bold">{formatCurrency(balance, currency, lang)}</h2>
            </div>
          </div>
        </motion.div>
      </div>

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
