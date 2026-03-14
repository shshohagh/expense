import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const verifyToken = async () => {
      if (!state.token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${state.token}` },
        });
        if (res.ok) {
          const user = await res.json();
          setState({
            user,
            token: state.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          localStorage.removeItem('token');
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      } catch (error) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    verifyToken();
  }, [state.token]);

  const login = (token: string, user: User) => {
    localStorage.setItem('token', token);
    setState({ user, token, isAuthenticated: true, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  };

  const updateUser = (userData: Partial<User>) => {
    if (state.user) {
      setState(prev => ({
        ...prev,
        user: { ...prev.user!, ...userData }
      }));
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
