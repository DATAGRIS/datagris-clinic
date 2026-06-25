'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isTrial = searchParams.get('type') === 'trial';
  
  const [countdown, setCountdown] = useState(5);
  const clinicUrl = process.env.NEXT_PUBLIC_CLINIC_APP_URL || 'https://datagris-clinic.onrender.com';

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = clinicUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [clinicUrl]);

  return (
    <div style={{ maxWidth: '600px', margin: '80px auto 0', padding: '20px' }}>
      <div className="form-card text-center" style={{ borderTop: '4px solid var(--accent-green)', background: 'var(--bg-card)', padding: '40px' }}>
        <div style={{
          width: '72px',
          height: '72px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '2px solid var(--accent-green)',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 24px',
          color: 'var(--accent-green)',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
        }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'var(--font-ar)' }}>
          {isTrial ? 'تم إنشاء الحساب التجريبي بنجاح!' : 'تم تفعيل الاشتراك بنجاح!'}
        </h1>
        <p className="subtitle-en" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
          {isTrial ? 'Free Trial Activated Successfully' : 'Payment Successful & Subscription Activated'}
        </p>
        
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '24px 0' }}></div>

        <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px', fontFamily: 'var(--font-ar)' }}>
          {isTrial 
            ? 'نشكرك على تسجيلك في الفترة التجريبية (7 أيام). تم إعداد ملفات عيادتك بنجاح. سيتم تحويلك الآن لتسجيل الدخول وبدء العمل.'
            : 'نشكرك على اشتراكك في باقات داتا جريس. تم تأكيد الدفع وتفعيل حساب عيادتك بنجاح على خوادمنا السحابية.'}
        </p>

        {/* Countdown redirect indicator */}
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.1)', 
          border: '1px solid rgba(99, 102, 241, 0.2)', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '32px',
          color: 'var(--text-main)',
          fontSize: '0.95rem',
          fontFamily: 'var(--font-ar)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⏱️ سيتم تحويلك تلقائياً للوحة التحكم خلال</span>
          <strong style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>{countdown}</strong>
          <span>ثوانٍ...</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a href={clinicUrl} className="btn-card btn-card-primary" style={{ width: 'auto', display: 'inline-block', textDecoration: 'none', fontFamily: 'var(--font-ar)' }}>
            الانتقال للعيادة فوراً / Go to Workspace
          </a>
          <Link href="/" className="btn-card btn-card-secondary" style={{ width: 'auto', display: 'inline-block', fontFamily: 'var(--font-ar)' }}>
            الرئيسية / Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="text-center" style={{ padding: '60px' }}>Loading confirmation...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
