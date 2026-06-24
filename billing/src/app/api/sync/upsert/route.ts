import { NextRequest, NextResponse } from 'next/server';
import { executeQueryAsAdmin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { tableName, record, clinicId } = await req.json();

    if (!tableName || !record || !clinicId) {
      return NextResponse.json({ error: 'Missing sync parameters' }, { status: 400 });
    }

    const primaryKeys: any = {
      settings: 'key',
      users: 'id',
      patients: 'mobile_number',
      companions: 'id',
      medical_services: 'id',
      visits: 'id',
      visit_services: 'visit_id',
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

    const pk = primaryKeys[tableName];
    if (!pk) {
      return NextResponse.json({ error: `Unsupported table: ${tableName}` }, { status: 400 });
    }

    const pkValue = record[pk];
    const incomingUpdatedAt = new Date(record.updated_at || new Date());

    // 1. Fetch remote record to check for conflict
    const remote = await executeQueryAsAdmin(
      `SELECT updated_at FROM "${tableName}" WHERE "${pk}" = ? AND clinic_id = ?`,
      [pkValue, clinicId],
      'one'
    );

    if (remote) {
      const remoteUpdatedAt = new Date(remote.updated_at);
      if (remoteUpdatedAt > incomingUpdatedAt) {
        // Conflict! Remote wins. Return remote record
        const fullRemote = await executeQueryAsAdmin(
          `SELECT * FROM "${tableName}" WHERE "${pk}" = ? AND clinic_id = ?`,
          [pkValue, clinicId],
          'one'
        );
        return NextResponse.json({ conflict: true, record: fullRemote });
      }
    }

    // 2. Local wins. Upsert to Supabase.
    const columns = Object.keys(record);
    if (!columns.includes('clinic_id')) {
      columns.push('clinic_id');
      record.clinic_id = clinicId;
    }

    // Handle compound primary keys conflicts
    let conflictClause = `ON CONFLICT ("${pk}")`;
    if (tableName === 'settings') {
      conflictClause = `ON CONFLICT (clinic_id, "key")`;
    } else if (tableName === 'visit_services') {
      conflictClause = `ON CONFLICT (visit_id, service_id)`;
    }

    const placeholders = columns.map(() => `?`).join(', ');
    const colNames = columns.map(c => `"${c}"`).join(', ');
    const updateExpr = columns
      .filter(c => c !== pk && c !== 'clinic_id')
      .map(c => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    const sql = `
      INSERT INTO "${tableName}" (${colNames}) 
      VALUES (${placeholders})
      ${conflictClause}
      DO UPDATE SET ${updateExpr}
    `;

    const params = columns.map(c => {
      const val = record[c];
      // Convert objects/arrays to strings for PG JSON columns
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });

    await executeQueryAsAdmin(sql, params, 'run');

    return NextResponse.json({ success: true, conflict: false });
  } catch (err: any) {
    console.error('Sync upsert error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
