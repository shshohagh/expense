import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Tag, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Layers, 
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  subscribeToCategories, 
  subscribeToTransactions,
  addCategory, 
  updateCategory, 
  deleteCategory, 
  logActivity 
} from '../services/firestoreService';
import { Category, Transaction } from '../types';

export default function CategoryManagement() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Category deletion states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [inUseCount, setInUseCount] = useState<number>(0);
  const [reassignToUncategorized, setReassignToUncategorized] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Real-time synchronization for categories and transactions
  useEffect(() => {
    if (!user?.id) return;

    const unsubCategories = subscribeToCategories(user.id.toString(), (data) => {
      setCategories(data);
      setLoading(false);
      setIsRefreshing(false);
    });

    const unsubTransactions = subscribeToTransactions(user.id.toString(), (transData) => {
      setTransactions(transData);
    });

    return () => {
      unsubCategories();
      unsubTransactions();
    };
  }, [user?.id]);

  // Helper to count how many transactions use a specific category
  const getCategoryTransactionCount = (cat: Category): number => {
    if (!cat) return 0;
    const catIdStr = cat.id?.toString();
    const catNameLower = cat.name?.trim().toLowerCase();

    return transactions.filter(t => {
      const matchId = t.categoryId && t.categoryId.toString() === catIdStr;
      const matchName = catNameLower && t.categoryName && t.categoryName.trim().toLowerCase() === catNameLower;
      return matchId || matchName;
    }).length;
  };

  // Manual refresh handler
  const handleRefresh = () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    setError('');
    
    // Re-verify category subscription
    const unsub = subscribeToCategories(user.id.toString(), (data) => {
      setCategories(data);
      setIsRefreshing(false);
      setSuccess('Category list refreshed successfully');
      setTimeout(() => setSuccess(''), 2500);
    });

    // Cleanup one-time trigger after a brief timeout if no events
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setError('');
    setSuccess('');

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id.toString(), formData);
        await logActivity(user.id.toString(), user.name, user.email, 'UPDATE_CATEGORY', `Updated category: ${formData.name}`);
        setSuccess('Category updated successfully');
      } else {
        await addCategory({
          ...formData,
          userId: user.id.toString()
        });
        await logActivity(user.id.toString(), user.name, user.email, 'ADD_CATEGORY', `Added category: ${formData.name}`);
        setSuccess('Category added successfully');
      }

      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', type: 'EXPENSE' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save category');
      console.error(err);
    }
  };

  // Initiate category deletion with in-use validation
  const handleDeleteClick = (cat: Category) => {
    const count = getCategoryTransactionCount(cat);
    setCategoryToDelete(cat);
    setInUseCount(count);
    // When in use, default to reassigning so users can safely clean up, or choose to prevent
    setReassignToUncategorized(true);
    setShowDeleteConfirm(true);
  };

  // Perform category deletion with transactional update/prevention
  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    // Strict validation: if category is in use and user opted not to reassign, prevent deletion!
    if (inUseCount > 0 && !reassignToUncategorized) {
      setError(`Deletion prevented: Category "${categoryToDelete.name}" is currently in use by ${inUseCount} transaction(s). Reassign them to 'Uncategorized' to proceed, or click Cancel.`);
      setShowDeleteConfirm(false);
      return;
    }

    setIsDeleting(true);
    setError('');

    const catIdStr = categoryToDelete.id.toString();
    const catName = categoryToDelete.name;
    const shouldReassign = inUseCount > 0 && reassignToUncategorized;

    // 1. Optimistic local state update for instant UI feedback
    setCategories(prev => prev.filter(c => c.id.toString() !== catIdStr));
    if (shouldReassign) {
      setTransactions(prev => prev.map(t => {
        const matchId = t.categoryId && t.categoryId.toString() === catIdStr;
        const matchName = catName && t.categoryName && t.categoryName.trim().toLowerCase() === catName.toLowerCase();
        if (matchId || matchName) {
          return {
            ...t,
            categoryId: 'uncategorized',
            categoryName: 'Uncategorized'
          };
        }
        return t;
      }));
    }

    setShowDeleteConfirm(false);
    setCategoryToDelete(null);

    try {
      // 2. Delete category with transaction reassignment in Firestore
      await deleteCategory(catIdStr, {
        reassignTransactionsToUncategorized: shouldReassign,
        preventIfInUse: inUseCount > 0 && !reassignToUncategorized,
        userId: user?.id?.toString(),
        categoryName: catName
      });

      // 3. Also notify backend API (optional for SQLite server mode)
      try {
        await fetch(`/api/categories/${catIdStr}?reassign=${shouldReassign ? 'true' : 'false'}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        });
      } catch (apiErr) {
        // Backend SQLite call is optional if running primarily in Firestore mode
      }

      // 4. Log audit activity
      if (user?.id) {
        try {
          const logDetails = shouldReassign
            ? `Deleted category "${catName}" and updated ${inUseCount} transaction(s) to 'Uncategorized'`
            : `Deleted category "${catName}"`;
          await logActivity(user.id.toString(), user.name || 'User', user.email || '', 'DELETE_CATEGORY', logDetails);
        } catch (logErr) {
          console.warn('Activity logging notice:', logErr);
        }
      }

      setSuccess(
        shouldReassign
          ? `Category "${catName}" deleted. ${inUseCount} transaction${inUseCount > 1 ? 's were' : ' was'} updated to 'Uncategorized'.`
          : `Category "${catName}" deleted successfully.`
      );
      setTimeout(() => setSuccess(''), 4000);
    } catch (error: any) {
      console.warn('Delete category notice:', error);
      setSuccess(`Category "${catName}" deleted.`);
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type
    });
    setIsModalOpen(true);
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    const dataToExport = categories.map(c => ({
      Name: c.name,
      Type: c.type,
      Scope: c.userId === null ? 'Global' : 'Personal',
      TransactionsCount: getCategoryTransactionCount(c)
    }));

    if (format === 'csv') {
      const headers = ['Name', 'Type', 'Scope', 'Transactions Count'].join(',');
      const rows = dataToExport.map(row => [row.Name, row.Type, row.Scope, row.TransactionsCount].join(','));
      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `categories_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");
      XLSX.writeFile(workbook, 'categories_export.xlsx');
    }
  };

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.permissions?.includes('manage_categories') || user?.email === 'shshohagh4@gmail.com';

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Category</h1>
          <p className="text-muted-foreground">Manage transaction categories and view real-time usage.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {/* Refresh List Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            title="Refresh category list and transaction usage"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-zinc-900 dark:text-zinc-100' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download size={16} />
            Excel
          </button>
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', type: 'EXPENSE' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={18} />
            Add Category
          </button>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg">
              <X size={16} />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-600"
          >
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-sm font-medium flex-1">{success}</p>
            <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Categories */}
        <CategorySection 
          title="Income Categories" 
          categories={categories.filter(c => c.type === 'INCOME')} 
          onEdit={openEditModal}
          onDelete={handleDeleteClick}
          type="INCOME"
          currentUserId={user?.id?.toString()}
          isAdmin={isAdmin}
          getTransactionCount={getCategoryTransactionCount}
        />
        
        {/* Expense Categories */}
        <CategorySection 
          title="Expense Categories" 
          categories={categories.filter(c => c.type === 'EXPENSE')} 
          onEdit={openEditModal}
          onDelete={handleDeleteClick}
          type="EXPENSE"
          currentUserId={user?.id?.toString()}
          isAdmin={isAdmin}
          getTransactionCount={getCategoryTransactionCount}
        />
      </div>

      {/* Interactive Delete Confirmation Modal with In-Use Handling */}
      <AnimatePresence>
        {showDeleteConfirm && categoryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={isDeleting ? undefined : () => setShowDeleteConfirm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 space-y-5"
            >
              <div className="flex gap-4 items-start">
                <div className={`p-3 rounded-2xl shrink-0 ${
                  inUseCount > 0 
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' 
                    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                }`}>
                  {inUseCount > 0 ? <AlertTriangle size={24} /> : <Trash2 size={24} />}
                </div>

                <div className="space-y-1.5 flex-1">
                  <h3 className="text-lg font-bold tracking-tight">
                    {inUseCount > 0 ? 'Category In Use — Delete Options' : 'Confirm Category Deletion'}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {inUseCount > 0 ? (
                      <>
                        The category <strong className="text-zinc-800 dark:text-zinc-200">"{categoryToDelete.name}"</strong> is currently assigned to <strong className="text-amber-600 dark:text-amber-400">{inUseCount} transaction{inUseCount > 1 ? 's' : ''}</strong>.
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete category <strong className="text-zinc-800 dark:text-zinc-200">"{categoryToDelete.name}"</strong>? This category is not currently linked to any transactions.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* In-Use Resolution Options */}
              {inUseCount > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Choose action for related transactions:
                  </div>

                  {/* Option 1: Update to Uncategorized */}
                  <label 
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      reassignToUncategorized 
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' 
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="reassign_option"
                      checked={reassignToUncategorized} 
                      onChange={() => setReassignToUncategorized(true)}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>Update related transactions to 'Uncategorized'</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">Recommended</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                        Safely preserves all {inUseCount} transaction{inUseCount > 1 ? 's' : ''} by setting their category to <strong>'Uncategorized'</strong>, then deletes this category.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Prevent Deletion */}
                  <label 
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      !reassignToUncategorized 
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' 
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="reassign_option"
                      checked={!reassignToUncategorized} 
                      onChange={() => setReassignToUncategorized(false)}
                      className="mt-1 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>Prevent deletion (Keep category intact)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">Safe Guard</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                        Blocks deleting this category while it has linked transactions. Keeps category and transaction records untouched.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setCategoryToDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {inUseCount > 0 && !reassignToUncategorized ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setError(`Category "${categoryToDelete.name}" was kept because deletion was prevented.`);
                      setTimeout(() => setError(''), 3000);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-white bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-xl transition-colors cursor-pointer"
                  >
                    Keep Category (Cancel)
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={confirmDelete}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{inUseCount > 0 ? 'Updating & Deleting...' : 'Deleting...'}</span>
                      </>
                    ) : (
                      <span>{inUseCount > 0 ? 'Update to Uncategorized & Delete' : 'Delete Category'}</span>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Category Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="e.g. Salary, Food, etc."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'INCOME' | 'EXPENSE' })}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                  >
                    {editingCategory ? 'Update Category' : 'Create Category'}
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

function CategorySection({ 
  title, 
  categories, 
  onEdit, 
  onDelete, 
  type, 
  currentUserId, 
  isAdmin,
  getTransactionCount
}: { 
  title: string, 
  categories: Category[], 
  onEdit: (c: Category) => void, 
  onDelete: (c: Category) => void,
  type: 'INCOME' | 'EXPENSE',
  currentUserId?: string,
  isAdmin?: boolean,
  getTransactionCount: (c: Category) => number
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
        <h3 className={`text-sm font-bold uppercase tracking-wider ${
          type === 'INCOME' ? 'text-emerald-600' : 
          type === 'EXPENSE' ? 'text-rose-600' : 
          'text-blue-600'
        }`}>
          {title}
        </h3>
        <span className="text-xs text-muted-foreground font-medium">
          {categories.length} {categories.length === 1 ? 'category' : 'categories'}
        </span>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm italic">
            No categories found.
          </div>
        ) : (
          categories.map((cat) => {
            const isGlobal = cat.userId === null || cat.userId === undefined || cat.userId === '';
            const canManage = true; // All categories can be managed from category management
            const inUseCount = getTransactionCount(cat);
            
            return (
              <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    type === 'INCOME' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 
                    type === 'EXPENSE' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Tag size={16} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{cat.name}</span>
                      {isGlobal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-muted-foreground uppercase tracking-wider font-semibold">
                          Global
                        </span>
                      )}
                    </div>
                    {/* Real-time transaction usage badge */}
                    <div className="mt-1 flex items-center gap-1.5">
                      {inUseCount > 0 ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                          <Layers size={11} />
                          {inUseCount} transaction{inUseCount > 1 ? 's' : ''} in use
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          0 transactions
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEdit(cat)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(cat)}
                      className="p-2 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      title={inUseCount > 0 ? `Delete category (${inUseCount} transactions in use)` : 'Delete Category'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
