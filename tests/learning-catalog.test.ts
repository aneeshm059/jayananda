import { describe, expect, it } from 'vitest';
import { learningCourses } from '../lib/domain/learning-catalog';
import { bundledAcharyaLectures } from '../lib/domain/acharya-catalog';
import { parseCompanionValue, type CourseProgress } from '../lib/domain/companion';

describe('English-only learning selections', () => {
  it('ships the verified English 30–45 minute library and preserves lesson order', () => {
    const course = learningCourses.find((item) => item.id === 'prabhupada')!;
    expect(course.lessons.length).toBeGreaterThan(1);
    expect(course.lessons).toEqual(
      bundledAcharyaLectures.map((lesson, index) => ({ ...lesson, position: index + 1 })),
    );
    expect(
      course.lessons.every(
        (lesson) => lesson.durationSeconds! >= 1800 && lesson.durationSeconds! <= 2700,
      ),
    ).toBe(true);
    expect(course.lessons.some((lesson) => lesson.id === 'V6hmXsFUy2w')).toBe(false);
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
