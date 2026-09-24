'use client';
import { useEffect, useRef, useState } from 'react';
import { Flower2, Plus, Pause, Play } from 'lucide-react';
import { localDate, localTime } from '@/lib/domain/dates';
export function FocusMode({
  kind,
  timezone,
  completed,
  target,
  chapter,
  onFinish,
  onExit,
}: {
  kind: 'japa' | 'krishna';
  timezone: string;
  completed: number;
  target: number;
  chapter?: number;
  onFinish: (data: Record<string, unknown>) => void;
  onExit: () => void;
}) {
  const [rounds, setRounds] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [paused, setPaused] = useState(false);
  const started = useRef(new Date()),
    anchor = useRef(Date.now()),
    accumulated = useRef(0);
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (!paused) setElapsed(accumulated.current + Date.now() - anchor.current);
    }, 500);
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', before);
    return () => {
      clearInterval(tick);
      window.removeEventListener('beforeunload', before);
    };
  }, [paused]);
  function toggle() {
    if (!paused) accumulated.current += Date.now() - anchor.current;
    else anchor.current = Date.now();
    setPaused(!paused);
  }
  function finish() {
    const ms = paused ? accumulated.current : accumulated.current + Date.now() - anchor.current;
    onFinish({
      date: localDate(timezone, started.current),
      startTime: localTime(timezone, started.current),
      endTime: localTime(timezone),
      durationMinutes: Math.round(ms / 600) / 100,
      ...(kind === 'japa' ? { rounds } : { chapterNumber: chapter }),
    });
  }
  const seconds = Math.floor(elapsed / 1000),
    clock = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  return (
    <main className="focus-mode">
      <Flower2 size={40} />
      <span className="eyebrow">
        {kind === 'japa' ? 'HEAR THE HOLY NAME' : 'END THE DAY REMEMBERING KRISHNA'}
      </span>
      <h1>{kind === 'japa' ? 'Japa' : 'Krishna Book'}</h1>
      <p>
        {kind === 'japa'
          ? 'Put distractions aside and hear the Holy Name.'
          : chapter
            ? `Chapter ${chapter}`
            : 'A few quiet pages, with Krishna.'}
      </p>
      {kind === 'japa' && (
        <div className="focus-rounds">
          <strong>{rounds}</strong>
          <span>
            rounds in this session · {completed + rounds} / {target} today
          </span>
        </div>
      )}
      <time className="focus-clock">{clock}</time>
      <div className="focus-actions">
        {kind === 'japa' && (
          <button className="button primary" onClick={() => setRounds((n) => n + 1)}>
            <Plus size={19} /> Round
          </button>
        )}
        <button className="button secondary" onClick={toggle}>
          {paused ? <Play size={17} /> : <Pause size={17} />} {paused ? 'Resume' : 'Pause'}
        </button>
        <button className="button primary" onClick={finish}>
          {kind === 'japa' ? 'Finish session' : 'Finish reading'}
        </button>
      </div>
      <small>Finish to review and save your session.</small>
      <button
        className="text-button"
        onClick={() => {
          if (
            (rounds === 0 && elapsed < 3000) ||
            window.confirm('Leave without saving this session?')
          )
            onExit();
        }}
      >
        End session without saving
      </button>
    </main>
  );
}
