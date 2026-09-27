import type { AppState, Collection, Entry } from './model';
import { dayMode, onDate, totals } from './calculations';
import { habitStatus } from './habits';
import { forms } from './forms';

export type ReportItem = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  required: boolean;
  collection: Collection;
};

export function todayReport(state: AppState) {
  const records = onDate(state.records, state.today);
  const values = totals(records, state.settings);
  const mode = dayMode(records);
  const target = state.settings[mode];
  const wake = records.wake[0];
  const items: ReportItem[] = [
    {
      key: 'wake',
      label: 'Wake-up time',
      collection: 'wake',
      required: target.wake,
      done: !!wake?.actualTime,
      detail: wake?.actualTime
        ? `${wake.actualTime} · target ${state.settings.wakeTarget}`
        : 'Wake-up time not recorded',
    },
    {
      key: 'morning',
      label: 'Morning program',
      collection: 'wake',
      required: target.morning,
      done: !!wake?.programCompleted,
      detail: wake?.programCompleted ? 'Marked complete' : 'Not marked complete',
    },
    ...(['japa', 'hearing', 'reading', 'krishna'] as const).map((key) => {
      const amount = key === 'japa' ? values.rounds : values[key];
      const goal = target[key];
      const unit = key === 'japa' ? 'rounds' : 'min';
      return {
        key,
        label: {
          japa: 'Japa',
          hearing: 'Hearing',
          reading: 'Daytime reading',
          krishna: 'Krishna Book',
        }[key],
        collection: key,
        required: goal > 0,
        done: goal > 0 ? amount >= goal : records[key].length > 0,
        detail:
          goal > 0
            ? `${amount} / ${goal} ${unit}${amount < goal ? ` · ${Math.round((goal - amount) * 100) / 100} ${unit} remaining` : ' · target met'}`
            : `${amount} ${unit} recorded`,
      };
    }),
    {
      key: 'seva',
      label: 'Seva',
      collection: 'seva',
      required: target.seva,
      done: records.seva.length > 0,
      detail: records.seva.length
        ? `${records.seva.length} service ${records.seva.length === 1 ? 'entry' : 'entries'} recorded`
        : 'No service recorded',
    },
    {
      key: 'reflection',
      label: 'Night reflection',
      collection: 'reflection',
      required: target.reflection,
      done: records.reflection.length > 0,
      detail: records.reflection.length ? 'Reflection recorded' : 'Reflection not recorded',
    },
  ];
  const habits = state.habits.habits
    .map((habit) => ({
      habit,
      active: habitStatus(habit, state.today) === 'Active',
      checkin: state.habits.checkins.find((e) => e.habitId === habit.id && e.date === state.today),
    }))
    .filter((row) => row.active || row.checkin);
  const required = items.filter((item) => item.required);
  const activeHabits = habits.filter((row) => row.active);
  const pending = required.filter((item) => !item.done);
  const pendingHabits = activeHabits.filter((row) => !row.checkin?.completed);
  const remaining = pending.length + pendingHabits.length;
  const total = required.length + activeHabits.length;
  return {
    records,
    values,
    target,
    mode,
    items,
    habits,
    pending,
    pendingHabits,
    remaining,
    total,
    completed: total - remaining,
  };
}

export function recordedFields(collection: Collection, entry: Entry) {
  const fields =
    collection === 'wake'
      ? [...forms.wake.fields, { key: 'practices', label: 'My morning practices' }]
      : forms[collection].fields;
  return fields
    .filter((field) => {
      const value = entry[field.key];
      return value !== null && value !== undefined && value !== '';
    })
    .map((field) => ({
      label: field.label,
      value:
        typeof entry[field.key] === 'boolean'
          ? entry[field.key]
            ? 'Yes'
            : 'No'
          : field.key === 'practices'
            ? String(entry[field.key]).split('|').join(' · ')
            : String(entry[field.key]),
    }));
}
