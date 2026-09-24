'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Flower2 } from 'lucide-react';
import { forms, type Field } from '@/lib/domain/forms';
import { schemas } from '@/lib/domain/validation';
import { type Collection, type Entry, type Settings } from '@/lib/domain/model';
type Props = {
  collection: Collection;
  date: string;
  entry?: Partial<Entry>;
  settings: Settings;
  krishnaPending: boolean;
  onClose: () => void;
  onRead: () => void;
  onSave: (collection: Collection, data: Record<string, unknown>, id?: string) => Promise<void>;
};
export function EntryForm({
  collection,
  date,
  entry,
  settings,
  krishnaPending,
  onClose,
  onRead,
  onSave,
}: Props) {
  const requestId = useRef(crypto.randomUUID());
  const definition = forms[collection],
    dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = { date: fd.get('date') };
    for (const field of definition.fields) {
      const value = fd.get(field.key);
      data[field.key] =
        field.type === 'checkbox'
          ? value === 'on'
          : field.type === 'number'
            ? value === '' || value == null
              ? undefined
              : Number(value)
            : (value ?? undefined);
      if (['attention', 'interruptions'].includes(field.key))
        data[field.key] = value ? parseInt(String(value), 10) : undefined;
    }
    if (collection === 'wake') data.practices = fd.getAll('practice').join('|');
    const valid = schemas[collection].safeParse(data);
    if (!valid.success) {
      setError(valid.error.issues.map((i) => i.message).join(' '));
      setBusy(false);
      return;
    }
    try {
      await onSave(collection, { ...valid.data, _requestId: requestId.current }, entry?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  function fieldView(field: Field) {
    const value = entry?.[field.key] ?? field.default;
    let str = String(value ?? '');
    if (field.key === 'attention' && value)
      str = field.options?.find((o) => o.startsWith(String(value))) ?? '';
    return (
      <label key={field.key} className={field.type === 'checkbox' ? 'check-label' : ''}>
        {field.type === 'checkbox' ? (
          <>
            <input name={field.key} type="checkbox" defaultChecked={Boolean(value)} />
            {field.label}
          </>
        ) : (
          <>
            {field.label}
            {field.type === 'textarea' ? (
              <textarea
                name={field.key}
                rows={3}
                defaultValue={str}
                required={field.required}
                maxLength={10000}
              />
            ) : field.type === 'select' ? (
              <select
                aria-label={field.label}
                name={field.key}
                defaultValue={str}
                required={field.required}
              >
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o || 'Not recorded'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? 'text'}
                name={field.key}
                defaultValue={str}
                required={field.required}
                min={field.min}
                max={field.max}
                step={
                  field.type === 'number'
                    ? field.key === 'durationMinutes'
                      ? '0.01'
                      : '1'
                    : undefined
                }
                maxLength={field.type === 'text' ? 300 : undefined}
              />
            )}
          </>
        )}
      </label>
    );
  }
  return (
    <dialog
      ref={dialog}
      className="entry-dialog"
      aria-labelledby="entry-form-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <Flower2 size={24} />
        <button className="icon-button" aria-label="Close form" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <h2 id="entry-form-title">{definition.title}</h2>
      <p className="muted">{definition.subtitle}</p>
      {collection === 'reflection' && (
        <div className="gentle-note">
          {krishnaPending ? (
            <>
              <strong>Krishna Book · Pending</strong>
              <p>Would you like to read Krishna Book before closing the day?</p>
              <button type="button" className="text-button" onClick={onRead}>
                Read Krishna Book →
              </button>
              <span className="muted"> Or continue your reflection below.</span>
            </>
          ) : (
            <span>✓ Krishna Book recorded. End the day peacefully.</span>
          )}
        </div>
      )}
      <form onSubmit={submit}>
        <label>
          Date
          <input name="date" type="date" defaultValue={entry?.date ?? date} required />
        </label>
        {definition.fields.filter((f) => !f.deep).map(fieldView)}
        {collection === 'wake' && (
          <fieldset>
            <legend>My morning practices</legend>
            {settings.morningProgram.map((p) => (
              <label key={p} className="check-label">
                <input
                  type="checkbox"
                  name="practice"
                  value={p}
                  defaultChecked={String(entry?.practices ?? '')
                    .split('|')
                    .includes(p)}
                />
                {p}
              </label>
            ))}
          </fieldset>
        )}
        {definition.fields.some((f) => f.deep) && (
          <details open={!!entry?.id}>
            <summary>
              More details & reflection <span>Optional</span>
            </summary>
            <div className="details-fields">
              {definition.fields.filter((f) => f.deep).map(fieldView)}
            </div>
          </details>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Saving…'
              : collection === 'reflection'
                ? 'Offer today to Krishna'
                : 'Save entry'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
