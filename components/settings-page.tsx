'use client';
import { useState } from 'react';
import { Download, Save, ArrowRight, Flower2 } from 'lucide-react';
import {
  type AppState,
  type Settings,
  type Targets,
  defaultPurpose,
  morningOptions,
  qualities,
} from '@/lib/domain/model';
import { settingsSchema } from '@/lib/domain/validation';
import { EntryList } from './entry-list';
import type { Actions } from './journal-app';
export function SettingsPage({
  state,
  actions,
  onboarding = false,
}: {
  state: AppState;
  actions: Actions;
  onboarding?: boolean;
}) {
  const [s, setS] = useState<Settings>(structuredClone(state.settings)),
    [purpose, setPurpose] = useState(String(state.records.purpose[0]?.text || defaultPurpose)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const result = settingsSchema.safeParse({ ...s, onboarded: true });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join(' '));
      return;
    }
    setBusy(true);
    try {
      if (onboarding)
        await actions.save('purpose', { date: state.today, text: purpose || defaultPurpose });
      await actions.setSettings(result.data);
      if (onboarding) window.location.href = '/';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const targetFields = (mode: 'ideal' | 'minimum') => (
    <div className="settings-grid">
      {(['japa', 'hearing', 'reading', 'krishna'] as const).map((k) => (
        <label key={k}>
          {k === 'japa'
            ? 'Japa rounds'
            : k === 'krishna'
              ? 'Krishna Book minutes'
              : k === 'hearing'
                ? 'Hearing minutes'
                : 'Reading minutes'}
          <input
            type="number"
            min={k === 'japa' ? 1 : 0}
            max={k === 'japa' ? 192 : 1440}
            required
            value={s[mode][k]}
            onChange={(e) => set(mode, { ...s[mode], [k]: Number(e.target.value) })}
          />
        </label>
      ))}
      {(['wake', 'morning', 'seva', 'reflection'] as const).map((k) => (
        <label className="check-label" key={k}>
          <input
            type="checkbox"
            checked={s[mode][k]}
            onChange={(e) => set(mode, { ...s[mode], [k]: e.target.checked })}
          />
          {k === 'wake'
            ? 'Wake by target'
            : k === 'morning'
              ? 'Morning program'
              : k === 'seva'
                ? 'Seva'
                : 'Night reflection'}
        </label>
      ))}
    </div>
  );
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">
          {onboarding ? 'A SINCERE BEGINNING' : 'MAKE THIS SPACE YOUR OWN'}
        </span>
        <h1>{onboarding ? `Hare Krishna, ${s.name}.` : 'Your rhythm, your journal.'}</h1>
        <p>
          {onboarding
            ? 'Today is a new beginning. Set a few intentions; you can change them anytime.'
            : 'Simple preferences to support the life you want to practice.'}
        </p>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <section className="panel">
          <h2>{onboarding ? 'A little about your day' : 'Personal preferences'}</h2>
          <div className="settings-grid">
            <label>
              Your name
              <input
                value={s.name}
                onChange={(e) => set('name', e.target.value)}
                required
                maxLength={80}
              />
            </label>
            <label>
              Timezone
              <input
                value={s.timezone}
                onChange={(e) => set('timezone', e.target.value)}
                required
                list="timezones"
              />
              <datalist id="timezones">
                <option>Asia/Kolkata</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>America/Los_Angeles</option>
                <option>Asia/Dubai</option>
                <option>Australia/Sydney</option>
              </datalist>
            </label>
            <label>
              Wake target
              <input
                type="time"
                value={s.wakeTarget}
                onChange={(e) => set('wakeTarget', e.target.value)}
                required
              />
            </label>
            <label>
              Sleep target
              <input
                type="time"
                value={s.sleepTarget}
                onChange={(e) => set('sleepTarget', e.target.value)}
                required
              />
            </label>
          </div>
        </section>
        <section className="panel">
          <h2>Why I practice</h2>
          <p className="muted">A personal reminder to welcome you back each day.</p>
          <label>
            Daily purpose reminder
            <textarea
              value={s.purposeReminder}
              onChange={(e) => set('purposeReminder', e.target.value)}
              maxLength={240}
              required
              rows={3}
            />
          </label>
        </section>
        <section className="panel">
          <h2>My ideal day</h2>
          <p className="muted">A rhythm to gently work toward.</p>
          {targetFields('ideal')}
        </section>
        <details className="panel" open={!onboarding}>
          <summary>
            My minimum day <span>A simpler rhythm</span>
          </summary>
          <p className="muted">For unusually demanding days. A small beginning still matters.</p>
          {targetFields('minimum')}
        </details>
        {onboarding ? (
          <details className="panel">
            <summary>
              My personal purpose <span>Optional for now</span>
            </summary>
            <label>
              Why am I doing this?
              <textarea rows={6} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </label>
          </details>
        ) : (
          <>
            <section className="panel">
              <h2>Morning & evening</h2>
              <div className="settings-grid">
                <label>
                  Evening begins at
                  <input
                    type="time"
                    value={s.eveningStart}
                    onChange={(e) => set('eveningStart', e.target.value)}
                    required
                  />
                </label>
                <label>
                  Work begins at
                  <input
                    type="time"
                    value={s.workStart}
                    onChange={(e) => set('workStart', e.target.value)}
                    required
                  />
                </label>
              </div>
              <fieldset>
                <legend>Practices in my morning program</legend>
                <div className="settings-grid">
                  {morningOptions.map((p) => (
                    <label className="check-label" key={p}>
                      <input
                        type="checkbox"
                        checked={s.morningProgram.includes(p)}
                        onChange={(e) =>
                          set(
                            'morningProgram',
                            e.target.checked
                              ? [...s.morningProgram, p]
                              : s.morningProgram.filter((v) => v !== p),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Quality of the week
                <select value={s.quality} onChange={(e) => set('quality', e.target.value)}>
                  {qualities.map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </label>
            </section>
            <section className="panel">
              <h2>Look & feel</h2>
              <div className="settings-grid">
                <label>
                  Application name
                  <input
                    value={s.appName}
                    onChange={(e) => set('appName', e.target.value)}
                    required
                    maxLength={40}
                  />
                </label>
                <label>
                  Subtitle
                  <input
                    value={s.subtitle}
                    onChange={(e) => set('subtitle', e.target.value)}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Theme
                  <select
                    value={s.theme}
                    onChange={(e) => set('theme', e.target.value as Settings['theme'])}
                  >
                    <option value="light">Warm ivory</option>
                    <option value="dark">Warm dark</option>
                    <option value="system">Follow device</option>
                  </select>
                </label>
                <label>
                  Hero preference
                  <select
                    value={s.hero}
                    onChange={(e) => set('hero', e.target.value as Settings['hero'])}
                  >
                    <option value="auto">Automatic by time</option>
                    <option value="morning">Morning always</option>
                    <option value="minimal">Minimal</option>
                    <option value="none">No cinematic image</option>
                  </select>
                </label>
              </div>
            </section>
            <details className="panel">
              <summary>
                Sādhana Health weights <span>Consistency of practice</span>
              </summary>
              <p className="fine-print">
                This reflects consistency of practice, not spiritual advancement. Weights are
                normalized automatically; attention reflection records whether you reflected, not
                how high you rated yourself.
              </p>
              <div className="settings-grid">
                {Object.entries(s.weights).map(([key, value]) => (
                  <label key={key}>
                    {
                      (
                        {
                          morning: 'Morning discipline',
                          japa: 'Japa completion',
                          quality: 'Japa quality reflection',
                          hearing: 'Hearing',
                          reading: 'Daytime reading',
                          krishna: 'Krishna Book',
                          seva: 'Seva',
                          reflection: 'Night reflection',
                          association: 'Association',
                        } as Record<string, string>
                      )[key]
                    }
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) =>
                        set('weights', { ...s.weights, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {onboarding ? <Flower2 size={18} /> : <Save size={17} />}{' '}
          {busy ? 'Saving…' : onboarding ? 'Begin today’s sādhana' : 'Save preferences'}
          {onboarding && <ArrowRight size={17} />}
        </button>
      </form>
      {!onboarding && (
        <>
          <section className="panel settings-extra">
            <div className="section-heading">
              <h2>Gentle reminders</h2>
              <button className="text-button" onClick={() => actions.open('reminders')}>
                + Add a reminder
              </button>
            </div>
            <p className="muted">
              Optional cues on your Today page. No browser notifications are sent in Version 1.
            </p>
            <EntryList
              collection="reminders"
              entries={state.records.reminders}
              actions={actions}
              empty="Let your day remain quiet. Add a cue only if it helps."
            />
          </section>
          <section className="panel settings-extra">
            <h2>Your data belongs to you</h2>
            <p className="muted">
              Download your complete journal or an individual practice. Exports contain private
              reflections.
            </p>
            <div className="export-links">
              <a className="button secondary" href="/api/export" download>
                <Download size={16} /> All data · JSON
              </a>
              {[
                ['habits', 'Habits'],
                ['japa', 'Japa'],
                ['hearing', 'Hearing'],
                ['reading', 'Reading'],
                ['krishna', 'Krishna Book'],
                ['seva', 'Seva'],
                ['reflection', 'Night reflections'],
              ].map(([key, label]) => (
                <a
                  key={key}
                  className="button secondary"
                  href={'/api/export?collection=' + key}
                  download
                >
                  {label} · CSV
                </a>
              ))}
            </div>
          </section>
          <PasswordSettings />
        </>
      )}
    </>
  );
}
function PasswordSettings() {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <details className="panel settings-extra">
      <summary>
        Account security <span>Change password</span>
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = e.currentTarget,
            fd = new FormData(form);
          try {
            const res = await fetch('/api/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                currentPassword: fd.get('current'),
                newPassword: fd.get('next'),
                revokeOtherSessions: true,
              }),
            });
            setMessage(
              res.ok
                ? 'Password changed. Other sessions have been signed out.'
                : 'Couldn’t change the password. Check your current password.',
            );
            if (res.ok) form.reset();
          } catch {
            setMessage('Couldn’t connect. Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Current password
          <input type="password" name="current" autoComplete="current-password" required />
        </label>
        <label>
          New password
          <input
            type="password"
            name="next"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <button className="button secondary" disabled={busy}>
          Change password
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
