export const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'bn', name: 'Bengali' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

const translations: Record<string, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    recurring: 'Recurring',
    budgets: 'Budgets',
    categories: 'Categories',
    admin: 'Admin',
    profile: 'Profile',
    reports: 'Reports',
    logout: 'Logout',
    income: 'Income',
    expense: 'Expense',
    total_balance: 'Total Balance',
    recent_transactions: 'Recent Transactions',
    add_transaction: 'Add Transaction',
    amount: 'Amount',
    category: 'Category',
    date: 'Date',
    description: 'Description',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    settings: 'Settings',
    currency: 'Currency',
    language: 'Language',
    profile_settings: 'Profile Settings',
    general_info: 'General Information',
    security: 'Security',
    new_password: 'New Password',
    confirm_password: 'Confirm Password',
    save_changes: 'Save Changes',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড',
    transactions: 'লেনদেন',
    recurring: 'পুনরাবৃত্ত',
    budgets: 'বাজেট',
    categories: 'বিভাগ',
    admin: 'অ্যাডমিন',
    profile: 'প্রোফাইল',
    reports: 'রিপোর্ট',
    logout: 'লগআউট',
    income: 'আয়',
    expense: 'ব্যয়',
    total_balance: 'মোট ব্যালেন্স',
    recent_transactions: 'সাম্প্রতিক লেনদেন',
    add_transaction: 'লেনদেন যোগ করুন',
    amount: 'পরিমাণ',
    category: 'বিভাগ',
    date: 'তারিখ',
    description: 'বর্ণনা',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল করুন',
    edit: 'সম্পাদনা করুন',
    delete: 'মুছে ফেলুন',
    settings: 'সেটিংস',
    currency: 'মুদ্রা',
    language: 'ভাষা',
    profile_settings: 'প্রোফাইল সেটিংস',
    general_info: 'সাধারণ তথ্য',
    security: 'নিরাপত্তা',
    new_password: 'নতুন পাসওয়ার্ড',
    confirm_password: 'পাসওয়ার্ড নিশ্চিত করুন',
    save_changes: 'পরিবর্তন সংরক্ষণ করুন',
  }
};

export const t = (key: string, lang: string = 'en') => {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
};

export const formatCurrency = (amount: number, currencyCode: string = 'USD', lang: string = 'en', options: Intl.NumberFormatOptions = {}) => {
  const currency = currencies.find(c => c.code === currencyCode) || currencies[0];
  
  // Set up base options with defaults
  const baseOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'decimal',
    ...options,
  };

  // Safety check: Intl.NumberFormat throws if minimumFractionDigits > maximumFractionDigits
  if (baseOptions.maximumFractionDigits !== undefined && 
      (baseOptions.minimumFractionDigits || 0) > baseOptions.maximumFractionDigits) {
    baseOptions.minimumFractionDigits = baseOptions.maximumFractionDigits;
  }

  const numberFormat = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', baseOptions);
  
  const formatted = numberFormat.format(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  
  // Ensure the symbol is always at the front as requested
  return `${sign}${currency.symbol}${formatted}`;
};
