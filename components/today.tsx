'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Sun,
  Headphones,
  BookOpen,
  Moon,
  HeartHandshake,
  PenLine,
  Flower2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sprout,
  Users,
  ClipboardList,
} from 'lucide-react';
import { type AppState, type Collection, defaultSankalpa, healthNote } from '@/lib/domain/model';
import { onDate, totals, health, dayMode, period } from '@/lib/domain/calculations';
import { localTime, prettyDate, addDays, formatMinutes } from '@/lib/domain/dates';
import { practiceGarden } from '@/lib/domain/practice-garden';
import type { Actions } from './journal-app';
import { HabitDashboard } from './habit-checkin';
import { JapaControls } from './japa-controls';
import { PurposeCue } from './purpose-cue';
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
const practices = [
  { key: 'japa', label: 'Japa', icon: Flower2, note: 'One round. A little more presence.' },
  { key: 'wake', label: 'Morning', icon: Sun, note: 'A fresh beginning, at your own pace.' },
  {
    key: 'hearing',
    label: 'Hearing',
    icon: Headphones,
    note: 'Carry one instruction into your day.',
  },
  {
    key: 'reading',
    label: 'Reading',
    icon: BookOpen,
    note: 'A few attentive pages can stay with you.',
  },
  { key: 'krishna', label: 'Krishna Book', icon: Moon, note: 'End the day remembering Krishna.' },
  { key: 'seva', label: 'Seva', icon: HeartHandshake, note: 'Small acts. A sincere heart.' },
  {
    key: 'association',
    label: 'Association',
    icon: Users,
    note: 'Remember what you received in good company.',
  },
] as const;
const tabs = ['Practice', 'Habits', 'Reflect'] as const;
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
    evening = time >= s.eveningStart || time < '04:00';
  const [tab, setTab] = useState<(typeof tabs)[number]>('Practice');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const recent = totals(period(state.records, addDays(state.today, -6), state.today), s);
  const garden = practiceGarden(state);
  const current = practices[index];
  const recorded = (key: Collection) => (key === 'japa' ? v.rounds > 0 : r[key].length > 0);
  function move(delta: number) {
    setIndex((n) => (n + delta + practices.length) % practices.length);
  }
  return (
    <div className="companion-home">
      <section className={'welcome-card welcome-' + s.hero}>
        <div className="welcome-copy">
          <span className="eyebrow">{prettyDate(date)} · YOUR QUIET CORNER</span>
          <h1>
            Hare Krishna, {s.name}.<br />
            <span>{evening ? 'Come back to yourself.' : 'A little space to grow.'}</span>
          </h1>
          <p>No need to do everything at once. Begin with one small practice.</p>
          <div className="welcome-actions">
            <a href="#tab-Practice" className="button primary" onClick={() => setTab('Practice')}>
              Begin a moment <ArrowRight size={16} />
            </a>
            <Link href="/today-report" className="text-button">
              <ClipboardList size={16} /> Today Report
            </Link>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <img src="/hero-mobile.webp" alt="" width="640" height="640" />
          <span>HEAR · CHANT · REMEMBER</span>
        </div>
      </section>
      <section className="practice-garden" aria-label="Your practice garden, last seven days">
        <div className="garden-copy">
          <span className="garden-emblem">
            <Sprout size={24} />
          </span>
          <div>
            <h2>
              {garden.today ? 'A little effort. A little growth.' : 'Your next little beginning.'}
            </h2>
            <p>
              {garden.days
                ? `You made space for practice on ${garden.days} of the last 7 days.`
                : 'Every sincere return helps your practice grow.'}
            </p>
          </div>
        </div>
        <div className="garden-days">
          {garden.week.map((day) => (
            <div
              className={
                'garden-day ' +
                (day.active ? 'bloomed ' : '') +
                (day.date === date ? 'is-today' : '')
              }
              key={day.date}
              title={`${prettyDate(day.date)}: ${day.active ? 'Practice recorded' : 'No practice recorded'}`}
            >
              <span
                aria-label={`${prettyDate(day.date)}: ${day.active ? 'Practice recorded' : 'No practice recorded'}`}
              >
                {day.active ? <Flower2 size={24} /> : <span className="garden-seed" />}
              </span>
              <small>{prettyDate(day.date, { weekday: 'narrow' })}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="companion-tabs" role="tablist" aria-label="Today’s space">
        {tabs.map((name, i) => (
          <button
            key={name}
            id={'tab-' + name}
            role="tab"
            aria-selected={tab === name}
            aria-controls={'panel-' + name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (i + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (i + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById('tab-' + tabs[next])?.focus();
              }
            }}
          >
            {name === 'Practice' ? (
              <Flower2 size={17} />
            ) : name === 'Habits' ? (
              <Check size={17} />
            ) : (
              <PenLine size={17} />
            )}{' '}
            {name}
          </button>
        ))}
      </div>
      <section
        className="companion-panel"
        id="panel-Practice"
        role="tabpanel"
        aria-labelledby="tab-Practice"
        hidden={tab !== 'Practice'}
      >
        <div className="practice-picker" aria-label="Choose a practice">
          {practices.map((practice, i) => (
            <button key={practice.key} aria-pressed={i === index} onClick={() => setIndex(i)}>
              <practice.icon size={18} />
              {practice.label}
              {recorded(practice.key) && <Check className="picker-check" size={12} />}
            </button>
          ))}
        </div>
        <div className="practice-deck">
          <div className="deck-heading">
            <span className="eyebrow">A MOMENT FOR {current.label.toUpperCase()}</span>
            <div>
              <span>
                {index + 1} / {practices.length}
              </span>
              <button
                className="icon-button"
                aria-label="Previous practice"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={19} />
              </button>
              <button className="icon-button" aria-label="Next practice" onClick={() => move(1)}>
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          {practices.map((practice, i) => (
            <div
              key={practice.key}
              className={'deck-card deck-' + practice.key}
              hidden={i !== index}
            >
              <span className="deck-icon">
                <practice.icon size={30} />
              </span>
              <h2>{practice.label === 'Morning' ? 'A gentle start.' : practice.label}</h2>
              <p className="deck-note">{practice.note}</p>
              {practice.key === 'japa' ? (
                <>
                  <div className="deck-rounds" aria-live="polite">
                    <strong>{v.rounds}</strong>
                    <span>of {target.japa} rounds</span>
                  </div>
                  <Beads rounds={v.rounds} target={target.japa} />
                  <JapaControls entries={r.japa} date={date} actions={actions} />
                  <div className="deck-links">
                    <button className="text-button" onClick={() => actions.focus('japa')}>
                      Enter Japa mode <ArrowRight size={16} />
                    </button>
                    <Link className="text-button" href="/japa">
                      Sessions & details
                    </Link>
                  </div>
                </>
              ) : practice.key === 'wake' ? (
                <>
                  <div className="morning-mini">
                    <button onClick={() => actions.open('wake', r.wake[0])}>
                      <Sun size={20} />
                      <strong>
                        {r.wake[0]?.actualTime ? String(r.wake[0].actualTime) : 'Record wake-up'}
                      </strong>
                      <small>Wake-up · target {s.wakeTarget}</small>
                    </button>
                    <button onClick={() => actions.open('wake', r.wake[0])}>
                      <Flower2 size={20} />
                      <strong>
                        {r.wake[0]?.programCompleted ? 'Morning offered' : 'Morning program'}
                      </strong>
                      <small>{s.morningProgram.join(' · ')}</small>
                    </button>
                  </div>
                  <p className="deck-footnote">Your morning details stay together in one entry.</p>
                </>
              ) : (
                <>
                  <div className="deck-metric">
                    {practice.key === 'seva' ? (
                      <>
                        <strong>{v.seva}</strong>
                        <span>service {v.seva === 1 ? 'entry' : 'entries'}</span>
                      </>
                    ) : (
                      <>
                        <strong>{formatMinutes(v[practice.key])}</strong>
                        <span>
                          {practice.key === 'association'
                            ? 'of connection today'
                            : `of ${target[practice.key]} min today`}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="deck-primary-actions">
                    {practice.key === 'krishna' && (
                      <button className="button primary" onClick={() => actions.focus('krishna')}>
                        <Moon size={17} /> Begin night reading
                      </button>
                    )}
                    <button
                      className={'button ' + (practice.key === 'krishna' ? 'secondary' : 'primary')}
                      onClick={() => actions.open(practice.key)}
                    >
                      Record {practice.label.toLowerCase()} <ArrowRight size={16} />
                    </button>
                  </div>
                  <Link className="text-button" href={'/' + practice.key}>
                    Sessions & details <ChevronRight size={15} />
                  </Link>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="rhythm-bar">
          <span>A rhythm that fits today</span>
          <div className="mode-switch" aria-label="Daily standard">
            {(['ideal', 'minimum'] as const).map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                className={mode === m ? 'selected' : ''}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
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
      </section>
      <section
        className="companion-panel"
        id="panel-Habits"
        role="tabpanel"
        aria-labelledby="tab-Habits"
        hidden={tab !== 'Habits'}
      >
        <HabitDashboard state={state} actions={actions} />
      </section>
      <section
        className="companion-panel reflection-space"
        id="panel-Reflect"
        role="tabpanel"
        aria-labelledby="tab-Reflect"
        hidden={tab !== 'Reflect'}
      >
        <div className="reflection-pair">
          <article className="reflection-tile">
            <PenLine size={24} />
            <span className="eyebrow">TODAY’S SANKALPA</span>
            <h2>Carry one intention.</h2>
            <p>“{r.sankalpa[0]?.text || defaultSankalpa}”</p>
            <button
              className="text-button"
              onClick={() => actions.open('sankalpa', r.sankalpa[0] ?? { text: defaultSankalpa })}
            >
              Edit my intention <ArrowRight size={16} />
            </button>
          </article>
          <article className="reflection-tile lavender">
            <Moon size={24} />
            <span className="eyebrow">A QUIET ENDING</span>
            <h2>{r.daily[0]?.closed ? 'Today has been offered.' : 'A few sincere lines.'}</h2>
            <p>
              {v.reflections
                ? 'Your reflection is here whenever you want to return.'
                : 'Look back with gratitude. Let the day settle.'}
            </p>
            <button
              className="button primary"
              onClick={() => actions.open('reflection', r.reflection[0])}
            >
              {v.reflections ? 'Read my reflection' : 'Reflect & offer the day'}{' '}
              <ArrowRight size={16} />
            </button>
          </article>
        </div>
        <details className="fold-panel">
          <summary>
            My purpose & quality of the week <Sprout size={18} />
          </summary>
          <div className="fold-body">
            <PurposeCue state={state} actions={actions} />
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
          </div>
        </details>
      </section>
      <details className="fold-panel home-details">
        <summary>
          Your journey, a little deeper <span>Progress, reminders & encouragement</span>
        </summary>
        <div className="fold-body">
          <Health value={health(r, s, mode)} />
          <section className="recent-encouragement">
            <div>
              <p className="eyebrow">THE LAST SEVEN DAYS</p>
              <h2>Your small efforts matter.</h2>
              <p>
                {recent.krishnaNights
                  ? `You made time for Krishna Book on ${recent.krishnaNights} ${recent.krishnaNights === 1 ? 'evening' : 'evenings'}.`
                  : recent.rounds
                    ? `You recorded ${recent.rounds} rounds of Japa. Keep making space to hear.`
                    : 'Your journey can begin with one small practice today.'}
              </p>
            </div>
            <div className="recent-practice-facts">
              <span>
                <strong>{recent.rounds}</strong> Japa rounds
              </span>
              <span>
                <strong>{formatMinutes(recent.hearing)}</strong> hearing
              </span>
              <Link href="/weekly" className="text-button">
                Reflect on my week <ArrowRight size={16} />
              </Link>
            </div>
          </section>
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
        </div>
      </details>
      <p className="companion-signoff">
        <Flower2 size={16} /> Little by little, day by day.
      </p>
    </div>
  );
}
