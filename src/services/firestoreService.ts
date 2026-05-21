import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  orderBy,
  limit,
  getDoc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Transaction, Category, Budget } from '../types';

// Helper to handle Firestore errors
const handleFirestoreError = (error: any, operation: string, path: string) => {
  const errInfo = {
    error: error.message,
    operation,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    }
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Transactions
export const subscribeToTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  const q = query(
    collection(db, 'transactions'), 
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );
  
  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id as any,
      ...doc.data()
    })) as Transaction[];
    
    // Sort transactions by date descending (latest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      
      const createdA = (a as any).created_at?.toMillis?.() || 0;
      const createdB = (b as any).created_at?.toMillis?.() || 0;
      return createdB - createdA;
    });

    callback(transactions);
  }, (error) => handleFirestoreError(error, 'LIST', 'transactions'));
};

export const getTransactions = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('deleted_at', '==', null)
    );
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() })) as Transaction[];
    
    // Sort transactions by date descending (latest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      
      const createdA = (a as any).created_at?.toMillis?.() || 0;
      const createdB = (b as any).created_at?.toMillis?.() || 0;
      return createdB - createdA;
    });
    
    return transactions;
  } catch (error) {
    handleFirestoreError(error, 'LIST', 'transactions');
    return [];
  }
};

export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transaction,
      status: transaction.status || 'ACTIVE',
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'transactions');
  }
};

export const updateTransaction = async (id: string, data: Partial<Transaction>) => {
  try {
    await updateDoc(doc(db, 'transactions', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `transactions/${id}`);
  }
};

export const deleteTransaction = async (id: string) => {
  try {
    // Soft delete
    await updateDoc(doc(db, 'transactions', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `transactions/${id}`);
  }
};

export const bulkUpdateTransactionStatus = async (ids: string[], status: 'ACTIVE' | 'INACTIVE') => {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'transactions', id), { status });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', 'transactions/bulk-status');
  }
};

export const bulkDeleteTransactions = async (ids: string[]) => {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'transactions', id), {
        deleted_at: serverTimestamp()
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', 'transactions/bulk-delete');
  }
};

// Categories
export const subscribeToCategories = (userId: string | null, callback: (categories: Category[]) => void) => {
  // Fetch both global (userId == null) and user-specific categories
  const q = query(
    collection(db, 'categories'),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs
      .map(doc => ({ id: doc.id as any, ...doc.data() } as Category))
      .filter(cat => cat.userId === null || cat.userId.toString() === userId);
    callback(categories);
  }, (error) => handleFirestoreError(error, 'LIST', 'categories'));
};

export const addCategory = async (category: Omit<Category, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'categories'), {
      ...category,
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'categories');
  }
};

export const updateCategory = async (id: string, data: Partial<Category>) => {
  try {
    await updateDoc(doc(db, 'categories', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `categories/${id}`);
  }
};

export const deleteCategory = async (id: string) => {
  try {
    await updateDoc(doc(db, 'categories', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `categories/${id}`);
  }
};

// Budgets
export const subscribeToBudgets = (userId: string, callback: (budgets: Budget[]) => void) => {
  const q = query(
    collection(db, 'budgets'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const budgets = snapshot.docs.map(doc => ({
      id: doc.id as any,
      ...doc.data()
    })) as Budget[];
    callback(budgets);
  }, (error) => handleFirestoreError(error, 'LIST', 'budgets'));
};

export const addBudget = async (budget: Omit<Budget, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'budgets'), {
      ...budget,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'budgets');
  }
};

export const updateBudget = async (id: string, data: Partial<Budget>) => {
  try {
    await updateDoc(doc(db, 'budgets', id), {
      ...data,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `budgets/${id}`);
  }
};

export const deleteBudget = async (id: string) => {
  try {
    await updateDoc(doc(db, 'budgets', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `budgets/${id}`);
  }
};

// Recurring Transactions
export const subscribeToRecurringTransactions = (userId: string, callback: (data: any[]) => void) => {
  const q = query(
    collection(db, 'recurring_transactions'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => handleFirestoreError(error, 'LIST', 'recurring_transactions'));
};

export const addRecurringTransaction = async (data: any) => {
  try {
    const docRef = await addDoc(collection(db, 'recurring_transactions'), {
      ...data,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'recurring_transactions');
  }
};

export const updateRecurringTransaction = async (id: string, data: any) => {
  try {
    await updateDoc(doc(db, 'recurring_transactions', id), {
      ...data,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `recurring_transactions/${id}`);
  }
};

export const deleteRecurringTransaction = async (id: string) => {
  try {
    await updateDoc(doc(db, 'recurring_transactions', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `recurring_transactions/${id}`);
  }
};

export const processRecurringTransactions = async (userId: string) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const q = query(
      collection(db, 'recurring_transactions'),
      where('userId', '==', userId),
      where('active', '==', true),
      where('deleted_at', '==', null)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let totalChanges = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const rt = docSnapshot.data();
      let nextDate = new Date(rt.nextDate);
      let rtHasChanges = false;
      
      // Safety check to prevent infinite loops if frequency is invalid or dates are messed up
      let loopCount = 0;
      const MAX_LOOPS = 50; 

      while (nextDate.toISOString().split('T')[0] <= todayStr && loopCount < MAX_LOOPS) {
        rtHasChanges = true;
        totalChanges++;
        loopCount++;

        // Create inactive transaction
        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, {
          userId,
          type: rt.type,
          amount: rt.amount,
          categoryId: rt.categoryId,
          categoryName: rt.categoryName,
          date: nextDate.toISOString().split('T')[0],
          description: `Recurring: ${rt.description || 'Transaction'}`,
          status: 'INACTIVE',
          created_at: serverTimestamp(),
          deleted_at: null
        });
        
        // Update next date
        if (rt.frequency === 'DAILY') nextDate.setDate(nextDate.getDate() + 1);
        else if (rt.frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
        else if (rt.frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (rt.frequency === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);
        else break; // Invalid frequency
      }
      
      if (rtHasChanges) {
        batch.update(docSnapshot.ref, {
          nextDate: nextDate.toISOString().split('T')[0],
          updated_at: serverTimestamp()
        });
      }
    }
    
    if (totalChanges > 0) {
      await batch.commit();
      console.log(`Processed ${totalChanges} recurring transactions.`);
    }
  } catch (error) {
    console.error('Failed to process recurring transactions:', error);
  }
};

// Seed Default Categories
export const seedDefaultCategories = async (categories: Omit<Category, 'id'>[]) => {
  try {
    const batch = categories.map(cat => addDoc(collection(db, 'categories'), {
      ...cat,
      deleted_at: null
    }));
    await Promise.all(batch);
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'categories/seed');
  }
};

// Activity Logs
export const subscribeToActivityLogs = (userId: string, callback: (data: any[]) => void) => {
  const q = query(
    collection(db, 'activity_logs'),
    where('userId', '==', userId),
    orderBy('created_at', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => handleFirestoreError(error, 'LIST', 'activity_logs'));
};

export const logActivity = async (userId: string, userName: string, userEmail: string, action: string, details: string) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      userName,
      userEmail,
      action,
      details,
      created_at: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// Demo Data Management
export const loadDemoData = async (userId: string) => {
  try {
    const batch = writeBatch(db);
    
    // Demo Categories
    const demoCategories = [
      { name: 'Demo: Salary', type: 'INCOME' as const },
      { name: 'Demo: Freelance', type: 'INCOME' as const },
      { name: 'Demo: Groceries', type: 'EXPENSE' as const },
      { name: 'Demo: Rent', type: 'EXPENSE' as const },
      { name: 'Demo: Entertainment', type: 'EXPENSE' as const },
      { name: 'Demo: Transport', type: 'EXPENSE' as const },
    ];

    const categoryRefs: { [key: string]: any } = {};

    for (const cat of demoCategories) {
      const catRef = doc(collection(db, 'categories'));
      batch.set(catRef, {
        ...cat,
        userId,
        isDemo: true,
        deleted_at: null
      });
      categoryRefs[cat.name] = catRef;
    }

    // Demo Transactions
    const demoTransactions = [
      { amount: 5000, type: 'INCOME' as const, categoryName: 'Demo: Salary', description: 'Monthly Salary', date: new Date().toISOString().split('T')[0] },
      { amount: 1200, type: 'INCOME' as const, categoryName: 'Demo: Freelance', description: 'Project Payment', date: new Date().toISOString().split('T')[0] },
      { amount: 150, type: 'EXPENSE' as const, categoryName: 'Demo: Groceries', description: 'Weekly Groceries', date: new Date().toISOString().split('T')[0] },
      { amount: 2000, type: 'EXPENSE' as const, categoryName: 'Demo: Rent', description: 'Apartment Rent', date: new Date().toISOString().split('T')[0] },
      { amount: 80, type: 'EXPENSE' as const, categoryName: 'Demo: Entertainment', description: 'Movie Night', date: new Date().toISOString().split('T')[0] },
      { amount: 45, type: 'EXPENSE' as const, categoryName: 'Demo: Transport', description: 'Fuel', date: new Date().toISOString().split('T')[0] },
    ];

    for (const trans of demoTransactions) {
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        amount: trans.amount,
        type: trans.type,
        categoryId: categoryRefs[trans.categoryName].id,
        categoryName: trans.categoryName,
        description: trans.description,
        date: trans.date,
        userId,
        status: 'ACTIVE',
        isDemo: true,
        created_at: serverTimestamp(),
        deleted_at: null
      });
    }

    // Demo Budgets
    const demoBudgets = [
      { amount: 500, categoryName: 'Demo: Groceries', period: 'MONTHLY' as const },
      { amount: 200, categoryName: 'Demo: Entertainment', period: 'MONTHLY' as const },
    ];

    for (const budget of demoBudgets) {
      const budgetRef = doc(collection(db, 'budgets'));
      batch.set(budgetRef, {
        amount: budget.amount,
        categoryId: categoryRefs[budget.categoryName].id,
        categoryName: budget.categoryName,
        period: budget.period,
        userId,
        isDemo: true,
        created_at: serverTimestamp(),
        deleted_at: null
      });
    }

    // Demo Recurring Transaction
    const recurringRef = doc(collection(db, 'recurring_transactions'));
    batch.set(recurringRef, {
      amount: 2000,
      type: 'EXPENSE',
      categoryId: categoryRefs['Demo: Rent'].id,
      categoryName: 'Demo: Rent',
      description: 'Monthly Rent (Recurring)',
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      nextDate: new Date().toISOString().split('T')[0],
      active: true,
      userId,
      isDemo: true,
      created_at: serverTimestamp(),
      deleted_at: null
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'demo_data/load');
  }
};

export const deleteDemoData = async (userId: string) => {
  try {
    const collections = ['transactions', 'categories', 'budgets', 'recurring_transactions'];
    
    for (const colName of collections) {
      const q = query(
        collection(db, colName),
        where('userId', '==', userId),
        where('isDemo', '==', true)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, 'DELETE', 'demo_data/delete');
  }
};

// Admin Functions
export const subscribeToUsers = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => handleFirestoreError(error, 'LIST', 'users'));
};

export const updateUserStatus = async (userId: string, status: string) => {
  try {
    await updateDoc(doc(db, 'users', userId), { status });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `users/${userId}`);
  }
};

export const adminCreateUser = async (userData: any) => {
  try {
    // Note: This only creates the Firestore document. 
    // The user still needs to sign up via Firebase Auth to link their account.
    const userRef = doc(db, 'users', userData.id || Math.random().toString(36).substring(7));
    await setDoc(userRef, {
      ...userData,
      created_at: serverTimestamp(),
    });
    return userRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'users');
  }
};

export const adminUpdateUser = async (userId: string, userData: any) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...userData,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `users/${userId}`);
  }
};

export const adminDeleteUser = async (userId: string) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `users/${userId}`);
  }
};

export const subscribeToRolePermissions = (callback: (data: any[]) => void) => {
  return onSnapshot(collection(db, 'role_permissions'), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => handleFirestoreError(error, 'LIST', 'role_permissions'));
};

export const updateRolePermissions = async (role: string, permissions: string[]) => {
  try {
    await setDoc(doc(db, 'role_permissions', role), { role, permissions }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `role_permissions/${role}`);
  }
};

export const deleteRole = async (role: string) => {
  try {
    await deleteDoc(doc(db, 'role_permissions', role));
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `role_permissions/${role}`);
  }
};

export const renameRole = async (oldRole: string, newRole: string) => {
  try {
    const batch = writeBatch(db);
    
    // 1. Get current permissions
    const roleDoc = await getDoc(doc(db, 'role_permissions', oldRole));
    const permissions = roleDoc.exists() ? roleDoc.data().permissions : [];

    // 2. Create new role
    batch.set(doc(db, 'role_permissions', newRole), { role: newRole, permissions });

    // 3. Update all users with this role
    const usersQuery = query(collection(db, 'users'), where('role', '==', oldRole));
    const usersSnapshot = await getDocs(usersQuery);
    usersSnapshot.docs.forEach(userDoc => {
      batch.update(userDoc.ref, { role: newRole });
    });

    // 4. Delete old role
    batch.delete(doc(db, 'role_permissions', oldRole));

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `role_permissions/rename/${oldRole}`);
  }
};

export const subscribeToAllActivityLogs = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'activity_logs'), orderBy('created_at', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error) => handleFirestoreError(error, 'LIST', 'activity_logs'));
};
