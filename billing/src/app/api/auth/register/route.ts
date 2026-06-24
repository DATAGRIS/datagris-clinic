import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeQueryAsAdmin } from '@/lib/db';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { clinicName, doctorName, username, password, mobile, plan } = await req.json();

    if (!clinicName || !doctorName || !username || !password || !mobile || !plan) {
      return NextResponse.json({ error: 'الرجاء ملء جميع البيانات المطلوبة' }, { status: 400 });
    }

    // 1. Generate unique clinic ID
    const lastClinic = await executeQueryAsAdmin(
      "SELECT id FROM clinics WHERE id LIKE 'CLN-%' ORDER BY id DESC LIMIT 1",
      [],
      'one'
    );
    let nextIdx = 1;
    if (lastClinic && lastClinic.id) {
      const match = lastClinic.id.match(/CLN-(\d+)/);
      if (match) {
        nextIdx = parseInt(match[1]) + 1;
      }
    }
    const clinicId = 'CLN-' + String(nextIdx).padStart(6, '0');

    // 2. Create Owner user in Supabase Auth via Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const email = `${username.trim().toLowerCase()}@datagris-auth.com`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { clinic_id: clinicId }
    });

    if (authError || !authData.user) {
      console.error('Supabase Auth Creation Error:', authError);
      return NextResponse.json({ error: authError?.message || 'فشل إنشاء حساب مستخدم سحابي' }, { status: 400 });
    }

    const userId = authData.user.id;

    // 3. Register clinic record
    await executeQueryAsAdmin(
      "INSERT INTO clinics (id, name) VALUES (?, ?)",
      [clinicId, clinicName],
      'run'
    );

    // 4. Create user profile
    await executeQueryAsAdmin(
      "INSERT INTO profiles (id, clinic_id, username, full_name, role) VALUES (?, ?, ?, ?, ?)",
      [userId, clinicId, username.trim().toLowerCase(), doctorName, 'admin'], // owner maps to admin dashboard role
      'run'
    );

    // 5. Register subscription record
    const now = new Date();
    const trialStart = now;
    const trialEnd = new Date();
    trialEnd.setDate(now.getDate() + 7); // 7 Days free trial

    let status = 'pending_payment';
    if (plan === 'trial') {
      status = 'trial';
    }

    await executeQueryAsAdmin(
      `INSERT INTO subscriptions (
        clinic_id, owner_user_id, plan, status, trial_start_date, trial_end_date
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [clinicId, userId, plan, status, trialStart, trialEnd],
      'run'
    );

    // 6. Pre-seed default settings
    const defaultSettings = {
      clinicName,
      doctorName,
      doctorSpecialty: 'القلب والأوعية الدموية',
      doctorTitle: 'استشاري أمراض القلب والأوعية',
      clinicAddress: 'القاهرة، مصر',
      clinicPhones: mobile,
      useInventory: 'true',
      companionAgeThreshold: '12',
      companionConsultationFee: '100',
      companionFollowupFee: '50',
      enableVitalsGlobal: 'true',
      enableVitalsReception: 'true',
      enableVitalsDoctor: 'true',
      diagnosisTiming: 'before_and_after'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await executeQueryAsAdmin(
        "INSERT INTO settings (clinic_id, key, value) VALUES (?, ?, ?)",
        [clinicId, key, value],
        'run'
      );
    }

    return NextResponse.json({ success: true, clinicId, username });
  } catch (err: any) {
    console.error('Registration API error:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ غير متوقع أثناء التسجيل' }, { status: 500 });
  }
}
