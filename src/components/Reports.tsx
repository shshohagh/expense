import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { formatCurrency, t } from '../utils/i18n';
import { FileText, Download, Calendar, Filter, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

export default function Reports() {
  const { token, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'year'>('30d');

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

  // Filter by time range
  const filteredTransactions = activeTransactions.filter(t => {
    const date = new Date(t.date);
    const now = new Date();
    if (timeRange === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return date >= thirtyDaysAgo;
    } else if (timeRange === '90d') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      return date >= ninetyDaysAgo;
    } else if (timeRange === 'year') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      return date >= oneYearAgo;
    }
    return true;
  });

  // Monthly breakdown for the last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      key: `${d.getFullYear()}-${d.getMonth() + 1}`
    };
  }).reverse();

  const monthlyData = months.map(m => {
    const monthTransactions = activeTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() + 1 === (m.key.split('-')[1] as any * 1) && d.getFullYear() === m.year;
    });
    return {
      name: m.month,
      income: monthTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0),
      expense: monthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0),
    };
  });

  // Category breakdown
  const categoryData = filteredTransactions
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
    }, [])
    .sort((a, b) => b.value - a.value);

  // Top expenses
  const topExpenses = [...filteredTransactions]
    .filter(t => t.type === 'EXPENSE')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const handleExport = () => {
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Description'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        t.date,
        t.type,
        t.amount,
        t.categoryName || '',
        `"${t.description || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${timeRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-center">Loading reports...</div>;

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports', lang)}</h1>
          <p className="text-muted-foreground">In-depth analysis of your financial performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="appearance-none pl-10 pr-10 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 shadow-sm transition-all"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="year">Last Year</option>
            </select>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Monthly Comparison */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Monthly Income vs Expense</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                  <span>Expense</span>
                </div>
              </div>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency, lang, { maximumFractionDigits: 0 })} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value, currency, lang)}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Expenses Table */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-6">Top Expenses ({timeRange === '30d' ? 'Last 30 Days' : timeRange === '90d' ? 'Last 90 Days' : 'Last Year'})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {topExpenses.map((t, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-4 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase tracking-wider">
                          {t.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground truncate max-w-[200px]">{t.description || '-'}</td>
                      <td className="py-4 text-sm font-semibold text-rose-600 text-right">{formatCurrency(t.amount, currency, lang)}</td>
                    </tr>
                  ))}
                  {topExpenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">No expenses found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          {/* Category Distribution */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm h-full"
          >
            <h3 className="text-lg font-semibold mb-6">Expense Distribution</h3>
            <div className="h-[300px] mb-8">
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
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {categoryData.slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatCurrency(item.value, currency, lang)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl shadow-lg"
          >
            <div className="flex items-center gap-3 mb-6">
              <FileText className="opacity-60" size={20} />
              <h3 className="font-semibold">Period Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-sm opacity-60">Total Income</p>
                <p className="text-xl font-bold text-emerald-400 dark:text-emerald-600">
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0), currency, lang)}
                </p>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-sm opacity-60">Total Expenses</p>
                <p className="text-xl font-bold text-rose-400 dark:text-rose-600">
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0), currency, lang)}
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 dark:border-black/10 flex justify-between items-end">
                <p className="text-sm opacity-60">Net Savings</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0) - 
                    filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0), 
                    currency, lang
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
