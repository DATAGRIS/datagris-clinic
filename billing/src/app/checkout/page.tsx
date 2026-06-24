'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const existingClinicId = searchParams.get('clinic') || '';
  const initialPlan = searchParams.get('plan') || 'trial';

  // State
  const [plan, setPlan] = useState(initialPlan);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          router.push('/payment-success');
        } else {
          // Redirect to checkout payment for Pro registration
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
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <div className="text-center mb-24">
        <h1>{existingClinicId ? 'تجديد وترقية الاشتراك' : 'إنشاء حساب جديد'}</h1>
        <p className="subtitle-en" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
          {existingClinicId ? `Upgrade Clinic: ${existingClinicId}` : 'Get Started with DATAGRIS Clinic ERP'}
        </p>
      </div>

      <div className="form-card">
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--accent-red)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Plan selection toggle */}
          <div className="form-group">
            <label>الباقة المطلوبة / Selected Plan</label>
            <select
              className="form-control"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              disabled={loading}
            >
              {!existingClinicId && <option value="trial">باقة تجريبية - 7 أيام مجاناً / 7-Day Free Trial</option>}
              <option value="monthly">الباقة الاحترافية - شهري (499 EGP) / Monthly Pro</option>
              <option value="annual">الباقة الاحترافية - سنوي (4,990 EGP) / Annual Pro</option>
            </select>
          </div>

          {existingClinicId ? (
            /* Existing Clinic info */
            <div className="form-group">
              <label>رقم هاتف الدفع / Payer Mobile Number</label>
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
            /* Full registration fields */
            <>
              <div className="form-group">
                <label>اسم العيادة / Clinic Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="مثال: عيادة الأمل التخصصية"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>اسم الطبيب / Doctor's Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="مثال: أ.د. محمد أحمد"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>رقم المحمول / Mobile Number</label>
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

              <div className="divider"></div>

              <div className="form-group">
                <label>اسم المستخدم للمدير / Owner Username</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="أدخل اسم مستخدم بالإنجليزية (مثال: admin123)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  style={{ direction: 'ltr', textAlign: 'left' }}
                />
              </div>

              <div className="form-group">
                <label>كلمة المرور / Password</label>
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

          <button type="submit" className="form-submit" disabled={loading}>
            {loading ? 'جاري معالجة الطلب...' : (plan === 'trial' ? 'إنشاء حساب تجريبي مجاني' : 'الانتقال لبوابة الدفع الإلكتروني')}
          </button>
        </form>
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
