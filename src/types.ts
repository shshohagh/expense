export interface User {
  id: string | number;
  email: string;
  name: string;
  role: 'USER' | 'SUPER_ADMIN' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCEL';
  currency: string;
  language: string;
  permissions: string[];
  photoURL?: string;
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
