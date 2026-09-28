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
import {
  companionKeySchema,
  parseCompanionValue,
  type CompanionItem,
  type CompanionKey,
} from '@/lib/domain/companion';

type CompanionContextValue = {
  values: Record<string, unknown>;
  ready: boolean;
  saving: boolean;
  error: string;
  save: (key: string, value: unknown) => Promise<void>;
  retain: (key: string, value: unknown) => void;
  reload: () => Promise<void>;
};

const CompanionContext = createContext<CompanionContextValue | null>(null);

async function responseData(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
    items?: CompanionItem[];
    key?: CompanionKey;
    version?: number;
  } | null;
  if (!response.ok) throw new Error(data?.error || 'Could not save your place. Please try again.');
  return data;
}

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readyRef = useRef(false);
  const versions = useRef<Record<string, number>>({});
  const pending = useRef<Record<string, { value: unknown; sequence: number }>>({});
  const queues = useRef<Partial<Record<CompanionKey, Promise<void>>>>({});
  const failed = useRef<Record<string, string>>({});
  const loading = useRef<Promise<void> | null>(null);
  const sequence = useRef(0);
  const savingCount = useRef(0);

  const reload = useCallback((): Promise<void> => {
    if (loading.current) return loading.current;
    const currentWrites = Object.values(queues.current);
    const request = (async () => {
      await Promise.allSettled(currentWrites);
      try {
        const data = await responseData(await fetch('/api/companion', { cache: 'no-store' }));
        if (!data || !Array.isArray(data.items))
          throw new Error('Could not load your saved place.');
        const next: Record<string, unknown> = {};
        const nextVersions: Record<string, number> = {};
        for (const item of data.items as CompanionItem[]) {
          const key = companionKeySchema.parse(item.key);
          if (!Number.isSafeInteger(item.version) || item.version < 1)
            throw new Error('Could not load your saved place.');
          next[key] = parseCompanionValue(key, item.value);
          nextVersions[key] = item.version;
        }
        versions.current = nextVersions;
        failed.current = {};
        // Refresh remote versions without throwing away an unsaved form or player
        // checkpoint. The user can explicitly save the retained change after review.
        for (const [key, edit] of Object.entries(pending.current)) next[key] = edit.value;
        setValues(next);
        readyRef.current = true;
        setReady(true);
        setError(
          Object.keys(pending.current).length
            ? 'Saved progress reloaded. Your unsaved changes are still here; review them and save again.'
            : '',
        );
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Could not load your saved place.';
        setError(message);
        throw new Error(message);
      }
    })();
    loading.current = request;
    void request
      .finally(() => {
        loading.current = null;
      })
      .catch(() => {});
    return request;
  }, []);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    const protectPending = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) event.preventDefault();
    };
    window.addEventListener('beforeunload', protectPending);
    return () => window.removeEventListener('beforeunload', protectPending);
  }, []);

  const save = useCallback(async (rawKey: string, rawValue: unknown): Promise<void> => {
    let key: CompanionKey;
    let value: unknown;
    try {
      key = companionKeySchema.parse(rawKey);
      value = parseCompanionValue(key, rawValue);
    } catch {
      const message = 'Please check the saved location, link, and practice details.';
      setError(message);
      throw new Error(message);
    }
    if (!readyRef.current) {
      const message = 'Your saved progress is still loading. Please try again in a moment.';
      setError(message);
      throw new Error(message);
    }
    const ownSequence = ++sequence.current;
    pending.current[key] = { value, sequence: ownSequence };
    setValues((current) => ({ ...current, [key]: value }));
    savingCount.current++;
    setSaving(true);
    const previous = queues.current[key];
    const refresh = loading.current;
    const request = (async () => {
      await previous?.catch(() => {});
      await refresh;
      if (failed.current[key]) throw new Error(failed.current[key]);
      const data = await responseData(
        await fetch('/api/companion', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value, version: versions.current[key] ?? 0 }),
        }),
      );
      if (
        data?.key !== key ||
        typeof data.version !== 'number' ||
        !Number.isSafeInteger(data.version) ||
        data.version < 1
      )
        throw new Error(
          'The save could not be confirmed. Reload your saved progress before retrying.',
        );
      versions.current[key] = data.version;
      if (pending.current[key]?.sequence === ownSequence) delete pending.current[key];
      delete failed.current[key];
      setError(Object.values(failed.current)[0] || '');
    })();
    const tracked = request
      .catch((cause) => {
        const message =
          cause instanceof Error ? cause.message : 'Could not save your place. Please try again.';
        failed.current[key] = message;
        setError(message);
        throw new Error(message);
      })
      .finally(() => {
        savingCount.current--;
        setSaving(savingCount.current > 0);
        if (queues.current[key] === tracked) delete queues.current[key];
      });
    queues.current[key] = tracked;
    return tracked;
  }, []);

  // Keep the newest unsaved checkpoint across route changes without writing over
  // a server conflict. Only a later explicit save may submit this retained value.
  const retain = useCallback((rawKey: string, rawValue: unknown) => {
    try {
      const key = companionKeySchema.parse(rawKey);
      const value = structuredClone(parseCompanionValue(key, rawValue));
      pending.current[key] = { value, sequence: ++sequence.current };
      setValues((current) => ({ ...current, [key]: value }));
    } catch {
      setError(
        'Your latest place could not be retained. Keep this page open and try saving again.',
      );
    }
  }, []);

  return (
    <CompanionContext.Provider value={{ values, ready, saving, error, save, retain, reload }}>
      {children}
    </CompanionContext.Provider>
  );
}

export function useCompanion(): CompanionContextValue {
  const value = useContext(CompanionContext);
  if (!value) throw new Error('useCompanion must be used within CompanionProvider.');
  return value;
}
