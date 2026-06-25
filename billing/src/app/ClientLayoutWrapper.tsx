'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBilling } from './BillingContext';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const { theme, setTheme, lang, setLang } = useBilling();
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
      close: 'إغلاق'
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
      close: 'Close'
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
          {/* Minimal Settings Icon Button */}
          <button 
            onClick={() => setShowSettings(true)} 
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
          
          <Link href="/checkout?plan=trial" className="nav-btn">
            {t.startTrial}
          </Link>
        </div>
      </header>

      {/* Settings Modal Dialog */}
      {showSettings && (
        <div className="custom-modal-overlay" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div className="custom-modal-card" style={{ maxWidth: '340px', padding: '24px', position: 'relative' }}>
            {/* Close Button X */}
            <button 
              onClick={() => setShowSettings(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: lang === 'en' ? '16px' : 'auto',
                left: lang === 'ar' ? '16px' : 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontFamily: 'var(--font-ar)', textAlign: 'start' }}>
              {t.settings}
            </h3>

            {/* Language Selector */}
            <div className="form-group" style={{ marginBottom: '18px', textAlign: 'start' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-ar)' }}>
                {t.language}
              </label>
              <select 
                value={lang} 
                onChange={(e) => setLang(e.target.value as 'ar' | 'en')}
                className="form-control"
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  padding: '0 12px',
                  fontWeight: 600
                }}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Theme Selector */}
            <div className="form-group" style={{ marginBottom: '24px', textAlign: 'start' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', display: 'block', fontFamily: 'var(--font-ar)' }}>
                {t.appearance}
              </label>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                className="form-control"
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  padding: '0 12px',
                  fontWeight: 600
                }}
              >
                <option value="light">{lang === 'ar' ? 'مضيء / Light' : 'Light'}</option>
                <option value="dark">{lang === 'ar' ? 'داكن / Dark' : 'Dark'}</option>
              </select>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="form-submit"
              style={{
                marginTop: '0',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                backgroundColor: 'var(--primary)',
                fontFamily: 'var(--font-ar)'
              }}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
