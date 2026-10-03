import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Block = {
  type: string;
  text: string;
  page: number;
  src?: string;
  sha256?: string;
  width?: number;
  height?: number;
};
type Entry = {
  id: string;
  kind: 'module' | 'supplement';
  number: number | null;
  title: string;
  startPage: number;
  endPage: number;
  blocks: Block[];
};
const content = JSON.parse(
  readFileSync(new URL('../data/soulful-japa-modules.json', import.meta.url), 'utf8'),
) as {
  source: { sha256: string; pageCount: number; missingModuleNumbers: number[] };
  modules: Entry[];
};
const entries = content.modules;
const blocks = entries.flatMap((entry) => entry.blocks);
const compact = (text: string) => text.replace(/\s+/gu, '');
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const module = (number: number) => entries.find((entry) => entry.number === number)!;

// These fingerprints come from an independent audit of the supplied 583-page PDF:
// direct PDF text in reading order, all 149 printed headings, and original image
// bytes/placements. A source replacement requires a new PDF audit, not regenerated
// expectations from the extraction script. Paragraph styling may change freely.
describe('Soulful Japa original PDF content', () => {
  it('identifies the audited source and preserves its actual module numbering', () => {
    expect(content.source.sha256).toBe(
      'cc6c7af5b5623282d4ff7958b99569e8a0c5482d756658ea8ccb45480c448bbc',
    );
    expect(content.source.pageCount).toBe(583);
    expect(content.source.missingModuleNumbers).toEqual([38, 42]);
    const expectedNumbers = Array.from({ length: 108 }, (_, i) => i + 1).filter(
      (number) => number !== 38 && number !== 42,
    );
    expect(entries.filter((entry) => entry.kind === 'module').map((entry) => entry.number)).toEqual(
      expectedNumbers,
    );
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it('retains every printed module/part heading at its original page boundary', () => {
    const headings = blocks
      .filter(
        (block) =>
          block.type === 'heading' &&
          block.page <= 414 &&
          /^Module\s+\d+(?:\/\s*\d+)?(?:\s+Practice of [Bb]haavana for Mala [123])?\s*$/.test(
            block.text,
          ),
      )
      .map((block) => [compact(block.text), block.page]);
    expect(headings).toHaveLength(149);
    expect(sha256(JSON.stringify(headings))).toBe(
      'bb7b45a6fe4d6dcf090f8a3fd3b53327f2853e2219cfe7f9a61f69f3f5de6cf8',
    );
    expect(module(39).blocks.some((block) => block.text === 'Module 39/3')).toBe(true);
    expect(module(40).blocks.some((block) => block.text === 'Module 40/4')).toBe(true);
    expect(module(40).blocks.some((block) => block.text === 'Module 40')).toBe(true);
  });

  it('preserves all source words and their order, allowing whitespace-only reflow', () => {
    expect(sha256(compact(blocks.map((block) => block.text).join('')))).toBe(
      '8697b808a52bd8b44da038af6b8180bb93883a072cdfd6db5953c3978eafeff6',
    );
    // These are visible in the PDF, including its original mojibake and spelling.
    const page166 = blocks
      .filter((block) => block.page === 166)
      .map((block) => block.text)
      .join(' ');
    expect(page166).toContain('Puräëa');
    expect(page166).toContain('Caitanya-caritämåta');
    expect(page166).toContain('Kåñëa');
    expect(blocks.some((block) => block.text.includes('\uFFFD'))).toBe(false);
  });

  it('keeps source placeholders without inventing missing lessons', () => {
    const module58 = module(58).blocks;
    const emptyPart = module58.findIndex((block) => block.text === 'Module 58/2');
    expect(emptyPart).toBeGreaterThan(-1);
    expect(module58.slice(emptyPart + 1).every((block) => block.text === 'Soulful Japa')).toBe(
      true,
    );
    for (const number of [79, 80, 83, 84, 85, 86, 87, 88, 89, 90]) {
      const entry = module(number);
      const body = entry.blocks.filter((block) => block.type !== 'heading');
      expect(body.length).toBeGreaterThan(0);
      expect(body.every((block) => ['b', 'bl', 'blank'].includes(block.text))).toBe(true);
    }
  });

  it('preserves all 195 original figure placements and the exact embedded bytes', () => {
    const figures = blocks.filter((block) => block.type === 'image');
    expect(figures).toHaveLength(195);
    expect(sha256(JSON.stringify(figures.map((block) => [block.page, block.sha256])))).toBe(
      'cab38920bf6574f849ca44874416f2c80a1e59e90444e644f6d513c32369d599',
    );
    for (const figure of figures) {
      expect(figure.src).toMatch(/^\/soulful-japa\/page-\d{3}-figure-\d{2}\.(?:jpe?g|png)$/);
      expect(sha256(readFileSync(join(process.cwd(), 'public', figure.src!)))).toBe(figure.sha256);
      expect(figure.width).toBeGreaterThan(40);
      expect(figure.height).toBeGreaterThan(40);
    }
    // The repeated diagram is present each time, not removed as a duplicate.
    expect(
      [244, 247, 308].map((page) => figures.filter((block) => block.page === page).length),
    ).toEqual([1, 1, 3]);
  });

  it('retains the cue cards, all sixteen weeks, index, letter, and final source pages', () => {
    expect(entries.find((entry) => entry.id === 'sj-supplement-cue-cards')?.startPage).toBe(419);
    for (let week = 1; week <= 16; week++) {
      const entry = entries.find(
        (item) => item.id === `sj-supplement-week-${String(week).padStart(2, '0')}`,
      );
      expect(entry?.blocks.length).toBeGreaterThan(0);
    }
    expect(entries.find((entry) => entry.id === 'sj-supplement-index')?.startPage).toBe(573);
    expect(entries.find((entry) => entry.id === 'sj-supplement-cover')?.blocks[0].type).toBe(
      'image',
    );
    expect(entries.find((entry) => entry.id === 'sj-supplement-letter')?.startPage).toBe(581);
    expect(entries.at(-1)?.endPage).toBe(583);
    expect(new Set(blocks.map((block) => block.page))).toEqual(
      new Set(Array.from({ length: 583 }, (_, index) => index + 1)),
    );
    for (const entry of entries) {
      expect(
        entry.blocks.every((block) => block.page >= entry.startPage && block.page <= entry.endPage),
      ).toBe(true);
    }
  });
});
