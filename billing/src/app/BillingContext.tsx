'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type Lang = 'ar' | 'en';

interface BillingContextProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const BillingContext = createContext<BillingContextProps | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [lang, setLang] = useState<Lang>('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('billing_theme') as Theme;
    const savedLang = localStorage.getItem('billing_lang') as Lang;
    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.className = theme;
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('billing_theme', theme);
    localStorage.setItem('billing_lang', lang);
  }, [theme, lang, mounted]);

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#2f5daa' }}>
        <h2>Loading... / جاري التحميل...</h2>
      </div>
    );
  }

  return (
    <BillingContext.Provider value={{ theme, setTheme, lang, setLang }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
