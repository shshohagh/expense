import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { formatCurrency, t } from '../utils/i18n';
import { FileText, Download, Calendar, Filter, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { subscribeToTransactions } from '../services/firestoreService';

export default function Reports() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToTransactions(user.id.toString(), (data) => {
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const activeTransactions = transactions.filter(t => t.status === 'ACTIVE' || !t.status);

  // Data Processing for different report types
  const getDailyData = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const data = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayTransactions = activeTransactions.filter(t => t.date === dateStr);
      data.push({
        name: i.toString(),
        income: dayTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0),
        expense: dayTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  };

  const getWeeklyData = () => {
    // Group by week of the year
    const data: { [key: string]: { income: number, expense: number, label: string, weekNum: number } } = {};
    
    activeTransactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return;
      
      // Simple week calculation
      const oneJan = new Date(d.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
      
      const key = `Week ${weekNum}`;
      if (!data[key]) {
        // Calculate start and end of week
        const startOfWeek = new Date(selectedYear, 0, 1 + (weekNum - 1) * 7);
        const endOfWeek = new Date(selectedYear, 0, 1 + (weekNum - 1) * 7 + 6);
        const dateRange = `${startOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleString('default', { month: 'short', day: 'numeric' })}`;
        
        data[key] = { income: 0, expense: 0, label: dateRange, weekNum };
      }
      
      if (t.type === 'INCOME') data[key].income += t.amount;
      else data[key].expense += t.amount;
    });

    return Object.values(data).sort((a, b) => a.weekNum - b.weekNum);
  };

  const getMonthlyData = () => {
    const data = [];
    for (let i = 0; i < 12; i++) {
      const monthTransactions = activeTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === i && d.getFullYear() === selectedYear;
      });
      data.push({
        name: new Date(selectedYear, i).toLocaleString('default', { month: 'short' }),
        income: monthTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0),
        expense: monthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  };

  const chartData = reportType === 'daily' ? getDailyData() : reportType === 'weekly' ? getWeeklyData() : getMonthlyData();

  // Category breakdown for the selected period
  const getCategoryData = () => {
    const filtered = activeTransactions.filter(t => {
      const d = new Date(t.date);
      if (reportType === 'daily') {
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }
      return d.getFullYear() === selectedYear;
    });

    return filtered
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
  };

  const categoryData = getCategoryData();
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const getTopExpenses = () => {
    return activeTransactions
      .filter(t => {
        const d = new Date(t.date);
        if (reportType === 'daily') {
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        }
        return d.getFullYear() === selectedYear;
      })
      .filter(t => t.type === 'EXPENSE')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  };

  const topExpenses = getTopExpenses();

  const handleExport = (format: 'csv' | 'xlsx') => {
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Description'];
    const data = activeTransactions.map(t => ({
      Date: t.date,
      Type: t.type,
      Amount: t.amount,
      Category: t.categoryName || '',
      Description: t.description || ''
    }));

    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...data.map(row => [
          row.Date,
          row.Type,
          row.Amount,
          row.Category,
          `"${row.Description}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `financial_report_${reportType}_${selectedYear}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Report");
      XLSX.writeFile(workbook, `financial_report_${reportType}_${selectedYear}.xlsx`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading reports...</div>;

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports', lang)}</h1>
          <p className="text-muted-foreground">Comprehensive financial analysis and visualizations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm self-start md:self-auto"
          >
            <Download size={16} /> CSV
          </button>
          <button 
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm self-start md:self-auto"
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </header>

      {/* Report Type Selector */}
      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          {(['daily', 'weekly', 'monthly'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                reportType === type 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {reportType === 'daily' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold">
                {reportType === 'daily' ? 'Daily' : reportType === 'weekly' ? 'Weekly' : 'Monthly'} Cash Flow
              </h3>
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-500">
                  <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                  <span>Expense</span>
                </div>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey={reportType === 'weekly' ? 'label' : 'name'} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(value) => formatCurrency(value, currency, lang, { maximumFractionDigits: 0 })} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value, currency, lang)}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={reportType === 'daily' ? 10 : 30} />
                  <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={reportType === 'daily' ? 10 : 30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-lg font-bold mb-8">Annual Monthly Breakdown ({selectedYear})</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getMonthlyData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(value) => formatCurrency(value, currency, lang, { maximumFractionDigits: 0 })} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value, currency, lang)}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Savings Trend */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-lg font-bold mb-8 text-zinc-900 dark:text-white">Net Savings Trend</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey={reportType === 'weekly' ? 'label' : 'name'} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(value) => formatCurrency(value, currency, lang, { maximumFractionDigits: 0 })} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value, currency, lang)}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={(d) => d.income - d.expense} 
                    name="Savings"
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorSavings)" 
                    strokeWidth={3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          {/* Category Wise Expense */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-lg font-bold mb-8">Category Wise Expense</h3>
            <div className="h-[300px] mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none' }}
                    formatter={(value: number) => formatCurrency(value, currency, lang)} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {categoryData.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(item.value, currency, lang)}</span>
                </div>
              ))}
              {categoryData.length > 5 && (
                <p className="text-center text-xs text-muted-foreground pt-2">
                  + {categoryData.length - 5} more categories
                </p>
              )}
            </div>
          </motion.div>

          {/* Summary Stats */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="p-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-3xl shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 dark:bg-black/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 dark:bg-black/10 rounded-xl">
                  <FileText size={20} />
                </div>
                <h3 className="font-bold text-lg">Period Summary</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-sm font-medium opacity-60 uppercase tracking-widest">Total Income</p>
                  <p className="text-2xl font-black text-emerald-400 dark:text-emerald-600">
                    {formatCurrency(chartData.reduce((acc, d) => acc + d.income, 0), currency, lang)}
                  </p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-sm font-medium opacity-60 uppercase tracking-widest">Total Expenses</p>
                  <p className="text-2xl font-black text-rose-400 dark:text-rose-600">
                    {formatCurrency(chartData.reduce((acc, d) => acc + d.expense, 0), currency, lang)}
                  </p>
                </div>
                <div className="pt-6 border-t border-white/10 dark:border-black/10 flex justify-between items-end">
                  <p className="text-sm font-medium opacity-60 uppercase tracking-widest">Net Savings</p>
                  <p className="text-3xl font-black">
                    {formatCurrency(
                      chartData.reduce((acc, d) => acc + d.income, 0) - chartData.reduce((acc, d) => acc + d.expense, 0), 
                      currency, lang
                    )}
                  </p>
                </div>
                {chartData.reduce((acc, d) => acc + d.income, 0) > 0 && (
                  <div className="flex justify-between items-center bg-white/5 dark:bg-black/5 p-4 rounded-2xl">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60">Savings Rate</p>
                    <p className="text-xl font-black text-emerald-400 dark:text-emerald-600">
                      {Math.round(((chartData.reduce((acc, d) => acc + d.income, 0) - chartData.reduce((acc, d) => acc + d.expense, 0)) / chartData.reduce((acc, d) => acc + d.income, 0)) * 100)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Top Expenses Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">Top Expenses for {reportType === 'daily' ? new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' }) : selectedYear}</h3>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top 10 Transactions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topExpenses.length > 0 ? (
                topExpenses.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{t.date}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {t.categoryName || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]">{t.description || '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-rose-500">
                      {formatCurrency(t.amount, currency, lang)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                    No expenses found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
