import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let userData: User;

          if (userDoc.exists()) {
            userData = userDoc.data() as User;
          } else {
            // Create initial user profile if it doesn't exist
            const isSuperAdmin = firebaseUser.email === 'shshohagh4@gmail.com';
            userData = {
              id: firebaseUser.uid as any,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role: isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
              status: isSuperAdmin ? 'APPROVED' : 'PENDING',
              currency: 'USD',
              language: 'en',
              permissions: isSuperAdmin ? ['manage_users', 'manage_categories', 'export_data', 'view_admin_panel'] : [],
              created_at: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              ...userData,
              created_at: serverTimestamp(),
            });
          }

          const token = await firebaseUser.getIdToken();
          setState({
            user: userData,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (token: string, user: User) => {
    // This is now handled by onAuthStateChanged
    setState({ user, token, isAuthenticated: true, isLoading: false });
  };

  const logout = async () => {
    await signOut(auth);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  };

  const updateUser = async (userData: Partial<User>) => {
    if (state.user && auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), userData, { merge: true });
        setState(prev => ({
          ...prev,
          user: { ...prev.user!, ...userData }
        }));
      } catch (error) {
        console.error('Error updating user profile:', error);
      }
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
