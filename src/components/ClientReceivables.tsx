import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToClients,
  addClient,
  updateClient,
  editClientAndAdjustOpeningBalance,
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
  deletePayment,
  subscribeToProducts,
  addProduct,
  updateProduct,
  deleteProduct
} from '../services/firestoreService';
import { Client, ClientLedger, Project, Subscription, Receivable, PaymentCollection, Product } from '../types';
import {
  Users,
  Briefcase,
  CreditCard,
  TrendingUp,
  DollarSign,
  Plus,
  Search,
  Package,
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
  AlertTriangle,
  Repeat,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/i18n';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

type Tab = 'dashboard' | 'clients' | 'projects' | 'subscriptions' | 'receivables' | 'payments' | 'products' | 'reports';

export default function ClientReceivables() {
  const { user } = useAuth();
  const userId = user?.id?.toString() || '';

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Multi-delete modal states & helper
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalTitle, setDeleteModalTitle] = useState('Confirm Deletion');
  const [deleteModalMessage, setDeleteModalMessage] = useState('Are you sure you want to delete this record?');
  const [deleteModalItemName, setDeleteModalItemName] = useState<string | undefined>(undefined);
  const [deleteModalOnConfirm, setDeleteModalOnConfirm] = useState<() => Promise<void>>(() => async () => {});
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const triggerDeleteConfirmation = (title: string, message: string, itemName: string | undefined, onConfirm: () => Promise<void>) => {
    setDeleteModalTitle(title);
    setDeleteModalMessage(message);
    setDeleteModalItemName(itemName);
    setDeleteModalOnConfirm(() => async () => {
      setIsDeleting(true);
      try {
        await onConfirm();
        setDeleteModalOpen(false);
      } catch (err) {
        console.error('Error during deletion:', err);
      } finally {
        setIsDeleting(false);
      }
    });
    setDeleteModalOpen(true);
  };

  // Firestore DB states
  const [clients, setClients] = useState<Client[]>([]);
  const [ledgers, setLedgers] = useState<ClientLedger[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<PaymentCollection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

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

  // Products Master UI and Form States
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    pricingType: 'Fixed Price' as 'Fixed Price' | 'Per Branch' | 'Monthly Price' | 'Yearly Price',
    status: 'Active' as Product['status']
  });

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [productSortField, setProductSortField] = useState<'name' | 'code' | 'category' | 'monthlyPrice' | 'yearlyPrice'>('name');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('asc');
  const [productCurrentPage, setProductCurrentPage] = useState(1);
  const productItemsPerPage = 8;

  // --- Filtered and sorted products list ---
  const filteredAndSortedProducts = products
    .filter(p => {
      const term = productSearchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term);
      const matchesStatus = productStatusFilter === 'ALL' || p.status === productStatusFilter;
      const matchesCategory = productCategoryFilter === 'ALL' || p.category === productCategoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      let valA = a[productSortField] || '';
      let valB = b[productSortField] || '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return productSortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();

      if (valA < valB) return productSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return productSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // Pagination for products
  const productTotalPages = Math.max(1, Math.ceil(filteredAndSortedProducts.length / productItemsPerPage));
  const productStartIndex = (productCurrentPage - 1) * productItemsPerPage;
  const productPaginatedList = filteredAndSortedProducts.slice(productStartIndex, productStartIndex + productItemsPerPage);

  // Get unique categories list for product filter option
  const productCategoriesList = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  // Form input states
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    companyName: '',
    mobileNumber: '',
    whatsAppNumber: '',
    email: '',
    address: '',
    notes: '',
    status: 'Active' as 'Active' | 'Inactive',
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
    productId: '',
    productName: '',
    productCategory: '',
    planName: '',
    billingCycle: 'Monthly' as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly',
    subscriptionFee: 0,
    monthlyFee: 0,
    yearlyFee: 0,
    branchCount: 1,
    startDate: new Date().toISOString().split('T')[0],
    renewalDate: '',
    status: 'Active' as Subscription['status'],
    notes: '',
    expiryDate: ''
  });

  // Flag to know we are quick-adding from subscription setup
  const [quickAddCallback, setQuickAddCallback] = useState<boolean>(false);

  // Helper calculation for product billing cycles
  const calculateSubscriptionUpdates = (
    selectedProd: Product | null | undefined,
    cycle: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly',
    startDateStr: string,
    branchCountValue: number = 1
  ) => {
    if (!selectedProd) return { fee: 0, monthlyFee: 0, yearlyFee: 0, renewal: '' };

    const baseMonthly = Number(selectedProd.monthlyPrice) || 0;
    const baseYearly = Number(selectedProd.yearlyPrice) || 0;
    const pricingType = selectedProd.pricingType || 'Fixed Price';
    const branches = Math.max(1, Number(branchCountValue) || 1);

    // Calculate Monthly & Yearly values
    let calculatedMonthlyFee = 0;
    let calculatedYearlyFee = 0;

    if (pricingType === 'Per Branch') {
      calculatedMonthlyFee = baseMonthly * branches;
      calculatedYearlyFee = (baseYearly || (baseMonthly * 12)) * branches;
    } else if (pricingType === 'Fixed Price' || pricingType === 'Monthly Price') {
      calculatedMonthlyFee = baseMonthly;
      calculatedYearlyFee = baseYearly || (baseMonthly * 12);
    } else if (pricingType === 'Yearly Price') {
      calculatedYearlyFee = baseYearly || (baseMonthly * 12);
      calculatedMonthlyFee = calculatedYearlyFee / 12;
    }

    // Calculate subscriptionFee for the selected billing cycle
    let fee = 0;
    if (cycle === 'Monthly') {
      fee = calculatedMonthlyFee;
    } else if (cycle === 'Quarterly') {
      fee = calculatedMonthlyFee * 3;
    } else if (cycle === 'Half-Yearly') {
      fee = calculatedMonthlyFee * 6;
    } else if (cycle === 'Yearly') {
      fee = calculatedYearlyFee;
    }

    let renewal = '';
    if (startDateStr) {
      const d = new Date(startDateStr);
      if (!isNaN(d.getTime())) {
        let months = 1;
        if (cycle === 'Quarterly') months = 3;
        else if (cycle === 'Half-Yearly') months = 6;
        else if (cycle === 'Yearly') months = 12;

        d.setMonth(d.getMonth() + months);
        renewal = d.toISOString().split('T')[0];
      }
    }

    return { 
      fee, 
      monthlyFee: calculatedMonthlyFee, 
      yearlyFee: calculatedYearlyFee, 
      renewal 
    };
  };

  // Synchronise subscription fee and next renewal date when product, billing cycle, or start date changes
  useEffect(() => {
    if (!subscriptionForm.productId) return;
    const selectedProd = products.find(p => p.id === subscriptionForm.productId);
    if (!selectedProd) return;

    const { fee, monthlyFee, yearlyFee, renewal } = calculateSubscriptionUpdates(
      selectedProd,
      subscriptionForm.billingCycle,
      subscriptionForm.startDate,
      subscriptionForm.branchCount
    );

    setSubscriptionForm(prev => {
      if (
        prev.subscriptionFee === fee && 
        prev.monthlyFee === monthlyFee && 
        prev.yearlyFee === yearlyFee && 
        prev.renewalDate === renewal
      ) return prev;
      return {
        ...prev,
        subscriptionFee: fee,
        monthlyFee: monthlyFee,
        yearlyFee: yearlyFee,
        renewalDate: renewal
      };
    });
  }, [subscriptionForm.productId, subscriptionForm.billingCycle, subscriptionForm.startDate, subscriptionForm.branchCount, products]);

  // Product Search Dropdown States
  const [prodSearchVal, setProdSearchVal] = useState('');
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);

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
    const unsubProducts = subscribeToProducts(userId, setProducts);

    return () => {
      unsubClients();
      unsubLedgers();
      unsubProjects();
      unsubSubscriptions();
      unsubReceivables();
      unsubPayments();
      unsubProducts();
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
    setClientFormError(null);

    if (!clientForm.name.trim()) {
      setClientFormError("Client Name is a required field.");
      return;
    }

    const initialDebt = Number(clientForm.balance) || 0;
    if (initialDebt < 0) {
      setClientFormError("Initial Outstanding Debt Balance cannot be negative.");
      return;
    }

    if (editingClientId) {
      // Validate ownerId before updating
      const existingClient = clients.find(c => c.id === editingClientId);
      if (!existingClient) {
        setClientFormError("Client records not found.");
        return;
      }
      if (existingClient.userId !== userId) {
        setClientFormError("Security Error: You do not have permission to edit this Client profile.");
        return;
      }

      // Find the existing opening balance log entry
      const openingEntry = ledgers.find(l => l.clientId === editingClientId && l.type === 'Opening Balance');

      try {
        await editClientAndAdjustOpeningBalance(
          editingClientId,
          userId,
          {
            name: clientForm.name,
            companyName: clientForm.companyName || '',
            mobileNumber: clientForm.mobileNumber || '',
            whatsAppNumber: clientForm.whatsAppNumber || '',
            email: clientForm.email || '',
            address: clientForm.address || '',
            notes: clientForm.notes || '',
            status: clientForm.status || 'Active',
            initialDebt
          },
          openingEntry,
          existingClient.balance || 0
        );

        alert("Client profile updated successfully!");
        setShowClientModal(false);
        setEditingClientId(null);
        setClientForm({
          name: '',
          companyName: '',
          mobileNumber: '',
          whatsAppNumber: '',
          email: '',
          address: '',
          notes: '',
          status: 'Active',
          balance: 0
        });
      } catch (err: any) {
        setClientFormError(err.message || "Failed to edit client profile.");
      }
    } else {
      // Normal creation mode
      try {
        const payload = {
          userId,
          name: clientForm.name,
          companyName: clientForm.companyName || '',
          mobileNumber: clientForm.mobileNumber || '',
          whatsAppNumber: clientForm.whatsAppNumber || '',
          email: clientForm.email || '',
          address: clientForm.address || '',
          notes: clientForm.notes || '',
          status: clientForm.status || 'Active',
          balance: 0
        };

        const newId = await addClient(payload);
        if (newId && initialDebt > 0) {
          await addLedgerEntry({
            userId,
            clientId: newId,
            clientName: payload.name,
            date: new Date().toISOString().split('T')[0],
            type: 'Opening Balance',
            description: 'Opening Outstanding Balance Contribution',
            debit: initialDebt,
            credit: 0,
            runningBalance: initialDebt
          });
        }

        alert("Client profile created successfully!");
        setShowClientModal(false);
        setClientForm({
          name: '',
          companyName: '',
          mobileNumber: '',
          whatsAppNumber: '',
          email: '',
          address: '',
          notes: '',
          status: 'Active',
          balance: 0
        });
      } catch (err: any) {
        setClientFormError(err.message || "Failed to create client.");
      }
    }
  };

  const handleEditClientClick = (client: Client) => {
    setEditingClientId(client.id);
    setClientFormError(null);

    // Find the opening balance if it exists
    const openingEntry = ledgers.find(l => l.clientId === client.id && l.type === 'Opening Balance');
    const openingBalanceAmount = openingEntry ? (openingEntry.debit || 0) : 0;

    setClientForm({
      name: client.name || '',
      companyName: client.companyName || '',
      mobileNumber: client.mobileNumber || '',
      whatsAppNumber: client.whatsAppNumber || '',
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || '',
      status: client.status || 'Active',
      balance: openingBalanceAmount
    });

    setShowClientModal(true);
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

  // --- Products Master Management Handlers ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    const payload = {
      ownerId: userId,
      name: productForm.name.trim(),
      code: productForm.code.trim() || undefined,
      category: productForm.category.trim() || 'Software Plan',
      description: productForm.description.trim() || '',
      monthlyPrice: Number(productForm.monthlyPrice) || 0,
      yearlyPrice: Number(productForm.yearlyPrice) || 0,
      pricingType: productForm.pricingType || 'Fixed Price',
      status: productForm.status
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        const newId = await addProduct(payload);
        if (newId && quickAddCallback) {
          // If we are quick adding from subscription setup form, select it immediately
          const { fee, monthlyFee, yearlyFee, renewal } = calculateSubscriptionUpdates(
            { id: newId, ...payload } as Product,
            subscriptionForm.billingCycle,
            subscriptionForm.startDate,
            subscriptionForm.branchCount
          );

          setSubscriptionForm(prev => ({
            ...prev,
            productId: newId,
            productName: payload.name,
            productCategory: payload.category,
            monthlyFee: monthlyFee,
            subscriptionFee: fee,
            yearlyFee: yearlyFee,
            renewalDate: renewal
          }));
        }
      }

      setShowProductModal(false);
      setEditingProduct(null);
      setQuickAddCallback(false);
      setProductForm({
        name: '',
        code: '',
        category: '',
        description: '',
        monthlyPrice: 0,
        yearlyPrice: 0,
        pricingType: 'Fixed Price',
        status: 'Active'
      });
    } catch (err) {
      console.error("Error saving product: ", err);
    }
  };

  const handleEditProductClick = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      code: prod.code || '',
      category: prod.category || '',
      description: prod.description || '',
      monthlyPrice: prod.monthlyPrice || 0,
      yearlyPrice: prod.yearlyPrice || 0,
      pricingType: prod.pricingType || 'Fixed Price',
      status: prod.status || 'Active'
    });
    setQuickAddCallback(false);
    setShowProductModal(true);
  };

  const handleEditSubscriptionClick = (sub: Subscription) => {
    setEditingSubscription(sub);
    setSubscriptionForm({
      clientId: sub.clientId || '',
      productId: sub.productId || '',
      productName: sub.productName || '',
      productCategory: sub.productCategory || '',
      planName: sub.planName || '',
      billingCycle: sub.billingCycle || 'Monthly',
      subscriptionFee: sub.subscriptionFee || sub.monthlyFee || 0,
      monthlyFee: sub.monthlyFee || 0,
      yearlyFee: sub.yearlyFee || 0,
      branchCount: sub.branchCount || 1,
      startDate: sub.startDate || '',
      renewalDate: sub.renewalDate || '',
      status: sub.status || 'Active',
      notes: sub.notes || '',
      expiryDate: sub.expiryDate || ''
    });
    setShowSubscriptionModal(true);
  };

  const toggleProdSort = (field: 'name' | 'code' | 'category' | 'monthlyPrice' | 'yearlyPrice') => {
    if (productSortField === field) {
      setProductSortOrder(productSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setProductSortField(field);
      setProductSortOrder('asc');
    }
    setProductCurrentPage(1);
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionForm.clientId || !subscriptionForm.productName.trim() || subscriptionForm.subscriptionFee <= 0) return;

    const matchedClient = clients.find(c => c.id === subscriptionForm.clientId);
    if (!matchedClient) return;

    const payload: any = {
      userId,
      clientId: subscriptionForm.clientId,
      clientName: matchedClient.name,
      productName: subscriptionForm.productName,
      planName: subscriptionForm.planName || `${subscriptionForm.billingCycle} Contract`,
      monthlyFee: Number(subscriptionForm.monthlyFee),
      startDate: subscriptionForm.startDate,
      renewalDate: subscriptionForm.renewalDate,
      status: subscriptionForm.status,
      notes: subscriptionForm.notes || '',

      // Upgraded schema fields
      productId: subscriptionForm.productId,
      billingCycle: subscriptionForm.billingCycle,
      subscriptionFee: Number(subscriptionForm.subscriptionFee),
      productCategory: subscriptionForm.productCategory,
      branchCount: Number(subscriptionForm.branchCount) || 1,
      yearlyFee: Number(subscriptionForm.yearlyFee) || 0,
      expiryDate: subscriptionForm.expiryDate || ''
    };

    try {
      if (editingSubscription) {
        // Validate user owner
        if (editingSubscription.userId !== userId) {
          setErrorMessage("Unauthorized: You can only edit your own contracts.");
          setTimeout(() => setErrorMessage(''), 4000);
          return;
        }

        // Add / Update updatedAt
        payload.updatedAt = new Date().toISOString();

        await updateSubscription(editingSubscription.id, payload);
        setSuccessMessage("Contract updated successfully!");
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        await addSubscription(payload);
        setSuccessMessage("Contract established successfully!");
        setTimeout(() => setSuccessMessage(''), 4000);
      }

      setShowSubscriptionModal(false);
      setEditingSubscription(null);
      setSubscriptionForm({
        clientId: '',
        productId: '',
        productName: '',
        productCategory: '',
        planName: '',
        billingCycle: 'Monthly',
        subscriptionFee: 0,
        monthlyFee: 0,
        yearlyFee: 0,
        branchCount: 1,
        startDate: new Date().toISOString().split('T')[0],
        renewalDate: '',
        status: 'Active',
        notes: '',
        expiryDate: ''
      });
    } catch (error) {
      console.error("Error saving subscription:", error);
      setErrorMessage(editingSubscription ? "Failed to update contract." : "Failed to establish contract.");
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const handleRenewSubscription = async (sub: Subscription) => {
    try {
      const branches = sub.branchCount || 1;
      const cycle = sub.billingCycle || 'Monthly';
      const currentRenewalStr = sub.renewalDate || new Date().toISOString().split('T')[0];

      // Calculate next renewal date
      const d = new Date(currentRenewalStr);
      let months = 1;
      if (cycle === 'Quarterly') months = 3;
      else if (cycle === 'Half-Yearly') months = 6;
      else if (cycle === 'Yearly') months = 12;

      d.setMonth(d.getMonth() + months);
      const nextRenewalStr = d.toISOString().split('T')[0];

      const branchText = branches > 0 ? ` (${branches} Branch${branches > 1 ? 'es' : ''})` : '';
      const cycleText = ` - ${cycle} Renewal`;
      const description = `Subscription Charge: ${sub.productName}${branchText}${cycleText}`;
      const chargeAmount = sub.subscriptionFee !== undefined ? sub.subscriptionFee : (sub.monthlyFee * months);

      // 1. Create client ledger entry
      await addLedgerEntry({
        userId,
        clientId: sub.clientId,
        date: currentRenewalStr,
        type: 'Subscription Charge',
        description,
        debit: chargeAmount,
        credit: 0,
        runningBalance: 0
      });

      // 2. Create receivable invoice
      await addReceivable({
        userId,
        clientId: sub.clientId,
        clientName: sub.clientName,
        amount: chargeAmount,
        dueDate: currentRenewalStr, // due on cycle start/renewal date
        description: `Subscription Renewal Fee: ${sub.productName}${branchText}`,
        status: 'Pending',
        amountPaid: 0
      });

      // 3. Update subscription document
      await updateSubscription(sub.id, {
        startDate: currentRenewalStr,
        renewalDate: nextRenewalStr
      });

      alert(`Successfully renewed contract for ${sub.clientName}! Advanced renewal till ${nextRenewalStr}, and logged ${chargeAmount} BDT invoice/ledger entry.`);
    } catch (err) {
      console.error("Error renewing subscription: ", err);
      alert("Failed to renew contract.");
    }
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
    const isDebit = ['Project Charge', 'Subscription Charge', 'Adjustment', 'Opening Balance'].includes(ledgerEntryForm.type);
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
            onClick={() => {
              setEditingClientId(null);
              setClientFormError(null);
              setClientForm({
                name: '',
                companyName: '',
                mobileNumber: '',
                whatsAppNumber: '',
                email: '',
                address: '',
                notes: '',
                status: 'Active',
                balance: 0
              });
              setShowClientModal(true);
            }}
            id="add-client-nav-btn"
            className="flex items-center gap-2 bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white rounded-xl px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-all shadow-md"
          >
            <Plus size={16} /> Client
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            id="add-payment-nav-btn"
            className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-xs font-semibold hover:bg-emerald-700 transition-all shadow-md"
          >
            <Plus size={16} /> Collect
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-55 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 rounded-xl text-center font-semibold border border-emerald-200 dark:border-emerald-800 animate-fadeIn text-xs">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-55 dark:bg-rose-950/25 text-rose-850 dark:text-rose-400 rounded-xl text-center font-semibold border border-rose-200 dark:border-rose-800 animate-fadeIn text-xs">
          {errorMessage}
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-805 gap-1 pb-1">
        {[
          { tab: 'dashboard', name: 'Dashboard', icon: Users },
          { tab: 'clients', name: 'Clients', icon: Users },
          { tab: 'products', name: 'Products', icon: Package },
          { tab: 'projects', name: 'Projects', icon: Briefcase },
          { tab: 'subscriptions', name: 'Contracts', icon: CreditCard },
          { tab: 'receivables', name: 'Receivable', icon: TrendingUp },
          { tab: 'payments', name: 'Payment', icon: DollarSign },
          { tab: 'reports', name: 'Reports', icon: BarChart3 }
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
            <h2 className="text-xl font-bold">Clients</h2>
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
                        {client.status === 'Inactive' && (
                          <span className="ml-2 bg-rose-50 text-rose-500 dark:bg-rose-950/20 dark:text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                            Inactive
                          </span>
                        )}
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
                          onClick={() => handleEditClientClick(client)}
                          className="bg-zinc-100 text-zinc-900 hover:bg-zinc-250 dark:bg-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight inline-flex items-center gap-1"
                        >
                          Edit <Edit2 size={11} />
                        </button>
                        <button
                          onClick={() => {
                            triggerDeleteConfirmation(
                              'Confirm Deletion',
                              'Are you sure you want to delete this client? This action cannot be undone.',
                              `Client: ${client.name}`,
                              async () => {
                                await deleteClient(client.id);
                              }
                            );
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
                            triggerDeleteConfirmation(
                              'Confirm Deletion',
                              'Are you sure you want to remove custom project details? This action cannot be undone.',
                              `Project: ${proj.projectName}`,
                              async () => {
                                await deleteProject(proj.id);
                              }
                            );
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
              <h2 className="text-xl font-bold">Contracts</h2>
              <button
                onClick={() => {
                  setEditingSubscription(null);
                  setSubscriptionForm({
                    clientId: '',
                    productId: '',
                    productName: '',
                    productCategory: '',
                    planName: '',
                    billingCycle: 'Monthly',
                    subscriptionFee: 0,
                    monthlyFee: 0,
                    yearlyFee: 0,
                    branchCount: 1,
                    startDate: new Date().toISOString().split('T')[0],
                    renewalDate: '',
                    status: 'Active',
                    notes: '',
                    expiryDate: ''
                  });
                  setShowSubscriptionModal(true);
                }}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> Contract
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
                  <th className="py-3 px-4">Contract Fee / Billing</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Renewal Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
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
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-50 font-sans">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{sub.productName}</span>
                          {sub.branchCount && sub.branchCount > 1 && (
                            <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 text-[9.5px] px-2 py-0.5 rounded-full font-bold">
                              {sub.branchCount} Branches
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-zinc-455 font-normal tracking-wide">{sub.planName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400">{sub.clientName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        <div>{renderMoney(sub.subscriptionFee || sub.monthlyFee)}</div>
                        <div className="text-[9px] font-sans text-zinc-400 font-normal select-none lowercase mt-0.5">
                          / {sub.billingCycle || 'Monthly'}
                        </div>
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
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <button
                            onClick={() => handleRenewSubscription(sub)}
                            className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-xl text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Renew Contract & Create Invoice / Ledger Entry"
                          >
                            <Repeat size={11} /> Renew
                          </button>
                          <button
                            onClick={() => handleEditSubscriptionClick(sub)}
                            className="hover:text-blue-500 text-zinc-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Edit Contract"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              triggerDeleteConfirmation(
                                'Confirm Deletion',
                                'Are you sure you want to delete this recurring contract? This action cannot be undone.',
                                `Contract: ${sub.productName}`,
                                async () => {
                                  await deleteSubscription(sub.id);
                                }
                              );
                            }}
                            className="hover:text-rose-500 text-zinc-400 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Delete Contract"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
                              triggerDeleteConfirmation(
                                'Confirm Deletion',
                                'Are you sure you want to void this invoice? This action cannot be undone.',
                                `Invoice: ${rec.invoiceNumber}`,
                                async () => {
                                  await deleteReceivable(rec.id);
                                }
                              );
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
                            triggerDeleteConfirmation(
                              'Confirm Deletion',
                              'Are you sure you want to void this payment collection? Balance will automatically adjustment reconcile. This action cannot be undone.',
                              `Payment: ${renderMoney(pay.amount)} from ${pay.clientName}`,
                              async () => {
                                await deletePayment(pay.id);
                              }
                            );
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

      {/* TAB: PRODUCTS CATALOG (MASTER LIST) */}
      {activeTab === 'products' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Products Master Catalog</h2>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({
                    name: '',
                    code: '',
                    category: '',
                    description: '',
                    monthlyPrice: 0,
                    yearlyPrice: 0,
                    pricingType: 'Fixed Price',
                    status: 'Active'
                  });
                  setQuickAddCallback(false);
                  setShowProductModal(true);
                }}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1 cursor-pointer select-none"
              >
                <Plus size={14} /> New Product
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search bar */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-2">
                <Search className="text-zinc-400 shrink-0" size={16} />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={productSearchTerm}
                  onChange={e => {
                    setProductSearchTerm(e.target.value);
                    setProductCurrentPage(1);
                  }}
                  className="bg-transparent border-0 ring-0 focus:outline-none text-xs w-52 text-zinc-900 dark:text-zinc-50"
                />
              </div>

              {/* Status Filter */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-1">
                <Filter className="text-zinc-400 shrink-0" size={14} />
                <select
                  value={productStatusFilter}
                  onChange={e => {
                    setProductStatusFilter(e.target.value);
                    setProductCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs outline-none pr-2 cursor-pointer text-zinc-750 dark:text-zinc-300"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive Only</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-1.5 items-center gap-1">
                <Filter className="text-zinc-400 shrink-0" size={14} />
                <select
                  value={productCategoryFilter}
                  onChange={e => {
                    setProductCategoryFilter(e.target.value);
                    setProductCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs outline-none pr-1.5 cursor-pointer text-zinc-750 dark:text-zinc-300"
                >
                  <option value="ALL">All Categories</option>
                  {productCategoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-medium uppercase tracking-wider">
                  <th
                    onClick={() => toggleProdSort('name')}
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Product Name {productSortField === 'name' && (productSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => toggleProdSort('code')}
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    SKU Code / ID {productSortField === 'code' && (productSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => toggleProdSort('category')}
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Category {productSortField === 'category' && (productSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4">Pricing Type</th>
                  <th
                    onClick={() => toggleProdSort('monthlyPrice')}
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Monthly Price {productSortField === 'monthlyPrice' && (productSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => toggleProdSort('yearlyPrice')}
                    className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                  >
                    Yearly Price {productSortField === 'yearlyPrice' && (productSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {productPaginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-450">
                      No master products matched your search or filter options.
                    </td>
                  </tr>
                ) : (
                  productPaginatedList.map(prod => (
                    <tr
                      key={prod.id}
                      className="border-b border-zinc-50 dark:border-zinc-850 hover:bg-zinc-55/50 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-50">
                        {prod.name}
                        {prod.description && (
                          <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5 max-w-xs truncate">
                            {prod.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-500">{prod.code || '-'}</td>
                      <td className="py-3.5 px-4 text-zinc-650 dark:text-zinc-450">
                        <span className="bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded text-[10px] font-semibold text-zinc-650 tracking-wide">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-650 dark:text-zinc-450">
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wide ${
                          prod.pricingType === 'Per Branch'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/25 dark:text-blue-400'
                            : 'bg-zinc-10/50 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400'
                        }`}>
                          {prod.pricingType || 'Fixed Price'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-350">
                        {renderMoney(prod.monthlyPrice || 0)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-350">
                        {prod.yearlyPrice ? renderMoney(prod.yearlyPrice) : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          prod.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {prod.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditProductClick(prod)}
                            className="hover:text-indigo-600 text-zinc-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              triggerDeleteConfirmation(
                                'Confirm Deletion',
                                'Are you sure you want to delete this product? This action cannot be undone.',
                                `Product: ${prod.name}`,
                                async () => {
                                  await deleteProduct(prod.id);
                                }
                              );
                            }}
                            className="hover:text-rose-500 text-zinc-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {filteredAndSortedProducts.length > productItemsPerPage && (
            <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 text-xs">
              <span className="text-zinc-500">
                Found {filteredAndSortedProducts.length} items (Page {productCurrentPage} of {productTotalPages})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={productCurrentPage === 1}
                  onClick={() => setProductCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 disabled:opacity-50 select-none cursor-pointer"
                >
                  Previous
                </button>
                {Array.from({ length: productTotalPages }, (_, i) => i + 1).map(pageNo => (
                  <button
                    key={pageNo}
                    onClick={() => setProductCurrentPage(pageNo)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold select-none cursor-pointer ${
                      productCurrentPage === pageNo
                        ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950 font-bold'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-55 dark:hover:bg-zinc-800 text-zinc-650'
                    }`}
                  >
                    {pageNo}
                  </button>
                ))}
                <button
                  disabled={productCurrentPage === productTotalPages}
                  onClick={() => setProductCurrentPage(prev => Math.min(productTotalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 disabled:opacity-50 select-none cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: REVENUE REPORTS (FINANCIAL SaaS INSIGHTS) */}
      {activeTab === 'reports' && (() => {
        const activeContracts = subscriptions.filter(s => s.status === 'Active');
        
        // Sum MRR
        const totalMRR = activeContracts.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
        
        // Sum ARR
        const totalARR = activeContracts.reduce((sum, s) => sum + (s.yearlyFee || (s.monthlyFee * 12) || 0), 0);
        
        // Sum Branches managed
        const managedBranches = activeContracts.reduce((sum, s) => sum + (s.branchCount || 1), 0);
        
        // Product Revenue Grouping
        const productDataObj: { [prodName: string]: { name: string, mrr: number, arr: number, count: number } } = {};
        activeContracts.forEach(s => {
          const name = s.productName || 'Unmapped SaaS';
          if (!productDataObj[name]) {
            productDataObj[name] = { name, mrr: 0, arr: 0, count: 0 };
          }
          productDataObj[name].mrr += s.monthlyFee || 0;
          productDataObj[name].arr += s.yearlyFee || (s.monthlyFee * 12) || 0;
          productDataObj[name].count += 1;
        });
        const productDataArray = Object.values(productDataObj);

        // Revenue by Branch Grouping
        const branchContracts = activeContracts.filter(s => {
          const pRef = products.find(prod => prod.id === s.productId);
          return pRef?.pricingType === 'Per Branch';
        });

        // Sum branch mrr
        const branchMRR = branchContracts.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);

        return (
          <div className="space-y-6">
            {/* Metric Bento Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Monthly Subscription Revenue (MRR)</div>
                <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{renderMoney(totalMRR)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Cumulative SaaS recurring MRR</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Annual Subscription Revenue (ARR)</div>
                <div className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{renderMoney(totalARR)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Projected annual ARR run rate</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Branch SaaS Revenue</div>
                <div className="font-mono text-2xl font-semibold text-zinc-850 dark:text-zinc-150 mt-1">{renderMoney(branchMRR)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">MRR from branch-based billings</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
                <div className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Branches Under Administration</div>
                <div className="text-2xl font-black text-zinc-850 dark:text-zinc-100 font-mono mt-1">{managedBranches}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Total active branches deployed</div>
              </div>
            </div>

            {/* Product Revenues and charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product MRR Breakdown chart */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 p-5 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">MRR contribution by Product catalog</h3>
                <div className="h-64 mt-2">
                  {productDataArray.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-400 text-xs">No active contract data to lay out stats.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productDataArray} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                        <XAxis dataKey="name" stroke="#A1A1AA" fontSize={10} tickLine={false} />
                        <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: '#18181B', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '11px' }}
                          formatter={(value) => [`${value} BDT`, 'MRR Contribution']}
                        />
                        <Bar dataKey="mrr" fill="#4B5563" radius={[4, 4, 0, 0]}>
                          {productDataArray.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#10B981' : '#6366F1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Product list table of details */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide mb-3">Product Revenue Breakdown Table</h3>
                  <div className="overflow-y-auto max-h-56 no-scrollbar">
                    <table className="w-full text-left text-xs text-zinc-500">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="pb-2">Product Name</th>
                          <th className="pb-2 text-center">Active Contracts</th>
                          <th className="pb-2 text-right">MRR Value</th>
                          <th className="pb-2 text-right">ARR Run-rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850">
                        {productDataArray.map((row, index) => (
                          <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                            <td className="py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{row.name}</td>
                            <td className="py-2.5 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">{row.count}</td>
                            <td className="py-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{renderMoney(row.mrr)}</td>
                            <td className="py-2.5 text-right font-mono font-medium text-zinc-650 dark:text-zinc-400">{renderMoney(row.arr)}</td>
                          </tr>
                        ))}
                        {productDataArray.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-zinc-450">No active products inside established subscription contracts.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue by Branch block */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">Revenue by Branch Contracts (Per-Branch SaaS model)</h3>
                  <p className="text-[10px] text-zinc-455 font-normal mt-0.5">List of active contracts where pricing is calculated per physical or virtual branch location.</p>
                </div>
                <div className="bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 px-3 py-1 text-xs font-bold rounded-xl font-mono">
                  Active locations: {managedBranches - (activeContracts.length - branchContracts.length)} Branches
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 px-2">Client Company</th>
                      <th className="pb-3 px-2">Product Name</th>
                      <th className="pb-3 px-2 text-center">Branch Count</th>
                      <th className="pb-3 px-2 text-right">Base unit Price</th>
                      <th className="pb-3 px-2 text-right">Monthly Billings (MRR)</th>
                      <th className="pb-3 px-2 text-right">Annual Run-rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850">
                    {branchContracts.map(sub => {
                      const basePrice = products.find(p => p.id === sub.productId)?.monthlyPrice || 0;
                      return (
                        <tr key={sub.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                          <td className="py-3 px-2 font-semibold text-zinc-900 dark:text-zinc-100">{sub.clientName}</td>
                          <td className="py-3 px-2 font-medium text-zinc-650 dark:text-zinc-400">{sub.productName}</td>
                          <td className="py-3 px-2 text-center">
                            <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-black font-mono text-[10.5px]">
                              {sub.branchCount || 1} Branches
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-zinc-500">{renderMoney(basePrice)} / unit</td>
                          <td className="py-3 px-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{renderMoney(sub.monthlyFee)}</td>
                          <td className="py-3 px-2 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">{renderMoney(sub.yearlyFee || (sub.monthlyFee * 12))}</td>
                        </tr>
                      );
                    })}
                    {branchContracts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-zinc-450">No clients are currently subscribed to a per-branch priced product.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- ALL INLINE POPUP DRAWER MODALS --- */}

      {/* MODAL: ADD/EDIT PRODUCT */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                  setQuickAddCallback(false);
                }}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 cursor-pointer"
              >
                <X size={16} />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Package size={18} /> {editingProduct ? 'Edit Master Product' : 'Add New Product'}
              </h2>
              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50"
                    placeholder="e.g. POS Subscription Plan A"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Product Code / SKU (Optional)</label>
                  <input
                    type="text"
                    value={productForm.code}
                    onChange={e => setProductForm({ ...productForm, code: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50 font-mono"
                    placeholder="e.g. POS-ADV-001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Category</label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50"
                    placeholder="e.g. Billing Software, Hardware, Consulting"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Pricing Type *</label>
                  <select
                    required
                    value={productForm.pricingType || 'Fixed Price'}
                    onChange={e => setProductForm({ ...productForm, pricingType: e.target.value as Product['pricingType'] })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-950 dark:text-zinc-50 font-semibold"
                  >
                    <option value="Fixed Price">Fixed Price (standard fixed rate)</option>
                    <option value="Per Branch">Per Branch (billed per branch)</option>
                    <option value="Monthly Price">Monthly Price</option>
                    <option value="Yearly Price">Yearly Price</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">
                    {productForm.pricingType === 'Per Branch' ? 'Monthly Price Per Branch *' : 'Monthly Price *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productForm.monthlyPrice}
                    onChange={e => setProductForm({ ...productForm, monthlyPrice: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50 font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">
                    {productForm.pricingType === 'Per Branch' ? 'Yearly Price Per Branch (Optional)' : 'Yearly Price (Optional)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.yearlyPrice}
                    onChange={e => setProductForm({ ...productForm, yearlyPrice: Number(e.target.value) })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50 font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Description</label>
                  <textarea
                    value={productForm.description}
                    onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50 h-16 resize-none"
                    placeholder="Write product specifications..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium">Status</label>
                  <select
                    value={productForm.status}
                    onChange={e => setProductForm({ ...productForm, status: e.target.value as Product['status'] })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide select-none cursor-pointer hover:bg-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product Master'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                <Users size={18} /> {editingClientId ? 'Edit Client Profile' : 'Add Client Profile'}
              </h2>
              {clientFormError && (
                <div id="client-form-error" className="bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 p-3 rounded-xl flex items-center gap-2 mb-4 text-xs font-semibold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{clientFormError}</span>
                </div>
              )}
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
                  <label className="text-zinc-500 font-medium">Notes</label>
                  <textarea
                    value={clientForm.notes}
                    onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2 outline-none font-sans"
                    placeholder="e.g. contract comments, special billing needs..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Status *</label>
                    <select
                      value={clientForm.status || 'Active'}
                      onChange={e => setClientForm({ ...clientForm, status: e.target.value as 'Active' | 'Inactive' })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-semibold text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
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
                </div>
                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl mt-2 tracking-wide"
                >
                  {editingClientId ? 'Save Changes' : 'Create Client Account'}
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
                <CreditCard size={18} /> {editingSubscription ? 'Edit Subscription Contract' : 'Establish Subscription Contract'}
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
                <div className="space-y-1 relative">
                  <label className="text-zinc-500 font-medium tracking-wide">Product / Plan Selection *</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsProdDropdownOpen(!isProdDropdownOpen)}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50 text-left flex justify-between items-center cursor-pointer font-medium"
                    >
                      <span>
                        {subscriptionForm.productName
                          ? `${subscriptionForm.productName} (${subscriptionForm.productCategory || 'SaaS'})`
                          : '-- Choose From Products Master --'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">▼</span>
                    </button>

                    {isProdDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-3 z-[60] max-h-72 overflow-y-auto no-scrollbar space-y-2">
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1.5 items-center gap-1.5 ring-1 ring-zinc-200 dark:ring-zinc-700">
                          <Search size={13} className="text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Find active product master..."
                            value={prodSearchVal}
                            onChange={e => setProdSearchVal(e.target.value)}
                            onKeyDown={e => e.stopPropagation()}
                            className="bg-transparent border-0 outline-none text-xs w-full text-zinc-900 dark:text-zinc-50"
                          />
                        </div>

                        <div className="space-y-0.5 max-h-40 overflow-y-auto no-scrollbar">
                          {products
                            .filter(p => {
                              if (p.status !== 'Active') return false;
                              const keyword = prodSearchVal.toLowerCase();
                              return p.name.toLowerCase().includes(keyword) || (p.code || '').toLowerCase().includes(keyword);
                            })
                            .map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  const { fee, renewal } = calculateSubscriptionUpdates(
                                    p,
                                    subscriptionForm.billingCycle,
                                    subscriptionForm.startDate
                                  );

                                  setSubscriptionForm({
                                    ...subscriptionForm,
                                    productId: p.id,
                                    productName: p.name,
                                    productCategory: p.category || '',
                                    planName: p.code || `${subscriptionForm.billingCycle} Contract`,
                                    monthlyFee: p.monthlyPrice || 0,
                                    subscriptionFee: fee,
                                    renewalDate: renewal
                                  });
                                  setIsProdDropdownOpen(false);
                                  setProdSearchVal('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors flex justify-between items-center cursor-pointer select-none"
                              >
                                <div>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</div>
                                  {p.code && <div className="text-[8px] text-zinc-400 font-mono">Code: {p.code}</div>}
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-bold text-zinc-700 dark:text-zinc-350">{renderMoney(p.monthlyPrice || 0)}</div>
                                  <div className="text-[7px] text-zinc-400 uppercase">/ mo</div>
                                </div>
                              </button>
                            ))}

                          {products.filter(p => {
                            if (p.status !== 'Active') return false;
                            const keyword = prodSearchVal.toLowerCase();
                            return p.name.toLowerCase().includes(keyword) || (p.code || '').toLowerCase().includes(keyword);
                          }).length === 0 && (
                            <div className="text-center py-4 text-zinc-400 font-medium">
                              No active products found
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProdDropdownOpen(false);
                            setProductForm({
                              name: prodSearchVal,
                              code: '',
                              category: 'Software SaaS',
                              description: '',
                              monthlyPrice: 0,
                              yearlyPrice: 0,
                              status: 'Active'
                            });
                            setQuickAddCallback(true);
                            setShowProductModal(true);
                          }}
                          className="w-full text-left text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-3 py-2 rounded-lg border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                        >
                          <Plus size={12} /> + Add New Product
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Billing Cycle *</label>
                    <select
                      required
                      value={subscriptionForm.billingCycle}
                      onChange={e => {
                        const newCycle = e.target.value as 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
                        setSubscriptionForm(prev => ({
                          ...prev,
                          billingCycle: newCycle
                        }));
                      }}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-semibold text-zinc-900 dark:text-zinc-50"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium">Branches *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={subscriptionForm.branchCount || 1}
                      onChange={e => {
                        const count = Math.max(1, Number(e.target.value) || 1);
                        setSubscriptionForm(prev => ({
                          ...prev,
                          branchCount: count
                        }));
                      }}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Calculated Fee *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={subscriptionForm.subscriptionFee}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, subscriptionFee: Number(e.target.value) })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      placeholder="e.g. 59"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Monthly Fee *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={subscriptionForm.monthlyFee}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, monthlyFee: Number(e.target.value) })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Yearly Fee *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={subscriptionForm.yearlyFee}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, yearlyFee: Number(e.target.value) })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none font-mono font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium font-semibold">Plan Contract Code / Reference</label>
                  <input
                    type="text"
                    value={subscriptionForm.planName}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, planName: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2.5 outline-none text-zinc-900 dark:text-zinc-50"
                    placeholder="e.g. POS-Monthly, Tier-1-Enterprise"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={subscriptionForm.startDate}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-1.5 py-2.5 outline-none font-mono text-[10px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Renewal Date *</label>
                    <input
                      type="date"
                      required
                      value={subscriptionForm.renewalDate}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, renewalDate: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-1.5 py-2.5 outline-none font-mono text-[10px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-medium font-semibold">Expiry Date</label>
                    <input
                      type="date"
                      value={subscriptionForm.expiryDate || ''}
                      onChange={e => setSubscriptionForm({ ...subscriptionForm, expiryDate: e.target.value })}
                      className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-1.5 py-2.5 outline-none font-mono text-[10px]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium font-semibold">Status State</label>
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
                
                <div className="space-y-1">
                  <label className="text-zinc-500 font-medium font-semibold">Notes / Discussion Terms</label>
                  <textarea
                    value={subscriptionForm.notes || ''}
                    onChange={e => setSubscriptionForm({ ...subscriptionForm, notes: e.target.value })}
                    className="w-full bg-zinc-55 dark:bg-zinc-800 border-0 rounded-xl px-3 py-2 outline-none h-16 resize-none"
                    placeholder="Enter special pricing agreements or details..."
                  />
                </div>
                
                {/* LIVE CALCULATED PRICE PREVIEW */}
                {subscriptionForm.productId && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/45 p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-2">
                    <div className="text-zinc-450 uppercase text-[9px] tracking-wider font-extrabold flex justify-between items-center">
                      <span>Contract Pricing Summary</span>
                      <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 text-[8.5px] px-1.5 py-0.5 rounded uppercase font-bold">Live Calc</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Selected Product:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{subscriptionForm.productName}</span>
                    </div>
                    {(() => {
                      const selectedProd = products.find(p => p.id === subscriptionForm.productId);
                      const pricingType = selectedProd?.pricingType || 'Fixed Price';
                      const baseMonthly = Number(selectedProd?.monthlyPrice || 0);

                      return (
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between text-zinc-500">
                            <span>Pricing Rule:</span>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">{pricingType}</span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Base Monthly Rate:</span>
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatCurrency(baseMonthly)} / unit</span>
                          </div>
                          
                          {pricingType === 'Per Branch' && (
                            <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-1.5 mt-1 font-mono text-zinc-500 flex justify-between">
                              <span>Per-Branch Multiplier:</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatCurrency(baseMonthly)} × {subscriptionForm.branchCount || 1} Branches</span>
                            </div>
                          )}

                          <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-750 pt-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                            <span>Live Monthly Fee:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(subscriptionForm.monthlyFee)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-450 font-medium">
                            <span>Live Yearly Fee:</span>
                            <span className="font-mono">{formatCurrency(subscriptionForm.yearlyFee || (subscriptionForm.monthlyFee * 12))}</span>
                          </div>
                          <div className="flex justify-between font-extrabold border-t border-zinc-200 dark:border-zinc-750 pt-1.5 text-indigo-600 dark:text-indigo-400">
                            <span>Current {subscriptionForm.billingCycle} Fee:</span>
                            <span className="font-mono text-xs">{formatCurrency(subscriptionForm.subscriptionFee)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 text-white font-bold py-2.5 rounded-xl tracking-wide"
                >
                  {editingSubscription ? 'Save Contract Changes' : 'Confirm Subscription Fee Setup'}
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
                                  triggerDeleteConfirmation(
                                    'Confirm Deletion',
                                    'Are you sure you want to delete this custom ledger entry? Client running balance will adjust back. This action cannot be undone.',
                                    `Ledger Entry: ${log.description || 'No description'}`,
                                    async () => {
                                      await deleteLedgerEntry(log.id);
                                    }
                                  );
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
                    <option value="Opening Balance">Opening Balance (Increases Balance)</option>
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

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        title={deleteModalTitle}
        message={deleteModalMessage}
        itemName={deleteModalItemName}
        onConfirm={deleteModalOnConfirm}
        onCancel={() => setDeleteModalOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
