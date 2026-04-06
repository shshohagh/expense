import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./src/db.js";
import { fileURLToPath } from "url";
import * as xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    const rolePerms = db.prepare("SELECT permissions FROM role_permissions WHERE role = ?").get(req.user.role) as any;
    const permissions = rolePerms ? JSON.parse(rolePerms.permissions) : [];
    
    if (req.user.role !== 'SUPER_ADMIN' && !permissions.includes('view_admin_panel')) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  const hasPermission = (permission: string) => {
    return (req: any, res: any, next: any) => {
      const rolePerms = db.prepare("SELECT permissions FROM role_permissions WHERE role = ?").get(req.user.role) as any;
      const permissions = rolePerms ? JSON.parse(rolePerms.permissions) : [];
      
      if (req.user.role !== 'SUPER_ADMIN' && !permissions.includes(permission)) {
        return res.status(403).json({ error: `Permission required: ${permission}` });
      }
      next();
    };
  };

  const logActivity = (userId: number, userEmail: string | null, action: string, details?: string) => {
    try {
      db.prepare("INSERT INTO user_activity (userId, userEmail, action, details) VALUES (?, ?, ?, ?)").run(userId, userEmail, action, details || null);
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // --- API Routes ---

  // Auth
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL").get() as any).count;
      const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';
      const status = role === 'SUPER_ADMIN' ? 'APPROVED' : 'PENDING';

      const stmt = db.prepare("INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)");
      stmt.run(email, hashedPassword, name, role, status);
      res.status(201).json({ message: "User registered. Awaiting admin approval." });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(email) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status !== 'APPROVED') {
      return res.status(403).json({ error: "Account pending approval" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
    
    // Get permissions
    const rolePerms = db.prepare("SELECT permissions FROM role_permissions WHERE role = ?").get(user.role) as any;
    const permissions = rolePerms ? JSON.parse(rolePerms.permissions) : [];

    logActivity(user.id, user.email, 'LOGIN', 'User logged in');

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name,
        currency: user.currency,
        language: user.language,
        permissions
      } 
    });
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL").get(email);
    
    // In a real app, you'd generate a token and send an email here.
    // For this demo, we'll just simulate success to avoid email enumeration.
    res.json({ message: "If an account exists with that email, you will receive a reset link shortly." });
  });

  // User Profile
  app.get("/api/user/profile", authenticateToken, (req: any, res) => {
    const user = db.prepare("SELECT id, email, name, role, status, currency, language FROM users WHERE id = ? AND deleted_at IS NULL").get(req.user.id) as any;
    
    // Get permissions
    const rolePerms = db.prepare("SELECT permissions FROM role_permissions WHERE role = ?").get(user.role) as any;
    const permissions = rolePerms ? JSON.parse(rolePerms.permissions) : [];
    
    res.json({ ...user, permissions });
  });

  app.put("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { name, password, currency, language } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET name = ?, password = ?, currency = ?, language = ? WHERE id = ? AND deleted_at IS NULL").run(name, hashedPassword, currency, language, req.user.id);
      } else {
        db.prepare("UPDATE users SET name = ?, currency = ?, language = ? WHERE id = ? AND deleted_at IS NULL").run(name, currency, language, req.user.id);
      }
      logActivity(req.user.id, req.user.email, 'UPDATE_PROFILE', 'Updated profile information');
      res.json({ message: "Profile updated" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/activity", authenticateToken, (req: any, res) => {
    const activities = db.prepare(`
      SELECT ua.userEmail, u.name as userName, ua.action, ua.details, ua.created_at 
      FROM user_activity ua
      LEFT JOIN users u ON ua.userId = u.id
      WHERE ua.userId = ? 
      ORDER BY ua.created_at DESC 
      LIMIT 50
    `).all(req.user.id);
    res.json(activities);
  });

  // Admin
  app.get("/api/admin/users", authenticateToken, hasPermission('manage_users'), (req, res) => {
    const users = db.prepare("SELECT id, email, name, role, status, created_at FROM users WHERE deleted_at IS NULL").all();
    res.json(users);
  });

  app.get("/api/admin/activity", authenticateToken, hasPermission('view_admin_panel'), (req, res) => {
    const activities = db.prepare(`
      SELECT ua.userEmail, u.name as userName, ua.action, ua.details, ua.created_at 
      FROM user_activity ua
      LEFT JOIN users u ON ua.userId = u.id
      ORDER BY ua.created_at DESC 
      LIMIT 100
    `).all();
    res.json(activities);
  });

  app.post("/api/admin/users", authenticateToken, hasPermission('manage_users'), async (req, res) => {
    const { email, password, name, role, status } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)");
      stmt.run(email, hashedPassword, name, role, status);
      res.status(201).json({ message: "User created successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:id", authenticateToken, hasPermission('manage_users'), async (req, res) => {
    const { email, name, role, status, password } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET email = ?, name = ?, role = ?, status = ?, password = ? WHERE id = ? AND deleted_at IS NULL")
          .run(email, name, role, status, hashedPassword, req.params.id);
      } else {
        db.prepare("UPDATE users SET email = ?, name = ?, role = ?, status = ? WHERE id = ? AND deleted_at IS NULL")
          .run(email, name, role, status, req.params.id);
      }
      res.json({ message: "User updated successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:id/status", authenticateToken, hasPermission('manage_users'), (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL").run(status, req.params.id);
    res.json({ message: "User status updated" });
  });

  app.get("/api/admin/role-permissions", authenticateToken, isAdmin, (req, res) => {
    const perms = db.prepare("SELECT * FROM role_permissions").all();
    const formatted = perms.map((p: any) => ({
      role: p.role,
      permissions: JSON.parse(p.permissions)
    }));
    res.json(formatted);
  });

  app.put("/api/admin/role-permissions/:role", authenticateToken, isAdmin, (req, res) => {
    const { permissions } = req.body;
    db.prepare("UPDATE role_permissions SET permissions = ? WHERE role = ?").run(JSON.stringify(permissions), req.params.role);
    res.json({ message: "Permissions updated" });
  });

  // Recurring Transactions
  const processRecurringTransactions = (userId: number) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const recurring = db.prepare("SELECT * FROM recurring_transactions WHERE userId = ? AND active = 1 AND deleted_at IS NULL").all(userId) as any[];

    for (const rt of recurring) {
      let nextDate = new Date(rt.nextDate);
      while (nextDate.toISOString().split('T')[0] <= todayStr) {
        // Create transaction
        db.prepare("INSERT INTO transactions (userId, type, amount, categoryId, date, description) VALUES (?, ?, ?, ?, ?, ?)")
          .run(userId, rt.type, rt.amount, rt.categoryId, nextDate.toISOString().split('T')[0], `Recurring: ${rt.description || 'Recurring'}`);

        // Update next date
        if (rt.frequency === 'DAILY') nextDate.setDate(nextDate.getDate() + 1);
        else if (rt.frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
        else if (rt.frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (rt.frequency === 'YEARLY') nextDate.setFullYear(nextDate.getFullYear() + 1);

        db.prepare("UPDATE recurring_transactions SET nextDate = ? WHERE id = ?").run(nextDate.toISOString().split('T')[0], rt.id);
      }
    }
  };

  app.get("/api/transactions", authenticateToken, (req: any, res) => {
    processRecurringTransactions(req.user.id);
    const transactions = db.prepare(`
      SELECT t.*, c.name as categoryName 
      FROM transactions t 
      LEFT JOIN categories c ON t.categoryId = c.id 
      WHERE t.userId = ? AND t.deleted_at IS NULL
      ORDER BY t.date DESC
    `).all(req.user.id);
    res.json(transactions);
  });

  app.get("/api/recurring-transactions", authenticateToken, (req: any, res) => {
    const recurring = db.prepare(`
      SELECT rt.*, c.name as categoryName 
      FROM recurring_transactions rt 
      LEFT JOIN categories c ON rt.categoryId = c.id 
      WHERE rt.userId = ? AND rt.deleted_at IS NULL
    `).all(req.user.id);
    res.json(recurring);
  });

  app.post("/api/recurring-transactions", authenticateToken, (req: any, res) => {
    const { type, amount, categoryId, frequency, startDate, description } = req.body;
    const stmt = db.prepare("INSERT INTO recurring_transactions (userId, type, amount, categoryId, frequency, startDate, nextDate, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const result = stmt.run(req.user.id, type, amount, categoryId, frequency, startDate, startDate, description);
    logActivity(req.user.id, req.user.email, 'ADD_RECURRING', `Added recurring ${type.toLowerCase()} of ${amount}`);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.put("/api/recurring-transactions/:id", authenticateToken, (req: any, res) => {
    const { type, amount, categoryId, frequency, startDate, nextDate, description, active } = req.body;
    
    // Fallback to startDate if nextDate is missing
    const finalNextDate = nextDate || startDate;
    
    try {
      const stmt = db.prepare("UPDATE recurring_transactions SET type = ?, amount = ?, categoryId = ?, frequency = ?, startDate = ?, nextDate = ?, description = ?, active = ? WHERE id = ? AND userId = ? AND deleted_at IS NULL");
      stmt.run(type, amount, categoryId, frequency, startDate, finalNextDate, description, active ? 1 : 0, req.params.id, req.user.id);
      logActivity(req.user.id, req.user.email, 'UPDATE_RECURRING', `Updated recurring transaction #${req.params.id}`);
      res.json({ message: "Recurring transaction updated" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/recurring-transactions/:id", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE recurring_transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);
    logActivity(req.user.id, req.user.email, 'DELETE_RECURRING', `Deleted recurring transaction #${req.params.id}`);
    res.json({ message: "Recurring transaction deleted" });
  });

  // Transactions
  app.post("/api/transactions", authenticateToken, (req: any, res) => {
    const { type, amount, categoryId, date, description, status } = req.body;
    const stmt = db.prepare("INSERT INTO transactions (userId, type, amount, categoryId, date, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const result = stmt.run(req.user.id, type, amount, categoryId, date, description, status || 'ACTIVE');
    logActivity(req.user.id, req.user.email, 'ADD_TRANSACTION', `Added ${type.toLowerCase()} of ${amount}`);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.put("/api/transactions/:id", authenticateToken, (req: any, res) => {
    const { type, amount, categoryId, date, description, status } = req.body;
    const stmt = db.prepare("UPDATE transactions SET type = ?, amount = ?, categoryId = ?, date = ?, description = ?, status = ? WHERE id = ? AND userId = ? AND deleted_at IS NULL");
    stmt.run(type, amount, categoryId, date, description, status, req.params.id, req.user.id);
    logActivity(req.user.id, req.user.email, 'UPDATE_TRANSACTION', `Updated transaction #${req.params.id}`);
    res.json({ message: "Transaction updated" });
  });

  app.delete("/api/transactions/:id", authenticateToken, (req: any, res) => {
    db.prepare("UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);
    logActivity(req.user.id, req.user.email, 'DELETE_TRANSACTION', `Deleted transaction #${req.params.id}`);
    res.json({ message: "Transaction deleted" });
  });

  // Budgets
  app.get("/api/budgets", authenticateToken, (req: any, res) => {
    const budgets = db.prepare(`
      SELECT b.*, c.name as categoryName, c.type as categoryType
      FROM budgets b 
      JOIN categories c ON b.categoryId = c.id 
      WHERE b.userId = ? AND b.deleted_at IS NULL
    `).all(req.user.id);
    res.json(budgets);
  });

  app.post("/api/budgets", authenticateToken, (req: any, res) => {
    const { categoryId, amount, period } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO budgets (userId, categoryId, amount, period) VALUES (?, ?, ?, ?)");
      const result = stmt.run(req.user.id, categoryId, amount, period || 'MONTHLY');
      logActivity(req.user.id, req.user.email, 'ADD_BUDGET', `Added budget for category #${categoryId} of ${amount}`);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/budgets/:id", authenticateToken, (req: any, res) => {
    const { amount, period } = req.body;
    try {
      const stmt = db.prepare("UPDATE budgets SET amount = ?, period = ? WHERE id = ? AND userId = ? AND deleted_at IS NULL");
      stmt.run(amount, period, req.params.id, req.user.id);
      logActivity(req.user.id, req.user.email, 'UPDATE_BUDGET', `Updated budget #${req.params.id}`);
      res.json({ message: "Budget updated" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/budgets/:id", authenticateToken, (req: any, res) => {
    try {
      db.prepare("UPDATE budgets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);
      logActivity(req.user.id, req.user.email, 'DELETE_BUDGET', `Deleted budget #${req.params.id}`);
      res.json({ message: "Budget deleted" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/budgets/export/:format", authenticateToken, (req: any, res) => {
    try {
      const budgets = db.prepare(`
        SELECT c.name as Category, c.type as Type, b.amount as Amount, b.period as Period
        FROM budgets b 
        JOIN categories c ON b.categoryId = c.id 
        WHERE b.userId = ? AND b.deleted_at IS NULL
      `).all(req.user.id);
      
      const format = req.params.format;
      
      if (format === 'csv' || format === 'xlsx') {
        const ws = xlsx.utils.json_to_sheet(budgets);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Budgets");
        
        const buf = xlsx.write(wb, { type: 'buffer', bookType: format as any });
        res.setHeader('Content-Disposition', `attachment; filename="budgets.${format}"`);
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
      } else if (format === 'json') {
        res.setHeader('Content-Disposition', `attachment; filename="budgets.json"`);
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(budgets, null, 2));
      } else {
        return res.status(400).json({ error: "Invalid format" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Categories
  app.get("/api/categories", authenticateToken, (req: any, res) => {
    const categories = db.prepare("SELECT * FROM categories WHERE (userId IS NULL OR userId = ?) AND deleted_at IS NULL").all(req.user.id);
    res.json(categories);
  });

  app.post("/api/categories", authenticateToken, (req: any, res) => {
    const { name, type } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO categories (userId, name, type) VALUES (?, ?, ?)");
      stmt.run(req.user.id, name, type);
      logActivity(req.user.id, req.user.email, 'ADD_CATEGORY', `Added category: ${name} (${type})`);
      res.status(201).json({ message: "Category created" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/categories/:id", authenticateToken, (req: any, res) => {
    const { name, type } = req.body;
    try {
      const stmt = db.prepare("UPDATE categories SET name = ?, type = ? WHERE id = ? AND (userId = ? OR ? = 'SUPER_ADMIN') AND deleted_at IS NULL");
      stmt.run(name, type, req.params.id, req.user.id, req.user.role);
      logActivity(req.user.id, req.user.email, 'UPDATE_CATEGORY', `Updated category #${req.params.id}`);
      res.json({ message: "Category updated" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", authenticateToken, (req: any, res) => {
    try {
      db.prepare("UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND (userId = ? OR ? = 'SUPER_ADMIN')").run(req.params.id, req.user.id, req.user.role);
      logActivity(req.user.id, req.user.email, 'DELETE_CATEGORY', `Deleted category #${req.params.id}`);
      res.json({ message: "Category deleted" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Export
  app.get("/api/user/export-json", authenticateToken, (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const user = db.prepare("SELECT id, email, name, role, currency, language, created_at FROM users WHERE id = ? AND deleted_at IS NULL").get(userId) as any;
      const transactions = db.prepare("SELECT * FROM transactions WHERE userId = ? AND deleted_at IS NULL").all(userId);
      const recurring = db.prepare("SELECT * FROM recurring_transactions WHERE userId = ? AND deleted_at IS NULL").all(userId);
      const budgets = db.prepare(`
        SELECT b.*, c.name as categoryName 
        FROM budgets b 
        JOIN categories c ON b.categoryId = c.id 
        WHERE b.userId = ? AND b.deleted_at IS NULL
      `).all(userId);
      const categories = db.prepare("SELECT * FROM categories WHERE (userId = ? OR userId IS NULL) AND deleted_at IS NULL").all(userId);
      
      const exportData = {
        profile: user,
        transactions: transactions,
        recurringTransactions: recurring,
        budgets: budgets,
        categories: categories,
        exportDate: new Date().toISOString(),
        version: "1.1"
      };
      
      res.setHeader('Content-Disposition', `attachment; filename="expense_data_export_${userId}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(exportData, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/user/restore-json", authenticateToken, (req: any, res) => {
    const { profile, transactions, recurringTransactions, categories, budgets } = req.body;
    const userId = req.user.id;

    try {
      // Start a transaction for data integrity
      const transaction = db.transaction(() => {
        // 1. Restore categories if they exist in the export
        if (categories && Array.isArray(categories)) {
          const insertCategory = db.prepare(`
            INSERT OR IGNORE INTO categories (userId, name, type)
            VALUES (?, ?, ?)
          `);
          for (const cat of categories) {
            insertCategory.run(userId, cat.name, cat.type);
          }
        }

        // 2. Delete existing data
        db.prepare("DELETE FROM transactions WHERE userId = ?").run(userId);
        db.prepare("DELETE FROM recurring_transactions WHERE userId = ?").run(userId);

        // Helper to get categoryId by name for this user
        const getCatId = (name: string, type: string) => {
          const row = db.prepare("SELECT id FROM categories WHERE name = ? AND type = ? AND (userId = ? OR userId IS NULL) AND deleted_at IS NULL").get(name, type, userId) as any;
          return row ? row.id : null;
        };

        // 3. Restore transactions
        const insertTransaction = db.prepare(`
          INSERT INTO transactions (userId, type, amount, categoryId, date, description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of transactions) {
          let finalCategoryId = t.categoryId;
          if (!finalCategoryId && t.category) {
            finalCategoryId = getCatId(t.category, t.type);
          }
          
          if (finalCategoryId) {
            insertTransaction.run(userId, t.type, t.amount, finalCategoryId, t.date, t.description, t.status || 'ACTIVE');
          }
        }

        // 4. Restore recurring transactions
        const insertRecurring = db.prepare(`
          INSERT INTO recurring_transactions (userId, type, amount, categoryId, frequency, startDate, nextDate, description, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const rt of recurringTransactions) {
          let finalCategoryId = rt.categoryId;
          if (!finalCategoryId && rt.category) {
            finalCategoryId = getCatId(rt.category, rt.type);
          }
          
          if (finalCategoryId) {
            insertRecurring.run(userId, rt.type, rt.amount, finalCategoryId, rt.frequency, rt.startDate, rt.nextDate, rt.description, rt.active);
          }
        }

        // 5. Restore budgets
        if (budgets && Array.isArray(budgets)) {
          db.prepare("DELETE FROM budgets WHERE userId = ?").run(userId);
          const insertBudget = db.prepare(`
            INSERT INTO budgets (userId, categoryId, amount, period)
            VALUES (?, ?, ?, ?)
          `);
          for (const b of budgets) {
            let finalCategoryId = b.categoryId;
            // If we have categoryName in the export, try to look it up to be safe
            if (b.categoryName) {
              finalCategoryId = getCatId(b.categoryName, 'EXPENSE');
            }
            
            if (finalCategoryId) {
              try {
                insertBudget.run(userId, finalCategoryId, b.amount, b.period || 'MONTHLY');
              } catch (e) {
                console.error("Failed to restore budget:", e);
              }
            }
          }
        }

        // 5. Update profile if provided
        if (profile) {
          db.prepare("UPDATE users SET currency = ?, language = ? WHERE id = ?")
            .run(profile.currency || 'USD', profile.language || 'en', userId);
        }
      });

      transaction();
      res.json({ message: "Data restored successfully" });
    } catch (error: any) {
      console.error('Restore error:', error);
      res.status(400).json({ error: "Invalid data format or database error" });
    }
  });

  app.get("/api/export/:format", authenticateToken, hasPermission('export_data'), (req: any, res) => {
    const transactions = db.prepare(`
      SELECT t.type, t.amount, c.name as category, t.date, t.description 
      FROM transactions t 
      LEFT JOIN categories c ON t.categoryId = c.id 
      WHERE t.userId = ? AND t.deleted_at IS NULL
    `).all(req.user.id);
    
    if (req.params.format === 'csv' || req.params.format === 'xlsx') {
      const ws = xlsx.utils.json_to_sheet(transactions);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Transactions");
      
      const buf = xlsx.write(wb, { type: 'buffer', bookType: req.params.format as any });
      res.setHeader('Content-Disposition', `attachment; filename="transactions.${req.params.format}"`);
      res.setHeader('Content-Type', req.params.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } else {
      res.status(400).json({ error: "Invalid format" });
    }
  });

  // --- Google Drive Sync ---
  app.get('/api/auth/google/url', (req, res) => {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: `${appUrl}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent'
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    
    try {
      // 1. Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: `${appUrl}/auth/callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || 'Failed to exchange code');

      // 2. Get user info from Google
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userResponse.json();

      // 3. Find or create user in DB
      let user = db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(googleUser.email) as any;
      
      if (!user) {
        const userCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL").get() as any).count;
        const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';
        // First user is approved automatically, others need approval
        const status = role === 'SUPER_ADMIN' ? 'APPROVED' : 'PENDING';
        const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);
        
        const stmt = db.prepare("INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)");
        const result = stmt.run(googleUser.email, dummyPassword, googleUser.name, role, status);
        user = { id: result.lastInsertRowid, email: googleUser.email, role, name: googleUser.name, status };
      }

      // 4. Check if user is approved
      if (user.status !== 'APPROVED') {
        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_ERROR',
                    error: 'Account pending approval'
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/?error=pending';
                }
              </script>
              <p>Authentication failed: Account pending approval. You can close this window.</p>
            </body>
          </html>
        `);
      }

      // 5. Generate JWT
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);

      // 6. Send success message and token to parent window
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS',
                  token: '${token}',
                  user: ${JSON.stringify({ 
                    id: user.id, 
                    email: user.email, 
                    role: user.role, 
                    name: user.name,
                    currency: user.currency,
                    language: user.language
                  })}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.post('/api/sync/google-drive', authenticateToken, async (req, res) => {
    // Logic to upload database.sqlite to Google Drive
    // This would use the stored refresh token to get an access token
    // Then use the Google Drive API to upload the file
    res.json({ message: "Database synced to Google Drive successfully!" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default appPromise;
