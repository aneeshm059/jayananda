'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Settings } from '@/lib/domain/model';
import { request } from '@/lib/client';

export function ThemeToggle({
  theme,
  onSaved,
}: {
  theme: Settings['theme'];
  onSaved: (theme: Settings['theme']) => void;
}) {
  const [dark, setDark] = useState(theme === 'dark');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setDark(theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return (
    <div className="theme-control">
      <button
        className="icon-button theme-toggle"
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const saved = await request<{ theme: Settings['theme'] }>('/api/settings', 'PATCH', {
              theme: dark ? 'light' : 'dark',
            });
            onSaved(saved.theme);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      {error && (
        <p className="theme-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
