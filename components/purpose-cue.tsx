'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Compass, PenLine, ArrowRight } from 'lucide-react';
import type { AppState } from '@/lib/domain/model';
import type { Actions } from './journal-app';
export function PurposeCue({ state, actions }: { state: AppState; actions: Actions }) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(state.settings.purposeReminder),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="purpose-cue" aria-labelledby="purpose-cue-heading">
      <Compass size={25} />
      <div className="purpose-cue-copy">
        <h2 id="purpose-cue-heading">WHY I PRACTICE</h2>
        {editing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await actions.setSettings({ ...state.settings, purposeReminder: value });
                setEditing(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              My daily purpose reminder
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={2}
                maxLength={240}
                required
              />
            </label>
            <div className="purpose-cue-actions">
              <button className="button primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save reminder'}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <p>{state.settings.purposeReminder}</p>
        )}
      </div>
      <div className="purpose-cue-links">
        <button
          aria-label="Edit daily purpose reminder"
          className="icon-button"
          onClick={() => {
            setValue(state.settings.purposeReminder);
            setEditing(true);
          }}
        >
          <PenLine size={17} />
        </button>
        <Link href="/purpose" className="text-button">
          My purpose <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
