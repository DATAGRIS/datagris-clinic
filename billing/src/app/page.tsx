'use client';

import Link from 'next/link';
import { useBilling } from './BillingContext';

export default function PricingPage() {
  const { lang } = useBilling();

  // Translation mapping for pricing page
  const t = {
    ar: {
      heroTitle: 'إدارة عيادتك بذكاء وبلا حدود',
      heroSubtitle: 'بسط عمليات عيادتك اليومية مع DATAGRIS',
      heroDesc: 'اختر الخطة المناسبة وعزز أداء عيادتك الطبية من خلال إدارة متكاملة للملفات المرضية، والروشتات، والخزينة، والمخزن بدقة متناهية.',
      
      trialTitle: 'فترة التجربة',
      trialPrice: '0',
      trialPeriod: 'ج.م / 7 أيام',
      trialDesc: 'جرب مميزات النظام بالكامل مجاناً لمدة 7 أيام دون الحاجة لبيانات دفع لتتعرف على الكفاءة والذكاء التشغيلي.',
      trialF1: '7 أيام تجربة كاملة للبرنامج',
      trialF2: 'الملف الطبي الرقمي وطابور المرضى',
      trialF3: 'المؤشرات الحيوية المخصصة للعيادة',
      trialF4: 'إحالات الجهات الخارجية والمخزون',
      trialF5: 'أوتوميشن ورسائل الواتساب تلقائياً (غير متوفر)',
      trialBtn: 'ابدأ التجربة المجانية',

      basicTitle: 'الخطة الأساسية',
      basicPrice: '3,000',
      basicPeriod: 'ج.م / سنوياً',
      basicDesc: 'الخيار الاقتصادي المثالي للعيادات الصغيرة التي تبحث عن إدارة الملف المرضي والحسابات دون الحاجة للمخازن والواتساب.',
      basicF1: 'إدارة السجلات المرضية وطابور الاستقبال',
      basicF2: 'الروشتة الإلكترونية والمؤشرات الحيوية',
      basicF3: 'إدارة الخزينة وسندات القبض والصرف والتقارير',
      basicF4: 'سجل الصيدليات والإحالات الخارجية (غير متوفر)',
      basicF5: 'المستلزمات الطبية والمخازن (غير متوفر)',
      basicF6: 'أوتوميشن ورسائل الواتساب تلقائياً (غير متوفر)',
      basicBtn: 'اشترك الآن في الأساسية',

      proTitle: 'الخطة الاحترافية',
      proPrice: '5,000',
      proPeriod: 'ج.م / سنوياً',
      proDesc: 'الخيار الأقوى والأشمل للعيادات التخصصية والمراكز. تشمل كل شيء حرفياً مع ميزات المخازن، الصيدليات، وأوتوميشن الواتساب.',
      proF1: 'جميع مميزات الخطة الأساسية',
      proF2: 'إدارة الإحالات الخارجية والصيدليات والمعامل',
      proF3: 'المستلزمات الطبية، المخازن، الموردين والجرد',
      proF4: 'تفعيل كامل لأوتوميشن الواتساب للروشتات والتنبيهات',
      proF5: 'دعم فني مخصص ومتكامل على مدار الساعة 24/7',
      proBtn: 'اشترك الآن في الاحترافية',
      bestValue: 'الأكثر مبيعاً'
    },
    en: {
      heroTitle: 'Manage Your Clinic Intelligently & Without Limits',
      heroSubtitle: 'Simplify Your Daily Clinic Operations With DATAGRIS',
      heroDesc: 'Choose the perfect plan and empower your clinic workflow with integrated EMR charts, prescriptions, expense tracking, and inventory control.',
      
      trialTitle: 'Free Trial',
      trialPrice: '0',
      trialPeriod: 'EGP / 7 Days',
      trialDesc: 'Experience the complete clinic OS free for 7 days with no billing details required to discover how our smart workflow saves you time.',
      trialF1: '7-Day complete feature trial',
      trialF2: 'Digital EMR and patient queue system',
      trialF3: 'Custom vitals signs templates',
      trialF4: 'External referrals & inventory templates',
      trialF5: 'WhatsApp automation (Not available)',
      trialBtn: 'Start Free Trial',

      basicTitle: 'Basic Plan',
      basicPrice: '3,000',
      basicPeriod: 'EGP / Year',
      basicDesc: 'The ideal economic choice for private practices looking to manage client history and billing without advanced inventory or WhatsApp.',
      basicF1: 'Manage patient files and queue reception',
      basicF2: 'Digital prescriptions and custom vitals',
      basicF3: 'Treasury sessions, cash vouchers & reports',
      basicF4: 'External referral registries (Not available)',
      basicF5: 'Stock items & inventory control (Not available)',
      basicF6: 'WhatsApp automation & alerts (Not available)',
      basicBtn: 'Subscribe to Basic',

      proTitle: 'Pro Plan',
      proPrice: '5,000',
      proPeriod: 'EGP / Year',
      proDesc: 'Our most complete, powerful package for specialized clinics. Everything is included, featuring stock control, pharmacies, and automatic WhatsApp messaging.',
      proF1: 'All features from Basic Plan',
      proF2: 'Complete registry for labs, scans, and partners',
      proF3: 'Stock management, suppliers, and automatic inventory',
      proF4: 'Full WhatsApp API integration for reminders/scripts',
      proF5: 'Priority dedicated technical support 24/7',
      proBtn: 'Subscribe to Pro',
      bestValue: 'BEST VALUE'
    }
  }[lang];

  return (
    <div className="pricing-section">
      <div className="hero">
        <h1 style={{ fontFamily: 'var(--font-ar)' }}>{t.heroTitle}</h1>
        <p style={{ fontFamily: 'var(--font-ar)', maxWidth: '650px', margin: '0 auto', color: 'var(--text-muted)' }}>
          {t.heroDesc}
        </p>
      </div>

      <div className="pricing-grid">
        {/* Trial Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>{t.trialTitle}</h2>
            <div className="price">{t.trialPrice} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.trialPeriod}</span></div>
            <p style={{ fontFamily: 'var(--font-ar)', minHeight: '80px' }}>{t.trialDesc}</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.trialF1}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.trialF2}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.trialF3}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.trialF4}</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.trialF5}</span>
            </li>
          </ul>
          <Link href="/checkout?plan=trial" className="btn-card btn-card-secondary" style={{ fontFamily: 'var(--font-ar)', marginTop: '20px' }}>
            {t.trialBtn}
          </Link>
        </div>

        {/* Basic Plan */}
        <div className="pricing-card">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>{t.basicTitle}</h2>
            <div className="price">{t.basicPrice} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.basicPeriod}</span></div>
            <p style={{ fontFamily: 'var(--font-ar)', minHeight: '80px' }}>{t.basicDesc}</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF1}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF2}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF3}</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF4}</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF5}</span>
            </li>
            <li className="pricing-feature disabled">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.basicF6}</span>
            </li>
          </ul>
          <Link href="/checkout?plan=basic" className="btn-card btn-card-primary" style={{ fontFamily: 'var(--font-ar)', marginTop: '20px' }}>
            {t.basicBtn}
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="pricing-card popular">
          <div className="pricing-header">
            <h2 style={{ fontFamily: 'var(--font-ar)' }}>{t.proTitle}</h2>
            <div className="price">{t.proPrice} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t.proPeriod}</span></div>
            <p style={{ fontFamily: 'var(--font-ar)', minHeight: '80px' }}>{t.proDesc}</p>
          </div>
          <ul className="pricing-features">
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.proF1}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.proF2}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.proF3}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)', fontWeight: 700, color: 'var(--primary)' }}>{t.proF4}</span>
            </li>
            <li className="pricing-feature">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
              <span style={{ fontFamily: 'var(--font-ar)' }}>{t.proF5}</span>
            </li>
          </ul>
          <Link 
            href="/checkout?plan=pro" 
            className="btn-card btn-card-primary" 
            style={{ 
              fontFamily: 'var(--font-ar)', 
              marginTop: '20px',
              backgroundColor: 'var(--accent-green)',
              borderColor: 'var(--accent-green)'
            }}
          >
            {t.proBtn}
          </Link>
        </div>
      </div>
    </div>
  );
}
