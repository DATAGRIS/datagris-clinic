const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let sqliteDb = null;
let dbType = 'sqlite';
let dbPath = '';

// Store the logged-in user's JWT in global memory
global.userJwt = null;

async function initDatabase() {
  dbType = 'sqlite';
  console.log(`Initializing local SQLite database for Offline-First SaaS...`);

  const dataDir = process.env.USER_DATA_PATH || __dirname;
  dbPath = path.join(dataDir, 'clinic.db');
  console.log(`SQLite Database Path: ${dbPath}`);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch (e) {
      console.error('Error closing database during re-init:', e);
    }
    sqliteDb = null;
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    console.log('Loading existing SQLite database file...');
    const filebuffer = fs.readFileSync(dbPath);
    sqliteDb = new SQL.Database(filebuffer);
  } else {
    console.log('Creating a new SQLite database...');
    sqliteDb = new SQL.Database();
  }
  
  // Run core migrations and create tables
  runMigrationsSQLite();
  // Create Change Data Capture triggers
  createLocalTriggers();
}

function saveToDisk() {
  if (sqliteDb && dbPath) {
    try {
      const data = sqliteDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('Failed to save SQLite database to disk:', err);
    }
  }
}

function sanitizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map(p => p === undefined ? null : p);
}

// Local Execution Unified APIs
async function queryAll(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  try {
    const stmt = sqliteDb.prepare(sql);
    stmt.bind(cleanParams);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('Local queryAll Error:', err, 'SQL:', sql);
    throw err;
  }
}

async function queryOne(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  try {
    const stmt = sqliteDb.prepare(sql);
    stmt.bind(cleanParams);
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  } catch (err) {
    console.error('Local queryOne Error:', err, 'SQL:', sql);
    throw err;
  }
}

async function runCommand(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  try {
    sqliteDb.run(sql, cleanParams);
    saveToDisk(); // Persist changes to disk immediately
    
    // Get last insert row ID
    const stmt = sqliteDb.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const insertId = stmt.getAsObject().id;
    stmt.free();

    return {
      changes: 1,
      insertId: insertId
    };
  } catch (err) {
    console.error('Local runCommand Error:', err, 'SQL:', sql);
    throw err;
  }
}

async function logAudit(userId, username, action, details = '') {
  try {
    await runCommand(
      'INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [userId, username, action, details]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

function runMigrationsSQLite() {
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      mobile_number TEXT PRIMARY KEY,
      name TEXT,
      gender TEXT,
      age INTEGER,
      weight REAL,
      height REAL,
      temperature REAL,
      chief_complaint TEXT,
      medical_history_json TEXT,
      total_paid REAL DEFAULT 0,
      visit_count INTEGER DEFAULT 0,
      follow_up_count INTEGER DEFAULT 0,
      average_waiting_time_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_mobile TEXT,
      companion_name TEXT,
      FOREIGN KEY(patient_mobile) REFERENCES patients(mobile_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medical_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT UNIQUE,
      category TEXT,
      description TEXT,
      price REAL,
      is_disabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_mobile TEXT,
      visit_type TEXT,
      status TEXT,
      chief_complaint TEXT,
      examination_notes TEXT,
      diagnosis TEXT,
      prescription_json TEXT,
      referral_json TEXT,
      weight REAL,
      height REAL,
      temperature REAL,
      follow_up_days INTEGER,
      follow_up_date TEXT,
      follow_up_expiry_date TEXT,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT,
      is_exception_followup INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY(patient_mobile) REFERENCES patients(mobile_number)
    );

    CREATE TABLE IF NOT EXISTS visit_services (
      visit_id INTEGER,
      service_id INTEGER,
      service_name TEXT,
      price REAL,
      PRIMARY KEY (visit_id, service_id),
      FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE,
      FOREIGN KEY(service_id) REFERENCES medical_services(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      role TEXT,
      base_salary REAL,
      bonus REAL DEFAULT 0,
      incentive REAL DEFAULT 0,
      commission_percentage REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      supplier TEXT,
      quantity INTEGER DEFAULT 0,
      min_level INTEGER DEFAULT 0,
      unit TEXT,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      is_disabled INTEGER DEFAULT 0,
      category TEXT,
      item_type TEXT DEFAULT "quantity",
      notes TEXT,
      usage_count INTEGER DEFAULT 0,
      billable INTEGER DEFAULT 0,
      barcode TEXT,
      qr_code TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_name TEXT,
      representative_name TEXT,
      maintenance_date TEXT,
      next_maintenance_date TEXT,
      cost REAL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      amount REAL,
      recipient_payer TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS examination_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      type TEXT,
      option_value TEXT
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NULL,
      category TEXT,
      patient_name TEXT,
      amount REAL,
      reason TEXT,
      user_responsible TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS external_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      name TEXT,
      address TEXT,
      phone TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      patient_name TEXT,
      partner_id INTEGER,
      partner_name TEXT,
      medications_json TEXT,
      supplies_json TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_username TEXT,
      sender_fullname TEXT,
      message_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_date TEXT,
      patient_name TEXT,
      patient_mobile TEXT,
      visit_id INTEGER,
      item_name TEXT,
      quantity_used REAL,
      user_responsible TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visit_inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      item_id INTEGER,
      item_name TEXT,
      quantity REAL,
      price REAL DEFAULT 0,
      billable INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS treasury_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opening_date TEXT,
      opening_time TEXT,
      opening_balance REAL,
      opening_user TEXT,
      closing_date TEXT,
      closing_time TEXT,
      closing_user TEXT,
      expected_closing_balance REAL,
      actual_closing_balance REAL,
      difference REAL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS treasury_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      treasury_session_id INTEGER,
      date TEXT,
      time TEXT,
      type TEXT,
      amount REAL,
      description TEXT,
      related_patient_mobile TEXT,
      related_visit_id INTEGER,
      user_responsible TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS treasury_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      treasury_transaction_id INTEGER,
      category TEXT,
      amount REAL,
      date TEXT,
      time TEXT,
      description TEXT,
      user_responsible TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_mobile TEXT,
      message_text TEXT,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      message TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run SQLite Alters in try-catch blocks
  const alterColumns = [
    'ALTER TABLE visits ADD COLUMN waiting_time_seconds INTEGER DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN consultation_start_time TEXT',
    'ALTER TABLE visits ADD COLUMN consultation_end_time TEXT',
    'ALTER TABLE visits ADD COLUMN consultation_duration_seconds INTEGER DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN satisfaction_status TEXT',
    'ALTER TABLE visits ADD COLUMN change_amount REAL DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN remaining_amount REAL DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN payment_date TEXT',
    'ALTER TABLE visits ADD COLUMN payment_time TEXT',
    'ALTER TABLE visits ADD COLUMN payment_user TEXT',
    'ALTER TABLE companions ADD COLUMN age INTEGER',
    'ALTER TABLE companions ADD COLUMN chief_complaint TEXT',
    'ALTER TABLE patients ADD COLUMN parent_mobile TEXT',
    'ALTER TABLE patients ADD COLUMN is_companion INTEGER DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN is_resumed INTEGER DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN diagnosis_after TEXT',
    'ALTER TABLE patients ADD COLUMN average_waiting_time_seconds INTEGER DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN username TEXT',
    'ALTER TABLE employees ADD COLUMN salary_day INTEGER DEFAULT 30',
    'ALTER TABLE employees ADD COLUMN last_paid_month TEXT',
    'ALTER TABLE visits ADD COLUMN inventory_deducted INTEGER DEFAULT 0',
    'ALTER TABLE inventory_items ADD COLUMN category TEXT',
    'ALTER TABLE inventory_items ADD COLUMN item_type TEXT DEFAULT "quantity"',
    'ALTER TABLE inventory_items ADD COLUMN notes TEXT',
    'ALTER TABLE inventory_items ADD COLUMN usage_count INTEGER DEFAULT 0',
    'ALTER TABLE inventory_items ADD COLUMN billable INTEGER DEFAULT 0',
    'ALTER TABLE inventory_items ADD COLUMN barcode TEXT',
    'ALTER TABLE inventory_items ADD COLUMN qr_code TEXT',
    'ALTER TABLE patients ADD COLUMN file_number TEXT',
    'ALTER TABLE patients ADD COLUMN registration_date TEXT',
    'ALTER TABLE patients ADD COLUMN registration_time TEXT',
    'ALTER TABLE patients ADD COLUMN whatsapp_enabled INTEGER DEFAULT 1'
  ];
  for (const sql of alterColumns) {
    try { sqliteDb.run(sql); } catch (e) { /* ignore */ }
  }

  // Create patient index
  try {
    sqliteDb.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_file_number ON patients(file_number)');
  } catch (e) { /* ignore */ }

  // Ensure updated_at exists on all replication tables for Latest Wins conflict resolution
  const tablesToVersion = [
    'settings', 'users', 'patients', 'companions', 'medical_services', 'visits',
    'visit_services', 'employees', 'inventory_items', 'maintenance_records',
    'vouchers', 'audit_logs', 'examination_templates', 'refunds', 'external_partners',
    'referrals', 'chat_messages', 'inventory_transactions', 'visit_inventory_items',
    'treasury_sessions', 'treasury_transactions', 'treasury_expenses', 'whatsapp_logs', 'notifications', 'reports'
  ];
  for (const t of tablesToVersion) {
    try {
      sqliteDb.run(`ALTER TABLE ${t} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    } catch(e) { /* ignore */ }
  }

  saveToDisk();
  console.log('SQLite Local Migrations completed.');
}

function createLocalTriggers() {
  console.log('Installing Outbox Triggers for Bidirectional Change Data Capture (CDC)...');
  
  const triggerMappings = {
    settings: 'key',
    users: 'id',
    patients: 'mobile_number',
    companions: 'id',
    medical_services: 'id',
    visits: 'id',
    visit_services: 'visit_id', // Simplify compound trigger tracking by referencing parent
    employees: 'id',
    inventory_items: 'id',
    maintenance_records: 'id',
    vouchers: 'id',
    audit_logs: 'id',
    examination_templates: 'id',
    refunds: 'id',
    external_partners: 'id',
    referrals: 'id',
    chat_messages: 'id',
    inventory_transactions: 'id',
    visit_inventory_items: 'id',
    treasury_sessions: 'id',
    treasury_transactions: 'id',
    treasury_expenses: 'id',
    whatsapp_logs: 'id',
    notifications: 'id',
    reports: 'id'
  };

  // 1. Create Pending Sync Outbox Queue table
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS pending_sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Iterate and deploy triggers on all tables
  for (const [table, keyExpr] of Object.entries(triggerMappings)) {
    try {
      sqliteDb.run(`DROP TRIGGER IF EXISTS trg_${table}_insert;`);
      sqliteDb.run(`DROP TRIGGER IF EXISTS trg_${table}_update;`);
      sqliteDb.run(`DROP TRIGGER IF EXISTS trg_${table}_delete;`);
      sqliteDb.run(`DROP TRIGGER IF EXISTS trg_${table}_timestamp;`);

      // A. Insert Trigger
      sqliteDb.run(`
        CREATE TRIGGER trg_${table}_insert AFTER INSERT ON ${table}
        BEGIN
          INSERT INTO pending_sync_queue (table_name, action, record_id)
          VALUES ('${table}', 'INSERT', CAST(new.${keyExpr} AS TEXT));
        END;
      `);

      // B. Combined Update Trigger (Updates timestamp and logs change in a single trigger)
      sqliteDb.run(`
        CREATE TRIGGER trg_${table}_update AFTER UPDATE ON ${table}
        FOR EACH ROW
        WHEN (new.updated_at IS NULL OR new.updated_at = old.updated_at)
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE ${keyExpr} = new.${keyExpr};
          INSERT INTO pending_sync_queue (table_name, action, record_id)
          VALUES ('${table}', 'UPDATE', CAST(new.${keyExpr} AS TEXT));
        END;
      `);

      // D. Delete Trigger
      sqliteDb.run(`
        CREATE TRIGGER trg_${table}_delete AFTER DELETE ON ${table}
        BEGIN
          INSERT INTO pending_sync_queue (table_name, action, record_id)
          VALUES ('${table}', 'DELETE', CAST(old.${keyExpr} AS TEXT));
        END;
      `);
    } catch(err) {
      console.error(`Failed to create triggers on table ${table}:`, err);
    }
  }

  saveToDisk();
  console.log('Outbox CDC Triggers successfully deployed.');
}

module.exports = {
  initDatabase,
  queryAll,
  queryOne,
  runCommand,
  logAudit,
  getDbType: () => dbType,
  getDbPath: () => dbPath
};
