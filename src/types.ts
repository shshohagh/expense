export interface User {
  id: string | number;
  email: string;
  name: string;
  role: 'USER' | 'SUPER_ADMIN' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCEL';
  currency: string;
  language: string;
  permissions: string[];
  phoneNumber?: string;
  created_at: string;
}

export interface Transaction {
  id: string | number;
  userId: string | number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  categoryId: string | number;
  categoryName?: string;
  date: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  isDemo?: boolean;
}

export interface Category {
  id: string | number;
  userId: string | number | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  isDemo?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPendingApproval?: boolean;
}

export interface Budget {
  id: string | number;
  userId: string | number;
  categoryId: string | number;
  categoryName?: string;
  categoryType?: 'INCOME' | 'EXPENSE';
  amount: number;
  period: 'MONTHLY' | 'YEARLY';
  created_at: string;
  isDemo?: boolean;
}

export interface Borrower {
  id: string;
  ownerId: string;
  fullName: string;
  mobileNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  address?: string;
  companyName?: string;
  notes?: string;
  status: 'Active' | 'Inactive';
  created_at?: any;
  updated_at?: any;
}

export interface Loan {
  id: string;
  userId: string;
  borrowerId?: string; // Optional for backward compatibility with existing records
  borrowerName: string;
  mobileNumber?: string;
  amount: number;
  givenDate: string;
  expectedReturnDate: string;
  notes?: string;
  status: 'Pending' | 'Partially Paid' | 'Paid';
  created_at?: any;
  deleted_at?: any;
  isDemo?: boolean;
}

export interface LoanRepayment {
  id: string;
  userId: string;
  loanId: string;
  repaymentAmount: number;
  repaymentDate: string;
  note?: string;
  created_at?: any;
  deleted_at?: any;
  isDemo?: boolean;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  companyName?: string;
  mobileNumber?: string;
  whatsAppNumber?: string;
  email?: string;
  address?: string;
  notes?: string;
  balance: number; // outstanding running balance
  created_at?: any;
  deleted_at?: any;
}

export interface ClientLedger {
  id: string;
  userId: string;
  clientId: string;
  clientName?: string;
  date: string;
  type: 'Project Charge' | 'Subscription Charge' | 'Payment Received' | 'Adjustment' | 'Refund' | 'Opening Balance';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  created_at?: any;
  deleted_at?: any;
}

export interface Project {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  projectName: string;
  totalAmount: number;
  advanceAmount: number;
  dueAmount: number;
  deliveryDate: string;
  status: 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled' | 'Not Started';
  notes?: string;
  created_at?: any;
  deleted_at?: any;
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  pricingType?: 'Fixed Price' | 'Per Branch' | 'Monthly Price' | 'Yearly Price';
  status: 'Active' | 'Inactive';
  created_at?: any;
  deleted_at?: any;
}

export interface Subscription {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  productName: string;
  planName: string;
  monthlyFee: number;
  startDate: string;
  renewalDate: string;
  status: 'Active' | 'Inactive' | 'Cancelled' | 'Past Due';
  notes?: string;
  created_at?: any;
  deleted_at?: any;

  // Product Master specific fields
  productId?: string;
  billingCycle?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  subscriptionFee?: number;
  productCategory?: string;
  branchCount?: number;
  yearlyFee?: number;
}

export interface Receivable {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  amount: number;
  invoiceNumber?: string;
  dueDate: string;
  description: string;
  status: 'Pending' | 'Partial' | 'Paid';
  amountPaid: number;
  created_at?: any;
  deleted_at?: any;
}

export interface PaymentCollection {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  receivableId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Mobile Banking' | 'Check' | 'SaaS Gateway' | 'Other';
  transactionReference?: string;
  notes?: string;
  created_at?: any;
  deleted_at?: any;
}

export interface Quotation {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  quotationNumber: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  totalAmount: number;
  quotationDate: string;
  validUntilDate: string;
  projectName: string;
  description: string;
  loggedToLedger?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface QuotationItem {
  id: string;
  ownerId: string;
  quotationId: string;
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage (e.g. 10 for 10%)
  tax: number; // percentage (e.g. 5 for 5%)
  total: number;
}


