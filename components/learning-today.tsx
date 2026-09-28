'use client';
import Link from 'next/link';
import { useCompanion } from './companion-provider';
import { learningCourses } from '@/lib/domain/learning-catalog';
import type { CourseProgress } from '@/lib/domain/companion';
export function LearningToday({ today }: { today: string }) {
  const { values, ready } = useCompanion();
  const rows = learningCourses.map((course) => ({
    course,
    seconds:
      (values['course:' + course.id] as CourseProgress | undefined)?.watchedByDay[today] ?? 0,
  }));
  if (!ready) return null;
  return (
    <section className="learning-today">
      <span className="eyebrow">TODAY’S HEARING & LEARNING</span>
      <h2>Your time with the teachings.</h2>
      <ul>
        {rows.map(({ course, seconds }) => (
          <li key={course.id}>
            <Link href={'/learn?course=' + course.id}>
              {course.title} ↗<br />
              <small>{course.speaker}</small>
            </Link>
            <span>
              {seconds > 0
                ? `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} sec`
                : 'Ready to begin'}
            </span>
          </li>
        ))}
      </ul>
      <p className="fine-print">
        Time watched inside the app, shown separately from manually entered hearing sessions.
      </p>
    </section>
  );
}
