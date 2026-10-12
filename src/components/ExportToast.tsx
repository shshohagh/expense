import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Download, X, FileSpreadsheet } from 'lucide-react';

export interface ToastData {
  id: string;
  title: string;
  message: string;
  fileName?: string;
  recordCount?: number;
  type?: 'success' | 'info';
  badge?: string;
}

interface ExportToastProps {
  toast: ToastData | null;
  onClose: () => void;
  duration?: number;
}

export default function ExportToast({ toast, onClose, duration = 4500 }: ExportToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose, duration]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          id="export-toast-notification"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl p-4 overflow-hidden"
          role="status"
          aria-live="polite"
        >
          {/* Top Progress Bar */}
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className="absolute top-0 left-0 h-1 bg-emerald-500"
          />

          <div className="flex items-start gap-3.5 pt-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={20} />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {toast.title}
                </h4>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  {toast.badge || 'CSV'}
                </span>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                {toast.message}
              </p>

              {(toast.fileName || typeof toast.recordCount === 'number') && (
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  {toast.fileName && (
                    <span className="font-mono truncate max-w-[190px] flex items-center gap-1">
                      <FileSpreadsheet size={12} className="shrink-0 text-emerald-500" />
                      {toast.fileName}
                    </span>
                  )}
                  {typeof toast.recordCount === 'number' && (
                    <span className="font-medium shrink-0 ml-auto">
                      {toast.recordCount} row{toast.recordCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
