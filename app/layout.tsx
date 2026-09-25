import type { ReactNode } from 'react';
import { PwaRegistration } from '@/components/pwa-registration';
import './globals.css';
import './companion.css';
export const metadata = {
  title: 'Jayananda · My Sādhana Journey',
  description: 'A quiet companion for hearing, chanting, reading and service.',
  robots: { index: false, follow: false },
  applicationName: 'Jayananda',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Jayananda', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#71382f' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
