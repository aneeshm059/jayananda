'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Clock3,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { learningCourses, type LearningCourse } from '@/lib/domain/learning-catalog';
import type { CourseProgress } from '@/lib/domain/companion';
import type { AppState } from '@/lib/domain/model';
import { localDate } from '@/lib/domain/dates';
import {
  emptyCourseProgress,
  nextLesson,
  playbackCredit,
  playbackTime,
  splitWatchCredit,
} from '@/lib/domain/learning-progress';
import { loadYouTube, youtubePlaybackError, type YouTubePlayer } from '@/lib/youtube-player';
import { useCompanion } from './companion-provider';
import { LectureSync, useLectureLibrary } from './lecture-library-provider';
import { CourseShortcut } from './pillar-home';
import { PracticePage } from './practice-page';
import type { Actions } from './journal-app';

export function HearingCompanion({
  state,
  actions,
  date = state.today,
}: {
  state: AppState;
  actions: Actions;
  date?: string;
}) {
  const { catalog } = useLectureLibrary();
  const { values } = useCompanion();
  const p = values['course:prabhupada'] as CourseProgress | undefined;
  const lesson =
    catalog.lessons.find((l) => l.id === p?.currentVideoId) ??
    catalog.lessons.find((l) => !p?.lessons[l.id]?.completed) ??
    catalog.lessons[0];
  return (
    <div className="hearing-companion">
      <div className="page-intro">
        <span className="eyebrow">HEAR · MAKE SPACE FOR ŚRĪLA PRABHUPĀDA</span>
        <h1>
          A little hearing.
          <br />
          <em>Something to carry with you.</em>
        </h1>
        <p>Begin with a lecture, or return to the one you have already started.</p>
      </div>
      {lesson && (
        <Link href="/learn?course=prabhupada" className="hearing-feature">
          <img
            src={`https://i.ytimg.com/vi/${lesson.id}/hqdefault.jpg`}
            alt="Lecture thumbnail from The Acharya"
          />
          <div>
            <span className="eyebrow">THE ACHARYA · ŚRĪLA PRABHUPĀDA</span>
            <h2>{lesson.title}</h2>
            <p>
              {catalog.lessons.length} English lectures · 30–45 minutes. Your place will be saved as
              you listen.
            </p>
            <span className="button primary">
              <Play size={17} /> {p?.currentVideoId ? 'Continue hearing' : 'Begin hearing'}
            </span>
          </div>
        </Link>
      )}
      <div className="home-learning-row">
        <div>
          <span className="eyebrow">A GUIDED SERIES · MADHU PANDIT PRABHU</span>
          <h2>Learn, a little each day.</h2>
          <p>Your lessons stay in sequence, with a bookmark of their own.</p>
        </div>
        <CourseShortcut id="happiness-pleasure" />
      </div>
      <details className="secondary-panel">
        <summary>Hearing journal & previous sessions</summary>
        <PracticePage collection="hearing" state={state} date={date} actions={actions} />
      </details>
    </div>
  );
}

export function LearningCompanion({ state, actions }: { state: AppState; actions: Actions }) {
  const query = useSearchParams();
  const { ready, error, reload } = useCompanion();
  const library = useLectureLibrary();
  const selectedCourse =
    learningCourses.find((c) => c.id === query.get('course')) ?? learningCourses[0];
  const course =
    selectedCourse.id === 'prabhupada'
      ? {
          ...selectedCourse,
          lessons: library.catalog.lessons.map((lesson, index) => ({
            ...lesson,
            position: index + 1,
          })),
        }
      : selectedCourse;
  return (
    <div className="learning-space">
      <div className="learning-top">
        <Link href={course.id === 'soulful-japa' ? '/japa' : '/hearing'} className="quiet-link">
          ← {course.id === 'soulful-japa' ? 'My Japa space' : 'My hearing space'}
        </Link>
        <a href={course.sourceUrl} target="_blank" rel="noreferrer" className="quiet-link">
          Original source <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="learning-tabs" aria-label="Choose a series">
        {learningCourses.map((c) => (
          <Link
            key={c.id}
            href={'/learn?course=' + c.id}
            className={course.id === c.id ? 'active' : ''}
            aria-current={course.id === c.id ? 'page' : undefined}
          >
            {c.title}
          </Link>
        ))}
      </div>
      {course.id === 'soulful-japa' && (
        <Link href="/soulful-japa" className="soulful-reading-link soulful-video-reading-link">
          Read the Soulful Japa modules <ArrowUpRight size={16} />
        </Link>
      )}
      {!ready || (course.id === 'prabhupada' && !library.ready) ? (
        <div className="empty-state">
          <p role="status">{error || 'Finding your saved place…'}</p>
          {error && (
            <button className="button secondary" onClick={() => void reload().catch(() => {})}>
              Try again
            </button>
          )}
        </div>
      ) : course.lessons.length === 0 ? (
        <div className="empty-state">
          <h1>Your lecture library</h1>
          <p>
            No verified English lectures of 30–45 minutes are available yet. Use Sync lectures to
            check The Acharya.
          </p>
          <LectureSync />
        </div>
      ) : (
        <CoursePlayer key={course.id} course={course} state={state} actions={actions} />
      )}
    </div>
  );
}

function CoursePlayer({
  course,
  state,
  actions,
}: {
  course: LearningCourse;
  state: AppState;
  actions: Actions;
}) {
  const { values, save, retain, error: companionError } = useCompanion();
  const key = 'course:' + course.id;
  const initial = (values[key] as CourseProgress | undefined) ?? emptyCourseProgress();
  const progress = useRef<CourseProgress>(structuredClone(initial));
  const first =
    course.lessons.find((l) => l.id === initial.currentVideoId) ??
    course.lessons.find((l) => !initial.lessons[l.id]?.completed) ??
    course.lessons[0];
  const [lesson, setLesson] = useState(first),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(initial.lessons[first.id]?.position ?? 0),
    [todaySeconds, setTodaySeconds] = useState(
      initial.watchedByDay[localDate(state.settings.timezone)] ?? 0,
    ),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [playerError, setPlayerError] = useState(''),
    [playerPhase, setPlayerPhase] = useState<'idle' | 'loading' | 'ready' | 'blocked' | 'error'>(
      'idle',
    ),
    [playerAttempt, setPlayerAttempt] = useState(0),
    [completed, setCompleted] = useState(initial.lessons[first.id]?.completed ?? false),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(''),
    [goal, setGoal] = useState(course.dailyMinutes || 30);
  const host = useRef<HTMLDivElement>(null),
    player = useRef<YouTubePlayer | null>(null),
    playerIsReady = useRef(false),
    last = useRef({ time: 0, wall: 0 }),
    dirty = useRef(false),
    revision = useRef(0),
    submittedRevision = useRef(-1),
    saver = useRef(save),
    retainer = useRef(retain),
    activeId = useRef(lesson.id),
    isPlaying = useRef(false),
    blocked = useRef(false),
    switching = useRef(false),
    globalError = useRef(companionError),
    timezone = useRef(state.settings.timezone),
    activeSave = useRef<Promise<void> | null>(null),
    watchedHere = useRef<Record<string, number>>({}),
    completing = useRef(false),
    onEnded = useRef<() => void>(() => {}),
    seekTarget = useRef<{ id: string; position: number; expires: number } | null>(null),
    capture = useRef<() => void>(() => {});
  saver.current = save;
  retainer.current = retain;
  globalError.current = companionError;
  timezone.current = state.settings.timezone;
  const changed = () => {
    dirty.current = true;
    revision.current++;
  };
  const persist = useRef<(reviewed?: boolean) => Promise<void>>(async () => {});
  const retainCheckpoint = () => {
    // The provider outlives route/course changes. Hand it a newer checkpoint
    // before awaiting a write that may fail after this player has unmounted.
    // A matching in-flight snapshot is already retained by the provider.
    if (dirty.current && (!activeSave.current || submittedRevision.current !== revision.current))
      retainer.current(key, structuredClone(progress.current));
  };
  persist.current = async (reviewed = false) => {
    if (activeSave.current) await activeSave.current;
    if (!dirty.current) return;
    if (!reviewed && (blocked.current || globalError.current))
      throw new Error(
        'Saving is paused. Reload saved progress and review your local place before saving again.',
      );
    const snapshot = structuredClone(progress.current),
      savedRevision = revision.current;
    submittedRevision.current = savedRevision;
    setStatus('Saving your place…');
    const request = (async () => {
      try {
        await saver.current(key, snapshot);
        dirty.current = revision.current !== savedRevision;
        blocked.current = false;
        setError('');
        setStatus(dirty.current ? 'Continuing from your latest place…' : 'Your place is saved.');
      } catch (cause) {
        dirty.current = true;
        blocked.current = true;
        player.current?.pauseVideo?.();
        setError(cause instanceof Error ? cause.message : 'Your place could not be saved.');
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
  const updatePosition = (id: string, seconds: number, duration: number) => {
    if (
      id !== activeId.current ||
      switching.current ||
      !Number.isFinite(seconds) ||
      !Number.isFinite(duration)
    )
      return;
    const seeking = seekTarget.current;
    if (
      seeking?.id === id &&
      Date.now() < seeking.expires &&
      Math.abs(seconds - seeking.position) > 2
    )
      return;
    const old = progress.current.lessons[id];
    const knownDuration = duration > 0 ? Math.min(86400, duration) : (old?.duration ?? 0);
    const nextPosition = Math.min(knownDuration || 86400, Math.max(0, seconds));
    if (
      old &&
      Math.abs(old.position - nextPosition) < 0.1 &&
      old.duration === knownDuration &&
      progress.current.currentVideoId === id
    )
      return;
    progress.current.currentVideoId = id;
    progress.current.lessons[id] = {
      position: nextPosition,
      duration: knownDuration,
      completed: old?.completed ?? false,
    };
    changed();
    setPosition(nextPosition);
    setStatus('Your place saves as you watch.');
  };
  // A clean, idle player may adopt refreshed server state. A conflicted local
  // checkpoint remains visible until the user explicitly reviews and saves it.
  useEffect(() => {
    const remote = values[key] as CourseProgress | undefined;
    if (!remote || dirty.current || activeSave.current || blocked.current || isPlaying.current)
      return;
    progress.current = structuredClone(remote);
    const target = course.lessons.find((item) => item.id === remote.currentVideoId) ?? first;
    const savedPosition = remote.lessons[target.id]?.position ?? 0;
    if (target.id !== activeId.current) {
      activeId.current = target.id;
      setLesson(target);
    } else if (
      playerIsReady.current &&
      player.current &&
      Math.abs(player.current.getCurrentTime() - savedPosition) > 1
    ) {
      seekTarget.current = { id: target.id, position: savedPosition, expires: Date.now() + 10000 };
      if ([-1, 0, 5].includes(player.current.getPlayerState()))
        player.current.cueVideoById({ videoId: target.id, startSeconds: savedPosition });
      else player.current.seekTo(savedPosition, true);
    }
    setPosition(savedPosition);
    setCompleted(remote.lessons[target.id]?.completed ?? false);
    setTodaySeconds(remote.watchedByDay[localDate(timezone.current)] ?? 0);
  }, [values[key]]);
  useEffect(() => {
    if (!host.current) return;
    let cancelled = false,
      playerReady = false,
      failed = false,
      hasStarted = false;
    let instance: YouTubePlayer | null = null;
    const id = lesson.id;
    const container = document.createElement('div');
    host.current.replaceChildren(container);
    setPlayerError('');
    setPlayerPhase('loading');
    setPlaying(false);
    playerIsReady.current = false;
    isPlaying.current = false;
    seekTarget.current = null;
    const failPlayer = (message: string) => {
      if (cancelled || activeId.current !== id || failed) return;
      failed = true;
      playerReady = false;
      playerIsReady.current = false;
      isPlaying.current = false;
      instance?.pauseVideo?.();
      window.clearTimeout(readyTimeout);
      setPlaying(false);
      setPlayerPhase('error');
      setPlayerError(message);
    };
    // The script can load successfully while the iframe never becomes ready.
    const readyTimeout = window.setTimeout(
      () =>
        failPlayer(
          'The YouTube player did not finish loading. Retry the player or open this lesson on YouTube. Your saved place is kept.',
        ),
      25000,
    );
    const tick = () => {
      const p = instance;
      if (
        cancelled ||
        failed ||
        !p ||
        !playerReady ||
        !hasStarted ||
        activeId.current !== id ||
        switching.current
      )
        return;
      const seconds = p.getCurrentTime(),
        duration = p.getDuration(),
        wall = performance.now();
      if (p.getPlayerState() === -1 || p.getPlayerState() === 5) {
        last.current = { time: seconds, wall };
        return;
      }
      const elapsed = (wall - last.current.wall) / 1000;
      const seeking = seekTarget.current;
      if (seeking?.id === id) {
        last.current = { time: seconds, wall };
        if (Date.now() < seeking.expires && Math.abs(seconds - seeking.position) > 2) return;
        seekTarget.current = null;
        updatePosition(id, seconds, duration);
        return;
      }
      if (isPlaying.current && document.visibilityState === 'visible') {
        const credit = playbackCredit(last.current.time, seconds, elapsed, p.getPlaybackRate());
        if (credit > 0) {
          const now = new Date();
          const portions = splitWatchCredit(credit, now, timezone.current);
          for (const [date, amount] of Object.entries(portions))
            progress.current.watchedByDay[date] = Math.min(
              86400,
              (progress.current.watchedByDay[date] ?? 0) + amount,
            );
          progress.current.lastPracticedDate =
            Object.keys(portions).at(-1) ?? progress.current.lastPracticedDate;
          watchedHere.current[id] = (watchedHere.current[id] ?? 0) + credit;
          changed();
        }
      }
      last.current = { time: seconds, wall };
      setTodaySeconds(progress.current.watchedByDay[localDate(timezone.current)] ?? 0);
      updatePosition(id, seconds, duration);
    };
    capture.current = tick;
    void loadYouTube()
      .then((api) => {
        if (cancelled || failed) return;
        instance = new api.Player(container, {
          videoId: id,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
            start: Math.floor(progress.current.lessons[id]?.position ?? 0),
          },
          events: {
            onReady: (e) => {
              if (cancelled || failed || activeId.current !== id) return;
              window.clearTimeout(readyTimeout);
              playerReady = true;
              playerIsReady.current = true;
              setPlayerPhase('ready');
              const saved = progress.current.lessons[id]?.position ?? 0;
              last.current = { time: saved, wall: performance.now() };
              // Prepare the player before the user's first tap. playerVars.start
              // restores the bookmark when playback begins; do not autoplay or
              // seek here and consume the gesture after asynchronous loading.
            },
            onStateChange: (e) => {
              if (
                cancelled ||
                failed ||
                !playerReady ||
                activeId.current !== id ||
                switching.current
              )
                return;
              tick();
              if (e.data === 1) {
                hasStarted = true;
                setPlayerPhase('ready');
              }
              isPlaying.current = e.data === 1;
              setPlaying(e.data === 1);
              last.current = { time: e.target.getCurrentTime(), wall: performance.now() };
              // An unstarted/failed iframe often reports zero; it must not
              // replace the saved bookmark before genuine playback begins.
              if (hasStarted && (e.data === 0 || e.data === 1 || e.data === 2))
                updatePosition(id, e.target.getCurrentTime(), e.target.getDuration());
              if (e.data === 0 && hasStarted) onEnded.current();
              if ((e.data === 2 || e.data === 0) && !blocked.current && !globalError.current)
                void persist.current().catch(() => {});
            },
            onError: (e) => {
              failPlayer(youtubePlaybackError(e.data));
            },
            onAutoplayBlocked: () => {
              if (cancelled || failed || activeId.current !== id) return;
              isPlaying.current = false;
              setPlaying(false);
              setPlayerPhase('blocked');
              setStatus('Press Play below, or use the Play button in the video.');
            },
          },
        });
        player.current = instance;
      })
      .catch((cause) => {
        failPlayer(
          cause instanceof Error
            ? cause.message
            : 'YouTube could not load. Please retry the player.',
        );
      });
    return () => {
      tick();
      cancelled = true;
      window.clearTimeout(readyTimeout);
      capture.current = () => {};
      isPlaying.current = false;
      playerIsReady.current = false;
      instance?.destroy();
      if (player.current === instance) player.current = null;
      retainCheckpoint();
      if (!blocked.current && !globalError.current) void persist.current().catch(() => {});
    };
  }, [lesson.id, playerAttempt]);
  useEffect(() => {
    const clock = window.setInterval(() => {
      capture.current();
      setTodaySeconds(progress.current.watchedByDay[localDate(timezone.current)] ?? 0);
    }, 1000);
    const saves = window.setInterval(() => {
      if (dirty.current && !blocked.current && !globalError.current)
        void persist.current().catch(() => {});
    }, 10000);
    const visibility = () => {
      capture.current();
      if (document.visibilityState === 'hidden') {
        player.current?.pauseVideo?.();
        if (!blocked.current && !globalError.current) void persist.current().catch(() => {});
      } else
        last.current = { time: player.current?.getCurrentTime?.() ?? 0, wall: performance.now() };
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      capture.current();
      if (!dirty.current && !activeSave.current) return;
      retainCheckpoint();
      event.preventDefault();
      event.returnValue = '';
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(saves);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
  const retryPlayer = () => {
    capture.current();
    player.current?.pauseVideo?.();
    setPlayerError('');
    setPlayerPhase('loading');
    setPlayerAttempt((attempt) => attempt + 1);
  };
  const togglePlayback = () => {
    const current = player.current;
    if (!current || (playerPhase !== 'ready' && playerPhase !== 'blocked')) return;
    if (playing) {
      capture.current();
      current.pauseVideo();
    } else {
      // No promise or save is awaited here: retain the browser's click gesture.
      current.playVideo();
    }
  };
  const choose = async (id: string) => {
    const target = course.lessons.find((item) => item.id === id);
    if (!target || busy || switching.current || completing.current || id === activeId.current)
      return;
    capture.current();
    player.current?.pauseVideo?.();
    setBusy(true);
    switching.current = true;
    try {
      await persist.current();
      activeId.current = id;
      progress.current.currentVideoId = id;
      changed();
      // Events from the old iframe now fail the active-ID check. Let the new
      // iframe report playback even while its selected place is being saved.
      switching.current = false;
      setPlaying(false);
      setLesson(target);
      setCompleted(progress.current.lessons[id]?.completed ?? false);
      setPosition(progress.current.lessons[id]?.position ?? 0);
      setPlayerError('');
      await persist.current();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      switching.current = false;
      setBusy(false);
    }
  };
  const complete = async (reviewed = true) => {
    if (completing.current || switching.current) return;
    completing.current = true;
    capture.current();
    player.current?.pauseVideo?.();
    setBusy(true);
    const old = progress.current.lessons[lesson.id];
    progress.current.lessons[lesson.id] = {
      position: old?.position ?? position,
      duration: old?.duration ?? lesson.durationSeconds ?? 0,
      completed: true,
    };
    progress.current.currentVideoId = lesson.id;
    changed();
    setCompleted(true);
    try {
      await persist.current(reviewed);
      setStatus(
        course.id === 'prabhupada'
          ? 'Lecture complete. Choose the next lecture when you are ready.'
          : 'Lesson complete. Your next lesson is ready.',
      );
    } catch {
    } finally {
      setBusy(false);
      completing.current = false;
    }
  };
  onEnded.current = () => {
    if (!progress.current.lessons[lesson.id]?.completed) void complete(false);
  };
  const next = nextLesson(course.lessons, lesson.id);
  const secondsLeft = Math.max(0, goal * 60 - todaySeconds);
  const count = course.lessons.filter(
    (item) => progress.current.lessons[item.id]?.completed,
  ).length;
  return (
    <>
      <div className="learning-heading">
        <span className="eyebrow">
          {course.speaker} · {course.id === 'prabhupada' ? 'THE ACHARYA' : 'ISKCON BANGALORE SANGA'}
        </span>
        <h1>{course.title}</h1>
        <p>{course.subtitle}</p>
      </div>
      <div className="learning-layout">
        <div className="lesson-main">
          <section className="video-card">
            <div className="video-stage">
              <div ref={host} className="youtube-host" />
            </div>
            {playerPhase === 'loading' && (
              <p className="fine-print" role="status">
                Loading the YouTube player…
              </p>
            )}
            {playerPhase === 'blocked' && (
              <p className="fine-print" role="status">
                The player is ready. Press Play below to start listening.
              </p>
            )}
            {playerError && (
              <div className="error" role="alert">
                <p>{playerError}</p>
                <button className="button secondary" onClick={retryPlayer}>
                  <RotateCcw size={16} /> Retry player
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${lesson.id}&t=${Math.floor(position)}s`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on YouTube ↗
                </a>
              </div>
            )}
            <div className="video-caption">
              <span className="eyebrow">
                {course.id === 'prabhupada'
                  ? 'YOUR LISTENING PLACE'
                  : `LESSON ${lesson.position} IN YOUR JOURNEY`}
              </span>
              <h2>{lesson.title}</h2>
              <div className="video-metadata">
                <span>
                  <Clock3 size={15} />
                  {lesson.durationSeconds
                    ? playbackTime(lesson.durationSeconds)
                    : 'Duration in player'}
                </span>
                <span>
                  <Bookmark size={15} /> {playbackTime(position)}
                </span>
                <a
                  href={`https://www.youtube.com/watch?v=${lesson.id}&t=${Math.floor(position)}s`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original video <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </section>
          <div className="lesson-actions">
            {!playerError && (
              <button
                className="button secondary"
                disabled={playerPhase === 'loading' || playerPhase === 'idle'}
                onClick={togglePlayback}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playerPhase === 'loading'
                  ? 'Loading player…'
                  : playing
                    ? 'Pause lesson'
                    : position > 0
                      ? 'Resume lesson'
                      : 'Play lesson'}
              </button>
            )}
            <button
              className="button secondary"
              disabled={!playerIsReady.current || playerPhase === 'loading' || !!playerError}
              onClick={() => player.current?.seekTo(Math.max(0, position - 10), true)}
            >
              <RotateCcw size={16} />
              Back 10 seconds
            </button>
            {completed ? (
              <button
                className="button primary"
                disabled={!next || busy || !!error}
                onClick={() => next && void choose(next.id)}
              >
                {next
                  ? course.id === 'prabhupada'
                    ? 'Next lecture'
                    : 'Next lesson'
                  : count === course.lessons.length
                    ? course.id === 'prabhupada'
                      ? 'All lectures completed'
                      : 'Course completed'
                    : 'End of this list'}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="button primary" disabled={busy} onClick={() => void complete()}>
                <Check size={16} />
                {busy
                  ? 'Saving…'
                  : course.id === 'prabhupada'
                    ? 'Mark lecture complete'
                    : 'Mark lesson complete'}
              </button>
            )}
          </div>
          <div className="save-status" role="status">
            {error ? (
              <>
                <span className="error">{error}</span>
                <button
                  className="text-button"
                  onClick={() => void persist.current(true).catch(() => {})}
                >
                  Review and save this place
                </button>
              </>
            ) : (
              status || 'Your place will be saved while you watch.'
            )}
          </div>
          {course.id === 'soulful-japa' && (
            <details className="secondary-panel">
              <summary>
                <Bookmark size={16} /> Keep one instruction for my next Japa
              </summary>
              <form
                className="lesson-note"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await save('instruction', {
                      text: note.trim(),
                      source: lesson.title,
                      sourceUrl: `https://www.youtube.com/watch?v=${lesson.id}`,
                    });
                    setStatus('Your instruction will be waiting in your Japa space.');
                    setNote('');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  In your own words
                  <textarea
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What would you like to bring into your chanting?"
                  />
                </label>
                <button className="button secondary" disabled={!note.trim() || busy}>
                  Save my instruction
                </button>
              </form>
            </details>
          )}
          <details className="secondary-panel">
            <summary>Watched elsewhere? Update my bookmark</summary>
            <ManualBookmark
              key={lesson.id}
              position={position}
              onSave={async (seconds) => {
                const duration =
                  player.current?.getDuration?.() ||
                  lesson.durationSeconds ||
                  progress.current.lessons[lesson.id]?.duration ||
                  0;
                if (
                  !Number.isFinite(seconds) ||
                  !Number.isInteger(seconds) ||
                  seconds < 0 ||
                  seconds > (duration || 86400)
                )
                  throw new Error(
                    duration
                      ? `Choose a position within this ${playbackTime(duration)} lesson.`
                      : 'Choose a valid position below 24 hours.',
                  );
                capture.current();
                player.current?.pauseVideo?.();
                if (playerIsReady.current && player.current) {
                  seekTarget.current = {
                    id: lesson.id,
                    position: seconds,
                    expires: Date.now() + 10000,
                  };
                  if ([-1, 0, 5].includes(player.current.getPlayerState()))
                    player.current.cueVideoById({ videoId: lesson.id, startSeconds: seconds });
                  else player.current.seekTo(seconds, true);
                }
                last.current = { time: seconds, wall: performance.now() };
                updatePosition(lesson.id, seconds, duration);
                await persist.current(true);
              }}
            />
            <p className="fine-print">
              A manual bookmark changes your place, not your watched minutes.
            </p>
          </details>
          <button
            className="text-button record-hearing"
            onClick={() =>
              actions.open('hearing', {
                title: lesson.title,
                speaker: course.speaker,
                isPrabhupada: course.id === 'prabhupada',
                url: `https://www.youtube.com/watch?v=${lesson.id}`,
                durationMinutes: Math.round((watchedHere.current[lesson.id] ?? 0) / 60),
                type: 'Lecture',
              })
            }
          >
            Add a hearing journal entry <ArrowRight size={15} />
          </button>
        </div>
        <aside className="lesson-sidebar">
          <section className="daily-learning">
            <span className="eyebrow">A LITTLE SPACE, EACH DAY</span>
            <h2>
              {secondsLeft > 0
                ? `${Math.ceil(secondsLeft / 60)} minutes to settle in.`
                : 'You made space for hearing.'}
            </h2>
            <p>
              {secondsLeft > 0
                ? 'Pause whenever you need. Your next visit starts here.'
                : 'Your daily session is complete. Stay a little longer or return tomorrow.'}
            </p>
            <div className="learning-meter">
              <span style={{ width: Math.min(100, (todaySeconds / (goal * 60)) * 100) + '%' }} />
            </div>
            <small>
              {Math.floor(todaySeconds / 60)} of {goal} minutes today ·{' '}
              {playing ? 'Playing' : 'Ready when you are'}
            </small>
            {course.id !== 'soulful-japa' && (
              <label className="session-length">
                This session
                <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
            )}
          </section>
        </aside>
        <section
          className="course-outline full-course-outline"
          aria-labelledby="lesson-library-title"
        >
          <h2 id="lesson-library-title">
            <span>
              {course.id === 'prabhupada' ? 'All lectures' : 'All lessons'}{' '}
              <small>
                {course.lessons.length} available · {count} completed
              </small>
            </span>
          </h2>
          {course.id === 'prabhupada' && <LectureSync />}
          <input
            aria-label="Find a lesson"
            placeholder="Find a session…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="lesson-list">
            {course.lessons
              .filter((l) => l.title.toLowerCase().includes(filter.toLowerCase()))
              .map((l) => (
                <button
                  key={l.id}
                  className={'lesson-row ' + (l.id === lesson.id ? 'selected' : '')}
                  onClick={() => void choose(l.id)}
                  disabled={busy}
                  aria-current={l.id === lesson.id ? 'step' : undefined}
                >
                  <span className="lesson-number">
                    {progress.current.lessons[l.id]?.completed ? (
                      <Check size={15} />
                    ) : (
                      String(l.position).padStart(2, '0')
                    )}
                  </span>
                  <span>
                    {l.title}
                    <small>
                      {l.durationSeconds ? playbackTime(l.durationSeconds) : 'Video lesson'}
                    </small>
                  </span>
                  {l.id === lesson.id && <Play size={13} />}
                </button>
              ))}
          </div>
          {!course.lessons.some((l) => l.title.toLowerCase().includes(filter.toLowerCase())) && (
            <p className="fine-print">No lectures match this search. Try a shorter title.</p>
          )}
          <p className="fine-print">
            {course.id === 'prabhupada'
              ? 'English lectures from The Acharya · 30–45 minutes. New lectures are added without changing your saved place.'
              : 'Every lesson is listed in session order. Finish a lesson to continue to the next, or revisit any lesson here.'}
          </p>
        </section>
      </div>
    </>
  );
}

function ManualBookmark({
  position,
  onSave,
}: {
  position: number;
  onSave: (seconds: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(String(Math.floor(position / 60))),
    [seconds, setSeconds] = useState(String(Math.floor(position % 60))),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="manual-bookmark"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSave(Number(minutes) * 60 + Number(seconds));
          setError('Bookmark saved.');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Minutes
        <input
          required
          type="number"
          min="0"
          max="1440"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
      </label>
      <label>
        Seconds
        <input
          required
          type="number"
          min="0"
          max="59"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
        />
      </label>
      <button className="button secondary" disabled={busy}>
        Save position
      </button>
      {error && <p role="status">{error}</p>}
    </form>
  );
}
