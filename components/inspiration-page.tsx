'use client';
import { Flower2, Sprout, PenLine, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { type AppState, defaultPurpose, qualities } from '@/lib/domain/model';
import { onDate, totals, period } from '@/lib/domain/calculations';
import { weekBounds, monthBounds, formatMinutes } from '@/lib/domain/dates';
import { EntryList } from './entry-list';
import { Stat } from './practice-page';
import type { Actions } from './journal-app';
export function InspirationPage({
  kind,
  state,
  date,
  actions,
}: {
  kind: 'jayananda' | 'prabhupada' | 'purpose';
  state: AppState;
  date: string;
  actions: Actions;
}) {
  const s = state.settings,
    r = onDate(state.records, date),
    v = totals(r, s);
  if (kind === 'purpose')
    return (
      <section className="purpose-page">
        <Flower2 size={40} />
        <p className="eyebrow">REMIND ME WHY</p>
        <h1>Why am I doing this?</h1>
        <p className="purpose-text">{String(state.records.purpose[0]?.text || defaultPurpose)}</p>
        <button
          className="text-button"
          onClick={() =>
            actions.open('purpose', state.records.purpose[0] ?? { text: defaultPurpose })
          }
        >
          <PenLine size={16} /> Edit my purpose
        </button>
        <Link href="/" className="button primary">
          Return to my practice <ArrowRight size={16} />
        </Link>
        <div className="purpose-goals">
          <div className="section-heading">
            <h2>Personal intentions</h2>
            <button className="text-button" onClick={() => actions.open('goals')}>
              + Add intention
            </button>
          </div>
          <EntryList collection="goals" entries={state.records.goals} actions={actions} />
        </div>
      </section>
    );
  if (kind === 'jayananda')
    return (
      <>
        <div className="page-intro">
          <span className="eyebrow">SERVICE INSPIRATION</span>
          <h1>Jayananda.</h1>
          <p>A daily intention to serve with humility, simplicity and care.</p>
        </div>
        <section className="quality-feature">
          <Sprout size={38} />
          <span className="eyebrow">QUALITY OF THE WEEK</span>
          <h2>{s.quality}</h2>
          <p>This week I want to consciously practice {s.quality.toLowerCase()}.</p>
          <button
            className="button primary"
            onClick={() => actions.open('quality', { quality: s.quality })}
          >
            <PenLine size={17} /> How did I practice this today?
          </button>
        </section>
        <div className="qualities-grid">
          {qualities.map((q) => (
            <button
              className={q === s.quality ? 'active' : ''}
              key={q}
              onClick={() => actions.open('quality', { quality: q })}
            >
              {q}
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <p className="fine-print source-note">
          These are personal reflection prompts, not quotations or biographical claims. Verified
          stories and source references can be added later.
        </p>
        <h2>Reflections on service</h2>
        <EntryList collection="quality" entries={state.records.quality} actions={actions} />
      </>
    );
  const week = totals(period(state.records, ...weekBounds(date)), s),
    month = totals(period(state.records, ...monthBounds(date)), s);
  const connected = [
    ['Heard Śrīla Prabhupāda', r.hearing.some((e) => e.isPrabhupada)],
    ['Read Śrīla Prabhupāda', r.reading.some((e) => e.isPrabhupada) || r.krishna.length > 0],
    ['Reflected on an instruction', r.prabhupada.some((e) => e.instruction || e.reflection)],
    [
      'Prayed to Śrīla Prabhupāda',
      r.prabhupada.some((e) => e.prayer) || r.reflection.some((e) => e.prayer),
    ],
  ] as const;
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">HEARING · READING · REMEMBERING</span>
        <h1>
          My connection with
          <br />
          Śrīla Prabhupāda.
        </h1>
        <p>Carry one instruction into the ordinary moments of your day.</p>
      </div>
      <div className="stat-grid">
        <Stat label="Association · Today" value={formatMinutes(v.prabhupada)} />
        <Stat label="Association · This week" value={formatMinutes(week.prabhupada)} />
        <Stat label="Association · This month" value={formatMinutes(month.prabhupada)} />
      </div>
      <p className="fine-print">
        Time spent hearing Śrīla Prabhupāda and reading his books, including Krishna Book.
      </p>
      <section className="panel">
        <h2>Today’s connection</h2>
        <div className="connection-list">
          {connected.map(([label, done]) => (
            <p key={label}>
              <span>{done ? <Check size={17} /> : '○'}</span>
              {label}
            </p>
          ))}
        </div>
        <button
          className="button primary"
          onClick={() => actions.open('prabhupada', r.prabhupada[0])}
        >
          <PenLine size={17} /> An instruction, a reflection, a prayer
        </button>
      </section>
      <EntryList collection="prabhupada" entries={state.records.prabhupada} actions={actions} />
      <p className="fine-print source-note">
        Your personal recollections are kept as journal entries. No unsourced quotations are
        presented as verified teachings.
      </p>
    </>
  );
}
