import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="pricing-section">
      <div className="hero">
        <h1 style={{ fontFamily: 'var(--font-ar)' }}>إدارة عيادتك بذكاء وبلا حدود</h1>
        <p className="subtitle-en" style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--primary)' }}>
          Simplify Your Clinic Operations With DATAGRIS
        </p>
        <p style={{ fontFamily: 'var(--font-ar)' }}>
          اختر الخطة المناسبة وعزز أداء عيادتك الطبية من خلال إدارة متكاملة للملفات المرضية، والروشتات، والخزينة، والمخزن بدقة متناهية.
        </p>
      </div>

      <div className="pricing-grid">
        {/* Trial Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>فترة التجربة / Free Trial</h2>
            <div className="price">0 <span>EGP / 7 Days</span></div>
            <p style={{ fontFamily: 'var(--font-ar)' }}>جرب مميزات النظام بالكامل مجاناً لمدة 7 أيام دون الحاجة لبيانات دفع لتتعرف على الكفاءة والذكاء التشغيلي.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>7 أيام تجربة كاملة / 7-Day Trial</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>الملف الطبي والروشتة / EMR & Queue</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>المؤشرات الحيوية المخصصة / Custom Vitals</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>التحويلات والمخزن / Referrals & Stock</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>أوتوميشن واتساب / WhatsApp Automation</span>
            </li>
          </ul>
          <Link href="/checkout?plan=trial" className="btn-card btn-card-secondary" style={{ fontFamily: 'var(--font-ar)' }}>
            ابدأ التجربة المجانية / Start Trial
          </Link>
        </div>

        {/* Basic Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>الخطة الأساسية / Basic Plan</h2>
            <div className="price">3,000 <span>EGP / Year</span></div>
            <p style={{ fontFamily: 'var(--font-ar)' }}>الخيار الاقتصادي المثالي للعيادات الصغيرة التي تبحث عن إدارة الملف المرضي والحسابات دون الحاجة للمخازن والواتساب.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>إدارة المرضى والحجوزات / Patients & Queue</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>الروشتة والمؤشرات الحيوية / Custom EMR</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>إدارة حسابات الخزينة وسندات القبض والصرف</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>سجل الصيدليات والإحالات / Referrals Panel</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>المخازن والمستلزمات الطبية / Inventory</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>واتساب ورسائل التنبيهات / WhatsApp API</span>
            </li>
          </ul>
          <Link href="/checkout?plan=basic" className="btn-card btn-card-primary" style={{ fontFamily: 'var(--font-ar)' }}>
            اشترك الآن / Subscribe Basic
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="pricing-card popular">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>الخطة الاحترافية / Pro Plan</h2>
            <div className="price">5,000 <span>EGP / Year</span></div>
            <p style={{ fontFamily: 'var(--font-ar)' }}>الخيار الأقوى والأشمل للعيادات التخصصية. تشمل كل شيء حرفياً مع ميزات المخازن، الصيدليات، وأوتوميشن الواتساب.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>كل شيء في الخطة الأساسية / All Basic Features</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>سجل الصيدليات والإحالات الخارجية بالكامل</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>المخازن والمستلزمات الطبية والجرد / Inventory</span>
            </li>
            <li className="pricing-feature" style={{ color: 'var(--primary)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <strong style={{ color: '#22c55e' }}>تفعيل أوتوميشن واتساب للعيادة والجهات الخارجية</strong>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>دعم فني فوري مخصص للعيادة 24/7</span>
            </li>
          </ul>
          <Link href="/checkout?plan=pro" className="btn-card btn-card-primary" style={{ backgroundColor: 'var(--accent-green)', fontFamily: 'var(--font-ar)' }}>
            اشترك الآن / Subscribe Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
