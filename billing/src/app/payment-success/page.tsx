import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '80px auto 0', padding: '20px' }}>
      <div className="form-card text-center" style={{ borderTop: '4px solid var(--accent-green)' }}>
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

        <h1 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px' }}>تم تفعيل الاشتراك بنجاح!</h1>
        <p className="subtitle-en" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Payment Successful & Subscription Activated</p>
        
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '24px 0' }}></div>

        <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
          نشكرك على اشتراكك في باقة DATAGRIS الاحترافية. تم تفعيل اشتراك عيادتك بنجاح على خوادمنا السحابية.
          يمكنك الآن الانتقال مباشرة إلى لوحة تحكم عيادتك الطبية لبدء العمل أونلاين.
        </p>

        <p className="subtitle-en" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', direction: 'ltr', marginBottom: '32px' }}>
          Your subscription is active. Click below to enter your clinic workspace dashboard online.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a href={process.env.NEXT_PUBLIC_CLINIC_APP_URL || 'http://localhost:5000'} className="btn-card btn-card-primary" style={{ width: 'auto', display: 'inline-block', textDecoration: 'none' }}>
            الانتقال للعيادة / Go to Workspace
          </a>
          <Link href="/" className="btn-card btn-card-secondary" style={{ width: 'auto', display: 'inline-block' }}>
            العودة للرئيسية / Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
