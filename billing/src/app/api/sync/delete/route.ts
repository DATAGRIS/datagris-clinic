import { NextRequest, NextResponse } from 'next/server';
import { executeQueryAsAdmin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { tableName, recordId, clinicId } = await req.json();

    if (!tableName || !recordId || !clinicId) {
      return NextResponse.json({ error: 'Missing sync deletion parameters' }, { status: 400 });
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

    // Execute DELETE statement on Supabase Postgres
    const sql = `DELETE FROM "${tableName}" WHERE "${pk}" = ? AND clinic_id = ?`;
    await executeQueryAsAdmin(sql, [recordId, clinicId], 'run');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Sync delete error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
