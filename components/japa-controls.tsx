'use client';
import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Entry } from '@/lib/domain/model';
import { latestCountedSession } from '@/lib/domain/japa';
import type { Actions } from './journal-app';

export function JapaControls({
  entries,
  date,
  actions,
}: {
  entries: Entry[];
  date: string;
  actions: Actions;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const pending = useRef<{ date: string; rounds: number; _requestId: string } | null>(null);
  const latest = latestCountedSession(entries, date);
  async function adjust(amount: number) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (amount < 0) {
        if (latest) await actions.decrementJapa(latest);
      } else {
        pending.current ??= { date, rounds: amount, _requestId: crypto.randomUUID() };
        await actions.save('japa', { ...pending.current, durationMinutes: 0 });
        pending.current = null;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="japa-controls" aria-busy={busy}>
      <div className="japa-counter-buttons">
        <button
          className="button secondary"
          aria-label="Subtract one Japa round"
          disabled={busy || !latest || !!pending.current}
          onClick={() => void adjust(-1)}
        >
          <Minus size={16} /> 1 round
        </button>
        {[1, 4].map((n) => (
          <button
            key={n}
            className={'button ' + (n === 1 ? 'primary' : 'secondary')}
            aria-label={`Add ${n === 1 ? 'one Japa round' : 'four Japa rounds'}`}
            disabled={busy || (!!pending.current && pending.current.rounds !== n)}
            onClick={() => void adjust(n)}
          >
            <Plus size={16} /> {n} {n === 1 ? 'round' : 'rounds'}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
          {pending.current && ` Retry + ${pending.current.rounds} to confirm that save.`}
        </p>
      )}
    </div>
  );
}
