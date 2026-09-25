'use client';
import { useEffect, useRef, useState, useId } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, PenLine } from 'lucide-react';
import {
  type Habit,
  type HabitCheckin as Checkin,
  habitStatus,
  recentHabitDays,
} from '@/lib/domain/habits';
import { prettyDate } from '@/lib/domain/dates';
import type { AppState } from '@/lib/domain/model';
import type { Actions } from './journal-app';

export function HabitCheckin({
  habit,
  checkin,
  today,
  actions,
  compact = false,
}: {
  habit: Habit;
  checkin?: Checkin;
  today: string;
  actions: Actions;
  compact?: boolean;
}) {
  const [notes, setNotes] = useState(checkin?.notes ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const dirty = useRef(false),
    previousDay = useRef(today),
    labelId = useId();
  useEffect(() => {
    if (previousDay.current !== today) {
      if (dirty.current)
        setError(
          'A new day has begun. Your draft notes are still here; review them before saving for today.',
        );
      previousDay.current = today;
      setSaved('');
    }
    if (!dirty.current) setNotes(checkin?.notes ?? '');
  }, [today, checkin?.notes]);
  useEffect(() => {
    const preventLoss = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, []);
  const active = habitStatus(habit, today) === 'Active';
  async function save(data: { completed?: boolean; notes?: string }) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await actions.checkHabit(habit.id, data, today);
      if (data.notes !== undefined) dirty.current = false;
      setSaved('Saved for today.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={'habit-checkin ' + (checkin?.completed ? 'is-followed' : '')}>
      <div className="habit-checkin-top">
        <div className="habit-checkin-name">
          {compact ? (
            <Link href={'/habits/' + habit.id}>
              <strong>{habit.name}</strong>
              <ChevronRight size={16} />
            </Link>
          ) : (
            <h2>Today’s check-in</h2>
          )}
          <span id={labelId}>
            {checkin?.completed
              ? 'Followed today'
              : active
                ? 'Not marked today'
                : habitStatus(habit, today)}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!checkin?.completed}
          aria-label={`${habit.name}: followed today`}
          aria-describedby={labelId}
          className="habit-toggle"
          disabled={busy || !active}
          onClick={() => void save({ completed: !checkin?.completed })}
        >
          <span>{checkin?.completed && <Check size={16} />}</span>
        </button>
      </div>
      {!compact && (
        <p className="habit-date-note">{prettyDate(today)} · Date captured automatically.</p>
      )}
      <details className="habit-notes" open={compact ? undefined : true}>
        <summary>
          <PenLine size={15} /> Extra notes <span>Optional</span>
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ notes });
          }}
        >
          <label>
            Extra notes
            <textarea
              aria-label={`Extra notes for ${habit.name}`}
              rows={3}
              maxLength={10000}
              value={notes}
              disabled={busy || !active}
              placeholder="Anything you would like to remember…"
              onChange={(e) => {
                setNotes(e.target.value);
                dirty.current = true;
                setSaved('');
              }}
            />
          </label>
          <button className="button secondary" disabled={busy || !active}>
            {busy ? 'Saving…' : 'Save notes'}
          </button>
        </form>
      </details>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <span className="habit-save-status" role="status">
        {busy ? 'Saving…' : saved}
      </span>
    </div>
  );
}

export function HabitDashboard({ state, actions }: { state: AppState; actions: Actions }) {
  const { habits, checkins } = state.habits,
    today = state.today;
  const active = habits.filter((h) => habitStatus(h, today) === 'Active');
  const done = active.filter((h) =>
    checkins.some((e) => e.habitId === h.id && e.date === today && e.completed),
  ).length;
  const week = recentHabitDays(today);
  return (
    <section className="habit-dashboard" aria-labelledby="habit-dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SMALL CHOICES, EVERY DAY</p>
          <h2 id="habit-dashboard-title">
            Today’s habits{' '}
            <span className="habit-count">
              {done} / {active.length}
            </span>
          </h2>
        </div>
        <Link href="/habits" className="text-button">
          Habit tracker <ChevronRight size={17} />
        </Link>
      </div>
      <p className="habit-section-description">
        {active.length
          ? `${done} of ${active.length} marked today. One honest check-in at a time.`
          : 'Choose a commitment that supports the person you want to become.'}
      </p>
      <div className="habit-quick-grid">
        {active.slice(0, 6).map((habit) => (
          <article className="habit-quick-card" key={habit.id}>
            <HabitCheckin
              habit={habit}
              checkin={checkins.find((e) => e.habitId === habit.id && e.date === today)}
              today={today}
              actions={actions}
              compact
            />
            <div className="habit-week" aria-label={`${habit.name}, last seven days`}>
              {week.map((day) => {
                const followed = checkins.some(
                    (e) => e.habitId === habit.id && e.date === day && e.completed,
                  ),
                  eligible = day >= habit.startDate && day <= habit.endDate;
                return (
                  <span
                    key={day}
                    className={
                      (followed ? 'followed ' : '') +
                      (day === today ? 'today ' : '') +
                      (!eligible ? 'outside' : '')
                    }
                    title={`${prettyDate(day)}: ${followed ? 'Followed' : eligible ? 'Not marked' : 'Outside habit dates'}`}
                  >
                    <small>{prettyDate(day, { weekday: 'narrow' })}</small>
                    <i>{followed ? <Check size={12} /> : '·'}</i>
                  </span>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      {!active.length && (
        <Link href="/habits" className="button primary">
          Choose my habits <ChevronRight size={16} />
        </Link>
      )}
      {active.length > 6 && (
        <Link href="/habits" className="text-button">
          View all {active.length} active habits →
        </Link>
      )}
    </section>
  );
}
