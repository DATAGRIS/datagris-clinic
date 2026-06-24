import { NextRequest, NextResponse } from 'next/server';
import { executeQueryAsAdmin } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get('clinic_id');

    if (!clinicId) {
      return NextResponse.json({ error: 'Missing clinic_id parameter' }, { status: 400 });
    }

    // Fetch subscription record
    const sub = await executeQueryAsAdmin(
      `SELECT plan, status, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date 
       FROM subscriptions WHERE clinic_id = ?`,
      [clinicId],
      'one'
    );

    if (!sub) {
      return NextResponse.json({ error: 'Clinic subscription not found' }, { status: 404 });
    }

    const now = new Date();
    let status = sub.status;
    let endDate = sub.subscription_end_date ? new Date(sub.subscription_end_date) : null;

    if (status === 'trial' || status === 'pending_payment') {
      endDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
    }

    // Auto-expiry check
    if (endDate && endDate < now && (status === 'active' || status === 'trial' || status === 'pending_payment')) {
      status = 'expired';
      await executeQueryAsAdmin(
        "UPDATE subscriptions SET status = 'expired' WHERE clinic_id = ?",
        [clinicId],
        'run'
      );
    }

    let daysRemaining = 0;
    if (endDate) {
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      status,
      plan: sub.plan,
      days_remaining: daysRemaining
    });
  } catch (err: any) {
    console.error('Subscription check API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
