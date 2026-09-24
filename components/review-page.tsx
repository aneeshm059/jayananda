'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { type AppState, type Collection, healthNote } from '@/lib/domain/model';
import {
  monthBounds,
  weekBounds,
  daysBetween,
  prettyDate,
  addDays,
  formatMinutes,
  formatClockMinutes,
} from '@/lib/domain/dates';
import {
  totals,
  period,
  onDate,
  health,
  dayMode,
  consistency,
  dayComplete,
} from '@/lib/domain/calculations';
import { Stat } from './practice-page';
import { EntryList } from './entry-list';
import { Health } from './today';
import { PracticeChart } from './practice-chart';
import type { Actions } from './journal-app';
const practiceNames: Partial<Record<Collection, string>> = {
  wake: 'Morning discipline',
  japa: 'Japa',
  hearing: 'Hearing',
  reading: 'Reading',
  krishna: 'Krishna Book',
  seva: 'Seva',
  association: 'Association',
  reflection: 'Night reflections',
  sankalpa: 'Sankalpa',
  quality: 'Qualities',
  prabhupada: 'Prabhupāda reflections',
};
export function ReviewPage({
  kind,
  state,
  date,
  actions,
}: {
  kind: 'history' | 'weekly' | 'monthly';
  state: AppState;
  date: string;
  actions: Actions;
}) {
  const [practice, setPractice] = useState<Collection | 'all'>('all'),
    [query, setQuery] = useState('');
  const bounds = kind === 'weekly' ? weekBounds(date) : monthBounds(date);
  const end = bounds[1] > state.today ? state.today : bounds[1];
  const days = end < bounds[0] ? [] : daysBetween(bounds[0], end);
  const records = period(state.records, bounds[0], end),
    v = totals(records, state.settings),
    selected = onDate(state.records, date);
  const title =
    kind === 'weekly'
      ? 'Your week, with intention.'
      : kind === 'monthly'
        ? 'A month of small beginnings.'
        : 'The pages of your journey.';
  function shift(n: number) {
    if (kind === 'weekly') actions.setDate(addDays(date, 7 * n));
    else {
      const d = new Date(date.slice(0, 7) + '-01T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + n);
      actions.setDate(d.toISOString().slice(0, 10));
    }
  }
  const columns = Object.entries(practiceNames).filter(
    ([key]) => practice === 'all' || practice === key,
  );
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">
          {kind === 'history' ? 'YOUR PERSONAL HISTORY' : `${kind.toUpperCase()} SĀDHANA REVIEW`}
        </span>
        <h1>{title}</h1>
        <p>
          {kind === 'history'
            ? 'Every day has a place here. Continue from where you are.'
            : 'An honest look at your practice, with room to begin again.'}
        </p>
      </div>
      <div className="period-toolbar">
        <button aria-label="Previous period" className="icon-button" onClick={() => shift(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h2>
          {kind === 'weekly'
            ? `${prettyDate(bounds[0], { day: 'numeric', month: 'short' })} – ${prettyDate(bounds[1], { day: 'numeric', month: 'short', year: 'numeric' })}`
            : prettyDate(date, { month: 'long', year: 'numeric' })}
        </h2>
        <button aria-label="Next period" className="icon-button" onClick={() => shift(1)}>
          <ChevronRight size={20} />
        </button>
      </div>
      {kind === 'history' ? (
        <>
          <div className="calendar panel">
            <div className="calendar-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span className="calendar-weekday" key={d}>
                  {d}
                </span>
              ))}
              {Array.from(
                { length: (new Date(bounds[0] + 'T12:00:00Z').getUTCDay() + 6) % 7 },
                (_, i) => (
                  <span key={'blank' + i} />
                ),
              )}
              {daysBetween(...bounds).map((d) => {
                const r = onDate(state.records, d),
                  h = health(r, state.settings, dayMode(r)),
                  has = Object.entries(r).some(
                    ([k, e]) => !['purpose', 'goals', 'reminders'].includes(k) && e.length,
                  );
                const status = !has
                  ? 'No entry'
                  : h >= 75
                    ? 'Strong consistency'
                    : h >= 35
                      ? 'Partial'
                      : 'Minimal';
                return (
                  <button
                    key={d}
                    aria-label={`${prettyDate(d)}: ${status}`}
                    aria-pressed={d === date}
                    className={`calendar-day ${d === date ? 'selected' : ''}`}
                    onClick={() => actions.setDate(d)}
                  >
                    <strong>{Number(d.slice(8))}</strong>
                    <small>{has ? status : '—'}</small>
                    <i
                      className={
                        has ? (h >= 75 ? 'strong' : h >= 35 ? 'partial' : 'minimal') : 'none'
                      }
                    />
                  </button>
                );
              })}
            </div>
            <p className="fine-print">Strong consistency · Partial · Minimal · — No entry</p>
          </div>
          <div className="section-heading">
            <h2>{prettyDate(date)}</h2>
            <select
              aria-label="Filter history by practice"
              value={practice}
              onChange={(e) => setPractice(e.target.value as Collection | 'all')}
            >
              <option value="all">All practices</option>
              {Object.entries(practiceNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <input
            className="history-search"
            aria-label="Search history entries"
            placeholder="Filter by book, speaker, service or quality…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Health value={health(selected, state.settings, dayMode(selected))} />
          {columns.map(([key, label]) => (
            <section className="history-section" key={key}>
              <div className="section-heading">
                <h3>{label}</h3>
                <button className="text-button" onClick={() => actions.open(key as Collection)}>
                  + Add entry
                </button>
              </div>
              <EntryList
                collection={key as Collection}
                entries={selected[key as Collection].filter((e) =>
                  Object.values(e).join(' ').toLowerCase().includes(query.toLowerCase()),
                )}
                actions={actions}
                empty="No entry for this day. Continue from here."
              />
            </section>
          ))}
        </>
      ) : (
        <>
          <p className="muted small-text">
            Based on {days.length} elapsed {days.length === 1 ? 'day' : 'days'} in this period.
            Future days are excluded.
          </p>
          <div className="stat-grid review-stats">
            <Stat
              label="Japa rounds"
              value={`${v.rounds} / ${days.reduce((n, d) => n + state.settings[dayMode(onDate(state.records, d))].japa, 0)}`}
            />
            <Stat
              label="Average attention"
              value={v.attention ? `${v.attention.toFixed(1)} / 5` : 'Not recorded'}
            />
            <Stat label="Early rising" value={`${v.earlyDays} / ${days.length} days`} />
            <Stat label="Prabhupāda hearing" value={formatMinutes(v.hearing)} />
            <Stat
              label="Daytime reading"
              value={`${formatMinutes(v.reading)} · ${v.readingPages} pages`}
            />
            <Stat label="Krishna Book" value={`${v.krishnaNights} / ${days.length} nights`} />
            <Stat
              label="Krishna Book reading"
              value={`${formatMinutes(v.krishna)} · ${v.krishnaPages} pages`}
            />
            <Stat label="Seva" value={`${v.seva} entries`} />
            <Stat label="Night reflections" value={`${v.reflections} / ${days.length}`} />
            <Stat label="Association" value={formatMinutes(v.association)} />
            <Stat
              label="Average wake time"
              value={v.averageWake == null ? 'Not recorded' : formatClockMinutes(v.averageWake)}
            />
            <Stat
              label="Daily standard met"
              value={`${
                days.filter((d) => {
                  const r = onDate(state.records, d);
                  return dayComplete(r, state.settings, dayMode(r));
                }).length
              } days`}
            />
          </div>
          <div className="gentle-note">
            <p>
              {v.krishnaNights
                ? `You read Krishna Book on ${consistency(records, bounds[0], end)}% of elapsed evenings this ${kind === 'weekly' ? 'week' : 'month'}.`
                : 'A few quiet pages are enough to begin.'}
            </p>
            {v.currentChapter && (
              <p>
                Current chapter in this period: {v.currentChapter} · {v.chapters} chapter
                completions recorded.
              </p>
            )}
          </div>
          <PracticeChart records={records} settings={state.settings} days={days} />
          <section className="panel review-writing">
            <h2>A moment to reflect</h2>
            <p>What will you carry into the next {kind === 'weekly' ? 'week' : 'month'}?</p>
            <button
              className="button primary"
              onClick={() =>
                actions.open(
                  kind,
                  state.records[kind].find((e) => e.date === bounds[0]) ?? { date: bounds[0] },
                )
              }
            >
              <PenLine size={17} />{' '}
              {state.records[kind].some((e) => e.date === bounds[0])
                ? 'Edit reflection'
                : 'Write my reflection'}
            </button>
            <EntryList
              collection={kind}
              entries={state.records[kind].filter((e) => e.date === bounds[0])}
              actions={actions}
              empty="Your reflection can be just a few lines."
            />
          </section>
        </>
      )}
    </>
  );
}
