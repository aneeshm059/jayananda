'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, Flower2, Moon, ArrowRight } from 'lucide-react';
import { type AppState, type Collection } from '@/lib/domain/model';
import { forms } from '@/lib/domain/forms';
import { onDate, totals, period, average, attentionInsight, sum } from '@/lib/domain/calculations';
import {
  weekBounds,
  monthBounds,
  formatMinutes,
  daysBetween,
  addDays,
  timeMinutes,
} from '@/lib/domain/dates';
import { Beads } from './today';
import { EntryList } from './entry-list';
import type { Actions } from './journal-app';
export function PracticePage({
  collection,
  state,
  date,
  actions,
}: {
  collection: Collection;
  state: AppState;
  date: string;
  actions: Actions;
}) {
  const [filter, setFilter] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const r = onDate(state.records, date),
    v = totals(r, state.settings),
    week = totals(period(state.records, ...weekBounds(date)), state.settings),
    month = totals(period(state.records, ...monthBounds(date)), state.settings);
  const def = forms[collection];
  if (!def) return null;
  const key =
    collection === 'hearing'
      ? 'hearing'
      : collection === 'reading'
        ? 'reading'
        : collection === 'krishna'
          ? 'krishna'
          : collection === 'association'
            ? 'association'
            : null;
  const entries = state.records[collection]
    .filter((e) => e.date <= date && e.date >= monthBounds(date)[0])
    .filter(
      (e) => !filter || Object.values(e).join(' ').toLowerCase().includes(filter.toLowerCase()),
    );
  const pendingRound = useRef<string | null>(null);
  async function quick(n: number) {
    setBusy(true);
    try {
      pendingRound.current ??= crypto.randomUUID();
      await actions.save('japa', {
        date,
        rounds: n,
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
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">
          {collection === 'krishna'
            ? 'A QUIET ENDING'
            : collection === 'japa'
              ? 'THE HEART OF YOUR DAY'
              : 'YOUR DAILY PRACTICE'}
        </span>
        <h1>{def.title}</h1>
        <p>{def.subtitle}</p>
        <div className="intro-actions">
          {['japa', 'krishna'].includes(collection) && (
            <button
              className="button primary"
              onClick={() => actions.focus(collection as 'japa' | 'krishna')}
            >
              {collection === 'japa' ? <Flower2 size={18} /> : <Moon size={18} />}{' '}
              {collection === 'japa' ? 'Enter Japa mode' : 'Begin night reading'}
            </button>
          )}
          <button
            className="button secondary"
            onClick={() =>
              actions.open(collection, collection === 'reflection' ? r.reflection[0] : undefined)
            }
          >
            <Plus size={17} />{' '}
            {collection === 'reflection' ? 'Write tonight’s reflection' : 'Add session'}
          </button>
          {collection === 'reading' && (
            <Link className="text-button" href="/hearing">
              Go to hearing <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {collection === 'japa' ? (
        <section className="japa-card standalone">
          <div className="japa-progress">
            <div>
              <span className="eyebrow">TODAY’S ROUNDS</span>
              <Beads rounds={v.rounds} target={state.settings.ideal.japa} />
            </div>
            <div className="round-total">
              <strong>{v.rounds}</strong>
              <span>
                / {state.settings.ideal.japa}
                <small>ROUNDS</small>
              </span>
            </div>
          </div>
          <div className="card-actions">
            <button className="button primary" disabled={busy} onClick={() => void quick(1)}>
              + 1 round
            </button>
            <button className="button secondary" disabled={busy} onClick={() => void quick(4)}>
              + 4 rounds
            </button>
          </div>
        </section>
      ) : null}
      <div className="stat-grid">
        {collection === 'japa' ? (
          <>
            <Stat label="Rounds this week" value={String(week.rounds)} />
            <Stat
              label="Average attention this month"
              value={month.attention ? `${month.attention.toFixed(1)} / 5` : 'Not recorded'}
            />
            <Stat
              label="Average recorded session time"
              value={formatMinutes(
                average(
                  state.records.japa.filter((e) => Number(e.durationMinutes) > 0),
                  'durationMinutes',
                ) ?? 0,
              )}
            />
          </>
        ) : key ? (
          <>
            <Stat label="Today" value={formatMinutes(v[key])} />
            <Stat label="This week" value={formatMinutes(week[key])} />
            <Stat label="This month" value={formatMinutes(month[key])} />
          </>
        ) : (
          <>
            <Stat label="Entries this month" value={String(entries.length)} />
            <Stat label="Days recorded" value={String(new Set(entries.map((e) => e.date)).size)} />
            <Stat label="Today" value={String(r[collection].length) + ' recorded'} />
          </>
        )}
      </div>
      {collection === 'krishna' && (
        <div className="gentle-note">
          <strong>
            {week.krishnaNights} nights this week · {month.krishnaNights} nights this month
          </strong>
          <p>
            {month.krishnaPages} pages · {month.chapters} chapters completed
            {month.currentChapter ? ` · Current chapter ${month.currentChapter}` : ''}
          </p>
        </div>
      )}
      {collection === 'japa' && (
        <>
          <div className="panel">
            <span className="eyebrow">A LITTLE EACH DAY</span>
            <h3>Rounds over the past two weeks</h3>
            <div className="bar-chart">
              {daysBetween(addDays(date, -13), date).map((d) => {
                const n = sum(onDate(state.records, d).japa, 'rounds');
                return (
                  <div key={d} title={`${d}: ${n} rounds`}>
                    <span>{n}</span>
                    <i
                      style={{
                        height: `${Math.max(3, Math.min(120, (n / state.settings.ideal.japa) * 110))}px`,
                      }}
                    />
                    <small>{d.slice(8)}</small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="gentle-note">
            <p>
              {attentionInsight(state.records) ||
                'Keep recording attention when it feels useful. Patterns will appear as your journal grows.'}
            </p>
            <p>
              {
                new Set(
                  state.records.japa
                    .filter((e) => e.startTime && timeMinutes(String(e.startTime)) < 360)
                    .map((e) => e.date),
                ).size
              }{' '}
              days with Japa beginning before 6 AM in the loaded period.
            </p>
            <p>
              {
                daysBetween(...monthBounds(date)).filter(
                  (d) =>
                    sum(
                      onDate(state.records, d).japa.filter(
                        (e) => e.endTime && String(e.endTime) <= state.settings.workStart,
                      ),
                      'rounds',
                    ) >= state.settings.ideal.japa,
                ).length
              }{' '}
              days with all target rounds recorded as finished before work (
              {state.settings.workStart}). Only sessions with an end time count.
            </p>
          </div>
        </>
      )}
      <div className="section-heading">
        <h2>Your journal</h2>
        <label className="search-field">
          <span className="sr-only">Filter entries</span>
          <input
            aria-label="Filter entries"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={
              collection === 'reading'
                ? 'Filter by book…'
                : collection === 'hearing'
                  ? 'Filter by speaker or title…'
                  : collection === 'seva'
                    ? 'Filter by service category…'
                    : 'Search this month…'
            }
          />
        </label>
      </div>
      <p className="muted small-text">
        Selected month, through {date}. Change the date above to revisit another month.
      </p>
      <EntryList collection={collection} entries={entries} actions={actions} empty={def.subtitle} />
    </>
  );
}
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
