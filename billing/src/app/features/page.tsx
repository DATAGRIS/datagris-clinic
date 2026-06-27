'use client';

import { useBilling } from '../BillingContext';

export default function FeaturesPage() {
  const { lang } = useBilling();

  const t = {
    ar: {
      heroTitle: 'نظام التشغيل الطبي DATAGRIS Clinic',
      heroSub: 'شركة داتا جريس متخصصة في تطوير أنظمة التشغيل الذكية وحلول تكامل النظم، ونظام DATAGRIS Clinic هو أحد أنظمتنا المتخصصة والمصمم خصيصاً للعيادات والمراكز الطبية المعاصرة لإدارة وتنظيم سير العمل الطبي بكفاءة.',
      featuresList: [
        {
          title: 'سجل طبي إلكتروني متكامل (EMR)',
          desc: 'إدارة شاملة لملف المريض الطبي وتشخيصاته والروشتات المطبوعة والزيارات السابقة مع تنظيم قائمة انتظار ذكية للعيادة.'
        },
        {
          title: 'الخزينة والمعاملات المالية',
          desc: 'تتبع مقبوضات العيادة، المصروفات اليومية، المرتجعات، وإغلاق ورديات الخزينة اليومية مع رصد الفروقات والعجز النقدية.'
        },
        {
          title: 'المخزون والمستلزمات الطبية',
          desc: 'متابعة كميات الأدوية والمستلزمات في المخزن مع ربطها تلقائياً بالزيارات الطبية وإرسال تنبيهات عندما يقل رصيد الصنف.'
        },
        {
          title: 'صلاحيات الموظفين وإدارتهم',
          desc: 'توزيع العمل بين الطبيب وموظف الاستقبال والمحاسب والمدير وصاحب العيادة مع إخفاء الأقسام غير المصرح بدخولها لزيادة السرية.'
        }
      ]
    },
    en: {
      heroTitle: 'DATAGRIS Clinic Operating System',
      heroSub: 'DATAGRIS specializes in developing intelligent operating systems and system integration solutions. DATAGRIS Clinic is our specialized EMR and clinical ERP designed to streamline daily medical workflows.',
      featuresList: [
        {
          title: 'Electronic Medical Records (EMR)',
          desc: 'Comprehensive patient health records, diagnostic histories, digital printing, and real-time smart receptionist-to-doctor EMR queues.'
        },
        {
          title: 'Treasury & Cashier Management',
          desc: 'Log shifting drawers, monitor manual expenditures, handle medical refunds, and process cash settlement adjustments automatically.'
        },
        {
          title: 'Smart Inventory & Barcodes',
          desc: 'Track quantities of materials, automatically deduct items when consumed during medical visits, and trigger low-stock push alerts.'
        },
        {
          title: 'Staff Roles & Access Security',
          desc: 'Separate duties between Doctor, Receptionist, Accountant, Manager, and Owner, filtering visible UI layouts and queries.'
        }
      ]
    }
  }[lang];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      <div className="hero" style={{ textAlign: 'center', marginBottom: '40px', padding: '0 20px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'var(--font-ar)' }}>
          {t.heroTitle}
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-ar)' }}>
          {t.heroSub}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', marginTop: '20px' }}>
        {t.featuresList.map((f, i) => (
          <div key={i} className="pricing-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', textAlign: 'start' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '12px', fontFamily: 'var(--font-ar)' }}>{f.title}</h3>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.6, fontFamily: 'var(--font-ar)' }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
