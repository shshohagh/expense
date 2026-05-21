import React from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

interface LedgerProps {
  transactions: Transaction[];
  currency: string;
  lang: string;
}

export default function Ledger({ transactions, currency, lang }: LedgerProps) {
  const activeTransactions = transactions.filter(t => t.status === 'ACTIVE' || !t.status);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-lg font-bold">Double Entry Ledger</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Debit Account</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Account</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activeTransactions.slice(0, 20).map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{t.date}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]">{t.description || '-'}</td>
                <td className="px-6 py-4 text-sm font-medium">{t.type === 'INCOME' ? 'Cash' : t.categoryName || 'Expense'}</td>
                <td className="px-6 py-4 text-sm font-medium">{t.type === 'INCOME' ? t.categoryName || 'Income' : 'Cash'}</td>
                <td className="px-6 py-4 text-sm font-bold text-right">{formatCurrency(t.amount, currency, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
