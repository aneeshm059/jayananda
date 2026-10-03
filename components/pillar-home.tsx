'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Headphones,
  Play,
  Bookmark,
  Clock3,
  Check,
  Bell,
} from 'lucide-react';
import type { AppState } from '@/lib/domain/model';
import type {
  BookBookmark,
  CourseProgress,
  SavedInstruction,
  Rhythm,
} from '@/lib/domain/companion';
import { onDate, totals, dayMode } from '@/lib/domain/calculations';
import { prettyDate, localTime } from '@/lib/domain/dates';
import { learningCourses } from '@/lib/domain/learning-catalog';
import { suggestedGitaStart, type GitaReadingProgress } from '@/lib/domain/gita-reading';
import type { Actions } from './journal-app';
import { useCompanion } from './companion-provider';
import { MalaIcon } from './mala-icon';
import { PracticePage } from './practice-page';

export function CourseShortcut({ id, compact = false }: { id: string; compact?: boolean }) {
  const { values } = useCompanion();
  const course = learningCourses.find((c) => c.id === id);
  if (!course) return null;
  const progress = values['course:' + id] as CourseProgress | undefined;
  const lesson = course.lessons.find((l) => l.id === progress?.currentVideoId) ?? course.lessons[0];
  const seconds = lesson ? (progress?.lessons[lesson.id]?.position ?? 0) : 0;
  return (
    <Link href={'/learn?course=' + id} className={'course-shortcut ' + (compact ? 'compact' : '')}>
      {lesson && (
        <img src={`https://i.ytimg.com/vi/${lesson.id}/hqdefault.jpg`} alt="" loading="lazy" />
      )}
      <span className="course-shortcut-copy">
        <small>{id === 'soulful-japa' ? 'YOUR DAILY 30 MINUTES' : 'CONTINUE LEARNING'}</small>
        <strong>{course.title}</strong>
        <span>
          {seconds > 0
            ? `Resume at ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
            : 'Begin the first lesson'}{' '}
          <ArrowRight size={14} />
        </span>
      </span>
      <span className="round-play">
        <Play size={18} fill="currentColor" />
      </span>
    </Link>
  );
}

export function PillarHome({ state, actions }: { state: AppState; actions: Actions }) {
  const { values, ready } = useCompanion();
  const today = onDate(state.records, state.today),
    t = totals(today, state.settings);
  const target = state.settings[dayMode(today)].japa;
  const book = values.book as BookBookmark | undefined;
  const reading = values['reading:bg'] as GitaReadingProgress | undefined;
  const readingPlace = reading?.session?.start ?? reading?.cursor ?? suggestedGitaStart(book);
  const instruction = values.instruction as SavedInstruction | undefined;
  return (
    <div className="pillars-home">
      <div className="companion-greeting">
        <div>
          <span className="eyebrow">
            {prettyDate(state.today, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h1>
            Hare Krishna, {state.settings.name.split(' ')[0]}
            <span className="greeting-dot">.</span>
          </h1>
          <p>Your place to chant, hear, and return to the books.</p>
        </div>
        <Link href="/today-report" className="quiet-link">
          Today’s journal <ArrowUpRight size={16} />
        </Link>
      </div>
      <section
        className={'chant-hero ' + (state.settings.hero === 'none' ? 'chant-hero-no-art' : '')}
      >
        <div className="chant-hero-copy">
          <span className="pill-label">
            <MalaIcon size={19} /> CHANT · THE HEART OF YOUR DAY
          </span>
          <h2>
            One round.
            <br />
            <em>Your full attention.</em>
          </h2>
          <p>Let the next few minutes belong to the Holy Name.</p>
          <button className="button saffron-button" onClick={() => actions.focus('japa')}>
            <Play size={17} fill="currentColor" />
            {t.rounds ? 'Continue chanting' : 'Begin chanting'}
          </button>
          <div className="hero-progress">
            <span>
              {t.rounds} <small>of {target} rounds today</small>
            </span>
            <div className="hero-beads" aria-hidden="true">
              {Array.from({ length: Math.min(target, 24) }, (_, i) => (
                <i key={i} className={i < t.rounds ? 'filled' : ''} />
              ))}
            </div>
            <Link href="/japa">
              Open my Japa space <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        {state.settings.hero !== 'none' && (
          <div className="chant-hero-art">
            <img
              src="/hero-mobile.webp"
              alt="Japa beads, scripture and a lamp in a quiet devotional room"
            />
            <div className="hero-art-caption">
              <MalaIcon size={38} />
              <span>HEAR THE HOLY NAME</span>
            </div>
          </div>
        )}
      </section>
      <div className="pillar-pair">
        <Link href="/reading" className="pillar-card reading-pillar">
          <span className="pillar-icon">
            <BookOpen size={25} />
          </span>
          <div>
            <span className="eyebrow">READ · ŚRĪLA PRABHUPĀDA’S BOOKS</span>
            <h2>
              {reading?.completed
                ? 'A complete reading, to carry with you.'
                : reading?.session
                  ? 'Return to your reading.'
                  : 'Your next verse is waiting.'}
            </h2>
            <p>
              {reading?.completed
                ? 'Bhagavad-gītā As It Is · reading complete'
                : readingPlace
                  ? `Bhagavad-gītā · Chapter ${readingPlace.chapter}, verse ${readingPlace.verse}`
                  : 'Bhagavad-gītā As It Is · Begin where you are.'}
            </p>
            <strong>
              {reading?.completed ? 'Visit my reading space' : 'Continue Bhagavad-gītā'}{' '}
              <ArrowUpRight size={17} />
            </strong>
          </div>
          <span className="book-spines" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </Link>
        <Link href="/hearing" className="pillar-card hearing-pillar">
          <span className="pillar-icon">
            <Headphones size={25} />
          </span>
          <div>
            <span className="eyebrow">HEAR · ŚRĪLA PRABHUPĀDA</span>
            <h2>Make room for hearing.</h2>
            <p>A lecture ready to begin. Your place saved when you pause.</p>
            <strong>
              Open my listening space <ArrowUpRight size={17} />
            </strong>
          </div>
        </Link>
      </div>
      <div className="home-learning-row">
        <div className="home-learning-heading">
          <span className="eyebrow">LEARN TO CHANT WITH CARE</span>
          <h2>A lesson for your next round.</h2>
          <p>Follow Soulful Japa in sequence. A half-hour at a time.</p>
          <Link href="/soulful-japa" className="soulful-reading-link">
            <BookOpen size={16} /> Read the written modules <ArrowRight size={15} />
          </Link>
        </div>
        <CourseShortcut id="soulful-japa" />
      </div>
      {ready && instruction?.text && (
        <section className="remember-card">
          <Bookmark size={22} />
          <div>
            <span className="eyebrow">YOUR CHOSEN INSTRUCTION</span>
            <p>{instruction.text}</p>
            <a href={instruction.sourceUrl} target="_blank" rel="noreferrer">
              {instruction.source} <ArrowUpRight size={13} />
            </a>
          </div>
        </section>
      )}
      <RhythmSettings state={state} />
      <div className="home-journal-links">
        <span>Your journal is here whenever you need it.</span>
        <Link href="/journal">
          All practices <ArrowRight size={15} />
        </Link>
        <Link href="/habits">Habits</Link>
        <Link href="/history">History</Link>
      </div>
    </div>
  );
}

export function RhythmSettings({ state }: { state: AppState }) {
  const { values, save, ready } = useCompanion();
  const defaults: Rhythm = { japaTime: '', readingTime: '', hearingTime: '' };
  const rhythm = (values.rhythm as Rhythm) ?? defaults;
  const [edit, setEdit] = useState<Rhythm | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const now = localTime(state.settings.timezone),
    t = totals(onDate(state.records, state.today), state.settings);
  const p = values['course:soulful-japa'] as CourseProgress | undefined;
  const cues = [
    {
      time: rhythm.japaTime,
      done: t.rounds >= state.settings[dayMode(onDate(state.records, state.today))].japa,
      text: 'A quiet moment for your next round.',
      href: '/japa',
    },
    {
      time: rhythm.readingTime,
      done: onDate(state.records, state.today).reading.length > 0 || t.krishna > 0,
      text: 'Your book is waiting where you left it.',
      href: '/reading',
    },
    {
      time: rhythm.hearingTime,
      done: (p?.watchedByDay[state.today] ?? 0) >= 1800,
      text: 'Continue your half-hour of Soulful Japa.',
      href: '/learn?course=soulful-japa',
    },
  ].filter((c) => c.time && c.time <= now && !c.done);
  return (
    <div className="rhythm-area">
      {cues.slice(0, 1).map((c) => (
        <Link key={c.href} href={c.href} className="rhythm-cue">
          <Bell size={17} />
          {c.text}
          <ArrowRight size={16} />
        </Link>
      ))}
      <details className="rhythm-settings">
        <summary>
          <Clock3 size={16} /> Make space in my day <span>Optional</span>
        </summary>
        <p>
          Choose when you’d like a gentle cue while the app is open. Times follow{' '}
          {state.settings.timezone}.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage('');
            try {
              await save('rhythm', edit ?? rhythm);
              setMessage('Your rhythm is saved.');
              setEdit(null);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="rhythm-fields">
            {[
              ['japaTime', 'Chanting'],
              ['readingTime', 'Reading'],
              ['hearingTime', 'Soulful Japa'],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="time"
                  value={(edit ?? rhythm)[key as keyof Rhythm]}
                  onChange={(e) => setEdit({ ...rhythm, ...edit, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button className="button secondary" disabled={!ready || busy}>
            {busy ? 'Saving…' : 'Save my rhythm'}
            <Check size={15} />
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </details>
    </div>
  );
}

export function ChantCompanion({
  state,
  actions,
  date = state.today,
}: {
  state: AppState;
  actions: Actions;
  date?: string;
}) {
  const { values } = useCompanion();
  const instruction = values.instruction as SavedInstruction | undefined;
  return (
    <div className="chant-companion">
      <div className="page-intro">
        <span className="eyebrow">CHANT · HEAR THE HOLY NAME</span>
        <h1>A little space for Japa.</h1>
        <p>Begin with attention. Return to the sound, one round at a time.</p>
      </div>
      <section className="japa-invitation">
        <div className="mala-emblem">
          <MalaIcon size={130} />
        </div>
        <div>
          <h2>Your next round begins here.</h2>
          {instruction?.text ? (
            <div className="japa-instruction">
              <small>YOUR SAVED INSTRUCTION</small>
              <p>{instruction.text}</p>
              <a href={instruction.sourceUrl} target="_blank" rel="noreferrer">
                {instruction.source} ↗
              </a>
            </div>
          ) : (
            <p>Settle into your chanting. Your rounds and unfinished session will be kept here.</p>
          )}
          <button className="button primary" onClick={() => actions.focus('japa')}>
            <Play size={17} />
            Enter Japa space
          </button>
        </div>
      </section>
      <div className="home-learning-row">
        <div>
          <span className="eyebrow">LEARN · THEN BRING IT TO YOUR JAPA</span>
          <h2>Soulful Japa, day by day.</h2>
          <p>Watch the lessons. Spend a little time with the written modules.</p>
          <Link href="/soulful-japa" className="soulful-reading-link">
            <BookOpen size={16} /> Read modules <ArrowRight size={15} />
          </Link>
        </div>
        <CourseShortcut id="soulful-japa" />
      </div>
      <details className="secondary-panel">
        <summary>Rounds, reflections & session history</summary>
        <PracticePage collection="japa" state={state} date={date} actions={actions} />
      </details>
    </div>
  );
}
