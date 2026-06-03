import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../utils/i18n';
import { Settings as SettingsIcon, Bell, Shield, Globe, Palette, Database, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { loadDemoData, deleteDemoData } from '../services/firestoreService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const lang = user?.language || 'en';

  const handleLoadDemo = async () => {
    if (!user?.id) return;
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      await loadDemoData(user.id.toString());
      setSuccessMessage('Demo data loaded successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to load demo data.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDemo = () => {
    setDeleteModalOpen(true);
  };

  const confirmDeleteDemo = async () => {
    if (!user?.id) return;
    setIsDeleting(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      await deleteDemoData(user.id.toString());
      setSuccessMessage('Demo data deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to delete demo data.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const settingsSections = [
    {
      title: 'General',
      icon: Globe,
      items: [
        { label: 'Language', value: user?.language === 'en' ? 'English' : 'Bengali' },
        { label: 'Currency', value: user?.currency || 'USD' },
      ]
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Email Notifications', value: 'Enabled' },
        { label: 'Push Notifications', value: 'Disabled' },
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        { label: 'Two-Factor Authentication', value: 'Disabled' },
        { label: 'Session Management', value: 'Active' },
      ]
    },
    {
      title: 'Appearance',
      icon: Palette,
      items: [
        { label: 'Theme', value: 'System Default' },
        { label: 'Compact Mode', value: 'Off' },
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences and account security.</p>
        
        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 rounded-xl text-center font-semibold border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 rounded-xl text-center font-semibold border border-rose-200 dark:border-rose-800 animate-fadeIn">
            {errorMessage}
          </div>
        )}
      </header>

      <div className="grid gap-6">
        {settingsSections.map((section, idx) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
          >
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center gap-3">
              <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg">
                <section.icon size={18} />
              </div>
              <h2 className="font-bold text-lg">{section.title}</h2>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {section.items.map((item) => (
                <div key={item.label} className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">Configure your {item.label.toLowerCase()} settings.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-zinc-500">{item.value}</span>
                    <button className="text-sm font-bold text-zinc-900 dark:text-white hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ))}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: settingsSections.length * 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
        >
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center gap-3">
            <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg">
              <Database size={18} />
            </div>
            <h2 className="font-bold text-lg">Data Management</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="font-bold">Demo Data</p>
                <p className="text-sm text-muted-foreground">Load sample transactions and categories to explore the app.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLoadDemo}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                  Load Demo Data
                </button>
                <button
                  onClick={handleDeleteDemo}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  Delete Demo Data
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        title="Confirm Deletion"
        message="Are you sure you want to delete all demo data? This action cannot be undone."
        itemName="All Demo Data"
        onConfirm={confirmDeleteDemo}
        onCancel={() => setDeleteModalOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
