const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read the DATABASE_URL from billing/.env.local or environment variable
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  try {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
      if (dbUrlLine) {
        connectionString = dbUrlLine.replace('DATABASE_URL=', '').replace(/"/g, '').trim();
      }
    }
  } catch (e) {
    console.error('Error reading env file:', e);
  }
}

if (!connectionString) {
  console.error('DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

// Convert PgBouncer pooled connection port 6543 to direct port 5432 for schema alteration compatibility if needed
if (connectionString.includes(':6543/')) {
  connectionString = connectionString.replace(':6543/postgres?pgbouncer=true', ':5432/postgres');
}

console.log('Connecting to database...');

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const tables = [
  'profiles', 'subscriptions', 'settings', 'patients', 'companions', 'medical_services',
  'visits', 'visit_services', 'employees', 'inventory_items', 'maintenance_records',
  'vouchers', 'audit_logs', 'examination_templates', 'refunds', 'external_partners',
  'referrals', 'chat_messages', 'inventory_transactions', 'visit_inventory_items',
  'treasury_sessions', 'treasury_transactions', 'treasury_expenses', 'whatsapp_logs',
  'notifications', 'reports'
];

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL successfully.');

    for (const table of tables) {
      console.log(`Setting default clinic_id for table "${table}" to get_user_clinic_id()...`);
      try {
        await client.query(`
          ALTER TABLE "${table}" 
          ALTER COLUMN clinic_id SET DEFAULT get_user_clinic_id();
        `);
        console.log(`Successfully updated table "${table}".`);
      } catch (tableErr) {
        console.error(`Failed to update table "${table}":`, tableErr.message);
      }
    }
    console.log('\nMigration complete! All tables configured with tenant clinic_id defaults.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
