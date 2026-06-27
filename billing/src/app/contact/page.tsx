'use client';

import { useState } from 'react';
import { useBilling } from '../BillingContext';

export default function ContactPage() {
  const { lang } = useBilling();
  
  // State variables
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Translations
  const t = {
    ar: {
      title: 'اتصل بنا',
      subtitle: 'إذا كان لديك أي استفسار أو بحاجة لمساعدة، لا تتردد في الاتصال بنا وسنقوم بالرد عليك في أقرب وقت.',
      labelName: 'الاسم الكامل',
      placeholderName: 'أدخل اسمك الكامل',
      labelEmail: 'البريد الإلكتروني',
      placeholderEmail: 'email@example.com',
      labelMobile: 'رقم الهاتف (الواتساب)',
      placeholderMobile: '010XXXXXXXX',
      labelMessage: 'تفاصيل الرسالة',
      placeholderMessage: 'اكتب تفاصيل رسالتك هنا...',
      btnSubmit: 'إرسال الرسالة',
      btnSending: 'جاري الإرسال...',
      successMsg: 'تم إرسال رسالتك بنجاح! شكراً لتواصلك معنا وسنتواصل معك قريباً.',
      errorMsg: 'حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة مرة أخرى.',
      supportEmail: 'البريد الإلكتروني للدعم: support@datagris.com'
    },
    en: {
      title: 'Contact Us',
      subtitle: 'If you have any questions or need assistance, feel free to contact us and we will respond as soon as possible.',
      labelName: 'Full Name',
      placeholderName: 'Enter your full name',
      labelEmail: 'Email Address',
      placeholderEmail: 'email@example.com',
      labelMobile: 'Phone Number (WhatsApp)',
      placeholderMobile: '010XXXXXXXX',
      labelMessage: 'Message Details',
      placeholderMessage: 'Write your message details here...',
      btnSubmit: 'Send Message',
      btnSending: 'Sending...',
      successMsg: 'Your message has been sent successfully! Thank you for contacting us, we will reply shortly.',
      errorMsg: 'An error occurred while sending your message. Please try again.',
      supportEmail: 'Support Email: support@datagris.com'
    }
  }[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, message })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || t.errorMsg);
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setMobile('');
      setMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 20px', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      <div className="text-center mb-24" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', fontFamily: 'var(--font-ar)' }}>
          {t.title}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ar)', fontSize: '1rem', lineHeight: 1.6 }}>
          {t.subtitle}
        </p>
      </div>

      <div className="form-card" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        {success && (
          <div className="checkout-success-banner" style={{ textAlign: 'start', margin: '0 0 20px 0' }}>
            🎉 {t.successMsg}
          </div>
        )}

        {error && (
          <div className="checkout-error-banner" style={{ textAlign: 'start', margin: '0 0 20px 0' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'start' }}>
          <div className="form-group">
            <label style={{ fontFamily: 'var(--font-ar)' }}>{t.labelName}</label>
            <input 
              type="text" 
              className="form-control" 
              required 
              placeholder={t.placeholderName} 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              style={{ height: '46px' }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontFamily: 'var(--font-ar)' }}>{t.labelEmail}</label>
            <input 
              type="email" 
              className="form-control" 
              required 
              placeholder={t.placeholderEmail} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontFamily: 'var(--font-ar)' }}>{t.labelMobile}</label>
            <input 
              type="tel" 
              className="form-control" 
              required 
              placeholder={t.placeholderMobile} 
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={loading}
              style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontFamily: 'var(--font-ar)' }}>{t.labelMessage}</label>
            <textarea 
              className="form-control" 
              rows={5} 
              required 
              placeholder={t.placeholderMessage} 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              style={{ padding: '12px 16px' }}
            />
          </div>

          <button 
            type="submit" 
            className="form-submit" 
            style={{
              fontFamily: 'var(--font-ar)',
              backgroundColor: 'var(--primary)',
              cursor: 'pointer',
              height: '48px',
              borderRadius: '8px',
              marginTop: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 28px'
            }}
            disabled={loading}
          >
            {loading ? t.btnSending : t.btnSubmit}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ar)' }}>
        <p>{t.supportEmail}</p>
      </div>
    </div>
  );
}
