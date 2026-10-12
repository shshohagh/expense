import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, AiSpendingInsights, BudgetOptimizationSuggestion } from '../types';
import { 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight, 
  AlertTriangle, 
  Target, 
  CheckCircle2, 
  Copy, 
  RefreshCw, 
  PiggyBank, 
  ShieldCheck, 
  Calendar,
  Layers,
  Zap,
  BarChart3,
  PieChart as PieIcon,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSync } from '../contexts/OfflineSyncContext';

interface AiInsightsModuleProps {
  transactions: Transaction[];
  onNavigateToTransactions?: () => void;
  className?: string;
}

const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export default function AiInsightsModule({ transactions, onNavigateToTransactions, className = '' }: AiInsightsModuleProps) {
  const { user } = useAuth();
  const { isOnline } = useOfflineSync();
  const [insights, setInsights] = useState<AiSpendingInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30' | '90' | 'year' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'optimizations'>('overview');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const currency = user?.currency || 'USD';
  const lang = user?.language || 'en';

  // Filter transactions by timeframe
  const filteredTransactions = useMemo(() => {
    const active = transactions.filter(t => t.status === 'ACTIVE' || !t.status);
    if (selectedTimeframe === 'all') return active;

    const now = new Date();
    return active.filter(t => {
      const tDate = new Date(t.date);
      if (selectedTimeframe === '30') {
        const d30 = new Date();
        d30.setDate(now.getDate() - 30);
        return tDate >= d30;
      }
      if (selectedTimeframe === '90') {
        const d90 = new Date();
        d90.setDate(now.getDate() - 90);
        return tDate >= d90;
      }
      if (selectedTimeframe === 'year') {
        return tDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [transactions, selectedTimeframe]);

  const expenseTransactions = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'EXPENSE'),
    [filteredTransactions]
  );

  const fetchInsights = async () => {
    if (expenseTransactions.length === 0) {
      setInsights(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/ai/spending-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          transactions: filteredTransactions,
          currency,
          timeframe: selectedTimeframe
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data: AiSpendingInsights = await response.json();
      setInsights(data);
    } catch (err: any) {
      console.warn('Error fetching insights, generating local fallback:', err);
      // Generate client-side offline fallback if server call fails
      const fallback = generateLocalInsightsFallback(filteredTransactions, currency);
      setInsights(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [selectedTimeframe, expenseTransactions.length, currency]);

  const handleCopyPlan = (plan: string, index: number) => {
    navigator.clipboard?.writeText(plan);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Prepare chart comparison data: Current Spend vs Suggested Target
  const optimizationChartData = useMemo(() => {
    if (!insights?.budgetOptimizations) return [];
    return insights.budgetOptimizations.map(item => ({
      name: item.category,
      current: item.currentSpend,
      target: item.suggestedBudget,
      savings: item.potentialMonthlySavings,
    }));
  }, [insights]);

  // Category breakdown for Pie Chart
  const categoryPieData = useMemo(() => {
    if (!insights?.topSpendingCategories) return [];
    return insights.topSpendingCategories.map(cat => ({
      name: cat.category,
      value: cat.amount,
      percentage: cat.percentage
    }));
  }, [insights]);

  return (
    <div className={`space-y-6 ${className}`} id="ai-insights-module">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-br from-indigo-900/10 via-white to-blue-50/50 dark:from-indigo-950/40 dark:via-zinc-900 dark:to-zinc-900 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/25 flex-shrink-0">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  AI Financial Insights & Optimization
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {insights?.aiPowered ? 'Gemini 3.8 Flash' : 'Smart Engine'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deep transaction categorization, behavioral spending analysis, and high-impact budget reduction targets.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Selector */}
            <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedTimeframe('30')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedTimeframe === '30'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimeframe('90')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedTimeframe === '90'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                90 Days
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimeframe('year')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedTimeframe === 'year'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimeframe('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedTimeframe === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchInsights}
              disabled={loading || expenseTransactions.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Analyzing...' : 'Refresh AI'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-200/60 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Executive Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'categories'
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Category Distribution ({insights?.topSpendingCategories?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('optimizations')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'optimizations'
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Budget Optimizations
            {insights?.budgetOptimizations?.length ? (
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[10px] rounded-full">
                {insights.budgetOptimizations.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* No Data State */}
      {expenseTransactions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <PiggyBank size={40} className="mx-auto text-zinc-400 mb-3" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
            No Expense Transactions Found
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Add expense transactions to enable AI spending category clustering, anomaly detection, and budget optimization suggestions.
          </p>
          {onNavigateToTransactions && (
            <button
              type="button"
              onClick={onNavigateToTransactions}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-medium"
            >
              Add Your First Transaction <ArrowRight size={13} />
            </button>
          )}
        </div>
      ) : loading && !insights ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 animate-bounce">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            Running Financial Intelligence Analysis...
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Categorizing transactions, checking healthy spending benchmarks, and generating custom budget targets.
          </p>
        </div>
      ) : insights ? (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Financial Health Score */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Health Score</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  insights.financialHealthScore >= 80 
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                    : insights.financialHealthScore >= 60
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                }`}>
                  {insights.healthStatus}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900 dark:text-white">
                  {insights.financialHealthScore}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">/ 100</span>
              </div>
              <div className="mt-3 w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, insights.financialHealthScore)}%` }}
                  className={`h-full ${
                    insights.financialHealthScore >= 80 ? 'bg-emerald-500' :
                    insights.financialHealthScore >= 60 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                />
              </div>
            </motion.div>

            {/* Potential Monthly Savings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Savings</span>
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                  <TrendingDown size={14} />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                +{formatCurrency(insights.projectedMonthlySavings, currency, lang)}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                From {insights.budgetOptimizations.length} suggested budget optimizations
              </p>
            </motion.div>

            {/* Projected Annual Savings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Annual Potential</span>
                <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
                  <PiggyBank size={14} />
                </div>
              </div>
              <div className="text-2xl font-black text-blue-600">
                +{formatCurrency(insights.projectedAnnualSavings, currency, lang)}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Compounded over 12 months with optimized habits
              </p>
            </motion.div>

            {/* Top Category Concentration */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Category</span>
                <div className="p-1.5 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-lg">
                  <Layers size={14} />
                </div>
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                {insights.topSpendingCategories[0]?.category || 'None'}
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                {insights.topSpendingCategories[0]?.percentage || 0}% of all expense outflows
              </p>
            </motion.div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-2">
                  <ShieldCheck size={16} />
                  Executive Financial Assessment
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                  {insights.executiveSummary}
                </p>

                {/* Key Risk Factors */}
                {insights.keyRisks && insights.keyRisks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Identified Expense Risks
                    </h4>
                    <ul className="space-y-1.5">
                      {insights.keyRisks.map((risk, idx) => (
                        <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Visual Comparison: Top Categories Chart */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Top Spending Categories Visualization
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Breakdown of outgoing expenses by classified category
                      </p>
                    </div>
                    <BarChart3 size={18} className="text-zinc-400" />
                  </div>

                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={insights.topSpendingCategories.slice(0, 6)}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                        <XAxis 
                          dataKey="category" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(val) => formatCurrency(val, currency, lang, { maximumFractionDigits: 0 })}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [formatCurrency(value, currency, lang), 'Total Spend']}
                        />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                          {insights.topSpendingCategories.slice(0, 6).map((_, index) => (
                            <Cell key={`bar-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut Chart: Allocation % */}
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Category Share
                      </h3>
                      <p className="text-xs text-muted-foreground">Percentage distribution</p>
                    </div>
                    <PieIcon size={18} className="text-zinc-400" />
                  </div>

                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryPieData.slice(0, 5)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categoryPieData.slice(0, 5).map((_, index) => (
                            <Cell key={`pie-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number) => formatCurrency(val, currency, lang)} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {categoryPieData.slice(0, 4).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white">{entry.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Smart Savings Milestones */}
              {insights.smartMilestones && insights.smartMilestones.length > 0 && (
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target size={16} className="text-indigo-600" />
                    Recommended Financial Milestones
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {insights.smartMilestones.map((milestone, idx) => (
                      <div 
                        key={idx}
                        className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-700/60"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{milestone.title}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {milestone.timeframeMonths} Months
                          </span>
                        </div>
                        <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mb-1">
                          {formatCurrency(milestone.targetAmount, currency, lang)}
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          {milestone.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CATEGORY BREAKDOWN DETAILS */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-muted-foreground">
                <span>Detailed assessment of your classified spending categories</span>
                <span>{insights.topSpendingCategories.length} Categories Analyzed</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {insights.topSpendingCategories.map((cat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                          {cat.category}
                          {cat.trend === 'increasing' ? (
                            <TrendingUp size={14} className="text-rose-500" title="Increasing Trend" />
                          ) : cat.trend === 'decreasing' ? (
                            <TrendingDown size={14} className="text-emerald-500" title="Decreasing Trend" />
                          ) : null}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.percentage}% of overall spend {cat.transactionCount ? `• ${cat.transactionCount} transactions` : ''}
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        cat.status === 'excessive'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : cat.status === 'moderate'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {cat.status}
                      </span>
                    </div>

                    <div className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                      {formatCurrency(cat.amount, currency, lang)}
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      {cat.analysis}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BUDGET OPTIMIZATIONS */}
          {activeTab === 'optimizations' && (
            <div className="space-y-6">
              {/* Optimization Comparison Chart */}
              {optimizationChartData.length > 0 && (
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                        Current Spend vs Optimized Budget Target
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Visualizing monthly reduction potential across high-impact categories
                      </p>
                    </div>
                  </div>

                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={optimizationChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(val) => formatCurrency(val, currency, lang, { maximumFractionDigits: 0 })}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                          formatter={(val: number, name: string) => [
                            formatCurrency(val, currency, lang), 
                            name === 'current' ? 'Current Outflow' : 'Suggested Target'
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="current" name="Current Spend" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target" name="Optimized Target" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Optimization Action Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                {insights.budgetOptimizations.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                            {item.category}
                          </h4>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.priority === 'HIGH'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : item.priority === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {item.priority} PRIORITY
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            Save {formatCurrency(item.potentialMonthlySavings, currency, lang)}/mo
                          </span>
                        </div>
                      </div>

                      {/* Current vs Target Spend */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl mb-3 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Current Spend</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(item.currentSpend, currency, lang)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Suggested Budget</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.suggestedBudget, currency, lang)}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                        <strong className="text-zinc-800 dark:text-zinc-200">Rationale: </strong>
                        {item.rationale}
                      </p>

                      <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 mb-4">
                        <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mb-1">
                          <Zap size={12} />
                          Action Plan
                        </span>
                        <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium">
                          {item.actionPlan}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Optimization #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPlan(item.actionPlan, idx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Action Plan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Client-side local fallback generator when offline
function generateLocalInsightsFallback(transactions: Transaction[], currency: string = 'USD'): AiSpendingInsights {
  const expenses = transactions.filter(t => t.type === 'EXPENSE');
  const totalExpenses = expenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const catMap = new Map<string, { total: number; count: number }>();
  expenses.forEach(t => {
    const c = t.categoryName || 'Other';
    const cur = catMap.get(c) || { total: 0, count: 0 };
    cur.total += Number(t.amount) || 0;
    cur.count += 1;
    catMap.set(c, cur);
  });

  const categories = Array.from(catMap.entries()).map(([name, data]) => ({
    category: name,
    amount: data.total,
    percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0,
    count: data.count
  })).sort((a, b) => b.amount - a.amount);

  const topSpendingCategories = categories.map((cat, idx) => ({
    category: cat.category,
    amount: cat.amount,
    percentage: cat.percentage,
    transactionCount: cat.count,
    averagePerTransaction: cat.count > 0 ? Math.round(cat.amount / cat.count) : cat.amount,
    trend: (idx === 0 ? 'increasing' : 'stable') as 'increasing' | 'stable',
    status: (cat.percentage > 30 ? 'excessive' : cat.percentage > 15 ? 'moderate' : 'optimal') as 'excessive' | 'moderate' | 'optimal',
    analysis: `Represents ${cat.percentage}% of overall expenses (${cat.count} transactions).`
  }));

  const optimizations: BudgetOptimizationSuggestion[] = categories.slice(0, 3).map((c, i) => {
    const savings = Math.round(c.amount * 0.2);
    return {
      category: c.category,
      currentSpend: c.amount,
      suggestedBudget: Math.max(0, c.amount - savings),
      potentialMonthlySavings: savings,
      savingsPercentage: 20,
      priority: (i === 0 ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM',
      rationale: `Targeting a 20% reduction on ${c.category} to optimize cash flow.`,
      actionPlan: `Set a weekly expense limit for ${c.category} and review before discretionary spending.`
    };
  });

  const monthlySavings = optimizations.reduce((acc, o) => acc + o.potentialMonthlySavings, 0);

  return {
    financialHealthScore: 78,
    healthStatus: 'Good',
    executiveSummary: `Analyzed ${expenses.length} expense transactions totaling ${totalExpenses.toLocaleString()} ${currency}. Targeted adjustments can generate up to ${monthlySavings.toLocaleString()} ${currency} in recurring monthly savings.`,
    topSpendingCategories,
    budgetOptimizations: optimizations,
    projectedMonthlySavings: monthlySavings,
    projectedAnnualSavings: monthlySavings * 12,
    smartMilestones: [
      {
        title: "Initial Emergency Buffer",
        targetAmount: monthlySavings * 3,
        timeframeMonths: 3,
        description: "Reinvest monthly category savings into a liquid reserve."
      }
    ],
    keyRisks: [
      "Concentration in top categories requires ongoing monitoring."
    ],
    aiPowered: false,
    analyzedTransactionsCount: expenses.length,
    generatedAt: new Date().toISOString()
  };
}
