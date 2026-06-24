import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DATAGRIS Clinic Management Billing Platform',
  description: 'Manage clinic subscriptions, register trials, and upgrade to Professional SaaS services.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="navbar">
          <Link href="/" className="nav-logo">
            <span style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 800 }}>DATAGRIS</span>
            <span style={{ fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>SaaS</span>
          </Link>
          <nav className="nav-links">
            <Link href="/" className="nav-link">Pricing / الأسعار</Link>
            <Link href="/features" className="nav-link">Features / المميزات</Link>
            <Link href="/contact" className="nav-link">Contact / اتصل بنا</Link>
            <Link href="/checkout?plan=trial" className="nav-btn">Start Free Trial</Link>
          </nav>
        </header>

        <main style={{ minHeight: 'calc(100vh - 200px)', paddingBottom: '60px' }}>
          {children}
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} DATAGRIS. All rights reserved. All database transactions are securely processed and isolated using industry standard multi-tenant parameters.</p>
        </footer>
      </body>
    </html>
  );
}
