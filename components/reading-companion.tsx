'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Bookmark, BookOpen, Check, Flower2, Moon, PenLine } from 'lucide-react';
import type { AppState } from '@/lib/domain/model';
import type { BookBookmark } from '@/lib/domain/companion';
import { bookCatalog, prabhupadaBookUrl } from '@/lib/domain/book-catalog';
import {
  gitaVerseCounts,
  gitaUrl,
  gitaLabel,
  type GitaPosition,
  type GitaReadingResponse,
} from '@/lib/domain/gita-reading';
import { prettyDate } from '@/lib/domain/dates';
import type { Actions } from './journal-app';
import { useCompanion } from './companion-provider';
import { PracticePage } from './practice-page';

type ReadingSnapshot = GitaReadingResponse;
type FinishDraft = {
  chapter: string;
  verse: string;
  minutes: string;
  note: string;
  requestId: string;
};
const gita = bookCatalog.find((book) => book.id === 'bg')!;

function validPosition(chapter: number, verse: number): boolean {
  return (
    Number.isInteger(chapter) &&
    chapter >= 1 &&
    chapter <= gitaVerseCounts.length &&
    Number.isInteger(verse) &&
    verse >= 1 &&
    verse <= gitaVerseCounts[chapter - 1]
  );
}

function bookmarkSuggestion(bookmark: BookBookmark | null): GitaPosition | null {
  if (bookmark?.bookId !== 'bg' || !prabhupadaBookUrl(bookmark.url)) return null;
  const match = new URL(bookmark.url).pathname.match(/^\/bg\/(\d+)\/(\d+)(?:-\d+)?\/?$/);
  if (!match) return null;
  const chapter = Number(match[1]),
    verse = Number(match[2]);
  return validPosition(chapter, verse) ? { chapter, verse } : null;
}

function oldBookmark(value: unknown): BookBookmark | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return ['bookId', 'location', 'url', 'note', 'updatedAt'].every(
    (key) => typeof item[key] === 'string',
  )
    ? (item as BookBookmark)
    : null;
}

class ReadingError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

async function readingRequest(payload?: Record<string, unknown>): Promise<ReadingSnapshot> {
  let response: Response;
  try {
    response = await fetch('/api/reading-progress', {
      method: payload ? 'POST' : 'GET',
      cache: 'no-store',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch {
    throw new ReadingError(
      'Couldn’t confirm the save. Your reading details are still here; please try again.',
    );
  }
  const data = (await response.json().catch(() => null)) as
    (Partial<ReadingSnapshot> & { error?: string }) | null;
  if (!response.ok)
    throw new ReadingError(
      data?.error || 'Couldn’t save your reading. Please try again.',
      response.status,
    );
  if (!data || !Number.isSafeInteger(data.version) || !('progress' in data))
    throw new ReadingError('Couldn’t confirm your saved place. Please try again.');
  return data as ReadingSnapshot;
}

function draftKey(sessionId: string) {
  return 'jayananda-reading-finish:' + sessionId;
}

function finishDraft(sessionId: string, start: GitaPosition): FinishDraft {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(draftKey(sessionId)) || 'null',
    ) as FinishDraft | null;
    if (
      stored &&
      ['chapter', 'verse', 'minutes', 'note', 'requestId'].every(
        (key) => typeof stored[key as keyof FinishDraft] === 'string',
      ) &&
      stored.note.length <= 10000 &&
      /^[0-9a-f-]{36}$/i.test(stored.requestId)
    )
      return stored;
  } catch {
    /* A browser without storage can still finish a reading session. */
  }
  return {
    chapter: String(start.chapter),
    verse: String(start.verse),
    minutes: '',
    note: '',
    requestId: crypto.randomUUID(),
  };
}

export function ReadingCompanion({
  state,
  actions,
  date = state.today,
}: {
  state: AppState;
  actions: Actions;
  date?: string;
}) {
  const companion = useCompanion();
  const bookmark = oldBookmark(companion.values.book);
  const [snapshot, setSnapshot] = useState<ReadingSnapshot>({ progress: null, version: 0 });
  const suggestion = snapshot.suggestedStart ?? bookmarkSuggestion(bookmark);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<'load' | 'start' | 'finish' | ''>('load');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [firstChapter, setFirstChapter] = useState('1');
  const [firstVerse, setFirstVerse] = useState('1');
  const firstEdited = useRef(false);
  const startRequest = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [showFinish, setShowFinish] = useState(false);
  const [draft, setDraft] = useState<FinishDraft | null>(null);
  const [retainedDraft, setRetainedDraft] = useState<FinishDraft | null>(null);
  const draftSession = useRef('');
  const draftDirty = useRef(false);
  const currentDraft = useRef({ snapshot, draft });
  currentDraft.current = { snapshot, draft };
  const [lastNote, setLastNote] = useState('');
  const finishRef = useRef<HTMLElement>(null);
  const active = snapshot.progress?.session ?? null;
  const completed = snapshot.progress?.completed ?? false;
  const firstTime = loaded && snapshot.progress === null;
  const startPosition = active?.start ??
    snapshot.progress?.cursor ?? {
      chapter: Number(firstChapter),
      verse: Number(firstVerse),
    };

  const reloadProgress = useCallback(async () => {
    setBusy('load');
    setError('');
    try {
      const next = await readingRequest();
      const current = currentDraft.current;
      if (
        draftDirty.current &&
        current.draft &&
        current.snapshot.progress?.session &&
        current.snapshot.progress.session.id !== next.progress?.session?.id
      ) {
        setRetainedDraft(current.draft);
        setMessage('Your saved place has changed. Your entered reading details are kept below.');
      }
      setSnapshot(next);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t load your reading place.');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => {
    void reloadProgress();
  }, [reloadProgress]);
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (draftDirty.current || inFlight.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, []);
  useEffect(() => {
    if (!firstEdited.current && suggestion) {
      setFirstChapter(String(suggestion.chapter));
      setFirstVerse(String(suggestion.verse));
    }
  }, [suggestion?.chapter, suggestion?.verse]);
  useEffect(() => {
    if (active && draftSession.current !== active.id) {
      const restored = finishDraft(active.id, active.start);
      draftSession.current = active.id;
      setDraft(restored);
      try {
        const hadDraft = sessionStorage.getItem(draftKey(active.id)) !== null;
        setShowFinish(hadDraft);
        draftDirty.current = hadDraft;
      } catch {
        setShowFinish(false);
      }
    } else if (!active) {
      draftSession.current = '';
      draftDirty.current = false;
      setDraft(null);
      setShowFinish(false);
    }
  }, [active?.id]);

  function editFirst(chapter: string, verse: string) {
    firstEdited.current = true;
    startRequest.current = null;
    setFirstChapter(chapter);
    setFirstVerse(verse);
    setError('');
  }

  function editFinish(patch: Partial<FinishDraft>) {
    if (!draft || !active) return;
    const next = { ...draft, ...patch, requestId: crypto.randomUUID() };
    draftDirty.current = true;
    setDraft(next);
    setError('');
    try {
      sessionStorage.setItem(draftKey(active.id), JSON.stringify(next));
    } catch {
      /* Keep the draft in memory. */
    }
  }

  async function startReading() {
    if (inFlight.current || active || completed || !loaded) return;
    if (!validPosition(startPosition.chapter, startPosition.verse)) {
      setError('Choose a valid chapter and verse before you begin.');
      return;
    }
    inFlight.current = true;
    setBusy('start');
    setError('');
    setMessage('');
    // Reserve the new tab during the click; navigate only after the server saves the start.
    const readingTab = window.open('about:blank', '_blank');
    if (readingTab) {
      readingTab.opener = null;
      readingTab.document.title = 'Opening your reading place…';
      readingTab.document.body.textContent =
        'Saving your starting verse. Your book will open in a moment.';
    }
    startRequest.current ??= crypto.randomUUID();
    try {
      const next = await readingRequest({
        action: 'start',
        version: snapshot.version,
        requestId: startRequest.current,
        ...(firstTime ? { start: startPosition } : {}),
      });
      if (!next.progress?.session)
        throw new ReadingError(
          'Couldn’t confirm your starting verse. Please reload your saved place.',
        );
      setSnapshot(next);
      startRequest.current = null;
      if (readingTab && !readingTab.closed)
        readingTab.location.replace(gitaUrl(next.progress.session.start));
      else setMessage('Your start is saved. Select Continue reading to open your verse.');
      void companion.reload().catch(() => {});
    } catch (cause) {
      readingTab?.close();
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t start reading. Please try again.',
      );
    } finally {
      inFlight.current = false;
      setBusy('');
    }
  }

  async function finishReading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !active || !draft) return;
    const end = { chapter: Number(draft.chapter), verse: Number(draft.verse) };
    if (
      !validPosition(end.chapter, end.verse) ||
      end.chapter < active.start.chapter ||
      (end.chapter === active.start.chapter && end.verse < active.start.verse)
    ) {
      setError('Choose the last verse you read, at or after your starting verse.');
      return;
    }
    const minutes = draft.minutes.trim() ? Number(draft.minutes) : undefined;
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)) {
      setError('Reading time can be between 0 and 1,440 minutes, or left blank.');
      return;
    }
    inFlight.current = true;
    setBusy('finish');
    setError('');
    setMessage('');
    const savedSessionId = active.id;
    try {
      // Keep the request identity and draft for an unchanged retry, including after a reload.
      try {
        sessionStorage.setItem(draftKey(savedSessionId), JSON.stringify(draft));
      } catch {
        /* In-memory retry still works. */
      }
      const next = await readingRequest({
        action: 'finish',
        version: snapshot.version,
        requestId: draft.requestId,
        sessionId: active.id,
        end,
        ...(minutes === undefined ? {} : { durationMinutes: minutes }),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      });
      setSnapshot(next);
      draftDirty.current = false;
      setLastNote(draft.note.trim());
      setMessage(
        next.progress?.completed
          ? 'Reading saved. You’ve reached the end of Bhagavad-gītā.'
          : `Reading saved. Next time: ${gitaLabel(next.progress!.cursor!)}.`,
      );
      try {
        sessionStorage.removeItem(draftKey(savedSessionId));
      } catch {
        /* Saved on the server. */
      }
      setShowFinish(false);
      actions.setDate(date);
      void companion.reload().catch(() => {});
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Couldn’t save. Your reading details are still here.',
      );
    } finally {
      inFlight.current = false;
      setBusy('');
    }
  }

  const previousNote =
    lastNote ||
    state.records.reading.find((entry) => entry.book === gita.title && entry.reflection)
      ?.reflection;
  const disabled = Boolean(busy) || !loaded;
  const legacyBook = bookmark && bookCatalog.find((book) => book.id === bookmark.bookId);

  return (
    <div className="reading-companion reading-sequence">
      <header className="reading-intro">
        <span className="reading-eyebrow">YOUR READING COMPANION</span>
        <h1>Return to the next verse.</h1>
        <p>A little Bhagavad-gītā, picked up exactly where you left off.</p>
      </header>

      <section
        className="reading-current"
        aria-labelledby="reading-current-title"
        aria-busy={Boolean(busy)}
      >
        <div className="reading-current-top">
          <span className="reading-eyebrow">
            <BookOpen size={15} aria-hidden="true" /> BHAGAVAD-GĪTĀ AS IT IS
          </span>
          <span className="reading-format">PrabhupadaBooks.com</span>
        </div>
        <div className="reading-book-stage">
          <div
            className="reading-book-cover"
            style={{ '--reading-cover': gita.color } as CSSProperties}
            aria-hidden="true"
          >
            <span className="reading-cover-author">A. C. Bhaktivedanta Swami Prabhupāda</span>
            <Flower2 className="reading-cover-flower" size={64} strokeWidth={0.8} />
            <span className="reading-cover-title">
              Bhagavad-gītā
              <br />
              As It Is
            </span>
            <span className="reading-cover-rule" />
            <span className="reading-cover-footer">A LIFE OF READING</span>
          </div>
          <div className="reading-book-copy">
            <span className="reading-author">
              {completed
                ? 'A book, read with attention'
                : active
                  ? 'Your reading is in progress'
                  : firstTime
                    ? 'Begin from your place'
                    : 'Your next verse is waiting'}
            </span>
            <h2 id="reading-current-title">
              {!loaded
                ? 'Opening your place…'
                : completed
                  ? 'A little each day. A whole book.'
                  : `Chapter ${startPosition.chapter}`}
              {loaded && !completed && <span>Verse {startPosition.verse}</span>}
            </h2>
            <p>
              {completed
                ? 'Your completed reading is kept in your journal below.'
                : active
                  ? `Started on ${prettyDate(active.date, { day: 'numeric', month: 'long' })}. Continue this sitting, then tell us where you stopped.`
                  : 'Read on PrabhupadaBooks. When you finish, your next verse will be kept here for you.'}
            </p>
            {loaded && !firstTime && !completed && (
              <div className="reading-main-actions">
                {active ? (
                  <>
                    <a
                      className="reading-button reading-button-primary"
                      href={gitaUrl(active.start)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Continue reading <ArrowUpRight size={17} aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      className="reading-button reading-button-outline"
                      disabled={disabled}
                      onClick={() => {
                        setShowFinish(true);
                        window.setTimeout(
                          () =>
                            finishRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            }),
                          0,
                        );
                      }}
                    >
                      <Check size={16} aria-hidden="true" /> Finish reading
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="reading-button reading-button-primary"
                    onClick={() => void startReading()}
                    disabled={disabled}
                  >
                    {busy === 'start' ? 'Saving your start…' : 'Start reading'}{' '}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {loaded && !firstTime && !completed && (
              <p className="reading-source-caption">
                Opens your verse in a new tab. Progress is recorded when you finish.
              </p>
            )}
          </div>
        </div>

        {firstTime && (
          <form
            className="reading-start-section"
            onSubmit={(event) => {
              event.preventDefault();
              void startReading();
            }}
          >
            <div className="reading-section-heading">
              <h3>Where would you like to begin?</h3>
              <p>
                {suggestion
                  ? 'Suggested from your earlier bookmark. Confirm your place before starting.'
                  : 'Choose your current place once. We’ll remember the next verse after each sitting.'}
              </p>
            </div>
            <fieldset disabled={disabled} className="reading-position-fields">
              <label htmlFor="reading-start-chapter">
                Chapter
                <select
                  id="reading-start-chapter"
                  value={firstChapter}
                  onChange={(event) => editFirst(event.target.value, '1')}
                >
                  {gitaVerseCounts.map((_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="reading-start-verse">
                Verse
                <input
                  id="reading-start-verse"
                  type="number"
                  inputMode="numeric"
                  value={firstVerse}
                  onChange={(event) => editFirst(firstChapter, event.target.value)}
                  required
                  min={1}
                  max={gitaVerseCounts[Number(firstChapter) - 1]}
                  step={1}
                />
              </label>
              <button type="submit" className="reading-button reading-button-primary">
                {busy === 'start' ? 'Saving your start…' : 'Start reading'}{' '}
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </fieldset>
          </form>
        )}

        {active && showFinish && draft && (
          <section
            ref={finishRef}
            className="reading-finish-section"
            aria-labelledby="reading-finish-title"
          >
            <div className="reading-section-heading">
              <h3 id="reading-finish-title">Where did you finish?</h3>
              <p>
                Your start is already saved: {gitaLabel(active.start)} ·{' '}
                {prettyDate(active.date, { day: 'numeric', month: 'short' })}.
              </p>
            </div>
            <form onSubmit={finishReading}>
              <fieldset disabled={disabled} className="reading-finish-fields">
                <div className="reading-position-fields">
                  <label htmlFor="reading-end-chapter">
                    Ending chapter
                    <select
                      id="reading-end-chapter"
                      value={draft.chapter}
                      onChange={(event) =>
                        editFinish({
                          chapter: event.target.value,
                          verse:
                            event.target.value === String(active.start.chapter)
                              ? String(active.start.verse)
                              : '1',
                        })
                      }
                    >
                      {gitaVerseCounts.map(
                        (_, index) =>
                          index + 1 >= active.start.chapter && (
                            <option key={index} value={index + 1}>
                              {index + 1}
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                  <label htmlFor="reading-end-verse">
                    Last verse read
                    <input
                      id="reading-end-verse"
                      type="number"
                      inputMode="numeric"
                      value={draft.verse}
                      onChange={(event) => editFinish({ verse: event.target.value })}
                      required
                      min={Number(draft.chapter) === active.start.chapter ? active.start.verse : 1}
                      max={gitaVerseCounts[Number(draft.chapter) - 1]}
                      step={1}
                    />
                  </label>
                </div>
                <details
                  className="reading-extras"
                  open={draft.minutes !== '' || draft.note !== '' ? true : undefined}
                >
                  <summary>
                    A little more to remember <span>Optional</span>
                  </summary>
                  <div className="reading-extra-fields">
                    <label htmlFor="reading-minutes">
                      Minutes read
                      <input
                        id="reading-minutes"
                        type="number"
                        inputMode="decimal"
                        value={draft.minutes}
                        onChange={(event) => editFinish({ minutes: event.target.value })}
                        min={0}
                        max={1440}
                        step="0.01"
                        placeholder="Optional"
                      />
                    </label>
                    <label htmlFor="reading-note">
                      One thought to return to
                      <textarea
                        id="reading-note"
                        value={draft.note}
                        onChange={(event) => editFinish({ note: event.target.value })}
                        placeholder="What would I like to remember?"
                        rows={3}
                        maxLength={10000}
                      />
                    </label>
                  </div>
                </details>
                <div className="reading-finish-actions">
                  <button type="submit" className="reading-button reading-button-primary">
                    <Bookmark size={16} aria-hidden="true" />{' '}
                    {busy === 'finish' ? 'Saving your reading…' : 'Save reading & keep my place'}
                  </button>
                  <button
                    type="button"
                    className="reading-text-button"
                    onClick={() => setShowFinish(false)}
                  >
                    Keep reading
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        )}

        {message && (
          <p className="reading-save-status reading-sequence-status" role="status">
            <Check size={17} aria-hidden="true" />
            {message}
          </p>
        )}
        {error && (
          <div className="reading-error reading-sequence-error" role="alert">
            <span>{error}</span>
            <button type="button" disabled={Boolean(busy)} onClick={() => void reloadProgress()}>
              Reload saved place
            </button>
          </div>
        )}
      </section>

      {previousNote && (
        <section className="reading-note-revisit" aria-labelledby="reading-note-title">
          <span className="reading-note-mark">
            <PenLine size={20} aria-hidden="true" />
          </span>
          <div>
            <span className="reading-eyebrow" id="reading-note-title">
              A THOUGHT FROM YOUR READING
            </span>
            <p>{String(previousNote)}</p>
          </div>
        </section>
      )}

      {retainedDraft && (
        <details className="fold-panel reading-previous-bookmark" open>
          <summary>Your entered reading details</summary>
          <div className="fold-body reading-legacy-book">
            <p>
              Ending chapter {retainedDraft.chapter}, verse {retainedDraft.verse}
              {retainedDraft.minutes ? ` · ${retainedDraft.minutes} minutes` : ''}.
            </p>
            {retainedDraft.note && <p className="reading-legacy-note">{retainedDraft.note}</p>}
            <p>
              These details were kept when your saved place changed. Check your journal below before
              recording them again.
            </p>
          </div>
        </details>
      )}
      <div className="reading-more-links">
        <a href="https://prabhupadabooks.com/bg" target="_blank" rel="noopener noreferrer">
          Bhagavad-gītā contents <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <Link href="/krishna">
          <Moon size={16} aria-hidden="true" /> Krishna Book · Night reading
        </Link>
      </div>
      {bookmark && (
        <details className="fold-panel reading-previous-bookmark">
          <summary>My earlier bookmark</summary>
          <div className="fold-body reading-legacy-book">
            <h3>{legacyBook?.title || 'Your saved book'}</h3>
            {bookmark.location && <p>{bookmark.location}</p>}
            {bookmark.note && <p className="reading-legacy-note">{bookmark.note}</p>}
            {prabhupadaBookUrl(bookmark.url) && (
              <a
                href={prabhupadaBookUrl(bookmark.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="reading-text-button"
              >
                Open saved page <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            )}
            <p className="reading-source-caption">
              Your earlier bookmark is preserved separately from your Bhagavad-gītā progress.
            </p>
          </div>
        </details>
      )}
      <details className="fold-panel reading-journal">
        <summary>My reading journal &amp; history</summary>
        <div className="fold-body">
          <PracticePage collection="reading" state={state} date={date} actions={actions} />
        </div>
      </details>
    </div>
  );
}
