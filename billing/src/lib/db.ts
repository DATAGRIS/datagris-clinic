import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Translation helper: Converts SQLite/MySQL SQL parameters and syntax to Postgres
export function translateSqlToPostgres(sql: string): string {
  let translated = sql;

  // Replace backticks with double quotes
  translated = translated.replace(/`/g, '"');

  // Replace SQLite INSERT OR IGNORE / INSERT OR REPLACE
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

  // Replace MySQL ON DUPLICATE KEY UPDATE
  if (translated.toLowerCase().includes('on duplicate key update')) {
    translated = translated.replace(/on duplicate key update[\s\S]+/gi, (match) => {
      return match
        .replace(/VALUES\(([^)]+)\)/gi, 'EXCLUDED.$1')
        .replace(/on duplicate key update/gi, 'ON CONFLICT (mobile_number) DO UPDATE');
    });
  }

  // Replace SQLite/MySQL '?' placeholder with Postgres '$1, $2'
  let index = 1;
  translated = translated.replace(/\?/g, () => `$${index++}`);

  return translated;
}

// RLS safe executor
export async function executeQueryWithRls(
  userId: string,
  sql: string,
  params: any[],
  method: 'all' | 'one' | 'run'
) {
  const pgSql = translateSqlToPostgres(sql);
  const client = await pool.connect();
  
  try {
    // Start transaction to bundle set_config and query together locally
    await client.query('BEGIN');
    
    // Set RLS variables in session context
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    
    const result = await client.query(pgSql, params);
    await client.query('COMMIT');

    if (method === 'one') {
      return result.rows[0] || null;
    } else if (method === 'run') {
      // Returns format expected by runCommand: { changes: count, insertId: id }
      return {
        changes: result.rowCount || 0,
        insertId: result.rows[0]?.id || null
      };
    } else {
      return result.rows;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database query execution error under RLS context:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Admin / Service executor (bypasses RLS - used for auth/registration tasks)
export async function executeQueryAsAdmin(
  sql: string,
  params: any[],
  method: 'all' | 'one' | 'run'
) {
  const pgSql = translateSqlToPostgres(sql);
  const result = await pool.query(pgSql, params);

  if (method === 'one') {
    return result.rows[0] || null;
  } else if (method === 'run') {
    return {
      changes: result.rowCount || 0,
      insertId: result.rows[0]?.id || null
    };
  } else {
    return result.rows;
  }
}
