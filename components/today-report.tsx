'use client';
import { LearningToday } from './learning-today';
import Link from 'next/link';
import { ArrowRight, Check, Circle, ClipboardList, Flower2, Sun } from 'lucide-react';
import { collections, type AppState } from '@/lib/domain/model';
import { forms } from '@/lib/domain/forms';
import { formatMinutes, prettyDate } from '@/lib/domain/dates';
import { recordedFields, todayReport, type ReportItem } from '@/lib/domain/today-report';
import type { Actions } from './journal-app';

export function TodayReport({ state, actions }: { state: AppState; actions: Actions }) {
  const report = todayReport(state);
  const { records, values, target, items, habits, remaining, completed, total } = report;
  const recorded = collections.filter((key) => key !== 'daily' && records[key].length > 0);
  const optional = items.filter((item) => !item.required && !item.done);
  function open(item: ReportItem) {
    actions.open(
      item.collection,
      ['wake', 'reflection'].includes(item.collection) ? records[item.collection][0] : undefined,
    );
  }
  function row(item: ReportItem) {
    return (
      <div className="report-row" key={item.key}>
        <span className={'report-status-icon ' + (item.done ? 'done' : '')}>
          {item.done ? <Check size={18} /> : <Circle size={18} />}
        </span>
        <div>
          <strong>{item.label}</strong>
          <p>{item.detail}</p>
        </div>
        <button
          className="text-button"
          onClick={() => open(item)}
          aria-label={`${item.done ? 'Update' : 'Record'} ${item.label}`}
        >
          {item.done ? 'Update' : 'Record'} <ArrowRight size={15} />
        </button>
      </div>
    );
  }
  return (
    <div className="today-report">
      <header className="page-intro report-intro">
        <span className="eyebrow">YOUR DAY AT A GLANCE</span>
        <h1>Today Report</h1>
        <p>
          {prettyDate(state.today)} · {report.mode === 'minimum' ? 'Minimum' : 'Ideal'} day
        </p>
        <span className="report-date-note">
          Today’s date is automatic · {state.settings.timezone.replaceAll('_', ' ')}
        </span>
      </header>
      <div className="report-summary">
        <article>
          <Flower2 size={22} />
          <span>Japa rounds</span>
          <strong>
            {values.rounds}
            <small> / {target.japa}</small>
          </strong>
          <p>{formatMinutes(values.japaMinutes)} recorded</p>
        </article>
        <article>
          <Sun size={22} />
          <span>Woke up at</span>
          <strong>{records.wake[0]?.actualTime ? String(records.wake[0].actualTime) : '—'}</strong>
          <p>
            {records.wake[0]?.actualTime
              ? `Target ${state.settings.wakeTarget}`
              : 'Not recorded yet'}
          </p>
        </article>
        <article>
          <ClipboardList size={22} />
          <span>Daily checklist</span>
          <strong>
            {completed}
            <small> / {total}</small>
          </strong>
          <p>{remaining ? `${remaining} still pending` : 'All daily items complete'}</p>
        </article>
      </div>
      <LearningToday today={state.today} />
      <section className="report-panel" aria-labelledby="report-pending">
        <div className="report-panel-heading">
          <div>
            <span className="eyebrow">YOUR NEXT SMALL STEPS</span>
            <h2 id="report-pending">
              Still pending <span>{remaining}</span>
            </h2>
          </div>
        </div>
        <p className="report-explanation">
          Based on your {report.mode} day targets and active habits. Record what you’ve done;
          continue with what remains.
        </p>
        {report.pending.map(row)}
        {report.pendingHabits.map(({ habit }) => (
          <div className="report-row" key={habit.id}>
            <span className="report-status-icon">
              <Circle size={18} />
            </span>
            <div>
              <strong>{habit.name}</strong>
              <p>Habit not marked as followed today</p>
            </div>
            <Link className="text-button" href="/habits" aria-label={`Check in for ${habit.name}`}>
              Check in <ArrowRight size={15} />
            </Link>
          </div>
        ))}
        {!remaining && (
          <p className="report-complete">
            <Check size={20} /> Everything on today’s checklist is complete. Take a moment for
            gratitude.
          </p>
        )}
      </section>
      <section className="report-panel" aria-labelledby="report-recorded">
        <div className="report-panel-heading">
          <div>
            <span className="eyebrow">THE EFFORT YOU’VE MADE</span>
            <h2 id="report-recorded">Completed & recorded</h2>
          </div>
        </div>
        {items.filter((item) => item.done).map(row)}
        {records.daily[0]?.closed && (
          <p className="report-complete">
            <Check size={18} /> Today has been offered.
          </p>
        )}
        {!recorded.length && (
          <p className="report-explanation">
            No journal entries yet today. One small practice is a good beginning.
          </p>
        )}
        <p className="report-explanation">
          Open an entry below to see every saved detail, including notes. Entries below their target
          also appear under Still pending.
        </p>
        {recorded.map((key) => (
          <details className="report-details" key={key}>
            <summary>
              {forms[key].title}
              <span>
                {records[key].length} {records[key].length === 1 ? 'entry' : 'entries'}
              </span>
            </summary>
            {records[key].map((entry, index) => (
              <article className="report-entry" key={entry.id}>
                {records[key].length > 1 && <h3>Entry {index + 1}</h3>}
                <dl>
                  {recordedFields(key, entry).map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </details>
        ))}
      </section>
      {habits.length > 0 && (
        <section className="report-panel" aria-labelledby="report-habits">
          <div className="report-panel-heading">
            <h2 id="report-habits">Today’s habits</h2>
            <Link className="text-button" href="/habits">
              Habit tracker <ArrowRight size={15} />
            </Link>
          </div>
          {habits.map(({ habit, checkin, active }) => (
            <article className="report-habit" key={habit.id}>
              <div className="report-habit-title">
                <h3>{habit.name}</h3>
                <span className={'status ' + (checkin?.completed ? 'done' : '')}>
                  {checkin?.completed ? 'Followed' : 'Not marked'}
                </span>
              </div>
              <p>{habit.intention}</p>
              {!active && (
                <p className="muted">
                  {habit.archived ? 'Archived habit' : 'Outside current commitment dates'}
                </p>
              )}
              {checkin?.notes && (
                <div className="report-habit-notes">
                  <strong>Extra notes</strong>
                  <p>{checkin.notes}</p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
      {optional.length > 0 && (
        <section className="report-panel report-optional">
          <h2>Other daily entries</h2>
          <p className="report-explanation">
            These are optional for your {report.mode} day and aren’t counted as pending.
          </p>
          {optional.map(row)}
        </section>
      )}
      <p className="closing-note">Little by little, day by day. Your sincere effort matters.</p>
    </div>
  );
}
