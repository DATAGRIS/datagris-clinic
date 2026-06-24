import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const email = `${username.trim().toLowerCase()}@datagris-auth.com`;

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      console.error('Supabase Auth error:', authError);
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    // 2. Fetch User Profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Supabase profile fetch error:', profileError);
      return NextResponse.json({ error: 'لم يتم العثور على ملف تعريف المستخدم الخاص بك' }, { status: 404 });
    }

    // 3. Return session package
    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        fullName: profile.full_name,
        clinicId: profile.clinic_id
      },
      jwt: authData.session.access_token
    });
  } catch (err: any) {
    console.error('Authentication API error:', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء تسجيل الدخول' }, { status: 500 });
  }
}
