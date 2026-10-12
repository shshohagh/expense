import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Calendar, Sparkles } from 'lucide-react';

interface TopBalanceSparklineProps {
  transactions: Transaction[];
  currency: string;
  lang: string;
  onNavigateToTransactions?: () => void;
}

interface DayData {
  dateStr: string;
  dayLabel: string;
  fullDateLabel: string;
  income: number;
  expense: number;
  net: number;
}

export default function TopBalanceSparkline({
  transactions,
  currency,
  lang,
  onNavigateToTransactions,
}: TopBalanceSparklineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const activeTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'ACTIVE' || !t.status);
  }, [transactions]);

  // Overall Total Balance
  const { totalBalance, totalIncomeAll, totalExpenseAll } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of activeTransactions) {
      if (t.type === 'INCOME') income += t.amount;
      else if (t.type === 'EXPENSE') expense += t.amount;
    }
    return {
      totalBalance: income - expense,
      totalIncomeAll: income,
      totalExpenseAll: expense,
    };
  }, [activeTransactions]);

  // Compute last 7 days metrics
  const last7DaysData: DayData[] = useMemo(() => {
    const days: DayData[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayName = d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' });
      const fullDateLabel = d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' });

      // Aggregate transactions for this day
      let dayIncome = 0;
      let dayExpense = 0;

      for (const t of activeTransactions) {
        if (t.date === dateStr) {
          if (t.type === 'INCOME') dayIncome += t.amount;
          else if (t.type === 'EXPENSE') dayExpense += t.amount;
        }
      }

      days.push({
        dateStr,
        dayLabel: i === 0 ? 'Today' : dayName,
        fullDateLabel,
        income: dayIncome,
        expense: dayExpense,
        net: dayIncome - dayExpense,
      });
    }

    return days;
  }, [activeTransactions, lang]);

  // 7-day aggregates
  const { last7Income, last7Expense, last7Net } = useMemo(() => {
    const income = last7DaysData.reduce((acc, d) => acc + d.income, 0);
    const expense = last7DaysData.reduce((acc, d) => acc + d.expense, 0);
    return {
      last7Income: income,
      last7Expense: expense,
      last7Net: income - expense,
    };
  }, [last7DaysData]);

  // SVG Chart Dimensions
  const chartWidth = 260;
  const chartHeight = 80;
  const paddingX = 14;
  const paddingY = 12;

  const maxVal = useMemo(() => {
    let max = 10;
    for (const d of last7DaysData) {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    }
    return max * 1.15; // 15% headroom
  }, [last7DaysData]);

  // Calculate coordinates for 7 points
  const points = useMemo(() => {
    const stepX = (chartWidth - paddingX * 2) / 6;
    return last7DaysData.map((d, i) => {
      const x = paddingX + i * stepX;
      const incomeY = chartHeight - paddingY - (d.income / maxVal) * (chartHeight - paddingY * 2);
      const expenseY = chartHeight - paddingY - (d.expense / maxVal) * (chartHeight - paddingY * 2);
      return { x, incomeY, expenseY, data: d };
    });
  }, [last7DaysData, maxVal]);

  // Generate SVG path strings
  const incomePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.incomeY}` : `${acc} L ${pt.x} ${pt.incomeY}`;
    }, '');
  }, [points]);

  const incomeAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const baseY = chartHeight - paddingY;
    return `${incomePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [incomePath, points]);

  const expensePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.expenseY}` : `${acc} L ${pt.x} ${pt.expenseY}`;
    }, '');
  }, [points]);

  const expenseAreaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const baseY = chartHeight - paddingY;
    return `${expensePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [expensePath, points]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setActiveDayIndex(null);
    }, 180);
  };

  const activeDay = activeDayIndex !== null ? last7DaysData[activeDayIndex] : null;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top Navbar Balance Trigger Button */}
      <button
        id="top-balance-display-trigger"
        type="button"
        onClick={() => setIsHovered(prev => !prev)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer group text-left"
        title="Hover to view 7-day income vs expense sparkline"
        aria-label="Account Balance with 7-day sparkline"
      >
        <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-zinc-900 group-hover:scale-105 active:scale-95 transition-transform shadow-xs shrink-0">
          <Wallet size={17} />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm sm:text-base tracking-tight leading-none text-zinc-900 dark:text-zinc-100">
              Expensy
            </span>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-xs font-bold leading-none tracking-tight ${
                totalBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(totalBalance, currency, lang)}
            </span>
            {/* Subtle mini indicator arrow */}
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
              ▾
            </span>
          </div>
        </div>
      </button>

      {/* Hover Card with Sparkline & 7-Day Trend */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            id="balance-sparkline-popover"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="absolute left-0 sm:left-auto sm:right-auto top-full mt-2 w-80 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 overflow-hidden"
          >
            {/* Header & Total Balance */}
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500" />
                  Total Net Balance
                </span>
                <p
                  className={`text-xl font-extrabold tracking-tight mt-0.5 ${
                    totalBalance >= 0
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(totalBalance, currency, lang)}
                </p>
              </div>

              {/* 7-Day Net Flow Badge */}
              <div
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 ${
                  last7Net >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60'
                }`}
                title="7-day net cashflow (Income minus Expense)"
              >
                {last7Net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>
                  {last7Net >= 0 ? '+' : ''}
                  {formatCurrency(last7Net, currency, lang)}
                </span>
              </div>
            </div>

            {/* 7-Day Income vs Expense Metrics */}
            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="p-2 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <ArrowDownRight size={12} />
                  <span>7d Income</span>
                </div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                  {formatCurrency(last7Income, currency, lang)}
                </p>
              </div>

              <div className="p-2 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/40">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  <ArrowUpRight size={12} />
                  <span>7d Expense</span>
                </div>
                <p className="text-xs font-bold text-rose-800 dark:text-rose-200 mt-0.5">
                  {formatCurrency(last7Expense, currency, lang)}
                </p>
              </div>
            </div>

            {/* Sparkline Header & Inspection */}
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 text-[11px]">
                <Calendar size={12} className="text-zinc-400" />
                7-Day Trend
              </span>
              {activeDay ? (
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {activeDay.fullDateLabel}:{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(activeDay.income, currency, lang)}
                  </span>
                  {' / '}
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatCurrency(activeDay.expense, currency, lang)}
                  </span>
                </span>
              ) : (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Income
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Expense
                  </span>
                </div>
              )}
            </div>

            {/* SVG Dual Sparkline Chart */}
            <div className="relative bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800 p-1.5">
              <svg
                width="100%"
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="overflow-visible"
              >
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line
                  x1={paddingX}
                  y1={chartHeight - paddingY}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY}
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-700"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <line
                  x1={paddingX}
                  y1={paddingY}
                  x2={chartWidth - paddingX}
                  y2={paddingY}
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-700"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Area fills */}
                {incomeAreaPath && <path d={incomeAreaPath} fill="url(#incomeGradient)" />}
                {expenseAreaPath && <path d={expenseAreaPath} fill="url(#expenseGradient)" />}

                {/* Lines */}
                {incomePath && (
                  <path
                    d={incomePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {expensePath && (
                  <path
                    d={expensePath}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover guideline */}
                {activeDayIndex !== null && points[activeDayIndex] && (
                  <line
                    x1={points[activeDayIndex].x}
                    y1={paddingY}
                    x2={points[activeDayIndex].x}
                    y2={chartHeight - paddingY}
                    stroke="#a1a1aa"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Data Points and Interaction Target zones */}
                {points.map((pt, i) => (
                  <g key={i}>
                    {/* Income Point */}
                    <circle
                      cx={pt.x}
                      cy={pt.incomeY}
                      r={activeDayIndex === i ? 4.5 : 2.5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={activeDayIndex === i ? 2 : 1}
                      className="transition-all duration-150"
                    />
                    {/* Expense Point */}
                    <circle
                      cx={pt.x}
                      cy={pt.expenseY}
                      r={activeDayIndex === i ? 4.5 : 2.5}
                      fill="#f43f5e"
                      stroke="#ffffff"
                      strokeWidth={activeDayIndex === i ? 2 : 1}
                      className="transition-all duration-150"
                    />
                    {/* Interactive invisible hit box for each day column */}
                    <rect
                      x={pt.x - (chartWidth / 14)}
                      y={0}
                      width={chartWidth / 7}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setActiveDayIndex(i)}
                    />
                  </g>
                ))}
              </svg>

              {/* Day Labels along the bottom */}
              <div className="flex justify-between px-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                {last7DaysData.map((d, i) => (
                  <span
                    key={d.dateStr}
                    className={`transition-colors ${
                      activeDayIndex === i
                        ? 'font-bold text-zinc-900 dark:text-zinc-100'
                        : ''
                    }`}
                  >
                    {d.dayLabel}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Action Footer */}
            {onNavigateToTransactions && (
              <button
                type="button"
                onClick={() => {
                  setIsHovered(false);
                  onNavigateToTransactions();
                }}
                className="w-full mt-3 py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors text-center cursor-pointer"
              >
                View Full Transactions History →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
