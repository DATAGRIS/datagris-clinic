const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

// Request-scoped storage for multi-tenant RLS context tracking
const asyncLocalStorage = new AsyncLocalStorage();

let pool = null;
let dbType = 'postgres';
let dbPath = ''; // Not used for postgres but kept for compatibility
let currentClinicUserId = null;

// Store the logged-in user's JWT in global memory (original behavior)
global.userJwt = null;

function getClinicId() {
  if (process.env.CLINIC_ID) return process.env.CLINIC_ID;
  try {
    const dataDir = process.env.USER_DATA_PATH || path.join(__dirname, '..');
    const configPath = path.join(dataDir, 'clinic_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.clinicId;
    }
  } catch (e) {
    console.error('Error reading clinic_config.json:', e);
  }
  return 'CLN-000001'; // Default fallback clinic ID
}

async function initDatabase() {
  dbType = 'postgres';
  console.log(`Initializing PostgreSQL database connection pool for Cloud Hosting...`);

  let connectionString = process.env.DATABASE_URL;

  // If no environment variable, try loading from billing/.env.local (development local fallback)
  if (!connectionString) {
    try {
      const envPath = path.join(__dirname, '../../../../billing/.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
        if (dbUrlLine) {
          connectionString = dbUrlLine.replace('DATABASE_URL=', '').replace(/"/g, '').trim();
        }
      }
    } catch (e) {
      console.error('Could not load DATABASE_URL from fallback billing env file:', e);
    }
  }

  // Final fallback if everything else fails
  if (!connectionString) {
    connectionString = "postgresql://postgres.whfegxabypqkvnmfwfqj:linic06062026%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Verify connection and resolve default clinic user context
  const client = await pool.connect();
  try {
    console.log('Successfully connected to Supabase PostgreSQL database.');
    const clinicId = getClinicId();
    const res = await client.query('SELECT id FROM profiles WHERE clinic_id = $1 LIMIT 1', [clinicId]);
    if (res.rows.length > 0) {
      currentClinicUserId = res.rows[0].id;
      console.log(`RLS Context: Resolved clinic ID ${clinicId} to default admin user UUID: ${currentClinicUserId}`);
    } else {
      console.warn(`RLS Context WARNING: No profiles found for clinic ${clinicId}`);
    }
  } catch (err) {
    console.error('Failed to run init queries on PostgreSQL database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Translate SQLite queries to PostgreSQL dialect
function translateSqlToPostgres(sql) {
  let translated = sql;

  // 1. Replace backticks with double quotes for PostgreSQL identifiers
  translated = translated.replace(/`/g, '"');

  // 2. Map SQLite table 'users' references to PostgreSQL 'profiles' table
  translated = translated.replace(/\busers\b/g, 'profiles');
  translated = translated.replace(/\b"users"\b/g, '"profiles"');

  // 3. Translate SQLite INSERT OR IGNORE / INSERT OR REPLACE
  translated = translated.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  if (sql.includes('INSERT OR IGNORE INTO')) {
    if (!translated.toLowerCase().includes('on conflict')) {
      if (translated.includes('visit_services')) {
        translated += ' ON CONFLICT (visit_id, service_id) DO NOTHING';
      } else {
        translated += ' ON CONFLICT DO NOTHING';
      }
    }
  }

  if (translated.includes('INSERT OR REPLACE INTO')) {
    translated = translated.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
    if (translated.includes('settings')) {
      translated += ' ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value';
    } else if (translated.includes('patients')) {
      translated += ' ON CONFLICT (mobile_number) DO UPDATE SET name = EXCLUDED.name, age = EXCLUDED.age, chief_complaint = EXCLUDED.chief_complaint';
    }
  }

  // 4. Translate MySQL ON DUPLICATE KEY UPDATE to PG ON CONFLICT
  if (translated.toLowerCase().includes('on duplicate key update')) {
    translated = translated.replace(/on duplicate key update[\s\S]+/gi, (match) => {
      return match
        .replace(/VALUES\(([^)]+)\)/gi, 'EXCLUDED.$1')
        .replace(/on duplicate key update/gi, 'ON CONFLICT (mobile_number) DO UPDATE');
    });
  }

  // 5. Replace '?' parameter placeholders with positional parameters '$1', '$2', etc.
  let index = 1;
  translated = translated.replace(/\?/g, () => `$${index++}`);

  // 6. Append 'RETURNING id' to INSERT statements for tables that use autoincrement serial IDs.
  // This satisfies the Express routes relying on result.insertId.
  const trimmed = translated.trim().toUpperCase();
  if (trimmed.startsWith('INSERT')) {
    if (!trimmed.includes('RETURNING') && 
        !trimmed.includes('SETTINGS') && 
        !trimmed.includes('PATIENTS') && 
        !trimmed.includes('VISIT_SERVICES')) {
      translated += ' RETURNING id';
    }
  }

  return translated;
}

function sanitizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map(p => p === undefined ? null : p);
}

// Retrieve the active request-scoped or global user UUID to enforce RLS
function getActiveUserId() {
  const store = asyncLocalStorage.getStore();
  if (store && store.userId) {
    return store.userId;
  }
  
  if (global.userJwt) {
    try {
      const decoded = jwt.decode(global.userJwt);
      if (decoded && decoded.sub) {
        return decoded.sub;
      }
    } catch (e) {
      console.error('Error decoding global userJwt:', e);
    }
  }

  return currentClinicUserId;
}

async function queryAll(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  const pgSql = translateSqlToPostgres(sql);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = getActiveUserId();
    if (userId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    }

    const result = await client.query(pgSql, cleanParams);
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL queryAll Error:', err, 'SQL:', sql, 'Translated:', pgSql);
    throw err;
  } finally {
    client.release();
  }
}

async function queryOne(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  const pgSql = translateSqlToPostgres(sql);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = getActiveUserId();
    if (userId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    }

    const result = await client.query(pgSql, cleanParams);
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL queryOne Error:', err, 'SQL:', sql, 'Translated:', pgSql);
    throw err;
  } finally {
    client.release();
  }
}

async function runCommand(sql, params = []) {
  const cleanParams = sanitizeParams(params);
  const pgSql = translateSqlToPostgres(sql);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId = getActiveUserId();
    if (userId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    }

    const result = await client.query(pgSql, cleanParams);
    await client.query('COMMIT');

    let insertId = null;
    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
      insertId = result.rows[0].id;
    }

    return {
      changes: result.rowCount || 0,
      insertId: insertId
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL runCommand Error:', err, 'SQL:', sql, 'Translated:', pgSql);
    throw err;
  } finally {
    client.release();
  }
}

async function logAudit(userId, username, action, details = '') {
  try {
    let resolvedUserId = userId;
    // Map simple integer local audit userId like 1 to the actual UUID if possible
    if (userId === 1 || userId === '1' || !userId) {
      resolvedUserId = getActiveUserId();
    }
    
    await runCommand(
      'INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [resolvedUserId, username, action, details]
    );
  } catch (err) {
    console.error('Audit log failed in PostgreSQL:', err);
  }
}

module.exports = {
  initDatabase,
  queryAll,
  queryOne,
  runCommand,
  logAudit,
  asyncLocalStorage,
  getDbType: () => dbType,
  getDbPath: () => dbPath
};
