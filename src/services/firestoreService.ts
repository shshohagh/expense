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
import { Transaction, Category, Budget, Loan, LoanRepayment, Client, ClientLedger, Project, Subscription, Receivable, PaymentCollection, Quotation, QuotationItem, Borrower, Product } from '../types';


// --- Borrowers Management ---
export const subscribeToBorrowers = (ownerId: string, callback: (borrowers: Borrower[]) => void) => {
  const q = query(
    collection(db, 'borrowers'),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(q, (snapshot) => {
    const borrowers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Borrower[];
    borrowers.sort((a, b) => a.fullName.localeCompare(b.fullName));
    callback(borrowers);
  }, (error) => handleFirestoreError(error, 'LIST', 'borrowers'));
};

export const addBorrower = async (borrower: Omit<Borrower, 'id' | 'created_at' | 'updated_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'borrowers'), {
      ...borrower,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'borrowers');
  }
};

export const updateBorrower = async (id: string, data: Partial<Borrower>) => {
  try {
    await updateDoc(doc(db, 'borrowers', id), {
      ...data,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `borrowers/${id}`);
  }
};

export const deleteBorrower = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'borrowers', id));
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `borrowers/${id}`);
  }
};

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

// Loans & Loan Repayments
export const subscribeToLoans = (userId: string, callback: (loans: Loan[]) => void) => {
  const q = query(
    collection(db, 'loans'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );
  
  return onSnapshot(q, (snapshot) => {
    const loans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Loan[];
    
    // Sort by givenDate descending
    loans.sort((a, b) => new Date(b.givenDate).getTime() - new Date(a.givenDate).getTime());
    
    callback(loans);
  }, (error) => handleFirestoreError(error, 'LIST', 'loans'));
};

export const addLoan = async (loan: Omit<Loan, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'loans'), {
      ...loan,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'loans');
  }
};

export const updateLoan = async (id: string, data: Partial<Loan>) => {
  try {
    await updateDoc(doc(db, 'loans', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `loans/${id}`);
  }
};

export const deleteLoan = async (id: string) => {
  try {
    await updateDoc(doc(db, 'loans', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `loans/${id}`);
  }
};

export const subscribeToRepayments = (userId: string, callback: (repayments: LoanRepayment[]) => void) => {
  const q = query(
    collection(db, 'loan_repayments'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );
  
  return onSnapshot(q, (snapshot) => {
    const repayments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LoanRepayment[];
    
    // Sort by repaymentDate descending
    repayments.sort((a, b) => new Date(b.repaymentDate).getTime() - new Date(a.repaymentDate).getTime());
    
    callback(repayments);
  }, (error) => handleFirestoreError(error, 'LIST', 'loan_repayments'));
};

export const addRepayment = async (repayment: Omit<LoanRepayment, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'loan_repayments'), {
      ...repayment,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'loan_repayments');
  }
};

export const updateRepayment = async (id: string, data: Partial<LoanRepayment>) => {
  try {
    await updateDoc(doc(db, 'loan_repayments', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `loan_repayments/${id}`);
  }
};

export const deleteRepayment = async (id: string) => {
  try {
    await updateDoc(doc(db, 'loan_repayments', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `loan_repayments/${id}`);
  }
};

// --- Clients Management ---
export const subscribeToClients = (userId: string, callback: (clients: Client[]) => void) => {
  const q = query(
    collection(db, 'clients'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
    clients.sort((a, b) => a.name.localeCompare(b.name));
    callback(clients);
  }, (error) => handleFirestoreError(error, 'LIST', 'clients'));
};

export const addClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clients'), {
      ...client,
      balance: client.balance || 0,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'clients');
  }
};

export const updateClient = async (id: string, data: Partial<Client>) => {
  try {
    await updateDoc(doc(db, 'clients', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `clients/${id}`);
  }
};

export const editClientAndAdjustOpeningBalance = async (
  clientId: string,
  userId: string,
  payload: {
    name: string;
    companyName: string;
    mobileNumber: string;
    whatsAppNumber: string;
    email: string;
    address: string;
    notes: string;
    status: 'Active' | 'Inactive';
    initialDebt: number;
  },
  oldOpeningEntry: ClientLedger | undefined,
  currentClientBalance: number
) => {
  try {
    // Calculate the difference in Initial Outstanding Debt Balance
    const oldInitialDebt = oldOpeningEntry ? (oldOpeningEntry.debit || 0) : 0;
    const debtDifference = payload.initialDebt - oldInitialDebt;

    // Calculate the updated overall balance for the client document
    const updatedClientBalance = currentClientBalance + debtDifference;

    const batch = writeBatch(db);

    // Update the client document
    const clientRef = doc(db, 'clients', clientId);
    batch.update(clientRef, {
      name: payload.name,
      companyName: payload.companyName || '',
      mobileNumber: payload.mobileNumber || '',
      whatsAppNumber: payload.whatsAppNumber || '',
      email: payload.email || '',
      address: payload.address || '',
      notes: payload.notes || '',
      status: payload.status || 'Active',
      balance: updatedClientBalance,
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    // Handle the 'Opening Balance' ledger entry safely
    if (oldOpeningEntry) {
      const ledgerRef = doc(db, 'client_ledgers', oldOpeningEntry.id);
      batch.update(ledgerRef, {
        debit: payload.initialDebt,
        runningBalance: payload.initialDebt,
        updatedAt: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    } else if (payload.initialDebt > 0) {
      const ledgerRef = doc(collection(db, 'client_ledgers'));
      batch.set(ledgerRef, {
        userId,
        clientId,
        clientName: payload.name,
        date: new Date().toISOString().split('T')[0],
        type: 'Opening Balance',
        description: 'Opening Outstanding Balance Contribution',
        debit: payload.initialDebt,
        credit: 0,
        runningBalance: payload.initialDebt,
        created_at: serverTimestamp(),
        deleted_at: null
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `clients/${clientId}`);
  }
};

export const deleteClient = async (id: string) => {
  try {
    await updateDoc(doc(db, 'clients', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `clients/${id}`);
  }
};

// --- Client Ledgers ---
export const subscribeToClientLedgers = (userId: string, callback: (ledgers: ClientLedger[]) => void) => {
  const q = query(
    collection(db, 'client_ledgers'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const ledgers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ClientLedger[];
    // Sort by date descending and secondary key
    ledgers.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff === 0 && a.created_at && b.created_at) {
        return b.created_at.seconds - a.created_at.seconds;
      }
      return dateDiff;
    });
    callback(ledgers);
  }, (error) => handleFirestoreError(error, 'LIST', 'client_ledgers'));
};

export const addLedgerEntry = async (entry: Omit<ClientLedger, 'id' | 'created_at'>) => {
  try {
    if (entry.type === 'Opening Balance') {
      const q = query(
        collection(db, 'client_ledgers'),
        where('clientId', '==', entry.clientId),
        where('type', '==', 'Opening Balance'),
        where('deleted_at', '==', null)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error('Opening Balance entry already exists for this client.');
      }
    }

    const clientRef = doc(db, 'clients', entry.clientId);
    const clientSnap = await getDoc(clientRef);
    let currentBalance = 0;
    if (clientSnap.exists()) {
      currentBalance = clientSnap.data().balance || 0;
    }

    const updatedBalance = currentBalance + (entry.debit || 0) - (entry.credit || 0);
    const batch = writeBatch(db);

    const ledgerRef = doc(collection(db, 'client_ledgers'));
    batch.set(ledgerRef, {
      ...entry,
      runningBalance: updatedBalance,
      created_at: serverTimestamp(),
      deleted_at: null
    });

    batch.update(clientRef, { balance: updatedBalance });
    await batch.commit();
    return ledgerRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'client_ledgers');
  }
};

export const deleteLedgerEntry = async (id: string) => {
  try {
    const ledgerRef = doc(db, 'client_ledgers', id);
    const ledgerSnap = await getDoc(ledgerRef);
    if (!ledgerSnap.exists()) return;

    const data = ledgerSnap.data() as ClientLedger;
    const clientRef = doc(db, 'clients', data.clientId);
    const clientSnap = await getDoc(clientRef);
    let currentBalance = 0;
    if (clientSnap.exists()) {
      currentBalance = clientSnap.data().balance || 0;
    }

    const revertedBalance = currentBalance - (data.debit || 0) + (data.credit || 0);
    const batch = writeBatch(db);
    batch.update(ledgerRef, { deleted_at: serverTimestamp() });
    batch.update(clientRef, { balance: revertedBalance });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `client_ledgers/${id}`);
  }
};

// --- Projects ---
export const subscribeToProjects = (userId: string, callback: (projects: Project[]) => void) => {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Project[];
    projects.sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());
    callback(projects);
  }, (error) => handleFirestoreError(error, 'LIST', 'projects'));
};

export const addProject = async (project: Omit<Project, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      ...project,
      created_at: serverTimestamp(),
      deleted_at: null
    });

    // Create a corresponding ClientLedger entry for the project charge
    await addLedgerEntry({
      userId: project.userId,
      clientId: project.clientId,
      date: new Date().toISOString().split('T')[0],
      type: 'Project Charge',
      description: `Project Initial Charge: ${project.projectName}`,
      debit: project.totalAmount,
      credit: 0,
      runningBalance: 0
    });

    // Create a corresponding Receivable entry if there's due balance
    if (project.dueAmount > 0) {
      await addReceivable({
        userId: project.userId,
        clientId: project.clientId,
        clientName: project.clientName,
        amount: project.dueAmount,
        dueDate: project.deliveryDate,
        description: `Due payment for Project: ${project.projectName}`,
        status: 'Pending',
        amountPaid: 0
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'projects');
  }
};

export const updateProject = async (id: string, data: Partial<Project>) => {
  try {
    await updateDoc(doc(db, 'projects', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `projects/${id}`);
  }
};

export const deleteProject = async (id: string) => {
  try {
    await updateDoc(doc(db, 'projects', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `projects/${id}`);
  }
};

// --- Subscriptions ---
export const subscribeToSubscriptions = (userId: string, callback: (subscriptions: Subscription[]) => void) => {
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const subscriptions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Subscription[];
    subscriptions.sort((a, b) => new Date(b.renewalDate).getTime() - new Date(a.renewalDate).getTime());
    callback(subscriptions);
  }, (error) => handleFirestoreError(error, 'LIST', 'subscriptions'));
};

export const addSubscription = async (sub: Omit<Subscription, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'subscriptions'), {
      ...sub,
      created_at: serverTimestamp(),
      deleted_at: null
    });

    const branchText = sub.branchCount && sub.branchCount > 0 ? ` (${sub.branchCount} Branch${sub.branchCount > 1 ? 'es' : ''})` : '';
    const cycleText = sub.billingCycle ? ` - ${sub.billingCycle}` : '';
    const description = `Subscription Charge: ${sub.productName}${branchText}${cycleText}`;
    const debitAmount = sub.subscriptionFee !== undefined ? sub.subscriptionFee : sub.monthlyFee;

    // Create entry in client_ledger
    await addLedgerEntry({
      userId: sub.userId,
      clientId: sub.clientId,
      date: sub.startDate,
      type: 'Subscription Charge',
      description,
      debit: debitAmount,
      credit: 0,
      runningBalance: 0
    });

    // Create a corresponding Receivable
    await addReceivable({
      userId: sub.userId,
      clientId: sub.clientId,
      clientName: sub.clientName,
      amount: debitAmount,
      dueDate: sub.renewalDate,
      description: `Subscription Renewal Fee: ${sub.productName}${branchText}`,
      status: 'Pending',
      amountPaid: 0
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'subscriptions');
  }
};

export const updateSubscription = async (id: string, data: Partial<Subscription>) => {
  try {
    await updateDoc(doc(db, 'subscriptions', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `subscriptions/${id}`);
  }
};

export const deleteSubscription = async (id: string) => {
  try {
    await updateDoc(doc(db, 'subscriptions', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `subscriptions/${id}`);
  }
};

// --- Products Master Management ---
export const subscribeToProducts = (ownerId: string, callback: (products: Product[]) => void) => {
  const q = query(
    collection(db, 'products'),
    where('ownerId', '==', ownerId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    products.sort((a, b) => a.name.localeCompare(b.name));
    callback(products);
  }, (error) => handleFirestoreError(error, 'LIST', 'products'));
};

export const addProduct = async (product: Omit<Product, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...product,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'products');
  }
};

export const updateProduct = async (id: string, data: Partial<Product>) => {
  try {
    await updateDoc(doc(db, 'products', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `products/${id}`);
  }
};

export const deleteProduct = async (id: string) => {
  try {
    await updateDoc(doc(db, 'products', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `products/${id}`);
  }
};

// --- Receivables ---
export const subscribeToReceivables = (userId: string, callback: (receivables: Receivable[]) => void) => {
  const q = query(
    collection(db, 'receivables'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const receivables = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Receivable[];
    receivables.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    callback(receivables);
  }, (error) => handleFirestoreError(error, 'LIST', 'receivables'));
};

export const addReceivable = async (receivable: Omit<Receivable, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'receivables'), {
      ...receivable,
      amountPaid: receivable.amountPaid || 0,
      created_at: serverTimestamp(),
      deleted_at: null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'receivables');
  }
};

export const updateReceivable = async (id: string, data: Partial<Receivable>) => {
  try {
    await updateDoc(doc(db, 'receivables', id), data);
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `receivables/${id}`);
  }
};

export const deleteReceivable = async (id: string) => {
  try {
    await updateDoc(doc(db, 'receivables', id), {
      deleted_at: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `receivables/${id}`);
  }
};

// --- Payments ---
export const subscribeToPayments = (userId: string, callback: (payments: PaymentCollection[]) => void) => {
  const q = query(
    collection(db, 'payments'),
    where('userId', '==', userId),
    where('deleted_at', '==', null)
  );

  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PaymentCollection[];
    payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    callback(payments);
  }, (error) => handleFirestoreError(error, 'LIST', 'payments'));
};

export const addPayment = async (pay: Omit<PaymentCollection, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'payments'), {
      ...pay,
      created_at: serverTimestamp(),
      deleted_at: null
    });

    // 1. Record ClientLedger entry of 'Payment Received' (credit = amount)
    await addLedgerEntry({
      userId: pay.userId,
      clientId: pay.clientId,
      date: pay.paymentDate,
      type: 'Payment Received',
      description: `Collection Received via ${pay.paymentMethod}${pay.transactionReference ? ` (Ref: ${pay.transactionReference})` : ''} - ${pay.notes || ''}`,
      debit: 0,
      credit: pay.amount,
      runningBalance: 0
    });

    // 2. Adjust matching receivable ID if present
    if (pay.receivableId) {
      const recRef = doc(db, 'receivables', pay.receivableId);
      const recSnap = await getDoc(recRef);
      if (recSnap.exists()) {
        const recData = recSnap.data() as Receivable;
        const newPaid = (recData.amountPaid || 0) + pay.amount;
        let newStatus: 'Pending' | 'Partial' | 'Paid' = 'Pending';
        if (newPaid >= recData.amount) {
          newStatus = 'Paid';
        } else if (newPaid > 0) {
          newStatus = 'Partial';
        }
        await updateDoc(recRef, {
          amountPaid: newPaid,
          status: newStatus
        });
      }
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'payments');
  }
};

export const deletePayment = async (id: string) => {
  try {
    const payRef = doc(db, 'payments', id);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) return;

    const payData = paySnap.data() as PaymentCollection;

    // Soft delete the payment document
    await updateDoc(payRef, { deleted_at: serverTimestamp() });

    // Reverse payment entry in ledgers – we look for ledger entry for payment matches and soft delete it
    // Or we record an Adjustment ledger entry. The cleaner way is creating a new Adjustment entry or deleting the matching ledger entry.
    // Let's create an Adjustment entry to reverse the credit or search and delete the ledger record.
    // To keep it simple and robust, let's post an 'Adjustment' ledger entry to re-debit the balance due to voided payment!
    await addLedgerEntry({
      userId: payData.userId,
      clientId: payData.clientId,
      date: new Date().toISOString().split('T')[0],
      type: 'Adjustment',
      description: `Reversal of Payment ${id} (Voided)`,
      debit: payData.amount,
      credit: 0,
      runningBalance: 0
    });

    // If there was a receivableId linked, reverse the paid amount
    if (payData.receivableId) {
      const recRef = doc(db, 'receivables', payData.receivableId);
      const recSnap = await getDoc(recRef);
      if (recSnap.exists()) {
        const recData = recSnap.data() as Receivable;
        const newPaid = Math.max(0, (recData.amountPaid || 0) - payData.amount);
        let newStatus: 'Pending' | 'Partial' | 'Paid' = 'Pending';
        if (newPaid >= recData.amount) {
          newStatus = 'Paid';
        } else if (newPaid > 0) {
          newStatus = 'Partial';
        }
        await updateDoc(recRef, {
          amountPaid: newPaid,
          status: newStatus
        });
      }
    }

  } catch (error) {
    handleFirestoreError(error, 'DELETE', `payments/${id}`);
  }
};

// --- Quotations Management ---
export const subscribeToQuotations = (userId: string, callback: (quotations: Quotation[]) => void) => {
  const q = query(
    collection(db, 'quotations'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const quotations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Quotation[];
    quotations.sort((a, b) => new Date(b.quotationDate).getTime() - new Date(a.quotationDate).getTime());
    callback(quotations);
  }, (error) => handleFirestoreError(error, 'LIST', 'quotations'));
};

export const subscribeToAllQuotationItems = (userId: string, callback: (items: QuotationItem[]) => void) => {
  const q = query(
    collection(db, 'quotation_items'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as QuotationItem[];
    callback(items);
  }, (error) => handleFirestoreError(error, 'LIST', 'quotation_items'));
};

export const addQuotation = async (
  quotation: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>,
  items: Omit<QuotationItem, 'id' | 'ownerId' | 'quotationId'>[]
) => {
  try {
    const batch = writeBatch(db);
    
    // Create quotation document reference
    const quotationRef = doc(collection(db, 'quotations'));
    const quotationId = quotationRef.id;

    batch.set(quotationRef, {
      ...quotation,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create item document references
    for (const item of items) {
      const itemRef = doc(collection(db, 'quotation_items'));
      batch.set(itemRef, {
        ...item,
        ownerId: quotation.ownerId,
        quotationId: quotationId
      });
    }

    await batch.commit();
    return quotationId;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'quotations');
  }
};

export const updateQuotation = async (
  id: string,
  quotationData: Partial<Quotation>,
  items?: Omit<QuotationItem, 'id' | 'ownerId' | 'quotationId'>[]
) => {
  try {
    const batch = writeBatch(db);
    const quotationRef = doc(db, 'quotations', id);

    batch.update(quotationRef, {
      ...quotationData,
      updatedAt: serverTimestamp()
    });

    if (items) {
      // 1. Delete all existing items for this quotation ID
      const itemsSnapshot = await getDocs(
        query(
          collection(db, 'quotation_items'),
          where('quotationId', '==', id)
        )
      );
      itemsSnapshot.forEach(itemDoc => {
        batch.delete(itemDoc.ref);
      });

      // 2. Add the new items
      const ownerId = quotationData.ownerId || (await getDoc(quotationRef)).data()?.ownerId;
      for (const item of items) {
        const itemRef = doc(collection(db, 'quotation_items'));
        batch.set(itemRef, {
          ...item,
          ownerId,
          quotationId: id
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `quotations/${id}`);
  }
};

export const deleteQuotation = async (id: string) => {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'quotations', id));

    // Delete associated items
    const itemsSnapshot = await getDocs(
      query(
        collection(db, 'quotation_items'),
        where('quotationId', '==', id)
      )
    );
    itemsSnapshot.forEach(itemDoc => {
      batch.delete(itemDoc.ref);
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `quotations/${id}`);
  }
};


