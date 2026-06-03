import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loan, LoanRepayment } from '../types';
import { formatCurrency } from '../utils/i18n';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Download, 
  Search, 
  Filter, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  X, 
  Coins,
  ChevronRight,
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  addLoan, 
  updateLoan, 
  deleteLoan, 
  addRepayment, 
  deleteRepayment, 
  subscribeToLoans, 
  subscribeToRepayments 
} from '../services/firestoreService';
import * as XLSX from 'xlsx';

export default function Loans() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Views or state
  const [activeTab, setActiveTab] = useState<'loans' | 'analytics' | 'reports'>('loans');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue'>('ALL');
  
  // Selection
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Modals
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'loan' | 'repayment', id: string } | null>(null);
  
  // Editing state
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Form States
  const [loanForm, setLoanForm] = useState({
    borrowerName: '',
    mobileNumber: '',
    amount: '',
    givenDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    notes: '',
    status: 'Pending' as 'Pending' | 'Partially Paid' | 'Paid'
  });

  const [repaymentForm, setRepaymentForm] = useState({
    repaymentAmount: '',
    repaymentDate: new Date().toISOString().split('T')[0],
    note: ''
  });

  const currency = user?.currency || 'USD';
  const lang = user?.language || 'en';
  const todayStr = new Date().toISOString().split('T')[0];

  // Subscribe to loans and repayments
  useEffect(() => {
    if (!user?.id) return;

    const unsubLoans = subscribeToLoans(user.id.toString(), (data) => {
      setLoans(data);
      setLoading(false);
    });

    const unsubRepayments = subscribeToRepayments(user.id.toString(), (data) => {
      setRepayments(data);
    });

    return () => {
      unsubLoans();
      unsubRepayments();
    };
  }, [user?.id]);

  // Helper selectors and calculations
  const getLoanRepayments = (loanId: string) => {
    return repayments.filter(r => r.loanId === loanId && !r.deleted_at);
  };

  const getLoanTotalRepaid = (loanId: string) => {
    return getLoanRepayments(loanId).reduce((sum, r) => sum + r.repaymentAmount, 0);
  };

  const getLoanRemaining = (loan: Loan) => {
    const repaid = getLoanTotalRepaid(loan.id);
    return Math.max(0, loan.amount - repaid);
  };

  const isLoanOverdue = (loan: Loan) => {
    if (loan.status === 'Paid') return false;
    const remaining = getLoanRemaining(loan);
    if (remaining <= 0) return false;
    return todayStr > loan.expectedReturnDate;
  };

  const getDisplayStatus = (loan: Loan) => {
    const remaining = getLoanRemaining(loan);
    if (remaining <= 0) return 'Paid';
    if (isLoanOverdue(loan)) return 'Overdue';
    if (remaining < loan.amount) return 'Partially Paid';
    return loan.status || 'Pending';
  };

  // Bulk figures
  const totalLoanGiven = useMemo(() => {
    return loans.reduce((sum, l) => sum + l.amount, 0);
  }, [loans]);

  const totalRecovered = useMemo(() => {
    return repayments.reduce((sum, r) => sum + r.repaymentAmount, 0);
  }, [repayments]);

  const outstandingAmount = useMemo(() => {
    return Math.max(0, totalLoanGiven - totalRecovered);
  }, [totalLoanGiven, totalRecovered]);

  const overdueLoansCount = useMemo(() => {
    return loans.filter(l => isLoanOverdue(l)).length;
  }, [loans, repayments, todayStr]);

  // Filtered loans list
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const displayStatus = getDisplayStatus(loan);
      
      const matchesSearch = 
        loan.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loan.notes && loan.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (loan.mobileNumber && loan.mobileNumber.includes(searchQuery));
        
      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      return displayStatus === statusFilter;
    });
  }, [loans, repayments, searchQuery, statusFilter]);

  const selectedLoan = useMemo(() => {
    return loans.find(l => l.id === selectedLoanId) || null;
  }, [loans, selectedLoanId]);

  // Mutations
  const handleAddOrEditLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const parsedAmount = parseFloat(loanForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Must enter a valid amount');
      return;
    }

    const payload = {
      userId: user.id.toString(),
      borrowerName: loanForm.borrowerName,
      mobileNumber: loanForm.mobileNumber || undefined,
      amount: parsedAmount,
      givenDate: loanForm.givenDate,
      expectedReturnDate: loanForm.expectedReturnDate,
      notes: loanForm.notes || undefined,
      status: loanForm.status
    };

    try {
      if (editingLoan) {
        // Evaluate and adjust internal status if editing amount
        const currentRepaid = getLoanTotalRepaid(editingLoan.id);
        let updatedStatus = payload.status;
        if (currentRepaid >= payload.amount) {
          updatedStatus = 'Paid';
        } else if (currentRepaid > 0) {
          updatedStatus = 'Partially Paid';
        }
        await updateLoan(editingLoan.id, { ...payload, status: updatedStatus });
      } else {
        await addLoan(payload);
      }
      setShowLoanModal(false);
      setEditingLoan(null);
      resetLoanForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !user?.id) return;

    const parsedAmount = parseFloat(repaymentForm.repaymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Must enter a valid repayment amount');
      return;
    }

    const loanObj = loans.find(l => l.id === selectedLoanId);
    if (!loanObj) return;

    const remaining = getLoanRemaining(loanObj);
    if (parsedAmount > remaining) {
      if (!window.confirm(`Warning: Repayment amount of ${parsedAmount} is larger than the outstanding remaining balance of ${remaining}. Proceed?`)) {
        return;
      }
    }

    const payload = {
      userId: user.id.toString(),
      loanId: selectedLoanId,
      repaymentAmount: parsedAmount,
      repaymentDate: repaymentForm.repaymentDate,
      note: repaymentForm.note || undefined
    };

    try {
      await addRepayment(payload);
      
      // Update Loan status in Firestore manually to mirror the sum
      const newTotalRepaid = getLoanTotalRepaid(selectedLoanId) + parsedAmount;
      let newStatus: 'Pending' | 'Partially Paid' | 'Paid' = 'Pending';
      if (newTotalRepaid >= loanObj.amount) {
        newStatus = 'Paid';
      } else if (newTotalRepaid > 0) {
        newStatus = 'Partially Paid';
      }
      
      await updateLoan(selectedLoanId, { status: newStatus });

      setShowRepaymentModal(false);
      resetRepaymentForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTrigger = (type: 'loan' | 'repayment', id: string) => {
    setShowDeleteConfirm({ type, id });
  };

  const executeDelete = async () => {
    if (!showDeleteConfirm) return;
    const { type, id } = showDeleteConfirm;

    try {
      if (type === 'loan') {
        await deleteLoan(id);
        if (selectedLoanId === id) setSelectedLoanId(null);
      } else {
        // If deleting a repayment, re-calculate the status of the parent loan
        const repayObj = repayments.find(r => r.id === id);
        await deleteRepayment(id);

        if (repayObj) {
          const lId = repayObj.loanId;
          const loanObj = loans.find(l => l.id === lId);
          if (loanObj) {
            const currentTotalMinusThis = getLoanTotalRepaid(lId) - repayObj.repaymentAmount;
            let newStatus: 'Pending' | 'Partially Paid' | 'Paid' = 'Pending';
            if (currentTotalMinusThis >= loanObj.amount) {
              newStatus = 'Paid';
            } else if (currentTotalMinusThis > 0) {
              newStatus = 'Partially Paid';
            }
            await updateLoan(lId, { status: newStatus });
          }
        }
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error(error);
    }
  };

  const resetLoanForm = () => {
    setLoanForm({
      borrowerName: '',
      mobileNumber: '',
      amount: '',
      givenDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: '',
      notes: '',
      status: 'Pending'
    });
  };

  const resetRepaymentForm = () => {
    setRepaymentForm({
      repaymentAmount: '',
      repaymentDate: new Date().toISOString().split('T')[0],
      note: ''
    });
  };

  // Populate form for editing
  const triggerEditLoan = (loan: Loan) => {
    setEditingLoan(loan);
    setLoanForm({
      borrowerName: loan.borrowerName,
      mobileNumber: loan.mobileNumber || '',
      amount: loan.amount.toString(),
      givenDate: loan.givenDate,
      expectedReturnDate: loan.expectedReturnDate,
      notes: loan.notes || '',
      status: loan.status
    });
    setShowLoanModal(true);
  };

  // Excel exporter
  const triggerExcelExport = () => {
    try {
      const loansData = loans.map(l => ({
        'Borrower Name': l.borrowerName,
        'Mobile Number': l.mobileNumber || 'N/A',
        'Initial Amount': l.amount,
        'Remaining Balance': getLoanRemaining(l),
        'Total Repaid': getLoanTotalRepaid(l.id),
        'Loan Date': l.givenDate,
        'Return Date': l.expectedReturnDate,
        'Status': getDisplayStatus(l),
        'Notes': l.notes || ''
      }));

      const repaymentsData = repayments.map(r => {
        const loan = loans.find(l => l.id === r.loanId);
        return {
          'Borrower Name': loan ? loan.borrowerName : 'Unknown',
          'Repayment Amount': r.repaymentAmount,
          'Repayment Date': r.repaymentDate,
          'Repayment Notes': r.note || ''
        };
      });

      const wb = XLSX.utils.book_new();
      const wsLoans = XLSX.utils.json_to_sheet(loansData);
      const wsRepayments = XLSX.utils.json_to_sheet(repaymentsData);

      XLSX.utils.book_append_sheet(wb, wsLoans, 'Loans');
      XLSX.utils.book_append_sheet(wb, wsRepayments, 'Repayments Received');

      XLSX.writeFile(wb, 'Loans_and_Repayments_Report.xlsx');
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  // Reports view data calculations
  const monthlyLoansReport = useMemo(() => {
    const map: Record<string, number> = {};
    loans.forEach(l => {
      const monthStr = l.givenDate.substring(0, 7); // YYYY-MM
      map[monthStr] = (map[monthStr] || 0) + l.amount;
    });
    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [loans]);

  const monthlyRepaymentsReport = useMemo(() => {
    const map: Record<string, number> = {};
    repayments.forEach(r => {
      const monthStr = r.repaymentDate.substring(0, 7); // YYYY-MM
      map[monthStr] = (map[monthStr] || 0) + r.repaymentAmount;
    });
    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [repayments]);

  const outstandingReport = useMemo(() => {
    return loans
      .map(l => {
        const remaining = getLoanRemaining(l);
        return {
          borrowerName: l.borrowerName,
          remaining,
          initial: l.amount,
          returnDate: l.expectedReturnDate
        };
      })
      .filter(l => l.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [loans, repayments]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 id="loans" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Loan & Debt Tracker</h1>
          <p className="text-zinc-500 text-sm mt-1">Track money lent to borrowers and manage repayments seamlessly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerExcelExport}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors cursor-pointer"
          >
            <FileDown size={16} />
            Export to Excel
          </button>
          
          <button
            onClick={() => {
              setEditingLoan(null);
              resetLoanForm();
              setShowLoanModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-xl font-medium transition-transform active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            Add Loan Document
          </button>
        </div>
      </div>

      {/* Widgets Summary Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <Coins size={18} />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Loans Given</p>
          </div>
          <p className="text-xl md:text-2xl font-black mt-2 text-zinc-900 dark:text-zinc-100">{formatCurrency(totalLoanGiven, currency, lang)}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3">
              <TrendingUp size={18} />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Recovered</p>
          </div>
          <p className="text-xl md:text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRecovered, currency, lang)}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
              <TrendingDown size={18} />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Outstanding Amount</p>
          </div>
          <p className="text-xl md:text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">{formatCurrency(outstandingAmount, currency, lang)}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mb-3">
              <AlertOctagon size={18} />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">Overdue Debtors</p>
          </div>
          <p className="text-xl md:text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">{overdueLoansCount} borrower{overdueLoansCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('loans')}
            className={`py-3 text-sm font-semibold border-b-2 px-1 transition-all cursor-pointer ${
              activeTab === 'loans' 
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50' 
                : 'border-transparent text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            All Loans Records
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 text-sm font-semibold border-b-2 px-1 transition-all cursor-pointer ${
              activeTab === 'reports' 
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50' 
                : 'border-transparent text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Detailed Reports
          </button>
        </div>
      </div>

      {/* Active Tab View */}
      <AnimatePresence mode="wait">
        {activeTab === 'loans' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Main Loans List & Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 text-zinc-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search borrower name, notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    />
                  </div>
                  
                  <div className="min-w-[150px]">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue / Expired</option>
                    </select>
                  </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
                        <th className="px-4 py-3">Borrower</th>
                        <th className="px-4 py-3">Initial Amount</th>
                        <th className="px-4 py-3">Remaining Balance</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                      {filteredLoans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                            No loan documents match the filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLoans.map(loan => {
                          const remaining = getLoanRemaining(loan);
                          const dispStatus = getDisplayStatus(loan);
                          const isSelected = selectedLoanId === loan.id;
                          return (
                            <tr
                              key={loan.id}
                              onClick={() => setSelectedLoanId(loan.id)}
                              className={`cursor-pointer transition-colors group ${
                                isSelected 
                                  ? 'bg-zinc-50 dark:bg-zinc-800/40 font-medium' 
                                  : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                    {loan.borrowerName}
                                    {loan.mobileNumber && (
                                      <span className="text-[10px] text-zinc-400 flex items-center hover:text-zinc-600 transition-colors">
                                        <Phone size={10} className="inline mr-0.5" />
                                        {loan.mobileNumber}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-zinc-400">Lent on {loan.givenDate}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-400 leading-none">
                                {formatCurrency(loan.amount, currency, lang)}
                              </td>
                              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-bold">
                                {formatCurrency(remaining, currency, lang)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs ${isLoanOverdue(loan) ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-500'}`}>
                                  {loan.expectedReturnDate}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  dispStatus === 'Paid' 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : dispStatus === 'Partially Paid'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                    : dispStatus === 'Overdue'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                    : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}>
                                  {dispStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerEditLoan(loan);
                                    }}
                                    className="p-1 px-1.5 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                    title="Edit settings"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTrigger('loan', loan.id);
                                    }}
                                    className="p-1 px-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/35 rounded transition-colors"
                                    title="Delete document"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sides Panel: Loan Details & Repayments Tracking */}
            <div className="lg:col-span-1">
              <AnimatePresence mode="wait">
                {selectedLoan ? (
                  <motion.div
                    key={selectedLoanId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-6"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">Borrower Dossier</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">Details and repayments for {selectedLoan.borrowerName}</p>
                      </div>
                      <button
                        onClick={() => setSelectedLoanId(null)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Lent Principal:</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(selectedLoan.amount, currency, lang)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Total Recovered:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(getLoanTotalRepaid(selectedLoan.id), currency, lang)}</span>
                      </div>
                      <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 pt-2 flex justify-between text-base">
                        <span className="text-zinc-400">Remaining Balance:</span>
                        <span className="font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(getLoanRemaining(selectedLoan), currency, lang)}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-widest text-[11px]">Repayments Timeline</h4>
                        {getLoanRemaining(selectedLoan) > 0 && (
                          <button
                            onClick={() => setShowRepaymentModal(true)}
                            className="text-xs text-zinc-950 dark:text-zinc-50 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} />
                            Log Payment
                          </button>
                        )}
                      </div>

                      {/* Repayments History */}
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {getLoanRepayments(selectedLoan.id).length === 0 ? (
                          <p className="text-xs text-zinc-400 text-center py-4 italic">No repayments recorded for this document yet.</p>
                        ) : (
                          getLoanRepayments(selectedLoan.id).map(rep => (
                            <div key={rep.id} className="relative pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 py-1.5 text-xs group flex justify-between items-start">
                              <div className="absolute w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-700 -left-[5px] top-[14px]"></div>
                              <div>
                                <p className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(rep.repaymentAmount, currency, lang)}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{rep.repaymentDate} {rep.note && `• "${rep.note}"`}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteTrigger('repayment', rep.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedLoan.notes && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest text-[11px] block">Document Notes</span>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/80 p-3 rounded-xl italic">
                          "{selectedLoan.notes}"
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                      <Info size={20} />
                    </div>
                    <h3 className="font-semibold text-sm">No Document Selected</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[190px] mx-auto">Click a record in the loan table to access repayments logs and transaction dossier details.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Monthly Loans Given */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">Monthly Loans Given</h3>
                <p className="text-zinc-400 text-xs">Principal money lent aggregated by month.</p>
              </div>
              <div className="space-y-2.5">
                {monthlyLoansReport.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4">No records found.</p>
                ) : (
                  monthlyLoansReport.map(r => (
                    <div key={r.month} className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <span className="font-semibold text-zinc-650">{r.month}</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(r.amount, currency, lang)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Monthly Recovered Repayments */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">Monthly Repayments Logged</h3>
                <p className="text-zinc-400 text-xs">Total payment returns received active by month.</p>
              </div>
              <div className="space-y-2.5">
                {monthlyRepaymentsReport.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4">No payments logged yet.</p>
                ) : (
                  monthlyRepaymentsReport.map(r => (
                    <div key={r.month} className="flex justify-between items-center text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <span className="font-semibold text-zinc-650">{r.month}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-450">{formatCurrency(r.amount, currency, lang)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Outstanding Balances Report */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-200">Top Outstanding Receivables</h3>
                <p className="text-zinc-400 text-xs">Outstanding debtors with non-zero remainder due.</p>
              </div>
              <div className="space-y-2.5">
                {outstandingReport.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4">Congratulations, no outstanding loans.</p>
                ) : (
                  outstandingReport.map(r => (
                    <div key={r.borrowerName + r.remaining} className="flex justify-between items-start text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.borrowerName}</p>
                        <p className="text-[10px] text-zinc-400">Due {r.returnDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(r.remaining, currency, lang)}</p>
                        <p className="text-[10px] text-zinc-300">of {formatCurrency(r.initial, currency, lang)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Loan Add & Edit Modal --- */}
      <AnimatePresence>
        {showLoanModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoanModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                  {editingLoan ? 'Edit Loan Document' : 'Initialize Loan Record'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddOrEditLoan} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Borrower Name *</label>
                    <input
                      type="text"
                      required
                      value={loanForm.borrowerName}
                      onChange={(e) => setLoanForm({ ...loanForm, borrowerName: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Mobile Number (Optional)</label>
                    <input
                      type="text"
                      value={loanForm.mobileNumber}
                      onChange={(e) => setLoanForm({ ...loanForm, mobileNumber: e.target.value })}
                      placeholder="e.g. +12345678"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Lending Amount ({currency}) *</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={loanForm.amount}
                      onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Initial Status</label>
                    <select
                      value={loanForm.status}
                      onChange={(e) => setLoanForm({ ...loanForm, status: e.target.value as any })}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Loan Given Date *</label>
                    <input
                      type="date"
                      required
                      value={loanForm.givenDate}
                      onChange={(e) => setLoanForm({ ...loanForm, givenDate: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Expected Return Date *</label>
                    <input
                      type="date"
                      required
                      value={loanForm.expectedReturnDate}
                      onChange={(e) => setLoanForm({ ...loanForm, expectedReturnDate: e.target.value })}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Internal Notes (Optional)</label>
                  <textarea
                    rows={3}
                    value={loanForm.notes}
                    onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                    placeholder="Log terms, location, details here..."
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLoanModal(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 rounded-xl hover:bg-zinc-805 dark:hover:bg-zinc-100 transition-colors"
                  >
                    {editingLoan ? 'Save Changes' : 'Create Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Repayment received log Modal --- */}
      <AnimatePresence>
        {showRepaymentModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRepaymentModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                  Receive Loan Repayment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRepaymentModal(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddRepayment} className="space-y-4 text-sm">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Repayment Amount ({currency}) *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={repaymentForm.repaymentAmount}
                    onChange={(e) => setRepaymentForm({ ...repaymentForm, repaymentAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2 font-bold text-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Received Date *</label>
                  <input
                    type="date"
                    required
                    value={repaymentForm.repaymentDate}
                    onChange={(e) => setRepaymentForm({ ...repaymentForm, repaymentDate: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Payment Reference / Notes</label>
                  <input
                    type="text"
                    value={repaymentForm.note}
                    onChange={(e) => setRepaymentForm({ ...repaymentForm, note: e.target.value })}
                    placeholder="e.g. Cash, Bank transfer, partial"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-4 py-2"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRepaymentModal(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Simple Absolute Delete Confirmation Dialog --- */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 p-6 rounded-3xl shadow-2xl text-center space-y-4"
            >
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-150">Confirm Deletion</h3>
              <p className="text-sm text-zinc-500">
                Are you absolutely sure you want to delete this {showDeleteConfirm.type}? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
