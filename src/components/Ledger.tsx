import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/i18n';
import { motion } from 'motion/react';
import { Download, FileSpreadsheet, Check, Filter, BookOpen, ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react';
import ExportToast, { ToastData } from './ExportToast';

interface LedgerProps {
  transactions: Transaction[];
  currency: string;
  lang: string;
}

export default function Ledger({ transactions, currency, lang }: LedgerProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState(false);
  const [exportToast, setExportToast] = useState<ToastData | null>(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const availableYears = useMemo(() => {
    const rawYears = transactions
      .map(t => new Date(t.date).getFullYear())
      .filter(y => !isNaN(y));
    const uniqueYears = Array.from(new Set([currentYear, ...rawYears]));
    return uniqueYears.sort((a, b) => b - a);
  }, [transactions, currentYear]);

  const activeTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'ACTIVE' || !t.status);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return activeTransactions.filter(t => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesYear = tDate.getFullYear() === selectedYear;
      const matchesMonth = selectedMonth === 'all' || tDate.getMonth() === selectedMonth;
      return matchesYear && matchesMonth;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeTransactions, selectedYear, selectedMonth]);

  // Accounting Ledger Metrics
  const totalDebits = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + (t.type === 'INCOME' ? t.amount : t.amount), 0);
  }, [filteredTransactions]);

  const totalCredits = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + (t.type === 'EXPENSE' ? t.amount : t.amount), 0);
  }, [filteredTransactions]);

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const handleDownloadCSV = (exportScope: 'filtered' | 'all' = 'filtered') => {
    const dataToExport = exportScope === 'all' ? activeTransactions : filteredTransactions;

    if (dataToExport.length === 0) {
      alert('No ledger records available to export for the selected period.');
      return;
    }

    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Date',
      'Transaction ID',
      'Description',
      'Type',
      'Category',
      'Debit Account',
      'Credit Account',
      'Debit Amount',
      'Credit Amount',
      'Amount',
      'Currency',
      'Status'
    ];

    const rows = dataToExport.map(t => {
      const isIncome = t.type === 'INCOME';
      const debitAccount = isIncome ? 'Cash / Bank' : (t.categoryName || 'Expense');
      const creditAccount = isIncome ? (t.categoryName || 'Revenue') : 'Cash / Bank';
      const debitAmount = isIncome ? t.amount.toFixed(2) : '0.00';
      const creditAmount = !isIncome ? t.amount.toFixed(2) : '0.00';

      return [
        escapeCSV(t.date),
        escapeCSV(t.id || ''),
        escapeCSV(t.description || ''),
        escapeCSV(t.type || 'EXPENSE'),
        escapeCSV(t.categoryName || 'General'),
        escapeCSV(debitAccount),
        escapeCSV(creditAccount),
        debitAmount,
        creditAmount,
        t.amount.toFixed(2),
        escapeCSV(currency),
        escapeCSV(t.status || 'ACTIVE')
      ].join(',');
    });

    // Add UTF-8 BOM for seamless rendering in Excel and accounting software
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const periodLabel = exportScope === 'all'
      ? 'all_history'
      : selectedMonth === 'all'
        ? `year_${selectedYear}`
        : `${months[selectedMonth].toLowerCase()}_${selectedYear}`;

    const fileName = `ledger_export_${periodLabel}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);

    setExportToast({
      id: `toast-${Date.now()}`,
      title: 'Ledger CSV Exported',
      message: `Your double-entry ledger records have been downloaded to your device.`,
      fileName,
      recordCount: dataToExport.length,
      type: 'success'
    });
  };

  const handleDownloadExcel = () => {
    if (filteredTransactions.length === 0) {
      alert('No ledger records available to export for the selected period.');
      return;
    }

    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Date',
      'Transaction ID',
      'Description',
      'Type',
      'Category',
      'Debit Account',
      'Credit Account',
      'Debit Amount',
      'Credit Amount',
      'Amount',
      'Currency',
      'Status'
    ];

    const rows = filteredTransactions.map(t => {
      const isIncome = t.type === 'INCOME';
      const debitAccount = isIncome ? 'Cash / Bank' : (t.categoryName || 'Expense');
      const creditAccount = isIncome ? (t.categoryName || 'Revenue') : 'Cash / Bank';
      const debitAmount = isIncome ? t.amount.toFixed(2) : '0.00';
      const creditAmount = !isIncome ? t.amount.toFixed(2) : '0.00';

      return [
        escapeCSV(t.date),
        escapeCSV(t.id || ''),
        escapeCSV(t.description || ''),
        escapeCSV(t.type || 'EXPENSE'),
        escapeCSV(t.categoryName || 'General'),
        escapeCSV(debitAccount),
        escapeCSV(creditAccount),
        debitAmount,
        creditAmount,
        t.amount.toFixed(2),
        escapeCSV(currency),
        escapeCSV(t.status || 'ACTIVE')
      ].join(',');
    });

    // Add UTF-8 BOM (\uFEFF) for seamless opening in Microsoft Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const periodLabel = selectedMonth === 'all'
      ? `year_${selectedYear}`
      : `${months[selectedMonth].toLowerCase()}_${selectedYear}`;

    const fileName = `ledger_excel_${periodLabel}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExcelSuccess(true);
    setTimeout(() => setExcelSuccess(false), 3000);

    setExportToast({
      id: `toast-${Date.now()}`,
      title: 'Excel Download Successful',
      message: `${filteredTransactions.length} ledger transaction(s) formatted and downloaded for Excel.`,
      fileName,
      recordCount: filteredTransactions.length,
      badge: 'EXCEL',
      type: 'success'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Double Entry Ledger
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Financial accounting journal of debits, credits, and double-entry bookkeeping.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Filters & Download CSV */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Filter size={15} className="text-zinc-400 ml-2 shrink-0" />
            <select
              id="ledger-month-select"
              aria-label="Select Month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-zinc-800 dark:text-zinc-200 outline-none px-2 py-1 cursor-pointer"
            >
              <option value="all">All Months</option>
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>

            <span className="text-zinc-300 dark:text-zinc-700">|</span>

            <select
              id="ledger-year-select"
              aria-label="Select Year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-zinc-800 dark:text-zinc-200 outline-none px-2 py-1 cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Download Excel Button */}
          <button
            id="ledger-download-excel-btn"
            data-testid="download-excel-btn"
            type="button"
            onClick={handleDownloadExcel}
            disabled={filteredTransactions.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-sm transition-all cursor-pointer ${
              excelSuccess
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={filteredTransactions.length === 0 ? 'No records to download' : `Download ${filteredTransactions.length} filtered ledger record(s) as Excel`}
          >
            {excelSuccess ? (
              <>
                <Check size={16} />
                <span>Excel Downloaded</span>
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                <span>Download Excel</span>
              </>
            )}
          </button>

          <button
            id="ledger-download-csv-btn"
            type="button"
            onClick={() => handleDownloadCSV('filtered')}
            disabled={filteredTransactions.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-sm transition-all cursor-pointer ${
              downloadSuccess
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title={filteredTransactions.length === 0 ? 'No records to download' : `Download ${filteredTransactions.length} filtered ledger record(s) as CSV`}
          >
            {downloadSuccess ? (
              <>
                <Check size={16} />
                <span>CSV Exported</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export CSV ({filteredTransactions.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accounting Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ledger Entries</span>
            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
            {filteredTransactions.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedMonth === 'all' ? `Full Year ${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Income (Cash In)</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome, currency, lang)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Debit to Cash Account</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Expenses (Cash Out)</span>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/60 rounded-lg text-rose-600 dark:text-rose-400">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-rose-600 dark:text-rose-400">
            {formatCurrency(totalExpense, currency, lang)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Credit to Cash Account</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Ledger Balance</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Scale size={16} />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${totalIncome - totalExpense >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(totalIncome - totalExpense, currency, lang)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Double-entry balanced</p>
        </div>
      </div>

      {/* Double Entry Table */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Accounting Journal Records
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {filteredTransactions.length} entries for {selectedMonth === 'all' ? `All Months of ${selectedYear}` : `${months[selectedMonth]} ${selectedYear}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadCSV('all')}
              disabled={activeTransactions.length === 0}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline px-2 py-1 transition-colors"
            >
              Export All Historical Records ({activeTransactions.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Debit Account</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Account</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Debit</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Credit</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                      <p className="font-medium text-zinc-600 dark:text-zinc-400">No ledger records found</p>
                      <p className="text-xs text-zinc-400">
                        Try selecting a different month or year from the filters above.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isIncome = t.type === 'INCOME';
                  const debitAccount = isIncome ? 'Cash / Bank' : (t.categoryName || 'Expense');
                  const creditAccount = isIncome ? (t.categoryName || 'Revenue') : 'Cash / Bank';

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300 max-w-[220px] truncate" title={t.description || ''}>
                        {t.description || <span className="text-zinc-400 italic">No description</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {t.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {debitAccount}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {creditAccount}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono">
                        {isIncome ? formatCurrency(t.amount, currency, lang) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right text-rose-600 dark:text-rose-400 whitespace-nowrap font-mono">
                        {!isIncome ? formatCurrency(t.amount, currency, lang) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-zinc-900 dark:text-zinc-100 whitespace-nowrap font-mono">
                        {formatCurrency(t.amount, currency, lang)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Export Toast Notification */}
      <ExportToast 
        toast={exportToast} 
        onClose={() => setExportToast(null)} 
      />
    </div>
  );
}
