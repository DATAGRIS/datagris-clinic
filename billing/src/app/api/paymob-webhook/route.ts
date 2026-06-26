import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { executeQueryAsAdmin } from '@/lib/db';

const paymobHmacSecret = process.env.PAYMOB_HMAC_SECRET || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.PAYMOB_HMAC_SECRET || 'fallback_secret').digest();

function decryptPassword(encryptedData: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function verifyPaymobHmac(obj: any, hmacToCheck: string, hmacSecret: string): boolean {
  try {
    const hmacSource = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_voided,
      obj.is_refunded,
      obj.owner,
      obj.pending,
      obj.source_data?.pan || '',
      obj.source_data?.sub_type || '',
      obj.source_data?.type || '',
      obj.success
    ].join('');

    const calculatedHmac = crypto
      .createHmac('sha512', hmacSecret)
      .update(hmacSource)
      .digest('hex');

    return calculatedHmac === hmacToCheck;
  } catch (err) {
    console.error('HMAC source composition failed:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hmac = searchParams.get('hmac') || '';

    const body = await req.json();
    const obj = body.obj;

    if (!obj) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    // 1. Verify HMAC
    const isValid = verifyPaymobHmac(obj, hmac, paymobHmacSecret);
    if (!isValid) {
      console.error('Paymob Webhook Warning: Invalid HMAC signature.');
      return NextResponse.json({ error: 'Unauthorized: Invalid HMAC signature' }, { status: 401 });
    }

    console.log('Paymob Webhook Success: Valid signature verified. Transaction ID:', obj.id);

    // 2. Check if transaction was successful
    const isSuccess = obj.success === true || obj.success === 'true';
    if (!isSuccess) {
      console.log('Transaction marked as failed. Skipping activation.');
      return NextResponse.json({ status: 'ignored', reason: 'unsuccessful transaction' });
    }

    // 3. Extract clinic metadata
    const merchantOrderId = obj.order?.merchant_order_id || '';
    if (!merchantOrderId) {
      console.error('Missing merchant_order_id in webhook transaction');
      return NextResponse.json({ error: 'Bad Request: Missing order identifier' }, { status: 400 });
    }

    const parts = merchantOrderId.split('_');
    if (parts.length < 2) {
      console.error('Invalid merchant_order_id structure:', merchantOrderId);
      return NextResponse.json({ error: 'Bad Request: Invalid order identifier format' }, { status: 400 });
    }

    const clinicId = parts[0];
    const plan = parts[1]; // basic, pro

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30); // 30 Days (Monthly)

    // 4. Check if it is a pending registration or renewals
    if (clinicId.startsWith('PND-')) {
      // Fetch pending registration details
      const pending = await executeQueryAsAdmin(
        "SELECT * FROM pending_registrations WHERE id = ?",
        [clinicId],
        'one'
      );
      if (!pending) {
        console.error('Pending registration details not found for ID:', clinicId);
        return NextResponse.json({ error: 'Pending registration not found' }, { status: 400 });
      }

      const decryptedPassword = decryptPassword(pending.password_raw);

      // Generate unique clinic ID
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
      const realClinicId = 'CLN-' + String(nextIdx).padStart(6, '0');

      // Create Owner user in Supabase Auth
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const email = `${pending.username.trim().toLowerCase()}@datagris-auth.com`;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: decryptedPassword,
        email_confirm: true,
        user_metadata: { clinic_id: realClinicId }
      });

      if (authError || !authData.user) {
        console.error('Supabase Auth Creation Error in Webhook:', authError);
        return NextResponse.json({ error: authError?.message || 'Failed to create user profile' }, { status: 500 });
      }

      const userId = authData.user.id;

      // Register clinic record
      await executeQueryAsAdmin(
        "INSERT INTO clinics (id, name) VALUES (?, ?)",
        [realClinicId, pending.clinic_name],
        'run'
      );

      // Create user profile
      await executeQueryAsAdmin(
        "INSERT INTO profiles (id, clinic_id, username, full_name, role) VALUES (?, ?, ?, ?, ?)",
        [userId, realClinicId, pending.username.trim().toLowerCase(), pending.doctor_name, 'admin'],
        'run'
      );

      // Register subscription record
      await executeQueryAsAdmin(
        `INSERT INTO subscriptions (
          clinic_id, owner_user_id, plan, status, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date, payment_provider, payment_transaction_id, payment_amount, payment_currency
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          realClinicId, 
          userId, 
          plan, 
          'active', 
          startDate, 
          startDate, 
          startDate, 
          endDate, 
          'paymob', 
          String(obj.id), 
          parseFloat(obj.amount_cents) / 100, 
          obj.currency || 'EGP'
        ],
        'run'
      );

      // Seed default settings
      const defaultSettings = {
        clinicName: pending.clinic_name,
        doctorName: pending.doctor_name,
        doctorSpecialty: 'القلب والأوعية الدموية',
        doctorTitle: 'استشاري أمراض القلب والأوعية',
        clinicAddress: 'القاهرة، مصر',
        clinicPhones: pending.mobile,
        useInventory: 'true',
        companionAgeThreshold: '12',
        companionConsultationFee: '100',
        companionFollowupFee: '50',
        enableVitalsGlobal: 'true',
        enableVitalsReception: 'true',
        enableVitalsDoctor: 'true',
        diagnosisTiming: 'before_and_after',
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate.toISOString(),
        subscriptionEndDate: endDate.toISOString()
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        await executeQueryAsAdmin(
          "INSERT INTO settings (clinic_id, key, value) VALUES (?, ?, ?)",
          [realClinicId, key, value],
          'run'
        );
      }

      // Delete pending registration row
      await executeQueryAsAdmin(
        "DELETE FROM pending_registrations WHERE id = ?",
        [clinicId],
        'run'
      );

      console.log(`Successfully completed registration & activated subscription for clinic: ${realClinicId} (PND: ${clinicId})`);
    } else {
      // Upgrade/Renewal flow for existing clinic
      await executeQueryAsAdmin(
        `UPDATE subscriptions SET 
           plan = ?, 
           status = 'active', 
           subscription_start_date = ?, 
           subscription_end_date = ?,
           payment_provider = 'paymob',
           payment_transaction_id = ?,
           payment_amount = ?,
           payment_currency = ?,
           updated_at = timezone('utc'::text, now())
         WHERE clinic_id = ?`,
        [
          plan, 
          startDate, 
          endDate, 
          String(obj.id), 
          parseFloat(obj.amount_cents) / 100, 
          obj.currency || 'EGP', 
          clinicId
        ],
        'run'
      );

      console.log(`Successfully upgraded/renewed clinic subscription for ${clinicId}. Plan: ${plan}, Expires: ${endDate.toISOString()}`);
    }

    return NextResponse.json({ success: true, clinicId, plan });
  } catch (err: any) {
    console.error('Paymob Webhook error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
