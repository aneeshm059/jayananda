import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.dev.vars')) {
  console.log('.dev.vars already exists; keeping your local configuration.');
} else {
  const invite = randomBytes(32).toString('base64url');
  writeFileSync(
    '.dev.vars',
    [
      'BETTER_AUTH_URL=http://localhost:3000',
      'BETTER_AUTH_SECRET=' + randomBytes(48).toString('base64url'),
      'OWNER_EMAIL=demo@example.test',
      'SIGNUP_INVITE=' + invite,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  mkdirSync('.local', { recursive: true });
  writeFileSync(
    '.local/LOCAL-SETUP.md',
    `# Local account setup\n\nOpen http://localhost:3000/login and select the first-visit link.\n\nEmail: demo@example.test\n\nInvitation: ${invite}\n\nChoose your own password (12–128 characters). This only works while the local database has no users. Alternatively, run npm run seed for a disposable demonstration account.\n`,
    { mode: 0o600 },
  );
  console.log('Created local secrets. Instructions: .local/LOCAL-SETUP.md');
}
