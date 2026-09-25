'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  PenLine,
  Archive,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Sprout,
} from 'lucide-react';
import { type AppState } from '@/lib/domain/model';
import {
  type Habit,
  type HabitReport,
  habitSchema,
  habitStatus,
  oneYearEnd,
  elapsedHabitDays,
  habitMonthSummary,
} from '@/lib/domain/habits';
import { daysBetween, prettyDate, monthBounds } from '@/lib/domain/dates';
import { request } from '@/lib/client';
import { HabitCheckin } from './habit-checkin';
import type { Actions } from './journal-app';

function HabitEditor({
  habit,
  today,
  actions,
  onClose,
  onCreated,
}: {
  habit?: Habit;
  today: string;
  actions: Actions;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(habit?.startDate ?? today),
    [end, setEnd] = useState(habit?.endDate ?? oneYearEnd(today));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="entry-dialog habit-editor"
      aria-labelledby="habit-editor-title"
      onCancel={onClose}
    >
      <button className="icon-button close-dialog" aria-label="Close habit form" onClick={onClose}>
        <X size={20} />
      </button>
      <p className="eyebrow">A PERSONAL COMMITMENT</p>
      <h2 id="habit-editor-title">{habit ? 'Edit habit' : 'Create a habit'}</h2>
      <p className="muted">Keep it clear, meaningful and yours.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const result = habitSchema.safeParse({
            name: fd.get('name'),
            intention: fd.get('intention'),
            startDate: start,
            endDate: end,
          });
          if (!result.success) {
            setError(result.error.issues[0].message);
            return;
          }
          setBusy(true);
          setError('');
          try {
            const saved = await actions.saveHabit(result.data, habit?.id);
            onCreated(saved.id);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Habit name
          <input
            name="name"
            defaultValue={habit?.name}
            placeholder="A commitment I want to keep"
            maxLength={100}
            required
          />
        </label>
        <div className="habit-date-fields">
          <label>
            Start date
            <input
              type="date"
              aria-label="Habit start date"
              min="1900-01-01"
              max="9998-12-31"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <label>
            End date
            <input
              type="date"
              aria-label="Habit end date"
              max="9998-12-31"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </label>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (start) setEnd(oneYearEnd(start));
          }}
        >
          Set a one-year commitment
        </button>
        <label>
          What I intend to follow
          <textarea
            name="intention"
            defaultValue={habit?.intention}
            rows={4}
            maxLength={2000}
            placeholder="Describe what following this habit means to you."
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : habit ? 'Save habit' : 'Create habit'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function HabitsPage({ state, actions }: { state: AppState; actions: Actions }) {
  const id = usePathname().split('/')[2],
    router = useRouter();
  const habit = state.habits.habits.find((h) => h.id === id);
  const [editor, setEditor] = useState<Habit | 'new' | null>(null),
    [filter, setFilter] = useState('Active');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const today = state.today;
  return (
    <>
      {id ? (
        <>
          <Link className="text-button" href="/habits">
            <ArrowLeft size={17} /> All habits
          </Link>
          {!habit ? (
            <div className="panel">
              <h1>This habit isn’t available.</h1>
              <p>Return to your habits to choose another commitment.</p>
            </div>
          ) : (
            <>
              <div className="page-intro habit-intro">
                <p className="eyebrow">{habitStatus(habit, today)} COMMITMENT</p>
                <h1>{habit.name}</h1>
                <p>{habit.intention}</p>
                <div className="habit-meta">
                  <span>
                    {prettyDate(habit.startDate, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    —{' '}
                    {prettyDate(habit.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button className="text-button" onClick={() => setEditor(habit)}>
                    <PenLine size={16} /> Edit habit
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await actions.archiveHabit(habit.id, !habit.archived);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Archive size={16} />
                    {habit.archived ? 'Restore habit' : 'Archive habit'}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {habitStatus(habit, today) === 'Active' && (
                <section className="panel habit-today-panel">
                  <HabitCheckin
                    habit={habit}
                    today={today}
                    checkin={state.habits.checkins.find(
                      (e) => e.habitId === id && e.date === today,
                    )}
                    actions={actions}
                  />
                </section>
              )}
              <HabitHistory
                key={habit.id}
                habit={habit}
                today={today}
                revision={
                  state.habits.checkins.find((e) => e.habitId === id && e.date === today)
                    ?.updatedAt ?? ''
                }
              />
            </>
          )}
        </>
      ) : (
        <>
          <div className="page-intro habit-intro">
            <p className="eyebrow">A LITTLE SINCERITY, EVERY DAY</p>
            <h1>
              Small choices.
              <br />A life of intention.
            </h1>
            <p>Your commitments, one day at a time. Today’s date is recorded automatically.</p>
          </div>
          <div className="section-heading">
            <h2>My habits</h2>
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={17} /> New habit
            </button>
          </div>
          <div className="habit-filters" aria-label="Filter habits">
            {['Active', 'Upcoming', 'Finished', 'Archived'].map((label) => (
              <button
                key={label}
                className={'button ' + (filter === label ? 'primary' : 'secondary')}
                aria-pressed={filter === label}
                onClick={() => setFilter(label)}
              >
                {label}
                <span>
                  {state.habits.habits.filter((h) => habitStatus(h, today) === label).length}
                </span>
              </button>
            ))}
          </div>
          <div className="habit-library">
            {state.habits.habits
              .filter((h) => habitStatus(h, today) === filter)
              .map((h) => {
                const elapsed = elapsedHabitDays(h, today);
                return (
                  <article className="panel habit-library-card" key={h.id}>
                    <div className="habit-library-heading">
                      <span className="habit-mark">
                        <Sprout size={23} />
                      </span>
                      <Link href={'/habits/' + h.id}>
                        <h2>{h.name}</h2>
                        <ChevronRight size={21} />
                      </Link>
                    </div>
                    <p>{h.intention}</p>
                    {filter === 'Active' && (
                      <HabitCheckin
                        habit={h}
                        today={today}
                        checkin={state.habits.checkins.find(
                          (e) => e.habitId === h.id && e.date === today,
                        )}
                        actions={actions}
                      />
                    )}
                    <div className="habit-library-foot">
                      <span>
                        {elapsed
                          ? `${h.followedDays} of ${elapsed} past days followed`
                          : 'A new beginning'}
                      </span>
                      <Link className="text-button" href={'/habits/' + h.id}>
                        View journey <ChevronRight size={16} />
                      </Link>
                    </div>
                  </article>
                );
              })}
          </div>
          {!state.habits.habits.some((h) => habitStatus(h, today) === filter) && (
            <div className="panel habit-empty">
              <Sprout size={32} />
              <h3>
                {filter === 'Active'
                  ? 'Make space for one small commitment.'
                  : `No ${filter.toLowerCase()} habits.`}
              </h3>
              <p>
                {filter === 'Archived'
                  ? 'Habits you archive stay here with their history.'
                  : 'Your habits will appear here when their dates match this view.'}
              </p>
              <button className="button secondary" onClick={() => setEditor('new')}>
                Create a habit
              </button>
            </div>
          )}
        </>
      )}
      {editor && (
        <HabitEditor
          habit={editor === 'new' ? undefined : editor}
          today={today}
          actions={actions}
          onClose={() => setEditor(null)}
          onCreated={(saved) => {
            if (editor === 'new') router.push('/habits/' + saved);
          }}
        />
      )}
    </>
  );
}

function HabitHistory({
  habit,
  today,
  revision,
}: {
  habit: Habit;
  today: string;
  revision: string;
}) {
  const initialYear = Math.max(
    Number(habit.startDate.slice(0, 4)),
    Math.min(Number(today.slice(0, 4)), Number(habit.endDate.slice(0, 4))),
  );
  const [year, setYear] = useState(initialYear),
    [report, setReport] = useState<HabitReport | null>(null),
    [selected, setSelected] = useState(today),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError('');
    request<HabitReport>(`/api/habits/${habit.id}?year=${year}`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [habit.id, habit.updatedAt, year, today, revision, retry]);
  const elapsed = elapsedHabitDays(habit, today),
    percent = elapsed ? Math.round((habit.followedDays / elapsed) * 100) : null;
  const current = report?.checkins.find((e) => e.date === selected);
  return (
    <section className="habit-history" aria-labelledby="habit-history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR JOURNEY</p>
          <h2 id="habit-history-title">One day at a time</h2>
        </div>
        <a className="text-button" href="/api/export?collection=habits">
          Export habits
        </a>
      </div>
      <div className="habit-report-stats">
        <div>
          <strong>{habit.followedDays}</strong>
          <span>Past days followed</span>
        </div>
        <div>
          <strong>{elapsed}</strong>
          <span>Past days in your commitment</span>
        </div>
        <div>
          <strong>{percent == null ? '—' : percent + '%'}</strong>
          <span>Recorded consistency</span>
        </div>
      </div>
      <p className="habit-report-note">
        Totals cover completed past days within your habit’s dates. Today is shown separately. An
        unmarked day remains “Not marked.”
      </p>
      <div className="period-toolbar">
        <button
          className="icon-button"
          aria-label="Previous habit year"
          disabled={year <= Number(habit.startDate.slice(0, 4))}
          onClick={() => {
            setSelected('');
            setYear(year - 1);
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h3>{year}</h3>
        <button
          className="icon-button"
          aria-label="Next habit year"
          disabled={year >= Number(habit.endDate.slice(0, 4))}
          onClick={() => {
            setSelected('');
            setYear(year + 1);
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="habit-legend">
        <span>
          <i className="followed" /> Followed
        </span>
        <span>
          <i /> Not marked
        </span>
        <span>
          <i className="today" /> Today
        </span>
        <span>
          <i className="outside" /> Not due
        </span>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}{' '}
          <button className="text-button" onClick={() => setRetry(retry + 1)}>
            Retry
          </button>
        </p>
      ) : !report ? (
        <p role="status">Opening your habit history…</p>
      ) : (
        <>
          <div className="habit-year-grid">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const first = `${year}-${String(month).padStart(2, '0')}-01`,
                [from, to] = monthBounds(first);
              if (to < habit.startDate || from > habit.endDate) return null;
              const stats = habitMonthSummary(habit, report.checkins, from, to, today);
              const padding = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
              return (
                <section
                  className="habit-month"
                  key={month}
                  aria-label={prettyDate(first, { month: 'long', year: 'numeric' })}
                >
                  <h3>{prettyDate(first, { month: 'long' })}</h3>
                  <p>
                    {stats.days
                      ? `${stats.followed} / ${stats.days} days · ${stats.percent}%`
                      : today >= from && today <= to && today >= habit.startDate
                        ? 'Your commitment begins today'
                        : 'A chapter still to come'}
                  </p>
                  <div className="habit-calendar">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <span className="habit-weekday" key={'label' + i} aria-hidden="true">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: padding }, (_, i) => (
                      <span key={'pad' + i} />
                    ))}
                    {daysBetween(from, to).map((day) => {
                      const entry = report.checkins.find((e) => e.date === day),
                        eligible = day >= habit.startDate && day <= habit.endDate,
                        future = day > today;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!eligible || future}
                          aria-pressed={selected === day}
                          aria-label={`${prettyDate(day, { day: 'numeric', month: 'long', year: 'numeric' })}: ${!eligible || future ? 'Not due' : entry?.completed ? 'Followed' : 'Not marked'}${entry?.notes ? ', has notes' : ''}`}
                          className={
                            'habit-calendar-day ' +
                            (entry?.completed ? 'followed ' : '') +
                            (day === today ? 'today ' : '') +
                            (!eligible || future ? 'outside ' : '') +
                            (selected === day ? 'selected' : '')
                          }
                          onClick={() => setSelected(day)}
                        >
                          {Number(day.slice(8))}
                          {entry?.notes && <i />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          {selected &&
            selected >= habit.startDate &&
            selected <= habit.endDate &&
            selected.slice(0, 4) === String(year) && (
              <section className="panel habit-day-detail" aria-live="polite">
                <p className="eyebrow">DAILY RECORD</p>
                <h3>{prettyDate(selected, { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                <p className={current?.completed ? 'habit-followed-text' : 'muted'}>
                  {current?.completed && <Check size={17} />}{' '}
                  {current?.completed ? 'Followed' : 'Not marked'}
                </p>
                <h4>Extra notes</h4>
                <p className="habit-history-notes">{current?.notes || 'No notes for this day.'}</p>
                <small>
                  History is for viewing. Daily check-ins automatically use today’s date.
                </small>
              </section>
            )}
        </>
      )}
    </section>
  );
}
