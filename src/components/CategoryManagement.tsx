import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, X, Tag, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory, 
  seedDefaultCategories,
  logActivity
} from '../services/firestoreService';
import { Category } from '../types';

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salary', type: 'INCOME', userId: null },
  { name: 'Freelance', type: 'INCOME', userId: null },
  { name: 'Investments', type: 'INCOME', userId: null },
  { name: 'Gifts', type: 'INCOME', userId: null },
  { name: 'Food & Dining', type: 'EXPENSE', userId: null },
  { name: 'Transportation', type: 'EXPENSE', userId: null },
  { name: 'Housing', type: 'EXPENSE', userId: null },
  { name: 'Utilities', type: 'EXPENSE', userId: null },
  { name: 'Entertainment', type: 'EXPENSE', userId: null },
  { name: 'Shopping', type: 'EXPENSE', userId: null },
  { name: 'Healthcare', type: 'EXPENSE', userId: null },
  { name: 'Education', type: 'EXPENSE', userId: null },
  { name: 'Travel', type: 'EXPENSE', userId: null },
  { name: 'Personal Care', type: 'EXPENSE', userId: null },
];

export default function CategoryManagement() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToCategories(user.id.toString(), (data) => {
      setCategories(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

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

  const handleSeed = async () => {
    if (!user?.id) return;
    if (!window.confirm('Are you sure you want to seed default global categories? This will add them to the system.')) return;
    
    setLoading(true);
    try {
      await seedDefaultCategories(DEFAULT_CATEGORIES);
      await logActivity(user.id.toString(), user.name, user.email, 'SEED_CATEGORIES', 'Seeded default global categories');
      setSuccess('Default categories seeded successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to seed categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !user?.id) return;
    try {
      await deleteCategory(itemToDelete);
      await logActivity(user.id.toString(), user.name, user.email, 'DELETE_CATEGORY', `Deleted category ID: ${itemToDelete}`);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      setSuccess('Category deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to delete category');
      console.error(error);
    }
  };

  const openEditModal = (cat: Category) => {
    if (cat.userId === null && user?.role !== 'SUPER_ADMIN') {
      setError('You cannot edit global categories.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type
    });
    setIsModalOpen(true);
  };

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Category Management</h1>
          <p className="text-muted-foreground">Manage income and expense categories.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && categories.filter(c => c.userId === null).length === 0 && (
            <button
              onClick={handleSeed}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              <Database size={18} />
              Seed Defaults
            </button>
          )}
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', type: 'EXPENSE' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
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
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-600"
          >
            <CheckCircle2 size={20} />
            <p className="text-sm font-medium">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Categories */}
        <CategorySection 
          title="Income Categories" 
          categories={categories.filter(c => c.type === 'INCOME')} 
          onEdit={openEditModal}
          onDelete={handleDelete}
          type="INCOME"
          currentUserId={user?.id?.toString()}
          isAdmin={isAdmin}
        />
        
        {/* Expense Categories */}
        <CategorySection 
          title="Expense Categories" 
          categories={categories.filter(c => c.type === 'EXPENSE')} 
          onEdit={openEditModal}
          onDelete={handleDelete}
          type="EXPENSE"
          currentUserId={user?.id?.toString()}
          isAdmin={isAdmin}
        />
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
              <h3 className="text-lg font-bold mb-2">Delete Category</h3>
              <p className="text-muted-foreground mb-6">Are you sure you want to delete this category? This may affect existing transactions.</p>
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

function CategorySection({ title, categories, onEdit, onDelete, type, currentUserId, isAdmin }: { 
  title: string, 
  categories: Category[], 
  onEdit: (c: Category) => void, 
  onDelete: (id: string) => void,
  type: 'INCOME' | 'EXPENSE',
  currentUserId?: string,
  isAdmin?: boolean
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
        <h3 className={`text-sm font-bold uppercase tracking-wider ${type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {title}
        </h3>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm italic">
            No categories found.
          </div>
        ) : (
          categories.map((cat) => {
            const isGlobal = cat.userId === null;
            const canManage = !isGlobal || isAdmin;
            
            return (
              <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    <Tag size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{cat.name}</span>
                    {isGlobal && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Global</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(cat)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(cat.id.toString())}
                      className="p-2 text-zinc-500 hover:text-rose-600 transition-colors"
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
