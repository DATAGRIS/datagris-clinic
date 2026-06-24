import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="pricing-section">
      <div className="hero">
        <h1>إدارة عيادتك بذكاء وبلا حدود</h1>
        <p className="subtitle-en" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Simplify Your Clinic Operations With DATAGRIS</p>
        <p>اختر الخطة المناسبة وابدأ في تنظيم الحجوزات، الملفات الطبية، الحسابات، والمخزن بدقة متناهية.</p>
      </div>

      <div className="pricing-grid">
        {/* Trial Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2>الفترة التجريبية / Trial</h2>
            <div className="price">0 <span>EGP</span></div>
            <p>سجل عيادتك الآن وجرب كافة مميزات النظام مجاناً لمدة 7 أيام دون الحاجة لإدخال بيانات الدفع.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>7 أيام تجربة كاملة / 7-Day Trial</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>إدارة المرضى والحجوزات / Patients & Queue</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>روشتات إلكترونية / E-Prescriptions</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>دعم فني مخصص / Dedicated Support</span>
            </li>
          </ul>
          <Link href="/checkout?plan=trial" className="btn-card btn-card-secondary">
            ابدأ الفترة التجريبية / Start Trial
          </Link>
        </div>

        {/* Monthly Plan */}
        <div className="pricing-card popular">
          <div className="pricing-header">
            <h2>الاشتراك الشهري / Monthly Pro</h2>
            <div className="price">499 <span>EGP / Month</span></div>
            <p>الخيار الأمثل للعيادات الفردية والنمو السريع مع وصول غير محدود لكافة مميزات النظام وإدارة الموظفين.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>جميع مميزات الإدارة الطبية / Full Access</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>إدارة موظفي العيادة وصلاحياتهم / Staff Roles</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>نظام الخزينة والمخازن الكامل / ERP Modules</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>دعم فني متميز / Priority Support</span>
            </li>
          </ul>
          <Link href="/checkout?plan=monthly" className="btn-card btn-card-primary">
            اشترك الآن / Subscribe Now
          </Link>
        </div>

        {/* Annual Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2>الاشتراك السنوي / Annual Pro</h2>
            <div className="price">4,990 <span>EGP / Year</span></div>
            <p>احصل على أقصى توفير (وفر 17% من قيمة الاشتراك) وضمان استقرار الخدمة لعيادتك طوال العام دون انقطاع.</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>وفر ما يقارب شهرين مجاناً / Save 17% Off</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>جميع مميزات الخطة الاحترافية الشهري / Pro Features</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>تحديثات مستمرة تلقائية مجانية / Free Updates</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span>دعم فني على مدار الساعة / 24x7 VIP Support</span>
            </li>
          </ul>
          <Link href="/checkout?plan=annual" className="btn-card btn-card-primary">
            اشترك الآن / Subscribe Now
          </Link>
        </div>
      </div>
    </div>
  );
}
