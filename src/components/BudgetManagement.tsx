import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Budget, Category, Transaction } from '../types';
import { formatCurrency, t } from '../utils/i18n';
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function BudgetManagement() {
  const { token, user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
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
        setCategories(categoriesData.filter((c: Category) => c.type === 'EXPENSE'));
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
    if (!confirm('Are you sure you want to delete this budget?')) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const calculateSpent = (categoryId: number, period: 'MONTHLY' | 'YEARLY') => {
    const now = new Date();
    return transactions
      .filter(t => {
        const tDate = new Date(t.date);
        const isSameCategory = t.categoryId === categoryId;
        const isExpense = t.type === 'EXPENSE';
        const isActive = t.status === 'ACTIVE' || !t.status;
        
        if (!isSameCategory || !isExpense || !isActive) return false;

        if (period === 'MONTHLY') {
          return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        } else {
          return tDate.getFullYear() === now.getFullYear();
        }
      })
      .reduce((acc, t) => acc + t.amount, 0);
  };

  if (loading) return <div className="p-8 text-center">Loading budgets...</div>;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('budgets', lang)}</h1>
          <p className="text-muted-foreground">Manage your spending limits by category.</p>
        </div>
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
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const spent = calculateSpent(budget.categoryId, budget.period);
          const percent = Math.min((spent / budget.amount) * 100, 100);
          const isOver = spent > budget.amount;

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
                  <span className="text-muted-foreground">Spent</span>
                  <span className={isOver ? 'text-rose-600 font-bold' : 'font-medium'}>
                    {formatCurrency(spent, currency, lang)} / {formatCurrency(budget.amount, currency, lang)}
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={`h-full transition-all ${isOver ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {isOver ? (
                  <div className="flex items-center gap-1 text-rose-600 font-medium">
                    <AlertCircle size={14} />
                    Over budget by {formatCurrency(spent - budget.amount, currency, lang)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 size={14} />
                    {formatCurrency(budget.amount - spent, currency, lang)} remaining
                  </div>
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
                    {categories.map((cat) => (
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
    </div>
  );
}
