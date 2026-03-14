import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database('database.sqlite');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'USER',
    status TEXT DEFAULT 'PENDING',
    currency TEXT DEFAULT 'USD',
    language TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
    amount REAL NOT NULL,
    categoryId INTEGER,
    category TEXT, -- Keep for migration
    date TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
    amount REAL NOT NULL,
    categoryId INTEGER,
    category TEXT, -- Keep for migration
    frequency TEXT CHECK(frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) NOT NULL,
    startDate TEXT NOT NULL,
    nextDate TEXT NOT NULL,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER, -- NULL for global/default categories
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    UNIQUE(userId, name, type)
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    permissions TEXT NOT NULL -- JSON array of permission strings
  );
`);

// Migrations: Add currency and language columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
const columns = tableInfo.map(c => c.name);

if (!columns.includes('currency')) {
  db.exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'USD'");
}
if (!columns.includes('language')) {
  db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'");
}

// Migration for transactions status
const transactionTableInfo = db.prepare("PRAGMA table_info(transactions)").all() as any[];
const transactionColumns = transactionTableInfo.map(c => c.name);
if (!transactionColumns.includes('status')) {
  db.exec("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
}

// Migration for categoryId and userId
if (!transactionColumns.includes('categoryId')) {
  db.exec("ALTER TABLE transactions ADD COLUMN categoryId INTEGER REFERENCES categories(id)");
}

const recurringTableInfo = db.prepare("PRAGMA table_info(recurring_transactions)").all() as any[];
const recurringColumns = recurringTableInfo.map(c => c.name);
if (!recurringColumns.includes('categoryId')) {
  db.exec("ALTER TABLE recurring_transactions ADD COLUMN categoryId INTEGER REFERENCES categories(id)");
}

const categoryTableInfo = db.prepare("PRAGMA table_info(categories)").all() as any[];
const categoryColumns = categoryTableInfo.map(c => c.name);
if (!categoryColumns.includes('userId')) {
  db.exec("ALTER TABLE categories ADD COLUMN userId INTEGER REFERENCES users(id)");
  // Remove old unique constraint if possible, but SQLite doesn't support easy DROP CONSTRAINT.
  // We'll just rely on the new table definition for new installs and this column for migrations.
}

// Data Migration: Map category names to IDs
const migrateCategories = () => {
  const transactions = db.prepare("SELECT id, category, type FROM transactions WHERE categoryId IS NULL").all() as any[];
  for (const t of transactions) {
    let cat = db.prepare("SELECT id FROM categories WHERE name = ? AND type = ?").get(t.category, t.type) as any;
    if (cat) {
      db.prepare("UPDATE transactions SET categoryId = ? WHERE id = ?").run(cat.id, t.id);
    }
  }

  const recurring = db.prepare("SELECT id, category, type FROM recurring_transactions WHERE categoryId IS NULL").all() as any[];
  for (const r of recurring) {
    let cat = db.prepare("SELECT id FROM categories WHERE name = ? AND type = ?").get(r.category, r.type) as any;
    if (cat) {
      db.prepare("UPDATE recurring_transactions SET categoryId = ? WHERE id = ?").run(cat.id, r.id);
    }
  }
};
migrateCategories();

// Seed default permissions
const permissionCount = db.prepare('SELECT COUNT(*) as count FROM role_permissions').get() as { count: number };
if (permissionCount.count === 0) {
  const insertPermission = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
  insertPermission.run('USER', JSON.stringify([]));
  insertPermission.run('ADMIN', JSON.stringify(['manage_categories', 'export_data']));
  insertPermission.run('SUPER_ADMIN', JSON.stringify(['manage_users', 'manage_categories', 'export_data', 'view_admin_panel']));
}

// Seed default categories if empty
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
if (categoryCount.count === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
  const defaultCategories = [
    ['Salary', 'INCOME'],
    ['Freelance', 'INCOME'],
    ['Investment', 'INCOME'],
    ['Food', 'EXPENSE'],
    ['Transport', 'EXPENSE'],
    ['Rent', 'EXPENSE'],
    ['Utilities', 'EXPENSE'],
    ['Entertainment', 'EXPENSE'],
    ['Healthcare', 'EXPENSE'],
    ['Shopping', 'EXPENSE'],
  ];
  defaultCategories.forEach(([name, type]) => insertCategory.run(name, type));
}

// Seed Super Admin
const adminEmail = 'shshohagh4@gmail.com';
const adminPassword = 'Sohag66996853@#$';
const adminName = 'Super Admin';

const admin = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
if (!admin) {
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  db.prepare("INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)")
    .run(adminEmail, hashedPassword, adminName, 'SUPER_ADMIN', 'APPROVED');
  console.log('Super Admin seeded successfully.');
} else {
  // Ensure the existing user has the correct role and status if they are the requested admin
  db.prepare("UPDATE users SET role = 'SUPER_ADMIN', status = 'APPROVED' WHERE email = ?")
    .run(adminEmail);
}

export default db;
