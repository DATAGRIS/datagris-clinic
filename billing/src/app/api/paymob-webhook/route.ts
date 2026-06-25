import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { executeQueryAsAdmin } from '@/lib/db';

const paymobHmacSecret = process.env.PAYMOB_HMAC_SECRET || '';

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
    // Paymob success can be boolean true or string 'true'
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

    // 4. Calculate subscription dates (both Basic and Pro are annual plans)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 365); // 1 Year (365 days)

    // 5. Update clinic subscription in database
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

    console.log(`Successfully activated clinic subscription for ${clinicId}. Plan: ${plan}, Expires: ${endDate.toISOString()}`);

    return NextResponse.json({ success: true, clinicId, plan });
  } catch (err: any) {
    console.error('Paymob Webhook error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
