import type { AcharyaLecture } from './acharya-catalog';

export type AcharyaLibraryResponse = {
  lessons: AcharyaLecture[];
  source: 'live' | 'bundled';
  lastSynced: string | null;
  status: 'idle' | 'syncing' | 'error';
  canContinue: boolean;
  scanned: number;
  matched: number;
  unverified: number;
  error: string;
  retryAfterSeconds: number;
};
