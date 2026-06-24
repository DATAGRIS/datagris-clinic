export default function FeaturesPage() {
  const features = [
    {
      titleAr: 'سجل طبي إلكتروني متكامل (EMR)',
      titleEn: 'Electronic Medical Records',
      descAr: 'إدارة شاملة لملف المريض الطبي وتشخيصاته والروشتات المطبوعة والزيارات السابقة مع تنظيم قائمة انتظار ذكية للعيادة.',
      descEn: 'Comprehensive patient health records, diagnostic histories, digital printing, and real-time smart receptionist-to-doctor EMR queues.'
    },
    {
      titleAr: 'الخزينة والمعاملات المالية',
      titleEn: 'Treasury & Cashier Management',
      descAr: 'تتبع مقبوضات العيادة، المصروفات اليومية، المرتجعات، وإغلاق ورديات الخزينة اليومية مع رصد الفروقات والعجز النقدية.',
      descEn: 'Log shifting drawers, monitor manual expenditures, handle medical refunds, and process cash settlement adjustments automatically.'
    },
    {
      titleAr: 'المخزون والمستلزمات الطبية',
      titleEn: 'Smart Inventory & Barcodes',
      descAr: 'متابعة كميات الأدوية والمستلزمات في المخزن مع ربطها تلقائياً بالزيارات الطبية وإرسال تنبيهات عندما يقل رصيد الصنف.',
      descEn: 'Track quantities of materials, automatically deduct items when consumed during medical visits, and trigger low-stock push alerts.'
    },
    {
      titleAr: 'صلاحيات الموظفين وإدارتهم',
      titleEn: 'Staff Roles & Access Security',
      descAr: 'توزيع العمل بين الطبيب وموظف الاستقبال والمحاسب والمدير وصاحب العيادة مع إخفاء الأقسام غير المصرح بدخولها لزيادة السرية.',
      descEn: 'Separate duties between Doctor, Receptionist, Accountant, Manager, and Owner, filtering visible UI layouts and queries.'
    }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
      <div className="hero">
        <h1 style={{ fontSize: '3rem' }}>مميزات نظام DATAGRIS</h1>
        <p className="subtitle-en" style={{ fontSize: '1.25rem' }}>Core Modules Built For Egypt\'s Modern Clinics</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px' }}>
        {features.map((f, i) => (
          <div key={i} className="pricing-card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '4px' }}>{f.titleAr}</h3>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '16px', direction: 'ltr', textAlign: 'right', fontFamily: 'var(--font-en)' }}>{f.titleEn}</h4>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '12px' }}>{f.descAr}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', direction: 'ltr', textAlign: 'left', fontFamily: 'var(--font-en)' }}>{f.descEn}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
