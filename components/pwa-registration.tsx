'use client';
import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() =>
        console.warn('PWA setup was unavailable. The journal can still be used online.'),
      );
  }, []);
  return null;
}
