'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';
import {
  ArrowRight,
  Sun,
  Headphones,
  BookOpen,
  Moon,
  HeartHandshake,
  PenLine,
  Flower2,
  Plus,
  Check,
  ChevronRight,
  Sprout,
} from 'lucide-react';
import { type AppState, type Collection, defaultSankalpa, healthNote } from '@/lib/domain/model';
import { onDate, totals, health, dayMode } from '@/lib/domain/calculations';
import { localTime, prettyDate } from '@/lib/domain/dates';
import type { Actions } from './journal-app';
export function Beads({ rounds, target }: { rounds: number; target: number }) {
  return (
    <div className="beads" aria-label={`${rounds} of ${target} rounds completed`}>
      {Array.from({ length: Math.min(target, 64) }, (_, i) => (
        <span key={i} className={i < rounds ? 'filled' : ''} />
      ))}
    </div>
  );
}
export function Health({ value }: { value: number }) {
  return (
    <div className="health-card">
      <div className="health-top">
        <div>
          <span className="eyebrow">SĀDHANA HEALTH</span>
          <h3>Steady, sincere practice.</h3>
        </div>
        <div
          className="health-ring"
          style={{ background: `conic-gradient(var(--gold) ${value}%, var(--line) 0)` }}
        >
          <span>
            {value}
            <small>%</small>
          </span>
        </div>
      </div>
      <p className="fine-print">{healthNote}</p>
    </div>
  );
}
export function Dashboard({
  state,
  date,
  actions,
}: {
  state: AppState;
  date: string;
  actions: Actions;
}) {
  const s = state.settings,
    r = onDate(state.records, date),
    v = totals(r, s),
    mode = dayMode(r),
    target = s[mode];
  const time = localTime(s.timezone),
    evening = time >= s.eveningStart || time < '04:00',
    morning = time < '10:00' && time >= '04:00',
    mood = s.hero === 'morning' ? 'morning' : evening ? 'evening' : morning ? 'morning' : 'day';
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pendingRound = useRef<string | null>(null);
  async function quick(rounds: number) {
    setBusy(true);
    try {
      pendingRound.current ??= crypto.randomUUID();
      await actions.save('japa', {
        date,
        rounds,
        durationMinutes: 0,
        _requestId: pendingRound.current,
      });
      pendingRound.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cards: [Collection, string, string, string, typeof Sun, boolean][] = [
    [
      'wake',
      'Wake up',
      r.wake[0]?.actualTime ? String(r.wake[0].actualTime) : 'A fresh beginning',
      `Target ${s.wakeTarget}`,
      Sun,
      !!r.wake[0]?.actualTime,
    ],
    [
      'wake',
      'Morning program',
      r.wake[0]?.programCompleted ? 'A morning offered' : 'Make a little space',
      s.morningProgram.join(' · '),
      Flower2,
      !!r.wake[0]?.programCompleted,
    ],
    [
      'hearing',
      'Prabhupāda hearing',
      `${v.hearing} / ${target.hearing} min`,
      'Take a few minutes for hearing.',
      Headphones,
      v.hearing >= target.hearing,
    ],
    [
      'reading',
      'Daytime reading',
      `${v.reading} / ${target.reading} min`,
      'A few attentive pages.',
      BookOpen,
      v.reading >= target.reading,
    ],
    [
      'seva',
      'Seva',
      v.seva
        ? `${v.seva} service ${v.seva === 1 ? 'entry' : 'entries'}`
        : 'An opportunity to serve',
      'Small acts. A sincere heart.',
      HeartHandshake,
      v.seva > 0,
    ],
    [
      'reflection',
      'Night reflection',
      r.daily[0]?.closed
        ? 'Today has been offered'
        : v.reflections
          ? 'Reflection recorded'
          : 'A few sincere lines',
      'Look back with gratitude.',
      PenLine,
      v.reflections > 0,
    ],
  ];
  return (
    <>
      <section className={`hero hero-${mood} hero-${s.hero}`}>
        <picture>
          <source media="(max-width: 600px)" srcSet="/hero-mobile.webp" />
          <img
            src="/hero.webp"
            alt=""
            className="hero-image"
            fetchPriority="high"
            width="1440"
            height="640"
          />
        </picture>
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="hero-date">{prettyDate(date)}</span>
          <h1>{evening ? 'Complete the day peacefully.' : `Hare Krishna, ${s.name}.`}</h1>
          <div className="hero-intention">
            <button
              className="eyebrow"
              onClick={() => actions.open('sankalpa', r.sankalpa[0] ?? { text: defaultSankalpa })}
            >
              TODAY’S SANKALPA <PenLine size={12} />
            </button>
            <p>“{r.sankalpa[0]?.text || defaultSankalpa}”</p>
          </div>
          <div className="hero-actions">
            <button
              className="button cream"
              onClick={() => actions.focus(evening ? 'krishna' : 'japa')}
            >
              {evening ? <Moon size={17} /> : <Flower2 size={18} />}{' '}
              {evening ? 'Begin Krishna Book reading' : 'Begin Japa'}
              <ArrowRight size={17} />
            </button>
            <Link href="/purpose">
              Remind me why <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="hero-corner">
          {evening ? 'A QUIET ENDING' : 'A SINCERE BEGINNING'}
          <span>HEARING · CHANTING · SERVICE</span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ONE PRACTICE AT A TIME</p>
          <h2>Today’s sādhana</h2>
        </div>
        <div className="mode-switch" aria-label="Daily standard">
          {(['ideal', 'minimum'] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? 'selected' : ''}
              aria-pressed={mode === m}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await actions.save('daily', { date, mode: m, closed: !!r.daily[0]?.closed });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {m === 'ideal' ? 'Ideal day' : 'Minimum day'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'minimum' && (
        <p className="gentle-note">A simpler rhythm for a demanding day. Continue from here.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="daily-layout">
        <div className="practice-column">
          <section className="japa-card">
            <div className="card-heading">
              <div className="icon-label">
                <span className="icon-tile">
                  <Flower2 size={22} />
                </span>
                <div>
                  <span className="eyebrow">THE HEART OF YOUR DAY</span>
                  <h3>Japa</h3>
                </div>
              </div>
              <Link href="/japa" className="text-button">
                View sessions <ChevronRight size={15} />
              </Link>
            </div>
            <div className="japa-progress">
              <Beads rounds={v.rounds} target={target.japa} />
              <div className="round-total">
                <strong>{v.rounds}</strong>
                <span>
                  / {target.japa}
                  <small>ROUNDS</small>
                </span>
              </div>
            </div>
            <div className="card-actions">
              <button className="button primary" onClick={() => void quick(1)} disabled={busy}>
                <Plus size={16} /> 1 round
              </button>
              <button className="button secondary" onClick={() => void quick(4)} disabled={busy}>
                + 4 rounds
              </button>
              <button className="text-button focus-link" onClick={() => actions.focus('japa')}>
                Enter Japa mode <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <div className="practice-grid">
            {cards.map(([key, title, value, note, Icon, done], i) => (
              <button
                className="practice-card"
                key={title}
                onClick={() =>
                  actions.open(
                    key,
                    key === 'wake' ? r.wake[0] : key === 'reflection' ? r.reflection[0] : undefined,
                  )
                }
              >
                <div className="practice-card-top">
                  <span className={'icon-tile tone-' + i}>
                    <Icon size={20} />
                  </span>
                  <span className={'status ' + (done ? 'done' : '')}>
                    {done ? (
                      <>
                        <Check size={12} /> Recorded
                      </>
                    ) : (
                      '○ Open'
                    )}
                  </span>
                </div>
                <h3>{title}</h3>
                <strong>{value}</strong>
                <p>{note}</p>
                <span className="card-arrow">
                  <Plus size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside className="today-aside">
          <section className="night-card">
            <div className="night-stars">
              ✧ <Moon size={27} /> ✧
            </div>
            <span className="eyebrow">{evening ? 'TONIGHT' : 'WHEN EVENING COMES'}</span>
            <h2>Krishna Book</h2>
            <span className="night-subtitle">Night Reading</span>
            <p>
              End the day
              <br />
              remembering Krishna.
            </p>
            <div className="night-progress">
              <span>
                {v.krishna ? `✓ ${v.krishna} minutes recorded` : '○ A quiet moment awaits'}
              </span>
              <small>YOUR INTENTION · {target.krishna} MINUTES</small>
            </div>
            <button className="button cream wide" onClick={() => actions.focus('krishna')}>
              {v.krishna ? 'Continue reading' : 'Begin night reading'}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => actions.open('krishna')}>
              Log a reading session
            </button>
          </section>
          <section className="quality-card">
            <Sprout size={22} />
            <p className="eyebrow">QUALITY OF THE WEEK</p>
            <h3>{s.quality}</h3>
            <p>This week I want to consciously practice {s.quality.toLowerCase()}.</p>
            <button
              className="text-button"
              onClick={() => actions.open('quality', { quality: s.quality })}
            >
              A moment to reflect <ArrowRight size={15} />
            </button>
          </section>
          <Health value={health(r, s, mode)} />
        </aside>
      </div>
      {state.records.reminders.some((e) => e.enabled) && (
        <section className="gentle-reminders">
          <h3>Gentle cues for today</h3>
          {state.records.reminders
            .filter((e) => e.enabled)
            .map((e) => (
              <p key={e.id}>
                <time>{String(e.time)}</time> {String(e.message)}
              </p>
            ))}
        </section>
      )}
      <div className="closing-note">
        <Flower2 size={20} />
        <p>
          Little by little, day by day.
          <br />
          <span>Let your practice be the place you return to.</span>
        </p>
      </div>
    </>
  );
}
