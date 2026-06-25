import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const paymobApiKey = process.env.PAYMOB_API_KEY || '';
const paymobIntegrationId = process.env.PAYMOB_INTEGRATION_ID || '';
const paymobIframeId = process.env.PAYMOB_IFRAME_ID || '';

export async function POST(req: NextRequest) {
  try {
    const { clinicId, plan, mobile, email } = await req.json();

    if (!clinicId || !plan || !mobile || !email) {
      return NextResponse.json({ error: 'Missing checkout parameters' }, { status: 400 });
    }

    // Determine pricing plan (Basic: 3000 EGP, Pro: 5000 EGP)
    let amountCents = 300000; // Default Basic: 3,000.00 EGP
    if (plan === 'pro') {
      amountCents = 500000; // Pro: 5,000.00 EGP
    }

    // 1. Authenticate with Paymob to get auth_token
    const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: paymobApiKey
    });
    const authToken = authRes.data.token;

    // 2. Register Order
    const merchantOrderId = `${clinicId}_${plan}_${Date.now()}`;
    const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: merchantOrderId,
      items: []
    });
    const orderId = orderRes.data.id;

    // 3. Generate Payment Key
    const keyRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: orderId,
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
      },
      currency: 'EGP',
      integration_id: parseInt(paymobIntegrationId),
      lock_order_to_token: true
    });
    const paymentToken = keyRes.data.token;

    // 4. Return Paymob Iframe redirect URL
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${paymobIframeId}?payment_token=${paymentToken}`;
    
    return NextResponse.json({ url: iframeUrl });
  } catch (err: any) {
    console.error('Paymob checkout initiation error:', err.response?.data || err.message);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاتصال ببوابة الدفع Paymob' }, { status: 500 });
  }
}
