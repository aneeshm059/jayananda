'use client';
import { useState } from 'react';
import { Pencil, Trash2, BookOpen } from 'lucide-react';
import { type Collection, type Entry } from '@/lib/domain/model';
import { forms } from '@/lib/domain/forms';
import { prettyDate } from '@/lib/domain/dates';
import type { Actions } from './journal-app';
export function EntryList({
  collection,
  entries,
  actions,
  empty = 'A few sincere moments are enough to begin.',
}: {
  collection: Collection;
  entries: Entry[];
  actions: Actions;
  empty?: string;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="entries">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!entries.length ? (
        <div className="empty-state">
          <BookOpen size={25} />
          <p>{empty}</p>
          <button className="text-button" onClick={() => actions.open(collection)}>
            Add your first entry →
          </button>
        </div>
      ) : (
        entries.map((entry) => (
          <article className="entry" key={entry.id}>
            <div className="entry-date">
              <strong>{prettyDate(entry.date, { day: 'numeric' })}</strong>
              <span>{prettyDate(entry.date, { month: 'short' })}</span>
            </div>
            <div className="entry-body">
              <h3>
                {String(
                  entry.title ||
                    entry.book ||
                    entry.service ||
                    entry.person ||
                    (collection === 'japa'
                      ? `${entry.rounds} rounds`
                      : collection === 'krishna'
                        ? `Krishna Book${entry.chapterNumber ? ' · Chapter ' + entry.chapterNumber : ''}`
                        : entry.quality || forms[collection].title),
                )}
              </h3>
              <p className="entry-meta">
                {entry.durationMinutes !== undefined && `${entry.durationMinutes} min`}
                {entry.startTime && ` · ${entry.startTime}`}
                {entry.attention && ` · Attention ${entry.attention}/5`}
                {entry.speaker && ` · ${entry.speaker}`}
                {entry.category && ` · ${entry.category}`}
                {entry.chapterCompleted ? ' · Chapter completed' : ''}
              </p>
              {forms[collection].fields
                .filter((f) => f.type === 'textarea' && entry[f.key])
                .map((f) => (
                  <p className="entry-reflection" key={f.key}>
                    <small>{f.label}</small>
                    {String(entry[f.key])}
                  </p>
                ))}
            </div>
            <div className="entry-actions">
              <button
                className="icon-button"
                aria-label="Edit entry"
                onClick={() => actions.open(collection, entry)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Delete entry"
                disabled={busy === entry.id}
                onClick={async () => {
                  if (!window.confirm('Remove this entry from your journal?')) return;
                  setBusy(entry.id);
                  try {
                    await actions.remove(collection, entry.id);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
