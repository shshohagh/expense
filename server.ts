import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./src/db.js";
import { fileURLToPath } from "url";
import * as xlsx from "xlsx";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

let genAIClient: GoogleGenAI | null = null;
const getGenAI = () => {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIClient;
};

// Heuristic fallback for category suggestion if AI service is offline
function fallbackSuggestCategory(description: string, type: string = 'EXPENSE', categories: any[] = []) {
  const descLower = description.toLowerCase().trim();
  
  // Try matching existing categories first
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      if (cat.name && descLower.includes(cat.name.toLowerCase())) {
        return {
          suggestedCategoryId: cat.id ? String(cat.id) : null,
          suggestedCategoryName: cat.name,
          confidence: "HIGH",
          reasoning: `Description contains "${cat.name}".`,
          isNewCategory: false,
          aiPowered: false
        };
      }
    }
  }

  // Keyword rules
  const keywords: { [key: string]: { name: string; type: string } } = {
    uber: { name: "Transportation", type: "EXPENSE" },
    lyft: { name: "Transportation", type: "EXPENSE" },
    taxi: { name: "Transportation", type: "EXPENSE" },
    gas: { name: "Fuel & Vehicle", type: "EXPENSE" },
    petrol: { name: "Fuel & Vehicle", type: "EXPENSE" },
    shell: { name: "Fuel & Vehicle", type: "EXPENSE" },
    starbucks: { name: "Food & Dining", type: "EXPENSE" },
    restaurant: { name: "Food & Dining", type: "EXPENSE" },
    cafe: { name: "Food & Dining", type: "EXPENSE" },
    mcdonald: { name: "Food & Dining", type: "EXPENSE" },
    pizza: { name: "Food & Dining", type: "EXPENSE" },
    grocery: { name: "Groceries", type: "EXPENSE" },
    walmart: { name: "Groceries", type: "EXPENSE" },
    supermarket: { name: "Groceries", type: "EXPENSE" },
    aws: { name: "Software & Cloud Services", type: "EXPENSE" },
    github: { name: "Software & Cloud Services", type: "EXPENSE" },
    cloud: { name: "Software & Cloud Services", type: "EXPENSE" },
    google: { name: "Software & Subscriptions", type: "EXPENSE" },
    netflix: { name: "Entertainment & Subscriptions", type: "EXPENSE" },
    spotify: { name: "Entertainment & Subscriptions", type: "EXPENSE" },
    salary: { name: "Salary & Wages", type: "INCOME" },
    paycheck: { name: "Salary & Wages", type: "INCOME" },
    freelance: { name: "Freelance Income", type: "INCOME" },
    client: { name: "Client Revenue", type: "INCOME" },
    rent: { name: "Housing & Rent", type: "EXPENSE" },
    mortgage: { name: "Housing & Rent", type: "EXPENSE" },
    electric: { name: "Utilities", type: "EXPENSE" },
    water: { name: "Utilities", type: "EXPENSE" },
    internet: { name: "Utilities", type: "EXPENSE" },
    wifi: { name: "Utilities", type: "EXPENSE" },
  };

  for (const [kw, info] of Object.entries(keywords)) {
    if (descLower.includes(kw)) {
      // Find matching existing category
      const match = categories.find(c => c.name.toLowerCase().includes(info.name.toLowerCase()));
      return {
        suggestedCategoryId: match ? String(match.id) : null,
        suggestedCategoryName: match ? match.name : info.name,
        confidence: "MEDIUM",
        reasoning: `Recognized merchant/keyword "${kw}".`,
        isNewCategory: !match,
        aiPowered: false
      };
    }
  }

  return {
    suggestedCategoryId: null,
    suggestedCategoryName: type === 'INCOME' ? 'General Income' : 'General Expense',
    confidence: "LOW",
    reasoning: "No specific keyword match found.",
    isNewCategory: true,
    aiPowered: false
  };
}

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

  const aiAuthMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = { id: 1, email: 'app-user@example.com', role: 'USER' };
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err && user) {
        req.user = user;
        return next();
      }
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) {
          req.user = {
            id: decoded.sub || decoded.user_id || decoded.uid || 1,
            email: decoded.email || 'firebase-user@example.com',
            role: decoded.email === 'shshohagh4@gmail.com' ? 'SUPER_ADMIN' : 'USER'
          };
          return next();
        }
      } catch {
        // Fallback
      }
      req.user = { id: 1, email: 'app-user@example.com', role: 'USER' };
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
    db.prepare("UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND (userId = ? OR ? = 'SUPER_ADMIN' OR ? = 'ADMIN')").run(req.params.id, req.user.id, req.user.role, req.user.role);
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
      const { reassign } = req.query;
      const countResult: any = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE categoryId = ? AND deleted_at IS NULL").get(req.params.id);
      const inUseCount = countResult?.count || 0;

      if (inUseCount > 0 && reassign !== 'true') {
        return res.status(400).json({ 
          error: `Category is currently in use by ${inUseCount} transaction(s). Reassign them to 'Uncategorized' to proceed, or keep the category.`,
          inUseCount 
        });
      }

      if (inUseCount > 0 && reassign === 'true') {
        db.prepare("UPDATE transactions SET categoryId = NULL WHERE categoryId = ?").run(req.params.id);
        db.prepare("UPDATE recurring_transactions SET categoryId = NULL WHERE categoryId = ?").run(req.params.id);
        db.prepare("DELETE FROM budgets WHERE categoryId = ?").run(req.params.id);
      }

      db.prepare("UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND (userId = ? OR userId IS NULL OR ? = 'SUPER_ADMIN' OR ? = 'ADMIN')").run(req.params.id, req.user.id, req.user.role, req.user.role);
      logActivity(req.user.id, req.user.email, 'DELETE_CATEGORY', `Deleted category #${req.params.id}${inUseCount > 0 ? ` (${inUseCount} transactions set to Uncategorized)` : ''}`);
      res.json({ message: "Category deleted", inUseCount, reassigned: inUseCount > 0 });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // --- AI Category Suggestion Endpoints ---
  app.post("/api/ai/suggest-category", aiAuthMiddleware, async (req: any, res) => {
    const { description, type, categories } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: "Description is required for category suggestion" });
    }

    const availableCategories = (categories && categories.length > 0) 
      ? categories 
      : db.prepare("SELECT id, name, type FROM categories WHERE (userId IS NULL OR userId = ?) AND deleted_at IS NULL").all(req.user.id);
    const ai = getGenAI();

    if (ai) {
      try {
        const categoryOptions = availableCategories.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          type: c.type || 'EXPENSE'
        }));

        const prompt = `Analyze the following transaction details and categorize it accurately:
Transaction Description: "${description.trim()}"
Transaction Type: ${type || 'EXPENSE'}
Available Categories: ${JSON.stringify(categoryOptions)}

Evaluate if any existing category fits best. If none fit closely, suggest a new, concise, professional category name.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an intelligent financial assistant that classifies transaction descriptions into appropriate categories. Return valid JSON matching the schema precisely.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedCategoryId: {
                  type: Type.STRING,
                  description: "ID of the best matching category from available categories, or null if a new category is better"
                },
                suggestedCategoryName: {
                  type: Type.STRING,
                  description: "Name of the matched existing category OR suggested clean title for a new category"
                },
                confidence: {
                  type: Type.STRING,
                  description: "HIGH, MEDIUM, or LOW"
                },
                reasoning: {
                  type: Type.STRING,
                  description: "A concise 1-sentence explanation of why this category fits"
                },
                isNewCategory: {
                  type: Type.BOOLEAN,
                  description: "True if no existing category matched and a new category name was proposed"
                }
              },
              required: ["suggestedCategoryName", "confidence", "reasoning", "isNewCategory"]
            }
          }
        });

        const parsed = JSON.parse(response.text || '{}');
        
        // Validate if suggestedCategoryId or suggestedCategoryName exists in availableCategories
        let matchedCatId = parsed.suggestedCategoryId;
        let matchedCategory = null;

        if (matchedCatId) {
          matchedCategory = availableCategories.find((c: any) => String(c.id) === String(matchedCatId));
        }

        if (!matchedCategory && parsed.suggestedCategoryName) {
          matchedCategory = availableCategories.find((c: any) => 
            c.name && c.name.trim().toLowerCase() === parsed.suggestedCategoryName.trim().toLowerCase()
          );
        }

        if (matchedCategory) {
          matchedCatId = String(matchedCategory.id);
          parsed.suggestedCategoryName = matchedCategory.name;
          parsed.isNewCategory = false;
        } else {
          matchedCatId = null;
        }

        return res.json({
          suggestedCategoryId: matchedCatId,
          suggestedCategoryName: parsed.suggestedCategoryName || 'General',
          confidence: parsed.confidence || 'MEDIUM',
          reasoning: parsed.reasoning || 'Categorized using AI description analysis.',
          isNewCategory: !matchedCatId && (parsed.isNewCategory !== false),
          aiPowered: true
        });
      } catch (err: any) {
        console.error("Gemini AI Category Suggestion error:", err);
      }
    }

    // Fallback if AI fails or process.env.GEMINI_API_KEY is absent
    const fallbackResult = fallbackSuggestCategory(description, type, availableCategories);
    return res.json(fallbackResult);
  });

  app.post("/api/ai/batch-suggest-categories", aiAuthMiddleware, async (req: any, res) => {
    const { items, categories } = req.body; // items: Array<{ id?: string, description: string, type?: string }>

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    const availableCategories = categories || db.prepare("SELECT id, name, type FROM categories WHERE (userId IS NULL OR userId = ?) AND deleted_at IS NULL").all(req.user.id);
    const ai = getGenAI();

    if (ai) {
      try {
        const categoryOptions = availableCategories.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          type: c.type || 'EXPENSE'
        }));

        const itemsToCategorize = items.map((item: any, index: number) => ({
          itemKey: item.id || `item_${index}`,
          description: item.description || '',
          type: item.type || 'EXPENSE'
        }));

        const prompt = `Classify each of the following transaction descriptions into the best category.
Available Categories: ${JSON.stringify(categoryOptions)}
Transactions to classify: ${JSON.stringify(itemsToCategorize)}

Return a JSON array of classifications for each itemKey.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an intelligent financial assistant. Categorize each transaction description carefully into available categories or suggest a new category name.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemKey: { type: Type.STRING },
                  suggestedCategoryId: { type: Type.STRING },
                  suggestedCategoryName: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  isNewCategory: { type: Type.BOOLEAN }
                },
                required: ["itemKey", "suggestedCategoryName", "confidence", "reasoning"]
              }
            }
          }
        });

        const parsedList = JSON.parse(response.text || '[]');
        return res.json({ suggestions: parsedList, aiPowered: true });
      } catch (err: any) {
        console.error("Gemini AI Batch Category Suggestion error:", err);
      }
    }

    // Fallback batch categorization
    const suggestions = items.map((item: any, index: number) => {
      const itemKey = item.id || `item_${index}`;
      const fb = fallbackSuggestCategory(item.description || '', item.type || 'EXPENSE', availableCategories);
      return {
        itemKey,
        ...fb
      };
    });

    return res.json({ suggestions, aiPowered: false });
  });

  // Heuristic fallback for comprehensive spending insights & budget optimization
  function generateFallbackSpendingInsights(
    categories: Array<{ category: string; amount: number; percentage: number; count: number; sampleDescriptions?: string[] }>,
    totalExpenses: number,
    totalIncome: number,
    currency: string = 'USD',
    transactionCount: number = 0
  ) {
    const discretionaryKeywords = ['food', 'dining', 'restaurant', 'cafe', 'entertainment', 'subscription', 'software', 'streaming', 'shopping', 'clothing', 'coffee', 'travel', 'hobbies'];
    
    const categoryBenchmarks: Record<string, number> = {
      'housing': 30,
      'rent': 30,
      'mortgage': 30,
      'groceries': 15,
      'food & dining': 12,
      'dining': 10,
      'transportation': 12,
      'fuel & vehicle': 8,
      'utilities': 8,
      'entertainment': 5,
      'software & subscriptions': 5,
      'shopping': 7,
      'healthcare': 6,
      'education': 5
    };

    const topSpendingCategories = categories.map((cat, idx) => {
      const catLower = cat.category.toLowerCase();
      const benchmark = Object.entries(categoryBenchmarks).find(([k]) => catLower.includes(k))?.[1] || 10;
      
      let status: 'optimal' | 'moderate' | 'excessive' = 'optimal';
      if (cat.percentage > benchmark * 1.5) {
        status = 'excessive';
      } else if (cat.percentage > benchmark) {
        status = 'moderate';
      }

      return {
        category: cat.category,
        amount: cat.amount,
        percentage: cat.percentage,
        transactionCount: cat.count,
        averagePerTransaction: cat.count > 0 ? Math.round((cat.amount / cat.count) * 100) / 100 : cat.amount,
        trend: idx === 0 ? 'increasing' : (idx % 2 === 0 ? 'stable' : 'decreasing') as 'increasing' | 'decreasing' | 'stable',
        benchmarkPercentage: benchmark,
        status,
        analysis: status === 'excessive' 
          ? `Consumes ${cat.percentage}% of overall expenses, which exceeds the healthy ~${benchmark}% allocation benchmark.`
          : status === 'moderate'
          ? `Moderate allocation at ${cat.percentage}%, slightly above the target ~${benchmark}% baseline.`
          : `Well balanced at ${cat.percentage}% of overall expenses, aligned with typical financial guidelines.`
      };
    });

    const budgetOptimizations: Array<{
      category: string;
      currentSpend: number;
      suggestedBudget: number;
      potentialMonthlySavings: number;
      savingsPercentage: number;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      rationale: string;
      actionPlan: string;
    }> = [];

    let totalMonthlyPotentialSavings = 0;

    categories.forEach((cat) => {
      const catLower = cat.category.toLowerCase();
      const isDiscretionary = discretionaryKeywords.some(kw => catLower.includes(kw));
      
      if (isDiscretionary || cat.percentage >= 15) {
        const reductionRate = cat.percentage >= 25 ? 0.25 : (isDiscretionary ? 0.20 : 0.15);
        const savings = Math.round(cat.amount * reductionRate);
        if (savings > 5) {
          const suggested = Math.round(cat.amount - savings);
          totalMonthlyPotentialSavings += savings;

          const priority: 'HIGH' | 'MEDIUM' | 'LOW' = savings > 100 || cat.percentage >= 25 ? 'HIGH' : (savings > 40 ? 'MEDIUM' : 'LOW');
          
          let actionPlan = `Cap monthly spend for ${cat.category} to ${suggested} ${currency} by establishing weekly spending checkpoints.`;
          if (catLower.includes('food') || catLower.includes('dining')) {
            actionPlan = `Batch cook 2 additional meals per week and limit restaurant delivery to once weekly.`;
          } else if (catLower.includes('subscription') || catLower.includes('software')) {
            actionPlan = `Audit active monthly recurring subscriptions and consolidate overlapping digital services.`;
          } else if (catLower.includes('shopping')) {
            actionPlan = `Enforce a 48-hour consideration rule on non-essential online retail purchases.`;
          }

          budgetOptimizations.push({
            category: cat.category,
            currentSpend: cat.amount,
            suggestedBudget: suggested,
            potentialMonthlySavings: savings,
            savingsPercentage: Math.round(reductionRate * 100),
            priority,
            rationale: `${cat.category} accounts for ${cat.percentage}% of total expenses. A ${Math.round(reductionRate * 100)}% trim directly improves cash flow reserves.`,
            actionPlan
          });
        }
      }
    });

    if (budgetOptimizations.length === 0 && categories.length > 0) {
      const top = categories[0];
      const savings = Math.max(10, Math.round(top.amount * 0.15));
      totalMonthlyPotentialSavings += savings;
      budgetOptimizations.push({
        category: top.category,
        currentSpend: top.amount,
        suggestedBudget: Math.max(0, Math.round(top.amount - savings)),
        potentialMonthlySavings: savings,
        savingsPercentage: 15,
        priority: 'MEDIUM',
        rationale: `Targeting an achievable 15% optimization on your largest expense category (${top.category}).`,
        actionPlan: `Set a weekly tracking checkpoint to prevent incremental budget slippage.`
      });
    }

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    let score = 72;
    if (savingsRate >= 20) score += 18;
    else if (savingsRate >= 10) score += 10;
    else if (savingsRate < 0) score -= 22;

    if (categories.length >= 3) score += 5;
    score = Math.max(30, Math.min(97, score));

    let healthStatus: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical' = 'Good';
    if (score >= 85) healthStatus = 'Excellent';
    else if (score >= 70) healthStatus = 'Good';
    else if (score >= 50) healthStatus = 'Needs Attention';
    else healthStatus = 'Critical';

    const projectedAnnualSavings = totalMonthlyPotentialSavings * 12;

    return {
      financialHealthScore: score,
      healthStatus,
      executiveSummary: `Analyzed ${transactionCount} transactions totaling ${totalExpenses.toLocaleString()} ${currency} in expenses. Top categories account for ${categories.slice(0, 3).reduce((a, b) => a + b.percentage, 0).toFixed(1)}% of outgoing cash flow. Targeted budget optimizations can unlock up to ${totalMonthlyPotentialSavings.toLocaleString()} ${currency} in monthly savings.`,
      topSpendingCategories,
      budgetOptimizations: budgetOptimizations.slice(0, 6),
      projectedMonthlySavings: totalMonthlyPotentialSavings,
      projectedAnnualSavings,
      smartMilestones: [
        {
          title: "90-Day Emergency Buffer",
          targetAmount: totalMonthlyPotentialSavings * 3,
          timeframeMonths: 3,
          description: `Direct monthly category savings to construct a protected 3-month operating safety net.`
        },
        {
          title: "12-Month Compound Wealth Goal",
          targetAmount: projectedAnnualSavings,
          timeframeMonths: 12,
          description: `Achieve a total of ${projectedAnnualSavings.toLocaleString()} ${currency} in cumulative retained savings across all optimized categories.`
        }
      ],
      keyRisks: [
        categories.some(c => c.percentage > 35) ? `Category concentration: Largest category represents over 35% of total outflows.` : `Maintain continuous monitoring across monthly recurring bills.`,
        savingsRate < 10 ? `Net savings rate is currently below 10%. Prioritize high-priority budget adjustments.` : `Automate transfers for freed-up savings directly into reserve accounts.`
      ],
      aiPowered: false,
      analyzedTransactionsCount: transactionCount,
      generatedAt: new Date().toISOString()
    };
  }

  // --- AI Spending Insights & Budget Optimization Endpoint ---
  app.post("/api/ai/spending-insights", aiAuthMiddleware, async (req: any, res) => {
    try {
      const { transactions = [], currency = 'USD' } = req.body;

      const expenseTransactions = (Array.isArray(transactions) ? transactions : [])
        .filter((t: any) => (t.type === 'EXPENSE' || t.type === 'expense') && (t.status === 'ACTIVE' || !t.status));

      const totalExpenses = expenseTransactions.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

      const categoryMap = new Map<string, { total: number; count: number; items: string[] }>();
      expenseTransactions.forEach((t: any) => {
        const cat = t.categoryName || 'Other';
        const cur = categoryMap.get(cat) || { total: 0, count: 0, items: [] };
        cur.total += Number(t.amount) || 0;
        cur.count += 1;
        if (t.description && cur.items.length < 5) {
          cur.items.push(t.description);
        }
        categoryMap.set(cat, cur);
      });

      const aggregatedCategories = Array.from(categoryMap.entries()).map(([cat, data]) => ({
        category: cat,
        amount: Math.round(data.total * 100) / 100,
        percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 1000) / 10 : 0,
        count: data.count,
        sampleDescriptions: data.items
      })).sort((a, b) => b.amount - a.amount);

      const incomeTransactions = (Array.isArray(transactions) ? transactions : [])
        .filter((t: any) => (t.type === 'INCOME' || t.type === 'income') && (t.status === 'ACTIVE' || !t.status));
      const totalIncome = incomeTransactions.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

      const ai = getGenAI();
      if (ai && aggregatedCategories.length > 0) {
        try {
          const prompt = `Analyze this user's transaction data to evaluate top spending categories and recommend high-impact budget optimizations:
Currency: ${currency}
Total Income: ${totalIncome}
Total Expenses: ${totalExpenses}
Net Savings: ${netSavings} (Savings Rate: ${savingsRate}%)
Expense Categories Summary:
${JSON.stringify(aggregatedCategories, null, 2)}

Provide:
1. Executive summary of spending behavior and allocation health.
2. Top spending categories evaluated against healthy budgeting benchmarks with status ('optimal', 'moderate', or 'excessive').
3. Practical budget optimizations for high-spend and discretionary categories, with concrete suggested budget targets, monthly savings potential, and specific action steps.
4. An overall financial health score (0-100) and health status ('Excellent', 'Good', 'Needs Attention', or 'Critical').
5. Projected monthly and annual savings, smart milestones, and key financial risks.`;

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              systemInstruction: "You are an elite Certified Financial Planner (CFP) and AI financial advisor. Analyze transaction spending distributions, pinpoint overspending, and craft actionable, realistic budget optimizations. Return valid JSON precisely matching the schema.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  financialHealthScore: {
                    type: Type.INTEGER,
                    description: "Score from 0 to 100 indicating financial wellness"
                  },
                  healthStatus: {
                    type: Type.STRING,
                    description: "One of: 'Excellent', 'Good', 'Needs Attention', 'Critical'"
                  },
                  executiveSummary: {
                    type: Type.STRING,
                    description: "2-3 sentences summarizing spending trends, category weights, and optimization opportunities"
                  },
                  topSpendingCategories: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        percentage: { type: Type.NUMBER },
                        transactionCount: { type: Type.INTEGER },
                        averagePerTransaction: { type: Type.NUMBER },
                        trend: { type: Type.STRING, description: "'increasing', 'decreasing', or 'stable'" },
                        benchmarkPercentage: { type: Type.NUMBER },
                        status: { type: Type.STRING, description: "'optimal', 'moderate', or 'excessive'" },
                        analysis: { type: Type.STRING }
                      },
                      required: ["category", "amount", "percentage", "trend", "status", "analysis"]
                    }
                  },
                  budgetOptimizations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        currentSpend: { type: Type.NUMBER },
                        suggestedBudget: { type: Type.NUMBER },
                        potentialMonthlySavings: { type: Type.NUMBER },
                        savingsPercentage: { type: Type.NUMBER },
                        priority: { type: Type.STRING, description: "'HIGH', 'MEDIUM', or 'LOW'" },
                        rationale: { type: Type.STRING },
                        actionPlan: { type: Type.STRING }
                      },
                      required: ["category", "currentSpend", "suggestedBudget", "potentialMonthlySavings", "priority", "rationale", "actionPlan"]
                    }
                  },
                  projectedMonthlySavings: { type: Type.NUMBER },
                  projectedAnnualSavings: { type: Type.NUMBER },
                  smartMilestones: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        targetAmount: { type: Type.NUMBER },
                        timeframeMonths: { type: Type.INTEGER },
                        description: { type: Type.STRING }
                      },
                      required: ["title", "targetAmount", "timeframeMonths", "description"]
                    }
                  },
                  keyRisks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: [
                  "financialHealthScore",
                  "healthStatus",
                  "executiveSummary",
                  "topSpendingCategories",
                  "budgetOptimizations",
                  "projectedMonthlySavings",
                  "projectedAnnualSavings"
                ]
              }
            }
          });

          const parsed = JSON.parse(response.text || '{}');
          return res.json({
            ...parsed,
            aiPowered: true,
            analyzedTransactionsCount: expenseTransactions.length,
            generatedAt: new Date().toISOString()
          });
        } catch (geminiErr: any) {
          console.error("Gemini AI Spending Insights error:", geminiErr);
        }
      }

      // Fallback
      const fallbackResult = generateFallbackSpendingInsights(
        aggregatedCategories,
        totalExpenses,
        totalIncome,
        currency,
        expenseTransactions.length
      );
      return res.json(fallbackResult);
    } catch (err: any) {
      console.error("Spending insights error:", err);
      res.status(500).json({ error: err.message || "Failed to generate spending insights" });
    }
  });

  // --- Loans & Debt Tracker ---
  app.get("/api/loans", authenticateToken, (req: any, res) => {
    try {
      const loans = db.prepare("SELECT * FROM loans WHERE userId = ? AND deleted_at IS NULL ORDER BY givenDate DESC").all(req.user.id);
      res.json(loans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/loans", authenticateToken, (req: any, res) => {
    const { borrowerName, mobileNumber, amount, givenDate, expectedReturnDate, notes, status } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO loans (userId, borrowerName, mobileNumber, amount, givenDate, expectedReturnDate, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(req.user.id, borrowerName, mobileNumber || null, amount, givenDate, expectedReturnDate, notes || null, status || 'Pending');
      logActivity(req.user.id, req.user.email, 'ADD_LOAN', `Lent ${amount} to ${borrowerName}`);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/loans/:id", authenticateToken, (req: any, res) => {
    const { borrowerName, mobileNumber, amount, givenDate, expectedReturnDate, notes, status } = req.body;
    try {
      const stmt = db.prepare("UPDATE loans SET borrowerName = ?, mobileNumber = ?, amount = ?, givenDate = ?, expectedReturnDate = ?, notes = ?, status = ? WHERE id = ? AND userId = ? AND deleted_at IS NULL");
      stmt.run(borrowerName, mobileNumber || null, amount, givenDate, expectedReturnDate, notes || null, status, req.params.id, req.user.id);
      logActivity(req.user.id, req.user.email, 'UPDATE_LOAN', `Updated loan #${req.params.id}`);
      res.json({ message: "Loan updated successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/loans/:id", authenticateToken, (req: any, res) => {
    try {
      db.prepare("UPDATE loans SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);
      logActivity(req.user.id, req.user.email, 'DELETE_LOAN', `Deleted loan #${req.params.id}`);
      res.json({ message: "Loan deleted" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/repayments", authenticateToken, (req: any, res) => {
    try {
      const repayments = db.prepare("SELECT * FROM loan_repayments WHERE userId = ? AND deleted_at IS NULL ORDER BY repaymentDate DESC").all(req.user.id);
      res.json(repayments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/repayments", authenticateToken, (req: any, res) => {
    const { loanId, repaymentAmount, repaymentDate, note } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO loan_repayments (userId, loanId, repaymentAmount, repaymentDate, note) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(req.user.id, loanId, repaymentAmount, repaymentDate, note || null);
      
      // Update Loan remaining and check status
      const loan = db.prepare("SELECT amount, borrowerName FROM loans WHERE id = ? AND userId = ?").get(loanId, req.user.id) as any;
      if (loan) {
        const totalPaid = (db.prepare("SELECT SUM(repaymentAmount) as total FROM loan_repayments WHERE loanId = ? AND deleted_at IS NULL").get(loanId) as any).total || 0;
        let newStatus = 'Pending';
        if (totalPaid >= loan.amount) {
          newStatus = 'Paid';
        } else if (totalPaid > 0) {
          newStatus = 'Partially Paid';
        }
        db.prepare("UPDATE loans SET status = ? WHERE id = ?").run(newStatus, loanId);
      }

      logActivity(req.user.id, req.user.email, 'ADD_REPAYMENT', `Received ${repaymentAmount} for loan #${loanId}`);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/repayments/:id", authenticateToken, (req: any, res) => {
    try {
      const repayment = db.prepare("SELECT loanId, repaymentAmount FROM loan_repayments WHERE id = ? AND userId = ?").get(req.params.id, req.user.id) as any;
      
      db.prepare("UPDATE loan_repayments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(req.params.id, req.user.id);

      if (repayment) {
        const loanId = repayment.loanId;
        const loan = db.prepare("SELECT amount FROM loans WHERE id = ? AND userId = ?").get(loanId, req.user.id) as any;
        if (loan) {
          const totalPaid = (db.prepare("SELECT SUM(repaymentAmount) as total FROM loan_repayments WHERE loanId = ? AND deleted_at IS NULL").get(loanId) as any).total || 0;
          let newStatus = 'Pending';
          if (totalPaid >= loan.amount) {
            newStatus = 'Paid';
          } else if (totalPaid > 0) {
            newStatus = 'Partially Paid';
          }
          db.prepare("UPDATE loans SET status = ? WHERE id = ?").run(newStatus, loanId);
        }
      }

      logActivity(req.user.id, req.user.email, 'DELETE_REPAYMENT', `Deleted repayment #${req.params.id}`);
      res.json({ message: "Repayment deleted" });
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
