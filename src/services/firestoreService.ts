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


// Helper for user matching across sessions (recovers local/legacy IDs and matches auth.uid)
const isMatchingUserRecord = (docUserIdOrOwnerId: any, currentUserId: string): boolean => {
  if (!currentUserId && !auth.currentUser) return true;
  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email;

  // Exact match with current user id or Firebase Auth UID
  if (docUserIdOrOwnerId === currentUserId) return true;
  if (currentUid && docUserIdOrOwnerId === currentUid) return true;

  // Super admin / local / fallback matching
  const isSuperAdminOrLocal = !auth.currentUser || 
    currentEmail === 'shshohagh4@gmail.com' ||
    currentUserId === 'admin-shshohagh4' || 
    (typeof currentUserId === 'string' && currentUserId.startsWith('local-'));

  if (isSuperAdminOrLocal) {
    if (!docUserIdOrOwnerId) return true;
    if (docUserIdOrOwnerId === 'admin-shshohagh4' || docUserIdOrOwnerId === '1') return true;
    if (typeof docUserIdOrOwnerId === 'string' && docUserIdOrOwnerId.startsWith('local-')) return true;
    if (currentUid && docUserIdOrOwnerId === currentUid) return true;
  }
  return false;
};

// --- Borrowers Management ---
export const subscribeToBorrowers = (ownerId: string, callback: (borrowers: Borrower[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'borrowers'), where('ownerId', '==', ownerId))
    : collection(db, 'borrowers');

  return onSnapshot(q, (snapshot) => {
    const borrowers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((b: any) => !b.deleted_at && isMatchingUserRecord(b.ownerId, ownerId)) as Borrower[];
    borrowers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
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

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto === null || proto === Object.prototype) {
      const cleaned: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanUndefined(val);
        }
      }
      return cleaned;
    }
  }
  return obj;
};

const handleFirestoreError = (error: any, operation: string, path: string) => {
  const errInfo = {
    error: error?.message || String(error),
    operation,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    }
  };
  console.warn('Firestore Notice/Error:', JSON.stringify(errInfo));
  if (operation !== 'LIST' && error?.code !== 'unavailable' && !error?.message?.includes('offline')) {
    throw new Error(JSON.stringify(errInfo));
  }
};

// Transactions
export const subscribeToTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  const effectiveUserId = auth.currentUser ? auth.currentUser.uid : userId;
  const q = auth.currentUser 
    ? query(collection(db, 'transactions'), where('userId', '==', effectiveUserId))
    : collection(db, 'transactions');
  
  return onSnapshot(q, (snapshot) => {
    let transactions = snapshot.docs
      .map(doc => ({ id: doc.id as any, ...doc.data() }))
      .filter((t: any) => !t.deleted_at && isMatchingUserRecord(t.userId, userId)) as Transaction[];
    
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
    const effectiveUserId = auth.currentUser ? auth.currentUser.uid : userId;
    const q = auth.currentUser 
      ? query(collection(db, 'transactions'), where('userId', '==', effectiveUserId))
      : collection(db, 'transactions');
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs
      .map(doc => ({ id: doc.id as any, ...doc.data() }))
      .filter((t: any) => !t.deleted_at && isMatchingUserRecord(t.userId, userId)) as Transaction[];
    
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

export const deleteTransaction = async (id: string | number) => {
  const idStr = id.toString();
  try {
    const transRef = doc(db, 'transactions', idStr);
    try {
      // First attempt soft delete
      await updateDoc(transRef, {
        deleted_at: serverTimestamp()
      });
    } catch (softErr) {
      console.warn('Soft delete for transaction failed, falling back to deleteDoc:', softErr);
      await deleteDoc(transRef);
    }
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'transactions', idStr));
    } catch (hardErr) {
      console.warn('Direct deleteDoc for transaction notice:', hardErr);
      // Do not throw fatal error to allow UI optimistic update and backend sync
    }
  }

  // Also notify server SQLite backend if running
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('app_local_session_user') || '';
    await fetch(`/api/transactions/${idStr}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (apiErr) {
    // Non-blocking
  }
};

export const bulkUpdateTransactionStatus = async (ids: (string | number)[], status: 'ACTIVE' | 'INACTIVE') => {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, 'transactions', id.toString()), { status });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', 'transactions/bulk-status');
  }
};

export const bulkDeleteTransactions = async (ids: (string | number)[]) => {
  const idStrings = ids.map(i => i.toString());
  try {
    const batch = writeBatch(db);
    idStrings.forEach(id => {
      batch.update(doc(db, 'transactions', id), {
        deleted_at: serverTimestamp()
      });
    });
    await batch.commit();
  } catch (error) {
    console.warn('Batch soft delete failed, falling back to deleteDoc for each transaction:', error);
    try {
      await Promise.all(idStrings.map(id => deleteDoc(doc(db, 'transactions', id))));
    } catch (fallbackErr) {
      console.warn('Direct deleteDoc fallback notice:', fallbackErr);
    }
  }

  // Backend SQLite sync
  try {
    const token = localStorage.getItem('token') || '';
    await Promise.all(idStrings.map(id => fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })));
  } catch (apiErr) {
    // Non-blocking
  }
};

// Categories
export const subscribeToCategories = (userId: string | null, callback: (categories: Category[]) => void) => {
  // Fetch both global (userId == null) and user-specific categories
  const q = collection(db, 'categories');

  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs
      .map(doc => ({ id: doc.id as any, ...doc.data() } as Category))
      .filter(cat => {
        if (cat.deleted_at) return false;
        if (cat.userId === null || cat.userId === undefined) return true;
        return isMatchingUserRecord(cat.userId, userId || '');
      });
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

export const checkCategoryInUse = async (
  id: string,
  categoryName?: string,
  userId?: string
): Promise<{ inUse: boolean; count: number; transactions: Transaction[] }> => {
  try {
    const effectiveUserId = userId || auth.currentUser?.uid || '';
    const allTransactions = await getTransactions(effectiveUserId);
    const targetIdStr = id.toString();
    const targetName = categoryName?.trim().toLowerCase();

    const matching = allTransactions.filter(t => {
      const matchId = t.categoryId && t.categoryId.toString() === targetIdStr;
      const matchName = targetName && t.categoryName && t.categoryName.trim().toLowerCase() === targetName;
      return matchId || matchName;
    });

    return {
      inUse: matching.length > 0,
      count: matching.length,
      transactions: matching
    };
  } catch (err) {
    console.error('Error checking category in use:', err);
    return { inUse: false, count: 0, transactions: [] };
  }
};

export const deleteCategory = async (
  id: string,
  options?: {
    reassignTransactionsToUncategorized?: boolean;
    preventIfInUse?: boolean;
    userId?: string;
    categoryName?: string;
  }
) => {
  try {
    const effectiveUserId = options?.userId || auth.currentUser?.uid || '';
    
    // Check if there are related transactions
    if (effectiveUserId || auth.currentUser) {
      const allTransactions = await getTransactions(effectiveUserId);
      const targetIdStr = id.toString();
      const targetName = options?.categoryName?.trim().toLowerCase();

      const matchingTransactions = allTransactions.filter(t => {
        const matchId = t.categoryId && t.categoryId.toString() === targetIdStr;
        const matchName = targetName && t.categoryName && t.categoryName.trim().toLowerCase() === targetName;
        return matchId || matchName;
      });

      if (matchingTransactions.length > 0) {
        if (options?.preventIfInUse && !options?.reassignTransactionsToUncategorized) {
          throw new Error(`Cannot delete category: Category is currently in use by ${matchingTransactions.length} transaction(s). Please reassign them to 'Uncategorized' to proceed, or keep the category.`);
        }

        if (options?.reassignTransactionsToUncategorized) {
          // Update matching transactions in batches to 'Uncategorized'
          const batchSize = 400;
          for (let i = 0; i < matchingTransactions.length; i += batchSize) {
            const chunk = matchingTransactions.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(t => {
              const transRef = doc(db, 'transactions', t.id.toString());
              batch.update(transRef, {
                categoryId: 'uncategorized',
                categoryName: 'Uncategorized'
              });
            });
            try {
              await batch.commit();
            } catch (bErr) {
              console.warn('Batch commit notice during category reassignment:', bErr);
              for (const t of chunk) {
                try {
                  await updateDoc(doc(db, 'transactions', t.id.toString()), {
                    categoryId: 'uncategorized',
                    categoryName: 'Uncategorized'
                  });
                } catch (tErr) {}
              }
            }
          }

          // Also update recurring transactions if any match
          try {
            const rtSnap = await getDocs(
              auth.currentUser 
                ? query(collection(db, 'recurring_transactions'), where('userId', '==', auth.currentUser.uid))
                : collection(db, 'recurring_transactions')
            );
            const matchingRT = rtSnap.docs.filter(d => {
              const data = d.data();
              return !data.deleted_at && (
                (data.categoryId && data.categoryId.toString() === targetIdStr) ||
                (targetName && data.categoryName && data.categoryName.trim().toLowerCase() === targetName)
              );
            });
            if (matchingRT.length > 0) {
              const rtBatch = writeBatch(db);
              matchingRT.forEach(d => {
                rtBatch.update(d.ref, {
                  categoryId: 'uncategorized',
                  categoryName: 'Uncategorized'
                });
              });
              await rtBatch.commit();
            }
          } catch (rtErr) {
            console.warn('Notice updating recurring transactions for deleted category:', rtErr);
          }

          // Also clean up budgets for this category if any match
          try {
            const budgetSnap = await getDocs(
              auth.currentUser 
                ? query(collection(db, 'budgets'), where('userId', '==', auth.currentUser.uid))
                : collection(db, 'budgets')
            );
            const matchingBudgets = budgetSnap.docs.filter(d => {
              const data = d.data();
              return !data.deleted_at && (
                (data.categoryId && data.categoryId.toString() === targetIdStr) ||
                (targetName && data.categoryName && data.categoryName.trim().toLowerCase() === targetName)
              );
            });
            if (matchingBudgets.length > 0) {
              const bBatch = writeBatch(db);
              matchingBudgets.forEach(d => {
                bBatch.update(d.ref, {
                  deleted_at: serverTimestamp()
                });
              });
              await bBatch.commit();
            }
          } catch (bErr) {
            console.warn('Notice updating budgets for deleted category:', bErr);
          }
        }
      }
    }

    const catRef = doc(db, 'categories', id.toString());
    try {
      // First attempt soft delete
      await updateDoc(catRef, {
        deleted_at: serverTimestamp()
      });
    } catch (softErr) {
      console.warn('Soft delete for category failed, falling back to deleteDoc:', softErr);
      await deleteDoc(catRef);
    }

    // Backend SQLite sync
    try {
      const token = localStorage.getItem('token') || '';
      await fetch(`/api/categories/${id.toString()}?reassign=${options?.reassignTransactionsToUncategorized ? 'true' : 'false'}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {}

    return { success: true };
  } catch (error: any) {
    if (error?.message?.includes('Cannot delete category')) {
      throw error;
    }
    try {
      await deleteDoc(doc(db, 'categories', id.toString()));
      return { success: true };
    } catch (hardErr) {
      console.warn('Direct deleteDoc also reported:', hardErr);
      return { success: true };
    }
  }
};

// Budgets
export const subscribeToBudgets = (userId: string, callback: (budgets: Budget[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'budgets'), where('userId', '==', userId))
    : collection(db, 'budgets');

  return onSnapshot(q, (snapshot) => {
    const budgets = snapshot.docs
      .map(doc => ({ id: doc.id as any, ...doc.data() } as Budget))
      .filter((b: any) => !b.deleted_at && isMatchingUserRecord(b.userId, userId));
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

export const deleteBudget = async (id: string | number) => {
  const idStr = id.toString();
  try {
    const docRef = doc(db, 'budgets', idStr);
    try {
      await updateDoc(docRef, {
        deleted_at: serverTimestamp()
      });
    } catch (softErr) {
      console.warn('Soft delete for budget failed, falling back to deleteDoc:', softErr);
      await deleteDoc(docRef);
    }
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'budgets', idStr));
    } catch (hardErr) {
      console.warn('Delete budget notice:', hardErr);
    }
  }
};

// Recurring Transactions
export const subscribeToRecurringTransactions = (userId: string, callback: (data: any[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'recurring_transactions'), where('userId', '==', userId))
    : collection(db, 'recurring_transactions');

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((rt: any) => !rt.deleted_at && isMatchingUserRecord(rt.userId, userId));
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

export const deleteRecurringTransaction = async (id: string | number) => {
  const idStr = id.toString();
  try {
    const docRef = doc(db, 'recurring_transactions', idStr);
    try {
      await updateDoc(docRef, {
        deleted_at: serverTimestamp()
      });
    } catch (softErr) {
      console.warn('Soft delete for recurring transaction failed, falling back to deleteDoc:', softErr);
      await deleteDoc(docRef);
    }
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'recurring_transactions', idStr));
    } catch (hardErr) {
      console.warn('Delete recurring transaction notice:', hardErr);
    }
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
  const q = auth.currentUser 
    ? query(collection(db, 'loans'), where('userId', '==', userId))
    : collection(db, 'loans');
  
  return onSnapshot(q, (snapshot) => {
    const loans = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((l: any) => !l.deleted_at && isMatchingUserRecord(l.userId || l.ownerId, userId)) as Loan[];
    
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
  const q = auth.currentUser 
    ? query(collection(db, 'loan_repayments'), where('userId', '==', userId))
    : collection(db, 'loan_repayments');
  
  return onSnapshot(q, (snapshot) => {
    const repayments = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((r: any) => !r.deleted_at && isMatchingUserRecord(r.userId || r.ownerId, userId)) as LoanRepayment[];
    
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
  const q = auth.currentUser 
    ? query(collection(db, 'clients'), where('userId', '==', userId))
    : collection(db, 'clients');

  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((c: any) => !c.deleted_at && isMatchingUserRecord(c.userId || c.ownerId, userId)) as Client[];
    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    callback(clients);
  }, (error) => handleFirestoreError(error, 'LIST', 'clients'));
};

export const addClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clients'), cleanUndefined({
      ...client,
      balance: client.balance || 0,
      created_at: serverTimestamp(),
      deleted_at: null
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'CREATE', 'clients');
  }
};

export const updateClient = async (id: string, data: Partial<Client>) => {
  try {
    await updateDoc(doc(db, 'clients', id), cleanUndefined(data));
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
    const batch = writeBatch(db);
    batch.update(doc(db, 'clients', id), {
      deleted_at: serverTimestamp()
    });

    // Soft-delete matched projects
    const projQ = query(
      collection(db, 'projects'),
      where('clientId', '==', id),
      where('deleted_at', '==', null)
    );
    const projSnap = await getDocs(projQ);
    projSnap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
    });

    // Soft-delete matched subscriptions
    const subQ = query(
      collection(db, 'subscriptions'),
      where('clientId', '==', id),
      where('deleted_at', '==', null)
    );
    const subSnap = await getDocs(subQ);
    subSnap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
    });

    // Soft-delete matched receivables
    const recQ = query(
      collection(db, 'receivables'),
      where('clientId', '==', id),
      where('deleted_at', '==', null)
    );
    const recSnap = await getDocs(recQ);
    recSnap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
    });

    // Soft-delete matched payments
    const payQ = query(
      collection(db, 'payments'),
      where('clientId', '==', id),
      where('deleted_at', '==', null)
    );
    const paySnap = await getDocs(payQ);
    paySnap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
    });

    // Soft-delete matched client ledgers
    const ledgerQ = query(
      collection(db, 'client_ledgers'),
      where('clientId', '==', id),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQ);
    ledgerSnap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `clients/${id}`);
  }
};

// --- Client Ledgers ---
export const subscribeToClientLedgers = (userId: string, callback: (ledgers: ClientLedger[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'client_ledgers'), where('userId', '==', userId))
    : collection(db, 'client_ledgers');

  return onSnapshot(q, (snapshot) => {
    const ledgers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((l: any) => !l.deleted_at && isMatchingUserRecord(l.userId || l.ownerId, userId)) as ClientLedger[];
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
  const q = auth.currentUser 
    ? query(collection(db, 'projects'), where('userId', '==', userId))
    : collection(db, 'projects');

  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => !p.deleted_at && isMatchingUserRecord(p.userId || p.ownerId, userId)) as Project[];
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

export const editProjectAndSyncFinancials = async (
  projectId: string,
  updatedData: Partial<Project>,
  oldProject: Project
) => {
  try {
    const batch = writeBatch(db);

    // 1. Update the Project document itself
    const projectRef = doc(db, 'projects', projectId);
    batch.update(projectRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    const newClientId = updatedData.clientId || oldProject.clientId;
    const newClientName = updatedData.clientName || oldProject.clientName;
    const newProjectName = updatedData.projectName || oldProject.projectName;
    const newTotalAmount = updatedData.totalAmount !== undefined ? Number(updatedData.totalAmount) : oldProject.totalAmount;
    const oldTotalAmount = oldProject.totalAmount;
    const newDueAmount = updatedData.dueAmount !== undefined ? Number(updatedData.dueAmount) : oldProject.dueAmount;
    const newDeliveryDate = updatedData.deliveryDate || oldProject.deliveryDate;

    // 2. Adjust Ledger Entry & Client Balances
    const ledgerQuery = query(
      collection(db, 'client_ledgers'),
      where('userId', '==', oldProject.userId),
      where('clientId', '==', oldProject.clientId),
      where('type', '==', 'Project Charge'),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQuery);
    const oldDescription = `Project Initial Charge: ${oldProject.projectName}`;
    const ledgerDoc = ledgerSnap.docs.find(d => {
      const data = d.data();
      return data.description === oldDescription || data.description?.includes(oldProject.projectName);
    });

    if (ledgerDoc) {
      const ledgerRef = doc(db, 'client_ledgers', ledgerDoc.id);
      
      if (oldProject.clientId === newClientId) {
        // Client did not change, project cost might have changed
        const costDifference = newTotalAmount - oldTotalAmount;
        
        // Update ledger entry
        batch.update(ledgerRef, {
          debit: newTotalAmount,
          description: `Project Initial Charge: ${newProjectName}`
        });

        // Update client balance
        const clientRef = doc(db, 'clients', oldProject.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          const currentBalance = clientSnap.data().balance || 0;
          batch.update(clientRef, { balance: currentBalance + costDifference });
        }
      } else {
        // Client changed!
        // A. Remove old cost from old client
        const oldClientRef = doc(db, 'clients', oldProject.clientId);
        const oldClientSnap = await getDoc(oldClientRef);
        if (oldClientSnap.exists()) {
          const oldBalance = oldClientSnap.data().balance || 0;
          batch.update(oldClientRef, { balance: oldBalance - oldTotalAmount });
        }

        // B. Add new cost to new client
        const newClientRef = doc(db, 'clients', newClientId);
        const newClientSnap = await getDoc(newClientRef);
        if (newClientSnap.exists()) {
          const newBalance = newClientSnap.data().balance || 0;
          batch.update(newClientRef, { balance: newBalance + newTotalAmount });
        }

        // C. Update ledger entry client details
        batch.update(ledgerRef, {
          clientId: newClientId,
          clientName: newClientName,
          debit: newTotalAmount,
          description: `Project Initial Charge: ${newProjectName}`
        });
      }
    }

    // 3. Adjust Receivable Entry
    const receivableQuery = query(
      collection(db, 'receivables'),
      where('userId', '==', oldProject.userId),
      where('clientId', '==', oldProject.clientId),
      where('deleted_at', '==', null)
    );
    const receivableSnap = await getDocs(receivableQuery);
    const oldRecDescription = `Due payment for Project: ${oldProject.projectName}`;
    const receivableDoc = receivableSnap.docs.find(d => {
      const data = d.data();
      return data.description === oldRecDescription || data.description?.includes(oldProject.projectName);
    });

    if (receivableDoc) {
      const recRef = doc(db, 'receivables', receivableDoc.id);
      
      if (oldProject.clientId === newClientId) {
        batch.update(recRef, {
          amount: newDueAmount,
          dueDate: newDeliveryDate,
          description: `Due payment for Project: ${newProjectName}`,
          status: newDueAmount <= 0 ? 'Paid' : 'Pending'
        });
      } else {
        batch.update(recRef, {
          clientId: newClientId,
          clientName: newClientName,
          amount: newDueAmount,
          dueDate: newDeliveryDate,
          description: `Due payment for Project: ${newProjectName}`,
          status: newDueAmount <= 0 ? 'Paid' : 'Pending'
        });
      }
    } else {
      // If no receivable existed but there is a positive dueAmount, create a new one!
      if (newDueAmount > 0) {
        const newRecRef = doc(collection(db, 'receivables'));
        batch.set(newRecRef, {
          userId: oldProject.userId,
          clientId: newClientId,
          clientName: newClientName,
          amount: newDueAmount,
          dueDate: newDeliveryDate,
          description: `Due payment for Project: ${newProjectName}`,
          status: 'Pending',
          amountPaid: 0,
          created_at: serverTimestamp(),
          deleted_at: null
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'UPDATE', `projects/${projectId}`);
  }
};

export const deleteProject = async (id: string) => {
  try {
    const projRef = doc(db, 'projects', id);
    const projSnap = await getDoc(projRef);
    if (!projSnap.exists()) return;
    const projData = projSnap.data() as Project;

    const batch = writeBatch(db);
    batch.update(projRef, { deleted_at: serverTimestamp() });

    // Find and soft-delete matching client ledger entries
    const ledgerQ = query(
      collection(db, 'client_ledgers'),
      where('clientId', '==', projData.clientId),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQ);
    let totalDebitReverted = 0;
    ledgerSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (
        data.type === 'Project Charge' && 
        (data.description || '').includes(projData.projectName)
      ) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
        totalDebitReverted += (data.debit || 0);
      }
    });

    // Find and soft-delete matching receivables
    const recQ = query(
      collection(db, 'receivables'),
      where('clientId', '==', projData.clientId),
      where('deleted_at', '==', null)
    );
    const recSnap = await getDocs(recQ);
    recSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if ((data.description || '').includes(projData.projectName)) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
      }
    });

    // Revert client outstanding balance
    if (totalDebitReverted > 0) {
      const clientRef = doc(db, 'clients', projData.clientId);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const clientBal = clientSnap.data().balance || 0;
        batch.update(clientRef, { balance: Math.max(0, clientBal - totalDebitReverted) });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `projects/${id}`);
  }
};

// --- Subscriptions ---
export const subscribeToSubscriptions = (userId: string, callback: (subscriptions: Subscription[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'subscriptions'), where('userId', '==', userId))
    : collection(db, 'subscriptions');

  return onSnapshot(q, (snapshot) => {
    const subscriptions = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((s: any) => !s.deleted_at && isMatchingUserRecord(s.userId || s.ownerId, userId)) as Subscription[];
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
    const subRef = doc(db, 'subscriptions', id);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) return;
    const subData = subSnap.data() as Subscription;

    const batch = writeBatch(db);
    batch.update(subRef, { deleted_at: serverTimestamp() });

    // Find and soft-delete matching client ledger entries
    const ledgerQ = query(
      collection(db, 'client_ledgers'),
      where('clientId', '==', subData.clientId),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQ);
    let totalDebitReverted = 0;
    ledgerSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (
        data.type === 'Subscription Charge' && 
        (data.description || '').includes(subData.productName)
      ) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
        totalDebitReverted += (data.debit || 0);
      }
    });

    // Find and soft-delete matching receivables
    const recQ = query(
      collection(db, 'receivables'),
      where('clientId', '==', subData.clientId),
      where('deleted_at', '==', null)
    );
    const recSnap = await getDocs(recQ);
    recSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if ((data.description || '').includes(subData.productName)) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
      }
    });

    // Revert client outstanding balance
    if (totalDebitReverted > 0) {
      const clientRef = doc(db, 'clients', subData.clientId);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const clientBal = clientSnap.data().balance || 0;
        batch.update(clientRef, { balance: Math.max(0, clientBal - totalDebitReverted) });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `subscriptions/${id}`);
  }
};

// --- Products Master Management ---
export const subscribeToProducts = (ownerId: string, callback: (products: Product[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'products'), where('ownerId', '==', ownerId))
    : collection(db, 'products');

  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => !p.deleted_at && isMatchingUserRecord(p.ownerId || p.userId, ownerId)) as Product[];
    products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
  const q = auth.currentUser 
    ? query(collection(db, 'receivables'), where('userId', '==', userId))
    : collection(db, 'receivables');

  return onSnapshot(q, (snapshot) => {
    const receivables = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((r: any) => !r.deleted_at && isMatchingUserRecord(r.userId || r.ownerId, userId)) as Receivable[];
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
    const recRef = doc(db, 'receivables', id);
    const recSnap = await getDoc(recRef);
    if (!recSnap.exists()) return;
    const recData = recSnap.data() as Receivable;

    const batch = writeBatch(db);
    batch.update(recRef, { deleted_at: serverTimestamp() });

    // Find and soft-delete matching client ledger entries
    const ledgerQ = query(
      collection(db, 'client_ledgers'),
      where('clientId', '==', recData.clientId),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQ);
    let totalDebitReverted = 0;
    ledgerSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (
        (data.description || '').includes(recData.invoiceNumber || '') || 
        (recData.description && (data.description || '').includes(recData.description))
      ) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
        totalDebitReverted += (data.debit || 0);
      }
    });

    // Revert client outstanding balance
    if (totalDebitReverted > 0) {
      const clientRef = doc(db, 'clients', recData.clientId);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const clientBal = clientSnap.data().balance || 0;
        batch.update(clientRef, { balance: Math.max(0, clientBal - totalDebitReverted) });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, 'DELETE', `receivables/${id}`);
  }
};

// --- Payments ---
export const subscribeToPayments = (userId: string, callback: (payments: PaymentCollection[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'payments'), where('userId', '==', userId))
    : collection(db, 'payments');

  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => !p.deleted_at && isMatchingUserRecord(p.userId || p.ownerId, userId)) as PaymentCollection[];
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

    const batch = writeBatch(db);
    batch.update(payRef, { deleted_at: serverTimestamp() });

    // Soft-delete original 'Payment Received' ledger entry so that credit decreases instantly
    const ledgerQ = query(
      collection(db, 'client_ledgers'),
      where('clientId', '==', payData.clientId),
      where('deleted_at', '==', null)
    );
    const ledgerSnap = await getDocs(ledgerQ);
    let totalCreditReverted = 0;
    ledgerSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (
        data.type === 'Payment Received' && 
        data.credit === payData.amount && 
        ((data.description || '').includes(payData.paymentMethod) || (payData.notes && (data.description || '').includes(payData.notes)))
      ) {
        batch.update(docSnap.ref, { deleted_at: serverTimestamp() });
        totalCreditReverted += (data.credit || 0);
      }
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
        batch.update(recRef, {
          amountPaid: newPaid,
          status: newStatus
        });
      }
    }

    // Adjust client balance (if payment is deleted, the client outstanding balance increases back up)
    const clientRef = doc(db, 'clients', payData.clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      const clientBal = clientSnap.data().balance || 0;
      batch.update(clientRef, { balance: clientBal + payData.amount });
    }

    await batch.commit();

  } catch (error) {
    handleFirestoreError(error, 'DELETE', `payments/${id}`);
  }
};

// --- Quotations Management ---
export const subscribeToQuotations = (userId: string, callback: (quotations: Quotation[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'quotations'), where('ownerId', '==', userId))
    : collection(db, 'quotations');

  return onSnapshot(q, (snapshot) => {
    const quotations = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((qDoc: any) => !qDoc.deleted_at && isMatchingUserRecord(qDoc.ownerId || qDoc.userId, userId)) as Quotation[];
    quotations.sort((a, b) => new Date(b.quotationDate).getTime() - new Date(a.quotationDate).getTime());
    callback(quotations);
  }, (error) => handleFirestoreError(error, 'LIST', 'quotations'));
};

export const subscribeToAllQuotationItems = (userId: string, callback: (items: QuotationItem[]) => void) => {
  const q = auth.currentUser 
    ? query(collection(db, 'quotation_items'), where('ownerId', '==', userId))
    : collection(db, 'quotation_items');

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((item: any) => !item.deleted_at && isMatchingUserRecord(item.ownerId || item.userId, userId)) as QuotationItem[];
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


