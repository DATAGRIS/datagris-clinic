import type { Metadata } from 'next';
import './globals.css';
import ClientLayoutWrapper from './ClientLayoutWrapper';

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
    <html lang="ar" className="light">
      <body>
        <ClientLayoutWrapper>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}
