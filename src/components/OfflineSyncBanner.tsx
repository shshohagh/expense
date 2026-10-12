import React, { useState } from 'react';
import { useOfflineSync } from '../contexts/OfflineSyncContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function OfflineSyncBanner() {
  const { 
    isOnline, 
    isFirestoreConnected, 
    isSimulatingOffline, 
    lastSyncTime, 
    toggleSimulateOffline, 
    forceSync 
  } = useOfflineSync();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await forceSync();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const isDisconnected = !isOnline || !isFirestoreConnected || isSimulatingOffline;

  return (
    <div className="w-full">
      <AnimatePresence>
        {isDisconnected ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-800 dark:text-amber-200"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <WifiOff size={15} className="text-amber-600 dark:text-amber-400" />
                <span className="font-semibold">
                  Offline Mode Active
                </span>
                <span className="hidden sm:inline text-amber-700/80 dark:text-amber-300/80">
                  — Data is cached locally in IndexedDB. Transactions will automatically sync once connection is restored.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-900 dark:text-amber-100 font-medium transition-colors"
                  title="Attempt to reconnect and synchronize"
                >
                  <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing..." : "Reconnect"}
                </button>
                {isSimulatingOffline && (
                  <button
                    type="button"
                    onClick={toggleSimulateOffline}
                    className="px-2 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium hover:opacity-80"
                  >
                    End Offline Test
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function OfflineStatusBadge() {
  const { 
    isOnline, 
    isFirestoreConnected, 
    isSimulatingOffline, 
    toggleSimulateOffline,
    forceSync,
    lastSyncTime 
  } = useOfflineSync();
  const [showTooltip, setShowTooltip] = useState(false);

  const isDisconnected = !isOnline || !isFirestoreConnected || isSimulatingOffline;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          isDisconnected
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        }`}
        title="Firestore Offline Persistence Status"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isDisconnected ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
        <Database size={12} />
        <span className="hidden sm:inline">
          {isDisconnected ? 'Offline Cache' : 'Firestore Synced'}
        </span>
      </button>

      {showTooltip && (
        <div className="absolute right-0 mt-2 w-72 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Database size={13} className="text-blue-500" />
              Offline Persistence
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isDisconnected ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'}`}>
              {isDisconnected ? 'LOCAL CACHE' : 'CONNECTED'}
            </span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-2.5 text-[11px] leading-relaxed">
            Multi-tab IndexedDB cache is active. Reads and writes operate with zero latency offline and synchronize automatically with Cloud Firestore when reconnected.
          </p>

          {lastSyncTime && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-2.5">
              Last synced: {lastSyncTime.toLocaleTimeString()}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={toggleSimulateOffline}
              className="flex-1 py-1 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium transition-colors"
            >
              {isSimulatingOffline ? 'Go Online' : 'Simulate Offline'}
            </button>
            <button
              type="button"
              onClick={forceSync}
              className="flex-1 py-1 px-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[11px] font-medium transition-colors"
            >
              Force Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
