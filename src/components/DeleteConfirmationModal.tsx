import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this record? This action cannot be undone.",
  itemName,
  onConfirm,
  onCancel,
  isLoading = false
}: DeleteConfirmationModalProps) {
  // Prevent double-clicking
  const [clicked, setClicked] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setClicked(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (clicked || isLoading) return;
    setClicked(true);
    try {
      await onConfirm();
    } catch (err) {
      setClicked(false);
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onCancel}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
          >
            <div className="flex gap-4 items-start">
              {/* Highlight Icon */}
              <div className="p-3 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                <AlertTriangle size={24} />
              </div>

              <div className="space-y-2 flex-1">
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {message}
                </p>

                {itemName && (
                  <div className="mt-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800/80 rounded-xl p-3.5 font-sans">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block mb-0.5">Item Selected</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                      {itemName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isLoading || clicked}
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 rounded-xl hover:bg-zinc-150 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading || clicked}
                onClick={handleConfirm}
                className="relative min-w-[80px] px-4 py-2 text-xs font-semibold text-white bg-red-600 dark:bg-red-700 rounded-xl hover:bg-red-500 dark:hover:bg-red-650 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-500/10 cursor-pointer"
              >
                {(isLoading || clicked) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
