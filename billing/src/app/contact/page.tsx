export default function ContactPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px' }}>
      <div className="text-center mb-24">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>اتصل بنا / Contact Us</h1>
        <p style={{ color: 'var(--text-muted)' }}>إذا كان لديك أي استفسار أو بحاجة لمساعدة، لا تتردد في الاتصال بنا وسنقوم بالرد عليك في أقرب وقت.</p>
      </div>

      <div className="form-card">
        <form>
          <div className="form-group">
            <label>الاسم الكامل / Full Name</label>
            <input type="text" className="form-control" required placeholder="أدخل اسمك الكامل" />
          </div>

          <div className="form-group">
            <label>البريد الإلكتروني / Email Address</label>
            <input type="email" className="form-control" required placeholder="email@example.com" style={{ direction: 'ltr', textAlign: 'left' }} />
          </div>

          <div className="form-group">
            <label>رقم الهاتف / Mobile Number</label>
            <input type="tel" className="form-control" required placeholder="010XXXXXXXX" style={{ direction: 'ltr', textAlign: 'left' }} />
          </div>

          <div className="form-group">
            <label>رسالتك / Message</label>
            <textarea className="form-control" rows={5} required placeholder="اكتب تفاصيل رسالتك هنا..." />
          </div>

          <button type="submit" className="form-submit">إرسال الرسالة / Send Message</button>
        </form>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>البريد الإلكتروني للدعم الفني: support@datagris.com</p>
        <p>هاتف المبيعات: 01001234567</p>
      </div>
    </div>
  );
}
