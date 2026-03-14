import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { User, Lock, Save, CheckCircle, Eye, EyeOff, Globe, Coins, Download, Database, Upload, AlertTriangle } from 'lucide-react';
import { currencies, languages } from '../utils/i18n';

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    password: '',
    confirmPassword: '',
    currency: user?.currency || 'USD',
    language: user?.language || 'en',
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/export-json', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring data will overwrite all your current transactions and recurring entries. This action cannot be undone. Do you want to proceed?')) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const res = await fetch('/api/user/restore-json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });

          if (res.ok) {
            setMessage('Data restored successfully! Please refresh the page to see changes.');
            if (data.profile) {
              updateUser({
                currency: data.profile.currency,
                language: data.profile.language,
              });
            }
          } else {
            const err = await res.json();
            alert(err.error || 'Failed to restore data');
          }
        } catch (err) {
          alert('Invalid JSON file format');
        } finally {
          setRestoring(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error(error);
      alert('Failed to read file');
      setRestoring(false);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          password: formData.password || undefined,
          currency: formData.currency,
          language: formData.language,
        }),
      });

      if (res.ok) {
        updateUser({ 
          name: formData.name,
          currency: formData.currency,
          language: formData.language,
        });
        setMessage('Profile updated successfully!');
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">Update your personal information and security settings.</p>
      </header>

      {message && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-600"
        >
          <CheckCircle size={20} />
          <p className="text-sm font-medium">{message}</p>
        </motion.div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User size={20} className="text-muted-foreground" />
              General Information
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe size={20} className="text-muted-foreground" />
              Preferences
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Coins size={16} /> Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe size={16} /> Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lock size={20} className="text-muted-foreground" />
              Security
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 pr-10"
                    placeholder="Leave blank to keep current"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 pr-10"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database size={20} className="text-muted-foreground" />
              Data Management
            </h2>
            <div className="grid gap-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Export Your Data</p>
                    <p className="text-sm text-muted-foreground">Download all your transactions, recurring entries, and profile settings in a single JSON file.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
                  >
                    <Download size={18} />
                    {exporting ? 'Exporting...' : 'Export JSON'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Restore Your Data</p>
                      <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] font-bold uppercase rounded tracking-wider flex items-center gap-1">
                        <AlertTriangle size={10} /> Destructive
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Upload a previously exported JSON file to restore your account data. This will overwrite current data.</p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestore}
                      disabled={restoring}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={restoring}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      <Upload size={18} />
                      {restoring ? 'Restoring...' : 'Restore JSON'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={20} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
