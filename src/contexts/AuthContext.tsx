import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';

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
        const cacheKey = `cached_user_profile_${firebaseUser.uid}`;
        let userData: User | null = null;

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            userData = userDoc.data() as User;
          } else {
            // Check if a user with this email was pre-created by an admin
            try {
              const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                const existingData = existingDoc.data() as User;
                
                userData = {
                  ...existingData,
                  id: firebaseUser.uid as any,
                };

                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  ...userData,
                  updated_at: serverTimestamp(),
                });

                if (existingDoc.id !== firebaseUser.uid) {
                  await deleteDoc(doc(db, 'users', existingDoc.id));
                }
              }
            } catch (queryErr) {
              console.warn('Could not query admin pre-created users (offline):', queryErr);
            }

            if (!userData) {
              // Create initial user profile if it doesn't exist
              const isSuperAdmin = firebaseUser.email === 'shshohagh4@gmail.com';
              userData = {
                id: firebaseUser.uid as any,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
                status: isSuperAdmin ? 'APPROVED' : 'PENDING',
                currency: 'USD',
                language: 'en',
                permissions: isSuperAdmin ? ['manage_users', 'manage_categories', 'export_data', 'view_admin_panel'] : [],
                created_at: new Date().toISOString(),
              };

              try {
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  ...userData,
                  created_at: serverTimestamp(),
                });
              } catch (writeErr) {
                console.warn('Could not save new user profile to Firestore (offline):', writeErr);
              }
            }
          }
        } catch (error: any) {
          console.warn('Network/offline notice fetching user profile from Firestore:', error?.message || error);
          
          // Fall back to localStorage cached profile
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              userData = JSON.parse(cached);
            } catch (parseErr) {
              console.error('Error parsing cached user profile:', parseErr);
            }
          }

          // Fallback offline user profile if no cache is found
          if (!userData) {
            const isSuperAdmin = firebaseUser.email === 'shshohagh4@gmail.com';
            userData = {
              id: firebaseUser.uid as any,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
              status: 'APPROVED',
              currency: 'USD',
              language: 'en',
              permissions: isSuperAdmin ? ['manage_users', 'manage_categories', 'export_data', 'view_admin_panel'] : [],
              created_at: new Date().toISOString(),
            };
          }
        }

        if (userData) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(userData));
          } catch (e) {}

          let token = '';
          try {
            token = await firebaseUser.getIdToken();
          } catch (tokenErr) {
            console.warn('Could not refresh ID token (offline):', tokenErr);
          }

          if (userData.status === 'APPROVED') {
            setState({
              user: userData,
              token,
              isAuthenticated: true,
              isLoading: false,
              isPendingApproval: false
            });
          } else {
            setState({
              user: userData,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              isPendingApproval: true
            });
          }
        } else {
          // Check if local session user exists (for offline or local demo accounts)
          const localStored = localStorage.getItem('app_local_session_user');
          if (localStored) {
            try {
              const localUser = JSON.parse(localStored) as User;
              if (localUser && localUser.email) {
                if (localUser.email === 'shshohagh4@gmail.com') {
                  localUser.id = 'admin-shshohagh4' as any;
                  localStorage.setItem('app_local_session_user', JSON.stringify(localUser));
                }
                setState({
                  user: localUser,
                  token: 'local-session-token',
                  isAuthenticated: localUser.status === 'APPROVED',
                  isLoading: false,
                  isPendingApproval: localUser.status === 'PENDING'
                });
                return;
              }
            } catch (parseErr) {
              console.error('Error parsing local stored user session:', parseErr);
            }
          }
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false, isPendingApproval: false });
        }
      } else {
        // Check if local session user exists (for offline or local demo accounts)
        const localStored = localStorage.getItem('app_local_session_user');
        if (localStored) {
          try {
            const localUser = JSON.parse(localStored) as User;
            if (localUser && localUser.email) {
              if (localUser.email === 'shshohagh4@gmail.com') {
                localUser.id = 'admin-shshohagh4' as any;
                localStorage.setItem('app_local_session_user', JSON.stringify(localUser));
              }
              setState({
                user: localUser,
                token: 'local-session-token',
                isAuthenticated: localUser.status === 'APPROVED',
                isLoading: false,
                isPendingApproval: localUser.status === 'PENDING'
              });
              return;
            }
          } catch (parseErr) {
            console.error('Error parsing local stored user session:', parseErr);
          }
        }
        setState({ user: null, token: null, isAuthenticated: false, isLoading: false, isPendingApproval: false });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (token: string, user: User) => {
    try {
      localStorage.setItem('app_local_session_user', JSON.stringify(user));
    } catch (e) {}
    setState({
      user,
      token: token || 'local-session-token',
      isAuthenticated: user.status === 'APPROVED',
      isLoading: false,
      isPendingApproval: user.status === 'PENDING'
    });
  };

  const logout = async () => {
    try {
      localStorage.removeItem('app_local_session_user');
    } catch (e) {}
    try {
      await signOut(auth);
    } catch (e) {}
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false, isPendingApproval: false });
  };

  const updateUser = async (userData: Partial<User>) => {
    if (state.user) {
      const updated = { ...state.user, ...userData };
      try {
        localStorage.setItem('app_local_session_user', JSON.stringify(updated));
      } catch (e) {}
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'users', auth.currentUser.uid), userData, { merge: true });
        } catch (error) {
          console.error('Error updating user profile in Firestore:', error);
        }
      }
      setState(prev => ({
        ...prev,
        user: updated
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
