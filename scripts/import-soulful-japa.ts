import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  soulfulDatasetSchema,
  soulfulTextChunks,
  stableSoulfulJson,
} from '../lib/domain/soulful-reading';

const run = promisify(execFile);
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
// Hex literals preserve quotes, line breaks, Sanskrit, and control characters
// exactly. No PDF text is ever interpreted as SQL or shell syntax.
const text = (value: string) => `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;

export function buildSoulfulImport(input: unknown, now = new Date().toISOString()) {
  const data = soulfulDatasetSchema.parse(input);
  const contentVersion = digest(stableSoulfulJson(data));
  const statements: string[] = [];
  const sourceJson = stableSoulfulJson(data.source);
  statements.push(
    `INSERT INTO soulful_reading_sources(content_version,source,entry_count,imported_at) VALUES(${text(contentVersion)},${text(sourceJson)},${data.modules.length},${text(now)}) ON CONFLICT(content_version) DO NOTHING;`,
  );
  let partCount = 0,
    textBytes = 0;
  for (const [position, module] of data.modules.entries()) {
    const moduleKey = `${contentVersion}:${module.id}`;
    const serialized = stableSoulfulJson(module);
    const chunks = soulfulTextChunks(serialized);
    textBytes += Buffer.byteLength(serialized);
    partCount += chunks.length;
    statements.push(
      `INSERT INTO soulful_reading_modules(id,content_version,module_id,kind,number,label,title,start_page,end_page,block_count,part_count,content_hash,position) VALUES(${text(moduleKey)},${text(contentVersion)},${text(module.id)},${text(module.kind)},${module.number ?? 'NULL'},${text(module.label)},${text(module.title)},${module.startPage},${module.endPage},${module.blocks.length},${chunks.length},${text(digest(serialized))},${position}) ON CONFLICT(id) DO NOTHING;`,
    );
    for (const [index, chunk] of chunks.entries())
      statements.push(
        `INSERT INTO soulful_reading_parts(id,module_key,position,value) VALUES(${text(`${moduleKey}:${index}`)},${text(moduleKey)},${index},${text(chunk)}) ON CONFLICT(id) DO NOTHING;`,
      );
  }
  // A failed or interrupted stage never replaces the visible catalog. Activation
  // is a single guarded statement, with complete part sequences for every entry.
  const activationSql = `INSERT INTO soulful_reading_catalog(id,content_version,activated_at)
SELECT 'soulful-japa',${text(contentVersion)},${text(now)}
WHERE (SELECT COUNT(*) FROM soulful_reading_modules WHERE content_version=${text(contentVersion)})=${data.modules.length}
AND NOT EXISTS (SELECT 1 FROM soulful_reading_modules m WHERE m.content_version=${text(contentVersion)} AND (
  (SELECT COUNT(*) FROM soulful_reading_parts p WHERE p.module_key=m.id)<>m.part_count OR
  (SELECT MIN(position) FROM soulful_reading_parts p WHERE p.module_key=m.id)<>0 OR
  (SELECT MAX(position) FROM soulful_reading_parts p WHERE p.module_key=m.id)<>m.part_count-1))
ON CONFLICT(id) DO UPDATE SET content_version=excluded.content_version,activated_at=excluded.activated_at;`;
  for (const statement of [...statements, activationSql])
    if (Buffer.byteLength(statement) > 90_000)
      throw new Error(
        'An import statement exceeds the safe D1 size. Keep extraction audit details in the separate audit artifact.',
      );
  return {
    contentVersion,
    stageSql: statements.join('\n'),
    activationSql,
    summary: {
      contentVersion,
      sourceSha256: data.source.sha256,
      pageCount: data.source.pageCount,
      modules: data.modules.filter((module) => module.kind === 'module').length,
      supplements: data.modules.filter((module) => module.kind === 'supplement').length,
      parts: partCount,
      textBytes,
      statements: statements.length,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const accepted = new Set([
    '--input',
    '--local',
    '--remote',
    '--stage-only',
    '--activate-only',
    '--dry-run',
  ]);
  let input = 'data/soulful-japa-modules.json';
  for (let index = 0; index < args.length; index++) {
    if (!accepted.has(args[index])) throw new Error(`Unknown option: ${args[index]}`);
    if (args[index] === '--input') {
      if (!args[index + 1] || args[index + 1].startsWith('--'))
        throw new Error('--input needs a JSON file.');
      input = args[++index];
    }
  }
  if (args.includes('--local') && args.includes('--remote'))
    throw new Error('Choose either --local or --remote.');
  if (args.includes('--stage-only') && args.includes('--activate-only'))
    throw new Error('Choose staging or activation, not both.');
  const prepared = buildSoulfulImport(JSON.parse(await readFile(resolve(input), 'utf8')));
  const directory = resolve('.local/soulful-japa-import', prepared.contentVersion);
  await mkdir(directory, { recursive: true });
  const stageFile = resolve(directory, 'stage.sql');
  const activationFile = resolve(directory, 'activate.sql');
  await writeFile(stageFile, prepared.stageSql);
  await writeFile(activationFile, prepared.activationSql);
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(prepared.summary, null, 2));
  const scope = args.includes('--remote')
    ? '--remote'
    : args.includes('--local')
      ? '--local'
      : null;
  if (!scope || args.includes('--dry-run')) {
    console.log(
      JSON.stringify({ ...prepared.summary, action: 'validated-and-prepared', directory }, null, 2),
    );
    return;
  }
  const cli = resolve('node_modules/wrangler/bin/wrangler.js');
  const execute = (extra: string[]) =>
    run(process.execPath, [cli, 'd1', 'execute', 'DB', scope, '--yes', '--json', ...extra], {
      maxBuffer: 64 * 1024 * 1024,
    });
  if (!args.includes('--activate-only')) await execute(['--file', stageFile]);
  if (!args.includes('--stage-only')) {
    await execute(['--file', activationFile]);
    const verified = await execute([
      '--command',
      "SELECT content_version FROM soulful_reading_catalog WHERE id='soulful-japa'",
    ]);
    const results = JSON.parse(verified.stdout) as { results?: { content_version?: string }[] }[];
    if (results[0]?.results?.[0]?.content_version !== prepared.contentVersion)
      throw new Error(
        'The content is still staged: activation refused an incomplete import. Re-run the complete import before activating.',
      );
  }
  console.log(
    JSON.stringify(
      {
        ...prepared.summary,
        scope: scope.slice(2),
        action: args.includes('--stage-only') ? 'staged' : 'activated',
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Written module import failed.');
    process.exitCode = 1;
  });
