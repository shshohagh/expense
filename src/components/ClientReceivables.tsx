import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToClients,
  addClient,
  updateClient,
  deleteClient,
  subscribeToClientLedgers,
  addLedgerEntry,
  deleteLedgerEntry,
  subscribeToProjects,
  addProject,
  updateProject,
  deleteProject,
  subscribeToSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  subscribeToReceivables,
  addReceivable,
  updateReceivable,
  deleteReceivable,
  subscribeToPayments,
  addPayment,
  deletePayment
} from '../services/firestoreService';
import { Client, ClientLedger, Project, Subscription, Receivable, PaymentCollection } from '../types';
import {
  Users,
  Briefcase,
  CreditCard,
  TrendingUp,
  DollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  Send,
  Trash2,
  Edit2,
  BookOpen,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  Download,
  MessageSquare,
  ChevronRight,
  MoreVertical,
  X,
  FileCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/i18n';

type Tab = 'dashboard' | 'clients' | 'projects' | 'subscriptions' | 'receivables' | 'payments';

export default function ClientReceivables() {
  const { user } = useAuth();
  const userId = user?.id?.toString() || '';

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Firestore DB states
  const [clients, setClients] = useState<Client[]>([]);
  const [ledgers, setLedgers] = useState<ClientLedger[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<PaymentCollection[]>([]);

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected entities for views (e.g. Ledger drilldown)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Modal open states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLedgerEntryModal, setShowLedgerEntryModal] = useState(false);

  // Form input states
  const [clientForm, setClientForm] = useState({
    name: '',
    companyName: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    address: '',
    notes: '',
    balance: 0
  });

  const [projectForm, setProjectForm] = useState({
    clientId: '',
    projectName: '',
    totalAmount: 0,
    advanceAmount: 0,
    deliveryDate: '',
    status: 'In Progress' as Project['status'],
    notes: ''
  });

  const [subscriptionForm, setSubscriptionForm] = useState({
    clientId: '',
    productName: '',
    planName: '',
    monthlyFee: 0,
    startDate: '',
    renewalDate: '',
    status: 'Active' as Subscription['status'],
    notes: ''
  });

  const [receivableForm, setReceivableForm] = useState({
    clientId: '',
    amount: 0,
    invoiceNumber: '',
    dueDate: '',
    description: '',
    status: 'Pending' as Receivable['status']
  });

  const [paymentForm, setPaymentForm] = useState({
    clientId: '',
    receivableId: '', // optional linked invoice
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash' as PaymentCollection['paymentMethod'],
    transactionReference: '',
    notes: ''
  });

  const [ledgerEntryForm, setLedgerEntryForm] = useState({
    clientId: '',
    type: 'Adjustment' as ClientLedger['type'],
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });

  // Load Firestore subscriptions
  useEffect(() => {
    if (!userId) return;

    const unsubClients = subscribeToClients(userId, setClients);
    const unsubLedgers = subscribeToClientLedgers(userId, setLedgers);
    const unsubProjects = subscribeToProjects(userId, setProjects);
    const unsubSubscriptions = subscribeToSubscriptions(userId, setSubscriptions);
    const unsubReceivables = subscribeToReceivables(userId, setReceivables);
    const unsubPayments = subscribeToPayments(userId, setPayments);

    return () => {
      unsubClients();
      unsubLedgers();
      unsubProjects();
      unsubSubscriptions();
      unsubReceivables();
      unsubPayments();
    };
  }, [userId]);

  // Currency utility helper
  const renderMoney = (amount: number) => {
    return formatCurrency(amount, user?.currency || 'USD');
  };

  // Metric computations for dashboard
  const totalReceivable = clients.reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeClientsCount = clients.length;
  const activeSubsCount = subscriptions.filter(s => s.status === 'Active').length;
  const overdueReceivablesCount = receivables.filter(r => {
    const isOverdue = new Date(r.dueDate) < new Date() && r.status !== 'Paid';
    return isOverdue;
  }).length;

  const upcomingRenewals = subscriptions.filter(s => {
    if (s.status !== 'Active') return false;
    const refDate = new Date();
    const renewal = new Date(s.renewalDate);
    const diffTime = renewal.getTime() - refDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  // Actions / Submissions
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim()) return;

    const payload = {
      userId,
      name: clientForm.name,
      companyName: clientForm.companyName || '',
      mobileNumber: clientForm.mobileNumber || '',
      whatsAppNumber: clientForm.whatsAppNumber || '',
      email: clientForm.email || '',
      address: clientForm.address || '',
      notes: clientForm.notes || '',
      balance: Number(clientForm.balance) || 0
    };

    const newId = await addClient(payload);
    if (newId && payload.balance > 0) {
      // Record initial balance adjustment in client ledger
      await addLedgerEntry({
        userId,
        clientId: newId,
        clientName: payload.name,
        date: new Date().toISOString().split('T')[0],
        type: 'Adjustment',
        description: 'Opening Outstanding Balance Contribution',
        debit: payload.balance,
        credit: 0,
        runningBalance: payload.balance
      });
    }

    setShowClientModal(false);
    setClientForm({
      name: '',
      companyName: '',
      mobileNumber: '',
      whatsAppNumber: '',
      email: '',
      address: '',
      notes: '',
      balance: 0
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.clientId || !projectForm.projectName.trim() || projectForm.totalAmount <= 0) return;

    const matchedClient = clients.find(c => c.id === projectForm.clientId);
    if (!matchedClient) return;

    const dueAmount = projectForm.totalAmount - projectForm.advanceAmount;

    const payload = {
      userId,
      clientId: projectForm.clientId,
      clientName: matchedClient.name,
      projectName: projectForm.projectName,
      totalAmount: Number(projectForm.totalAmount),
      advanceAmount: Number(projectForm.advanceAmount),
      dueAmount: Math.max(0, dueAmount),
      deliveryDate: projectForm.deliveryDate,
      status: projectForm.status,
      notes: projectForm.notes || ''
    };

    await addProject(payload);

    // If an advance was paid trigger payment collection to deduct client ledger automatically
    if (payload.advanceAmount > 0) {
      await addPayment({
        userId,
        clientId: payload.clientId,
        clientName: payload.clientName,
        amount: payload.advanceAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        notes: `Advance Payment for project ${payload.projectName}`
      });
    }

    setShowProjectModal(false);
    setProjectForm({
      clientId: '',
      projectName: '',
      totalAmount: 0,
      advanceAmount: 0,
      deliveryDate: '',
      status: 'In Progress',
      notes: ''
    });
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionForm.clientId || !subscriptionForm.productName.trim() || subscriptionForm.monthlyFee <= 0) return;

    const matchedClient = clients.find(c => c.id === subscriptionForm.clientId);
    if (!matchedClient) return;

    const payload = {
      userId,
      clientId: subscriptionForm.clientId,
      clientName: matchedClient.name,
      productName: subscriptionForm.productName,
      planName: subscriptionForm.planName || 'Monthly Standard',
      monthlyFee: Number(subscriptionForm.monthlyFee),
      startDate: subscriptionForm.startDate,
      renewalDate: subscriptionForm.renewalDate,
      status: subscriptionForm.status,
      notes: subscriptionForm.notes || ''
    };

    await addSubscription(payload);
    setShowSubscriptionModal(false);
    setSubscriptionForm({
      clientId: '',
      productName: '',
      planName: '',
      monthlyFee: 0,
      startDate: '',
      renewalDate: '',
      status: 'Active',
      notes: ''
    });
  };

  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivableForm.clientId || receivableForm.amount <= 0 || !receivableForm.dueDate) return;

    const matchedClient = clients.find(c => c.id === receivableForm.clientId);
    if (!matchedClient) return;

    const payload = {
      userId,
      clientId: receivableForm.clientId,
      clientName: matchedClient.name,
      amount: Number(receivableForm.amount),
      invoiceNumber: receivableForm.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      dueDate: receivableForm.dueDate,
      description: receivableForm.description || 'General Receivable Invoiced Charge',
      status: receivableForm.status,
      amountPaid: 0
    };

    const recId = await addReceivable(payload);

    // Charge the client ledger matching this invoice
    await addLedgerEntry({
      userId,
      clientId: payload.clientId,
      clientName: payload.clientName,
      date: new Date().toISOString().split('T')[0],
      type: 'Project Charge',
      description: `Invoice ${payload.invoiceNumber}: ${payload.description}`,
      debit: payload.amount,
      credit: 0,
      runningBalance: 0
    });

    setShowReceivableModal(false);
    setReceivableForm({
      clientId: '',
      amount: 0,
      invoiceNumber: '',
      dueDate: '',
      description: '',
      status: 'Pending'
    });
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.clientId || paymentForm.amount <= 0) return;

    const matchedClient = clients.find(c => c.id === paymentForm.clientId);
    if (!matchedClient) return;

    const payload = {
      userId,
      clientId: paymentForm.clientId,
      clientName: matchedClient.name,
      receivableId: paymentForm.receivableId || '',
      amount: Number(paymentForm.amount),
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      transactionReference: paymentForm.transactionReference || '',
      notes: paymentForm.notes || ''
    };

    await addPayment(payload);
    setShowPaymentModal(false);
    setPaymentForm({
      clientId: '',
      receivableId: '',
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      transactionReference: '',
      notes: ''
    });
  };

  const handleCreateLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerEntryForm.clientId || ledgerEntryForm.amount <= 0) return;

    const matchedClient = clients.find(c => c.id === ledgerEntryForm.clientId);
    if (!matchedClient) return;

    // Evaluate debit vs credit based on ledger entry type structure
    const isDebit = ['Project Charge', 'Subscription Charge', 'Adjustment'].includes(ledgerEntryForm.type);
    const debitVal = isDebit ? Number(ledgerEntryForm.amount) : 0;
    const creditVal = !isDebit ? Number(ledgerEntryForm.amount) : 0;

    await addLedgerEntry({
      userId,
      clientId: ledgerEntryForm.clientId,
      clientName: matchedClient.name,
      date: ledgerEntryForm.date,
      type: ledgerEntryForm.type,
      description: ledgerEntryForm.description || `${ledgerEntryForm.type} Reference Manual Ledger`,
      debit: debitVal,
      credit: creditVal,
      runningBalance: 0
    });

    setShowLedgerEntryModal(false);
    setLedgerEntryForm({
      clientId: '',
      type: 'Adjustment',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0]
    });
  };

  // WhatsApp Reminder Generator
  const sendWhatsAppReminder = (rec: Receivable) => {
    const matchedClient = clients.find(c => c.id === rec.clientId);
    if (!matchedClient) return;

    const phoneNumber = matchedClient.whatsAppNumber || matchedClient.mobileNumber || '';
    if (!phoneNumber) {
      alert('This client does not have a registered mobile or WhatsApp number!');
      return;
    }

    const pendingAmount = rec.amount - rec.amountPaid;
    const rawNumber = phoneNumber.replace(/[^0-9]/g, '');

    const message = `Hello ${matchedClient.name}, this is a gentle reminder regarding the outstanding payment of ${renderMoney(pendingAmount)} for invoice ${rec.invoiceNumber} (${rec.description}) due on ${rec.dueDate}. Kindly clear the balance soon. Thank you!`;
    const formattedUrl = `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`;

    window.open(formattedUrl, '_blank');
  };

  const selectedClientLedgers = ledgers.filter(l => l.clientId === selectedClientId);
  const selectedClientDetail = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-6">
      {/* Module Title / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans text-zinc-900 dark:text-zinc-50">
            Client Receivables
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage custom projects, recursive POS/SaaS billing contracts, and ledger balance logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowClientModal(true)}
            id="add-client-nav-btn"
            className="flex items-center gap-2 bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white rounded-xl px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-all shadow-md"
          >
            <Plus size={16} /> Add Client
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            id="add-payment-nav-btn"
            className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-xs font-semibold hover:bg-emerald-700 transition-all shadow-md"
          >
            <Plus size={16} /> Collect Payment
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-805 gap-1 pb-1">
        {[
          { tab: 'dashboard', name: 'Dashboard', icon: Users },
          { tab: 'clients', name: 'Active Clients', icon: Users },
          { tab: 'projects', name: 'Software Projects', icon: Briefcase },
          { tab: 'subscriptions', name: 'Contracts / Subscriptions', icon: CreditCard },
          { tab: 'receivables', name: 'Receivable Invoices', icon: TrendingUp },
          { tab: 'payments', name: 'Payment Log', icon: DollarSign }
        ].map(item => (
          <button
            key={item.tab}
            onClick={() => {
              setActiveTab(item.tab as Tab);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
              activeTab === item.tab
                ? 'bg-zinc-105 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 font-bold'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900'
            }`}
          >
            <item.icon size={15} />
            {item.name}
          </button>
        ))}
      </div>

      {/* RENDER ACTIVE TAB COMPONENT */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Dashboard Metrics BENTO GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Receivables Overdue */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 flex justify-between items-start shadow-sm hover:scale-[1.01] transition-transform">
              <div className="space-y-1">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider block">Total Outstanding</span>
                <span className="text-2xl font-bold tracking-tight text-rose-500 dark:text-rose-400 font-sans block">
                  {renderMoney(totalReceivable)}
                </span>
                <span className="text-xs text-zinc-500 block">Across {clients.filter(c => c.balance > 0).length} clients</span>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl p-3">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Total Recovered */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 flex justify-between items-start shadow-sm hover:scale-[1.01] transition-transform">
              <div className="space-y-1">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider block">Total Collections</span>
                <span className="text-2xl font-bold tracking-tight text-emerald-500 dark:text-emerald-400 font-sans block">
                  {renderMoney(totalCollected)}
                </span>
                <span className="text-xs text-zinc-500 block">Total received to date</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl p-3">
                <DollarSign size={20} />
              </div>
            </div>

            {/* Subscriptions */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 flex justify-between items-start shadow-sm hover:scale-[1.01] transition-transform">
              <div className="space-y-1">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider block">Active Contracts</span>
                <span className="text-2xl font-bold tracking-tight text-blue-500 dark:text-blue-400 font-sans block">
                  {activeSubsCount}
                </span>
                <span className="text-xs text-zinc-500 block">SaaS / POS SaaS Plans</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl p-3">
                <CreditCard size={20} />
              </div>
            </div>

            {/* Overdue Items Alert */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 flex justify-between items-start shadow-sm hover:scale-[1.01] transition-transform">
              <div className="space-y-1">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider block">Overdue Payments</span>
                <span className={`text-2xl font-bold tracking-tight font-sans block ${overdueReceivablesCount > 0 ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`}>
                  {overdueReceivablesCount}
                </span>
                <span className="text-xs text-zinc-500 block">Passed scheduled target dates</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl p-3">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>

          {/* Secondary Bento Grids: Renewals & Low balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upcoming Renewals in Next 30 Days */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex gap-2 items-center text-sm font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
                <Calendar className="text-zinc-500" size={16} />
                <h2>Upcoming Subscription Renewals (30 Days)</h2>
              </div>

              {upcomingRenewals.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs">
                  All active contracts have renewal cycles beyond the next 30 days.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {upcomingRenewals.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between border-b border-zinc-50 dark:border-zinc-800 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="text-sm font-semibold">{sub.clientName}</div>
                        <div className="text-xs text-zinc-500">{sub.productName} ({sub.planName})</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {renderMoney(sub.monthlyFee)}
                        </div>
                        <div className="text-[10px] text-zinc-400">Due {sub.renewalDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Highest Outstanding Clients */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex gap-2 items-center text-sm font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
                <Users className="text-rose-500" size={16} />
                <h2>Top Client Receivables</h2>
              </div>

              {clients.filter(c => c.balance > 0).length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs">
                  Zero unpaid outstanding balances! Outstanding accounts are 100% recovered.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {clients
                    .filter(c => c.balance > 0)
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 5)
                    .map(client => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between border-b border-zinc-50 dark:border-zinc-800 pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <div className="text-sm font-semibold">{client.name}</div>
                          <div className="text-xs text-zinc-500">{client.companyName || 'Freelance / Personal'}</div>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setShowLedgerModal(true);
                            }}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-tight inline-flex items-center gap-1.5 focus:outline-none"
                          >
                            Ledger
                            <BookOpen size={10} />
                          </button>
                          <div className="text-xs font-mono font-black text-rose-500 mt-1">
                            {renderMoney(client.balance)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CLIENTS */}
      {activeTab === 'clients' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <h2 className="text-xl font-bold">Accounts Directory</h2>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2 w-full sm:max-w-xs">
              <Search className="text-zinc-400 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Search clients, companies..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-full"
              />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Phone / WhatsApp</th>
                  <th className="py-3 px-4">Outstanding Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter(c => {
                    const term = searchTerm.toLowerCase();
                    return c.name.toLowerCase().includes(term) || (c.companyName || '').toLowerCase().includes(term);
                  })
                  .map(client => (
                    <tr
                      key={client.id}
                      className="border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-50">
                        {client.name}
                        <span className="block text-[10px] text-zinc-400 font-normal">{client.email || 'No email'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">{client.companyName || '-'}</td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 space-y-0.5">
                        <div className="font-mono">{client.mobileNumber || '-'}</div>
                        {client.whatsAppNumber && (
                          <div className="text-[10px] text-emerald-500 inline-flex items-center gap-1 font-sans">
                            WhatsApp: {client.whatsAppNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-bold ${client.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {renderMoney(client.balance)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setShowLedgerModal(true);
                          }}
                          className="bg-indigo-55 text-zinc-900 hover:bg-indigo-100 dark:bg-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight inline-flex items-center gap-1"
                        >
                          Ledger <BookOpen size={11} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Do you want to delete client ${client.name}?`)) {
                              deleteClient(client.id);
                            }
                          }}
                          className="text-zinc-400 hover:text-rose-500 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PROJECTS */}
      {activeTab === 'projects' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Custom Projects Contracts</h2>
              <button
                onClick={() => setShowProjectModal(true)}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> New Contract
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-zinc-55 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-xs ring-0 border-0 focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2">
                <Search className="text-zinc-400 shrink-0" size={16} />
                <input
                  type="text"
                  placeholder="Search project, clients..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-75"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-3 px-4">Project / Client</th>
                  <th className="py-3 px-4">Total Fee</th>
                  <th className="py-3 px-4">Advance Paid</th>
                  <th className="py-3 px-4">Unpaid Due Balance</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .filter(p => {
                    const term = searchTerm.toLowerCase();
                    const stateMatch = statusFilter === 'ALL' || p.status === statusFilter;
                    const searchable = p.clientName.toLowerCase().includes(term) || p.projectName.toLowerCase().includes(term);
                    return stateMatch && searchable;
                  })
                  .map(proj => (
                    <tr
                      key={proj.id}
                      className="border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50 block">{proj.projectName}</span>
                        <span className="text-[10px] text-zinc-450">{proj.clientName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{renderMoney(proj.totalAmount)}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-500">{renderMoney(proj.advanceAmount)}</td>
                      <td className="py-3.5 px-4 font-mono text-rose-500 font-bold">{renderMoney(proj.dueAmount)}</td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500">{proj.deliveryDate}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          proj.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : proj.status === 'On Hold'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                        }`}>
                          {proj.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Remove custom project details for ${proj.projectName}?`)) {
                              deleteProject(proj.id);
                            }
                          }}
                          className="hover:text-rose-500 text-zinc-400 transition-colors p-2"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SUBSCRIPTIONS (RECURRING SaaS / POS PLANS) */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">POS & SaaS contracts</h2>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> New Contract
              </button>
            </div>

            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2">
              <Search className="text-zinc-400 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Product, client search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-75"
              />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-3 px-4">Product / Plan</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Monthly Fee</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Renewal Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions
                  .filter(s => {
                    const term = searchTerm.toLowerCase();
                    return s.clientName.toLowerCase().includes(term) || s.productName.toLowerCase().includes(term);
                  })
                  .map(sub => (
                    <tr
                      key={sub.id}
                      className="border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-50">
                        {sub.productName}
                        <span className="block text-[10px] text-zinc-455 font-normal tracking-wide">{sub.planName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">{sub.clientName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {renderMoney(sub.monthlyFee)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500">{sub.startDate}</td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500">{sub.renewalDate}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          sub.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Delete the recurring contract ${sub.productName}?`)) {
                              deleteSubscription(sub.id);
                            }
                          }}
                          className="hover:text-rose-500 text-zinc-400 p-2"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: RECEIVABLE INVOICES */}
      {activeTab === 'receivables' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Unpaid Receivables Invoices</h2>
              <button
                onClick={() => setShowReceivableModal(true)}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> New Invoice
              </button>
            </div>

            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2">
              <Search className="text-zinc-400 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Search invoice number, client details..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-75"
              />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice ID / Due Date</th>
                  <th className="py-3 px-4">Client / Description</th>
                  <th className="py-3 px-4">Invoice Amount</th>
                  <th className="py-3 px-4">Already Paid</th>
                  <th className="py-3 px-4">Remaining Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Remind</th>
                  <th className="py-3 px-4 text-right">Void</th>
                </tr>
              </thead>
              <tbody>
                {receivables
                  .filter(r => {
                    const term = searchTerm.toLowerCase();
                    return r.clientName.toLowerCase().includes(term) || (r.invoiceNumber || '').toLowerCase().includes(term) || r.description.toLowerCase().includes(term);
                  })
                  .map(rec => {
                    const remains = rec.amount - (rec.amountPaid || 0);
                    const isOverdue = new Date(rec.dueDate) < new Date() && rec.status !== 'Paid';
                    return (
                      <tr
                        key={rec.id}
                        className={`border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors ${
                          isOverdue ? 'bg-amber-50/10 dark:bg-amber-950/5' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold">
                          <span className="text-zinc-900 dark:text-zinc-50 block">{rec.invoiceNumber}</span>
                          <span className={`text-[10px] font-normal flex items-center gap-1 ${isOverdue ? 'text-amber-500' : 'text-zinc-400'}`}>
                            {isOverdue && <AlertTriangle size={10} />} Due {rec.dueDate}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-300 block">{rec.clientName}</span>
                          <span className="text-[10px] text-zinc-450">{rec.description}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">{renderMoney(rec.amount)}</td>
                        <td className="py-3.5 px-4 font-mono text-emerald-500">{renderMoney(rec.amountPaid)}</td>
                        <td className="py-3.5 px-4 font-mono text-rose-500 font-bold">{renderMoney(remains)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            rec.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
                              : rec.status === 'Partial'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-955/20 animate-pulse'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {rec.status !== 'Paid' && (
                            <button
                              onClick={() => sendWhatsAppReminder(rec)}
                              className="bg-emerald-50 hover:bg-emerald-110 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 p-2 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to void Invoice ${rec.invoiceNumber}?`)) {
                                deleteReceivable(rec.id);
                              }
                            }}
                            className="hover:text-rose-500 text-zinc-400 p-2"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PAYMENT COLLECTIONS LOG */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <h2 className="text-xl font-bold">Collections Receipts</h2>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2">
              <Search className="text-zinc-400 shrink-0" size={16} />
              <input
                type="text"
                placeholder="Client, method search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-75"
              />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Amount Received</th>
                  <th className="py-3 px-4">Method Reference</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Void Payment</th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .filter(p => {
                    const term = searchTerm.toLowerCase();
                    return p.clientName.toLowerCase().includes(term) || p.paymentMethod.toLowerCase().includes(term);
                  })
                  .map(pay => (
                    <tr
                      key={pay.id}
                      className="border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-zinc-500">{pay.paymentDate}</td>
                      <td className="py-3.5 px-4 text-zinc-900 dark:text-zinc-50 font-semibold">{pay.clientName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-500">{renderMoney(pay.amount)}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded text-[10px] font-semibold text-zinc-650 tracking-wider">
                          {pay.paymentMethod}
                        </span>
                        {pay.transactionReference && (
                          <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">Ref: {pay.transactionReference}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-450">{pay.notes || '-'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Void payment collection of ${renderMoney(pay.amount)} from ${pay.clientName}? Balance will automatically adjustment reconcile.`)) {
                              deletePayment(pay.id);
                            }
                          }}
                          className="hover:text-rose-500 text-zinc-400 p-2"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ALL INLINE POPUP DRAWER MODALS --- */}

      {/* MODAL: ADD CLIENT */}
      <AnimatePresence>
        {showClientModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowClientModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Users size={18} /> Add Client Profile
              </h2>
              <form onSubmit={handleCreateClient} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-zinc-400"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Company Name</label>
                  <input
                    type="text"
                    value={clientForm.companyName}
                    onChange={e => setClientForm({ ...clientForm, companyName: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                    placeholder="e.g. Oracle Corp"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Mobile (SMS)</label>
                    <input
                      type="text"
                      value={clientForm.mobileNumber}
                      onChange={e => setClientForm({ ...clientForm, mobileNumber: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                      placeholder="e.g. +14155552671"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">WhatsApp</label>
                    <input
                      type="text"
                      value={clientForm.whatsAppNumber}
                      onChange={e => setClientForm({ ...clientForm, whatsAppNumber: e.target.value })}
                      className="w-full bg-zinc-5s dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                      placeholder="WhatsApp with country code"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Email Address</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                    className="w-full bg-zinc-5s dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Address / Location</label>
                  <input
                    type="text"
                    value={clientForm.address}
                    onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                    placeholder="City, State, Country"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Initial Outstanding Debt Balances</label>
                  <input
                    type="number"
                    value={clientForm.balance}
                    onChange={e => setClientForm({ ...clientForm, balance: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    placeholder="Opening balance e.g., 500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl mt-2 tracking-wide"
                >
                  Create Client Account
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD PROJECT */}
      <AnimatePresence>
        {showProjectModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowProjectModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Briefcase size={18} /> New Software Project Contract
              </h2>
              <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Select Contracting Client *</label>
                  <select
                    required
                    value={projectForm.clientId}
                    onChange={e => setProjectForm({ ...projectForm, clientId: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="">-- Choose Client Profile --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={projectForm.projectName}
                    onChange={e => setProjectForm({ ...projectForm, projectName: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50"
                    placeholder="e.g. E-Commerce Website Development"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Total Charge (Fee) *</label>
                    <input
                      type="number"
                      required
                      value={projectForm.totalAmount}
                      onChange={e => setProjectForm({ ...projectForm, totalAmount: Number(e.target.value) })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                      placeholder="e.g. 2500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Advance Deposit Paid</label>
                    <input
                      type="number"
                      value={projectForm.advanceAmount}
                      onChange={e => setProjectForm({ ...projectForm, advanceAmount: Number(e.target.value) })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Est. Delivery Date *</label>
                  <input
                    type="date"
                    required
                    value={projectForm.deliveryDate}
                    onChange={e => setProjectForm({ ...projectForm, deliveryDate: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Development Progress State</label>
                  <select
                    value={projectForm.status}
                    onChange={e => setProjectForm({ ...projectForm, status: e.target.value as Project['status'] })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Not Started">Not Started</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide"
                >
                  Create & Post Project Fees
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD SUBSCRIPTION */}
      <AnimatePresence>
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard size={18} /> Establish Subscription Contract
              </h2>
              <form onSubmit={handleCreateSubscription} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Subscribing Client *</label>
                  <select
                    required
                    value={subscriptionForm.clientId}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, clientId: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="">-- Choose Client Profile --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={subscriptionForm.productName}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, productName: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50"
                    placeholder="e.g. POS Billing SaaS, Cloud Server Hosting"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Plan Name / Reference</label>
                  <input
                    type="text"
                    value={subscriptionForm.planName}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, planName: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900"
                    placeholder="e.g. Pro Monthly, Annual Premium Tier"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Recurring Fee Amount (Monthly) *</label>
                  <input
                    type="number"
                    required
                    value={subscriptionForm.monthlyFee}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, monthlyFee: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    placeholder="e.g. 59"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={subscriptionForm.startDate}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Next Renewal Date *</label>
                    <input
                      type="date"
                      required
                      value={subscriptionForm.renewalDate}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, renewalDate: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Status State</label>
                  <select
                    value={subscriptionForm.status}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, status: e.target.value as Subscription['status'] })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Past Due">Past Due</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide"
                >
                  Confirm Subscription Fee Setup
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD RECEIVABLE (INVOICE) */}
      <AnimatePresence>
        {showReceivableModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowReceivableModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={18} /> New Receivable Invoice
              </h2>
              <form onSubmit={handleCreateReceivable} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Target Client *</label>
                  <select
                    required
                    value={receivableForm.clientId}
                    onChange={e => setReceivableForm({ ...receivableForm, clientId: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="">-- Choose Client Profile --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Invoice Reference ID (Optional)</label>
                  <input
                    type="text"
                    value={receivableForm.invoiceNumber}
                    onChange={e => setReceivableForm({ ...receivableForm, invoiceNumber: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900"
                    placeholder="Auto Generated if blank (e.g. INV-10022)"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Invoice Total Balance Amount *</label>
                  <input
                    type="number"
                    required
                    value={receivableForm.amount}
                    onChange={e => setReceivableForm({ ...receivableForm, amount: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    placeholder="e.g. 1200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Due (Repayment Target) Date *</label>
                  <input
                    type="date"
                    required
                    value={receivableForm.dueDate}
                    onChange={e => setReceivableForm({ ...receivableForm, dueDate: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Invoice Line Description *</label>
                  <input
                    type="text"
                    required
                    value={receivableForm.description}
                    onChange={e => setReceivableForm({ ...receivableForm, description: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900"
                    placeholder="e.g. Phase 2 SaaS Backend development completion"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide font-sans"
                >
                  Generate Invoice & Charge Ledger
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: COLLECT PAYMENT */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="text-emerald-500" size={18} /> Record Funds Collection Receipt
              </h2>
              <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Contracting Client *</label>
                  <select
                    required
                    value={paymentForm.clientId}
                    onChange={e => setPaymentForm({ ...paymentForm, clientId: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="">-- Choose Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({renderMoney(c.balance || 0)} due)</option>
                    ))}
                  </select>
                </div>

                {paymentForm.clientId && (
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Link Custom Pending Invoice (Optional)</label>
                    <select
                      value={paymentForm.receivableId}
                      onChange={e => setPaymentForm({ ...paymentForm, receivableId: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                    >
                      <option value="">-- Choose Invoice to Apply payment --</option>
                      {receivables
                        .filter(r => r.clientId === paymentForm.clientId && r.status !== 'Paid')
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            Invoice {r.invoiceNumber} - Total {renderMoney(r.amount - r.amountPaid)}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Collection Amount Received (Credit) *</label>
                  <input
                    type="number"
                    required
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Payment Transfer Method *</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Mobile Banking">Mobile Banking</option>
                      <option value="Check">Check</option>
                      <option value="SaaS Gateway">SaaS Gateway</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Tx Ref / Check Index</label>
                    <input
                      type="text"
                      value={paymentForm.transactionReference}
                      onChange={e => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                      placeholder="e.g. TX-99201"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Notes / Remarks</label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900"
                    placeholder="e.g. Client deposited directly to standard checking account"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-750 text-white font-bold py-2.5 rounded-xl tracking-wide font-sans text-xs"
                >
                  Confirm & Ledger Receipt of Cash
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DRILLDOWN LEDGER OVERVIEW DETAIL DRAWER --- */}
      <AnimatePresence>
        {showLedgerModal && selectedClientId && selectedClientDetail && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="bg-white dark:bg-zinc-900 h-full w-full max-w-2xl shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-5 border-b border-zinc-250 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
                <div>
                  <h2 className="text-lg font-bold font-sans text-zinc-900 dark:text-zinc-50">
                    Client Account Ledger
                  </h2>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                    Client: {selectedClientDetail.name} • {selectedClientDetail.companyName || 'Freelance Profile'}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      setLedgerEntryForm({ ...ledgerEntryForm, clientId: selectedClientId, date: new Date().toISOString().split('T')[0] });
                      setShowLedgerEntryModal(true);
                    }}
                    className="bg-zinc-905 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold px-3 py-1.5 text-[10px] uppercase rounded-lg hover:opacity-90 inline-flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Plus size={11} /> Manual Entry
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Print / PDF Ledger"
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    onClick={() => setShowLedgerModal(false)}
                    className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 rounded-lg shrink-0 outline-none"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Outstanding metrics bar inside Ledger */}
              <div className="p-5 bg-zinc-100/50 dark:bg-zinc-950/20 grid grid-cols-3 gap-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium">Accumulated Debits</span>
                  <div className="text-sm font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-1">
                    {renderMoney(selectedClientLedgers.reduce((acc, l) => acc + (l.debit || 0), 0))}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium">Settled Credits</span>
                  <div className="text-sm font-semibold font-mono text-emerald-500 dark:text-emerald-400 mt-1">
                    {renderMoney(selectedClientLedgers.reduce((acc, l) => acc + (l.credit || 0), 0))}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium">Receivables Balance</span>
                  <div className="text-sm font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
                    {renderMoney(selectedClientDetail.balance)}
                  </div>
                </div>
              </div>

              {/* DRILLDOWN LOGS TABLE */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
                {selectedClientLedgers.length === 0 ? (
                  <div className="text-center py-20 text-zinc-400 text-xs">
                    This account currently has no listed historical journal ledger debit/credit entries.
                  </div>
                ) : (
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 font-medium">Description</th>
                          <th className="py-2.5 px-3 text-right">Debit (+)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-)</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                          <th className="py-2.5 px-3 text-right">Void</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientLedgers.map(log => (
                          <tr
                            key={log.id}
                            className="border-b border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50/40 dark:hover:bg-zinc-800/10 transition-colors"
                          >
                            <td className="py-3 px-3 font-mono text-zinc-500 text-[10px] shrink-0 whitespace-nowrap">{log.date}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase whitespace-nowrap ${
                                log.type === 'Payment Received'
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : log.type === 'Refund'
                                  ? 'bg-zinc-100 text-zinc-650'
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-955/20'
                              }`}>
                                {log.type === 'Project Charge' ? 'Project' : log.type === 'Subscription Charge' ? 'Subscription' : log.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 min-w-40 max-w-xs truncate" title={log.description}>
                              {log.description}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-rose-500">
                              {log.debit > 0 ? `+${renderMoney(log.debit)}` : '-'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-emerald-500">
                              {log.credit > 0 ? `-${renderMoney(log.credit)}` : '-'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-zinc-900 dark:text-zinc-50">
                              {renderMoney(log.runningBalance)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this custom ledger entry? Client running balance will adjust back.')) {
                                    deleteLedgerEntry(log.id);
                                  }
                                }}
                                className="text-zinc-350 hover:text-rose-500 transition-colors p-1"
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP: MANUAL LEDGER ENTRY FORM */}
      <AnimatePresence>
        {showLedgerEntryModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl relative"
            >
              <button
                onClick={() => setShowLedgerEntryModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X size={15} />
              </button>
              <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                <BookOpen size={16} /> New Manual Ledger Journal Entry
              </h2>
              <form onSubmit={handleCreateLedgerEntry} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium font-sans">Adjustment Category Type *</label>
                  <select
                    value={ledgerEntryForm.type}
                    onChange={e => setLedgerEntryForm({ ...ledgerEntryForm, type: e.target.value as any })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-sans"
                  >
                    <option value="Adjustment">Adjustment (Increases Balance)</option>
                    <option value="Project Charge">Project Charge (Increases Balance)</option>
                    <option value="Subscription Charge">Subscription Charge (Increases Balance)</option>
                    <option value="Payment Received">Payment Received (Decreases Balance)</option>
                    <option value="Refund">Refund (Decreases Balance)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Charge Amount (Absolute Value) *</label>
                  <input
                    type="number"
                    required
                    value={ledgerEntryForm.amount}
                    onChange={e => setLedgerEntryForm({ ...ledgerEntryForm, amount: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                    placeholder="e.g. 150"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Posting Record Date *</label>
                  <input
                    type="date"
                    required
                    value={ledgerEntryForm.date}
                    onChange={e => setLedgerEntryForm({ ...ledgerEntryForm, date: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Journal Remarks / Description *</label>
                  <input
                    type="text"
                    required
                    value={ledgerEntryForm.description}
                    onChange={e => setLedgerEntryForm({ ...ledgerEntryForm, description: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900"
                    placeholder="e.g. Reconciled credit balance from overcharge"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide font-sans text-xs"
                >
                  Post Ledger Journal Segment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
