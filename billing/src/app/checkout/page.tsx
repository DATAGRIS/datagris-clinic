'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useBilling } from '../BillingContext';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useBilling();
  
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

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [nextUrl, setNextUrl] = useState('');

  // Synchronize plan state when search param changes (e.g. clicking trial link in header)
  useEffect(() => {
    const p = searchParams.get('plan');
    if (p) {
      setPlan(p);
      setError('');
    }
  }, [searchParams]);

  // Translations
  const t = {
    ar: {
      registerTitle: 'تسجيل عيادة جديدة',
      upgradeTitle: 'تجديد وترقية الاشتراك',
      selectPlan: 'اختر الخطة المطلوبة',
      selectPlanTrial: 'باقة تجريبية - 7 أيام مجاناً (0 ج.م)',
      selectPlanBasic: 'الباقة الأساسية - سنوي (3,000 ج.م)',
      selectPlanPro: 'الباقة الاحترافية - سنوي (5,000 ج.م)',
      clinicLabel: 'اسم العيادة',
      clinicPlaceholder: 'مثال: عيادة داتا جريس الطبية',
      doctorLabel: 'اسم الطبيب بالكامل',
      doctorPlaceholder: 'مثال: د. أحمد ياسر',
      phoneLabel: 'رقم الهاتف (الواتساب)',
      phonePlaceholder: '010XXXXXXXX',
      usernameLabel: 'اسم مستخدم المدير',
      usernamePlaceholder: 'مثال: admin_clinic',
      passwordLabel: 'كلمة المرور',
      passwordPlaceholder: '••••••••',
      submitLoading: 'جاري معالجة طلبك...',
      submitTrial: 'إنشاء حساب تجريبي مجاني',
      submitPaid: 'إنشاء الحساب والمتابعة للدفع',
      errorHeading: 'حدث خطأ',
      successHeading: 'تم بنجاح',
      proSuccessMsg: 'تم إرسال طلب تفعيل الواتساب بنجاح لشركة DATAGRIS! يرجى الانتظار من 1 إلى 3 أيام عمل لتفعيل الخدمة. اضغط التالي لإتمام عملية الدفع.',
      basicSuccessMsg: 'تم إنشاء طلب الحساب بنجاح! اضغط التالي لإتمام عملية الدفع.',
      trialSuccessMsg: 'تم إنشاء الحساب التجريبي بنجاح! سيتم تحويلك الآن لتسجيل الدخول.',
      nextBtn: 'التالي',
      loginBtn: 'تسجيل الدخول'
    },
    en: {
      registerTitle: 'Register New Clinic',
      upgradeTitle: 'Upgrade & Renew Subscription',
      selectPlan: 'Select Desired Plan',
      selectPlanTrial: '7-Day Free Trial (0 EGP)',
      selectPlanBasic: 'Basic Plan - Annual (3,000 EGP)',
      selectPlanPro: 'Pro Plan - Annual (5,000 EGP)',
      clinicLabel: 'Clinic Name',
      clinicPlaceholder: 'e.g., Datagris Medical Clinic',
      doctorLabel: "Doctor's Full Name",
      doctorPlaceholder: 'e.g., Dr. Ahmed Yaser',
      phoneLabel: 'Phone Number (WhatsApp)',
      phonePlaceholder: '010XXXXXXXX',
      usernameLabel: 'Owner Username',
      usernamePlaceholder: 'e.g., admin_clinic',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      submitLoading: 'Processing your request...',
      submitTrial: 'Create Free Trial Account',
      submitPaid: 'Create Account & Proceed to Payment',
      errorHeading: 'An error occurred',
      successHeading: 'Success',
      proSuccessMsg: 'WhatsApp activation request successfully sent to DATAGRIS! Please allow 1-3 business days to activate the service. Click Next to proceed to payment.',
      basicSuccessMsg: 'Account request created successfully! Click Next to proceed to payment.',
      trialSuccessMsg: 'Trial account created successfully! Redirecting you to the login page.',
      nextBtn: 'Next',
      loginBtn: 'Login'
    }
  }[lang];

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
        
        // Exclude trial check for existing upgrade, directly show modal or redirect
        setSuccessMessage(plan === 'pro' ? t.proSuccessMsg : t.basicSuccessMsg);
        setNextUrl(data.url);
        setShowSuccessModal(true);
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

        // If Pro plan, trigger WhatsApp activation notification email in background
        if (plan === 'pro') {
          try {
            await fetch('/api/subscription/request-activation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clinicId: regData.clinicId,
                clinicName,
                mobile,
                username
              })
            });
          } catch (mailErr) {
            console.error('Failed to trigger background activation notification:', mailErr);
          }
        }

        if (plan === 'trial') {
          setSuccessMessage(t.trialSuccessMsg);
          setNextUrl('https://clinic.datagris.com');
          setShowSuccessModal(true);
          
          // Auto redirect after 4 seconds
          setTimeout(() => {
            window.location.href = 'https://clinic.datagris.com';
          }, 4000);
        } else {
          // Fetch Paymob redirect URL
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
          setSuccessMessage(plan === 'pro' ? t.proSuccessMsg : t.basicSuccessMsg);
          setNextUrl(data.url);
          setShowSuccessModal(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleModalNext = () => {
    window.location.href = nextUrl;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-app)', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: '560px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-ar)', marginBottom: '8px' }}>
            {existingClinicId ? t.upgradeTitle : t.registerTitle}
          </h1>
        </div>

        <div className="form-card" style={{ background: 'var(--bg-card)', padding: '36px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          {error && (
            <div className="checkout-error-banner" style={{ textAlign: 'start' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ textAlign: 'start' }}>
            {/* Plan select */}
            <div className="form-group">
              <label style={{ fontFamily: 'var(--font-ar)' }}>{t.selectPlan}</label>
              <select
                className="form-control"
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setError('');
                }}
                disabled={loading || !!searchParams.get('plan')}
                style={{ height: '46px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              >
                {!existingClinicId && <option value="trial">{t.selectPlanTrial}</option>}
                <option value="basic">{t.selectPlanBasic}</option>
                <option value="pro">{t.selectPlanPro}</option>
              </select>
            </div>

            {existingClinicId ? (
              <div className="form-group">
                <label style={{ fontFamily: 'var(--font-ar)' }}>{t.phoneLabel}</label>
                <input
                  type="tel"
                  className="form-control"
                  required
                  placeholder={t.phonePlaceholder}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  disabled={loading}
                  style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.clinicLabel}</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder={t.clinicPlaceholder}
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    disabled={loading}
                    style={{ height: '46px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.doctorLabel}</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder={t.doctorPlaceholder}
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    disabled={loading}
                    style={{ height: '46px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.phoneLabel}</label>
                  <input
                    type="tel"
                    className="form-control"
                    required
                    placeholder={t.phonePlaceholder}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={loading}
                    style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
                  />
                </div>

                <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.usernameLabel}</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder={t.usernamePlaceholder}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.passwordLabel}</label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="form-submit"
              style={{
                fontFamily: 'var(--font-ar)',
                backgroundColor: 'var(--primary)',
                cursor: 'pointer',
                height: '48px',
                borderRadius: '8px',
                marginTop: '32px'
              }}
              disabled={loading}
            >
              {loading
                ? t.submitLoading
                : plan === 'trial'
                ? t.submitTrial
                : t.submitPaid}
            </button>
          </form>
        </div>
      </div>

      {/* Success Modal Popup with Blurred Background */}
      {showSuccessModal && (
        <div className="custom-modal-overlay" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="custom-modal-card" style={{ maxWidth: '440px', padding: '32px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
              {plan === 'trial' ? '🎉' : '🔔'}
            </div>
            
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px', fontFamily: 'var(--font-ar)' }}>
              {t.successHeading}
            </h3>
            
            <p style={{ fontSize: '1rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '24px', fontFamily: 'var(--font-ar)' }}>
              {successMessage}
            </p>
            
            <button 
              onClick={handleModalNext}
              className="form-submit"
              style={{
                marginTop: '0',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '1rem',
                backgroundColor: 'var(--primary)',
                fontFamily: 'var(--font-ar)'
              }}
            >
              {plan === 'trial' ? t.loginBtn : t.nextBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center" style={{ padding: '60px', color: 'var(--text-muted)' }}>Loading checkout data...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
