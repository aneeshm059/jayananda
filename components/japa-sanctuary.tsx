'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Minus, Pause, Play, Plus } from 'lucide-react';
import type { JapaDraft, SavedInstruction } from '@/lib/domain/companion';
import type { AppState } from '@/lib/domain/model';
import { localDate } from '@/lib/domain/dates';
import { onDate, totals, dayMode } from '@/lib/domain/calculations';
import { useCompanion } from './companion-provider';
import { MalaIcon } from './mala-icon';
import type { Actions } from './journal-app';

export function JapaSanctuary({
  state,
  actions,
  onExit,
}: {
  state: AppState;
  actions: Actions;
  onExit: () => void;
}) {
  const { ready, error, reload } = useCompanion();
  if (!ready)
    return (
      <main className="loading-screen">
        <MalaIcon size={40} />
        <p role="status">{error || 'Finding your unfinished session…'}</p>
        {error && <button onClick={() => void reload().catch(() => {})}>Try again</button>}
        <button className="text-button" onClick={onExit}>
          Return
        </button>
      </main>
    );
  return <JapaSession state={state} actions={actions} onExit={onExit} />;
}

function JapaSession({
  state,
  actions,
  onExit,
}: {
  state: AppState;
  actions: Actions;
  onExit: () => void;
}) {
  const { values, save, error: storeError, reload } = useCompanion();
  const previous = values['japa-draft'] as JapaDraft | null | undefined;
  const initial = useRef<JapaDraft>(
    previous ?? {
      rounds: 0,
      elapsedSeconds: 0,
      startedAt: new Date().toISOString(),
      pausedAt: '',
      running: false,
      date: localDate(state.settings.timezone),
      note: '',
      sessionId: crypto.randomUUID(),
    },
  );
  const [rounds, setRounds] = useState(initial.current.rounds),
    [elapsed, setElapsed] = useState(initial.current.elapsedSeconds),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(
      previous ? 'Your unfinished session is ready. The timer is paused.' : '',
    ),
    [showTime, setShowTime] = useState(false),
    [checking, setChecking] = useState(Boolean(previous)),
    [canRetry, setCanRetry] = useState(false),
    [reloadRequired, setReloadRequired] = useState(false),
    [savedEntry, setSavedEntry] = useState(false);
  const draft = useRef({ ...initial.current, running: false }),
    anchor = useRef(performance.now()),
    base = useRef(initial.current.elapsedSeconds),
    active = useRef(false),
    dirty = useRef(false),
    revision = useRef(0),
    saveFn = useRef(save),
    blocked = useRef(false),
    operation = useRef(false),
    journalSaved = useRef(false),
    globalError = useRef(storeError),
    activeSave = useRef<Promise<void> | null>(null),
    persist = useRef<(reviewed?: boolean) => Promise<void>>(async () => {});
  saveFn.current = save;
  globalError.current = storeError;
  const instruction = values.instruction as SavedInstruction | null | undefined;
  const t = totals(onDate(state.records, state.today), state.settings),
    target = state.settings[dayMode(onDate(state.records, state.today))].japa;
  const currentSeconds = () =>
    Math.min(
      86400,
      Math.max(
        0,
        base.current + (active.current ? (performance.now() - anchor.current) / 1000 : 0),
      ),
    );
  const changed = () => {
    dirty.current = true;
    revision.current++;
  };
  const snapshot = (): JapaDraft => ({
    ...draft.current,
    elapsedSeconds: currentSeconds(),
    running: active.current,
    pausedAt: active.current ? '' : draft.current.pausedAt || new Date().toISOString(),
  });
  function pause() {
    base.current = currentSeconds();
    active.current = false;
    draft.current = {
      ...draft.current,
      elapsedSeconds: base.current,
      running: false,
      pausedAt: new Date().toISOString(),
    };
    setElapsed(base.current);
    setRunning(false);
  }
  // A previous finish can have saved rounds while its following draft-clear failed.
  // Check the idempotent entry ID before allowing that draft to acquire more rounds.
  async function checkSavedRecord() {
    let found = state.records.japa.some((entry) => entry.id === draft.current.sessionId);
    if (!found) {
      const date = encodeURIComponent(draft.current.date);
      const response = await fetch(`/api/data/japa?from=${date}&to=${date}`, { cache: 'no-store' });
      const entries: unknown = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(entries))
        throw new Error(
          'Could not check whether these rounds are already saved. Please reload before continuing.',
        );
      found = entries.some(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          'id' in entry &&
          entry.id === draft.current.sessionId,
      );
    }
    if (found) {
      journalSaved.current = true;
      setSavedEntry(true);
      pause();
      dirty.current = false;
      setStatus(
        'These rounds are already in your journal. Finish to clear the unfinished-session bookmark.',
      );
    }
    return found;
  }
  persist.current = async (reviewed = false) => {
    if (activeSave.current) await activeSave.current;
    if (!dirty.current || journalSaved.current) return;
    if (!reviewed && (blocked.current || globalError.current))
      throw new Error(
        'Saving is paused. Reload saved progress, then review and save this session.',
      );
    const next = snapshot(),
      savedRevision = revision.current;
    const request = (async () => {
      try {
        await saveFn.current('japa-draft', next);
        dirty.current = revision.current !== savedRevision;
        blocked.current = false;
        setError('');
        setStatus(
          dirty.current ? 'Your latest changes are waiting to be saved.' : 'Your session is saved.',
        );
      } catch (cause) {
        pause();
        changed();
        blocked.current = true;
        setError(cause instanceof Error ? cause.message : 'Your session could not be saved.');
        setStatus('');
        throw cause;
      }
    })();
    activeSave.current = request;
    try {
      await request;
    } finally {
      if (activeSave.current === request) activeSave.current = null;
    }
  };
  useEffect(() => {
    if (!previous) return;
    let cancelled = false;
    void checkSavedRecord()
      .catch((cause) => {
        if (!cancelled) {
          blocked.current = true;
          setError((cause as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const clock = window.setInterval(() => {
      if (active.current) {
        setElapsed(currentSeconds());
        changed();
      }
    }, 1000);
    const autosave = window.setInterval(() => {
      if (!operation.current && !journalSaved.current && !blocked.current && !globalError.current)
        void persist.current().catch(() => {});
    }, 10000);
    const visibility = () => {
      if (
        document.visibilityState === 'hidden' &&
        !operation.current &&
        !journalSaved.current &&
        !blocked.current &&
        !globalError.current
      ) {
        if (active.current) changed();
        void persist.current().catch(() => {});
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current || activeSave.current || operation.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(autosave);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
  function toggle() {
    if (
      operation.current ||
      checking ||
      journalSaved.current ||
      blocked.current ||
      globalError.current
    )
      return;
    if (active.current) pause();
    else {
      anchor.current = performance.now();
      active.current = true;
      draft.current.running = true;
      draft.current.pausedAt = '';
      setRunning(true);
    }
    changed();
    void persist.current().catch(() => {});
  }
  async function adjust(delta: number) {
    if (
      operation.current ||
      checking ||
      journalSaved.current ||
      blocked.current ||
      globalError.current
    )
      return;
    const value = Math.min(192, Math.max(0, draft.current.rounds + delta));
    if (value === draft.current.rounds) return;
    draft.current.rounds = value;
    setRounds(value);
    changed();
    await persist.current().catch(() => {});
  }
  async function leave() {
    if (operation.current || checking) return;
    if (reloadRequired) {
      window.location.reload();
      return;
    }
    if (journalSaved.current) {
      onExit();
      return;
    }
    operation.current = true;
    setBusy(true);
    pause();
    changed();
    try {
      await persist.current();
      onExit();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function finish(reviewed = false) {
    if (operation.current || checking || reloadRequired || draft.current.rounds <= 0) return;
    operation.current = true;
    setBusy(true);
    pause();
    try {
      if (activeSave.current) await activeSave.current;
      if (!journalSaved.current) {
        // Flush the final count through the version check before creating an entry.
        changed();
        await persist.current(reviewed);
        await actions.save('japa', {
          date: draft.current.date,
          rounds: draft.current.rounds,
          durationMinutes: Math.round(base.current / 6) / 10,
          _requestId: draft.current.sessionId,
        });
        journalSaved.current = true;
        setSavedEntry(true);
        dirty.current = false;
      }
      // A retry after a clear failure must never erase a new session started on
      // another device. The following versioned write still guards the read/write race.
      const response = await fetch('/api/companion', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as {
        items?: { key: string; value: JapaDraft | null }[];
      } | null;
      if (!response.ok || !Array.isArray(payload?.items))
        throw new Error(
          'Could not verify the unfinished-session bookmark. Please reload and try again.',
        );
      const remote = payload.items.find((item) => item.key === 'japa-draft')?.value;
      if (remote && remote.sessionId !== draft.current.sessionId) {
        setReloadRequired(true);
        setCanRetry(false);
        blocked.current = true;
        setError('');
        setStatus(
          'Your rounds are saved. Another device has a different unfinished session; open the latest saved progress to continue.',
        );
        return;
      }
      if (remote) await saveFn.current('japa-draft', null);
      else await reload();
      dirty.current = false;
      blocked.current = false;
      setCanRetry(false);
      onExit();
    } catch (cause) {
      blocked.current = true;
      const message =
        cause instanceof Error ? cause.message : 'Could not finish saving your session.';
      setError(
        journalSaved.current
          ? `Your rounds are saved. The unfinished-session bookmark still needs clearing. ${message}`
          : message,
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function recover() {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    pause();
    try {
      await reload();
      await checkSavedRecord();
      // Reload refreshes versions, but never automatically writes the retained draft.
      blocked.current = true;
      setCanRetry(true);
      setError('');
      setChecking(false);
      setStatus(
        journalSaved.current
          ? 'Your rounds are already saved. Review and finish clearing this session.'
          : 'Review the rounds and time shown here, then save this session.',
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function reviewAndSave() {
    if (journalSaved.current) {
      await finish(true);
      return;
    }
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    changed();
    try {
      await persist.current(true);
      setCanRetry(false);
    } catch {
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const controlsBlocked =
    busy || checking || savedEntry || canRetry || reloadRequired || !!error || !!storeError;
  return (
    <main className="japa-sanctuary">
      <header>
        <button className="quiet-link" onClick={() => void leave()} disabled={busy || checking}>
          <ArrowLeft size={17} />
          Save & return
        </button>
        <span>YOUR QUIET JAPA SPACE</span>
        <button className="quiet-link" onClick={() => setShowTime(!showTime)}>
          {showTime ? 'Hide timer' : 'Show timer'}
        </button>
      </header>
      <div className="japa-sanctuary-body">
        <MalaIcon size={98} />
        <span className="eyebrow">HEAR THE HOLY NAME</span>
        <h1>Be here, with the next round.</h1>
        {instruction?.text ? (
          <p className="sanctuary-instruction">{instruction.text}</p>
        ) : (
          <p>Settle in. Give your attention to the sound.</p>
        )}
        <div className="sanctuary-counter">
          <button
            className="icon-button"
            aria-label="Subtract one round"
            disabled={rounds === 0 || controlsBlocked}
            onClick={() => void adjust(-1)}
          >
            <Minus size={24} />
          </button>
          <div>
            <strong>{rounds}</strong>
            <span>rounds in this session</span>
          </div>
          <button
            className="icon-button"
            aria-label="Add one round"
            disabled={rounds >= 192 || controlsBlocked}
            onClick={() => void adjust(1)}
          >
            <Plus size={25} />
          </button>
        </div>
        <p className="sanctuary-total">
          {t.rounds} saved today · your commitment is {target} rounds
        </p>
        {draft.current.date !== state.today && (
          <p className="fine-print">
            This unfinished session belongs to {draft.current.date}. Finish it to begin a new
            session today.
          </p>
        )}
        {showTime && (
          <time className="sanctuary-clock">
            {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
          </time>
        )}
        <div className="sanctuary-actions">
          <button className="button secondary" onClick={toggle} disabled={controlsBlocked}>
            {running ? <Pause size={17} /> : <Play size={17} />}{' '}
            {running ? 'Pause' : 'Begin / resume'}
          </button>
          <button
            className="button primary"
            onClick={() => void finish()}
            disabled={
              busy ||
              checking ||
              rounds === 0 ||
              canRetry ||
              reloadRequired ||
              !!error ||
              !!storeError
            }
          >
            <Check size={17} />
            {busy ? 'Saving…' : savedEntry ? 'Finish saved session' : 'Finish & save rounds'}
          </button>
        </div>
        <div role="status" className="save-status">
          {error || storeError ? (
            <>
              <p className="error">{error || storeError}</p>
              <button className="text-button" disabled={busy} onClick={() => void recover()}>
                Reload saved progress
              </button>
            </>
          ) : (
            status || 'An unfinished session will be kept for your next visit.'
          )}
        </div>
        {checking && <p role="status">Checking your unfinished session…</p>}
        {canRetry && (
          <button className="button secondary" disabled={busy} onClick={() => void reviewAndSave()}>
            {savedEntry ? 'Review & finish saved session' : 'Review & save this session'}
          </button>
        )}
        {reloadRequired && (
          <button className="button secondary" onClick={() => window.location.reload()}>
            Open latest saved progress
          </button>
        )}
      </div>
      <footer>Chant with your beads. Keep this space as quiet as you need.</footer>
    </main>
  );
}
