import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Budget, Category, Transaction } from '../types';
import { formatCurrency, t } from '../utils/i18n';
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle2, TrendingUp, Download, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function BudgetManagement() {
  const { token, user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<number | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [activeType, setActiveType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    period: 'MONTHLY' as 'MONTHLY' | 'YEARLY'
  });

  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, categoriesRes, transactionsRes] = await Promise.all([
        fetch('/api/budgets', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/transactions', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (budgetsRes.ok && categoriesRes.ok && transactionsRes.ok) {
        const [budgetsData, categoriesData, transactionsData] = await Promise.all([
          budgetsRes.json(),
          categoriesRes.json(),
          transactionsRes.json()
        ]);
        setBudgets(budgetsData);
        setCategories(categoriesData);
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingBudget ? `/api/budgets/${editingBudget.id}` : '/api/budgets';
    const method = editingBudget ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          categoryId: parseInt(formData.categoryId),
          amount: parseFloat(formData.amount),
          period: formData.period
        })
      });

      if (res.ok) {
        fetchData();
        setShowModal(false);
        setEditingBudget(null);
        setFormData({ categoryId: '', amount: '', period: 'MONTHLY' });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    setBudgetToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!budgetToDelete) return;
    try {
      const res = await fetch(`/api/budgets/${budgetToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        setShowDeleteConfirm(false);
        setBudgetToDelete(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    fetch(`/api/budgets/export/${format}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budgets.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });
  };

  const calculateActual = (categoryId: number, period: 'MONTHLY' | 'YEARLY', type: 'INCOME' | 'EXPENSE') => {
    const now = new Date();
    return transactions
      .filter(t => {
        const tDate = new Date(t.date);
        const isSameCategory = t.categoryId === categoryId;
        const isCorrectType = t.type === type;
        const isActive = t.status === 'ACTIVE' || !t.status;
        
        if (!isSameCategory || !isCorrectType || !isActive) return false;

        if (period === 'MONTHLY') {
          return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        } else {
          return tDate.getFullYear() === now.getFullYear();
        }
      })
      .reduce((acc, t) => acc + t.amount, 0);
  };

  const filteredBudgets = budgets.filter(budget => {
    const matchesType = budget.categoryType === activeType;
    const matchesCategory = categoryFilter === 'all' || budget.categoryId.toString() === categoryFilter;
    const matchesPeriod = periodFilter === 'all' || budget.period === periodFilter;
    return matchesType && matchesCategory && matchesPeriod;
  });

  const activeCategories = categories.filter(c => c.type === activeType);

  if (loading) return <div className="p-8 text-center">Loading budgets...</div>;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('budgets', lang)}</h1>
          <p className="text-muted-foreground">Manage your spending limits by category.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={18} />
            CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={18} />
            Excel
          </button>
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={18} />
            JSON
          </button>
          <button
            onClick={() => {
              setEditingBudget(null);
              setFormData({ categoryId: '', amount: '', period: 'MONTHLY' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={18} />
            Add Budget
          </button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full sm:w-auto">
          {(['EXPENSE', 'INCOME'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setActiveType(type);
                setCategoryFilter('all');
              }}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeType === type
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-muted-foreground hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {type === 'EXPENSE' ? 'Expenses' : 'Income'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full sm:w-auto">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
            <Filter size={16} /> Filter:
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <option value="all">All Categories</option>
            {activeCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <option value="all">All Periods</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBudgets.map((budget) => {
          const actual = calculateActual(budget.categoryId, budget.period, budget.categoryType || 'EXPENSE');
          const actualPercent = (actual / budget.amount) * 100;
          const displayPercent = Math.min(actualPercent, 100);
          const isOver = activeType === 'EXPENSE' ? actual > budget.amount : actual < budget.amount;
          const isUnder = activeType === 'INCOME' ? actual > budget.amount : actual < budget.amount;

          let barColor = 'bg-emerald-500';
          if (activeType === 'EXPENSE') {
            if (actualPercent > 100) barColor = 'bg-rose-500';
            else if (actualPercent >= 80) barColor = 'bg-amber-500';
          } else {
            // For income, being over is good (green), being under is bad (red)
            if (actualPercent >= 100) barColor = 'bg-emerald-500';
            else if (actualPercent >= 80) barColor = 'bg-amber-500';
            else barColor = 'bg-rose-500';
          }

          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{budget.categoryName}</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{budget.period}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingBudget(budget);
                      setFormData({
                        categoryId: budget.categoryId.toString(),
                        amount: budget.amount.toString(),
                        period: budget.period
                      });
                      setShowModal(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="p-2 text-zinc-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{activeType === 'EXPENSE' ? 'Spent' : 'Earned'}</span>
                  <span className={isOver && activeType === 'EXPENSE' ? 'text-rose-600 font-bold' : isUnder && activeType === 'INCOME' ? 'text-emerald-600 font-bold' : 'font-medium'}>
                    {formatCurrency(actual, currency, lang)} / {formatCurrency(budget.amount, currency, lang)}
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${displayPercent}%` }}
                    className={`h-full transition-all ${barColor}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {activeType === 'EXPENSE' ? (
                  isOver ? (
                    <div className="flex items-center gap-1 text-rose-600 font-medium">
                      <AlertCircle size={14} />
                      Over budget by {formatCurrency(actual - budget.amount, currency, lang)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 size={14} />
                      {formatCurrency(budget.amount - actual, currency, lang)} remaining
                    </div>
                  )
                ) : (
                  actual >= budget.amount ? (
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 size={14} />
                      Goal reached! {formatCurrency(actual - budget.amount, currency, lang)} extra
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 font-medium">
                      <AlertCircle size={14} />
                      {formatCurrency(budget.amount - actual, currency, lang)} to reach goal
                    </div>
                  )
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <TrendingUp className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" size={48} />
          <h3 className="text-lg font-medium">No budgets set yet</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mt-2">
            Set spending limits for your categories to stay on top of your finances.
          </p>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-md shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <h2 className="text-2xl font-bold mb-6">{editingBudget ? 'Edit Budget' : 'Add New Budget'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    required
                    disabled={!!editingBudget}
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                  >
                    <option value="">Select Category</option>
                    {activeCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Period</label>
                  <div className="flex gap-2">
                    {(['MONTHLY', 'YEARLY'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, period: p })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.period === p
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-all shadow-lg shadow-zinc-900/20 dark:shadow-zinc-100/10"
                  >
                    {editingBudget ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Delete Budget?</h2>
              <p className="text-muted-foreground mb-6">
                This action cannot be undone. Are you sure you want to remove this budget?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
