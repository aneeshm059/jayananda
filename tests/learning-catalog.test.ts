import { describe, expect, it } from 'vitest';
import { englishPrabhupadaSelections, learningCourses } from '../lib/domain/learning-catalog';
import { parseCompanionValue, type CourseProgress } from '../lib/domain/companion';

describe('English-only learning selections', () => {
  it('keeps the saved Prabhupada catalog aligned with the refresh allowlist', () => {
    const course = learningCourses.find((item) => item.id === 'prabhupada')!;
    expect(englishPrabhupadaSelections).toEqual([
      { id: 'V6hmXsFUy2w', title: 'Knowledge | Srila Prabhupada English Lecture' },
    ]);
    expect(course.lessons.map(({ id, title }) => ({ id, title }))).toEqual(
      englishPrabhupadaSelections,
    );
    expect(course.subtitle).toContain('English');
    for (const item of learningCourses) {
      expect(item.subtitle).not.toMatch(/\bHindi\b/i);
      for (const lesson of item.lessons)
        expect(lesson.title).not.toMatch(/\bHindi\b|हिन्दी|हिंदी/i);
    }
  });

  it('retains historical progress for recordings removed from discovery', () => {
    const progress: CourseProgress = {
      currentVideoId: 'DDr21Vyi4CQ',
      lessons: {
        DDr21Vyi4CQ: { position: 180, duration: 900, completed: false },
        Sefv3i0NVLc: { position: 420, duration: 420, completed: true },
      },
      watchedByDay: { '2026-09-28': 600 },
      reminderTime: '18:30',
      lastPracticedDate: '2026-09-28',
    };
    expect(parseCompanionValue('course:prabhupada', progress)).toEqual(progress);
  });
});
