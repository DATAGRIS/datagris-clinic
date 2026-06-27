'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBilling } from './BillingContext';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const { theme, setTheme, lang, setLang, currency, setCurrency } = useBilling();
  const [showSettings, setShowSettings] = useState(false);

  // Translation mapping
  const t = {
    ar: {
      pricing: 'الأسعار',
      features: 'المميزات',
      contact: 'اتصل بنا',
      startTrial: 'ابدأ التجربة المجانية',
      copyright: 'جميع الحقوق محفوظة. يتم معالجة جميع معاملات قاعدة البيانات وتأمينها وعزلها بأمان.',
      settings: 'الإعدادات',
      language: 'اللغة',
      appearance: 'المظهر',
      lightMode: 'مضيء',
      darkMode: 'داكن',
      close: 'إغلاق',
      currency: 'العملة',
      egp: 'جنيه',
      usd: 'دولار',
      sar: 'ريال'
    },
    en: {
      pricing: 'Pricing',
      features: 'Features',
      contact: 'Contact Us',
      startTrial: 'Start Free Trial',
      copyright: 'All rights reserved. All database transactions are securely processed and isolated.',
      settings: 'Settings',
      language: 'Language',
      appearance: 'Appearance',
      lightMode: 'Light',
      darkMode: 'Dark',
      close: 'Close',
      currency: 'Currency',
      egp: 'EGP',
      usd: 'USD',
      sar: 'SAR'
    }
  }[lang];

  const logoSrc = theme === 'dark' ? '/datagris_light.png' : '/datagris_dark.png';

  return (
    <>
      <header className="navbar">
        <Link href="/" className="nav-logo">
          <img src={logoSrc} alt="DATAGRIS Logo" style={{ height: '48px', objectFit: 'contain' }} />
        </Link>
        
        <nav className="nav-links">
          <Link href="/" className="nav-link">{t.pricing}</Link>
          <Link href="/features" className="nav-link">{t.features}</Link>
          <Link href="/contact" className="nav-link">{t.contact}</Link>
        </nav>

        <div className="nav-actions">
          {/* Settings button and dropdown wrapper */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="action-btn settings-btn" 
              title={t.settings}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>

            {/* Transparent click catcher to close dropdown when clicking outside */}
            {showSettings && (
              <div 
                onClick={() => setShowSettings(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 199,
                  background: 'transparent'
                }}
              />
            )}

            {/* Settings Dropdown Popover */}
            {showSettings && (
              <div 
                className="settings-dropdown" 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: lang === 'en' ? 0 : 'auto',
                  left: lang === 'ar' ? 0 : 'auto',
                  marginTop: '8px',
                  width: '260px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  padding: '16px',
                  zIndex: 200,
                  textAlign: lang === 'ar' ? 'right' : 'left'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', fontFamily: 'var(--font-ar)' }}>
                    {t.settings}
                  </span>
                  <button 
                    onClick={() => setShowSettings(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Language Selector (Side by side) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-ar)' }}>
                    {t.language}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setLang('ar')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: lang === 'ar' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: lang === 'ar' ? 'var(--primary)' : 'transparent',
                        color: lang === 'ar' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-ar)'
                      }}
                    >
                      العربية
                    </button>
                    <button 
                      onClick={() => setLang('en')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: lang === 'en' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: lang === 'en' ? 'var(--primary)' : 'transparent',
                        color: lang === 'en' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-en)'
                      }}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Theme Selector (Side by side with monochrome icons) */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-ar)' }}>
                    {t.appearance}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setTheme('light')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: theme === 'light' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: theme === 'light' ? 'var(--primary)' : 'transparent',
                        color: theme === 'light' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-ar)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4"></circle>
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                      </svg>
                      <span>{t.lightMode}</span>
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: theme === 'dark' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: theme === 'dark' ? 'var(--primary)' : 'transparent',
                        color: theme === 'dark' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-ar)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                      </svg>
                      <span>{t.darkMode}</span>
                    </button>
                  </div>
                </div>

                {/* Currency Selector (Three options) */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-ar)' }}>
                    {t.currency}
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => setCurrency('EGP')}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: currency === 'EGP' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: currency === 'EGP' ? 'var(--primary)' : 'transparent',
                        color: currency === 'EGP' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-ar)'
                      }}
                    >
                      {t.egp}
                    </button>
                    <button 
                      onClick={() => setCurrency('USD')}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: currency === 'USD' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: currency === 'USD' ? 'var(--primary)' : 'transparent',
                        color: currency === 'USD' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-en)'
                      }}
                    >
                      {t.usd}
                    </button>
                    <button 
                      onClick={() => setCurrency('SAR')}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: currency === 'SAR' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: currency === 'SAR' ? 'var(--primary)' : 'transparent',
                        color: currency === 'SAR' ? '#ffffff' : 'var(--text-main)',
                        fontFamily: 'var(--font-ar)'
                      }}
                    >
                      {t.sar}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
          
          <Link href="/checkout?plan=trial" className="nav-btn">
            {t.startTrial}
          </Link>
        </div>
      </header>

      {children}
    </>
  );
}
