import type { HabitBundle } from './habits';
export const healthNote = 'This reflects consistency of practice, not spiritual advancement.';
export const defaultPurposeReminder =
  'I practice to deepen my relationship with Krishna, hear with care, and become useful in service.';
export const morningOptions = [
  'Mangala-arati',
  'Narasimha prayers',
  'Tulasi worship',
  'Guru Puja',
  'Śrīmad-Bhāgavatam class',
  'Personal prayer',
];
export const qualities = [
  'Humility',
  'Service attitude',
  'Simplicity',
  'Dependability',
  'Tolerance',
  'Enthusiasm',
  'Gratitude',
  'Respect for devotees',
  'Hard work',
  'Obedience to Śrīla Prabhupāda',
  'Care for others',
  'Selflessness',
];
export const defaultPurpose =
  'My goal is not simply to complete sixteen rounds or accumulate sādhana points. I want to sincerely strengthen my relationship with Krishna and Śrīla Prabhupāda, purify my consciousness through hearing and chanting, become useful in devotional service, cultivate genuine devotional qualities, and dedicate my life to Krishna.';
export const defaultSankalpa =
  'Let me sincerely hear, chant, remember Krishna and serve Śrīla Prabhupāda today.';
export type Mode = 'ideal' | 'minimum';
export type Targets = {
  japa: number;
  hearing: number;
  reading: number;
  krishna: number;
  morning: boolean;
  seva: boolean;
  reflection: boolean;
  wake: boolean;
};
export type Weights = {
  morning: number;
  japa: number;
  quality: number;
  hearing: number;
  reading: number;
  krishna: number;
  seva: number;
  reflection: number;
  association: number;
};
export interface Settings {
  name: string;
  purposeReminder: string;
  timezone: string;
  appName: string;
  subtitle: string;
  wakeTarget: string;
  sleepTarget: string;
  workStart: string;
  eveningStart: string;
  ideal: Targets;
  minimum: Targets;
  weights: Weights;
  morningProgram: string[];
  theme: 'light' | 'dark' | 'system';
  hero: 'auto' | 'morning' | 'minimal' | 'none';
  quality: string;
  onboarded: boolean;
}
export const defaultSettings: Settings = {
  name: 'Aneesh',
  purposeReminder: defaultPurposeReminder,
  timezone: 'Asia/Kolkata',
  appName: 'JAYANANDA',
  subtitle: 'My Sādhana Journey',
  wakeTarget: '05:00',
  sleepTarget: '22:00',
  workStart: '09:00',
  eveningStart: '18:00',
  ideal: {
    japa: 16,
    hearing: 60,
    reading: 30,
    krishna: 20,
    morning: true,
    seva: true,
    reflection: true,
    wake: true,
  },
  minimum: {
    japa: 16,
    hearing: 15,
    reading: 10,
    krishna: 10,
    morning: false,
    seva: false,
    reflection: true,
    wake: false,
  },
  weights: {
    morning: 10,
    japa: 25,
    quality: 15,
    hearing: 10,
    reading: 10,
    krishna: 10,
    seva: 10,
    reflection: 5,
    association: 5,
  },
  morningProgram: ['Personal prayer'],
  theme: 'light',
  hero: 'auto',
  quality: 'Humility',
  onboarded: false,
};
export const collections = [
  'daily',
  'wake',
  'japa',
  'hearing',
  'reading',
  'krishna',
  'seva',
  'association',
  'reflection',
  'sankalpa',
  'weekly',
  'monthly',
  'quality',
  'prabhupada',
  'purpose',
  'goals',
  'reminders',
] as const;
export type Collection = (typeof collections)[number];
export type Entry = {
  id: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: string | number | boolean | null | undefined;
};
export type Records = Record<Collection, Entry[]>;
export interface AppState {
  habits: HabitBundle;
  settings: Settings;
  records: Records;
  today: string;
  from: string;
  to: string;
  demo: boolean;
}
