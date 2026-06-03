import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToClients,
  subscribeToQuotations,
  subscribeToAllQuotationItems,
  addQuotation,
  updateQuotation,
  deleteQuotation,
  addProject,
  addReceivable,
  addLedgerEntry
} from '../services/firestoreService';
import { Client, Quotation, QuotationItem } from '../types';
import {
  FileText,
  FileCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Printer,
  ChevronRight,
  X,
  RefreshCw,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/i18n';

export default function Quotations() {
  const { user } = useAuth();
  const userId = user?.id?.toString() || '';
  const currency = user?.currency || 'USD';
  const lang = user?.language || 'en';

  // State arrays from Firestore
  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [allQuotationItems, setAllQuotationItems] = useState<QuotationItem[]>([]);

  // UI flow and select/filter states
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [selectedQuotationForPrint, setSelectedQuotationForPrint] = useState<Quotation | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Form states
  const [clientId, setClientId] = useState('');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntilDate, setValidUntilDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<Quotation['status']>('Draft');

  // Dynamic lineup items
  const [lineItems, setLineItems] = useState<Omit<QuotationItem, 'id' | 'ownerId' | 'quotationId'>[]>([
    { itemName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
  ]);

  // Subscriptions setup
  useEffect(() => {
    if (!userId) return;

    const unsubClients = subscribeToClients(userId, setClients);
    const unsubQuotations = subscribeToQuotations(userId, setQuotations);
    const unsubItems = subscribeToAllQuotationItems(userId, setAllQuotationItems);

    return () => {
      unsubClients();
      unsubQuotations();
      unsubItems();
    };
  }, [userId]);

  // Keep a unique autoincrement counter for sequence prefix
  useEffect(() => {
    if (!editingQuotation && isQuotationModalOpen) {
      const year = new Date().getFullYear();
      const count = quotations.length + 1;
      const autoNum = `QT-${year}-${String(count).padStart(3, '0')}`;
      setQuotationNumber(autoNum);
    }
  }, [isQuotationModalOpen, editingQuotation, quotations.length]);

  // Modal open handlers
  const openCreateModal = () => {
    setEditingQuotation(null);
    setClientId('');
    setProjectName('');
    setDescription('');
    setQuotationDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntilDate(d.toISOString().split('T')[0]);
    setStatus('Draft');
    setLineItems([
      { itemName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
    ]);
    setIsQuotationModalOpen(true);
  };

  const openEditModal = (q: Quotation) => {
    setEditingQuotation(q);
    setClientId(q.clientId);
    setQuotationNumber(q.quotationNumber);
    setProjectName(q.projectName);
    setDescription(q.description);
    setQuotationDate(q.quotationDate);
    setValidUntilDate(q.validUntilDate);
    setStatus(q.status);

    // Get line items matching this quotation ID from allQuotationItems
    const matched = allQuotationItems.filter(item => item.quotationId === q.id);
    if (matched.length > 0) {
      setLineItems(matched.map(m => ({
        itemName: m.itemName,
        description: m.description || '',
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        discount: m.discount,
        tax: m.tax,
        total: m.total
      })));
    } else {
      setLineItems([
        { itemName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
      ]);
    }

    setIsQuotationModalOpen(true);
  };

  // Line item manipulation helpers
  const calculateItemTotal = (qty: number, price: number, discountPercent: number, taxPercent: number) => {
    const subtotal = qty * price;
    const discountAmount = subtotal * (discountPercent / 100);
    const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);
    return Number((subtotal - discountAmount + taxAmount).toFixed(2));
  };

  const handleLineItemChange = (index: number, field: keyof typeof lineItems[0], value: any) => {
    const updated = [...lineItems];
    let val = value;
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount' || field === 'tax') {
      val = Number(value) || 0;
    }
    updated[index] = {
      ...updated[index],
      [field]: val
    };

    // Recalculate total for this item
    const qt = field === 'quantity' ? Number(value) : updated[index].quantity;
    const pr = field === 'unitPrice' ? Number(value) : updated[index].unitPrice;
    const ds = field === 'discount' ? Number(value) : updated[index].discount;
    const tx = field === 'tax' ? Number(value) : updated[index].tax;

    updated[index].total = calculateItemTotal(qt, pr, ds, tx);
    setLineItems(updated);
  };

  const addLineItemRow = () => {
    setLineItems([
      ...lineItems,
      { itemName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
    ]);
  };

  const removeLineItemRow = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Grand total calculations
  const subtotalSum = lineItems.reduce((acc, current) => acc + (current.quantity * current.unitPrice), 0);
  const totalDiscountSum = lineItems.reduce((acc, current) => acc + ((current.quantity * current.unitPrice) * (current.discount / 100)), 0);
  const totalTaxSum = lineItems.reduce((acc, current) => acc + (((current.quantity * current.unitPrice) - ((current.quantity * current.unitPrice) * (current.discount / 100))) * (current.tax / 100)), 0);
  const grandTotalSum = Number((subtotalSum - totalDiscountSum + totalTaxSum).toFixed(2));

  // Handle Form Submission
  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !projectName.trim() || lineItems.some(i => !i.itemName.trim())) {
      alert('Please fill out all required fields and name every row item.');
      return;
    }

    const matchedClient = clients.find(c => c.id === clientId);
    if (!matchedClient) return;

    const payload = {
      ownerId: userId,
      clientId,
      clientName: matchedClient.name,
      quotationNumber: quotationNumber.trim() || `QT-${Date.now()}`,
      status,
      totalAmount: grandTotalSum,
      quotationDate,
      validUntilDate,
      projectName: projectName.trim(),
      description: description.trim()
    };

    if (editingQuotation) {
      // Check if it is being set to accepted brand new to trigger Client Ledger
      const previouslyAccepted = editingQuotation.status === 'Accepted';
      const newlyAccepted = status === 'Accepted' && !previouslyAccepted;

      await updateQuotation(editingQuotation.id, payload, lineItems);

      if (newlyAccepted) {
        await logAcceptedToLedger({
          ...payload,
          id: editingQuotation.id
        } as Quotation);
      }
    } else {
      const isAccepted = status === 'Accepted';
      const qId = await addQuotation(payload, lineItems);
      
      if (isAccepted && qId) {
        await logAcceptedToLedger({
          ...payload,
          id: qId
        } as Quotation);
      }
    }

    setIsQuotationModalOpen(false);
  };

  const logAcceptedToLedger = async (q: Quotation) => {
    await addLedgerEntry({
      userId,
      clientId: q.clientId,
      clientName: q.clientName,
      date: new Date().toISOString().split('T')[0],
      type: 'Project Charge',
      description: `Quotation Accepted: #${q.quotationNumber} - ${q.projectName}`,
      debit: q.totalAmount,
      credit: 0,
      runningBalance: 0
    });
    // Record that this has been successfully logged to ledger in Quotation metadata
    await updateQuotation(q.id, { loggedToLedger: true });
  };

  const handleUpdateStatus = async (q: Quotation, nextStatus: Quotation['status']) => {
    const prevStatus = q.status;
    await updateQuotation(q.id, { status: nextStatus });
    if (nextStatus === 'Accepted' && prevStatus !== 'Accepted') {
      await logAcceptedToLedger(q);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quotation and its matching items?')) {
      await deleteQuotation(id);
    }
  };

  // Convert Quotation to active client Project
  const convertToProject = async (q: Quotation) => {
    try {
      await addProject({
        userId,
        clientId: q.clientId,
        clientName: q.clientName,
        projectName: q.projectName,
        totalAmount: q.totalAmount,
        advanceAmount: 0,
        dueAmount: q.totalAmount,
        deliveryDate: q.validUntilDate || new Date().toISOString().split('T')[0],
        status: 'Not Started',
        notes: `Converted from Quotation #${q.quotationNumber}. ${q.description}`
      });
      alert(`Newly created software Project launched for quotation ${q.quotationNumber}!`);
    } catch (e) {
      console.error(e);
      alert('Error creating Project');
    }
  };

  // Convert Quotation to payment Receivable invoice
  const convertToReceivable = async (q: Quotation) => {
    try {
      await addReceivable({
        userId,
        clientId: q.clientId,
        clientName: q.clientName,
        amount: q.totalAmount,
        invoiceNumber: q.quotationNumber,
        dueDate: q.validUntilDate,
        description: `Receivable created from Quotation #${q.quotationNumber} - ${q.projectName}`,
        status: 'Pending',
        amountPaid: 0
      });
      alert(`Outstanding due invoice record created from quotation ${q.quotationNumber}!`);
    } catch (e) {
      console.error(e);
      alert('Error creating Receivable');
    }
  };

  // WhatsApp reminder
  const sendWhatsAppQuotation = async (q: Quotation) => {
    const matchedClient = clients.find(c => c.id === q.clientId);
    const phoneNumber = matchedClient?.whatsAppNumber || matchedClient?.mobileNumber || '';
    const rawNumber = phoneNumber.replace(/[^0-9]/g, '');

    // Original quotation view link
    const originalLink = `${window.location.origin}/?q=${q.id}`;
    let shortLink = originalLink;

    try {
      // Fetch shortened url from TinyURL free public plain text API
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(originalLink)}`);
      if (response.ok) {
        const text = await response.text();
        if (text && text.startsWith('http')) {
          shortLink = text;
        }
      }
    } catch (err) {
      console.warn('TinyURL shortening failed, falling back to original link:', err);
    }

    const message = `Hello ${q.clientName},\n\nYour quotation #${q.quotationNumber} is ready.\n\nQuotation Amount: ৳${q.totalAmount}\n\nPlease review and confirm:\n${shortLink}\n\nThank you.`;
    const url = `https://api.whatsapp.com/send?phone=${rawNumber}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Widgets calculations
  const totalCount = quotations.length;
  const acceptedCount = quotations.filter(q => q.status === 'Accepted').length;
  const pendingCount = quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length;
  const conversionRate = totalCount > 0 ? ((acceptedCount / totalCount) * 100).toFixed(1) : '0';

  // Apply filters on lists
  const filteredQuotations = quotations.filter(q => {
    // Search Term matches number, client, project, description
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || 
      q.quotationNumber.toLowerCase().includes(term) ||
      q.clientName.toLowerCase().includes(term) ||
      q.projectName.toLowerCase().includes(term) ||
      q.description.toLowerCase().includes(term);

    // Client Filter
    const matchesClient = clientFilter === 'ALL' || q.clientId === clientFilter;

    // Status Filter
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;

    // Dates
    const qDate = new Date(q.quotationDate);
    const matchesStart = !startDateFilter || qDate >= new Date(startDateFilter);
    const matchesEnd = !endDateFilter || qDate <= new Date(endDateFilter);

    // Amounts
    const matchesMinAmount = !minAmountFilter || q.totalAmount >= Number(minAmountFilter);
    const matchesMaxAmount = !maxAmountFilter || q.totalAmount <= Number(maxAmountFilter);

    return matchesSearch && matchesClient && matchesStatus && matchesStart && matchesEnd && matchesMinAmount && matchesMaxAmount;
  });

  const renderCurrency = (amount: number) => {
    return formatCurrency(amount, currency, lang);
  };

  return (
    <div className="space-y-6">
      {/* Module Title / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans text-zinc-900 dark:text-zinc-50">
            Quotation Management
          </h1>
        </div>

        <div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white rounded-xl px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {/* Awaiting Ledger Log Banner */}
      {quotations.some(q => q.status === 'Accepted' && !q.loggedToLedger) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-905 dark:text-amber-400">Ledger Entry Required</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Some quotations have been accepted by clients (e.g. via direct links), but their project charge hasn't been logged to the Client Ledger yet.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const pendingLogs = quotations.filter(q => q.status === 'Accepted' && !q.loggedToLedger);
              if (window.confirm(`Log Project Charges for all ${pendingLogs.length} newly accepted quotations now?`)) {
                for (const q of pendingLogs) {
                  await logAcceptedToLedger(q);
                }
                alert('Project charges logged successfully!');
              }
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm self-start sm:self-auto shrink-0"
          >
            Auto-Log All ({quotations.filter(q => q.status === 'Accepted' && !q.loggedToLedger).length})
          </button>
        </div>
      )}

      {/* Grid Dashboard Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-450 uppercase tracking-widest">Total Proposals</p>
            <h3 className="text-3xl font-black mt-2 tracking-tight">{totalCount}</h3>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-zinc-500">
            <span>Overall quote pipelines</span>
          </div>
        </div>

        {/* Accepted Quotations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-550 dark:text-emerald-400 uppercase tracking-widest">Accepted Offers</p>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-450 mt-2 tracking-tight">{acceptedCount}</h3>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-emerald-650 dark:text-emerald-400">
            <span>Signed client integrations</span>
          </div>
        </div>

        {/* Pending Proposals */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-amber-555 dark:text-amber-400 uppercase tracking-widest">Draft / Sent</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2 tracking-tight">{pendingCount}</h3>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-amber-650 dark:text-amber-400">
            <span>Awaiting client consensus</span>
          </div>
        </div>

        {/* Quotation Conversion Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-550 dark:text-indigo-400 uppercase tracking-widest">Conversion Rate</p>
            <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2 tracking-tight">{conversionRate}%</h3>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-indigo-650 dark:text-indigo-400">
            <span>Proposals win percentage</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search quotation ID, client name, service details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-medium text-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer select-none transition-colors ${
                showFilters 
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-350 dark:border-zinc-600' 
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850'
              }`}
            >
              <Filter size={14} /> Filters
            </button>
            
            {(clientFilter !== 'ALL' || statusFilter !== 'ALL' || startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter) && (
              <button
                onClick={() => {
                  setClientFilter('ALL');
                  setStatusFilter('ALL');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setMinAmountFilter('');
                  setMaxAmountFilter('');
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-900/30 px-3 py-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Expanded Filters Drawer */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800 pt-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium">
                {/* Client Select */}
                <div className="flex flex-col gap-1.5">
                  <label>Client</label>
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="ALL">All Clients</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Select */}
                <div className="flex flex-col gap-1.5">
                  <label>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>

                {/* Date range */}
                <div className="flex flex-col gap-1.5">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>

                {/* Amount ranges */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label>Amount Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min ৳"
                      value={minAmountFilter}
                      onChange={(e) => setMinAmountFilter(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                    />
                    <span className="text-zinc-400">to</span>
                    <input
                      type="number"
                      placeholder="Max ৳"
                      value={maxAmountFilter}
                      onChange={(e) => setMaxAmountFilter(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Table List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-550 text-[10px] font-bold uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-6 py-4">Quotation No. / Date</th>
                <th className="px-6 py-4">Client Name</th>
                <th className="px-6 py-4">Project / Service Name</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Share / Convert</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400 text-xs">
                    No quotations found matching your filter criteria. Let's create one!
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  const itemsCount = allQuotationItems.filter(item => item.quotationId === q.id).length;
                  return (
                    <tr 
                      key={q.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/30 transition-colors"
                    >
                      <td className="px-6 py-4.5">
                        <div className="font-bold flex items-center gap-1.5 text-zinc-950 dark:text-white">
                          <FileText size={14} className="text-zinc-400" />
                          {q.quotationNumber}
                        </div>
                        <div className="text-[10px] font-medium text-zinc-500 mt-1 flex items-center gap-1.5">
                          <Calendar size={10} /> Date: {q.quotationDate}
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-200">{q.clientName}</div>
                      </td>
                      <td className="px-6 py-4.5 max-w-[200px] truncate">
                        <div className="truncate font-semibold">{q.projectName}</div>
                        <div className="text-[10px] font-medium text-zinc-500 mt-0.5 max-w-[200px] truncate">
                          {q.description || `${itemsCount} line items`}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-right font-mono font-bold text-base text-zinc-950 dark:text-white">
                        {renderCurrency(q.totalAmount)}
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                            q.status === 'Accepted'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : q.status === 'Sent'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                              : q.status === 'Draft'
                              ? 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-350'
                              : q.status === 'Expired'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450'
                          }`}>
                            {q.status}
                          </span>
                          {q.status === 'Accepted' && !q.loggedToLedger && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded shadow-sm">
                              Unlogged Ledger
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* WhatsApp Button */}
                          <button
                            onClick={() => sendWhatsAppQuotation(q)}
                            className="p-2 text-zinc-650 hover:text-emerald-550 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all"
                            title="Send status via WhatsApp"
                          >
                            <Send size={15} />
                          </button>

                          {/* Print view */}
                          <button
                            onClick={() => setSelectedQuotationForPrint(q)}
                            className="p-2 text-zinc-650 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-all"
                            title="Generate PDF / Print"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Convert actions if Approved */}
                          {q.status === 'Accepted' && (
                            <div className="flex gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2">
                              {/* Create Project */}
                              <button
                                onClick={() => convertToProject(q)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-[10px] font-extrabold tracking-wider uppercase text-white dark:bg-zinc-100 dark:text-zinc-900 dark:border-white rounded-lg transition-all shadow-sm"
                                title="Convert To Project"
                              >
                                Project
                              </button>
                              {/* Create Receivable */}
                              <button
                                onClick={() => convertToReceivable(q)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-extrabold tracking-wider uppercase text-white rounded-lg transition-all shadow-sm"
                                title="Create Due Record"
                              >
                                Invoice
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {q.status === 'Accepted' && !q.loggedToLedger && (
                            <button
                              onClick={() => logAcceptedToLedger(q)}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-[10px] font-extrabold uppercase tracking-widest text-white rounded-lg transition-all shadow-sm cursor-pointer"
                              title="Log Project Charge to Client Ledger"
                            >
                              Log Ledger
                            </button>
                          )}

                          {/* Quick selection status */}
                          <select
                            value={q.status}
                            onChange={(e) => handleUpdateStatus(q, e.target.value as Quotation['status'])}
                            className="bg-zinc-100 dark:bg-zinc-800 border-none outline-none rounded-xl text-xs py-1.5 px-2.5 font-bold cursor-pointer"
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Expired">Expired</option>
                          </select>

                          <button
                            onClick={() => openEditModal(q)}
                            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                            title="Edit Quotation"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-2 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

      {/* RENDER DRAFT/CREATE MODAL FORM */}
      <AnimatePresence>
        {isQuotationModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-extrabold text-zinc-950 dark:text-white">
                  {editingQuotation ? 'Edit Proposal Details' : 'Design Dynamic Quotation'}
                </h3>
                <button
                  onClick={() => setIsQuotationModalOpen(false)}
                  className="p-1 px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content Scrolling wrapper */}
              <form onSubmit={handleSaveQuotation} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Client Select */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Client Selection <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">-- Choose Client --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quotation Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Quotation Number <span className="text-rose-550">(Auto)</span>
                    </label>
                    <input
                      type="text"
                      value={quotationNumber}
                      onChange={(e) => setQuotationNumber(e.target.value)}
                      placeholder="QT-YYYY-001"
                      required
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-bold"
                    />
                  </div>

                  {/* Service status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Quotation['status'])}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-semibold"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>

                  {/* Project Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Project/Service Offered <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="E.g. Fullstack POS SaaS Construction or AWS Maintenance"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                    />
                  </div>

                  {/* Dates */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Quotation Date
                    </label>
                    <input
                      type="date"
                      value={quotationDate}
                      onChange={(e) => setQuotationDate(e.target.value)}
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Details / Background Explanation
                    </label>
                    <input
                      type="text"
                      placeholder="Context notes on software layout, deliverables, tech specifications..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-550 mb-1.5">
                      Valid Until
                    </label>
                    <input
                      type="date"
                      value={validUntilDate}
                      onChange={(e) => setValidUntilDate(e.target.value)}
                      required
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Dynamic lineup items row section */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 space-y-4">
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded-xl">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-450">Itemized pricing items</h4>
                    <button
                      type="button"
                      onClick={addLineItemRow}
                      className="flex items-center gap-1 text-[11px] font-black text-indigo-500 hover:text-indigo-650 cursor-pointer"
                    >
                      <PlusCircle size={14} /> Add Line Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div 
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-zinc-50/50 dark:bg-zinc-850/20 p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50"
                      >
                        {/* Name */}
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Item Title *</label>
                          <input
                            type="text"
                            placeholder="Frontend API structure, AWS Setup, etc."
                            value={item.itemName}
                            onChange={(e) => handleLineItemChange(index, 'itemName', e.target.value)}
                            required
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs outline-none font-semibold"
                          />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Specification</label>
                          <input
                            type="text"
                            placeholder="optional description details"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          />
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-1">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            required
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-center"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Unit Price (৳)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)}
                            required
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none font-bold font-mono text-right"
                          />
                        </div>

                        {/* Discount */}
                        <div className="md:col-span-1">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Disc%</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={item.discount}
                            onChange={(e) => handleLineItemChange(index, 'discount', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-1.5 py-1.5 text-xs outline-none font-semibold text-center"
                          />
                        </div>

                        {/* Tax */}
                        <div className="md:col-span-1">
                          <label className="block text-[10px] uppercase font-bold text-zinc-450 mb-1">Tax%</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={item.tax}
                            onChange={(e) => handleLineItemChange(index, 'tax', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg px-1.5 py-1.5 text-xs outline-none font-semibold text-center"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="md:col-span-1 flex items-center justify-between gap-1 mt-1">
                          <div className="text-right flex-1 truncate">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-zinc-400">Total</span>
                            <span className="font-mono text-[11px] font-black">{item.total}</span>
                          </div>
                          
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItemRow(index)}
                              className="text-rose-500 hover:text-rose-700 p-1 shrink-0 bg-white dark:bg-zinc-800 rounded-md border border-zinc-150 dark:border-zinc-700/50"
                              title="Delete row"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotals & Grand summary */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 flex justify-end font-medium leading-loose text-xs shrink-0">
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl p-4 w-72 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subtotal:</span>
                      <span className="font-mono font-bold">{renderCurrency(subtotalSum)}</span>
                    </div>
                    {totalDiscountSum > 0 && (
                      <div className="flex justify-between text-rose-500">
                        <span>Discount Deducted:</span>
                        <span className="font-mono font-bold">-{renderCurrency(totalDiscountSum)}</span>
                      </div>
                    )}
                    {totalTaxSum > 0 && (
                      <div className="flex justify-between text-indigo-500">
                        <span>Sales Tax:</span>
                        <span className="font-mono font-bold">+{renderCurrency(totalTaxSum)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 text-sm font-bold text-zinc-950 dark:text-white leading-loose">
                      <span>Grand Total:</span>
                      <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                        {renderCurrency(grandTotalSum)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save actions */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5 flex gap-2 justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsQuotationModalOpen(false)}
                    className="border border-zinc-250 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 px-5 py-2.5 rounded-xl font-bold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-xl font-black cursor-pointer text-xs flex items-center gap-1"
                  >
                    {editingQuotation ? 'Save Changes' : 'Publish Proposal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RENDER PROFESSIONAL PDF PRINT VIEW */}
      <AnimatePresence>
        {selectedQuotationForPrint && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-2xl border border-zinc-200 dark:border-zinc-850 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col print:border-none print:shadow-none print:w-full print:max-h-full print:overflow-visible print:bg-white print:text-black"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 print:hidden bg-zinc-50 dark:bg-zinc-900/50">
                <span className="text-xs font-black uppercase text-zinc-500 tracking-wider">Proposal Print Canvas</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold leading-none cursor-pointer"
                  >
                    <Printer size={14} /> Print / Save PDF
                  </button>
                  <button
                    onClick={() => setSelectedQuotationForPrint(null)}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Printable Body Content */}
              <div id="print-content" className="p-8 md:p-12 space-y-8 bg-white text-zinc-900 overflow-y-auto print:p-0 print:overflow-visible print:bg-white">
                
                {/* PDF Header Logo and Company Details */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-zinc-150 pb-6 print:flex-row">
                  <div className="space-y-2">
                    {/* Logomark */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-950 text-white rounded-lg flex items-center justify-center font-black text-sm">
                        E
                      </div>
                      <span className="font-black text-2xl tracking-tight uppercase text-zinc-900">Expensy Limited</span>
                    </div>
                    <div className="text-[10px] sm:text-xs font-semibold text-zinc-500 space-y-1">
                      <p>SaaS Gateway & Custom Integration Partners</p>
                      <p>shshohagh4@gmail.com</p>
                      <p>Dhaka, Bangladesh</p>
                    </div>
                  </div>

                  <div className="text-right sm:text-right space-y-1 print:text-right">
                    <h2 className="text-xl font-bold uppercase tracking-widest text-indigo-600">OFFER QUOTATION</h2>
                    <p className="text-sm font-bold text-zinc-900">No: #{selectedQuotationForPrint.quotationNumber}</p>
                    <p className="text-xs text-zinc-500">Proposal Date: {selectedQuotationForPrint.quotationDate}</p>
                    <p className="text-xs text-zinc-500 font-bold text-rose-600">Validity: Until {selectedQuotationForPrint.validUntilDate}</p>
                  </div>
                </div>

                {/* Sender vs Recipient billing entities */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">CLIENT INFORMATION</p>
                    <div className="text-sm">
                      <p className="font-extrabold text-zinc-950 text-base">{selectedQuotationForPrint.clientName}</p>
                      {/* Lookup additional details */}
                      {(() => {
                        const matched = clients.find(c => c.id === selectedQuotationForPrint.clientId);
                        return matched ? (
                          <div className="text-xs font-medium text-zinc-650 mt-1 space-y-0.5">
                            {matched.companyName && <p className="font-bold text-zinc-900">{matched.companyName}</p>}
                            {matched.email && <p>Email: {matched.email}</p>}
                            {matched.mobileNumber && <p>Mobile: {matched.mobileNumber}</p>}
                            {matched.address && <p className="mt-1 bg-zinc-50 px-2 py-1 rounded inline-block">{matched.address}</p>}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">PROJECT SUMMARY</p>
                    <div className="text-sm">
                      <p className="font-extrabold text-zinc-900 text-base leading-snug">{selectedQuotationForPrint.projectName}</p>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        {selectedQuotationForPrint.description || 'Custom software architecture creation and validation.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Itemized list of calculations */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-450">Breakdown of Quotation Line Items</h4>
                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-semibold leading-relaxed border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-black">
                          <th className="px-4 py-2.5">Item Name & Details</th>
                          <th className="px-4 py-2.5 text-center">Quantity</th>
                          <th className="px-4 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Discount</th>
                          <th className="px-4 py-2.5 text-right">Tax</th>
                          <th className="px-4 py-2.5 text-right">Total (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-150 text-zinc-850">
                        {allQuotationItems.filter(item => item.quotationId === selectedQuotationForPrint.id).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-center text-zinc-400">
                              No items recorded for this proposal quotation.
                            </td>
                          </tr>
                        ) : (
                          allQuotationItems
                            .filter(item => item.quotationId === selectedQuotationForPrint.id)
                            .map((item, id) => (
                              <tr key={item.id || id}>
                                <td className="px-4 py-3 font-bold">
                                  <div>{item.itemName}</div>
                                  {item.description && (
                                    <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{item.description}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold">{item.unitPrice.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-rose-500 font-semibold">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                                <td className="px-4 py-3 text-right text-indigo-500 font-semibold">{item.tax > 0 ? `${item.tax}%` : '-'}</td>
                                <td className="px-4 py-3 text-right font-mono font-extrabold text-zinc-950">{item.total.toFixed(2)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subtotals & Grand summary */}
                <div className="flex justify-end pt-4">
                  <div className="border border-zinc-200 bg-zinc-50/20 rounded-xl p-4 w-80 space-y-2 text-xs">
                    {(() => {
                      const matchedItems = allQuotationItems.filter(item => item.quotationId === selectedQuotationForPrint.id);
                      const subSum = matchedItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
                      const discSum = matchedItems.reduce((acc, curr) => acc + ((curr.quantity * curr.unitPrice) * (curr.discount / 100)), 0);
                      const taxSum = matchedItems.reduce((acc, curr) => acc + (((curr.quantity * curr.unitPrice) - ((curr.quantity * curr.unitPrice) * (curr.discount / 100))) * (curr.tax / 100)), 0);
                      return (
                        <>
                          <div className="flex justify-between text-zinc-500 font-semibold">
                            <span>Subtotal:</span>
                            <span className="font-mono">{subSum.toFixed(2)}</span>
                          </div>
                          {discSum > 0 && (
                            <div className="flex justify-between text-rose-500 font-bold">
                              <span>Special Discount:</span>
                              <span className="font-mono">-{discSum.toFixed(2)}</span>
                            </div>
                          )}
                          {taxSum > 0 && (
                            <div className="flex justify-between text-indigo-600 font-bold">
                              <span>Standard Tax:</span>
                              <span className="font-mono">+{taxSum.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-zinc-200 pt-2 font-black text-sm text-zinc-950 leading-loose">
                            <span>GRAND TOTAL:</span>
                            <span className="font-mono text-base text-indigo-600 leading-none">
                              ৳{selectedQuotationForPrint.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Terms and conditions block */}
                <div className="pt-6 border-t border-zinc-150 grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-2">
                  <div className="space-y-1.5 text-[10px] text-zinc-500 font-medium">
                    <p className="font-black uppercase tracking-wider text-zinc-450">TERMS & CONDITIONS</p>
                    <p>1. This proposal remains open for acceptance for 30 calendar days from issued date.</p>
                    <p>2. Payment schedules will commence following successful signatory project kick-off.</p>
                    <p>3. Software specifications draft outlines delivery thresholds for all custom items.</p>
                  </div>

                  {/* Signatures region */}
                  <div className="flex flex-col justify-end items-end h-full">
                    <div className="w-56 text-center space-y-4">
                      <div className="border-b border-zinc-400 h-10 w-full" />
                      <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Authorized Signature Section</p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
