'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load preferences
    const savedTheme = localStorage.getItem('billing_theme') as 'light' | 'dark';
    const savedLang = localStorage.getItem('billing_lang') as 'ar' | 'en';
    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Apply classes and attributes
    document.documentElement.className = theme;
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('billing_theme', theme);
    localStorage.setItem('billing_lang', lang);
  }, [theme, lang, mounted]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleLang = () => {
    setLang(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  // Translation mapping
  const t = {
    ar: {
      pricing: 'الأسعار',
      features: 'المميزات',
      contact: 'اتصل بنا',
      startTrial: 'ابدأ التجربة المجانية',
      copyright: 'جميع الحقوق محفوظة. يتم معالجة جميع معاملات قاعدة البيانات وتأمينها وعزلها بأمان.',
      themeToggle: theme === 'light' ? '🌙 الوضع الداكن' : '☀️ الوضع المضيء',
    },
    en: {
      pricing: 'Pricing',
      features: 'Features',
      contact: 'Contact Us',
      startTrial: 'Start Free Trial',
      copyright: 'All rights reserved. All database transactions are securely processed and isolated.',
      themeToggle: theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode',
    }
  }[lang];

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#2f5daa' }}>
        <h2>Loading... / جاري التحميل...</h2>
      </div>
    );
  }

  const logoSrc = theme === 'dark' ? '/datagris_light.png' : '/datagris_dark.png';

  return (
    <>
      <header className="navbar">
        <Link href="/" className="nav-logo">
          <img src={logoSrc} alt="DATAGRIS Logo" style={{ height: '48px', objectFit: 'contain' }} />
          <span className="logo-badge">SaaS</span>
        </Link>
        
        <nav className="nav-links">
          <Link href="/" className="nav-link">{t.pricing}</Link>
          <Link href="/features" className="nav-link">{t.features}</Link>
          <Link href="/contact" className="nav-link">{t.contact}</Link>
        </nav>

        <div className="nav-actions">
          <button onClick={toggleTheme} className="action-btn theme-btn" aria-label="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={toggleLang} className="action-btn lang-btn">
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <Link href="/checkout?plan=trial" className="nav-btn">
            {t.startTrial}
          </Link>
        </div>
      </header>

      <main style={{ minHeight: 'calc(100vh - 200px)', paddingBottom: '60px' }}>
        {children}
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} DATAGRIS. {t.copyright}</p>
      </footer>
    </>
  );
}
