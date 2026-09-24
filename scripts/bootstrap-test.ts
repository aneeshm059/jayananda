import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { defaultSettings, defaultPurpose } from '../lib/domain/model';

const base = 'http://localhost:3000';
const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
assert.equal(
  vars.OWNER_EMAIL,
  'demo@example.test',
  'Only the local demo configuration is allowed.',
);
function localSql(sql: string) {
  return JSON.parse(
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', sql, '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
}
assert.equal(
  localSql('SELECT count(*) AS n FROM users')[0].results[0].n,
  0,
  'Bootstrap test requires an empty local DB. Run seed:clear only on disposable fixtures.',
);
let userId: string | undefined;
let cookie = '';
const password = randomBytes(24).toString('base64url');
async function api(path: string, body?: unknown, invitation?: string, method = 'POST') {
  return fetch(base + path, {
    method,
    headers: {
      origin: base,
      'Content-Type': 'application/json',
      cookie,
      ...(invitation ? { 'x-invitation': invitation } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  const signup = { name: 'Bootstrap test', email: vars.OWNER_EMAIL, password };
  assert.equal((await api('/api/auth/sign-up/email', signup, 'wrong')).status, 403);
  const result = await api('/api/auth/sign-up/email', signup, vars.SIGNUP_INVITE);
  assert.equal(result.status, 200, 'Private invitation creates the first account');
  const created = (await result.json()) as { user: { id: string } };
  userId = created.user.id;
  cookie = result.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  const date = '2026-09-24';
  assert.equal(
    (await api('/api/settings', { ...defaultSettings, onboarded: true }, undefined, 'PUT')).status,
    200,
  );
  assert.equal((await api('/api/data/purpose', { date, text: defaultPurpose })).status, 201);
  const state = (await (await api('/api/state', undefined, undefined, 'GET')).json()) as {
    settings: { onboarded: boolean };
    records: { purpose: Array<{ text: string }> };
  };
  assert.equal(state.settings.onboarded, true);
  assert.equal(state.records.purpose[0].text, defaultPurpose);
  assert.equal((await api('/api/auth/sign-up/email/', signup, vars.SIGNUP_INVITE)).status, 403);
  assert.equal(
    (
      await api('/api/auth/change-password', {
        currentPassword: password,
        newPassword: password + 'new',
        revokeOtherSessions: true,
      })
    ).status,
    200,
  );
  console.log(
    '9 bootstrap assertions passed: invitation, first account, session, onboarding, long purpose, registration lock and password change.',
  );
} finally {
  if (userId) {
    assert.match(userId, /^[a-zA-Z0-9_-]+$/);
    localSql(`DELETE FROM users WHERE id='${userId}' AND email='demo@example.test'`);
    console.log('Removed only the temporary local bootstrap account.');
  }
}
