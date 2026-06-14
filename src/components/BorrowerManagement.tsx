import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Edit2, Trash2, X, Users, Search, Filter, 
  Phone, Mail, MapPin, Briefcase, FileText, Activity, 
  CheckCircle2, Clock, AlertTriangle, ArrowUpRight, 
  ArrowDownLeft, TrendingUp, TrendingDown, Coins, 
  ChevronRight, MessageSquare, ExternalLink, RefreshCw, 
  Info, Sparkles, UserCheck, UserX, Calculator, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToBorrowers, 
  addBorrower, 
  updateBorrower, 
  deleteBorrower, 
  logActivity,
  subscribeToLoans,
  subscribeToRepayments
} from '../services/firestoreService';
import { Borrower, Loan, LoanRepayment } from '../types';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { formatCurrency } from '../utils/i18n';

export default function BorrowerManagement() {
  const { user } = useAuth();
  
  // Core lists from Firebase
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  
  // Layout and view states
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  
  // Search, Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [debtFilter, setDebtFilter] = useState<'All' | 'WithOutstanding' | 'NoOutstanding' | 'Overdue'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'outstandingDesc' | 'outstandingAsc' | 'loansCount'>('name');
  
  // Detail sidebar sheet active tab
  const [detailTab, setDetailTab] = useState<'overview' | 'loans' | 'repayments'>('overview');

  // Borrower edit/add Form State
  const [formData, setFormData] = useState<Omit<Borrower, 'id' | 'ownerId' | 'created_at' | 'updated_at'>>({
    fullName: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    address: '',
    companyName: '',
    notes: '',
    status: 'Active'
  });

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [borrowerToDelete, setBorrowerToDelete] = useState<Borrower | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currency = user?.currency || 'USD';
  const lang = user?.language || 'en';

  // Subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const unsubBorrowers = subscribeToBorrowers(user.id.toString(), (data) => {
      setBorrowers(data);
      setLoading(false);
    });

    const unsubLoans = subscribeToLoans(user.id.toString(), (data) => {
      setLoans(data);
    });

    const unsubRepayments = subscribeToRepayments(user.id.toString(), (data) => {
      setRepayments(data);
    });

    return () => {
      unsubBorrowers();
      unsubLoans();
      unsubRepayments();
    };
  }, [user?.id]);

  // Aggregate stats per borrower
  const borrowerStats = useMemo<Record<string, {
    totalBorrowed: number;
    totalRepaid: number;
    outstanding: number;
    loansCount: number;
    activeLoansCount: number;
    overdueCount: number;
    lastLoanDate: string | null;
  }>>(() => {
    const stats: Record<string, {
      totalBorrowed: number;
      totalRepaid: number;
      outstanding: number;
      loansCount: number;
      activeLoansCount: number;
      overdueCount: number;
      lastLoanDate: string | null;
    }> = {};

    borrowers.forEach((b) => {
      // Find matching loans
      const bLoans = loans.filter(
        (l) => l.borrowerId === b.id || l.borrowerName.toLowerCase() === b.fullName.toLowerCase()
      );

      let totalBorrowed = 0;
      let totalRepaid = 0;
      let activeLoansCount = 0;
      let overdueCount = 0;
      let lastLoanDate: string | null = null;

      bLoans.forEach((l) => {
        totalBorrowed += l.amount;
        if (!lastLoanDate || l.givenDate > lastLoanDate) {
          lastLoanDate = l.givenDate;
        }

        // Repayments for this loan
        const lRepayments = repayments.filter(
          (r) => r.loanId === l.id && !r.deleted_at
        );
        const repaid = lRepayments.reduce((sum, r) => sum + r.repaymentAmount, 0);
        totalRepaid += repaid;

        const remaining = Math.max(0, l.amount - repaid);
        const isActive = remaining > 0 && l.status !== 'Paid';

        if (isActive) {
          activeLoansCount++;
          const todayStr = new Date().toISOString().split('T')[0];
          if (todayStr > l.expectedReturnDate) {
            overdueCount++;
          }
        }
      });

      stats[b.id] = {
        totalBorrowed,
        totalRepaid,
        outstanding: Math.max(0, totalBorrowed - totalRepaid),
        loansCount: bLoans.length,
        activeLoansCount,
        overdueCount,
        lastLoanDate
      };
    });

    return stats;
  }, [borrowers, loans, repayments]);

  // Global aggregate figures
  const globalStats = useMemo(() => {
    let totalOutstanding = 0;
    let totalBorrowed = 0;
    let totalRepaid = 0;
    let activeDebtorsCount = 0;
    let totalOverdueLoans = 0;

    borrowers.forEach((b) => {
      const stats = borrowerStats[b.id] || { 
        totalBorrowed: 0, 
        totalRepaid: 0, 
        outstanding: 0, 
        overdueCount: 0 
      };
      totalBorrowed += stats.totalBorrowed;
      totalRepaid += stats.totalRepaid;
      totalOutstanding += stats.outstanding;
      totalOverdueLoans += stats.overdueCount;
      if (stats.outstanding > 1) {
        activeDebtorsCount++;
      }
    });

    return {
      totalBorrowed,
      totalRepaid,
      totalOutstanding,
      activeDebtorsCount,
      totalOverdueLoans,
      totalBorrowersCount: borrowers.length,
    };
  }, [borrowerStats, borrowers]);

  // Form submission: save or update borrower
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, formData);
        await logActivity(user.id.toString(), user.name, user.email, 'Update Borrower', `Updated details for ${formData.fullName}`);
      } else {
        await addBorrower({ ...formData, ownerId: user.id.toString() });
        await logActivity(user.id.toString(), user.name, user.email, 'Add Borrower', `Created profile for ${formData.fullName}`);
      }
      setIsModalOpen(false);
      setEditingBorrower(null);
      setFormData({
        fullName: '',
        mobileNumber: '',
        whatsAppNumber: '',
        email: '',
        address: '',
        companyName: '',
        notes: '',
        status: 'Active'
      });
    } catch (err) {
      console.error('Error saving borrower:', err);
    }
  };

  // Populate data for editing
  const editBorrower = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setFormData({
      fullName: borrower.fullName,
      mobileNumber: borrower.mobileNumber || '',
      whatsAppNumber: borrower.whatsAppNumber || '',
      email: borrower.email || '',
      address: borrower.address || '',
      companyName: borrower.companyName || '',
      notes: borrower.notes || '',
      status: borrower.status
    });
    setIsModalOpen(true);
  };

  // Open delete modal
  const handleDeleteClick = (e: React.MouseEvent, borrower: Borrower) => {
    e.stopPropagation(); // prevent opening sidebar drawer details
    setBorrowerToDelete(borrower);
    setDeleteModalOpen(true);
  };

  // Execute delete operation
  const handleDeleteConfirm = async () => {
    if (!borrowerToDelete || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteBorrower(borrowerToDelete.id);
      await logActivity(user.id.toString(), user.name, user.email, 'Delete Borrower', `Deleted borrower profile: ${borrowerToDelete.fullName}`);
      
      if (selectedBorrowerId === borrowerToDelete.id) {
        setSelectedBorrowerId(null);
      }
      
      setDeleteModalOpen(false);
      setBorrowerToDelete(null);
    } catch (err) {
      console.error('Error deleting borrower:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Clean WhatsApp phone number for linking
  const cleanPhoneForWhatsApp = (num?: string) => {
    if (!num) return '';
    return num.replace(/[^0-9]/g, '');
  };

  // Highlight and filter lists
  const filteredAndSortedBorrowers = useMemo(() => {
    return borrowers
      .filter((b) => {
        const stats = borrowerStats[b.id] || { outstanding: 0, overdueCount: 0 };
        
        // Search filter
        const matchSearch = 
          b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (b.mobileNumber && b.mobileNumber.includes(searchTerm)) ||
          (b.companyName && b.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (b.email && b.email.toLowerCase().includes(searchTerm.toLowerCase()));

        // Active/Inactive filter
        const matchStatus = statusFilter === 'All' || b.status === statusFilter;

        // Debt details filter
        let matchDebt = true;
        if (debtFilter === 'WithOutstanding') {
          matchDebt = stats.outstanding > 1;
        } else if (debtFilter === 'NoOutstanding') {
          matchDebt = stats.outstanding <= 1;
        } else if (debtFilter === 'Overdue') {
          matchDebt = stats.overdueCount > 0;
        }

        return matchSearch && matchStatus && matchDebt;
      })
      .sort((a, b) => {
        const statsA = borrowerStats[a.id] || { outstanding: 0, loansCount: 0 };
        const statsB = borrowerStats[b.id] || { outstanding: 0, loansCount: 0 };

        if (sortBy === 'name') {
          return a.fullName.localeCompare(b.fullName);
        } else if (sortBy === 'outstandingDesc') {
          return statsB.outstanding - statsA.outstanding;
        } else if (sortBy === 'outstandingAsc') {
          return statsA.outstanding - statsB.outstanding;
        } else if (sortBy === 'loansCount') {
          return statsB.loansCount - statsA.loansCount;
        }
        return 0;
      });
  }, [borrowers, borrowerStats, searchTerm, statusFilter, debtFilter, sortBy]);

  // Retrieve current active borrower selection details
  const selectedBorrower = useMemo(() => {
    if (!selectedBorrowerId) return null;
    return borrowers.find((b) => b.id === selectedBorrowerId) || null;
  }, [selectedBorrowerId, borrowers]);

  // Current active borrower loans
  const selectedBorrowerLoans = useMemo(() => {
    if (!selectedBorrower) return [];
    return loans.filter(
      (l) => l.borrowerId === selectedBorrower.id || l.borrowerName.toLowerCase() === selectedBorrower.fullName.toLowerCase()
    ).sort((a, b) => b.givenDate.localeCompare(a.givenDate));
  }, [selectedBorrower, loans]);

  // Current active borrower repayments
  const selectedBorrowerRepayments = useMemo(() => {
    if (!selectedBorrower || selectedBorrowerLoans.length === 0) return [];
    const loanIds = selectedBorrowerLoans.map(l => l.id);
    return repayments.filter(
      (r) => loanIds.includes(r.loanId) && !r.deleted_at
    ).sort((a, b) => b.repaymentDate.localeCompare(a.repaymentDate));
  }, [selectedBorrower, selectedBorrowerLoans, repayments]);

  // Dynamic avatar initial helper
  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-zinc-900 dark:text-zinc-50">
            <Users className="text-indigo-600 dark:text-indigo-400" size={26} /> 
            Borrowers Ledger
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Manage debtors, monitor outstanding loan repayments, and review transaction lines.
          </p>
        </div>
        <button 
          onClick={() => { 
            setEditingBorrower(null); 
            setFormData({
              fullName: '',
              mobileNumber: '',
              whatsAppNumber: '',
              email: '',
              address: '',
              companyName: '',
              notes: '',
              status: 'Active'
            });
            setIsModalOpen(true); 
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl transition-all shadow-md font-semibold text-sm"
          id="add-borrower-btn"
        >
          <Plus size={18} /> Add New Borrower
        </button>
      </div>

      {/* KPI Stats widgets (Bento Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ledger Borrowers */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase block">Total Borrowers</span>
            <span className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">{globalStats.totalBorrowersCount}</span>
            <div className="text-[10px] text-zinc-400 flex gap-2">
              <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                <UserCheck size={11} /> {borrowers.filter(b => b.status === "Active").length} Active
              </span>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-zinc-500">
                <UserX size={11} /> {borrowers.filter(b => b.status === "Inactive").length} Inactive
              </span>
            </div>
          </div>
          <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users size={22} />
          </div>
        </div>

        {/* Total Debtors (With non-zero balances) */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase block">Active Debtors</span>
            <span className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">{globalStats.activeDebtorsCount}</span>
            <span className="text-[10px] text-zinc-500 block font-medium">
              {(globalStats.totalBorrowersCount > 0 ? (globalStats.activeDebtorsCount / globalStats.totalBorrowersCount * 100).toFixed(0) : 0)}% of total profiles have due balance
            </span>
          </div>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
            <Activity size={22} />
          </div>
        </div>

        {/* Global Net Outstanding Balance */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase block">Total Outstanding</span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(globalStats.totalOutstanding, currency, lang)}
            </span>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
              <span className="flex items-center text-rose-500 gap-0.5">
                <AlertTriangle size={11} /> {globalStats.totalOverdueLoans} Overdue Loans
              </span>
            </div>
          </div>
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl">
            <TrendingDown size={22} />
          </div>
        </div>

        {/* Total Recovered / Payments */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase block">Total Cash Recovered</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-sans">
              {formatCurrency(globalStats.totalRepaid, currency, lang)}
            </span>
            <span className="text-[10px] text-zinc-500 block">
              Given {formatCurrency(globalStats.totalBorrowed, currency, lang)} in total loans
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Advanced search, sort & filter bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search input field */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-3.5 text-zinc-400 dark:text-zinc-500" size={16} />
          <input 
            type="text"
            placeholder="Search by name, number, company..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-zinc-100 transition-all placeholder-zinc-400 dark:placeholder-zinc-650"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Interactive Filters Grid */}
        <div className="w-full flex-wrap sm:flex items-center justify-end gap-3 self-stretch sm:self-auto">
          {/* Active Status filter */}
          <div className="flex items-center gap-1.5 min-w-[120px] mb-2 sm:mb-0">
            <UserCheck className="text-zinc-400 shrink-0" size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-zinc-700 dark:text-zinc-300"
            >
              <option value="All">All Profiles</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          {/* Outstanding Balance filter */}
          <div className="flex items-center gap-1.5 min-w-[150px] mb-2 sm:mb-0">
            <Coins className="text-zinc-400 shrink-0" size={14} />
            <select
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value as any)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-zinc-700 dark:text-zinc-300"
            >
              <option value="All">All Financial Status</option>
              <option value="WithOutstanding">Has Outstanding Balance</option>
              <option value="NoOutstanding">Cleared / Zero Balance</option>
              <option value="Overdue">Overdue Loans Active</option>
            </select>
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-1.5 min-w-[140px] mb-2 sm:mb-0">
            <Filter className="text-zinc-400 shrink-0" size={14} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-zinc-700 dark:text-zinc-300"
            >
              <option value="name">Sort by Name (A-Z)</option>
              <option value="outstandingDesc">Highest Outstanding</option>
              <option value="outstandingAsc">Lowest Outstanding</option>
              <option value="loansCount">Most Loans Issued</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(searchTerm || statusFilter !== 'All' || debtFilter !== 'All' || sortBy !== 'name') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setDebtFilter('All');
                setSortBy('name');
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-80 flex items-center gap-1 border border-indigo-200 dark:border-indigo-900 px-3 py-2 rounded-xl active:scale-95 transition-all text-center justify-center bg-indigo-50/40 dark:bg-indigo-950/20"
            >
              <RefreshCw size={12} /> Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout with optional details slideover or empty state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-zinc-500">Loading Borrowers list...</span>
        </div>
      ) : filteredAndSortedBorrowers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-16 text-center space-y-4 max-w-lg mx-auto shadow-sm">
          <div className="mx-auto w-16 h-16 bg-zinc-50 dark:bg-zinc-950/40 rounded-full flex items-center justify-center border border-zinc-150 dark:border-zinc-800/60">
            <Users className="text-zinc-350 dark:text-zinc-650" size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">No borrowers match your query</h3>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs px-6">
              Create a new profile or expand your search filter configurations.
            </p>
          </div>
          {(searchTerm || statusFilter !== 'All' || debtFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setDebtFilter('All');
              }}
              className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          
          {/* Scrollable table container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 text-xs font-semibold tracking-wider uppercase">
                  <th className="p-4 pl-6">Debtor Profile</th>
                  <th className="p-4">Contact Points</th>
                  <th className="p-4">Company Account</th>
                  <th className="p-4 text-center">Loans Count</th>
                  <th className="p-4 text-right">Outstanding Due</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                {filteredAndSortedBorrowers.map((b) => {
                  const stats = borrowerStats[b.id] || { 
                    totalBorrowed: 0, 
                    totalRepaid: 0, 
                    outstanding: 0, 
                    loansCount: 0, 
                    overdueCount: 0 
                  };
                  return (
                    <tr 
                      key={b.id} 
                      onClick={() => {
                        setSelectedBorrowerId(b.id);
                        setDetailTab('overview');
                      }}
                      className={`group hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-all cursor-pointer ${
                        selectedBorrowerId === b.id ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                      }`}
                    >
                      {/* Name / initials profile card cell */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-400 font-bold text-xs flex items-center justify-center transition-all shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
                            {getInitials(b.fullName)}
                          </div>
                          <div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm">
                              {b.fullName}
                            </span>
                            {stats.overdueCount > 0 && (
                              <span className="text-[10px] text-rose-500 font-bold flex items-center gap-0.5 mt-0.5">
                                <AlertTriangle size={10} /> Overdue Bills
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact cell */}
                      <td className="p-4">
                        <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {b.mobileNumber && (
                            <span className="flex items-center gap-1.5">
                              <Phone size={12} className="text-zinc-400" />
                              {b.mobileNumber}
                            </span>
                          )}
                          {b.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail size={12} className="text-zinc-400" />
                              {b.email}
                            </span>
                          )}
                          {!b.mobileNumber && !b.email && <span className="text-zinc-350 italic">None Provided</span>}
                        </div>
                      </td>

                      {/* Company Name cell */}
                      <td className="p-4">
                        {b.companyName ? (
                          <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            <Briefcase size={13} className="text-zinc-400" />
                            <span>{b.companyName}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-350 dark:text-zinc-650 italic text-xs">Individual</span>
                        )}
                      </td>

                      {/* Total Loans issued count */}
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                          <Calculator size={11} className="text-zinc-400" />
                          {stats.loansCount}
                        </span>
                      </td>

                      {/* Net outstanding due */}
                      <td className="p-4 text-right font-semibold text-sm">
                        {stats.outstanding > 1 ? (
                          <span className="text-rose-500 dark:text-rose-400 block font-sans font-bold">
                            {formatCurrency(stats.outstanding, currency, lang)}
                          </span>
                        ) : (
                          <span className="text-emerald-500 block font-semibold text-xs flex items-center justify-end gap-0.5">
                            <CheckCircle2 size={12} /> Cleared
                          </span>
                        )}
                        {stats.totalBorrowed > 0 && stats.outstanding > 0 && (
                          <span className="text-[10px] text-zinc-400 block">
                            Borrowed {formatCurrency(stats.totalBorrowed, currency, lang)}
                          </span>
                        )}
                      </td>

                      {/* Active status badging */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                          b.status === 'Active' 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                          {b.status}
                        </span>
                      </td>

                      {/* Actions toolbar */}
                      <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end">
                          <button 
                            onClick={() => {
                              setSelectedBorrowerId(b.id);
                              setDetailTab('overview');
                            }} 
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="View Account Details"
                          >
                            <Info size={16} />
                          </button>
                          <button 
                            onClick={() => editBorrower(b)} 
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
                            title="Edit Borrower Profile"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteClick(e, b)} 
                            className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors" 
                            title="Delete Borrower"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight className="text-zinc-350 self-center hidden group-hover:block transition-all pl-1" size={14} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Table Footer total profiles row info */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950/30 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 flex justify-between items-center font-medium">
            <span>Showing {filteredAndSortedBorrowers.length} profiles of {borrowers.length} total</span>
            <span className="flex items-center gap-1">
              <Sparkles className="text-indigo-500" size={11} /> 
              Click on any row to explore historical ledger transactions & outstanding lists
            </span>
          </div>

        </div>
      )}

      {/* Slide-over Profile Drawer (Modern Right Sidebar details) */}
      <AnimatePresence>
        {selectedBorrowerId && selectedBorrower && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-45 flex justify-end"
            id="borrower-drawer-overlay"
            onClick={() => setSelectedBorrowerId(null)}
          >
            {/* Sheet Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full shadow-2xl overflow-y-auto z-50 flex flex-col"
              id="borrower-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Sticky Header */}
              <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex justify-between items-start sticky top-0 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shadow-sm border border-indigo-200/50 dark:border-indigo-900/40">
                    {getInitials(selectedBorrower.fullName)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{selectedBorrower.fullName}</h2>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      selectedBorrower.status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedBorrower.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                      {selectedBorrower.status} Account Profile
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => editBorrower(selectedBorrower)} 
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
                    title="Edit Profiling"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setSelectedBorrowerId(null)}
                    className="p-2 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-xl text-zinc-550 dark:text-zinc-400 hover:text-zinc-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Statistical Snapshot Widgets */}
              {(() => {
                const bStats = borrowerStats[selectedBorrower.id] || { totalBorrowed: 0, totalRepaid: 0, outstanding: 0 };
                return (
                  <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/10 grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/80 rounded-xl shadow-xs">
                      <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase block">Borrowed</span>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5">
                        {formatCurrency(bStats.totalBorrowed, currency, lang)}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/80 rounded-xl shadow-xs">
                      <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase block">Repaid</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        {formatCurrency(bStats.totalRepaid, currency, lang)}
                      </span>
                    </div>

                    <div className="p-3 bg-rose-50/35 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl shadow-xs">
                      <span className="text-[10px] text-rose-500/80 dark:text-rose-400/80 font-bold tracking-wider uppercase block">Outstanding</span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 block mt-0.5">
                        {formatCurrency(bStats.outstanding, currency, lang)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Tabs selector */}
              <div className="border-b border-zinc-150 dark:border-zinc-800 flex bg-white dark:bg-zinc-950 px-6 gap-6 sticky top-[92px] z-10">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`py-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    detailTab === 'overview' 
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                  }`}
                >
                  <Users size={14} /> Profile & Info
                </button>
                <button
                  onClick={() => setDetailTab('loans')}
                  className={`py-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    detailTab === 'loans' 
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                  }`}
                >
                  <Coins size={14} /> Loan Books ({selectedBorrowerLoans.length})
                </button>
                <button
                  onClick={() => setDetailTab('repayments')}
                  className={`py-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    detailTab === 'repayments' 
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
                  }`}
                >
                  <ArrowUpRight size={14} /> Repayment Bills ({selectedBorrowerRepayments.length})
                </button>
              </div>

              {/* Tab Screen Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {detailTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Compact address details, phone, buttons */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/65 dark:border-zinc-800/80 p-5 rounded-2xl space-y-4 shadow-xs">
                      <h4 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1 mb-1">
                        <UserCheck size={12} /> Personal Contact Registry
                      </h4>

                      <div className="grid grid-cols-1 gap-3.5 text-sm">
                        {/* Company Detail line */}
                        <div className="flex items-start gap-3">
                          <Briefcase className="text-zinc-400 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-[10px] text-zinc-400 block font-medium">Company Account</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-300">
                              {selectedBorrower.companyName || 'Not Listed / Individual'}
                            </span>
                          </div>
                        </div>

                        {/* Mobile connection */}
                        <div className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3">
                            <Phone className="text-zinc-400 shrink-0 mt-0.5" size={16} />
                            <div>
                              <span className="text-[10px] text-zinc-400 block font-medium">Mobile Number</span>
                              <span className="font-mono text-zinc-800 dark:text-zinc-300">
                                {selectedBorrower.mobileNumber || 'Not Specified'}
                              </span>
                            </div>
                          </div>
                          {selectedBorrower.mobileNumber && (
                            <a 
                              href={`tel:${selectedBorrower.mobileNumber}`}
                              className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all self-center"
                            >
                              Call <Phone size={11} />
                            </a>
                          )}
                        </div>

                        {/* WhatsApp Connection line */}
                        <div className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3">
                            <MessageSquare className="text-zinc-400 shrink-0 mt-0.5" size={16} />
                            <div>
                              <span className="text-[10px] text-zinc-400 block font-medium">WhatsApp Account</span>
                              <span className="font-mono text-zinc-800 dark:text-zinc-300">
                                {selectedBorrower.whatsAppNumber || 'Not Specified'}
                              </span>
                            </div>
                          </div>
                          {selectedBorrower.whatsAppNumber && (
                            <a 
                              href={`https://wa.me/${cleanPhoneForWhatsApp(selectedBorrower.whatsAppNumber)}?text=Hello%20${encodeURIComponent(selectedBorrower.fullName)},%20this%20is%20regarding%20your%20loan%25accounts%20statements...`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all self-center"
                            >
                              Chat <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        {/* Email box */}
                        <div className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3">
                            <Mail className="text-zinc-400 shrink-0 mt-0.5" size={16} />
                            <div>
                              <span className="text-[10px] text-zinc-400 block font-medium">Email Address</span>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-300 text-xs break-all">
                                {selectedBorrower.email || 'Not Specified'}
                              </span>
                            </div>
                          </div>
                          {selectedBorrower.email && (
                            <a 
                              href={`mailto:${selectedBorrower.email}`}
                              className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all self-center"
                            >
                              Mail <Mail size={11} />
                            </a>
                          )}
                        </div>

                        {/* Physical Address line */}
                        <div className="flex items-start gap-3">
                          <MapPin className="text-zinc-400 shrink-0 mt-0.5" size={16} />
                          <div className="flex-1">
                            <span className="text-[10px] text-zinc-400 block font-medium">Verified Address</span>
                            <span className="text-zinc-800 dark:text-zinc-300 text-xs leading-relaxed block">
                              {selectedBorrower.address || 'No registered address.'}
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Specific notes panel */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                        <FileText size={12} /> Internal Portfolio Notes
                      </h4>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl leading-relaxed text-zinc-650 dark:text-zinc-330 text-sm whitespace-pre-line min-h-[100px]">
                        {selectedBorrower.notes || 'No notes specified yet for this borrower portfolio.'}
                      </div>
                    </div>

                    {/* Meta creation details */}
                    <div className="text-[10px] text-zinc-400 flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800/80 pt-4 font-medium">
                      <span>Borrower ID: {selectedBorrower.id}</span>
                      <span>Category: Finance Ledger Profile</span>
                    </div>
                  </div>
                )}

                {detailTab === 'loans' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
                        <Coins size={12} /> Registered Loans
                      </h4>
                      <span className="text-[11px] bg-indigo-55 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">
                        Total {selectedBorrowerLoans.length} Loans
                      </span>
                    </div>

                    {selectedBorrowerLoans.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-950/10">
                        <Coins className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={24} />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">No loans issued to this borrower account.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedBorrowerLoans.map((loan) => {
                          // repays for this specific loan
                          const loanRepayments = repayments.filter(r => r.loanId === loan.id && !r.deleted_at);
                          const totalRepaidForLoan = loanRepayments.reduce((sum, r) => sum + r.repaymentAmount, 0);
                          const outstandingForLoan = Math.max(0, loan.amount - totalRepaidForLoan);
                          const today = new Date().toISOString().split('T')[0];
                          const isOverdue = outstandingForLoan > 0 && today > loan.expectedReturnDate && loan.status !== 'Paid';

                          return (
                            <div 
                              key={loan.id} 
                              className={`p-4 bg-white dark:bg-zinc-950 border rounded-2xl shadow-xs transition-all space-y-3 ${
                                isOverdue 
                                  ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/5 dark:bg-rose-950/5' 
                                  : 'border-zinc-150 dark:border-zinc-800'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[10px] text-zinc-400 font-semibold uppercase block">Given Date</span>
                                  <span className="text-xs font-bold text-zinc-805 dark:text-zinc-305 flex items-center gap-1 mt-0.5">
                                    <Calendar size={11} className="text-zinc-400" />
                                    {loan.givenDate}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-zinc-500 block">Status badge</span>
                                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold mt-1.5 ${
                                    loan.status === 'Paid' || outstandingForLoan <= 0
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' 
                                      : isOverdue 
                                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 animate-pulse'
                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                                  }`}>
                                    {loan.status === 'Paid' || outstandingForLoan <= 0 ? 'Fully Paid' : isOverdue ? 'Overdue Due' : loan.status}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 border-t border-b border-zinc-100 dark:border-zinc-800/80 py-2.5 text-xs">
                                <div>
                                  <span className="text-[10px] text-zinc-450 block">Amount Granted:</span>
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(loan.amount, currency, lang)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-zinc-450 block">Outstanding:</span>
                                  <span className={`font-bold ${outstandingForLoan > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {formatCurrency(outstandingForLoan, currency, lang)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[11px] text-zinc-400 pt-0.5 font-medium">
                                <span className="flex items-center gap-1">
                                  <Clock size={11} className="text-zinc-350" />
                                  Expected Due: {loan.expectedReturnDate}
                                </span>
                                {loan.notes && (
                                  <span className="italic max-w-[200px] truncate text-right shrink-0" title={loan.notes}>
                                    "{loan.notes}"
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'repayments' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
                        <ArrowUpRight size={12} /> Repayment Transaction Lines
                      </h4>
                      <span className="text-[11px] bg-emerald-55 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">
                        Total {selectedBorrowerRepayments.length} Repayments
                      </span>
                    </div>

                    {selectedBorrowerRepayments.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/20 dark:bg-zinc-950/10">
                        <ArrowUpRight className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={24} />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium font-sans">No repayment entries found.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedBorrowerRepayments.map((rep) => (
                          <div 
                            key={rep.id} 
                            className="p-3.5 bg-zinc-50/50 dark:bg-zinc-950 p-4 border border-zinc-150 dark:border-zinc-800 rounded-xl shadow-xs flex justify-between items-center text-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
                                <ArrowUpRight size={13} />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                  Repayment Received
                                </span>
                                {rep.note && <span className="block text-[10px] text-zinc-400 max-w-[180px] break-words">"{rep.note}"</span>}
                                <span className="block text-[9px] text-zinc-400 font-medium">Ref Loan ID: {rep.loanId.substring(0, 8)}...</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-sans font-extrabold text-emerald-600 dark:text-emerald-400 text-sm block">
                                +{formatCurrency(rep.repaymentAmount, currency, lang)}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-medium flex items-center justify-end gap-1 mt-0.5">
                                <Calendar size={10} />
                                {rep.repaymentDate}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Add/Edit Modal overlay (Consistent with general styles) */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            id="borrower-edit-modal-backdrop"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
              id="borrower-edit-modal"
            >
              <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800 pb-3 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-950 dark:text-zinc-50">
                  <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                  {editingBorrower ? 'Edit Profile' : 'Add New Borrower'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-all text-sm shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Full name field */}
                <div className="space-y-1">
                  <label className="text-zinc-550 dark:text-zinc-400 font-bold block">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    required 
                    placeholder="Enter borrower full name" 
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm font-semibold dark:text-zinc-100 placeholder-zinc-400" 
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  />
                </div>

                {/* Company Name field */}
                <div className="space-y-1">
                  <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Company Name (Optional)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-zinc-400" size={13} />
                    <input 
                      placeholder="E.g. Acme Corp" 
                      className="w-full p-2.5 pl-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm font-semibold dark:text-zinc-100 placeholder-zinc-400" 
                      value={formData.companyName} 
                      onChange={e => setFormData({...formData, companyName: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Contact numbers grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Mobile Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={13} />
                      <input 
                        placeholder="+1 (555) 000-0000" 
                        className="w-full p-2.5 pl-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 font-mono text-xs dark:text-zinc-100 placeholder-zinc-400" 
                        value={formData.mobileNumber} 
                        onChange={e => setFormData({...formData, mobileNumber: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-550 dark:text-zinc-400 font-bold block">WhatsApp Number</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 text-zinc-400" size={13} />
                      <input 
                        placeholder="+15550000000" 
                        className="w-full p-2.5 pl-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 font-mono text-xs dark:text-zinc-100 placeholder-zinc-400" 
                        value={formData.whatsAppNumber} 
                        onChange={e => setFormData({...formData, whatsAppNumber: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address field */}
                <div className="space-y-1">
                  <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-zinc-400" size={13} />
                    <input 
                      type="email" 
                      placeholder="debtor@example.com" 
                      className="w-full p-2.5 pl-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-xs dark:text-zinc-100 placeholder-zinc-400" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Physical address input */}
                <div className="space-y-1">
                  <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-zinc-400" size={13} />
                    <input 
                      placeholder="123 Financial Row, suite 4" 
                      className="w-full p-2.5 pl-9 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-xs dark:text-zinc-100 placeholder-zinc-400" 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Notes and Status row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Profile Status</label>
                    <select 
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-xs dark:text-zinc-100 font-medium" 
                      value={formData.status} 
                      onChange={e => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                    >
                      <option value="Active">Active Ledger Profile</option>
                      <option value="Inactive">Inactive Ledger Profile</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-550 dark:text-zinc-400 font-bold block">Quick Reference notes</label>
                    <input 
                      placeholder="E.g. VIP client, check returns..." 
                      className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-xs dark:text-zinc-100 placeholder-zinc-400" 
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Actions buttons */}
                <div className="flex gap-3 pt-3 mt-1 text-sm font-semibold">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl active:scale-95 transition-all text-center justify-center flex items-center"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 transition-all text-center justify-center flex items-center shadow-md shadow-indigo-600/15"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reusable Delete Confirmation Box */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Borrower Portfolio"
        message="Are you sure you want to delete this borrower? All historical aggregate reference views for this profile will be cleared from this screen. This action cannot be reverted."
        itemName={borrowerToDelete ? `Borrower: ${borrowerToDelete.fullName}` : undefined}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
