import Link from 'next/link';

export default function PaymentFailedPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '80px auto 0', padding: '20px' }}>
      <div className="form-card text-center" style={{ borderTop: '4px solid var(--accent-red)' }}>
        <div style={{
          width: '72px',
          height: '72px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '2px solid var(--accent-red)',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 24px',
          color: 'var(--accent-red)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
        }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>

        <h1 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px' }}>فشلت عملية الدفع</h1>
        <p className="subtitle-en" style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Payment Verification Failed</p>
        
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '24px 0' }}></div>

        <p style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
          عذراً، تعذر إتمام عملية الدفع الخاصة باشتراك العيادة. قد يكون ذلك بسبب إلغاء العملية، نقص الرصيد، أو انتهاء الجلسة.
          يرجى التحقق من بيانات الدفع الخاصة بك وإعادة المحاولة.
        </p>

        <p className="subtitle-en" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', direction: 'ltr', marginBottom: '32px' }}>
          The payment request was unsuccessful. Please check your bank card limits and retry.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/checkout?plan=monthly" className="btn-card btn-card-primary" style={{ width: 'auto' }}>
            إعادة المحاولة / Retry Payment
          </Link>
          <Link href="/" className="btn-card btn-card-secondary" style={{ width: 'auto' }}>
            الرئيسية / Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
