import assert from 'node:assert/strict';
import type { AppState } from '../lib/domain/model';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Appearance checks are local-only.');
let passed = 0;
const check = (value: unknown, label: string) => {
  assert.ok(value, label);
  passed++;
  console.log('✓ ' + label);
};
const login = await fetch(base + '/api/auth/sign-in/email', {
  method: 'POST',
  headers: { origin: base, 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'demo@example.test', password: 'Local-Journal-Only-2026!' }),
});
assert.equal(login.status, 200);
await login.arrayBuffer();
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(';')[0])
  .join('; ');
async function api<T = unknown>(
  path: string,
  method = 'GET',
  input?: unknown,
  authenticated = true,
  origin = base,
) {
  const response = await fetch(base + path, {
    method,
    headers: { origin, 'content-type': 'application/json', ...(authenticated ? { cookie } : {}) },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  return { status: response.status, body: (await response.json()) as T };
}
const before = (await api<AppState>('/api/state')).body;
try {
  for (const theme of ['dark', 'light', 'system']) {
    const result = await api<{ theme: string }>('/api/settings', 'PATCH', { theme });
    check(
      result.status === 200 && result.body.theme === theme,
      `Saves ${theme} on the real Worker`,
    );
    const after = (await api<AppState>('/api/state')).body;
    assert.deepEqual(after.settings, { ...before.settings, theme });
    assert.deepEqual(after.records, before.records);
    check(true, `${theme} persists, preserving all other preferences and journal entries`);
  }
  check(
    (await api('/api/settings', 'PATCH', { theme: 'invalid' })).status === 400,
    'Invalid theme rejected',
  );
  check(
    (await api('/api/settings', 'PATCH', { theme: 'dark', name: 'overwrite' })).status === 400,
    'Extra settings rejected',
  );
  check(
    (await api('/api/settings', 'PATCH', { theme: 'dark' }, false)).status === 401,
    'Anonymous write rejected',
  );
  check(
    (await api('/api/settings', 'PATCH', { theme: 'dark' }, true, 'https://other.test')).status ===
      403,
    'Cross-origin write rejected',
  );
} finally {
  assert.equal((await api('/api/settings', 'PATCH', { theme: before.settings.theme })).status, 200);
  const after = (await api<AppState>('/api/state')).body;
  assert.deepEqual(after.settings, before.settings);
  check(true, 'Original test account preferences restored');
}
console.log(`\n${passed} appearance integration checks passed.`);
