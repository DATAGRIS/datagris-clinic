const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  let connectionString = "";
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
    if (dbUrlLine) {
      connectionString = dbUrlLine.replace('DATABASE_URL=', '').replace(/"/g, '').trim();
    }
  } catch (e) {
    console.log('Could not read DATABASE_URL from .env.local, using fallback direct connection.');
  }

  // Fallback to direct connection if .env.local connection string isn't resolved
  if (!connectionString) {
    connectionString = "postgresql://postgres:linic06062026%40@db.whfegxabypqkvnmfwfqj.supabase.co:5432/postgres";
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase Postgres database successfully.');

    const sqlPath = path.join(__dirname, '..', 'supabase_schema.sql');
    console.log('Reading schema from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing supabase_schema.sql... (This might take a few seconds)');
    await client.query(sql);
    console.log('================================================================');
    console.log('Schema migrations executed successfully!');
    console.log('All tables, functions, triggers, and RLS policies are created in Supabase.');
    console.log('================================================================');
  } catch (err) {
    console.error('Migration execution failed:');
    console.error(err);
    console.log('\nTIP: If you get "tenant not found", make sure your Supabase project is active and not paused.');
  } finally {
    await client.end();
  }
}

run();
