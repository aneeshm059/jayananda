'use client';
import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flower2,
  Sun,
  Headphones,
  BookOpen,
  Moon,
  HeartHandshake,
  PenLine,
  CalendarDays,
  ChartNoAxesCombined,
  Sprout,
  Compass,
  Settings2,
  LogOut,
  Plus,
  Menu,
  Users,
  Check,
  X,
} from 'lucide-react';
import { type AppState, type Collection, type Entry, type Settings } from '@/lib/domain/model';
import { addDays, monthBounds } from '@/lib/domain/dates';
import { onDate, totals } from '@/lib/domain/calculations';
import { Dashboard } from './today';
import { EntryForm } from './entry-form';
import { FocusMode } from './focus-mode';
const PracticePage = lazy(() =>
  import('./practice-page').then((m) => ({ default: m.PracticePage })),
);
const ReviewPage = lazy(() => import('./review-page').then((m) => ({ default: m.ReviewPage })));
const SettingsPage = lazy(() =>
  import('./settings-page').then((m) => ({ default: m.SettingsPage })),
);
const InspirationPage = lazy(() =>
  import('./inspiration-page').then((m) => ({ default: m.InspirationPage })),
);
export type Actions = {
  open: (collection: Collection, entry?: Partial<Entry>) => void;
  save: (collection: Collection, data: Record<string, unknown>, id?: string) => Promise<void>;
  remove: (collection: Collection, id: string) => Promise<void>;
  focus: (kind: 'japa' | 'krishna') => void;
  setDate: (date: string) => void;
  setSettings: (settings: Settings) => Promise<void>;
};
const nav = [
  ['', 'Today', Sun],
  ['japa', 'Japa', Flower2],
  ['hearing', 'Hearing', Headphones],
  ['reading', 'Reading', BookOpen],
  ['krishna', 'Krishna Book', Moon],
  ['seva', 'Seva', HeartHandshake],
  ['association', 'Association', Users],
  ['reflection', 'Reflections', PenLine],
  ['history', 'History', CalendarDays],
  ['weekly', 'Weekly Review', ChartNoAxesCombined],
  ['monthly', 'Monthly Review', CalendarDays],
  ['jayananda', 'Jayananda', Sprout],
  ['prabhupada', 'Śrīla Prabhupāda', Flower2],
  ['purpose', 'My Purpose', Compass],
  ['settings', 'Settings', Settings2],
] as const;
async function request<T>(url: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error('Couldn’t confirm the save. Please check your connection and try again.');
  }
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Please sign in again.');
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('Couldn’t connect to your journal. Please try again.');
  }
  const problem = value as { error?: string; message?: string };
  if (!response.ok)
    throw new Error(
      problem.error || problem.message || 'Couldn’t save this entry. Please try again.',
    );
  return value as T;
}
export function JournalApp() {
  const path = usePathname().split('/')[1] ?? '';
  const [state, setState] = useState<AppState | null>(null),
    [date, setDate] = useState(''),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<{ collection: Collection; entry?: Partial<Entry> } | null>(null),
    [focus, setFocus] = useState<'japa' | 'krishna' | null>(null);
  const refresh = useCallback(async (selected?: string) => {
    const bounds = selected ? monthBounds(selected) : null;
    const suffix = bounds ? `?from=${addDays(bounds[0], -7)}&to=${addDays(bounds[1], 7)}` : '';
    const next = await request<AppState>('/api/state' + suffix);
    setState(next);
    setDate((previous) => selected || previous || next.today);
    setError('');
    return next;
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    setMobile(false);
  }, [path]);
  useEffect(() => {
    if (!state) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        state.settings.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : state.settings.theme);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state?.settings.theme]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const save = async (collection: Collection, data: Record<string, unknown>, id?: string) => {
    await request(
      '/api/data/' + collection + (id ? '?id=' + encodeURIComponent(id) : ''),
      id ? 'PATCH' : 'POST',
      data,
    );
    try {
      await refresh(date);
    } catch {
      setError(
        'Your entry was saved. Refresh the page when your connection returns to see the latest totals.',
      );
    }
    setToast(
      collection === 'reflection'
        ? 'Today has been recorded. Begin again tomorrow with sincerity.'
        : 'Saved to your journal.',
    );
  };
  const actions: Actions = {
    open: (collection, entry) => {
      const last = state?.records[collection][0];
      const defaults: Partial<Entry> = {};
      for (const key of collection === 'hearing'
        ? ['speaker', 'type', 'isPrabhupada']
        : collection === 'reading'
          ? ['book', 'chapter', 'isPrabhupada']
          : collection === 'krishna'
            ? ['chapterNumber', 'chapterTitle']
            : collection === 'seva'
              ? ['category']
              : [])
        if (last?.[key] != null) defaults[key] = last[key];
      setModal({ collection, entry: entry ?? defaults });
    },
    save,
    remove: async (collection, id) => {
      await request('/api/data/' + collection + '?id=' + encodeURIComponent(id), 'DELETE');
      await refresh(date);
      setToast('Entry removed.');
    },
    focus: setFocus,
    setDate: (value) => {
      setDate(value);
      void refresh(value).catch((e) => setError(e.message));
    },
    setSettings: async (settings) => {
      await request('/api/settings', 'PUT', settings);
      await refresh(date);
      setToast('Your preferences are saved.');
    },
  };
  if (!state)
    return (
      <main className="loading-screen">
        <Flower2 size={36} />
        <h1>Jayananda</h1>
        <p role="status">{error || 'Opening your journal…'}</p>
        {error && (
          <button
            className="button primary"
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            Try again
          </button>
        )}
      </main>
    );
  const r = onDate(state.records, date),
    t = totals(r, state.settings);
  if (focus)
    return (
      <FocusMode
        kind={focus}
        timezone={state.settings.timezone}
        completed={t.rounds}
        target={state.settings.ideal.japa}
        chapter={Number(totals(state.records, state.settings).currentChapter) || undefined}
        onExit={() => setFocus(null)}
        onFinish={(data) => {
          setModal({ collection: focus, entry: data as Partial<Entry> });
          setFocus(null);
        }}
      />
    );
  const active = nav.find((n) => n[0] === path);
  const known = Boolean(active);
  return (
    <div className={'app-shell ' + (path === 'purpose' ? 'purpose-shell' : '')}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={'sidebar ' + (mobile ? 'mobile-open' : '')}>
        <Link href="/" className="brand">
          <Flower2 size={32} />
          <div>
            <strong>{state.settings.appName}</strong>
            <span>{state.settings.subtitle}</span>
          </div>
        </Link>
        <p className="sidebar-caption">A LITTLE SINCERITY, EVERY DAY</p>
        <nav aria-label="Main navigation">
          {nav.map(([slug, label, Icon], i) => (
            <Link
              key={slug}
              href={'/' + slug}
              className={
                (path === slug ? 'active ' : '') +
                (i === 8 || i === 11 || i === 14 ? 'nav-divider' : '')
              }
              aria-current={path === slug ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {slug === 'krishna' && !t.krishna && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar">{state.settings.name.slice(0, 1)}</span>
          <div>
            <strong>{state.settings.name}</strong>
            <small>Personal journal</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await request('/api/auth/sign-out', 'POST', {});
                window.location.href = '/login';
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            My journey <span>/</span> <strong>{active?.[1] ?? 'Page not found'}</strong>
          </span>
          <div className="top-actions">
            <span className="private-label">Just you and your practice</span>
            <label className="date-control">
              <span className="sr-only">Journal date</span>
              <input
                aria-label="Journal date"
                type="date"
                value={date}
                onChange={(e) => actions.setDate(e.target.value)}
              />
            </label>
            <button
              aria-label="Quick add"
              className="button small primary"
              onClick={() =>
                actions.open(
                  path === 'hearing'
                    ? 'hearing'
                    : path === 'reading'
                      ? 'reading'
                      : path === 'krishna'
                        ? 'krishna'
                        : path === 'seva'
                          ? 'seva'
                          : 'japa',
                )
              }
            >
              <Plus size={16} />
              <span>Quick add</span>
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {state.demo && (
            <div className="demo-banner">
              Development journal · Sample entries · Local database only
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError('')}>
                Dismiss
              </button>
            </div>
          )}
          <Suspense fallback={<p className="muted">Opening this part of your journal…</p>}>
            {!state.settings.onboarded ? (
              <SettingsPage state={state} actions={actions} onboarding />
            ) : !known ? (
              <section className="page-intro">
                <h1>A quiet detour.</h1>
                <Link href="/">Return to Today →</Link>
              </section>
            ) : path === '' ? (
              <Dashboard state={state} date={date} actions={actions} />
            ) : ['history', 'weekly', 'monthly'].includes(path) ? (
              <ReviewPage
                kind={path as 'history' | 'weekly' | 'monthly'}
                state={state}
                date={date}
                actions={actions}
              />
            ) : path === 'settings' ? (
              <SettingsPage state={state} actions={actions} />
            ) : ['jayananda', 'prabhupada', 'purpose'].includes(path) ? (
              <InspirationPage
                kind={path as 'jayananda' | 'prabhupada' | 'purpose'}
                state={state}
                date={date}
                actions={actions}
              />
            ) : (
              <PracticePage
                collection={path as Collection}
                state={state}
                date={date}
                actions={actions}
              />
            )}
          </Suspense>
          <footer className="page-footer">
            <Flower2 size={14} /> Consistency · Humility · Service
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          ['', 'Today', Sun],
          ['japa', 'Japa', Flower2],
          ['reading', 'Learn', BookOpen],
          ['seva', 'Seva', HeartHandshake],
        ].map(([slug, label, Icon]) => {
          const I = Icon as typeof Sun;
          return (
            <Link key={String(slug)} href={'/' + slug} className={path === slug ? 'active' : ''}>
              <I size={21} />
              {String(label)}
            </Link>
          );
        })}
        <button aria-label="More navigation" onClick={() => setMobile(!mobile)}>
          {mobile ? <X size={21} /> : <Menu size={21} />}More
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <EntryForm
          key={modal.collection + (modal.entry?.id ?? 'new')}
          collection={modal.collection}
          entry={modal.entry}
          date={date}
          settings={state.settings}
          krishnaPending={!t.krishna}
          onRead={() => {
            setModal(null);
            setFocus('krishna');
          }}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
