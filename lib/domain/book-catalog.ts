export type ReadingBook = {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  url: string;
  color: string;
  logBook: string;
};

// Links checked against https://prabhupadabooks.com/books on 2026-09-28.
// These are reading links; book text and cover artwork are not reproduced here.
export const bookCatalog: ReadingBook[] = [
  {
    id: 'bg',
    title: 'Bhagavad-gītā As It Is',
    shortTitle: 'Bhagavad-gītā',
    subtitle: 'A conversation to return to, throughout your life.',
    url: 'https://prabhupadabooks.com/bg',
    color: '#39476b',
    logBook: 'Bhagavad-gītā As It Is',
  },
  {
    id: 'sb',
    title: 'Śrīmad-Bhāgavatam',
    shortTitle: 'Śrīmad-Bhāgavatam',
    subtitle: 'Make a little space for one verse and its purport.',
    url: 'https://prabhupadabooks.com/sb',
    color: '#537365',
    logBook: 'Śrīmad-Bhāgavatam',
  },
  {
    id: 'cc',
    title: 'Śrī Caitanya-caritāmṛta',
    shortTitle: 'Caitanya-caritāmṛta',
    subtitle: 'Read slowly. Carry something with you into the day.',
    url: 'https://prabhupadabooks.com/cc',
    color: '#9c622f',
    logBook: 'Śrī Caitanya-caritāmṛta',
  },
  {
    id: 'noi',
    title: 'Nectar of Instruction',
    shortTitle: 'Nectar of Instruction',
    subtitle: 'A small book to return to with fresh attention.',
    url: 'https://prabhupadabooks.com/noi',
    color: '#756185',
    logBook: 'Nectar of Instruction',
  },
  {
    id: 'nod',
    title: 'Nectar of Devotion',
    shortTitle: 'Nectar of Devotion',
    subtitle: 'Keep your place in your study of devotional service.',
    url: 'https://prabhupadabooks.com/nod',
    color: '#8a5260',
    logBook: 'Nectar of Devotion',
  },
  {
    id: 'kb',
    title: 'Krishna Book',
    shortTitle: 'KṚṢṆA',
    subtitle: 'The Supreme Personality of Godhead.',
    url: 'https://prabhupadabooks.com/kb',
    color: '#426375',
    logBook: 'Other',
  },
  {
    id: 'ssr',
    title: 'The Science of Self-Realization',
    shortTitle: 'The Science of Self-Realization',
    subtitle: 'Choose a chapter and settle into a few attentive pages.',
    url: 'https://prabhupadabooks.com/ssr',
    color: '#64693e',
    logBook: 'Other',
  },
  {
    id: 'tlc',
    title: 'Teachings of Lord Caitanya',
    shortTitle: 'Teachings of Lord Caitanya',
    subtitle: 'Let your reading unfold a little at a time.',
    url: 'https://prabhupadabooks.com/tlc',
    color: '#9b743d',
    logBook: 'Teachings of Lord Caitanya',
  },
  {
    id: 'iso',
    title: 'Śrī Īśopaniṣad',
    shortTitle: 'Śrī Īśopaniṣad',
    subtitle: 'A quiet place for your next mantra and purport.',
    url: 'https://prabhupadabooks.com/iso',
    color: '#4d7880',
    logBook: 'Other',
  },
];

export function prabhupadaBookUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      !['prabhupadabooks.com', 'www.prabhupadabooks.com'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
