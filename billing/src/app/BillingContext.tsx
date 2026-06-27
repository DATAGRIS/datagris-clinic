'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type Lang = 'ar' | 'en';
type Currency = 'USD' | 'EGP' | 'SAR';

interface BillingContextProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: { EGP: number; SAR: number };
}

const BillingContext = createContext<BillingContextProps | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [lang, setLang] = useState<Lang>('ar');
  const [currency, setCurrency] = useState<Currency>('EGP');
  const [rates, setRates] = useState<{ EGP: number; SAR: number }>({ EGP: 49.53, SAR: 3.75 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('billing_theme') as Theme;
    const savedLang = localStorage.getItem('billing_lang') as Lang;
    const savedCurrency = localStorage.getItem('billing_currency') as Currency;
    if (savedTheme) setTheme(savedTheme);
    if (savedLang) setLang(savedLang);
    if (savedCurrency) setCurrency(savedCurrency);

    // Fetch live global USD exchange rates
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => res.json())
      .then((json) => {
        if (json && json.rates && json.rates.EGP && json.rates.SAR) {
          setRates({
            EGP: parseFloat(json.rates.EGP),
            SAR: parseFloat(json.rates.SAR),
          });
        }
      })
      .catch((err) => {
        console.error('Exchange rate fetch failed, using fallbacks:', err);
      });

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.className = theme;
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('billing_theme', theme);
    localStorage.setItem('billing_lang', lang);
    localStorage.setItem('billing_currency', currency);
  }, [theme, lang, currency, mounted]);

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#2f5daa' }}>
        <h2>Loading... / جاري التحميل...</h2>
      </div>
    );
  }

  return (
    <BillingContext.Provider value={{ theme, setTheme, lang, setLang, currency, setCurrency, rates }}>
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
