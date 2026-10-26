import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SwRegister } from '@/components/SwRegister';

export const metadata: Metadata = {
  title: 'منظومة التنظيم',
  description: 'قياس أداء وتحفيز الأعضاء والأمانات',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#16714a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
