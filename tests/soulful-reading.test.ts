import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { buildSoulfulImport } from '../scripts/import-soulful-japa';
import {
  soulfulDatasetSchema,
  soulfulProgressActionSchema,
  soulfulTextChunks,
  type SoulfulDataset,
  type SoulfulLibraryResponse,
  type SoulfulProgress,
} from '../lib/domain/soulful-reading';

const { getDatabase, getSession } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('../lib/db/client', () => ({ database: getDatabase }));
vi.mock('../lib/auth', () => ({ auth: () => ({ api: { getSession } }) }));
import {
  getSoulfulLibrary,
  getSoulfulModule,
  saveSoulfulProgress,
  soulfulProgressForExport,
} from '../lib/db/soulful-reading';
import { GET as libraryGET } from '../app/api/soulful-japa/route';
import { GET as moduleGET, PUT as progressPUT } from '../app/api/soulful-japa/[id]/route';
import { GET as exportGET } from '../app/api/export/route';

const sample: SoulfulDataset = {
  source: {
    sha256: 'a'.repeat(64),
    version: 'test-v1',
    title: 'Soulful Japa',
    author: 'Madhu Pandit Dasa',
    pageCount: 583,
    privateExtractionPath: '/private/not-for-api/source.pdf',
  },
  modules: [
    {
      id: 'sj-module-001',
      kind: 'module',
      number: 1,
      label: 'Module 1',
      title: 'Listen to the holy name',
      startPage: 1,
      endPage: 2,
      blocks: [
        { type: 'heading', text: 'Module 1/1', page: 1 },
        {
          type: 'paragraph',
          text: "Exact text: Kṛṣṇa 🙏\n' ; DROP TABLE users; --\n\u0000End.",
          page: 1,
        },
        { type: 'verse', text: 'हरे कृष्ण\nHare Kṛṣṇa', page: 2 },
      ],
    },
    {
      id: 'sj-module-039',
      kind: 'module',
      number: 39,
      label: 'Module 39',
      title: 'Keep the original numbering',
      startPage: 3,
      endPage: 3,
      blocks: [{ type: 'paragraph', text: 'No invented module 38.', page: 3 }],
    },
    {
      id: 'sj-supplement-cue-cards',
      kind: 'supplement',
      number: null,
      label: 'Cue cards',
      title: 'Practice cards',
      startPage: 421,
      endPage: 422,
      blocks: [{ type: 'quote', text: 'Supplementary practice.', page: 421 }],
    },
  ],
};
const prepare = (input = sample) => buildSoulfulImport(input, '2026-10-03T00:00:00.000Z');
const action = (version = 0, change: object = { opened: true }) => ({
  version,
  requestId: crypto.randomUUID(),
  ...change,
});
const context = (id = 'sj-module-001') => ({ params: Promise.resolve({ id }) });

describe('written Soulful Japa import and private progress', () => {
  let sqlite: DatabaseSync;
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    for (const filename of readdirSync('migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync(`migrations/${filename}`, 'utf8'));
    for (const id of ['alice', 'bob'])
      sqlite
        .prepare(
          'INSERT INTO users(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,0,0,0)',
        )
        .run(id, id, `${id}@example.test`);
    getSession.mockImplementation(async ({ headers }: { headers: Headers }) => {
      const userId = headers.get('x-test-user');
      return userId === 'alice' || userId === 'bob' ? { user: { id: userId } } : null;
    });
    getDatabase.mockReturnValue(
      drizzle(async (query, params, method) => {
        const statement = sqlite.prepare(query);
        if (method === 'run') {
          statement.run(...(params as (string | number | null)[]));
          return { rows: [] };
        }
        return {
          rows: statement
            .all(...(params as (string | number | null)[]))
            .map((row) => Object.values(row)),
        };
      }),
    );
    const imported = prepare();
    sqlite.exec(imported.stageSql);
    sqlite.exec(imported.activationSql);
  });
  afterEach(() => sqlite.close());
  const snapshot = () =>
    sqlite.prepare('SELECT * FROM soulful_reading_progress ORDER BY user_id,module_id').all();
  const request = (
    method = 'GET',
    value?: unknown,
    user = 'alice',
    origin = 'https://journal.test',
  ) =>
    new Request('https://journal.test/api/soulful-japa/sj-module-001', {
      method,
      headers: { origin, 'x-test-user': user, 'content-type': 'application/json' },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });

  it('returns a light index without blocks, preserves printed gaps and separates supplements by kind', async () => {
    const library = await getSoulfulLibrary('alice');
    expect(library.modules.map((module) => module.number)).toEqual([1, 39, null]);
    expect(library.modules[2].kind).toBe('supplement');
    expect(library.modules.every((module) => !('blocks' in module))).toBe(true);
    expect(library.resumeModuleId).toBe('sj-module-001');
    expect(library.source?.sha256).toBe(sample.source.sha256);
    expect(JSON.stringify(library)).not.toContain('/private/');
  });
  it('reads exact Unicode, line breaks, quotes and control characters from D1 parts, without executing PDF text', async () => {
    const loaded = await getSoulfulModule('alice', 'sj-module-001');
    expect(loaded.module).toEqual(sample.modules[0]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()?.n).toBe(2);
    expect(loaded.progress).toBe(null);
    expect(snapshot()).toEqual([]);
  });
  it('chunks large text by UTF-8 bytes without splitting supplementary characters', async () => {
    const text = 'Kṛṣṇa 🙏\n'.repeat(10_000);
    const chunks = soulfulTextChunks(text, 128);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk) <= 128)).toBe(true);
    const large = structuredClone(sample);
    large.modules[0].blocks[1].text = text;
    const imported = prepare(large);
    expect(imported.summary.parts).toBeGreaterThan(3);
    expect(
      imported.stageSql.split('\n').every((statement) => Buffer.byteLength(statement) < 90_000),
    ).toBe(true);
    sqlite.exec(imported.stageSql);
    sqlite.exec(imported.activationSql);
    expect((await getSoulfulModule('alice', 'sj-module-001')).module.blocks[1].text).toBe(text);
  });
  it('does not expose partial revisions; staged repeats preserve every private completion', async () => {
    const completed = await saveSoulfulProgress(
      'alice',
      'sj-module-001',
      action(0, { completed: true }),
    );
    const oldVersion = (await getSoulfulLibrary('alice')).source!.contentVersion;
    const changed = structuredClone(sample);
    changed.modules[0].title = 'Revised extraction';
    const revision = prepare(changed);
    sqlite.exec(revision.stageSql.split('\n').slice(0, 2).join('\n'));
    sqlite.exec(revision.activationSql);
    expect((await getSoulfulLibrary('alice')).source!.contentVersion).toBe(oldVersion);
    sqlite.exec(revision.stageSql);
    sqlite.exec(revision.activationSql);
    sqlite.exec(revision.stageSql);
    sqlite.exec(revision.activationSql);
    expect((await getSoulfulLibrary('alice')).source!.contentVersion).toBe(revision.contentVersion);
    expect(await soulfulProgressForExport('alice')).toEqual([completed.progress]);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()?.n).toBe(2);
  });
  it('rejects incomplete or corrupted stored content instead of claiming a successful module load', async () => {
    sqlite
      .prepare(
        "UPDATE soulful_reading_parts SET value='{}' WHERE module_key LIKE '%:sj-module-001'",
      )
      .run();
    await expect(getSoulfulModule('alice', 'sj-module-001')).rejects.toThrow('integrity');
  });
  it('stores completion time, supports undo, and never creates a Prabhupada book report', async () => {
    const first = await saveSoulfulProgress(
      'alice',
      'sj-module-001',
      action(0, { completed: true, opened: true }),
      new Date('2026-10-03T01:00:00Z'),
    );
    expect(first.progress).toMatchObject({
      completed: true,
      completedAt: '2026-10-03T01:00:00.000Z',
      version: 1,
    });
    expect(first.resumeModuleId).toBe('sj-module-039');
    const second = await saveSoulfulProgress(
      'alice',
      'sj-module-001',
      action(1, { completed: false }),
    );
    expect(second.progress).toMatchObject({ completed: false, completedAt: null, version: 2 });
    expect(second.resumeModuleId).toBe('sj-module-001');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM reading_sessions').get()?.n).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM companion_entries').get()?.n).toBe(0);
  });
  it('retries identical and simultaneous requests exactly once, rejecting mutated request IDs and stale changes', async () => {
    const input = action(0, { completed: true });
    const [first, second] = await Promise.all([
      saveSoulfulProgress('alice', 'sj-module-001', input),
      saveSoulfulProgress('alice', 'sj-module-001', input),
    ]);
    expect(first).toEqual(second);
    expect(await saveSoulfulProgress('alice', 'sj-module-001', input)).toEqual(first);
    expect(snapshot()).toHaveLength(1);
    await expect(
      saveSoulfulProgress('alice', 'sj-module-001', { ...input, completed: false }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveSoulfulProgress('alice', 'sj-module-001', action(0, { completed: false })),
    ).rejects.toMatchObject({ status: 409 });
    await saveSoulfulProgress('alice', 'sj-module-001', action(1, { completed: false }));
    await expect(saveSoulfulProgress('alice', 'sj-module-001', input)).rejects.toMatchObject({
      status: 409,
    });
    expect((await getSoulfulModule('alice', 'sj-module-001')).progress?.completed).toBe(false);
  });
  it('keeps independent module completions while allowing only one competing edit of the same module', async () => {
    await Promise.all([
      saveSoulfulProgress('alice', 'sj-module-001', action(0, { completed: true })),
      saveSoulfulProgress('alice', 'sj-module-039', action(0, { completed: true })),
    ]);
    expect((await soulfulProgressForExport('alice')).filter((item) => item.completed)).toHaveLength(
      2,
    );
    const competing = await Promise.allSettled([
      saveSoulfulProgress('alice', 'sj-module-001', action(1, { completed: false })),
      saveSoulfulProgress('alice', 'sj-module-001', action(1, { anchor: 2 })),
    ]);
    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(competing.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('resumes a deliberately opened supplement, guards invalid anchors and notices content revisions', async () => {
    const opened = await saveSoulfulProgress('alice', 'sj-supplement-cue-cards', action());
    expect(opened.resumeModuleId).toBe('sj-supplement-cue-cards');
    await expect(
      saveSoulfulProgress('alice', 'sj-module-001', action(0, { anchor: 3 })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      saveSoulfulProgress(
        'alice',
        'sj-module-001',
        action(0, { opened: true, contentVersion: 'b'.repeat(64) }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('enforces authentication and origin and keeps GETs read-only including content access', async () => {
    const before = sqlite.prepare('SELECT total_changes() AS n').get()?.n;
    expect((await libraryGET(request('GET', undefined, ''))).status).toBe(401);
    expect((await moduleGET(request('GET', undefined, ''), context())).status).toBe(401);
    expect((await libraryGET(request())).status).toBe(200);
    expect((await moduleGET(request(), context())).status).toBe(200);
    expect(
      (await progressPUT(request('PUT', action(), 'alice', 'https://untrusted.test'), context()))
        .status,
    ).toBe(403);
    expect((await progressPUT(request('PUT', action(), ''), context())).status).toBe(401);
    expect(sqlite.prepare('SELECT total_changes() AS n').get()?.n).toBe(before);
  });
  it('rejects unknown IDs, ownership/source injection, malformed JSON and oversized bodies', async () => {
    expect((await moduleGET(request(), context('sj-module-038'))).status).toBe(404);
    expect((await moduleGET(request(), context('other'))).status).toBe(400);
    for (const extra of [
      { userId: 'bob' },
      { source: 'replacement' },
      { completedAt: '1999-01-01' },
    ])
      expect((await progressPUT(request('PUT', { ...action(), ...extra }), context())).status).toBe(
        400,
      );
    expect(
      (
        await progressPUT(
          new Request('https://journal.test/api/soulful-japa/sj-module-001', {
            method: 'PUT',
            headers: { origin: 'https://journal.test', 'x-test-user': 'alice' },
            body: '{bad',
          }),
          context(),
        )
      ).status,
    ).toBe(400);
    expect(
      (await progressPUT(request('PUT', { ...action(), extra: 'x'.repeat(70_000) }), context()))
        .status,
    ).toBe(413);
    expect(snapshot()).toEqual([]);
  });
  it('isolates accounts, returns private no-store responses and exports only the owner’s written progress', async () => {
    await saveSoulfulProgress('alice', 'sj-module-001', action(0, { completed: true }));
    await saveSoulfulProgress('bob', 'sj-module-039', action(0, { opened: true }));
    const alice = await libraryGET(request());
    expect(alice.headers.get('cache-control')).toBe('private, no-store');
    expect(
      ((await alice.json()) as SoulfulLibraryResponse).progress.map((item) => item.moduleId),
    ).toEqual(['sj-module-001']);
    expect((await getSoulfulModule('bob', 'sj-module-001')).progress).toBe(null);
    const aliceLibrary = await getSoulfulLibrary('alice'),
      bobLibrary = await getSoulfulLibrary('bob');
    expect(aliceLibrary.readerKey).toMatch(/^[a-f0-9]{64}$/);
    expect(aliceLibrary.readerKey).not.toBe(bobLibrary.readerKey);
    expect((await getSoulfulLibrary('alice')).readerKey).toBe(aliceLibrary.readerKey);
    const exported = await exportGET(
      new Request('https://journal.test/api/export', { headers: { 'x-test-user': 'bob' } }),
    );
    expect(exported.status).toBe(200);
    const value = (await exported.json()) as { soulfulJapaReading: SoulfulProgress[] };
    expect(value.soulfulJapaReading).toEqual(await soulfulProgressForExport('bob'));
    expect(value.soulfulJapaReading.map((item: { moduleId: string }) => item.moduleId)).toEqual([
      'sj-module-039',
    ]);
    expect(JSON.stringify(value.soulfulJapaReading)).not.toMatch(
      /userId|lastRequest|Listen to the holy name/,
    );
    expect((await exportGET(new Request('https://journal.test/api/export'))).status).toBe(401);
  });
});

describe('written module validation', () => {
  it('preserves exact text while rejecting mismatched IDs, duplicate modules, bad pages and unsafe image paths', () => {
    expect(soulfulDatasetSchema.parse(sample)).toEqual(sample);
    const mutated = structuredClone(sample);
    mutated.modules[0].id = 'sj-module-002';
    expect(soulfulDatasetSchema.safeParse(mutated).success).toBe(false);
    expect(
      soulfulDatasetSchema.safeParse({ ...sample, modules: [...sample.modules, sample.modules[0]] })
        .success,
    ).toBe(false);
    mutated.modules[0] = { ...sample.modules[0], endPage: 584 };
    expect(soulfulDatasetSchema.safeParse(mutated).success).toBe(false);
    mutated.modules[0] = {
      ...sample.modules[0],
      blocks: [{ type: 'image', text: '', page: 1, src: '/soulful-japa/../../private.png' }],
    };
    expect(soulfulDatasetSchema.safeParse(mutated).success).toBe(false);
    expect(
      soulfulProgressActionSchema.safeParse({ version: 0, requestId: crypto.randomUUID() }).success,
    ).toBe(false);
  });
});
