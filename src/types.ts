export interface User {
  id: number;
  email: string;
  name: string;
  role: 'USER' | 'SUPER_ADMIN' | 'ADMIN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCEL';
  currency: string;
  language: string;
  permissions: string[];
  created_at: string;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  categoryId: number;
  categoryName?: string;
  date: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface Category {
  id: number;
  userId: number | null;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Budget {
  id: number;
  userId: number;
  categoryId: number;
  categoryName?: string;
  categoryType?: 'INCOME' | 'EXPENSE';
  amount: number;
  period: 'MONTHLY' | 'YEARLY';
  created_at: string;
}
