'use client';
import { useState } from 'react';
import type { Records, Settings } from '@/lib/domain/model';
import { totals, onDate, health, dayMode, average } from '@/lib/domain/calculations';
import { timeMinutes } from '@/lib/domain/dates';
const metrics = {
  rounds: 'Japa rounds',
  attention: 'Japa attention',
  japaTime: 'Japa start time',
  wake: 'Wake-up time',
  hearing: 'Hearing minutes',
  reading: 'Reading minutes',
  krishna: 'Krishna Book minutes',
  nights: 'Krishna Book nights',
  seva: 'Seva entries',
  reflection: 'Night reflection',
  health: 'Sādhana Health',
};
type Metric = keyof typeof metrics;
export function PracticeChart({
  records,
  settings,
  days,
}: {
  records: Records;
  settings: Settings;
  days: string[];
}) {
  const [metric, setMetric] = useState<Metric>('rounds');
  const data = days.map((date) => {
    const r = onDate(records, date),
      v = totals(r, settings);
    let value: number | null = 0;
    switch (metric) {
      case 'rounds':
        value = v.rounds;
        break;
      case 'attention':
        value = v.attention;
        break;
      case 'japaTime': {
        const values = r.japa
          .filter((e) => e.startTime)
          .map((e) => timeMinutes(String(e.startTime)));
        value = values.length ? Math.min(...values) : null;
        break;
      }
      case 'wake':
        value = v.averageWake;
        break;
      case 'hearing':
        value = v.hearing;
        break;
      case 'reading':
        value = v.reading;
        break;
      case 'krishna':
        value = v.krishna;
        break;
      case 'nights':
        value = v.krishnaNights;
        break;
      case 'seva':
        value = v.seva;
        break;
      case 'reflection':
        value = v.reflections;
        break;
      case 'health':
        value = health(r, settings, dayMode(r));
    }
    const label =
      value == null
        ? 'Not recorded'
        : ['wake', 'japaTime'].includes(metric)
          ? `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`
          : metric === 'attention'
            ? value.toFixed(1)
            : String(Math.round(value));
    return { date, value, label };
  });
  const maximum = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <section className="panel">
      <div className="section-heading chart-heading">
        <div>
          <span className="eyebrow">YOUR RHYTHM</span>
          <h3>{metrics[metric]}</h3>
        </div>
        <select
          aria-label="Chart practice"
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
        >
          {Object.entries(metrics).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div
        className="bar-chart"
        role="img"
        aria-label={`${metrics[metric]}: ${data.map((d) => `${d.date}: ${d.label}`).join('; ')}`}
      >
        {data.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.label}`}>
            <span>{d.label === 'Not recorded' ? '—' : d.label}</span>
            <i
              style={{
                height: `${Math.max(2, ((d.value ?? 0) / maximum) * 110)}px`,
                opacity: d.value == null ? 0.18 : 0.75,
              }}
            />
            <small>{d.date.slice(8)}</small>
          </div>
        ))}
      </div>
      {metric === 'health' && (
        <p className="fine-print">
          This reflects consistency of practice, not spiritual advancement.
        </p>
      )}
      <details className="chart-data">
        <summary>Read chart values</summary>
        <div className="chart-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>{metrics[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
