import type { ReactNode } from 'react';
import './globals.css';
import './companion.css';
export const metadata = {
  title: 'Jayananda · My Sādhana Journey',
  description: 'A quiet companion for hearing, chanting, reading and service.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
