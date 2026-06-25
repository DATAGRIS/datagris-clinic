'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Link from 'next/link';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const existingClinicId = searchParams.get('clinic') || '';
  const initialPlan = searchParams.get('plan') || 'trial';

  // Form State
  const [plan, setPlan] = useState(initialPlan);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pro WhatsApp Request State
  const [waRequesting, setWaRequesting] = useState(false);
  const [waRequested, setWaRequested] = useState(false);
  const [waMessage, setWaMessage] = useState('');

  // Request WhatsApp API activation via company email
  const handleRequestWhatsApp = async () => {
    if (!clinicName && !existingClinicId) {
      setError('يرجى كتابة اسم العيادة أولاً لتفعيل طلب الواتساب / Please fill clinic name first');
      return;
    }
    if (!mobile || mobile.length < 10) {
      setError('يرجى كتابة رقم هاتف الواتساب الصحيح للعيادة / Please write a valid WhatsApp mobile number');
      return;
    }
    if (!existingClinicId && !username) {
      setError('يرجى كتابة اسم مستخدم المدير / Please write owner username');
      return;
    }

    setWaRequesting(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/request-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: existingClinicId || 'CLN-NEW',
          clinicName: clinicName || `تجديد عيادة ${existingClinicId}`,
          mobile: mobile,
          username: username || 'admin'
        })
      });

      if (!res.ok) {
        throw new Error('فشل إرسال طلب التفعيل للشركة');
      }

      setWaRequested(true);
      setWaMessage('✅ تم إرسال طلب تفعيل API الواتساب بنجاح لشركة DATAGRIS! سيتم تفعيل حساب الـ API وتزويدك برمز الاستجابة السريعة QR للمسح والربط خلال 1 إلى 3 أيام عمل. يمكنك الآن المتابعة لإتمام الدفع.');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إرسال طلب واتساب');
    } finally {
      setWaRequesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If Pro plan and WhatsApp request is not done, require it first
    if (plan === 'pro' && !waRequested) {
      setError('الرجاء الضغط على زر "تفعيل طلب الواتساب" أولاً للتحقق من رقم API وإرساله للشركة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (existingClinicId) {
        // Upgrade flow for existing clinic
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicId: existingClinicId,
            plan: plan,
            mobile: mobile || '01000000000',
            email: `${existingClinicId}@datagris-checkout.com`
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'فشلت عملية تهيئة الدفع');
        }

        const data = await res.json();
        // Redirect to Paymob iframe URL
        window.location.href = data.url;
      } else {
        // Registration flow for new clinic
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicName,
            doctorName,
            username,
            password,
            mobile,
            plan
          })
        });

        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.error || 'فشلت عملية تسجيل العيادة');
        }

        const regData = await regRes.json(); // { success: true, clinicId }

        if (plan === 'trial') {
          // Redirect directly to success page for trials
          router.push('/payment-success?type=trial');
        } else {
          // Redirect to checkout payment for paid registration
          const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clinicId: regData.clinicId,
              plan: plan,
              mobile: mobile,
              email: `${username}@datagris-checkout.com`
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'فشلت عملية تهيئة الدفع');
          }

          const data = await res.json();
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-split-layout">
      {/* Left panel - Branding and Tech features */}
      <div className="checkout-visual-panel">
        <div className="visual-overlay"></div>
        <div className="visual-content">
          <Link href="/" style={{ display: 'inline-block', marginBottom: '40px' }}>
            <img src="/datagris_light.png" alt="DATAGRIS Logo" style={{ height: '70px', objectFit: 'contain' }} />
          </Link>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.3, marginBottom: '24px', fontFamily: 'var(--font-ar)' }}>
            منصة داتا جريس الطبية المتكاملة
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '40px', fontFamily: 'var(--font-ar)' }}>
            شريكك الذكي في إدارة العيادات والمراكز الطبية. انضم لأكثر من 500 طبيب يثقون في أنظمتنا يومياً.
          </p>

          <div className="features-showcase-grid">
            <div className="showcase-item">
              <div className="icon-wrapper">📂</div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-ar)' }}>ملفات طبية رقمية ذكية</h4>
                <p style={{ fontFamily: 'var(--font-ar)' }}>تسجيل الروشتات، الكشف المباشر، المؤشرات الحيوية المخصصة والتاريخ المرضي للعيادة.</p>
              </div>
            </div>

            <div className="showcase-item">
              <div className="icon-wrapper">💸</div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-ar)' }}>إدارة الخزينة والرواتب</h4>
                <p style={{ fontFamily: 'var(--font-ar)' }}>إصدار سندات القبض والصرف، جرد الخزينة اليومي وحساب أرباح العيادة التلقائي.</p>
              </div>
            </div>

            <div className="showcase-item">
              <div className="icon-wrapper">💬</div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-ar)' }}>نظام إرسال الواتساب التلقائي</h4>
                <p style={{ fontFamily: 'var(--font-ar)' }}>تنبيهات فورية للمرضى، إرسال الروشتة إلكترونياً، وإحالات فورية للصيدليات والمعامل.</p>
              </div>
            </div>

            <div className="showcase-item">
              <div className="icon-wrapper">📦</div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-ar)' }}>إدارة المخزون والمستلزمات</h4>
                <p style={{ fontFamily: 'var(--font-ar)' }}>تنبيهات انخفاض مستوى المخزون، ربط استهلاك المستلزمات الطبية تلقائياً بالكشوفات.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Form card */}
      <div className="checkout-form-panel">
        <div style={{ maxWidth: '520px', width: '100%', padding: '20px' }}>
          <div className="mb-24">
            <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-ar)' }}>
              {existingClinicId ? 'تجديد وترقية الاشتراك' : 'تسجيل عيادة جديدة'}
            </h1>
            <p className="subtitle-en" style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {existingClinicId ? `Upgrade Clinic Account: ${existingClinicId}` : 'Register your clinic & configure SaaS Plan'}
            </p>
          </div>

          <div className="form-card" style={{ background: 'var(--bg-card)', padding: '30px' }}>
            {error && (
              <div className="checkout-error-banner">
                ⚠️ {error}
              </div>
            )}

            {waMessage && (
              <div className="checkout-success-banner">
                {waMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Plan select */}
              <div className="form-group">
                <label style={{ fontFamily: 'var(--font-ar)' }}>اختر الخطة المطلوبة / Plan Selection</label>
                <select
                  className="form-control"
                  value={plan}
                  onChange={(e) => {
                    setPlan(e.target.value);
                    setWaRequested(false);
                    setError('');
                  }}
                  disabled={loading || !!searchParams.get('plan')}
                >
                  {!existingClinicId && <option value="trial">باقة تجريبية - 7 أيام مجاناً / 7-Day Free Trial (0 EGP)</option>}
                  <option value="basic">الباقة الأساسية - سنوي (3000 EGP) / Basic Annual</option>
                  <option value="pro">الباقة الاحترافية - سنوي (5000 EGP) / Pro Annual</option>
                </select>
              </div>

              {existingClinicId ? (
                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>رقم هاتف الواتساب أو الدفع / Mobile Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    required
                    placeholder="010XXXXXXXX"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={loading}
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label style={{ fontFamily: 'var(--font-ar)' }}>اسم العيادة / Clinic Name</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="مثال: عيادة داتا جريس الطبية"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontFamily: 'var(--font-ar)' }}>اسم الطبيب / Doctor's Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="مثال: د. أحمد ياسر"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontFamily: 'var(--font-ar)' }}>رقم الهاتف (الواتساب) / Phone Number</label>
                    <input
                      type="tel"
                      className="form-control"
                      required
                      placeholder="010XXXXXXXX"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      disabled={loading}
                      style={{ direction: 'ltr', textAlign: 'left' }}
                    />
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

                  <div className="form-group">
                    <label style={{ fontFamily: 'var(--font-ar)' }}>اسم مستخدم المدير / Owner Username</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="مثال: owner_name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      style={{ direction: 'ltr', textAlign: 'left' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontFamily: 'var(--font-ar)' }}>كلمة المرور / Password</label>
                    <input
                      type="password"
                      className="form-control"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      style={{ direction: 'ltr', textAlign: 'left' }}
                    />
                  </div>
                </>
              )}

              {/* Pro plan activation workflow triggers */}
              {plan === 'pro' && (
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={handleRequestWhatsApp}
                    className="btn-card btn-card-secondary"
                    style={{
                      width: '100%',
                      backgroundColor: waRequested ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      borderColor: waRequested ? '#22c55e' : 'var(--primary)',
                      color: waRequested ? '#22c55e' : 'white',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-ar)'
                    }}
                    disabled={waRequesting}
                  >
                    {waRequesting ? 'جاري إرسال طلب التفعيل...' : waRequested ? '✓ تم تفعيل طلب الواتساب بنجاح' : 'خطوة 1: طلب تفعيل نظام الواتساب'}
                  </button>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', fontFamily: 'var(--font-ar)' }}>
                    * لخطط البرو، يجب إرسال طلب التفعيل للتحقق من ربط الـ API بالشركة قبل الدفع.
                  </p>
                </div>
              )}

              {/* Submit triggers */}
              <button
                type="submit"
                className="form-submit"
                style={{
                  fontFamily: 'var(--font-ar)',
                  backgroundColor: (plan === 'pro' && !waRequested) ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                  cursor: (plan === 'pro' && !waRequested) ? 'not-allowed' : 'pointer'
                }}
                disabled={loading || (plan === 'pro' && !waRequested)}
              >
                {loading
                  ? 'جاري معالجة طلبك...'
                  : plan === 'trial'
                  ? 'إنشاء حساب تجريبي مجاني'
                  : 'التالي: الانتقال لبوابة الدفع الإلكتروني'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center" style={{ padding: '60px' }}>Loading checkout data...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
