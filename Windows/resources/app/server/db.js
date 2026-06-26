const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

let sqliteDb = null;
let mysqlPool = null;
let pgPool = null;
let dbType = 'sqlite';
let dbPath = '';
let clinicUserId = null;

function runWithUser(userId, callback) {
  asyncLocalStorage.run({ userId }, callback);
}

function getRequestUserId() {
  const store = asyncLocalStorage.getStore();
  return store ? store.userId : null;
}

async function initDatabase() {
  dbType = process.env.DB_TYPE || 'sqlite';
  console.log(`Initializing database of type: ${dbType}`);

  if (dbType === 'sqlite') {
    // Determine data directory (AppData in packaged Electron, current dir in dev/terminal)
    const dataDir = process.env.USER_DATA_PATH || __dirname;
    dbPath = path.join(dataDir, 'clinic.db');
    console.log(`SQLite Database Path: ${dbPath}`);
    
    // Ensure directory exists
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
      console.log('Creating a new SQLite database in memory...');
      sqliteDb = new SQL.Database();
    }
    
    runMigrationsSQLite();
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    const { Pool } = require('pg');
    mysqlPool = null;
    sqliteDb = null;

    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('PostgreSQL Pool initialized');

    // Test connection and run setup
    const client = await pgPool.connect();
    try {
      const clinicId = process.env.CLINIC_ID;
      if (clinicId) {
        console.log(`Resolving clinicUserId for clinic: ${clinicId}`);
        const res = await client.query(
          `SELECT id FROM profiles WHERE clinic_id = $1 AND role = 'admin' LIMIT 1`,
          [clinicId]
        );
        if (res.rows && res.rows[0]) {
          clinicUserId = res.rows[0].id;
          console.log(`Resolved clinicUserId: ${clinicUserId}`);
        } else {
          console.warn(`Warning: Admin profile not found for clinic ${clinicId}`);
        }
      } else {
        console.log('Database running in multi-tenant mode (no static CLINIC_ID set).');
      }

      await configurePostgresDefaults(client);
    } catch (e) {
      console.error('Error during PostgreSQL database init hooks:', e);
    } finally {
      client.release();
    }
  } else {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'clinic_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    await runMigrationsMySQL();
  }

  // Pre-populate missing file numbers for existing patients
  if (dbType === 'sqlite' || dbType === 'mysql') {
    await populatePatientFiles();
  }
}

async function configurePostgresDefaults(client) {
  const tables = [
    'profiles', 'subscriptions', 'settings', 'patients', 'companions', 
    'medical_services', 'visits', 'visit_services', 'employees', 'inventory_items', 
    'maintenance_records', 'vouchers', 'audit_logs', 'examination_templates', 
    'refunds', 'external_partners', 'referrals', 'chat_messages', 
    'inventory_transactions', 'visit_inventory_items', 'treasury_sessions', 
    'treasury_transactions', 'treasury_expenses', 'whatsapp_logs', 
    'notifications', 'reports'
  ];
  console.log('Configuring PostgreSQL defaults for clinic_id column...');
  for (const table of tables) {
    try {
      await client.query(`ALTER TABLE "${table}" ALTER COLUMN clinic_id SET DEFAULT get_user_clinic_id()`);
    } catch (e) {
      console.warn(`Failed to alter table ${table} defaults: ${e.message}`);
    }
  }
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

// Migration helper: populate sequential file numbers PAT-XXXXXX
async function populatePatientFiles() {
  try {
    const rows = await queryAll("SELECT mobile_number, created_at FROM patients WHERE file_number IS NULL OR file_number = '' ORDER BY created_at ASC");
    if (rows.length === 0) return;

    console.log(`Populating file numbers for ${rows.length} existing patient(s)...`);

    // Find the current highest patient file number prefix index
    const maxRow = await queryOne("SELECT file_number FROM patients WHERE file_number LIKE 'PAT-%' ORDER BY file_number DESC LIMIT 1");
    let currentIdx = 0;
    if (maxRow && maxRow.file_number) {
      const match = maxRow.file_number.match(/PAT-(\d+)/);
      if (match) {
        currentIdx = parseInt(match[1]);
      }
    }

    for (const r of rows) {
      currentIdx++;
      const fileNumber = 'PAT-' + String(currentIdx).padStart(6, '0');
      
      const dateVal = parseDbDate(r.created_at);
      const regDate = dateVal.toISOString().split('T')[0];
      const regTime = dateVal.toTimeString().split(' ')[0];

      await runCommand(
        "UPDATE patients SET file_number = ?, registration_date = ?, registration_time = ? WHERE mobile_number = ?",
        [fileNumber, regDate, regTime, r.mobile_number]
      );
    }
    console.log('Patient pre-population migration completed successfully.');
  } catch (err) {
    console.error('Failed to pre-populate patient file numbers:', err);
  }
}

// Save in-memory SQLite to disk file
function saveToDisk() {
  if (dbType === 'sqlite' && sqliteDb && dbPath) {
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

// Translation helper: Converts SQLite/MySQL SQL parameters and syntax to Postgres
function translateSqlToPostgres(sql) {
  let translated = sql;

  // Replace backticks with double quotes
  translated = translated.replace(/`/g, '"');

  // Replace SQLite INSERT OR IGNORE / INSERT OR REPLACE
  translated = translated.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  translated = translated.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
  if (sql.includes('INSERT OR IGNORE INTO') || sql.includes('INSERT OR REPLACE INTO')) {
    if (!translated.toLowerCase().includes('on conflict')) {
      if (translated.includes('visit_services')) {
        translated += ' ON CONFLICT (visit_id, service_id) DO NOTHING';
      } else if (translated.includes('settings')) {
        if (sql.includes('INSERT OR REPLACE INTO')) {
          translated += ' ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value';
        } else {
          translated += ' ON CONFLICT (clinic_id, key) DO NOTHING';
        }
      } else {
        translated += ' ON CONFLICT DO NOTHING';
      }
    }
  }

  // Replace SQLite/MySQL '?' placeholder with Postgres '$1, $2'
  let index = 1;
  translated = translated.replace(/\?/g, () => `$${index++}`);

  return translated;
}

// Unified Query APIs
async function queryAll(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  if (dbType === 'sqlite') {
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
      console.error('SQLite queryAll Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    }
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const activeUserId = getRequestUserId() || clinicUserId;
      if (activeUserId) {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [activeUserId]);
        await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
        await client.query(`SET LOCAL ROLE authenticated`);
      }
      const pgSql = translateSqlToPostgres(sql);
      const result = await client.query(pgSql, cleanParams);
      await client.query('COMMIT');
      return result.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Postgres queryAll Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    } finally {
      client.release();
    }
  } else {
    const [rows] = await mysqlPool.execute(sql, cleanParams);
    return rows;
  }
}

async function queryOne(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  if (dbType === 'sqlite') {
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
      console.error('SQLite queryOne Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    }
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const activeUserId = getRequestUserId() || clinicUserId;
      if (activeUserId) {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [activeUserId]);
        await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
        await client.query(`SET LOCAL ROLE authenticated`);
      }
      const pgSql = translateSqlToPostgres(sql);
      const result = await client.query(pgSql, cleanParams);
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Postgres queryOne Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    } finally {
      client.release();
    }
  } else {
    const [rows] = await mysqlPool.execute(sql, cleanParams);
    return rows[0] || null;
  }
}

async function runCommand(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  if (dbType === 'sqlite') {
    try {
      sqliteDb.run(sql, cleanParams);
      saveToDisk(); // Persist changes to disk file immediately
      
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
      console.error('SQLite runCommand Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    }
  } else if (dbType === 'postgres' || dbType === 'postgresql') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const activeUserId = getRequestUserId() || clinicUserId;
      if (activeUserId) {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [activeUserId]);
        await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
        await client.query(`SET LOCAL ROLE authenticated`);
      }
      const pgSql = translateSqlToPostgres(sql);
      let finalSql = pgSql;
      if (pgSql.trim().toUpperCase().startsWith('INSERT INTO')) {
        if (!pgSql.toUpperCase().includes('RETURNING')) {
          const match = pgSql.match(/INSERT\s+INTO\s+["']?([a-zA-Z0-9_]+)["']?/i);
          const tableName = match ? match[1].toLowerCase() : '';
          const noIdTables = ['patients', 'settings', 'visit_services'];
          if (noIdTables.includes(tableName)) {
            finalSql = pgSql.trim().replace(/;?$/, ' RETURNING *');
          } else {
            finalSql = pgSql.trim().replace(/;?$/, ' RETURNING id');
          }
        }
      }
      const result = await client.query(finalSql, cleanParams);
      await client.query('COMMIT');
      return {
        changes: result.rowCount || 0,
        insertId: result.rows[0]?.id || null
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Postgres runCommand Error:', err, 'SQL:', sql, 'Params:', cleanParams);
      throw err;
    } finally {
      client.release();
    }
  } else {
    const [result] = await mysqlPool.execute(sql, cleanParams);
    return {
      changes: result.affectedRows,
      insertId: result.insertId
    };
  }
}

// Log audit trail
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    -- New Tables for Advanced medical ERP updates
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(treasury_session_id) REFERENCES treasury_sessions(id) ON DELETE SET NULL
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(treasury_transaction_id) REFERENCES treasury_transactions(id) ON DELETE SET NULL
    );

    -- Pre-seed default Administrator (password: admin)
    INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name) 
    VALUES (1, 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin', 'مدير النظام الافتراضي');

    -- Pre-seed default settings to bypass Setup Wizard
    INSERT OR IGNORE INTO settings (key, value) VALUES ('clinicName', 'العيادة الطبية التخصصية');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('doctorName', 'أحمد ياسر');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('doctorSpecialty', 'القلب والأوعية الدموية');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('doctorTitle', 'استشاري أمراض القلب والأوعية');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('clinicAddress', 'القاهرة، مصر');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('clinicPhones', '01012345678');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('useInventory', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('companionAgeThreshold', '12');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('companionConsultationFee', '100');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('companionFollowupFee', '50');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('enableVitalsGlobal', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('enableVitalsReception', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('enableVitalsDoctor', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('diagnosisTiming', 'before_and_after');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('customVitalsList', '[{"id":"weight","nameAr":"الوزن","nameEn":"Weight","unit":"kg"},{"id":"height","nameAr":"الطول","nameEn":"Height","unit":"cm"},{"id":"temp","nameAr":"الحرارة","nameEn":"Temperature","unit":"°C"}]');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('customChronicDiseases', '["السكري / Diabetes", "ضغط الدم / Hypertension", "أمراض القلب / Heart Disease", "حساسية الصدر / Asthma"]');

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date TEXT,
      log_time TEXT,
      patient_name TEXT,
      phone_number TEXT,
      message_type TEXT,
      message_text TEXT,
      delivery_status TEXT,
      error_details TEXT,
      user_responsible TEXT,
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
    'ALTER TABLE patients ADD COLUMN whatsapp_enabled INTEGER DEFAULT 1',
    'ALTER TABLE visits ADD COLUMN followup_reminder_sent INTEGER DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN vitals_json TEXT',
    'ALTER TABLE patients ADD COLUMN vitals_json TEXT',
    'ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE patients ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE companions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE medical_services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE visits ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE visit_services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE employees ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE inventory_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE maintenance_records ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE vouchers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE audit_logs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE examination_templates ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE refunds ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE external_partners ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE referrals ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE chat_messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE inventory_transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE visit_inventory_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE treasury_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE treasury_transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE treasury_expenses ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE whatsapp_logs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE notifications ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE reports ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
  ];
  for (const sql of alterColumns) {
    try {
      sqliteDb.run(sql);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  // Create SQLite update triggers to auto-update updated_at on change
  const tablesToTrigger = [
    { name: 'settings', pk: 'key' },
    { name: 'users', pk: 'id' },
    { name: 'patients', pk: 'mobile_number' },
    { name: 'companions', pk: 'id' },
    { name: 'medical_services', pk: 'id' },
    { name: 'visits', pk: 'id' },
    { name: 'visit_services', pk: 'visit_id' },
    { name: 'employees', pk: 'id' },
    { name: 'inventory_items', pk: 'id' },
    { name: 'maintenance_records', pk: 'id' },
    { name: 'vouchers', pk: 'id' },
    { name: 'audit_logs', pk: 'id' },
    { name: 'examination_templates', pk: 'id' },
    { name: 'refunds', pk: 'id' },
    { name: 'external_partners', pk: 'id' },
    { name: 'referrals', pk: 'id' },
    { name: 'chat_messages', pk: 'id' },
    { name: 'inventory_transactions', pk: 'id' },
    { name: 'visit_inventory_items', pk: 'id' },
    { name: 'treasury_sessions', pk: 'id' },
    { name: 'treasury_transactions', pk: 'id' },
    { name: 'treasury_expenses', pk: 'id' },
    { name: 'whatsapp_logs', pk: 'id' },
    { name: 'notifications', pk: 'id' },
    { name: 'reports', pk: 'id' }
  ];
  for (const t of tablesToTrigger) {
    try {
      sqliteDb.run(`
        CREATE TRIGGER IF NOT EXISTS trg_update_timestamp_${t.name}
        AFTER UPDATE ON "${t.name}"
        FOR EACH ROW
        WHEN NEW.updated_at IS OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE "${t.name}" SET updated_at = CURRENT_TIMESTAMP WHERE "${t.pk}" = NEW."${t.pk}";
        END;
      `);
    } catch (e) {
      // Ignore trigger creation error
    }
  }

  try {
    sqliteDb.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_file_number ON patients(file_number)');
  } catch (e) {
    // Ignore index exists
  }

  saveToDisk();
  console.log('SQLite Migrations completed via sql.js Wasm.');
}

async function runMigrationsMySQL() {
  const conn = await mysqlPool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(50),
        full_name VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS patients (
        mobile_number VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        gender VARCHAR(50),
        age INT,
        weight DOUBLE NULL,
        height DOUBLE NULL,
        temperature DOUBLE NULL,
        chief_complaint TEXT NULL,
        medical_history_json TEXT NULL,
        total_paid DOUBLE DEFAULT 0,
        visit_count INT DEFAULT 0,
        follow_up_count INT DEFAULT 0,
        average_waiting_time_seconds INT DEFAULT 0,
        file_number VARCHAR(100) UNIQUE NULL,
        registration_date VARCHAR(50) NULL,
        registration_time VARCHAR(50) NULL,
        whatsapp_enabled INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS companions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_mobile VARCHAR(100),
        companion_name VARCHAR(255),
        FOREIGN KEY(patient_mobile) REFERENCES patients(mobile_number) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS medical_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_name VARCHAR(255) UNIQUE,
        category VARCHAR(255),
        description TEXT NULL,
        price DOUBLE,
        is_disabled INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_mobile VARCHAR(100),
        visit_type VARCHAR(50),
        status VARCHAR(50),
        chief_complaint TEXT NULL,
        examination_notes TEXT NULL,
        diagnosis TEXT NULL,
        prescription_json TEXT NULL,
        referral_json TEXT NULL,
        weight DOUBLE NULL,
        height DOUBLE NULL,
        temperature DOUBLE NULL,
        follow_up_days INT NULL,
        follow_up_date VARCHAR(50) NULL,
        follow_up_expiry_date VARCHAR(50) NULL,
        paid_amount DOUBLE DEFAULT 0,
        payment_status VARCHAR(50),
        is_exception_followup INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        FOREIGN KEY(patient_mobile) REFERENCES patients(mobile_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS visit_services (
        visit_id INT,
        service_id INT,
        service_name VARCHAR(255),
        price DOUBLE,
        PRIMARY KEY (visit_id, service_id),
        FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE CASCADE,
        FOREIGN KEY(service_id) REFERENCES medical_services(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        role VARCHAR(255),
        base_salary DOUBLE,
        bonus DOUBLE DEFAULT 0,
        incentive DOUBLE DEFAULT 0,
        commission_percentage DOUBLE DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE,
        supplier VARCHAR(255) NULL,
        quantity INT DEFAULT 0,
        min_level INT DEFAULT 0,
        unit VARCHAR(50) NULL,
        cost_price DOUBLE DEFAULT 0,
        selling_price DOUBLE DEFAULT 0,
        is_disabled INT DEFAULT 0,
        category VARCHAR(255) NULL,
        item_type VARCHAR(100) DEFAULT 'quantity',
        notes TEXT NULL,
        usage_count INT DEFAULT 0,
        billable INT DEFAULT 0,
        barcode VARCHAR(100) NULL,
        qr_code VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_name VARCHAR(255),
        representative_name VARCHAR(255) NULL,
        maintenance_date VARCHAR(50),
        next_maintenance_date VARCHAR(50),
        cost DOUBLE DEFAULT 0,
        notes TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50),
        amount DOUBLE,
        recipient_payer VARCHAR(255),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        username VARCHAR(255),
        action VARCHAR(255),
        details TEXT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // New Tables for Advanced medical ERP updates (MySQL)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS examination_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(255),
        type VARCHAR(255),
        option_value TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT NULL,
        category VARCHAR(255),
        patient_name VARCHAR(255),
        amount DOUBLE,
        reason TEXT,
        user_responsible VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS external_partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(255),
        name VARCHAR(255),
        address VARCHAR(255),
        phone VARCHAR(255),
        notes TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT,
        patient_name VARCHAR(255),
        partner_id INT,
        partner_name VARCHAR(255),
        medications_json TEXT NULL,
        supplies_json TEXT NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_username VARCHAR(255),
        sender_fullname VARCHAR(255),
        message_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_date VARCHAR(50),
        patient_name VARCHAR(255) NULL,
        patient_mobile VARCHAR(100) NULL,
        visit_id INT NULL,
        item_name VARCHAR(255),
        quantity_used DOUBLE,
        user_responsible VARCHAR(255),
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS visit_inventory_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_id INT,
        item_id INT,
        item_name VARCHAR(255),
        quantity DOUBLE,
        price DOUBLE DEFAULT 0,
        billable INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_date VARCHAR(50),
        log_time VARCHAR(50),
        patient_name VARCHAR(255),
        phone_number VARCHAR(100),
        message_type VARCHAR(100),
        message_text TEXT,
        delivery_status VARCHAR(50),
        error_details TEXT,
        user_responsible VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS treasury_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        opening_date VARCHAR(50),
        opening_time VARCHAR(50),
        opening_balance DOUBLE,
        opening_user VARCHAR(255),
        closing_date VARCHAR(50) NULL,
        closing_time VARCHAR(50) NULL,
        closing_user VARCHAR(255) NULL,
        expected_closing_balance DOUBLE NULL,
        actual_closing_balance DOUBLE NULL,
        difference DOUBLE NULL,
        status VARCHAR(50) DEFAULT 'open',
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS treasury_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        treasury_session_id INT NULL,
        date VARCHAR(50),
        time VARCHAR(50),
        type VARCHAR(50),
        amount DOUBLE,
        description TEXT,
        related_patient_mobile VARCHAR(100) NULL,
        related_visit_id INT NULL,
        user_responsible VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(treasury_session_id) REFERENCES treasury_sessions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS treasury_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        treasury_transaction_id INT NULL,
        category VARCHAR(255),
        amount DOUBLE,
        date VARCHAR(50),
        time VARCHAR(50),
        description TEXT,
        user_responsible VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(treasury_transaction_id) REFERENCES treasury_transactions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Run MySQL Alters in try-catch blocks
    const mysqlAlters = [
      'ALTER TABLE visits ADD COLUMN waiting_time_seconds INT DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN consultation_start_time VARCHAR(100) NULL',
      'ALTER TABLE visits ADD COLUMN consultation_end_time VARCHAR(100) NULL',
      'ALTER TABLE visits ADD COLUMN consultation_duration_seconds INT DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN satisfaction_status VARCHAR(100) NULL',
      'ALTER TABLE visits ADD COLUMN change_amount DOUBLE DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN remaining_amount DOUBLE DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN payment_date VARCHAR(50) NULL',
      'ALTER TABLE visits ADD COLUMN payment_time VARCHAR(50) NULL',
      'ALTER TABLE visits ADD COLUMN payment_user VARCHAR(255) NULL',
      'ALTER TABLE companions ADD COLUMN age INT NULL',
      'ALTER TABLE companions ADD COLUMN chief_complaint TEXT NULL',
      'ALTER TABLE patients ADD COLUMN parent_mobile VARCHAR(100) NULL',
      'ALTER TABLE patients ADD COLUMN is_companion INT DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN is_resumed INT DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN diagnosis_after TEXT NULL',
      'ALTER TABLE patients ADD COLUMN average_waiting_time_seconds INT DEFAULT 0',
      'ALTER TABLE employees ADD COLUMN username VARCHAR(255) NULL',
      'ALTER TABLE employees ADD COLUMN salary_day INT DEFAULT 30',
      'ALTER TABLE employees ADD COLUMN last_paid_month VARCHAR(50) NULL',
      'ALTER TABLE visits ADD COLUMN inventory_deducted INT DEFAULT 0',
      'ALTER TABLE inventory_items ADD COLUMN category VARCHAR(255) NULL',
      'ALTER TABLE inventory_items ADD COLUMN item_type VARCHAR(100) DEFAULT \'quantity\'',
      'ALTER TABLE inventory_items ADD COLUMN notes TEXT NULL',
      'ALTER TABLE inventory_items ADD COLUMN usage_count INT DEFAULT 0',
      'ALTER TABLE inventory_items ADD COLUMN billable INT DEFAULT 0',
      'ALTER TABLE inventory_items ADD COLUMN barcode VARCHAR(100) NULL',
      'ALTER TABLE inventory_items ADD COLUMN qr_code VARCHAR(100) NULL',
      'ALTER TABLE patients ADD COLUMN file_number VARCHAR(100) UNIQUE NULL',
      'ALTER TABLE patients ADD COLUMN registration_date VARCHAR(50) NULL',
      'ALTER TABLE patients ADD COLUMN registration_time VARCHAR(50) NULL',
      'ALTER TABLE visits ADD COLUMN followup_reminder_sent INT DEFAULT 0',
      'ALTER TABLE visits ADD COLUMN vitals_json TEXT NULL',
      'ALTER TABLE patients ADD COLUMN vitals_json TEXT NULL',
      'ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE patients ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE companions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE medical_services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE visits ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE visit_services ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE employees ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE inventory_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE maintenance_records ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE vouchers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE audit_logs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE examination_templates ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE refunds ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE external_partners ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE referrals ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE chat_messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE inventory_transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE visit_inventory_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE treasury_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE treasury_transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE treasury_expenses ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE whatsapp_logs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE notifications ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'ALTER TABLE reports ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
    ];
    for (const sql of mysqlAlters) {
      try {
        await conn.query(sql);
      } catch (e) {
        // Column already exists
      }
    }

    // Pre-seed default Administrator (password: admin) for MySQL
    await conn.query(`
      INSERT IGNORE INTO users (id, username, password_hash, role, full_name) 
      VALUES (1, 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin', 'مدير النظام الافتراضي')
    `);

    console.log('MySQL Migrations completed.');
  } catch (err) {
    console.error('MySQL Migration Error:', err);
  } finally {
    conn.release();
  }
}

module.exports = {
  initDatabase,
  queryAll,
  queryOne,
  runCommand,
  logAudit,
  getDbType: () => dbType,
  getDbPath: () => dbPath,
  runWithUser,
  getRequestUserId,
  getClinicUserId: () => clinicUserId
};
