/**
 * Root layout for Next.js app with providers
 */

import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';

// Use system fonts to avoid Google Fonts connectivity issues

export const metadata: Metadata = {
  title: 'Foss It System - Hedera',
  description: 'Decentralized payroll system with Self identity verification, GitHub integration, and Hedera settlements',
  keywords: ['payroll', 'blockchain', 'hedera', 'github', 'defi', 'identity'],
  authors: [{ name: 'Foss It Team' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="font-sans h-full antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}