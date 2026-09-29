'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RefreshCw } from 'lucide-react';
import { request } from '@/lib/client';
import { bundledAcharyaLectures } from '@/lib/domain/acharya-catalog';
import type { AcharyaLibraryResponse } from '@/lib/domain/acharya-sync';

const initial: AcharyaLibraryResponse = {
  lessons: bundledAcharyaLectures,
  source: 'bundled',
  lastSynced: null,
  status: 'idle',
  canContinue: false,
  scanned: 0,
  matched: bundledAcharyaLectures.length,
  unverified: 0,
  error: '',
  retryAfterSeconds: 0,
};
type Library = {
  catalog: AcharyaLibraryResponse;
  ready: boolean;
  syncing: boolean;
  message: string;
  sync: () => Promise<void>;
  stop: () => void;
};
const Context = createContext<Library | null>(null);

export function LectureLibraryProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState(initial);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false),
    generation = useRef(0),
    mounted = useRef(false);
  const stop = useCallback(() => {
    if (running.current)
      setMessage('Sync paused. Select Resume sync to continue from the saved scan.');
    running.current = false;
    generation.current++;
    setSyncing(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void request<AcharyaLibraryResponse>('/api/lectures/acharya')
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((cause: Error) => {
        if (active) setMessage(`Showing the saved lecture library. ${cause.message}`);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      mounted.current = false;
      running.current = false;
      generation.current++;
    };
  }, []);
  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const current = ++generation.current;
    setSyncing(true);
    setMessage('Checking The Acharya for English lectures of 30–45 minutes…');
    try {
      for (let chunk = 0; chunk < 200; chunk++) {
        const result = await request<AcharyaLibraryResponse>('/api/lectures/acharya', 'POST', {
          action: 'sync',
        });
        if (!mounted.current || generation.current !== current) return;
        setCatalog(result);
        if (result.status === 'error') {
          setMessage(
            result.error || 'Sync paused. Your existing lectures and listening progress are safe.',
          );
          return;
        }
        if (!result.canContinue) {
          setMessage(
            result.status === 'syncing'
              ? 'Another sync is finishing a step. Select Resume sync in a moment to continue.'
              : `Library up to date. ${result.lessons.length} English lectures of 30–45 minutes are ready.`,
          );
          return;
        }
        setMessage(
          `Checking the channel: ${result.scanned} uploads scanned · ${result.matched} English lectures verified. You can keep listening while this runs.`,
        );
      }
      setMessage(
        'Sync paused after a long scan. Select Resume sync to continue; your lecture library is kept.',
      );
    } catch (cause) {
      if (mounted.current && generation.current === current)
        setMessage(
          `Sync paused. ${cause instanceof Error ? cause.message : 'Please try again.'} Your existing library is kept.`,
        );
    } finally {
      if (mounted.current && generation.current === current) {
        running.current = false;
        setSyncing(false);
      }
    }
  }, []);
  return (
    <Context.Provider value={{ catalog, ready, syncing, message, sync, stop }}>
      {children}
    </Context.Provider>
  );
}

export function useLectureLibrary() {
  const value = useContext(Context);
  if (!value) throw new Error('LectureLibraryProvider is missing.');
  return value;
}

export function LectureSync() {
  const { catalog, ready, syncing, message, sync, stop } = useLectureLibrary();
  useEffect(() => () => stop(), [stop]);
  return (
    <div className="lecture-sync">
      <div>
        <span className="eyebrow">THE ACHARYA · ENGLISH · 30–45 MINUTES</span>
        <p>
          {catalog.lessons.length} lectures in your library. New lectures join the end of your list.
        </p>
        <small>
          {catalog.lastSynced
            ? `Last synced ${new Date(catalog.lastSynced).toLocaleString()}`
            : 'Verified library included. Sync to check for new uploads.'}
        </small>
      </div>
      <div className="lecture-sync-actions">
        <button
          className="button secondary"
          disabled={!ready || syncing}
          onClick={() => void sync()}
        >
          <RefreshCw size={16} className={syncing ? 'sync-spinning' : ''} />
          {syncing
            ? 'Syncing lectures…'
            : catalog.status !== 'idle'
              ? 'Resume sync'
              : 'Sync lectures'}
        </button>
        {syncing && (
          <button className="text-button" onClick={stop}>
            Pause sync
          </button>
        )}
      </div>
      {message && (
        <p className="fine-print lecture-sync-status" role="status">
          {message}
        </p>
      )}
      {!syncing && catalog.unverified > 0 && (
        <p className="fine-print lecture-sync-status">
          {catalog.unverified} videos could not be verified as English and are kept out of this
          library.
        </p>
      )}
    </div>
  );
}
