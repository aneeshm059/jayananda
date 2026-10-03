import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { drizzle, type AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import { defaultSettings } from '../lib/domain/model';
import { soulfulImageTransform } from '../lib/domain/soulful-presentation';
import { respectfulAuthor } from '../lib/domain/display-names';
import orientation from '../data/soulful-japa-image-orientation.json';

const { getDatabase, getSession } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock('../lib/db/client', () => ({ database: getDatabase }));
vi.mock('../lib/auth', () => ({ auth: () => ({ api: { getSession } }) }));
import { PATCH } from '../app/api/settings/route';
import { getSettings, putSettings, putTheme } from '../lib/db/repository';

describe('source presentation', () => {
  it('corrects every audited figure without transforming future or unrelated images', () => {
    const content = JSON.parse(readFileSync('data/soulful-japa-modules.json', 'utf8'));
    const figures = content.modules.flatMap((m: { blocks: { type: string; src: string }[] }) =>
      m.blocks.filter((b) => b.type === 'image').map((b) => b.src),
    );
    expect(orientation.sourceSha256).toBe(content.source.sha256);
    expect(orientation.flipY).toEqual(figures);
    expect(figures).toHaveLength(195);
    for (const src of figures) expect(soulfulImageTransform(src)).toBe('scaleY(-1)');
    expect(soulfulImageTransform('/other.jpg')).toBeUndefined();
    expect(soulfulImageTransform()).toBeUndefined();
  });
  it('uses the requested honorific once, preserving other names and surrounding prose', () => {
    for (const name of [
      'Madhu Pandit Dasa',
      'Madhupandit Dasa',
      'Sri. Madhu Pandit Prabhu',
      'His Grace Madhu Pandit Prabhu',
      'His Grace Madhupandit Dasa',
    ]) {
      expect(respectfulAuthor(`by ${name}.`)).toBe('by His Grace Madhupandit Dasa.');
    }
    expect(respectfulAuthor('Gauridas Pandit and Chanakya Pandit')).toBe(
      'Gauridas Pandit and Chanakya Pandit',
    );
  });
});

describe('theme-only preference changes', () => {
  let sqlite: DatabaseSync;
  let beforeBatch: (() => void) | undefined;
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    for (const file of readdirSync('migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
    for (const id of ['alice', 'bob'])
      sqlite
        .prepare(
          'INSERT INTO users(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,0,0,0)',
        )
        .run(id, id, `${id}@example.test`);
    const execute: AsyncRemoteCallback = async (query, params, method) => {
      const statement = sqlite.prepare(query);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      const rows = statement.all(...params).map((row) => Object.values(row));
      return { rows: method === 'get' ? rows[0] : rows };
    };
    beforeBatch = undefined;
    getDatabase.mockReturnValue(
      drizzle(execute, async (queries) => {
        beforeBatch?.();
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const query of queries)
            results.push(await execute(query.sql, query.params, query.method));
          sqlite.exec('COMMIT');
          return results;
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      }),
    );
    getSession.mockImplementation(async ({ headers }: { headers: Headers }) =>
      headers.get('x-user') === 'alice' ? { user: { id: 'alice' } } : null,
    );
  });
  afterEach(() => sqlite.close());
  const request = (input: unknown, user = 'alice', origin = 'https://journal.test') =>
    new Request('https://journal.test/api/settings', {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json', 'x-user': user },
      body: JSON.stringify(input),
    });
  it('persists dark/light/system without changing other settings or another account', async () => {
    const original = { ...defaultSettings, name: 'My practice', hero: 'minimal' as const };
    await putSettings('alice', original);
    await putSettings('bob', { ...defaultSettings, name: 'Other reader' });
    for (const theme of ['dark', 'light', 'system']) {
      const response = await PATCH(request({ theme }));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await getSettings('alice')).toEqual({ ...original, theme });
      expect(
        sqlite.prepare('SELECT theme,hero FROM app_preferences WHERE user_id=?').get('alice'),
      ).toEqual({ theme, hero: original.hero });
      expect((await getSettings('bob')).theme).toBe('light');
    }
  });
  it('initializes only the signed-in account when settings do not yet exist', async () => {
    await putTheme('alice', { theme: 'dark' });
    expect(await getSettings('alice')).toEqual({
      ...defaultSettings,
      name: 'alice',
      theme: 'dark',
    });
    expect(sqlite.prepare('SELECT count(*) AS n FROM user_settings').get()?.n).toBe(1);
  });
  it('preserves unrelated preferences saved by another tab between read and write', async () => {
    await putSettings('alice', defaultSettings);
    beforeBatch = () => {
      sqlite
        .prepare(
          "UPDATE user_settings SET value=json_set(value,'$.name','Updated elsewhere') WHERE user_id='alice'",
        )
        .run();
      sqlite.prepare("UPDATE app_preferences SET hero='minimal' WHERE user_id='alice'").run();
    };
    await putTheme('alice', { theme: 'dark' });
    expect((await getSettings('alice')).name).toBe('Updated elsewhere');
    expect(
      sqlite.prepare("SELECT hero FROM app_preferences WHERE user_id='alice'").get()?.hero,
    ).toBe('minimal');
  });
  it('rejects invalid themes, extra fields, anonymous and cross-origin writes', async () => {
    for (const input of [{ theme: 'sepia' }, { theme: 'dark', name: 'replace' }, {}, null])
      expect((await PATCH(request(input))).status).toBe(400);
    expect((await PATCH(request({ theme: 'dark' }, 'unknown'))).status).toBe(401);
    expect(
      (await PATCH(request({ theme: 'dark' }, 'alice', 'https://elsewhere.test'))).status,
    ).toBe(403);
    expect(sqlite.prepare('SELECT count(*) AS n FROM user_settings').get()?.n).toBe(0);
  });
  it('rolls back the theme if the paired appearance write fails', async () => {
    await putSettings('alice', defaultSettings);
    sqlite.exec(
      "CREATE TRIGGER fail_preferences BEFORE UPDATE ON app_preferences BEGIN SELECT RAISE(ABORT, 'test'); END",
    );
    await expect(putTheme('alice', { theme: 'dark' })).rejects.toThrow();
    expect((await getSettings('alice')).theme).toBe('light');
  });
});
