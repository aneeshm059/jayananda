import type { Collection } from './model';
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'time' | 'select' | 'checkbox' | 'date' | 'url';
  options?: string[];
  required?: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  deep?: boolean;
};
export type FormDefinition = { title: string; subtitle: string; fields: Field[] };
const f = (
  key: string,
  label: string,
  type: Field['type'] = 'text',
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });
const duration = f('durationMinutes', 'Minutes', 'number', {
  min: 0,
  max: 1440,
  required: true,
  default: 20,
});
const reflection = (label: string) => f('reflection', label, 'textarea', { deep: true });
const times = [
  f('startTime', 'Start time', 'time', { deep: true }),
  f('endTime', 'End time', 'time', { deep: true }),
];
export const forms: Record<Collection, FormDefinition> = {
  daily: {
    title: 'Your day',
    subtitle: 'Make room for what matters.',
    fields: [
      f('mode', 'Daily standard', 'select', { options: ['ideal', 'minimum'], default: 'ideal' }),
      f('closed', 'Day offered', 'checkbox'),
    ],
  },
  wake: {
    title: 'Morning discipline',
    subtitle: 'Begin again, with a little intention.',
    fields: [
      f('actualTime', 'I woke at', 'time'),
      f('programCompleted', 'Morning program completed', 'checkbox'),
      f('phoneDiscipline', 'Did I avoid unnecessary phone use before morning sādhana?', 'select', {
        options: ['Yes', 'Partially', 'No'],
        default: 'Yes',
      }),
      f('sleepTime', 'I went to sleep at', 'time', { deep: true }),
      f('bathCompleted', 'Bath completed', 'checkbox', { deep: true }),
    ],
  },
  japa: {
    title: 'Japa session',
    subtitle: 'Hear the Holy Name, one round at a time.',
    fields: [
      f('rounds', 'Rounds', 'number', { required: true, min: 0, max: 192, default: 1 }),
      { ...duration, default: 0 },
      f('attention', 'Attention', 'select', {
        options: [
          '',
          '1 — Very distracted',
          '2 — Distracted',
          '3 — Average',
          '4 — Attentive',
          '5 — Deeply attentive',
        ],
      }),
      ...times,
      f('location', 'Location', 'text', { deep: true }),
      f('interruptions', 'Phone interruptions', 'select', {
        options: ['0', '1', '2', '3', '4', '5'],
        default: '0',
        deep: true,
      }),
      f('prayerfulMood', 'Prayerful mood (1–5)', 'number', { min: 1, max: 5, deep: true }),
      f('distractions', 'What distracted me?', 'textarea', { deep: true }),
      f('helped', 'What helped me chant better?', 'textarea', { deep: true }),
      f('improve', 'What can I improve tomorrow?', 'textarea', { deep: true }),
    ],
  },
  hearing: {
    title: 'Śrīla Prabhupāda hearing',
    subtitle: 'Take a few minutes for hearing.',
    fields: [
      f('title', 'What did you hear?', 'text', { required: true }),
      { ...duration, default: 30 },
      f('speaker', 'Speaker', 'text', { required: true, default: 'Śrīla Prabhupāda' }),
      f('type', 'Type', 'select', {
        options: [
          'Lecture',
          'Bhagavad-gītā',
          'Śrīmad-Bhāgavatam',
          'Conversation',
          'Morning Walk',
          'Festival Lecture',
          'Other',
        ],
        default: 'Lecture',
        deep: true,
      }),
      f('url', 'Source URL', 'url', { deep: true }),
      f('isPrabhupada', 'Hearing Śrīla Prabhupāda', 'checkbox', { default: true, deep: true }),
      f('instruction', 'One instruction I want to remember', 'textarea', { deep: true }),
    ],
  },
  reading: {
    title: 'Daytime reading',
    subtitle: 'A few attentive pages are enough to begin.',
    fields: [
      f('book', 'Book', 'select', {
        options: [
          'Bhagavad-gītā As It Is',
          'Śrīmad-Bhāgavatam',
          'Śrī Caitanya-caritāmṛta',
          'Nectar of Devotion',
          'Nectar of Instruction',
          'Teachings of Lord Caitanya',
          'Other',
        ],
        default: 'Bhagavad-gītā As It Is',
        required: true,
      }),
      { ...duration, default: 30 },
      f('pages', 'Pages read', 'number', { min: 0, default: 0 }),
      f('chapter', 'Chapter / canto', 'text', { deep: true }),
      f('section', 'Section', 'text', { deep: true }),
      f('verseRange', 'Verse range', 'text', { deep: true }),
      f('isPrabhupada', 'Reading Śrīla Prabhupāda’s books', 'checkbox', {
        default: true,
        deep: true,
      }),
      reflection('What did Śrīla Prabhupāda teach me today?'),
    ],
  },
  krishna: {
    title: 'Krishna Book · Night reading',
    subtitle: 'End the day remembering Krishna.',
    fields: [
      duration,
      f('chapterNumber', 'Chapter number', 'number', { min: 0 }),
      f('chapterTitle', 'Chapter title'),
      f('chapterCompleted', 'Chapter completed', 'checkbox'),
      ...times,
      f('startPage', 'Start page', 'number', { min: 0, deep: true }),
      f('endPage', 'End page', 'number', { min: 0, deep: true }),
      f('pagesRead', 'Pages read (if page range is not entered)', 'number', {
        min: 0,
        default: 0,
        deep: true,
      }),
      reflection('One beautiful thing I remembered about Krishna tonight'),
    ],
  },
  seva: {
    title: 'Seva diary',
    subtitle: 'A little service, offered sincerely.',
    fields: [
      f('service', 'What service did I perform?', 'text', { required: true }),
      f('category', 'Category', 'select', {
        options: [
          'Temple',
          'ISKCON Media',
          'Devotee Service',
          'Family Service',
          'Book Distribution',
          'Festival Service',
          'Outreach',
          'Cleaning',
          'Cooking',
          'Other',
        ],
        default: 'Temple',
      }),
      f('attitude', 'Service attitude', 'select', {
        options: ['Duty', 'Willing Service', 'Enthusiastic Service', 'Grateful Service'],
        default: 'Willing Service',
      }),
      { ...duration, default: 0, required: false, deep: true },
      f('appreciation', 'Did I expect appreciation?', 'select', {
        options: ['Yes', 'Sometimes', 'No'],
        default: 'No',
        deep: true,
      }),
      reflection('How could I serve more selflessly?'),
    ],
  },
  association: {
    title: 'Devotee association',
    subtitle: 'Remember what you received in good company.',
    fields: [
      f('person', 'Person or group', 'text', { required: true }),
      duration,
      f('type', 'Type', 'select', {
        options: [
          'Sunday Satsang',
          'Temple Program',
          'Personal Association',
          'Bhāgavatam Class',
          'Kirtan',
          'Discussion',
          'Festival',
          'Other',
        ],
        default: 'Personal Association',
      }),
      f('learned', 'What I learned', 'textarea', { deep: true }),
    ],
  },
  reflection: {
    title: 'A few sincere lines',
    subtitle: 'A quiet moment to reflect and offer the day.',
    fields: [
      f('best', 'What was the best moment of my sādhana today?', 'textarea'),
      f('careless', 'Where was I careless?', 'textarea'),
      f('distraction', 'What distracted me most today?', 'textarea'),
      f('avoid', 'What should I avoid tomorrow?', 'textarea'),
      f('grateful', 'What am I grateful to Krishna for today?', 'textarea'),
      f('prayer', 'What is my prayer to Śrīla Prabhupāda tonight?', 'textarea'),
      f('remembrance', 'How often did I remember Krishna during ordinary activities?', 'select', {
        options: ['Rarely', 'Sometimes', 'Frequently', 'Very Frequently'],
        default: 'Sometimes',
      }),
    ],
  },
  sankalpa: {
    title: 'Today’s sankalpa',
    subtitle: 'One intention to carry into your day.',
    fields: [f('text', 'My intention', 'textarea', { required: true })],
  },
  weekly: {
    title: 'Weekly reflection',
    subtitle: 'Notice what helped. Begin again with intention.',
    fields: [
      f('helped', 'What helped my sādhana this week?', 'textarea'),
      f('weakened', 'What weakened my sādhana?', 'textarea'),
      f('distractions', 'What repeatedly distracted me?', 'textarea'),
      f('improvement', 'What improvement should I make next week?', 'textarea'),
      f('quality', 'What quality do I want to cultivate?'),
      f('sankalpa', 'My next-week sankalpa', 'textarea'),
    ],
  },
  monthly: {
    title: 'Monthly reflection',
    subtitle: 'Look back with honesty and gratitude.',
    fields: [
      f('realization', 'My biggest realization this month', 'textarea'),
      f('obstacle', 'My biggest obstacle', 'textarea'),
      f('strengthened', 'What strengthened my sādhana?', 'textarea'),
      f('weakened', 'What weakened my sādhana?', 'textarea'),
      f('quality', 'One quality I want to cultivate next month'),
      f('prayer', 'My prayer for next month', 'textarea'),
      f('sankalpa', 'My monthly sankalpa', 'textarea'),
    ],
  },
  quality: {
    title: 'Quality reflection',
    subtitle: 'Let a small intention become an act of service.',
    fields: [
      f('quality', 'Quality', 'text', { required: true }),
      f('reflection', 'How did I practice this quality today?', 'textarea', { required: true }),
    ],
  },
  prabhupada: {
    title: 'My connection with Śrīla Prabhupāda',
    subtitle: 'An instruction, a reflection, a prayer.',
    fields: [
      f('instruction', 'Instruction I want to remember', 'textarea'),
      f('reflection', 'My reflection', 'textarea'),
      f('prayer', 'My prayer', 'textarea'),
    ],
  },
  purpose: {
    title: 'Why am I doing this?',
    subtitle: 'Your personal purpose, in your own words.',
    fields: [f('text', 'My purpose', 'textarea', { required: true })],
  },
  goals: {
    title: 'A personal intention',
    subtitle: 'Keep your practice simple and sincere.',
    fields: [
      f('title', 'My intention', 'text', { required: true }),
      f('targetDate', 'Target date (optional)', 'date'),
      f('completed', 'Completed', 'checkbox'),
    ],
  },
  reminders: {
    title: 'Gentle reminder',
    subtitle: 'A quiet cue in your journal. Push delivery is planned for a future version.',
    fields: [
      f('message', 'Reminder', 'text', { required: true }),
      f('time', 'Time', 'time', { required: true }),
      f('enabled', 'Show this cue on Today', 'checkbox'),
    ],
  },
};
