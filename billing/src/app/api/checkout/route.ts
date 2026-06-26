import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const paymobApiKey = process.env.PAYMOB_API_KEY || '';
const paymobIntegrationId = process.env.PAYMOB_INTEGRATION_ID || '';
const paymobPublicKey = process.env.PAYMOB_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYMOB_PUBLIC_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, mobile } = body;
    let clinicId = body.clinicId;
    let email = body.email;

    // Upgrade/Renewal flow: authenticate user first and fetch clinic_id
    if (!clinicId && body.username && body.password) {
      const username = body.username.trim().toLowerCase();
      const password = body.password;

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const authEmail = `${username}@datagris-auth.com`;

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password
      });

      if (authError || !authData.user) {
        console.error('Checkout authentication error:', authError);
        return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // 2. Fetch User Profile to get clinic_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Checkout profile fetch error:', profileError);
        return NextResponse.json({ error: 'لم يتم العثور على ملف تعريف المستخدم الخاص بك' }, { status: 404 });
      }

      clinicId = profile.clinic_id;
      email = `${username}@datagris-checkout.com`;
    }

    if (!clinicId || !plan || !mobile || !email) {
      return NextResponse.json({ error: 'Missing checkout parameters' }, { status: 400 });
    }

    if (!paymobPublicKey) {
      console.error('PAYMOB_PUBLIC_KEY is not configured in environment variables');
      return NextResponse.json({ error: 'مفتاح Paymob Public Key غير مهيأ في الخادم' }, { status: 500 });
    }

    // Determine pricing plan (Basic: 3000 EGP, Pro: 5000 EGP)
    let amountCents = 300000; // Default Basic: 3,000.00 EGP
    if (plan === 'pro') {
      amountCents = 500000; // Pro: 5,000.00 EGP
    }

    const merchantOrderId = `${clinicId}_${plan}_${Date.now()}`;

    // 1. Create Payment Intention via Paymob v1 API
    const intentionRes = await axios.post(
      'https://accept.paymob.com/v1/intention/',
      {
        amount: amountCents,
        currency: 'EGP',
        payment_methods: [parseInt(paymobIntegrationId)],
        merchant_order_id: merchantOrderId,
        billing_data: {
          apartment: 'NA',
          email: email,
          floor: 'NA',
          first_name: 'Clinic',
          street: 'NA',
          building: 'NA',
          phone_number: mobile,
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          last_name: clinicId,
          state: 'Cairo'
        }
      },
      {
        headers: {
          'Authorization': `Token ${paymobApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const clientSecret = intentionRes.data.client_secret;

    // 2. Return Paymob Unified Checkout redirect URL
    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${paymobPublicKey}&clientSecret=${clientSecret}`;
    
    return NextResponse.json({ url: checkoutUrl });
  } catch (err: any) {
    const paymobError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('Paymob checkout initiation error:', paymobError);
    return NextResponse.json({ 
      error: `حدث خطأ أثناء الاتصال ببوابة الدفع Paymob: ${paymobError}` 
    }, { status: 500 });
  }
}

