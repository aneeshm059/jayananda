'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  List,
  Play,
  Search,
} from 'lucide-react';
import { request } from '@/lib/client';
import { soulfulProgressActionSchema } from '@/lib/domain/soulful-reading';
import type {
  SoulfulBlock,
  SoulfulLibraryResponse,
  SoulfulModuleResponse,
  SoulfulProgress,
  SoulfulProgressAction,
  SoulfulProgressResponse,
} from '@/lib/domain/soulful-reading';
import { MalaIcon } from './mala-icon';
import { SoulfulSourceFigure } from './soulful-source-figure';
import { respectfulAuthor, soulfulAuthor } from '@/lib/domain/display-names';

function pendingKey(readerKey: string, id: string) {
  return `jayananda:soulful-pending:${readerKey}:${id}`;
}
function readPending(readerKey: string, id: string): SoulfulProgressAction | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey(readerKey, id)) || 'null');
    const result = soulfulProgressActionSchema.safeParse(saved);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function SoulfulModuleReader() {
  const query = useSearchParams();
  const [library, setLibrary] = useState<SoulfulLibraryResponse | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [kind, setKind] = useState<'module' | 'supplement'>('module');
  const [search, setSearch] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const requestedId = query.get('module');
  const heading = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const next = await request<SoulfulLibraryResponse>('/api/soulful-japa');
      setLibrary(next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    try {
      const size = Number(localStorage.getItem('jayananda:soulful-font-size'));
      if ([18, 20, 23].includes(size)) setFontSize(size);
    } catch {
      /* Reading remains available when browser storage is disabled. */
    }
  }, []);
  useEffect(() => {
    if (!library) return;
    const unfinishedSave = library.modules.find((item) => readPending(library.readerKey, item.id));
    const target =
      requestedId || unfinishedSave?.id || library.resumeModuleId || library.modules[0]?.id;
    if (!target) return;
    if (!library.modules.some((item) => item.id === target)) {
      setError('That module is not in this PDF. Choose one from the library.');
      return;
    }
    // A save updates the library; it must not move the reader away from the current module.
    if ((requestedId || !selected) && target !== selected) {
      setSelected(target);
      setKind(library.modules.find((item) => item.id === target)!.kind);
    }
  }, [library, requestedId, selected]);
  const updateProgress = useCallback((progress: SoulfulProgress, resumeModuleId: string | null) => {
    setLibrary((previous) => {
      if (!previous) return previous;
      const existing = previous.progress.find((item) => item.moduleId === progress.moduleId);
      if (existing && existing.version > progress.version) return previous;
      return {
        ...previous,
        resumeModuleId,
        progress: [
          ...previous.progress.filter((item) => item.moduleId !== progress.moduleId),
          progress,
        ],
      };
    });
  }, []);
  function choose(id: string) {
    if (busy) return;
    setError('');
    setPicker(false);
    setSelected(id);
    setKind(library!.modules.find((item) => item.id === id)!.kind);
    // This changes the reader selection, without fetching a new server page.
    // Native history updates also keep useSearchParams and copied links in sync.
    window.history.replaceState(null, '', '/soulful-japa?module=' + encodeURIComponent(id));
    heading.current?.scrollIntoView({ block: 'start' });
  }
  const modules = library?.modules.filter((item) => item.kind === 'module') ?? [];
  const complete = modules.filter((item) =>
    library?.progress.some((p) => p.moduleId === item.id && p.completed),
  ).length;
  const visible =
    library?.modules.filter(
      (item) =>
        item.kind === kind &&
        `${item.label} ${item.title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ) ?? [];
  const current = library?.modules.find((item) => item.id === selected);
  const ordered = library?.modules.filter((item) => item.kind === current?.kind) ?? [];
  const position = ordered.findIndex((item) => item.id === selected);
  const next = ordered[position + 1];
  const previous = position > 0 ? ordered[position - 1] : undefined;

  return (
    <div className="soulful-reader">
      <div className="soulful-toplinks">
        <Link href="/japa" className="quiet-link">
          <ArrowLeft size={15} /> My Japa space
        </Link>
        <Link href="/learn?course=soulful-japa" className="quiet-link">
          <Play size={15} /> Watch lessons
        </Link>
      </div>
      <header className="soulful-intro">
        <span className="eyebrow">
          <MalaIcon size={21} /> READ · REFLECT · CHANT
        </span>
        <h1>
          Soulful Japa<span>A little reading. A more attentive round.</span>
        </h1>
        <p>The written modules by {respectfulAuthor(library?.source?.author || soulfulAuthor)}.</p>
      </header>
      {error && (
        <div className="soulful-message" role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={() => void load()}>
            Reload library
          </button>
        </div>
      )}
      {!library ? (
        <p role="status">Opening your reading library…</p>
      ) : !library.source ? (
        <div className="empty-state">
          <BookOpen size={28} />
          <h2>Your reading library is being prepared.</h2>
          <p>Please return in a little while.</p>
          <button className="button secondary" onClick={() => void load()}>
            Refresh library
          </button>
        </div>
      ) : (
        <>
          <div className="soulful-library-bar">
            <button
              className="soulful-library-toggle"
              onClick={() => setPicker(!picker)}
              aria-expanded={picker}
              aria-controls="soulful-library"
            >
              <List size={18} /> Choose a module <ChevronDown size={16} />
            </button>
            <span>
              <CheckCircle2 size={16} /> {complete} of {modules.length} modules read
            </span>
            <progress
              max={Math.max(modules.length, 1)}
              value={complete}
              aria-label="Written modules completed"
            />
          </div>
          <div className="soulful-layout">
            <aside
              id="soulful-library"
              className={'soulful-library ' + (picker ? 'is-open' : '')}
              aria-label="Written reading library"
            >
              <div className="soulful-library-tabs" role="group" aria-label="Reading collection">
                <button aria-pressed={kind === 'module'} onClick={() => setKind('module')}>
                  Modules
                </button>
                <button aria-pressed={kind === 'supplement'} onClick={() => setKind('supplement')}>
                  Extra reading
                </button>
              </div>
              <label className="soulful-search">
                <Search size={16} />
                <input
                  type="search"
                  aria-label="Find a module"
                  placeholder="Find a module…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="soulful-module-list">
                {visible.map((item) => {
                  const read = library.progress.some((p) => p.moduleId === item.id && p.completed);
                  return (
                    <button
                      key={item.id}
                      className={'soulful-module-choice ' + (selected === item.id ? 'active' : '')}
                      aria-current={selected === item.id ? 'page' : undefined}
                      disabled={busy}
                      onClick={() => choose(item.id)}
                    >
                      <span className={'soulful-module-mark ' + (read ? 'read' : '')}>
                        {read ? (
                          <Check size={15} aria-label="Completed" />
                        ) : (
                          (item.number ?? <BookOpen size={14} />)
                        )}
                      </span>
                      <span>
                        {(item.label !== item.title || read) && (
                          <small>
                            {item.label !== item.title ? item.label : ''}
                            {read ? ' · Read' : ''}
                          </small>
                        )}
                        <strong>{item.title}</strong>
                      </span>
                    </button>
                  );
                })}
                {!visible.length && (
                  <p className="soulful-no-results">
                    No matching titles. Try a module number or a shorter word.
                  </p>
                )}
              </div>
              <details className="soulful-source-note">
                <summary>About this edition</summary>
                <p>
                  Text and illustrations are from your {library.source.pageCount}-page PDF. Its
                  original numbering, spelling and incomplete sections are retained. Modules 38 and
                  42 are absent in the source. Additional materials follow under Extra reading.
                </p>
                <p>Reading marks are saved separately from your video lessons.</p>
              </details>
            </aside>
            <div className="soulful-reading-column" ref={heading}>
              <div className="soulful-reader-tools">
                <span>{current?.label || 'Your reading place'}</span>
                <div role="group" aria-label="Reading text size">
                  {([18, 20, 23] as const).map((size, i) => (
                    <button
                      key={size}
                      aria-label={['Standard text', 'Comfortable text', 'Large text'][i]}
                      aria-pressed={fontSize === size}
                      style={{ fontSize: 13 + i * 3 }}
                      onClick={() => {
                        setFontSize(size);
                        try {
                          localStorage.setItem('jayananda:soulful-font-size', String(size));
                        } catch {}
                      }}
                    >
                      Aa
                    </button>
                  ))}
                </div>
              </div>
              {selected && (
                <ModulePage
                  key={selected}
                  id={selected}
                  readerKey={library.readerKey}
                  fontSize={fontSize}
                  onProgress={updateProgress}
                  onBusy={setBusy}
                />
              )}
              <nav className="soulful-page-nav" aria-label="Reading sequence">
                {previous ? (
                  <button disabled={busy} onClick={() => choose(previous.id)}>
                    <ArrowLeft size={17} />
                    <span>
                      <small>Previous</small>
                      {previous.label}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                {next ? (
                  <button disabled={busy} onClick={() => choose(next.id)}>
                    <span>
                      <small>Read next</small>
                      {next.label}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ) : (
                  <span className="soulful-sequence-end">End of this collection</span>
                )}
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModulePage({
  id,
  readerKey,
  fontSize,
  onProgress,
  onBusy,
}: {
  id: string;
  readerKey: string;
  fontSize: number;
  onProgress: (progress: SoulfulProgress, resumeId: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [data, setData] = useState<SoulfulModuleResponse | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Opening the module…');
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState<SoulfulProgressAction | null>(null);
  const locked = useRef(true),
    mounted = useRef(true);
  const pendingRef = useRef<SoulfulProgressAction | null>(null);
  function retain(action: SoulfulProgressAction | null, acknowledgedId?: string) {
    if (!acknowledgedId || pendingRef.current?.requestId === acknowledgedId)
      pendingRef.current = action;
    try {
      if (action) sessionStorage.setItem(pendingKey(readerKey, id), JSON.stringify(action));
      else if (!acknowledgedId || readPending(readerKey, id)?.requestId === acknowledgedId)
        sessionStorage.removeItem(pendingKey(readerKey, id));
    } catch {
      /* The unload guard still protects a pending save when storage is unavailable. */
    }
  }
  function lock(value: boolean) {
    locked.current = value;
    setBusy(value);
    onBusy(value);
  }
  function accepted(result: SoulfulProgressResponse) {
    setData((previous) => (previous ? { ...previous, progress: result.progress } : previous));
    onProgress(result.progress, result.resumeModuleId);
  }
  async function persist(action: SoulfulProgressAction) {
    retain(action);
    lock(true);
    setError('');
    setStatus('Saving your reading place…');
    try {
      const result = await request<SoulfulProgressResponse>(
        '/api/soulful-japa/' + id,
        'PUT',
        action,
      );
      retain(null, action.requestId);
      if (!mounted.current) return;
      accepted(result);
      setPending(null);
      lock(false);
      setStatus(
        action.completed === true
          ? 'Reading complete. Your progress is saved.'
          : action.completed === false
            ? 'Marked as unread. Your progress is saved.'
            : 'Your module is bookmarked.',
      );
    } catch (e) {
      if (!mounted.current) return;
      setPending(action);
      setError((e as Error).message);
      setStatus('');
      setBusy(false);
      // Keep navigation locked until an uncertain write is retried or reconciled.
    }
  }
  async function reload() {
    if (busy) return;
    lock(true);
    setError('');
    setStatus('Checking saved progress…');
    try {
      const result = await request<SoulfulModuleResponse>('/api/soulful-japa/' + id);
      if (!mounted.current) return;
      setData(result);
      setPending(null);
      retain(null);
      if (!data) {
        await persist({
          version: result.progress?.version ?? 0,
          requestId: crypto.randomUUID(),
          opened: true,
          contentVersion: result.source.contentVersion,
        });
        return;
      }
      lock(false);
      setStatus(
        'Saved progress loaded. If your change is missing, you can mark your reading again.',
      );
      if (result.progress) onProgress(result.progress, null);
    } catch (e) {
      if (!mounted.current) return;
      setError((e as Error).message);
      setBusy(false);
      setStatus('');
    }
  }
  useEffect(() => {
    let active = true;
    mounted.current = true;
    onBusy(true);
    void request<SoulfulModuleResponse>('/api/soulful-japa/' + id)
      .then(async (result) => {
        if (!active) return;
        setData(result);
        const retained = readPending(readerKey, id);
        if (retained) {
          pendingRef.current = retained;
          setPending(retained);
          setError(
            'A reading update could not be confirmed earlier. Retry it, or reload the saved progress to review your current status.',
          );
          setStatus('');
          setBusy(false);
          return;
        }
        await persist({
          version: result.progress?.version ?? 0,
          requestId: crypto.randomUUID(),
          opened: true,
          contentVersion: result.source.contentVersion,
        });
      })
      .catch((e) => {
        if (!active) return;
        setError((e as Error).message);
        setStatus('');
        lock(false);
      });
    return () => {
      active = false;
      mounted.current = false;
      onBusy(false);
    };
    // A module has its own lifetime; progress updates must not re-open it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    const protectSave = (event: BeforeUnloadEvent) => {
      if (pendingRef.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', protectSave);
    return () => window.removeEventListener('beforeunload', protectSave);
  }, []);
  function complete() {
    if (!data || locked.current || pending) return;
    void persist({
      version: data.progress?.version ?? 0,
      requestId: crypto.randomUUID(),
      completed: !data.progress?.completed,
      opened: true,
      contentVersion: data.source.contentVersion,
    });
  }
  return (
    <>
      {error && (
        <div className="soulful-message" role="alert">
          <p>{error}</p>
          <div>
            {pending && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void persist(pending)}
              >
                Retry save
              </button>
            )}
            <button className="text-button" disabled={busy} onClick={() => void reload()}>
              Reload saved progress
            </button>
          </div>
        </div>
      )}
      {data && (
        <article
          className="soulful-paper"
          aria-labelledby="soulful-module-title"
          style={{ '--soulful-text-size': fontSize + 'px' } as CSSProperties}
        >
          <header className="soulful-paper-heading">
            <span className="eyebrow">
              {data.module.label === data.module.title ? 'Extra reading' : data.module.label}
            </span>
            <h2 id="soulful-module-title">{data.module.title}</h2>
            <p>
              {data.module.kind === 'module'
                ? respectfulAuthor(data.source.author)
                : 'From the supplied source'}{' '}
              <span>·</span> PDF{' '}
              {data.module.startPage === data.module.endPage
                ? `page ${data.module.startPage}`
                : `pages ${data.module.startPage}–${data.module.endPage}`}
            </p>
            {data.progress?.completed && (
              <span className="soulful-read-badge">
                <CheckCircle2 size={16} /> Reading completed
              </span>
            )}
          </header>
          <div className="soulful-prose">
            {data.module.blocks.map((block, index) =>
              // These source headings already appear verbatim in the reading header.
              index < 2 &&
              block.type === 'heading' &&
              (block.text === data.module.label || block.text === data.module.title) ? null : (
                <SourceBlock key={index} block={block} index={index} />
              ),
            )}
          </div>
          <footer className="soulful-completion">
            <span className="soulful-end-ornament" aria-hidden="true">
              ✦
            </span>
            <p>
              {data.progress?.completed
                ? 'You’ve spent time with this reading.'
                : 'When you’ve finished, keep a mark of your reading.'}
            </p>
            <button
              className={'button ' + (data.progress?.completed ? 'secondary' : 'primary')}
              disabled={busy || !!pending}
              onClick={complete}
            >
              <Check size={18} />
              {busy
                ? 'Saving…'
                : data.progress?.completed
                  ? 'Completed · mark unread'
                  : 'Complete reading'}
            </button>
            <small>Your written reading and video progress are kept separately.</small>
          </footer>
        </article>
      )}
      <p className="soulful-save-status" role="status">
        {status}
      </p>
    </>
  );
}

function SourceBlock({ block, index }: { block: SoulfulBlock; index: number }) {
  const attributes = { 'data-source-page': block.page, id: 'source-block-' + index };
  if (block.type === 'image') return <SoulfulSourceFigure block={block} index={index} />;
  if (block.type === 'heading') return <h3 {...attributes}>{respectfulAuthor(block.text)}</h3>;
  if (block.type === 'quote')
    return <blockquote {...attributes}>{respectfulAuthor(block.text)}</blockquote>;
  return (
    <p {...attributes} className={block.type === 'verse' ? 'soulful-verse' : undefined}>
      {respectfulAuthor(block.text)}
    </p>
  );
}
