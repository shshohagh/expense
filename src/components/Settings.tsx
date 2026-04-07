import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../utils/i18n';
import { Settings as SettingsIcon, Bell, Shield, Globe, Palette } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  const { user } = useAuth();
  const lang = user?.language || 'en';

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
      </div>
    </div>
  );
}
