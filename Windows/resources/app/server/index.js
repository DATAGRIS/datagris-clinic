const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const sync = require('./sync');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware to wrap every request in AsyncLocalStorage context for multi-tenant RLS propagation
app.use((req, res, next) => {
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.sub) {
        userId = decoded.sub;
      }
    } catch (e) {
      console.error('Failed to decode JWT token in middleware:', e);
    }
  }
  
  db.asyncLocalStorage.run({ userId }, () => {
    next();
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event === 'SUMMON_RECEPTIONIST') {
        broadcast(data);
      }
    } catch (e) {
      console.error('WebSocket received message parse error:', e);
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Helper: Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper: Normalize Arabic string for search
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .trim()
    .toLowerCase();
}

// Helper: Parse SQLite date (UTC representation) safely into Local JS Date
function parseDbDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'object') return dateStr;
  let s = String(dateStr);
  if (!s.includes('T') && !s.includes('Z')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  return new Date(s);
}


// --- MIDDLEWARES ---
// Simple mock auth or simple validation
function validateUser(req, res, next) {
  // Offline-first simple token check or bypass for local dev
  next();
}

// --- TREASURY HELPER FUNCTIONS ---

// Helper: Get active treasury session
async function getActiveTreasurySession() {
  try {
    const session = await db.queryOne("SELECT * FROM treasury_sessions WHERE status = 'open' LIMIT 1");
    return session || null;
  } catch (err) {
    console.error("Error in getActiveTreasurySession:", err);
    return null;
  }
}

// Helper: Add Treasury Transaction
async function addTreasuryTransaction({
  type,
  amount,
  description,
  relatedPatientMobile = null,
  relatedVisitId = null,
  userResponsible = 'system',
  date = null,
  time = null
}) {
  const session = await getActiveTreasurySession();
  const sessionId = session ? session.id : null;
  
  const todayStr = date || new Date().toISOString().split('T')[0];
  const timeStr = time || new Date().toTimeString().split(' ')[0];

  const result = await db.runCommand(
    `INSERT INTO treasury_transactions (
      treasury_session_id, date, time, type, amount, description, 
      related_patient_mobile, related_visit_id, user_responsible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId, todayStr, timeStr, type, parseFloat(amount), description,
      relatedPatientMobile, relatedVisitId, userResponsible
    ]
  );
  return result;
}

// Helper: Enforce treasury is open
async function enforceActiveTreasury(req, res, next) {
  const session = await getActiveTreasurySession();
  if (!session) {
    return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لبدء العمليات المالية.' });
  }
  req.treasurySession = session;
  next();
}

// --- TREASURY API ROUTES ---

// Get active session status
app.get('/api/treasury/status', async (req, res) => {
  try {
    const session = await getActiveTreasurySession();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open daily treasury
app.post('/api/treasury/open', async (req, res) => {
  const { openingBalance, notes, userOpening } = req.body;
  try {
    const active = await getActiveTreasurySession();
    if (active) {
      return res.status(400).json({ error: 'الخزينة مفتوحة بالفعل!' });
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];
    
    const result = await db.runCommand(
      `INSERT INTO treasury_sessions (
        opening_date, opening_time, opening_balance, opening_user, status, notes
      ) VALUES (?, ?, ?, ?, 'open', ?)`,
      [todayStr, timeStr, parseFloat(openingBalance || 0), userOpening || 'admin', notes || '']
    );
    
    const newSession = await db.queryOne("SELECT * FROM treasury_sessions WHERE id = ?", [result.insertId]);
    
    // Log transaction for opening balance
    await addTreasuryTransaction({
      type: 'adjustment',
      amount: parseFloat(openingBalance || 0),
      description: `افتتاح الخزينة اليومية برصيد ${openingBalance} EGP (TREASURY_OPENING_BALANCE)`,
      userResponsible: userOpening || 'admin',
      date: todayStr,
      time: timeStr
    });
    
    await db.logAudit(1, userOpening || 'admin', 'TREASURY_OPENED', `Opened treasury with starting cash ${openingBalance} EGP`);
    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true, session: newSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close daily treasury
app.post('/api/treasury/close', async (req, res) => {
  const { actualBalance, notes, userClosing } = req.body;
  try {
    const active = await getActiveTreasurySession();
    if (!active) {
      return res.status(400).json({ error: 'الخزينة مغلقة بالفعل!' });
    }
    
    const sessionId = active.id;
    const opening = active.opening_balance || 0;
    
    let sumIncome = 0;
    let sumExpense = 0;
    let sumRefund = 0;
    let sumAdjustment = 0;
    
    const rawTx = await db.queryAll("SELECT * FROM treasury_transactions WHERE treasury_session_id = ?", [sessionId]);
    rawTx.forEach(t => {
      if (t.type === 'income') sumIncome += t.amount;
      else if (t.type === 'expense') sumExpense += t.amount;
      else if (t.type === 'refund') sumRefund += t.amount;
      else if (t.type === 'adjustment') {
        if (!t.description || !t.description.includes('TREASURY_OPENING_BALANCE')) {
          sumAdjustment += t.amount;
        }
      }
    });
    
    const expected = opening + sumIncome - sumExpense - sumRefund + sumAdjustment;
    const actual = parseFloat(actualBalance || 0);
    const diff = actual - expected;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];
    
    await db.runCommand(
      `UPDATE treasury_sessions SET 
        closing_date = ?, closing_time = ?, closing_user = ?, 
        expected_closing_balance = ?, actual_closing_balance = ?, difference = ?, 
        status = 'closed', notes = ?
       WHERE id = ?`,
      [todayStr, timeStr, userClosing || 'admin', expected, actual, diff, notes || '', sessionId]
    );
    
    await db.logAudit(1, userClosing || 'admin', 'TREASURY_CLOSED', `Closed treasury. Expected: ${expected} EGP, Actual: ${actual} EGP, Diff: ${diff} EGP`);
    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true, expected, difference: diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record manual expense
app.post('/api/treasury/expense', enforceActiveTreasury, async (req, res) => {
  const { category, amount, description, userResponsible } = req.body;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];
    
    const txResult = await addTreasuryTransaction({
      type: 'expense',
      amount: parseFloat(amount),
      description: `مصروفات [${category}]: ${description}`,
      userResponsible: userResponsible || 'admin',
      date: todayStr,
      time: timeStr
    });
    
    await db.runCommand(
      `INSERT INTO treasury_expenses (
        treasury_transaction_id, category, amount, date, time, description, user_responsible
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [txResult.insertId, category, parseFloat(amount), todayStr, timeStr, description, userResponsible || 'admin']
    );
    
    await db.logAudit(1, userResponsible || 'admin', 'TREASURY_EXPENSE', `Recorded expense of ${amount} EGP for ${category}`);
    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record cash adjustment
app.post('/api/treasury/adjustment', enforceActiveTreasury, async (req, res) => {
  const { amount, reason, userResponsible } = req.body;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];
    
    await addTreasuryTransaction({
      type: 'adjustment',
      amount: parseFloat(amount),
      description: `تسوية نقدية: ${reason}`,
      userResponsible: userResponsible || 'admin',
      date: todayStr,
      time: timeStr
    });
    
    await db.logAudit(1, userResponsible || 'admin', 'TREASURY_ADJUSTMENT', `Treasury cash adjustment of ${amount} EGP. Reason: ${reason}`);
    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search & Filter Treasury Transactions
app.get('/api/treasury/transactions', async (req, res) => {
  const { startDate, endDate, type, user, search } = req.query;
  try {
    let query = 'SELECT * FROM treasury_transactions WHERE 1=1';
    const params = [];
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (user) {
      query += ' AND user_responsible = ?';
      params.push(user);
    }
    if (search) {
      query += ' AND (description LIKE ? OR related_patient_mobile LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY id DESC';
    const list = await db.queryAll(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get treasury dashboard stats & timeline
app.get('/api/treasury/stats', async (req, res) => {
  try {
    const active = await getActiveTreasurySession();
    
    let liveBalance = 0;
    if (active) {
      const sessionId = active.id;
      const opening = active.opening_balance || 0;
      
      const transactions = await db.queryAll("SELECT type, amount, description FROM treasury_transactions WHERE treasury_session_id = ?", [sessionId]);
      let income = 0;
      let expense = 0;
      let refund = 0;
      let adjustment = 0;
      
      transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') expense += t.amount;
        else if (t.type === 'refund') refund += t.amount;
        else if (t.type === 'adjustment') {
          if (!t.description || !t.description.includes('TREASURY_OPENING_BALANCE')) {
            adjustment += t.amount;
          }
        }
      });
      
      liveBalance = opening + income - expense - refund + adjustment;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTx = await db.queryAll("SELECT type, amount, description FROM treasury_transactions WHERE date = ?", [todayStr]);
    
    let todayIncome = 0;
    let todayExpense = 0;
    let todayRefund = 0;
    let todayAdjustment = 0;
    
    todayTx.forEach(t => {
      if (t.type === 'income') todayIncome += t.amount;
      else if (t.type === 'expense') todayExpense += t.amount;
      else if (t.type === 'refund') todayRefund += t.amount;
      else if (t.type === 'adjustment') {
        if (!t.description || !t.description.includes('TREASURY_OPENING_BALANCE')) {
          todayAdjustment += t.amount;
        }
      }
    });
    
    const todayNet = todayIncome - todayExpense - todayRefund + todayAdjustment;
    
    const currentYearMonth = new Date().toISOString().substring(0, 7);
    const monthTx = await db.queryAll("SELECT type, amount, description FROM treasury_transactions WHERE date LIKE ?", [`${currentYearMonth}%`]);
    
    let monthIncome = 0;
    let monthExpense = 0;
    let monthRefund = 0;
    let monthAdjustment = 0;
    
    monthTx.forEach(t => {
      if (t.type === 'income') monthIncome += t.amount;
      else if (t.type === 'expense') monthExpense += t.amount;
      else if (t.type === 'refund') monthRefund += t.amount;
      else if (t.type === 'adjustment') {
        if (!t.description || !t.description.includes('TREASURY_OPENING_BALANCE')) {
          monthAdjustment += t.amount;
        }
      }
    });
    
    const monthNetProfit = monthIncome - monthExpense - monthRefund + monthAdjustment;
    const totalRevenueSum = monthIncome || 1;
    const profitPercentage = Math.max(0, (monthNetProfit / totalRevenueSum) * 100);
    const lossPercentage = Math.max(0, ((monthExpense + monthRefund) / totalRevenueSum) * 100);
    
    const dailyTimeline = await db.queryAll(`
      SELECT date, 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
        SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as refund,
        SUM(CASE WHEN type = 'adjustment' AND description NOT LIKE '%TREASURY_OPENING_BALANCE%' THEN amount ELSE 0 END) as adjustment
      FROM treasury_transactions 
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 30
    `);
    
    res.json({
      isOpen: !!active,
      activeSession: active,
      liveBalance,
      today: {
        income: todayIncome,
        expense: todayExpense,
        refund: todayRefund,
        adjustment: todayAdjustment,
        net: todayNet
      },
      monthly: {
        income: monthIncome,
        expense: monthExpense,
        refund: monthRefund,
        adjustment: monthAdjustment,
        netProfit: monthNetProfit,
        profitPercentage,
        lossPercentage
      },
      dailyTimeline: dailyTimeline.reverse()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API ROUTES ---

// 1. Settings & Wizard Setup
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, val] of Object.entries(settings)) {
      await db.runCommand(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        [key, String(val), String(val)]
      );
    }
    // Log audit
    await db.logAudit(1, 'system', 'UPDATE_SETTINGS', 'Updated clinic settings');
    res.json({ success: true });
  } catch (err) {
    // If MySQL is used, ON CONFLICT is different: REPLACE INTO or INSERT INTO ... ON DUPLICATE KEY UPDATE
    try {
      const settings = req.body;
      for (const [key, val] of Object.entries(settings)) {
        if (db.getDbType() === 'mysql') {
          await db.runCommand(
            'INSERT INTO settings (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
            [key, String(val), String(val)]
          );
        } else {
          await db.runCommand(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, String(val)]
          );
        }
      }
      res.json({ success: true });
    } catch (innerErr) {
      res.status(500).json({ error: innerErr.message });
    }
  }
});

app.post('/api/setup/wizard', async (req, res) => {
  try {
    const { clinicSettings, adminUser } = req.body;
    
    // Save settings
    for (const [key, val] of Object.entries(clinicSettings)) {
      if (db.getDbType() === 'mysql') {
        await db.runCommand(
          'INSERT INTO settings (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
          [key, String(val), String(val)]
        );
      } else {
        await db.runCommand(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, String(val)]
        );
      }
    }

    // Create Admin User
    const passHash = hashPassword(adminUser.password);
    const existing = await db.queryOne('SELECT * FROM users WHERE username = ?', [adminUser.username]);
    
    if (existing) {
      await db.runCommand(
        'UPDATE users SET password_hash = ?, full_name = ? WHERE username = ?',
        [passHash, adminUser.fullName, adminUser.username]
      );
    } else {
      await db.runCommand(
        'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        [adminUser.username, passHash, 'admin', adminUser.fullName]
      );
    }

    // Also seed some default medical services if empty
    const serviceCheck = await db.queryOne('SELECT COUNT(*) as count FROM medical_services');
    if (serviceCheck.count === 0) {
      const defaultServices = [
        { name: 'كشف جديد / New Consultation', cat: 'كشوفات', desc: 'كشف طبي عام', price: 200 },
        { name: 'استشارة / Follow-Up', cat: 'كشوفات', desc: 'مراجعة مجانية أو مخفضة', price: 0 },
        { name: 'رسم قلب / ECG', cat: 'فحوصات', desc: 'رسم قلب كهربائي', price: 150 },
        { name: 'سونار / Ultrasound', cat: 'فحوصات', desc: 'فحص بالسونار الموجات فوق الصوتية', price: 300 },
        { name: 'غيار جراحي / Dressing', cat: 'خدمات', desc: 'تنظيف وغيار على الجروح', price: 80 },
        { name: 'حقنة / Injection', cat: 'خدمات', desc: 'حقن عضلي أو وريدي', price: 20 }
      ];
      for (const s of defaultServices) {
        await db.runCommand(
          'INSERT INTO medical_services (service_name, category, description, price) VALUES (?, ?, ?, ?)',
          [s.name, s.cat, s.desc, s.price]
        );
      }
    }

    await db.logAudit(1, 'system', 'SYSTEM_WIZARD_SETUP', 'Completed first-time clinic setup wizard');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getBillingUrl() {
  try {
    const configPath = path.join(process.env.USER_DATA_PATH || __dirname, 'clinic_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.billingUrl || 'https://billing.datagris.com';
    }
  } catch (e) {}
  return 'https://billing.datagris.com';
}

// 2. Authentication
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await fetch(`${getBillingUrl()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const errText = await response.text();
      let errObj;
      try { errObj = JSON.parse(errText); } catch(e) {}
      return res.status(response.status).json({ error: errObj?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const data = await response.json(); // { success: true, user: { id, username, role, fullName, clinicId }, jwt }
    
    // Save JWT in global session
    global.userJwt = data.jwt;
    
    // Update local configuration with clinicId
    try {
      const configPath = path.join(process.env.USER_DATA_PATH || __dirname, 'clinic_config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.clinicId = data.user.clinicId;
        config.subscriptionStatus = 'active'; // assume active if login was successful
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Saved clinic ID to local config:', data.user.clinicId);
      }
    } catch (e) {
      console.error('Failed to update clinic ID in configuration file:', e);
    }

    // Cache user credentials locally (SHA-256 hash) for offline fallback authentication
    try {
      const passHash = hashPassword(password);
      const existingUser = await db.queryOne('SELECT * FROM users WHERE id = ?', [data.user.id]);
      if (existingUser) {
        await db.runCommand(
          'UPDATE users SET username = ?, password_hash = ?, role = ?, full_name = ? WHERE id = ?',
          [data.user.username.trim().toLowerCase(), passHash, data.user.role, data.user.fullName, data.user.id]
        );
      } else {
        await db.runCommand(
          'INSERT INTO users (id, username, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
          [data.user.id, data.user.username.trim().toLowerCase(), passHash, data.user.role, data.user.fullName]
        );
      }
    } catch (e) {
      console.error('Failed to cache user profile locally:', e);
    }
    
    // Log audit in Supabase
    await db.logAudit(data.user.id, data.user.username, 'USER_LOGIN', `User logged in as ${data.user.role}`);
    
    res.json({
      success: true,
      user: {
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        fullName: data.user.fullName
      }
    });
  } catch (err) {
    console.error('Online login failed or unreachable. Falling back to local offline login...', err);
    try {
      const user = await db.queryOne('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);
      if (!user) {
        return res.status(401).json({ error: 'اسم المستخدم غير صحيح أو عيادتكم غير متصلة بالإنترنت حالياً' });
      }
      
      const hash = hashPassword(password);
      if (user.password_hash !== hash) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      }
      
      // Log audit locally
      await db.logAudit(user.id, user.username, 'USER_LOGIN_OFFLINE', `User logged in offline as ${user.role}`);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.full_name
        }
      });
    } catch (localErr) {
      console.error('Local offline login error:', localErr);
      res.status(500).json({ error: 'تعذر إتمام عملية تسجيل الدخول محلياً' });
    }
  }
});

// 2b. User Accounts Management (Admin Actions - Integrated with Supabase Auth & Profiles)
app.get('/api/users', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT id, username, role, full_name, created_at FROM profiles ORDER BY id ASC');
    res.json(rows.map(r => ({
      id: r.id,
      username: r.username,
      role: r.role,
      fullName: r.full_name,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error('Failed to get profiles:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, role, fullName } = req.body;
  try {
    // 1. Check if user already exists
    const existing = await db.queryOne('SELECT * FROM profiles WHERE username = ?', [username.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
    }

    // 2. Create in Supabase Auth via Admin SDK
    const supabaseUrl = process.env.SUPABASE_URL || 'https://whfegxabypqkvnmfwfqj.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      return res.status(500).json({ error: 'مفتاح خدمة Supabase (Service Role Key) غير متوفر في الخادم' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Helper to get clinic_id
    const dataDir = process.env.USER_DATA_PATH || __dirname;
    let clinicId = process.env.CLINIC_ID || 'CLN-000001';
    try {
      const configPath = path.join(dataDir, 'clinic_config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        clinicId = config.clinicId || clinicId;
      }
    } catch (e) {}

    const email = `${username.trim().toLowerCase()}@datagris-auth.com`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { clinic_id: clinicId }
    });

    if (authError || !authData.user) {
      console.error('Supabase Auth user creation error:', authError);
      return res.status(400).json({ error: authError?.message || 'فشل إنشاء حساب مستخدم سحابي' });
    }

    const userId = authData.user.id;

    // 3. Create profile in database
    await db.runCommand(
      'INSERT INTO profiles (id, clinic_id, username, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, clinicId, username.trim().toLowerCase(), fullName, role]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to create user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { username, password, role, fullName } = req.body;
  const userId = req.params.id;
  try {
    // 1. Update profile details
    await db.runCommand(
      'UPDATE profiles SET username = ?, role = ?, full_name = ? WHERE id = ?',
      [username.trim().toLowerCase(), role, fullName, userId]
    );

    // 2. If password updated, invoke Supabase Admin SDK
    if (password) {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://whfegxabypqkvnmfwfqj.supabase.co';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseServiceKey) {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
        if (updateError) {
          console.error('Supabase Auth password update error:', updateError);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    // Prevent deletion of main owner/admin
    const profile = await db.queryOne('SELECT role FROM profiles WHERE id = ?', [userId]);
    if (profile && profile.role === 'owner') {
      return res.status(400).json({ error: 'لا يمكن حذف حساب مالك النظام الرئيسي' });
    }

    // 1. Delete profile details
    await db.runCommand('DELETE FROM profiles WHERE id = ?', [userId]);

    // 2. Delete Supabase Auth account
    const supabaseUrl = process.env.SUPABASE_URL || 'https://whfegxabypqkvnmfwfqj.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseServiceKey) {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error('Supabase Auth user delete error:', deleteError);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete user:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Patients Database
app.get('/api/patients', async (req, res) => {
  const { search } = req.query;
  try {
    let query = `
      SELECT p.*,
        (SELECT payment_date FROM visits WHERE patient_mobile = p.mobile_number ORDER BY id DESC LIMIT 1) as last_visit_date,
        (SELECT payment_time FROM visits WHERE patient_mobile = p.mobile_number ORDER BY id DESC LIMIT 1) as last_visit_time
      FROM patients p
    `;
    const params = [];
    if (search) {
      const normalizedSearch = normalizeArabic(search);
      query += ` WHERE p.mobile_number LIKE ? OR p.file_number LIKE ? OR 
        replace(replace(replace(replace(replace(p.name, 'أ', 'ا'), 'إ', 'ا'), 'آ', 'ا'), 'ة', 'ه'), 'ى', 'ي') LIKE ?`;
      params.push(`%${search}%`, `%${search}%`, `%${normalizedSearch}%`);
    }
    query += ' ORDER BY p.created_at DESC';
    const rows = await db.queryAll(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients', async (req, res) => {
  const { mobileNumber, name, gender, age, weight, height, temperature, chiefComplaint, medicalHistory, whatsappEnabled } = req.body;
  try {
    // Check if patient exists
    const existing = await db.queryOne('SELECT * FROM patients WHERE mobile_number = ?', [mobileNumber]);
    const wsEnabled = whatsappEnabled !== undefined ? (whatsappEnabled ? 1 : 0) : 1;

    let fileNumber = '';
    if (existing) {
      fileNumber = existing.file_number;
      // Update info
      await db.runCommand(
        `UPDATE patients SET name = ?, gender = ?, age = ?, weight = ?, height = ?, temperature = ?, chief_complaint = ?, medical_history_json = ?, whatsapp_enabled = ? 
         WHERE mobile_number = ?`,
        [name, gender, age, weight, height, temperature, chiefComplaint, JSON.stringify(medicalHistory || {}), wsEnabled, mobileNumber]
      );
    } else {
      // Generate unique file number PAT-XXXXXX
      const maxRow = await db.queryOne("SELECT file_number FROM patients WHERE file_number LIKE 'PAT-%' ORDER BY file_number DESC LIMIT 1");
      let nextIdx = 1;
      if (maxRow && maxRow.file_number) {
        const match = maxRow.file_number.match(/PAT-(\d+)/);
        if (match) {
          nextIdx = parseInt(match[1]) + 1;
        }
      }
      fileNumber = 'PAT-' + String(nextIdx).padStart(6, '0');
      
      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0];

      // Create new
      await db.runCommand(
        `INSERT INTO patients (mobile_number, name, gender, age, weight, height, temperature, chief_complaint, medical_history_json, file_number, registration_date, registration_time, whatsapp_enabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mobileNumber, name, gender, age, weight, height, temperature, chiefComplaint, 
          JSON.stringify(medicalHistory || {}), fileNumber, todayStr, timeStr, wsEnabled
        ]
      );
    }
    res.json({ success: true, mobileNumber, fileNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:mobile', async (req, res) => {
  try {
    const patient = await db.queryOne('SELECT * FROM patients WHERE mobile_number = ?', [req.params.mobile]);
    if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });
    
    // Load companions
    const companions = await db.queryAll('SELECT * FROM companions WHERE patient_mobile = ?', [req.params.mobile]);
    // Load visit history
    const visits = await db.queryAll('SELECT * FROM visits WHERE patient_mobile = ? ORDER BY created_at DESC', [req.params.mobile]);
    
    res.json({
      ...patient,
      medical_history_json: JSON.parse(patient.medical_history_json || '{}'),
      companions,
      visits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Companion
app.post('/api/patients/:mobile/companions', async (req, res) => {
  const { companionName, age, chiefComplaint } = req.body;
  const parentMobile = req.params.mobile;
  try {
    const parentPatient = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [parentMobile]);
    const parentName = parentPatient ? parentPatient.name : '';
    const compMobile = parentName 
      ? `${parentMobile}_C_${parentName}_C_${companionName}` 
      : `${parentMobile}_C_${companionName}`;

    await db.runCommand(
      'INSERT INTO companions (patient_mobile, companion_name, age, chief_complaint) VALUES (?, ?, ?, ?)',
      [parentMobile, companionName, age ? parseInt(age) : null, chiefComplaint || null]
    );

    if (db.getDbType() === 'mysql') {
      await db.runCommand(
        `INSERT INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), age = VALUES(age), chief_complaint = VALUES(chief_complaint)`,
        [compMobile, companionName, age ? parseInt(age) : null, chiefComplaint || null, parentMobile]
      );
    } else {
      await db.runCommand(
        `INSERT OR REPLACE INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
         VALUES (?, ?, ?, ?, ?, 1)`,
        [compMobile, companionName, age ? parseInt(age) : null, chiefComplaint || null, parentMobile]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Companion
app.delete('/api/companions/:id', async (req, res) => {
  try {
    await db.runCommand('DELETE FROM companions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Visits & Queue Engine
app.get('/api/visits/queue', async (req, res) => {
  try {
    // Fetch visits where status is not 'closed' (i.e. active queue)
    const visits = await db.queryAll(`
      SELECT v.*, p.name as patient_name, p.gender as patient_gender, p.age as patient_age, p.parent_mobile, p.is_companion, parent.name as parent_name
      FROM visits v
      JOIN patients p ON v.patient_mobile = p.mobile_number
      LEFT JOIN patients parent ON p.parent_mobile = parent.mobile_number
      WHERE v.status != 'closed'
      ORDER BY v.id ASC
    `);

    const avgDurationRow = await db.queryOne(`
      SELECT AVG(consultation_duration_seconds) as avg 
      FROM visits 
      WHERE status='closed' AND consultation_duration_seconds IS NOT NULL AND consultation_duration_seconds > 0
    `);
    const avgDuration = avgDurationRow && avgDurationRow.avg ? Math.round(avgDurationRow.avg) : 900; // default to 15 minutes

    // Attach services to each visit
    for (const visit of visits) {
      visit.services = await db.queryAll('SELECT * FROM visit_services WHERE visit_id = ?', [visit.id]);
      visit.prescription_json = JSON.parse(visit.prescription_json || '[]');
      visit.referral_json = JSON.parse(visit.referral_json || '{}');
      visit.avg_consultation_duration = avgDuration;
    }

    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/visits', async (req, res) => {
  const { 
    patientMobile, visitType, services, weight, height, temperature, 
    chiefComplaint, paidAmount, paymentStatus, isException,
    changeAmount, remainingAmount, paymentUser 
  } = req.body;
  
  try {
    const activeSession = await getActiveTreasurySession();
    if (!activeSession) {
      return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لتسجيل الزيارات والمدفوعات.' });
    }
    // 1. Fetch fees from settings
    const consultationFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'consultationFee'");
    const followupFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'followupFee'");
    const consultationFee = consultationFeeRow ? parseFloat(consultationFeeRow.value || 0) : 200;
    const followupFee = followupFeeRow ? parseFloat(followupFeeRow.value || 0) : 100;
    
    const baseFee = visitType === 'consultation' ? consultationFee : followupFee;
    
    // Companion configuration details
    const companionAgeThresholdRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionAgeThreshold'");
    const companionConsultationFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionConsultationFee'");
    const companionFollowupFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionFollowupFee'");
    
    const companionAgeThreshold = companionAgeThresholdRow ? parseInt(companionAgeThresholdRow.value || 12) : 12;
    const companionConsultationFee = companionConsultationFeeRow ? parseFloat(companionConsultationFeeRow.value || 100) : 100;
    const companionFollowupFee = companionFollowupFeeRow ? parseFloat(companionFollowupFeeRow.value || 50) : 50;
    
    // Load patient companions to bill them correctly
    const companions = await db.queryAll('SELECT * FROM companions WHERE patient_mobile = ?', [patientMobile]);
    let companionsTotal = 0;
    const customCompanionFee = visitType === 'consultation' ? companionConsultationFee : companionFollowupFee;
    
    const companionsWithFees = companions.map(comp => {
      const ageVal = comp.age;
      const compFee = (ageVal !== null && ageVal !== undefined && ageVal <= companionAgeThreshold) ? customCompanionFee : baseFee;
      companionsTotal += compFee;
      return { ...comp, fee: compFee };
    });
    
    // Total services cost
    let servicesTotal = 0;
    for (const service of services || []) {
      servicesTotal += service.price || 0;
    }
    const grandTotal = baseFee + servicesTotal + companionsTotal;
    
    // Cashier Math
    const actualPaid = paidAmount !== undefined ? parseFloat(paidAmount) : grandTotal;
    const actualChange = changeAmount !== undefined ? parseFloat(changeAmount) : Math.max(0, actualPaid - grandTotal);
    const actualRemaining = remainingAmount !== undefined ? parseFloat(remainingAmount) : Math.max(0, grandTotal - actualPaid);
    
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];

    // If follow-up, check validation rules
    if (visitType === 'followup' && !isException) {
      // Find last completed consultation visit
      const lastVisit = await db.queryOne(
        `SELECT * FROM visits WHERE patient_mobile = ? AND visit_type = 'consultation' AND status = 'closed'
         ORDER BY id DESC LIMIT 1`,
        [patientMobile]
      );
      if (lastVisit && lastVisit.follow_up_expiry_date) {
        const expiry = new Date(lastVisit.follow_up_expiry_date);
        const today = new Date();
        if (today > expiry) {
          return res.status(400).json({ error: 'صلاحية الاستشارة انتهت. يجب حجز كشف جديد.' });
        }
      }
    }

    const parentPaid = Math.max(0, actualPaid - companionsTotal);

    // Create visit with cashier fields
    const status = 'waiting'; // initial status
    const result = await db.runCommand(
      `INSERT INTO visits (
        patient_mobile, visit_type, status, weight, height, temperature, chief_complaint, 
        paid_amount, payment_status, is_exception_followup, change_amount, remaining_amount, 
        payment_date, payment_time, payment_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientMobile, visitType, status, 
        weight || null, height || null, temperature || null, chiefComplaint || null,
        parentPaid, paymentStatus, isException ? 1 : 0, 
        actualChange, actualRemaining, todayStr, timeStr, paymentUser || 'receptionist'
      ]
    );
    const visitId = result.insertId;

    // Add selected services
    for (const service of services || []) {
      await db.runCommand(
        'INSERT INTO visit_services (visit_id, service_id, service_name, price) VALUES (?, ?, ?, ?)',
        [visitId, service.id, service.service_name, service.price]
      );
    }

    // Log the visit payment to the treasury
    const patientRow = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [patientMobile]);
    const patientName = patientRow ? patientRow.name : 'مريض';
    const visitDesc = `دفعة زيارة كشف / استشارة (${visitType === 'consultation' ? 'كشف جديد' : 'مراجعة'}) للمريض: ${patientName} (رقم الفاتورة: ${visitId})`;
    
    await addTreasuryTransaction({
      type: 'income',
      amount: parseFloat(parentPaid),
      description: visitDesc,
      relatedPatientMobile: patientMobile,
      relatedVisitId: visitId,
      userResponsible: paymentUser || 'receptionist',
      date: todayStr,
      time: timeStr
    });

    // Update patient totals and history
    await db.runCommand('UPDATE patients SET visit_count = visit_count + 1 WHERE mobile_number = ?', [patientMobile]);
    if (visitType === 'followup') {
      await db.runCommand('UPDATE patients SET follow_up_count = follow_up_count + 1 WHERE mobile_number = ?', [patientMobile]);
    }

    // Create separate patient records and visits for companions
    const parentPatient = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [patientMobile]);
    const parentName = parentPatient ? parentPatient.name : '';

    for (const comp of companionsWithFees) {
      const compMobile = parentName 
        ? `${patientMobile}_C_${parentName}_C_${comp.companion_name}` 
        : `${patientMobile}_C_${comp.companion_name}`;

      if (db.getDbType() === 'mysql') {
        await db.runCommand(
          `INSERT INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
           VALUES (?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE name = VALUES(name), age = VALUES(age), chief_complaint = VALUES(chief_complaint)`,
          [compMobile, comp.companion_name, comp.age, comp.chief_complaint, patientMobile]
        );
      } else {
        await db.runCommand(
          `INSERT OR REPLACE INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [compMobile, comp.companion_name, comp.age, comp.chief_complaint, patientMobile]
        );
      }

      const compVisitResult = await db.runCommand(
        `INSERT INTO visits (
          patient_mobile, visit_type, status, chief_complaint, paid_amount, payment_status,
          payment_date, payment_time, payment_user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          compMobile, visitType, status, comp.chief_complaint,
          comp.fee, paymentStatus, todayStr, timeStr, paymentUser || 'receptionist'
        ]
      );
      
      const compVisitId = compVisitResult.insertId;
      
      // Log companion visit payment to the treasury
      await addTreasuryTransaction({
        type: 'income',
        amount: parseFloat(comp.fee),
        description: `دفعة كشف مرافق للمريض: ${comp.companion_name} (مرافق للمريض الرئيسي: ${patientName}) (رقم الفاتورة: ${compVisitId})`,
        relatedPatientMobile: compMobile,
        relatedVisitId: compVisitId,
        userResponsible: paymentUser || 'receptionist',
        date: todayStr,
        time: timeStr
      });

      await db.runCommand('UPDATE patients SET visit_count = visit_count + 1 WHERE mobile_number = ?', [compMobile]);
      if (visitType === 'followup') {
        await db.runCommand('UPDATE patients SET follow_up_count = follow_up_count + 1 WHERE mobile_number = ?', [compMobile]);
      }
    }

    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true, visitId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single visit by ID
app.get('/api/visits/:id', async (req, res) => {
  try {
    const visitId = req.params.id;
    const visit = await db.queryOne(`
      SELECT v.*, p.name as patient_name, p.file_number, p.whatsapp_enabled 
      FROM visits v 
      JOIN patients p ON v.patient_mobile = p.mobile_number 
      WHERE v.id = ?
    `, [visitId]);
    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Visit Status
app.put('/api/visits/:id/status', async (req, res) => {
  const { status, satisfactionStatus, serviceId, serviceName, servicePrice } = req.body;
  try {
    const visitId = req.params.id;
    const visit = await db.queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });

    if (status === 'entered') {
      const parentMobile = visit.patient_mobile;
      const companionVisits = await db.queryAll(
        `SELECT id FROM visits WHERE status = 'waiting' AND patient_mobile LIKE ?`,
        [`${parentMobile}_C_%`]
      );
      for (const compV of companionVisits) {
        await db.runCommand(
          `UPDATE visits SET status = 'entered' WHERE id = ?`,
          [compV.id]
        );
      }
    }

    let updateQuery = 'UPDATE visits SET status = ?';
    const params = [status];

    // Status timing and analytics hooks
    if (status === 'in_consultation') {
      const nowStr = new Date().toISOString();
      const regTime = parseDbDate(visit.created_at);
      const waitingSecs = Math.max(0, Math.round((Date.now() - regTime.getTime()) / 1000));
      
      await db.runCommand(
        'UPDATE visits SET status = ?, consultation_start_time = ?, waiting_time_seconds = ? WHERE id = ?',
        [status, nowStr, waitingSecs, visitId]
      );
      
      broadcast({ event: 'QUEUE_UPDATE' });
      return res.json({ success: true });
    }

    if (status === 'completed') {
      const nowStr = new Date().toISOString();
      const startStr = visit.consultation_start_time || visit.created_at;
      const durationSecs = Math.max(0, Math.round((Date.now() - parseDbDate(startStr).getTime()) / 1000));
      
      await db.runCommand(
        'UPDATE visits SET status = ?, consultation_end_time = ?, consultation_duration_seconds = ? WHERE id = ?',
        [status, nowStr, durationSecs, visitId]
      );

      // Automatic Stock Deduction
      if (visit.inventory_deducted !== 1) {
        try {
          const usedItems = await db.queryAll('SELECT * FROM visit_inventory_items WHERE visit_id = ?', [visitId]);
          const patientRow = await db.queryOne('SELECT name, mobile_number FROM patients WHERE mobile_number = ?', [visit.patient_mobile]);
          const patientName = patientRow ? patientRow.name : 'مريض';
          const patientMobile = patientRow ? patientRow.mobile_number : visit.patient_mobile;

          for (const item of usedItems) {
            const invItem = await db.queryOne('SELECT * FROM inventory_items WHERE id = ?', [item.item_id]);
            if (invItem) {
              const qty = item.quantity || 0;
              
              if (invItem.item_type === 'quantity' || invItem.item_type === 'manual') {
                const newQty = Math.max(0, (invItem.quantity || 0) - qty);
                await db.runCommand(
                  'UPDATE inventory_items SET quantity = ? WHERE id = ?',
                  [newQty, invItem.id]
                );
              } else if (invItem.item_type === 'usage') {
                await db.runCommand(
                  'UPDATE inventory_items SET usage_count = usage_count + ? WHERE id = ?',
                  [qty, invItem.id]
                );
              }

              // Log Transaction
              await db.runCommand(
                `INSERT INTO inventory_transactions (transaction_date, patient_name, patient_mobile, visit_id, item_name, quantity_used, user_responsible, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  new Date().toISOString().split('T')[0],
                  patientName,
                  patientMobile,
                  visitId,
                  invItem.name,
                  qty,
                  req.body.userResponsible || 'Doctor',
                  `استهلاك تلقائي أثناء الكشف الطبي للزيارة رقم ${visitId}`
                ]
              );
            }
          }
          await db.runCommand('UPDATE visits SET inventory_deducted = 1 WHERE id = ?', [visitId]);
        } catch (e) {
          console.error('Error during auto inventory stock deduction:', e);
        }
      }

      // Auto-complete companion visits if parent visit is completed
      if (!visit.patient_mobile.includes('_C_')) {
        const parentMobile = visit.patient_mobile;
        const companionVisits = await db.queryAll(
          `SELECT id, consultation_start_time, created_at FROM visits 
           WHERE status IN ('entered', 'in_consultation') AND patient_mobile LIKE ?`,
          [`${parentMobile}_C_%`]
        );
        for (const compV of companionVisits) {
          const compStart = compV.consultation_start_time || nowStr;
          const compDurationSecs = Math.max(0, Math.round((Date.now() - parseDbDate(compStart).getTime()) / 1000));
          await db.runCommand(
            `UPDATE visits SET status = 'completed', consultation_end_time = ?, consultation_duration_seconds = ? WHERE id = ?`,
            [nowStr, compDurationSecs, compV.id]
          );

          // Deduct companions stock if any
          const compVisit = await db.queryOne('SELECT * FROM visits WHERE id = ?', [compV.id]);
          if (compVisit && compVisit.inventory_deducted !== 1) {
            const compUsedItems = await db.queryAll('SELECT * FROM visit_inventory_items WHERE visit_id = ?', [compV.id]);
            for (const item of compUsedItems) {
              const invItem = await db.queryOne('SELECT * FROM inventory_items WHERE id = ?', [item.item_id]);
              if (invItem) {
                const qty = item.quantity || 0;
                if (invItem.item_type === 'quantity' || invItem.item_type === 'manual') {
                  const newQty = Math.max(0, (invItem.quantity || 0) - qty);
                  await db.runCommand('UPDATE inventory_items SET quantity = ? WHERE id = ?', [newQty, invItem.id]);
                } else if (invItem.item_type === 'usage') {
                  await db.runCommand('UPDATE inventory_items SET usage_count = usage_count + ? WHERE id = ?', [qty, invItem.id]);
                }
                await db.runCommand(
                  `INSERT INTO inventory_transactions (transaction_date, patient_name, patient_mobile, visit_id, item_name, quantity_used, user_responsible, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    new Date().toISOString().split('T')[0],
                    compVisit.patient_name || 'مرافق',
                    compVisit.patient_mobile,
                    compV.id,
                    invItem.name,
                    qty,
                    req.body.userResponsible || 'Doctor',
                    `استهلاك تلقائي أثناء كشف مرافق للزيارة رقم ${compV.id}`
                  ]
                );
              }
            }
            await db.runCommand('UPDATE visits SET inventory_deducted = 1 WHERE id = ?', [compV.id]);
          }
        }
      }
      
      broadcast({ event: 'QUEUE_UPDATE' });
      return res.json({ success: true });
    }

    if (status === 'closed') {
      const satisfaction = satisfactionStatus || 'satisfied';
      
      await db.runCommand(
        `UPDATE visits SET status = ?, closed_at = CURRENT_TIMESTAMP, satisfaction_status = ? WHERE id = ?`,
        [status, satisfaction, visitId]
      );
      
      // Record payment into patient history total_paid
      await db.runCommand(
        'UPDATE patients SET total_paid = total_paid + ? WHERE mobile_number = ?',
        [visit.paid_amount, visit.patient_mobile]
      );
      
      if (visit.chief_complaint) {
        await db.runCommand('UPDATE patients SET chief_complaint = ? WHERE mobile_number = ?', [visit.chief_complaint, visit.patient_mobile]);
      }

      // Calculate the patient's average waiting time across all their closed visits and update patients table
      const avgWaitRow = await db.queryOne(
        `SELECT AVG(waiting_time_seconds) as avg_wait FROM visits 
         WHERE patient_mobile = ? AND status = 'closed' AND waiting_time_seconds IS NOT NULL AND waiting_time_seconds > 0`,
        [visit.patient_mobile]
      );
      const patientAvgWait = avgWaitRow && avgWaitRow.avg_wait ? Math.round(avgWaitRow.avg_wait) : 0;
      await db.runCommand(
        'UPDATE patients SET average_waiting_time_seconds = ? WHERE mobile_number = ?',
        [patientAvgWait, visit.patient_mobile]
      );
      
      broadcast({ event: 'QUEUE_UPDATE' });
      return res.json({ success: true });
    }

    if (status === 'pending_service') {
      const activeSession = await getActiveTreasurySession();
      if (!activeSession) {
        return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لتسجيل الخدمات الإضافية وسداد رسومها.' });
      }
      // Add pending service to visit
      if (serviceId) {
        // Insert into visit_services
        await db.runCommand(
          'INSERT OR IGNORE INTO visit_services (visit_id, service_id, service_name, price) VALUES (?, ?, ?, ?)',
          [visitId, serviceId, serviceName, servicePrice]
        );
        // Add service price to visit paid_amount and grand total
        const newTotal = visit.paid_amount + servicePrice;
        await db.runCommand(
          'UPDATE visits SET status = ?, paid_amount = ?, remaining_amount = remaining_amount + ? WHERE id = ?',
          [status, newTotal, servicePrice, visitId]
        );
        
        // Log service payment to the treasury
        const patientRow = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [visit.patient_mobile]);
        const patientName = patientRow ? patientRow.name : 'مريض';
        await addTreasuryTransaction({
          type: 'income',
          amount: parseFloat(servicePrice),
          description: `سداد قيمة خدمة إضافية (${serviceName}) للمريض: ${patientName} (رقم الزيارة: ${visitId})`,
          relatedPatientMobile: visit.patient_mobile,
          relatedVisitId: visitId,
          userResponsible: req.body.userResponsible || 'receptionist'
        });
      } else {
        await db.runCommand('UPDATE visits SET status = ? WHERE id = ?', [status, visitId]);
      }
      
      // Get patient name for real-time notification
      const patientRow = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [visit.patient_mobile]);
      const patientName = patientRow ? patientRow.name : 'مريض';
      broadcast({ 
        event: 'PATIENT_TRANSFERRED', 
        message: `تم تحويل المريض ${patientName} لخدمة إضافية وسداد الرسوم`,
        patientName 
      });

      broadcast({ event: 'QUEUE_UPDATE' });
      return res.json({ success: true });
    }

    if (status === 'awaiting_final_consultation') {
      const activeSession = await getActiveTreasurySession();
      if (!activeSession) {
        return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لتسوية المبالغ المتبقية.' });
      }
      
      const remaining = visit.remaining_amount || 0;
      if (remaining > 0) {
        const patientRow = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [visit.patient_mobile]);
        const patientName = patientRow ? patientRow.name : 'مريض';
        await addTreasuryTransaction({
          type: 'income',
          amount: parseFloat(remaining),
          description: `سداد المتبقي (الآجل) للزيارة رقم ${visitId} للمريض: ${patientName}`,
          relatedPatientMobile: visit.patient_mobile,
          relatedVisitId: visitId,
          userResponsible: req.body.userResponsible || 'receptionist'
        });
        
        const updatedPaid = visit.paid_amount + remaining;
        await db.runCommand(
          'UPDATE visits SET status = ?, paid_amount = ?, remaining_amount = 0, payment_status = ?, is_resumed = 1 WHERE id = ?',
          [status, updatedPaid, 'paid', visitId]
        );
      } else {
        await db.runCommand(
          'UPDATE visits SET status = ?, remaining_amount = 0, payment_status = ?, is_resumed = 1 WHERE id = ?',
          [status, 'paid', visitId]
        );
      }
      broadcast({ event: 'QUEUE_UPDATE' });
      return res.json({ success: true });
    }

    // Default status change
    updateQuery += ' WHERE id = ?';
    params.push(visitId);
    await db.runCommand(updateQuery, params);

    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Visit Registration Data (Receptionist Action)
app.put('/api/visits/:id', async (req, res) => {
  const visitId = req.params.id;
  const { 
    patientMobile, patientName, patientGender, patientAge,
    visitType, services, weight, height, temperature, 
    chiefComplaint, paidAmount, paymentStatus, 
    changeAmount, remainingAmount, paymentUser
  } = req.body;

  try {
    const activeSession = await getActiveTreasurySession();
    if (!activeSession) {
      return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لتعديل الزيارات والمدفوعات.' });
    }
    const visit = await db.queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
    if (!visit) return res.status(404).json({ error: 'الزيارة غير موجودة' });

    const oldPatientMobile = visit.patient_mobile;

    // Sync patient data first
    if (patientMobile && patientName) {
      if (patientMobile !== oldPatientMobile) {
        // If phone number changed, check if new number exists
        const existingPatient = await db.queryOne('SELECT * FROM patients WHERE mobile_number = ?', [patientMobile]);
        if (existingPatient) {
          // Point visit to existing patient profile and update details
          await db.runCommand('UPDATE visits SET patient_mobile = ? WHERE id = ?', [patientMobile, visitId]);
          await db.runCommand(
            'UPDATE patients SET name = ?, gender = ?, age = ? WHERE mobile_number = ?',
            [patientName, patientGender, patientAge, patientMobile]
          );
        } else {
          // Update all references to avoid foreign key conflicts
          await db.runCommand('UPDATE visits SET patient_mobile = ? WHERE patient_mobile = ?', [patientMobile, oldPatientMobile]);
          await db.runCommand('UPDATE companions SET patient_mobile = ? WHERE patient_mobile = ?', [patientMobile, oldPatientMobile]);
          await db.runCommand(
            'UPDATE patients SET mobile_number = ?, name = ?, gender = ?, age = ? WHERE mobile_number = ?',
            [patientMobile, patientName, patientGender, patientAge, oldPatientMobile]
          );
        }
      } else {
        // Just update patient details
        await db.runCommand(
          'UPDATE patients SET name = ?, gender = ?, age = ? WHERE mobile_number = ?',
          [patientName, patientGender, patientAge, oldPatientMobile]
        );
      }
    }

    // Load active mobile number for this visit to handle companion updates correctly
    const activePatientMobile = patientMobile || oldPatientMobile;

    const oldPaid = visit ? (visit.paid_amount || 0) : 0;

    // 1. Update the parent visit
    await db.runCommand(
      `UPDATE visits SET 
        visit_type = ?, weight = ?, height = ?, temperature = ?, chief_complaint = ?,
        paid_amount = ?, payment_status = ?, change_amount = ?, remaining_amount = ?,
        payment_user = ?
       WHERE id = ?`,
      [
        visitType, weight || null, height || null, temperature || null, chiefComplaint || null,
        paidAmount, paymentStatus, changeAmount, remainingAmount, paymentUser || 'receptionist',
        visitId
      ]
    );

    // Log the difference in paid_amount in the treasury
    const payDiff = parseFloat(paidAmount || 0) - oldPaid;
    if (payDiff !== 0) {
      const patientRow = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [activePatientMobile]);
      const patientName = patientRow ? patientRow.name : 'مريض';
      await addTreasuryTransaction({
        type: payDiff > 0 ? 'income' : 'refund',
        amount: Math.abs(payDiff),
        description: `تعديل قيمة مدفوعات الزيارة رقم ${visitId} للمريض: ${patientName} (القيمة السابقة: ${oldPaid}، القيمة الجديدة: ${paidAmount})`,
        relatedPatientMobile: activePatientMobile,
        relatedVisitId: visitId,
        userResponsible: paymentUser || 'receptionist'
      });
    }

    // 2. Update services
    await db.runCommand('DELETE FROM visit_services WHERE visit_id = ?', [visitId]);
    for (const service of services || []) {
      await db.runCommand(
        'INSERT INTO visit_services (visit_id, service_id, service_name, price) VALUES (?, ?, ?, ?)',
        [visitId, service.id, service.service_name, service.price]
      );
    }

    // 3. Sync companion visits in the queue
    const existingCompVisits = await db.queryAll(
      `SELECT * FROM visits WHERE patient_mobile LIKE ? AND status != 'closed'`,
      [`${activePatientMobile}_C_%`]
    );

    const dbCompanions = await db.queryAll('SELECT * FROM companions WHERE patient_mobile = ?', [activePatientMobile]);

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];

    const parentPatient = await db.queryOne('SELECT name FROM patients WHERE mobile_number = ?', [activePatientMobile]);
    const parentName = parentPatient ? parentPatient.name : '';

    const targetCompMobiles = dbCompanions.map(comp => {
      return parentName 
        ? `${activePatientMobile}_C_${parentName}_C_${comp.companion_name}` 
        : `${activePatientMobile}_C_${comp.companion_name}`;
    });

    // Remove companion visits that are no longer in the companions list
    for (const compV of existingCompVisits) {
      if (!targetCompMobiles.includes(compV.patient_mobile)) {
        await db.runCommand('DELETE FROM visits WHERE id = ?', [compV.id]);
      }
    }

    // Add companion visits that are in companions list but don't have a visit in queue
    for (let i = 0; i < dbCompanions.length; i++) {
      const comp = dbCompanions[i];
      const compMobile = targetCompMobiles[i];
      const hasVisit = existingCompVisits.some(v => v.patient_mobile === compMobile);
      if (!hasVisit) {
        // Fetch fee settings to bill them correctly
        const consultationFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'consultationFee'");
        const followupFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'followupFee'");
        const consultationFee = consultationFeeRow ? parseFloat(consultationFeeRow.value || 0) : 200;
        const followupFee = followupFeeRow ? parseFloat(followupFeeRow.value || 0) : 100;
        const baseFee = visitType === 'consultation' ? consultationFee : followupFee;

        const companionAgeThresholdRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionAgeThreshold'");
        const companionConsultationFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionConsultationFee'");
        const companionFollowupFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'companionFollowupFee'");
        
        const companionAgeThreshold = companionAgeThresholdRow ? parseInt(companionAgeThresholdRow.value || 12) : 12;
        const companionConsultationFee = companionConsultationFeeRow ? parseFloat(companionConsultationFeeRow.value || 100) : 100;
        const companionFollowupFee = companionFollowupFeeRow ? parseFloat(companionFollowupFeeRow.value || 50) : 50;

        const customCompanionFee = visitType === 'consultation' ? companionConsultationFee : companionFollowupFee;
        const compFee = (comp.age !== null && comp.age !== undefined && comp.age <= companionAgeThreshold) ? customCompanionFee : baseFee;

        // Insert patient record for companion if not exists
        if (db.getDbType() === 'mysql') {
          await db.runCommand(
            `INSERT INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
             VALUES (?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE name = VALUES(name), age = VALUES(age), chief_complaint = VALUES(chief_complaint)`,
            [compMobile, comp.companion_name, comp.age, comp.chief_complaint, activePatientMobile]
          );
        } else {
          await db.runCommand(
            `INSERT OR REPLACE INTO patients (mobile_number, name, age, chief_complaint, parent_mobile, is_companion) 
             VALUES (?, ?, ?, ?, ?, 1)`,
            [compMobile, comp.companion_name, comp.age, comp.chief_complaint, activePatientMobile]
          );
        }

        // Insert companion visit
        await db.runCommand(
          `INSERT INTO visits (patient_mobile, visit_type, status, paid_amount, payment_status, payment_date, payment_time, payment_user) 
           VALUES (?, ?, 'waiting', ?, 'paid', ?, ?, ?)`,
          [compMobile, visitType, compFee, todayStr, timeStr, paymentUser || 'receptionist']
        );
      }
    }

    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Consultation Data (Doctor Action)
app.put('/api/visits/:id/medical', async (req, res) => {
  const { examinationNotes, diagnosis, prescription, referral, followUpDays, services, diagnosisAfter, inventoryItems } = req.body;
  try {
    const visitId = req.params.id;
    
    // Calculate follow up dates if doctor scheduled one
    let followUpDate = null;
    let followUpExpiryDate = null;
    if (followUpDays) {
      const fd = new Date();
      fd.setDate(fd.getDate() + parseInt(followUpDays));
      followUpDate = fd.toISOString().split('T')[0];

      // Expiration date is 7 days after scheduled follow-up
      const fe = new Date(fd);
      fe.setDate(fe.getDate() + 7);
      followUpExpiryDate = fe.toISOString().split('T')[0];
    }

    // Save medical logs
    await db.runCommand(
      `UPDATE visits SET examination_notes = ?, diagnosis = ?, prescription_json = ?, referral_json = ?, 
       follow_up_days = ?, follow_up_date = ?, follow_up_expiry_date = ?, diagnosis_after = ? 
       WHERE id = ?`,
      [
        examinationNotes, 
        diagnosis, 
        JSON.stringify(prescription || []), 
        JSON.stringify(referral || {}), 
        followUpDays || null, 
        followUpDate, 
        followUpExpiryDate, 
        diagnosisAfter || null,
        visitId
      ]
    );

    // Doctor can add extra services during consultation. Sync service list.
    if (services) {
      // Clear old services first
      await db.runCommand('DELETE FROM visit_services WHERE visit_id = ?', [visitId]);
      
      for (const service of services) {
        await db.runCommand(
          'INSERT OR IGNORE INTO visit_services (visit_id, service_id, service_name, price) VALUES (?, ?, ?, ?)',
          [visitId, service.id, service.service_name, service.price]
        );
      }
    }

    // Doctor can add used inventory items during consultation. Sync items used list.
    if (inventoryItems) {
      // Clear old items first
      await db.runCommand('DELETE FROM visit_inventory_items WHERE visit_id = ?', [visitId]);

      for (const item of inventoryItems) {
        // item = { id, name, quantity, price, billable }
        const isBill = item.billable === 1 || item.billable === true ? 1 : 0;
        await db.runCommand(
          'INSERT INTO visit_inventory_items (visit_id, item_id, item_name, quantity, price, billable) VALUES (?, ?, ?, ?, ?, ?)',
          [visitId, item.id, item.name, item.quantity, parseFloat(item.price || 0), isBill]
        );
      }
    }

    // Fetch visit and recalculate totals
    const visit = await db.queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
    if (visit) {
      const consultationFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'consultationFee'");
      const followupFeeRow = await db.queryOne("SELECT value FROM settings WHERE key = 'followupFee'");
      const consultationFee = consultationFeeRow ? parseFloat(consultationFeeRow.value || 0) : 200;
      const followupFee = followupFeeRow ? parseFloat(followupFeeRow.value || 0) : 100;
      const baseFee = visit.visit_type === 'consultation' ? consultationFee : followupFee;
      
      // 1. Get services total
      const currentServices = await db.queryAll('SELECT price FROM visit_services WHERE visit_id = ?', [visitId]);
      const servicesTotal = currentServices.reduce((sum, s) => sum + (s.price || 0), 0);

      // 2. Get used billable items total
      const currentBillableItems = await db.queryAll('SELECT price, quantity FROM visit_inventory_items WHERE visit_id = ? AND billable = 1', [visitId]);
      const billableItemsTotal = currentBillableItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

      const grandTotal = baseFee + servicesTotal + billableItemsTotal;
      const newRemaining = Math.max(0, grandTotal - visit.paid_amount);
      
      await db.runCommand(
        'UPDATE visits SET remaining_amount = ? WHERE id = ?',
        [newRemaining, visitId]
      );
    }

    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Medical Services Panel
app.get('/api/services', async (req, res) => {
  try {
    const services = await db.queryAll('SELECT * FROM medical_services ORDER BY category ASC, service_name ASC');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', async (req, res) => {
  const { serviceName, category, description, price } = req.body;
  try {
    await db.runCommand(
      'INSERT INTO medical_services (service_name, category, description, price) VALUES (?, ?, ?, ?)',
      [serviceName, category, description, price]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/services/:id', async (req, res) => {
  const { serviceName, category, description, price, isDisabled } = req.body;
  try {
    await db.runCommand(
      'UPDATE medical_services SET service_name = ?, category = ?, description = ?, price = ?, is_disabled = ? WHERE id = ?',
      [serviceName, category, description, price, isDisabled ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    await db.runCommand('DELETE FROM medical_services WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function syncReceptionistsAndProcessPayroll() {
  try {
    // 1. Sync users with role 'receptionist' to employees table
    const users = await db.queryAll("SELECT username, full_name FROM users WHERE role = 'receptionist'");
    for (const user of users) {
      const existing = await db.queryOne("SELECT * FROM employees WHERE username = ?", [user.username]);
      if (!existing) {
        await db.runCommand(
          "INSERT INTO employees (name, role, username, base_salary, salary_day, last_paid_month) VALUES (?, 'receptionist', ?, 0, 30, NULL)",
          [user.full_name, user.username]
        );
      } else {
        if (existing.name !== user.full_name) {
          await db.runCommand("UPDATE employees SET name = ? WHERE id = ?", [user.full_name, existing.id]);
        }
      }
    }

    // 2. Process payroll payments automatically on their due days
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentMonthStr = `${currentYear}-${currentMonth}`; // e.g. '2026-06'
    const currentDay = today.getDate();
    const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();

    // Find all employees with a base salary and set salary day
    const employeesList = await db.queryAll("SELECT * FROM employees WHERE base_salary > 0 AND salary_day IS NOT NULL");
    for (const emp of employeesList) {
      const isDue = currentDay >= Math.min(emp.salary_day, daysInMonth);
      const isPaidThisMonth = emp.last_paid_month === currentMonthStr;
      
      if (isDue && !isPaidThisMonth) {
        // Calculate current month's commission if any
        let commissionEarned = 0;
        if (emp.commission_percentage > 0) {
          const startOfMonth = `${currentYear}-${currentMonth}-01 00:00:00`;
          const revenueResult = await db.queryOne(`
            SELECT SUM(paid_amount) as total 
            FROM visits 
            WHERE status = 'closed' AND created_at >= ?
          `, [startOfMonth]);
          const totalRev = revenueResult ? (revenueResult.total || 0) : 0;
          commissionEarned = (totalRev * emp.commission_percentage) / 100;
        }

        const totalPayout = emp.base_salary + (emp.bonus || 0) + (emp.incentive || 0) + commissionEarned;

        if (totalPayout > 0) {
          // Record payment voucher (expenditure / cash out)
          const desc = `صرف راتب شهري تلقائي للموظف ${emp.name} عن شهر ${currentMonthStr} (الأساسي: ${emp.base_salary}، مكافآت: ${emp.bonus || 0}، حوافز: ${emp.incentive || 0}، عمولة: ${commissionEarned.toFixed(2)})`;
          await db.runCommand(
            "INSERT INTO vouchers (type, amount, recipient_payer, description) VALUES ('payment', ?, ?, ?)",
            [totalPayout, emp.name, desc]
          );

          // Log in treasury transactions as expense
          await addTreasuryTransaction({
            type: 'expense',
            amount: parseFloat(totalPayout),
            description: desc,
            userResponsible: 'system'
          });

          // Log audit
          await db.logAudit(1, 'system', 'AUTO_PAYROLL_PAYMENT', `Automatically processed salary payment of ${totalPayout} EGP for ${emp.name}`);
        }

        // Mark as paid and reset temporary bonuses and incentives for next month
        await db.runCommand(
          "UPDATE employees SET last_paid_month = ?, bonus = 0, incentive = 0 WHERE id = ?",
          [currentMonthStr, emp.id]
        );
      }
    }
  } catch (err) {
    console.error('Error in syncReceptionistsAndProcessPayroll:', err);
  }
}

// 6. Employees Module
app.get('/api/employees', async (req, res) => {
  try {
    await syncReceptionistsAndProcessPayroll();
    const list = await db.queryAll('SELECT * FROM employees');
    
    // Calculate payroll reports dynamic bonuses/incentives/commissions
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
    
    for (const emp of list) {
      if (emp.commission_percentage > 0) {
        // Find total closed visit revenue of patients who registered in current month
        const revenueResult = await db.queryOne(`
          SELECT SUM(paid_amount) as total 
          FROM visits 
          WHERE status = 'closed' AND created_at >= ?
        `, [startOfMonth]);
        
        const totalRev = revenueResult ? (revenueResult.total || 0) : 0;
        emp.commission_earned = (totalRev * emp.commission_percentage) / 100;
      } else {
        emp.commission_earned = 0;
      }
      emp.total_salary = emp.base_salary + emp.bonus + emp.incentive + emp.commission_earned;
    }
    
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  const { name, role, baseSalary, commissionPercentage, salaryDay } = req.body;
  try {
    await db.runCommand(
      'INSERT INTO employees (name, role, base_salary, commission_percentage, salary_day) VALUES (?, ?, ?, ?, ?)',
      [name, role, baseSalary, commissionPercentage || 0, salaryDay || 30]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  const { name, role, baseSalary, bonus, incentive, commissionPercentage, salaryDay } = req.body;
  try {
    const oldEmp = await db.queryOne('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    await db.runCommand(
      `UPDATE employees SET name = ?, role = ?, base_salary = ?, bonus = ?, incentive = ?, commission_percentage = ?, salary_day = ?
       WHERE id = ?`,
      [name, role, baseSalary, bonus || 0, incentive || 0, commissionPercentage || 0, salaryDay || 30, req.params.id]
    );

    const addedAmount = (bonus || 0) - (oldEmp ? (oldEmp.bonus || 0) : 0);
    if (addedAmount > 0) {
      broadcast({
        event: 'BONUS_ADDED',
        message: `تم إضافة علاوة بقيمة ${addedAmount} EGP للموظف ${name}`,
        employeeName: name,
        amount: addedAmount
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await db.runCommand('DELETE FROM employees WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat Room Routes
app.get('/api/chat', async (req, res) => {
  try {
    const messages = await db.queryAll('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50');
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { senderUsername, senderFullname, messageText } = req.body;
  try {
    const result = await db.runCommand(
      'INSERT INTO chat_messages (sender_username, sender_fullname, message_text) VALUES (?, ?, ?)',
      [senderUsername, senderFullname, messageText]
    );
    const newMessage = {
      id: result.insertId,
      sender_username: senderUsername,
      sender_fullname: senderFullname,
      message_text: messageText,
      created_at: new Date().toISOString()
    };
    broadcast({ event: 'CHAT_MESSAGE', data: newMessage });
    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Inventory Module
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await db.queryAll('SELECT * FROM inventory_items');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  const { name, supplier, quantity, minLevel, unit, costPrice, sellingPrice, category, itemType, notes, billable, barcode, qrCode } = req.body;
  try {
    await db.runCommand(
      `INSERT INTO inventory_items (name, supplier, quantity, min_level, unit, cost_price, selling_price, category, item_type, notes, billable, barcode, qr_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, supplier, quantity || 0, minLevel || 5, unit || 'Box', costPrice || 0, sellingPrice || 0, category || 'General', itemType || 'quantity', notes || '', billable ? 1 : 0, barcode || null, qrCode || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  const { name, supplier, quantity, minLevel, unit, costPrice, sellingPrice, isDisabled, category, itemType, notes, billable, barcode, qrCode, usageCount } = req.body;
  try {
    await db.runCommand(
      `UPDATE inventory_items SET name = ?, supplier = ?, quantity = ?, min_level = ?, unit = ?, 
       cost_price = ?, selling_price = ?, is_disabled = ?, category = ?, item_type = ?, notes = ?, billable = ?, barcode = ?, qr_code = ?, usage_count = ? WHERE id = ?`,
      [name, supplier, quantity || 0, minLevel || 5, unit || 'Box', costPrice || 0, sellingPrice || 0, isDisabled ? 1 : 0, category || 'General', itemType || 'quantity', notes || '', billable ? 1 : 0, barcode || null, qrCode || null, usageCount || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register Item Purchase & Log Expense
app.post('/api/inventory/purchase', async (req, res) => {
  const { itemId, itemName, supplier, quantity, costPrice, sellingPrice, unit, purchaseDate } = req.body;
  try {
    let finalItemId = itemId;
    let finalItemName = itemName;
    const qty = parseInt(quantity || 0);
    const cp = parseFloat(costPrice || 0);

    if (!finalItemId) {
      // Check if item name exists
      const existing = await db.queryOne('SELECT * FROM inventory_items WHERE name = ?', [itemName]);
      if (existing) {
        finalItemId = existing.id;
        finalItemName = existing.name;
        // Update item quantity and cost
        await db.runCommand(
          'UPDATE inventory_items SET quantity = quantity + ?, supplier = ?, cost_price = ?, selling_price = ? WHERE id = ?',
          [qty, supplier, cp, parseFloat(sellingPrice || existing.selling_price), finalItemId]
        );
      } else {
        // Create new item
        const result = await db.runCommand(
          'INSERT INTO inventory_items (name, supplier, quantity, min_level, unit, cost_price, selling_price, category, item_type) VALUES (?, ?, ?, 5, ?, ?, ?, ?, ?)',
          [itemName, supplier, qty, unit || 'Box', cp, parseFloat(sellingPrice || 0), 'General', 'quantity']
        );
        finalItemId = result.insertId;
      }
    } else {
      // Update existing item
      const item = await db.queryOne('SELECT * FROM inventory_items WHERE id = ?', [finalItemId]);
      if (item) {
        finalItemName = item.name;
        await db.runCommand(
          'UPDATE inventory_items SET quantity = quantity + ?, supplier = ?, cost_price = ? WHERE id = ?',
          [qty, supplier, cp, finalItemId]
        );
      }
    }

    // Register payment voucher
    const totalCost = qty * cp;
    const dateVal = purchaseDate 
      ? new Date(purchaseDate).toISOString().replace('T', ' ').substring(0, 19) 
      : new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    await db.runCommand(
      'INSERT INTO vouchers (type, amount, recipient_payer, description, created_at) VALUES (?, ?, ?, ?, ?)',
      ['payment', totalCost, supplier || 'General Supplier', `فاتورة شراء مخزون: ${finalItemName} (كمية: ${qty})`, dateVal]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Stock Deduction / Adjustment
app.post('/api/inventory/:id/deduct', async (req, res) => {
  const { quantity, notes, userResponsible } = req.body;
  const itemId = req.params.id;
  try {
    const item = await db.queryOne('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });
    
    const qty = parseFloat(quantity || 0);
    if (item.item_type === 'quantity' || item.item_type === 'manual') {
      await db.runCommand('UPDATE inventory_items SET quantity = CASE WHEN quantity - ? < 0 THEN 0 ELSE quantity - ? END WHERE id = ?', [qty, qty, itemId]);
    } else if (item.item_type === 'usage') {
      await db.runCommand('UPDATE inventory_items SET usage_count = usage_count + ? WHERE id = ?', [qty, itemId]);
    }
    
    // Insert Transaction
    await db.runCommand(
      `INSERT INTO inventory_transactions (transaction_date, patient_name, patient_mobile, visit_id, item_name, quantity_used, user_responsible, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date().toISOString().split('T')[0],
        'Manual Adjustment / تعديل يدوي',
        'N/A',
        null,
        item.name,
        qty,
        userResponsible || 'Admin',
        notes || 'خصم يدوي لمستلزمات العيادة'
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Inventory Transaction History logs
app.get('/api/inventory/transactions', async (req, res) => {
  try {
    const list = await db.queryAll('SELECT * FROM inventory_transactions ORDER BY created_at DESC');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get visit used inventory items
app.get('/api/visits/:id/inventory', async (req, res) => {
  try {
    const list = await db.queryAll('SELECT * FROM visit_inventory_items WHERE visit_id = ?', [req.params.id]);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Inventory Dashboard Analytics
app.get('/api/inventory/dashboard', async (req, res) => {
  try {
    const items = await db.queryAll("SELECT * FROM inventory_items WHERE is_disabled = 0");
    const txs = await db.queryAll("SELECT * FROM inventory_transactions");

    // 1. Current Inventory Value
    let totalStockValue = 0;
    items.forEach(item => {
      if (item.item_type !== 'usage') {
        totalStockValue += (item.quantity || 0) * (item.cost_price || 0);
      }
    });

    // 2. Low Stock Alerts count
    const lowStockItems = items.filter(item => item.item_type !== 'usage' && item.quantity <= item.min_level);

    // 3. Transactions analytics
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7); // 'YYYY-MM'

    let dailyCost = 0;
    let monthlyCost = 0;
    let totalCost = 0;

    // Create item cost lookup
    const itemCostMap = {};
    items.forEach(item => {
      itemCostMap[item.name] = item.cost_price || 0;
    });

    // consumption counters
    const itemUsageFreq = {};

    txs.forEach(t => {
      const itemCost = itemCostMap[t.item_name] || 0;
      const cost = (t.quantity_used || 0) * itemCost;
      totalCost += cost;

      if (t.transaction_date === today) {
        dailyCost += cost;
      }
      if (t.transaction_date && t.transaction_date.substring(0, 7) === thisMonth) {
        monthlyCost += cost;
      }

      itemUsageFreq[t.item_name] = (itemUsageFreq[t.item_name] || 0) + (t.quantity_used || 0);
    });

    // Fast moving vs Slow moving
    const usageList = Object.entries(itemUsageFreq).map(([name, qty]) => ({ name, qty }));
    usageList.sort((a, b) => b.qty - a.qty);
    const mostUsed = usageList.slice(0, 5);

    // Patients cost analysis
    const visitsCountRow = await db.queryOne("SELECT COUNT(*) as count FROM visits WHERE status = 'closed'");
    const totalVisits = visitsCountRow ? visitsCountRow.count : 0;
    const costPerPatient = totalVisits > 0 ? (totalCost / totalVisits) : 0;

    res.json({
      totalStockValue,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      dailyCost,
      monthlyCost,
      totalCost,
      costPerPatient,
      mostUsed,
      usageList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Device Maintenance Records
app.get('/api/maintenance', async (req, res) => {
  try {
    const list = await db.queryAll('SELECT * FROM maintenance_records ORDER BY next_maintenance_date ASC');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maintenance', async (req, res) => {
  const { deviceName, representativeName, maintenanceDate, nextMaintenanceDate, cost, notes } = req.body;
  try {
    await db.runCommand(
      `INSERT INTO maintenance_records (device_name, representative_name, maintenance_date, next_maintenance_date, cost, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [deviceName, representativeName, maintenanceDate, nextMaintenanceDate, cost, notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vouchers (Receipts/Payments)
app.get('/api/vouchers', async (req, res) => {
  try {
    const list = await db.queryAll('SELECT * FROM vouchers ORDER BY created_at DESC');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vouchers', async (req, res) => {
  const { type, amount, recipientPayer, description } = req.body;
  try {
    const activeSession = await getActiveTreasurySession();
    if (!activeSession) {
      return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لتسجيل السندات والمدفوعات.' });
    }
    await db.runCommand(
      'INSERT INTO vouchers (type, amount, recipient_payer, description) VALUES (?, ?, ?, ?)',
      [type, amount, recipientPayer, description]
    );
    // Log in treasury transactions
    await addTreasuryTransaction({
      type: type === 'payment' ? 'expense' : 'income',
      amount: parseFloat(amount),
      description: `سند ${type === 'payment' ? 'صرف' : 'قبض'} نقدية: ${description} (الجهة: ${recipientPayer})`,
      userResponsible: 'admin'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Reporting Engine
app.get('/api/reports/dashboard', async (req, res) => {
  try {
    await syncReceptionistsAndProcessPayroll();
    const today = new Date().toISOString().split('T')[0];
    
    // Dates calculation
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const lastWeek = d.toISOString().split('T')[0];

    d.setDate(d.getDate() - 23); // Total 30 days
    const lastMonth = d.toISOString().split('T')[0];

    d.setDate(d.getDate() - 335); // Total 365 days
    const lastYear = d.toISOString().split('T')[0];

    // Load useInventory setting
    const useInventoryRow = await db.queryOne("SELECT value FROM settings WHERE key = 'useInventory'");
    const useInventory = useInventoryRow ? useInventoryRow.value === 'true' : false;

    // Load and filter payment vouchers (expenses)
    const rawPayments = await db.queryAll("SELECT amount, description, created_at FROM vouchers WHERE type='payment'");
    
    const isInventoryExpense = (desc) => {
      if (!desc) return false;
      return desc.includes('شراء مخزون') || desc.includes('فاتورة شراء مخزون') || desc.includes('مخزن') || desc.includes('مخزون');
    };

    const payments = rawPayments.filter(p => {
      if (!useInventory && isInventoryExpense(p.description)) {
        return false;
      }
      return true;
    });

    let dailyExp = 0;
    let weeklyExp = 0;
    let monthlyExp = 0;
    let yearlyExp = 0;
    let expenseTotal = 0;

    let salariesExp = 0;
    let medicinesExp = 0;
    let inventoryExp = 0;
    let otherExp = 0;

    payments.forEach(p => {
      const amt = p.amount || 0;
      expenseTotal += amt;

      const desc = p.description || '';
      if (desc.includes('راتب') || desc.includes('payroll') || desc.includes('أجور') || desc.includes('اجور')) {
        salariesExp += amt;
      } else if (desc.includes('دواء') || desc.includes('أدوية') || desc.includes('ادوية') || desc.includes('علاج') || desc.includes('medicine') || desc.includes('pharma')) {
        medicinesExp += amt;
      } else if (desc.includes('مستلزمات') || desc.includes('مخزن') || desc.includes('مخزون') || desc.includes('شراء مخزون') || desc.includes('جرد') || desc.includes('inventory') || desc.includes('stock') || desc.includes('supply') || desc.includes('supplies')) {
        inventoryExp += amt;
      } else {
        otherExp += amt;
      }

      if (p.created_at) {
        const dateStr = p.created_at.substring(0, 10);
        if (dateStr === today) {
          dailyExp += amt;
        }
        if (dateStr >= lastWeek) {
          weeklyExp += amt;
        }
        if (dateStr >= lastMonth) {
          monthlyExp += amt;
        }
        if (dateStr >= lastYear) {
          yearlyExp += amt;
        }
      }
    });

    // 1. Gross Revenues
    const dailyRev = await db.queryOne("SELECT SUM(paid_amount) as total FROM visits WHERE status='closed' AND DATE(closed_at) = ?", [today]);
    const weeklyRev = await db.queryOne("SELECT SUM(paid_amount) as total FROM visits WHERE status='closed' AND DATE(closed_at) >= ?", [lastWeek]);
    const monthlyRev = await db.queryOne("SELECT SUM(paid_amount) as total FROM visits WHERE status='closed' AND DATE(closed_at) >= ?", [lastMonth]);
    const yearlyRev = await db.queryOne("SELECT SUM(paid_amount) as total FROM visits WHERE status='closed' AND DATE(closed_at) >= ?", [lastYear]);

    // 2. Refunds (Patient)
    const dailyRef = await db.queryOne("SELECT SUM(amount) as total FROM refunds WHERE category='patient' AND DATE(created_at) = ?", [today]);
    const weeklyRef = await db.queryOne("SELECT SUM(amount) as total FROM refunds WHERE category='patient' AND DATE(created_at) >= ?", [lastWeek]);
    const monthlyRef = await db.queryOne("SELECT SUM(amount) as total FROM refunds WHERE category='patient' AND DATE(created_at) >= ?", [lastMonth]);
    const yearlyRef = await db.queryOne("SELECT SUM(amount) as total FROM refunds WHERE category='patient' AND DATE(created_at) >= ?", [lastYear]);

    // Net Calculations
    const dailyNet = Math.max(0, (dailyRev?.total || 0) - (dailyRef?.total || 0));
    const weeklyNet = Math.max(0, (weeklyRev?.total || 0) - (weeklyRef?.total || 0));
    const monthlyNet = Math.max(0, (monthlyRev?.total || 0) - (monthlyRef?.total || 0));
    const yearlyNet = Math.max(0, (yearlyRev?.total || 0) - (yearlyRef?.total || 0));
    const refundTotal = await db.queryOne("SELECT SUM(amount) as total FROM refunds");

    // 3. Counts
    const patientStats = await db.queryOne("SELECT COUNT(*) as total_patients FROM patients");
    const serviceStats = await db.queryOne("SELECT COUNT(*) as total_services FROM medical_services WHERE is_disabled = 0");
    const visitStats = await db.queryOne("SELECT COUNT(*) as total_visits FROM visits WHERE status='closed'");
    const consultStats = await db.queryOne("SELECT COUNT(*) as total FROM visits WHERE status='closed' AND visit_type='consultation'");
    const followupStats = await db.queryOne("SELECT COUNT(*) as total FROM visits WHERE status='closed' AND visit_type='followup'");

    // 4. Waiting & Consultation Time Analytics
    const waitStats = await db.queryOne(`
      SELECT AVG(waiting_time_seconds) as avg_wait,
             MIN(waiting_time_seconds) as min_wait,
             MAX(waiting_time_seconds) as max_wait
      FROM visits
      WHERE status='closed' AND waiting_time_seconds IS NOT NULL AND waiting_time_seconds > 0
    `);
    
    const durationStats = await db.queryOne(`
      SELECT AVG(consultation_duration_seconds) as avg_duration
      FROM visits
      WHERE status='closed' AND consultation_duration_seconds IS NOT NULL AND consultation_duration_seconds > 0
    `);

    // 5. Patient Satisfaction Counts
    const satisfactionStats = await db.queryAll(`
      SELECT satisfaction_status, COUNT(*) as count
      FROM visits
      WHERE status='closed' AND satisfaction_status IS NOT NULL
      GROUP BY satisfaction_status
    `);

    // 6. Top Rankings
    const topPatients = await db.queryAll(`
      SELECT name, mobile_number, visit_count, total_paid 
      FROM patients 
      ORDER BY visit_count DESC LIMIT 5
    `);

    const topServices = await db.queryAll(`
      SELECT service_name, COUNT(*) as count, SUM(price) as revenue
      FROM visit_services
      GROUP BY service_name
      ORDER BY count DESC LIMIT 5
    `);

    // 7. Upcoming Followups
    const upcomingFollowups = await db.queryAll(`
      SELECT v.follow_up_date, p.name as patient_name, p.mobile_number 
      FROM visits v 
      JOIN patients p ON v.patient_mobile = p.mobile_number 
      WHERE v.status='closed' AND v.follow_up_date >= ? 
      ORDER BY v.follow_up_date ASC LIMIT 5
    `, [today]);

    // 8. DB-agnostic monthly timeline grouping
    const allClosedVisits = await db.queryAll("SELECT paid_amount, closed_at, visit_type FROM visits WHERE status='closed'");
    const monthlyGroups = {};
    allClosedVisits.forEach(v => {
      if (!v.closed_at) return;
      const month = v.closed_at.substring(0, 7); // 'YYYY-MM'
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = { month, revenue: 0, count: 0, expenses: 0 };
      }
      monthlyGroups[month].revenue += v.paid_amount;
      monthlyGroups[month].count += 1;
    });
    
    // Also group refunds by month
    const allRefunds = await db.queryAll("SELECT amount, created_at FROM refunds WHERE category='patient'");
    allRefunds.forEach(r => {
      if (!r.created_at) return;
      const month = r.created_at.substring(0, 7);
      if (monthlyGroups[month]) {
        monthlyGroups[month].revenue -= r.amount;
        if (monthlyGroups[month].revenue < 0) monthlyGroups[month].revenue = 0;
      }
    });

    // Also group filtered payment vouchers (expenses) by month
    payments.forEach(p => {
      if (!p.created_at) return;
      const month = p.created_at.substring(0, 7);
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = { month, revenue: 0, count: 0, expenses: 0 };
      }
      if (!monthlyGroups[month].expenses) monthlyGroups[month].expenses = 0;
      monthlyGroups[month].expenses += p.amount;
    });

    const monthlyTimeline = Object.values(monthlyGroups).sort((a,b) => b.month.localeCompare(a.month)).slice(0, 6);

    res.json({
      revenue: {
        daily: dailyNet,
        weekly: weeklyNet,
        monthly: monthlyNet,
        yearly: yearlyNet,
        refunded: refundTotal?.total || 0,
        
        dailyExpenses: dailyExp,
        weeklyExpenses: weeklyExp,
        monthlyExpenses: monthlyExp,
        yearlyExpenses: yearlyExp,
        totalExpenses: expenseTotal,

        dailyNetProfit: Math.max(0, dailyNet - dailyExp),
        weeklyNetProfit: Math.max(0, weeklyNet - weeklyExp),
        monthlyNetProfit: Math.max(0, monthlyNet - monthlyExp),
        yearlyNetProfit: Math.max(0, yearlyNet - yearlyExp),

        expensesBreakdown: {
          salaries: salariesExp,
          medicines: medicinesExp,
          inventory: inventoryExp,
          other: otherExp
        }
      },
      patientStats: {
        total_patients: patientStats?.total_patients || 0,
        total_services: serviceStats?.total_services || 0,
        total_visits: visitStats?.total_visits || 0,
        total_consultations: consultStats?.total || 0,
        total_followups: followupStats?.total || 0
      },
      waiting: {
        avg: waitStats?.avg_wait ? Math.round(waitStats.avg_wait) : 0,
        min: waitStats?.min_wait || 0,
        max: waitStats?.max_wait || 0,
        avgDuration: durationStats?.avg_duration ? Math.round(durationStats.avg_duration) : 0
      },
      satisfaction: satisfactionStats,
      topPatients,
      topServices,
      upcomingFollowups,
      monthlyTimeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ADVANCED UPDATE API ENDPOINTS ===

// 1. Examination Templates Clicker APIs
app.get('/api/templates/examination', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT * FROM examination_templates ORDER BY category ASC, type ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates/examination', async (req, res) => {
  const { category, type, optionValue } = req.body;
  try {
    await db.runCommand(
      'INSERT INTO examination_templates (category, type, option_value) VALUES (?, ?, ?)',
      [category, type, optionValue]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/templates/examination/:id', async (req, res) => {
  const { category, type, optionValue } = req.body;
  try {
    await db.runCommand(
      'UPDATE examination_templates SET category = ?, type = ?, option_value = ? WHERE id = ?',
      [category, type, optionValue, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/examination/:id', async (req, res) => {
  try {
    await db.runCommand('DELETE FROM examination_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. External Referral Partners APIs
app.get('/api/partners', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT * FROM external_partners ORDER BY type ASC, name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/partners', async (req, res) => {
  const { name, type, address, phone, notes } = req.body;
  try {
    await db.runCommand(
      'INSERT INTO external_partners (name, type, address, phone, notes) VALUES (?, ?, ?, ?, ?)',
      [name, type, address, phone, notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/partners/:id', async (req, res) => {
  const { name, type, address, phone, notes } = req.body;
  try {
    await db.runCommand(
      'UPDATE external_partners SET name = ?, type = ?, address = ?, phone = ?, notes = ? WHERE id = ?',
      [name, type, address, phone, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/partners/:id', async (req, res) => {
  try {
    await db.runCommand('DELETE FROM external_partners WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Referral Tracking APIs
app.get('/api/referrals', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT * FROM referrals ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/referrals', async (req, res) => {
  const { visitId, patientName, partnerId, partnerName, medications, supplies, notes } = req.body;
  try {
    await db.runCommand(
      `INSERT INTO referrals (visit_id, patient_name, partner_id, partner_name, medications_json, supplies_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [visitId, patientName, partnerId, partnerName, JSON.stringify(medications || []), JSON.stringify(supplies || []), notes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Refunds & Returns APIs
app.get('/api/refunds', async (req, res) => {
  try {
    const rows = await db.queryAll('SELECT * FROM refunds ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refunds', async (req, res) => {
  const { visitId, category, patientName, amount, reason, userResponsible } = req.body;
  try {
    const activeSession = await getActiveTreasurySession();
    if (!activeSession) {
      return res.status(400).json({ error: 'الخزينة مغلقة! يرجى فتح الخزينة أولاً لإجراء عمليات الاسترجاع المالي.' });
    }
    // Save refund
    await db.runCommand(
      'INSERT INTO refunds (visit_id, category, patient_name, amount, reason, user_responsible) VALUES (?, ?, ?, ?, ?, ?)',
      [visitId || null, category, patientName, amount, reason, userResponsible]
    );
    // Log in treasury transactions
    await addTreasuryTransaction({
      type: 'refund',
      amount: parseFloat(amount),
      description: `استرجاع مالي (${category === 'patient' ? 'مريض' : 'مخزن/أخرى'}): ${reason} - للمريض/الجهة: ${patientName}`,
      relatedVisitId: visitId || null,
      userResponsible: userResponsible || 'admin'
    });
    
    // If it's a patient/visit refund and visitId is valid, set visits paid_amount to 0 or adjust it
    if (category === 'patient' && visitId) {
      const visit = await db.queryOne('SELECT * FROM visits WHERE id = ?', [visitId]);
      if (visit) {
        // Subtract refunded amount from visit paid_amount
        const updatedPaid = Math.max(0, visit.paid_amount - amount);
        await db.runCommand(
          'UPDATE visits SET paid_amount = ?, payment_status = ? WHERE id = ?',
          [updatedPaid, updatedPaid === 0 ? 'refunded' : 'partial_refund', visitId]
        );
        
        // Also deduct from patient total_paid
        await db.runCommand(
          'UPDATE patients SET total_paid = CASE WHEN total_paid - ? < 0 THEN 0 ELSE total_paid - ? END WHERE mobile_number = ?',
          [amount, amount, visit.patient_mobile]
        );
      }
    }
    
    broadcast({ event: 'QUEUE_UPDATE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Clear Database Sections API
app.post('/api/admin/clear-data', async (req, res) => {
  const { section } = req.body;
  try {
    const dbType = db.getDbType();
    
    // Temporarily turn off foreign key checks
    if (dbType === 'mysql') {
      await db.runCommand('SET FOREIGN_KEY_CHECKS = 0');
    } else {
      await db.runCommand('PRAGMA foreign_keys = OFF');
    }

    if (section === 'patients') {
      await db.runCommand('DELETE FROM visit_services');
      await db.runCommand('DELETE FROM referrals');
      await db.runCommand('DELETE FROM refunds');
      await db.runCommand('DELETE FROM visits');
      await db.runCommand('DELETE FROM companions');
      await db.runCommand('DELETE FROM patients');
    } else if (section === 'pharmacy') {
      await db.runCommand('DELETE FROM referrals');
      await db.runCommand('DELETE FROM external_partners');
    } else if (section === 'inventory') {
      await db.runCommand('DELETE FROM inventory_items');
      await db.runCommand('DELETE FROM maintenance_records');
    } else if (section === 'vouchers') {
      await db.runCommand('DELETE FROM vouchers');
      await db.runCommand('DELETE FROM refunds');
    } else if (section === 'employees') {
      await db.runCommand('DELETE FROM employees');
    } else if (section === 'logs') {
      await db.runCommand('DELETE FROM audit_logs');
    } else if (section === 'chat') {
      await db.runCommand('DELETE FROM chat_messages');
    } else {
      throw new Error('قسم غير صالح للحذف');
    }

    // Re-enable foreign key checks
    if (dbType === 'mysql') {
      await db.runCommand('SET FOREIGN_KEY_CHECKS = 1');
    } else {
      await db.runCommand('PRAGMA foreign_keys = ON');
    }

    await db.logAudit(1, 'admin', 'SYSTEM_DATA_PURGED', `Purged data for section: ${section}`);
    
    // Broadcast notifications to refresh active UIs
    broadcast({ event: 'QUEUE_UPDATE' });
    broadcast({ event: 'CHAT_MESSAGE', type: 'refresh' });

    res.json({ success: true });
  } catch (err) {
    console.error('Purge error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin list audit logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.queryAll('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Peak Hours Analytics
app.get('/api/dashboard/peak-hours', async (req, res) => {
  try {
    const visits = await db.queryAll('SELECT created_at FROM visits');
    const hourlyCounts = Array(24).fill(0);
    const dailyCounts = Array(7).fill(0); // 0: Sun, 1: Mon, etc.
    
    visits.forEach(v => {
      if (!v.created_at) return;
      const d = parseDbDate(v.created_at);
      const hour = d.getHours();
      const day = d.getDay();
      if (hour >= 0 && hour < 24) hourlyCounts[hour]++;
      if (day >= 0 && day < 7) dailyCounts[day]++;
    });
    
    res.json({
      hourly: hourlyCounts,
      daily: dailyCounts
    });
  } catch (err) {
    console.error('Peak hours analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp template compiler & sender
app.post('/api/whatsapp/send-prescription', async (req, res) => {
  const { visitId, mobileNumber, message } = req.body;
  try {
    const isEnabledSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'whatsappEnabled'");
    const isWhatsappGloballyEnabled = isEnabledSetting && isEnabledSetting.value === 'true';
    
    const useFallbackSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'whatsappUseFallbackSms'");
    const useFallbackSms = useFallbackSetting && useFallbackSetting.value === 'true';

    const patient = await db.queryOne("SELECT whatsapp_enabled FROM patients WHERE mobile_number = ?", [mobileNumber]);
    const isPatientWhatsappEnabled = patient ? patient.whatsapp_enabled === 1 : true;

    let status = 'skipped';
    let type = 'none';

    if (isWhatsappGloballyEnabled && isPatientWhatsappEnabled) {
      console.log(`[SIMULATED WHATSAPP] Sent to ${mobileNumber}: "${message}"`);
      status = 'sent';
      type = 'whatsapp';
      await db.logAudit(1, 'system', 'WHATSAPP_SENT', `Simulated WhatsApp prescription sent to ${mobileNumber}`);
    } else if (useFallbackSms) {
      console.log(`[SIMULATED SMS FALLBACK] Sent to ${mobileNumber}: "${message}"`);
      status = 'sent';
      type = 'sms';
      await db.logAudit(1, 'system', 'SMS_SENT', `Simulated fallback SMS prescription sent to ${mobileNumber}`);
    } else {
      console.log(`[SIMULATED SEND SKIPPED] WhatsApp/SMS disabled for ${mobileNumber}`);
    }

    res.json({ success: true, status, type });
  } catch (err) {
    console.error('WhatsApp send prescription error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { mobileNumbers, message } = req.body;
  try {
    const isEnabledSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'whatsappEnabled'");
    const isWhatsappGloballyEnabled = isEnabledSetting && isEnabledSetting.value === 'true';
    
    const useFallbackSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'whatsappUseFallbackSms'");
    const useFallbackSms = useFallbackSetting && useFallbackSetting.value === 'true';

    let whatsappCount = 0;
    let smsCount = 0;
    let skippedCount = 0;

    for (const num of mobileNumbers) {
      const patient = await db.queryOne("SELECT whatsapp_enabled FROM patients WHERE mobile_number = ?", [num]);
      const isPatientWhatsappEnabled = patient ? patient.whatsapp_enabled === 1 : true;

      if (isWhatsappGloballyEnabled && isPatientWhatsappEnabled) {
        console.log(`[SIMULATED WHATSAPP BROADCAST] Sent to ${num}: "${message}"`);
        whatsappCount++;
      } else if (useFallbackSms) {
        console.log(`[SIMULATED SMS BROADCAST FALLBACK] Sent to ${num}: "${message}"`);
        smsCount++;
      } else {
        console.log(`[SIMULATED BROADCAST SKIPPED] for ${num}`);
        skippedCount++;
      }
    }

    await db.logAudit(1, 'system', 'WHATSAPP_BROADCAST', `Broadcast complete. WhatsApp: ${whatsappCount}, SMS: ${smsCount}, Skipped: ${skippedCount}`);
    res.json({
      success: true,
      whatsappCount,
      smsCount,
      skippedCount
    });
  } catch (err) {
    console.error('WhatsApp broadcast error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Get backup directory
async function getBackupDirectory() {
  const customPathRow = await db.queryOne("SELECT value FROM settings WHERE key = 'backupPath'");
  let dirPath = '';
  if (customPathRow && customPathRow.value) {
    dirPath = customPathRow.value.trim();
  }
  
  if (!dirPath) {
    const dataDir = process.env.USER_DATA_PATH || __dirname;
    dirPath = path.join(dataDir, 'backups');
  }

  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create custom backup folder, falling back to default:', e);
    const dataDir = process.env.USER_DATA_PATH || __dirname;
    dirPath = path.join(dataDir, 'backups');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  return dirPath;
}

// Helper: Run Auto Backup If Due
async function runAutoBackupIfDue() {
  try {
    if (db.getDbType() !== 'sqlite') return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const lastBackupRow = await db.queryOne("SELECT value FROM settings WHERE key = 'last_backup_date'");
    const lastBackupDate = lastBackupRow ? lastBackupRow.value : '';

    if (lastBackupDate !== todayStr) {
      console.log(`[AUTO-BACKUP] Daily backup is due. Last backup: "${lastBackupDate}", Today: "${todayStr}". Running...`);
      const dbPath = db.getDbPath();
      if (!fs.existsSync(dbPath)) return;

      const backupDir = await getBackupDirectory();
      const now = new Date();
      const timestamp = now.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
      const backupFileName = `backup-auto-${timestamp}.db`;
      const destPath = path.join(backupDir, backupFileName);
      
      fs.copyFileSync(dbPath, destPath);
      
      // Update last backup date in settings
      await db.runCommand(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup_date', ?)",
        [todayStr]
      );
      
      await db.logAudit(1, 'system', 'AUTO_BACKUP_CREATED', `Automatic daily backup created: ${backupFileName}`);
      console.log(`[AUTO-BACKUP] Auto-backup created successfully: ${backupFileName}`);
    }
  } catch (err) {
    console.error('[AUTO-BACKUP] Failed to execute automatic daily backup:', err);
  }
}

// Backup management APIs
app.get('/api/backup/status', async (req, res) => {
  try {
    const dbType = db.getDbType();
    const backupDir = await getBackupDirectory();
    const lastBackupRow = await db.queryOne("SELECT value FROM settings WHERE key = 'last_backup_date'");
    res.json({
      dbType,
      backupDir,
      lastBackupDate: lastBackupRow ? lastBackupRow.value : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup/list', async (req, res) => {
  try {
    if (db.getDbType() !== 'sqlite') {
      return res.json([]);
    }
    const backupDir = await getBackupDirectory();
    const files = fs.readdirSync(backupDir);
    const backups = [];
    files.forEach(file => {
      if (file.startsWith('backup-') && file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        backups.push({
          filename: file,
          size: stats.size,
          createdAt: stats.mtime
        });
      }
    });
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/run', async (req, res) => {
  try {
    if (db.getDbType() !== 'sqlite') {
      return res.status(400).json({ error: 'النسخ الاحتياطي المحلي مدعوم فقط لقاعدة البيانات SQLite' });
    }
    const dbPath = db.getDbPath();
    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'قاعدة البيانات الأصلية غير موجودة على القرص!' });
    }
    
    const backupDir = await getBackupDirectory();
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
    const backupFileName = `backup-${timestamp}.db`;
    const destPath = path.join(backupDir, backupFileName);
    
    fs.copyFileSync(dbPath, destPath);
    
    const todayStr = now.toISOString().split('T')[0];
    await db.runCommand(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup_date', ?)",
      [todayStr]
    );
    
    await db.logAudit(1, 'system', 'BACKUP_CREATED', `Database backup created manually: ${backupFileName}`);
    res.json({ success: true, filename: backupFileName });
  } catch (err) {
    console.error('Manual backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/restore', async (req, res) => {
  const { filename } = req.body;
  try {
    if (db.getDbType() !== 'sqlite') {
      return res.status(400).json({ error: 'الاستعادة المحلية مدعومة فقط لقاعدة البيانات SQLite' });
    }
    const backupDir = await getBackupDirectory();
    const srcPath = path.join(backupDir, filename);
    if (!fs.existsSync(srcPath)) {
      return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير موجود!' });
    }
    
    const dbPath = db.getDbPath();
    fs.copyFileSync(srcPath, dbPath);
    
    await db.initDatabase();
    
    await db.logAudit(1, 'system', 'BACKUP_RESTORED', `Database restored from backup: ${filename}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend assets if running outside Electron / hosted on the cloud
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all to serve frontend React app for client-side routing
app.get('*', (req, res, next) => {
  // If the path starts with /api, pass it to other routers / handlers
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Express startup handler
app.get('/api/sync/status', (req, res) => {
  res.json({
    status: 'synced',
    lastSyncTime: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
    pendingCount: 0,
    failedCount: 0
  });
});

let serverListener = null;

async function startServer() {
  await db.initDatabase();
  
  // Note: Local background sync engine and SQLite auto backup checks are disabled for Cloud Hosting.

  const port = process.env.PORT || 5000;
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      console.error(`Embedded server failed to listen on port ${port}:`, err);
      reject(err);
    };
    server.once('error', onError);
    
    serverListener = server.listen(port, () => {
      server.off('error', onError);
      console.log(`Embedded server running on http://localhost:${port}`);
      resolve(serverListener);
    });
  });
}

module.exports = {
  startServer
};

if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

