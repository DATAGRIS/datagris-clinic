import { NextRequest, NextResponse } from 'next/server';
import { executeQueryAsAdmin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { clinicId, lastSyncTime } = await req.json();

    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinicId parameter' }, { status: 400 });
    }

    const filterDate = lastSyncTime ? new Date(lastSyncTime) : new Date(0);

    const tables = [
      'settings', 'users', 'patients', 'companions', 'medical_services', 'visits',
      'visit_services', 'employees', 'inventory_items', 'maintenance_records',
      'vouchers', 'audit_logs', 'examination_templates', 'refunds', 'external_partners',
      'referrals', 'chat_messages', 'inventory_transactions', 'visit_inventory_items',
      'treasury_sessions', 'treasury_transactions', 'treasury_expenses', 'whatsapp_logs', 'notifications', 'reports'
    ];

    const updates: any = {};
    const serverTime = new Date().toISOString();

    for (const table of tables) {
      // Query Postgres for newer records matching the clinic ID
      const sql = `SELECT * FROM "${table}" WHERE clinic_id = ? AND updated_at > ?`;
      const rows = await executeQueryAsAdmin(sql, [clinicId, filterDate], 'all');
      if (rows.length > 0) {
        updates[table] = rows;
      }
    }

    return NextResponse.json({
      updates,
      serverTime
    });
  } catch (err: any) {
    console.error('Sync pull error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
