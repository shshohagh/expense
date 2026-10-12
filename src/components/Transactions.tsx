import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Category } from '../types';
import { formatDate } from '../lib/utils';
import { formatCurrency } from '../utils/i18n';
import { Plus, Trash2, Edit2, Download, Filter, Copy, Upload, Search, X, Check, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import BankStatementImporter from './BankStatementImporter';
import { motion, AnimatePresence } from 'motion/react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AiCategorySuggestionBadge from './AiCategorySuggestionBadge';
import ExportToast, { ToastData } from './ExportToast';
import { 
  subscribeToTransactions, 
  subscribeToCategories, 
  addTransaction, 
  updateTransaction, 
  deleteTransaction,
  bulkUpdateTransactionStatus,
  bulkDeleteTransactions
} from '../services/firestoreService';

export default function Transactions({ 
  shouldOpenNewTransaction, 
  onOpenNewTransactionComplete,
  targetTransactionId,
  onClearTargetTransactionId
}: { 
  shouldOpenNewTransaction?: boolean;
  onOpenNewTransactionComplete?: () => void;
  targetTransactionId?: string | null;
  onClearTargetTransactionId?: () => void;
}) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [csvExportSuccess, setCsvExportSuccess] = useState(false);
  const [exportToast, setExportToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (shouldOpenNewTransaction) {
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
      if (onOpenNewTransactionComplete) {
        onOpenNewTransactionComplete();
      }
    }
  }, [shouldOpenNewTransaction, onOpenNewTransactionComplete]);

  // Handle targeting a specific transaction from Ctrl+K search
  useEffect(() => {
    if (targetTransactionId && transactions.length > 0) {
      const found = transactions.find(t => t.id === targetTransactionId);
      if (found) {
        setHighlightedId(targetTransactionId);
        // Ensure filters show this transaction
        setDateFilter('lifetime');
        setTypeFilter('ALL');
        setCategoryFilter('ALL');

        // Scroll to the targeted row
        setTimeout(() => {
          const rowEl = document.getElementById(`tx-row-${targetTransactionId}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);

        // Clear highlight after a few seconds
        const timer = setTimeout(() => {
          setHighlightedId(null);
          if (onClearTargetTransactionId) onClearTargetTransactionId();
        }, 4000);

        return () => clearTimeout(timer);
      }
    }
  }, [targetTransactionId, transactions, onClearTargetTransactionId]);

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'lifetime' | 'custom'>('lifetime');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
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
    setIsDeleting(true);
    try {
      await deleteTransaction(itemToDelete);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      const currentIds = [...selectedIds];
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
      await bulkDeleteTransactions(currentIds);
    } catch (error) {
      console.error(error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkStatusChange = async (status: 'ACTIVE' | 'INACTIVE') => {
    try {
      const currentIds = [...selectedIds];
      setSelectedIds([]);
      await bulkUpdateTransactionStatus(currentIds, status);
    } catch (error) {
      console.error(error);
    }
  };

  const handleImport = async (data: any[]) => {
    try {
      setShowImporter(false);
      for (const row of data) {
         // This is a naive implementation; mapping would need to be user-configurable in a production app
         const transactionData = {
           userId: user!.id.toString(),
           type: ((row.Type || row.type || 'EXPENSE') === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
           amount: parseFloat(row.Amount || row.amount || '0'),
           categoryId: '', // User would need to map categories
           categoryName: row.Category || row.category || 'Imported',
           date: row.Date || row.date || new Date().toISOString().split('T')[0],
           description: row.Description || row.description || 'Imported Transaction',
           status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
         };
         await addTransaction(transactionData);
      }
    } catch (error) {
      console.error(error);
      alert('Error importing transactions');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(t => t.id as string));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
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

    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesCategory = categoryFilter === 'ALL' || t.categoryId === categoryFilter;

    if (!matchesType || !matchesCategory) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const catMatch = ((t as any).categoryName || '').toLowerCase().includes(q);
      const amtMatch = String(t.amount).includes(q);
      const dateMatch = (t.date || '').includes(q);
      if (!descMatch && !catMatch && !amtMatch && !dateMatch) {
        return false;
      }
    }

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

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (filteredTransactions.length === 0) {
      alert('No transactions match the current filter to export.');
      return;
    }

    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const dateTag = dateFilter === 'custom' && customDateRange.start && customDateRange.end
      ? `${customDateRange.start}_to_${customDateRange.end}`
      : `${dateFilter}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const headers = [
        'Date',
        'Transaction ID',
        'Type',
        'Category',
        'Description',
        'Amount',
        'Currency',
        'Status'
      ];

      const rows = filteredTransactions.map(t => [
        escapeCSV(t.date),
        escapeCSV(t.id || ''),
        escapeCSV(t.type),
        escapeCSV(t.categoryName || 'Unknown'),
        escapeCSV(t.description || ''),
        t.amount.toFixed(2),
        escapeCSV(currency),
        escapeCSV(t.status || 'ACTIVE')
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `transactions_${dateTag}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCsvExportSuccess(true);
      setTimeout(() => setCsvExportSuccess(false), 3000);

      setExportToast({
        id: `toast-${Date.now()}`,
        title: 'CSV Export Successful',
        message: `Your filtered transactions have been downloaded to your device.`,
        fileName,
        recordCount: filteredTransactions.length,
        type: 'success'
      });
    } else {
      // Native XLSX export using the xlsx library
      const fileName = `transactions_${dateTag}.xlsx`;
      const rows = filteredTransactions.map(t => ({
        'Date': t.date,
        'Transaction ID': t.id || '',
        'Type': t.type,
        'Category': t.categoryName || 'Unknown',
        'Description': t.description || '',
        'Amount': t.amount,
        'Currency': currency,
        'Status': t.status || 'ACTIVE'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      XLSX.writeFile(workbook, fileName);

      setExportToast({
        id: `toast-${Date.now()}`,
        title: 'Excel Export Successful',
        message: `Your filtered transactions have been downloaded to your device.`,
        fileName,
        recordCount: filteredTransactions.length,
        type: 'success'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowImporter(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Upload size={16} /> Import
          </button>
          <button 
            id="transactions-export-csv-btn"
            onClick={() => handleExport('csv')}
            disabled={filteredTransactions.length === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer ${
              csvExportSuccess
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={`Export ${filteredTransactions.length} filtered transaction${filteredTransactions.length === 1 ? '' : 's'} as CSV`}
          >
            {csvExportSuccess ? (
              <>
                <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>CSV Exported</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export CSV ({filteredTransactions.length})</span>
              </>
            )}
          </button>
          <button 
            onClick={() => handleExport('xlsx')}
            disabled={filteredTransactions.length === 0}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 shadow-xs"
            title="Export filtered transactions as Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} /> Excel
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
        {/* Search text filter */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search description, category..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-1">
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

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <option value="ALL">All Types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <option value="ALL">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
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

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-between p-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold">{selectedIds.length} items selected</span>
              <div className="h-4 w-[1px] bg-zinc-700 dark:bg-zinc-300"></div>
              <button 
                onClick={() => handleBulkStatusChange('ACTIVE')}
                className="text-xs font-bold hover:underline"
              >
                Set Active
              </button>
              <button 
                onClick={() => handleBulkStatusChange('INACTIVE')}
                className="text-xs font-bold hover:underline"
              >
                Set Inactive
              </button>
            </div>
            <button 
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              <Trash2 size={14} /> Bulk Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" 
                  />
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredTransactions.map((t) => {
                const isTargetHighlighted = highlightedId === t.id;
                return (
                  <tr 
                    key={t.id} 
                    id={`tx-row-${t.id}`}
                    className={`transition-all duration-500 ${
                      isTargetHighlighted
                        ? 'bg-amber-100/90 dark:bg-amber-950/70 ring-2 ring-amber-500'
                        : selectedIds.includes(t.id as string)
                          ? 'bg-zinc-50 dark:bg-zinc-800/50'
                          : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
                    } ${t.status === 'INACTIVE' ? 'opacity-50 grayscale-[0.5]' : ''}`}
                  >
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(t.id as string)}
                      onChange={() => toggleSelect(t.id as string)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                  </td>
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
              );
            })}
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

      {showImporter && <BankStatementImporter onClose={() => setShowImporter(false)} onImport={handleImport} />}
      
      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        title="Confirm Deletion"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        itemName={(() => {
          const t = transactions.find(tx => tx.id === itemToDelete);
          return t ? `${t.type === 'INCOME' ? 'Income' : 'Expense'}: ${t.description || 'No Description'} (${formatCurrency(t.amount)})` : undefined;
        })()}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setItemToDelete(null);
        }}
        isLoading={isDeleting}
      />

      <DeleteConfirmationModal
        isOpen={showBulkDeleteConfirm}
        title="Confirm Bulk Deletion"
        message={`Are you sure you want to delete the ${selectedIds.length} selected transactions? This action cannot be undone.`}
        itemName={`${selectedIds.length} Transactions selected`}
        onConfirm={handleBulkDelete}
        onCancel={() => {
          setShowBulkDeleteConfirm(false);
        }}
        isLoading={isBulkDeleting}
      />

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
                    placeholder="e.g. Uber ride to client meeting, AWS bill, Coffee with team..."
                  />
                  <AiCategorySuggestionBadge
                    description={formData.description}
                    type={formData.type}
                    categories={categories}
                    currentCategoryId={formData.categoryId}
                    onSelectCategory={(catId) => setFormData(prev => ({ ...prev, categoryId: catId }))}
                    userId={user?.id?.toString()}
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

      {/* Export Toast Notification */}
      <ExportToast 
        toast={exportToast} 
        onClose={() => setExportToast(null)} 
      />
    </div>
  );
}
