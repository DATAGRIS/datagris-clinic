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

  // Added states for existing account flow
  const [isExisting, setIsExisting] = useState(!!existingClinicId);
  const [clinicId, setClinicId] = useState(existingClinicId);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [nextUrl, setNextUrl] = useState('');

  // Synchronize plan and clinic ID state when search param changes
  useEffect(() => {
    const p = searchParams.get('plan');
    if (p) {
      setPlan(p);
      setError('');
    }
    const c = searchParams.get('clinic');
    if (c) {
      setClinicId(c);
      setIsExisting(true);
    }
  }, [searchParams]);

  // Translations
  const t = {
    ar: {
      registerTitle: 'تسجيل عيادة جديدة',
      upgradeTitle: 'تجديد وترقية الاشتراك',
      selectPlan: 'اختر الخطة المطلوبة',
      selectPlanTrial: 'باقة تجريبية - 7 أيام مجاناً (0 ج.م)',
      selectPlanBasic: 'الباقة الأساسية - شهري (3,000 ج.م)',
      selectPlanPro: 'الباقة الاحترافية - شهري (5,000 ج.م)',
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
      submitPaid: 'تأكيد الاشتراك والمتابعة للدفع',
      errorHeading: 'حدث خطأ',
      successHeading: 'تم بنجاح',
      proSuccessMsg: 'تم إرسال طلب تفعيل الواتساب بنجاح لشركة DATAGRIS! يرجى الانتظار من 1 إلى 3 أيام عمل لتفعيل الخدمة. اضغط التالي لإتمام عملية الدفع.',
      basicSuccessMsg: 'تم إنشاء طلب الحساب بنجاح! اضغط التالي لإتمام عملية الدفع.',
      trialSuccessMsg: 'تم إنشاء الحساب التجريبي بنجاح! سيتم تحويلك الآن لتسجيل الدخول.',
      nextBtn: 'التالي',
      loginBtn: 'تسجيل الدخول',
      clinicIdLabel: 'معرف العيادة (Clinic ID)',
      clinicIdPlaceholder: 'مثال: CLN-000001',
      existingAccountLink: 'هل لديك عيادة بالفعل؟ اضغط هنا للترقية أو التجديد',
      newAccountLink: 'تسجيل عيادة جديدة'
    },
    en: {
      registerTitle: 'Register New Clinic',
      upgradeTitle: 'Upgrade & Renew Subscription',
      selectPlan: 'Select Desired Plan',
      selectPlanTrial: '7-Day Free Trial (0 EGP)',
      selectPlanBasic: 'Basic Plan - Monthly (3,000 EGP)',
      selectPlanPro: 'Pro Plan - Monthly (5,000 EGP)',
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
      submitPaid: 'Confirm Subscription & Proceed to Payment',
      errorHeading: 'An error occurred',
      successHeading: 'Success',
      proSuccessMsg: 'WhatsApp activation request successfully sent to DATAGRIS! Please allow 1-3 business days to activate the service. Click Next to proceed to payment.',
      basicSuccessMsg: 'Account request created successfully! Click Next to proceed to payment.',
      trialSuccessMsg: 'Trial account created successfully! Redirecting you to the login page.',
      nextBtn: 'Next',
      loginBtn: 'Login',
      clinicIdLabel: 'Clinic ID',
      clinicIdPlaceholder: 'e.g., CLN-000001',
      existingAccountLink: 'Already have a clinic? Renew or upgrade here',
      newAccountLink: 'Register a new clinic'
    }
  }[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isExisting) {
        // Upgrade flow for existing clinic
        if (!clinicId) {
          throw new Error(lang === 'ar' ? 'يرجى إدخال معرف العيادة' : 'Please enter Clinic ID');
        }
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicId: clinicId,
            plan: plan,
            mobile: mobile || '01000000000',
            email: `${clinicId}@datagris-checkout.com`
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

  // Render a clean centered success screen instead of a side modal popup
  if (showSuccessModal) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-app)', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="form-card" style={{ maxWidth: '560px', width: '100%', background: 'var(--bg-card)', padding: '48px 36px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: '4.5rem', marginBottom: '24px', animation: 'scaleUp 0.5s ease-out' }}>
            {plan === 'trial' ? '🎉' : '💳'}
          </div>
          
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'var(--font-ar)' }}>
            {t.successHeading}
          </h1>
          
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '32px', fontFamily: 'var(--font-ar)' }}>
            {successMessage}
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              onClick={handleModalNext}
              className="form-submit"
              style={{
                padding: '14px 32px',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 600,
                backgroundColor: 'var(--primary)',
                fontFamily: 'var(--font-ar)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.25)'
              }}
            >
              {plan === 'trial' ? t.loginBtn : t.nextBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-app)', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: '560px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-ar)', marginBottom: '8px' }}>
            {isExisting ? t.upgradeTitle : t.registerTitle}
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
                {!isExisting && <option value="trial">{t.selectPlanTrial}</option>}
                <option value="basic">{t.selectPlanBasic}</option>
                <option value="pro">{t.selectPlanPro}</option>
              </select>
            </div>

            {isExisting ? (
              <>
                <div className="form-group">
                  <label style={{ fontFamily: 'var(--font-ar)' }}>{t.clinicIdLabel}</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder={t.clinicIdPlaceholder}
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                    disabled={loading || !!searchParams.get('clinic')}
                    style={{ direction: 'ltr', textAlign: 'left', height: '46px' }}
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
              </>
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

            {/* Toggle Link */}
            {!searchParams.get('clinic') && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsExisting(!isExisting);
                    setError('');
                  }}
                  style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-ar)', textDecoration: 'none' }}
                >
                  {isExisting ? t.newAccountLink : t.existingAccountLink}
                </a>
              </div>
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
                marginTop: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 28px',
                width: '100%',
                border: 'none',
                color: '#fff',
                fontWeight: 'bold'
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
