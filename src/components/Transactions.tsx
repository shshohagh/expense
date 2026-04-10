import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Category } from '../types';
import { formatDate } from '../lib/utils';
import { formatCurrency } from '../utils/i18n';
import { Plus, Trash2, Edit2, Download, Filter, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToTransactions, 
  subscribeToCategories, 
  addTransaction, 
  updateTransaction, 
  deleteTransaction 
} from '../services/firestoreService';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'lifetime' | 'custom'>('lifetime');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    amount: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  useEffect(() => {
    if (!user?.id) return;

    const unsubTransactions = subscribeToTransactions(user.id.toString(), (data) => {
      setTransactions(data);
      setLoading(false);
    });

    const unsubCategories = subscribeToCategories(user.id.toString(), (data) => {
      setCategories(data);
    });

    return () => {
      unsubTransactions();
      unsubCategories();
    };
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const category = categories.find(c => c.id.toString() === formData.categoryId);
    const transactionData = {
      userId: user.id.toString(),
      type: formData.type,
      amount: parseFloat(formData.amount),
      categoryId: formData.categoryId,
      categoryName: category?.name || 'Unknown',
      date: formData.date,
      description: formData.description,
      status: formData.status,
    };

    try {
      if (editingId) {
        await updateTransaction(editingId, transactionData);
      } else {
        await addTransaction(transactionData);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({
        type: 'EXPENSE',
        amount: '',
        categoryId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'ACTIVE',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDuplicate = (t: Transaction) => {
    setEditingId(null);
    setFormData({
      type: t.type,
      amount: t.amount.toString(),
      categoryId: t.categoryId.toString(),
      date: t.date,
      description: t.description ? `${t.description} (Copy)` : '(Copy)',
      status: t.status || 'ACTIVE',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteTransaction(itemToDelete);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    // For Firebase, we'll generate the export client-side
    const dataToExport = filteredTransactions.map(t => ({
      Date: formatDate(t.date),
      Category: t.categoryName || 'Unknown',
      Description: t.description || '',
      Type: t.type,
      Status: t.status,
      Amount: t.amount
    }));

    if (format === 'csv') {
      const headers = Object.keys(dataToExport[0]).join(',');
      const rows = dataToExport.map(row => Object.values(row).join(','));
      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // For XLSX, we'd need a library like 'xlsx'
      alert('Excel export requires additional libraries. Please use CSV for now.');
    }
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);
  const lang = user?.language || 'en';
  const currency = user?.currency || 'USD';

  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);
    
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (dateFilter) {
      case 'today':
        return t.date === todayStr;
      case 'yesterday':
        return t.date === yesterdayStr;
      case 'last7':
        return tDate >= last7;
      case 'last30':
        return tDate >= last30;
      case 'thisWeek':
        return tDate >= startOfWeek;
      case 'thisMonth':
        return tDate >= startOfMonth;
      case 'thisYear':
        return tDate >= startOfYear;
      case 'custom':
        if (!customDateRange.start || !customDateRange.end) return true;
        return t.date >= customDateRange.start && t.date <= customDateRange.end;
      case 'lifetime':
      default:
        return true;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download size={16} /> CSV
          </button>
          <button 
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download size={16} /> Excel
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({
                type: 'EXPENSE',
                amount: '',
                categoryId: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                status: 'ACTIVE',
              });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-2">
          <Filter size={16} /> Filter:
        </div>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="thisWeek">This Week</option>
          <option value="thisMonth">This Month</option>
          <option value="thisYear">This Year</option>
          <option value="lifetime">Lifetime</option>
          <option value="custom">Customize</option>
        </select>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
              className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
              className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors ${t.status === 'INACTIVE' ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      <span>{t.description || '-'}</span>
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                        t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {t.type}
                      </span>
                      <span>{(t as any).categoryName || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${
                    t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                  <div className="flex flex-col gap-1">
                    <span>{t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, currency, lang)}</span>
                    <span>{formatDate(t.date)}</span>
                  </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDuplicate(t)}
                        className="p-2 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingId(t.id);
                          setFormData({
                            type: t.type,
                            amount: t.amount.toString(),
                            categoryId: t.categoryId.toString(),
                            date: t.date,
                            description: t.description || '',
                            status: t.status || 'ACTIVE',
                          });
                          setShowModal(true);
                        }}
                        className="p-2 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-muted-foreground hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No transactions found. Start by adding one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center"
            >
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">Delete Transaction</h3>
              <p className="text-muted-foreground mb-6">Are you sure you want to delete this transaction? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-xl hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                    className={`py-2 text-sm font-medium rounded-xl border transition-all ${
                      formData.type === 'EXPENSE' 
                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800' 
                        : 'bg-white border-zinc-200 text-muted-foreground dark:bg-zinc-900 dark:border-zinc-800'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                    className={`py-2 text-sm font-medium rounded-xl border transition-all ${
                      formData.type === 'INCOME' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' 
                        : 'bg-white border-zinc-200 text-muted-foreground dark:bg-zinc-900 dark:border-zinc-800'
                    }`}
                  >
                    Income
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="">Select Category</option>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="ACTIVE">Active (Calculate in totals)</option>
                    <option value="INACTIVE">Inactive (Ignore in totals)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90"
                  >
                    {editingId ? 'Save Changes' : 'Add Transaction'}
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
