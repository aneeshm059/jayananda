# Written Soulful Japa

This reader is separate from the Soulful Japa video course and Prabhupāda book journal. Marking a written module complete changes only its private reading progress; it does not add minutes or a Prabhupāda book report.

## Content and import

`data/soulful-japa-modules.json` contains the extracted source text and image descriptors. Numbered modules preserve the printed numbers and gaps. Supplementary resources have `kind: "supplement"`, a null number, and stable `sj-supplement-*` IDs.

The complete validated JSON for each entry is stored in D1, split between Unicode code points into at most 16 KiB text parts. SQL text uses hexadecimal UTF-8 literals, preserving quotes, newlines, and diacritics without evaluating source text as SQL. Images are versioned app assets under `/soulful-japa/`; their descriptors and page references are also in D1.

An import stages an immutable dataset version identified by its SHA-256 digest. The active catalog pointer changes only after every expected module and part exists. Repeating an import does not delete or reset user progress. A failed or interrupted stage leaves the previous active catalog visible. Lazy module GETs verify the assembled content against its stored SHA-256 before returning it.

Use the supported Node runtime and apply additive migrations before importing:

```sh
npm run db:local
npx tsx scripts/import-soulful-japa.ts --dry-run
npx tsx scripts/import-soulful-japa.ts --local
```

With no target flag, the importer validates and generates SQL under the ignored `.local/soulful-japa-import/` directory without running it. `--input path/to/file.json` selects another extraction. Production commands require an explicit `--remote` flag and the normal release authorization.

For a production revision that introduces new image assets, stage the data before deployment, deploy the Worker/assets, then activate:

```sh
npx tsx scripts/import-soulful-japa.ts --remote --stage-only
# Deploy the approved Worker and assets through the normal release workflow.
npx tsx scripts/import-soulful-japa.ts --remote --activate-only
```

Use the same unmodified dataset for both commands. Activation verifies the pointer afterwards and reports an incomplete stage as an error. The importer never writes user/progress tables. Previous immutable versions are retained rather than deleted automatically.

## Private API

Every route requires a session, uses private/no-store responses, and accepts no user ID. The server derives ownership from the session.

- `GET /api/soulful-japa`: public bibliographic source metadata, lightweight flat module/supplement index, this user's progress, `resumeModuleId`, and an opaque account-scoped `readerKey` for browser draft recovery. It performs no writes.
- `GET /api/soulful-japa/:id`: complete module blocks loaded from D1, bibliographic source metadata, and this user's progress or null. It performs no writes.
- `PUT /api/soulful-japa/:id`: strict `{version, requestId, opened?: true, completed?: boolean, anchor?: number, contentVersion?: string}`. At least one change is required. `version: 0` creates absent progress. `contentVersion` should match the source returned by GET. The response is `{progress, resumeModuleId}`.

Progress updates use a per-user/per-module version comparison. Different modules can be updated independently. A stale competing update returns 409. Retrying the exact last request ID and payload returns the already committed progress; reusing it with changed content or retrying after a later edit conflicts. Clients must preserve uncertain requests, show failures, and explicitly reload/review rather than automatically replacing another device's data.

Completion time and last-opened time are assigned by the server. Undo clears completion time. Continue resumes the latest deliberately opened unfinished item; otherwise it selects the next unfinished numbered module and then supplementary resources. All completed returns no next item. Source revisions preserve completions and reset an old-version anchor on the next write.

`GET /api/export` includes `soulfulJapaReading` for the authenticated user, excluding internal request data and the book content. CSV journal exports are unchanged.

## Verification

`npx vitest run tests/soulful-reading.test.ts` uses an in-memory SQLite database for exact content reconstruction, staging, malformed content, independent/private completion updates, concurrency, retries, authenticated routes, and export isolation.

After importing the final extraction into a local Worker/D1 environment:

```sh
npx tsx scripts/soulful-reading-integration.ts
```

The HTTP harness refuses remote hosts. It compares every lazy module response to the extracted dataset, checks protections and progress semantics, and uses only the second local fixture account's modules 105 and 106 for writes. Cleanup restores only those fixture rows, refusing to overwrite progress with an unrecognized request ID. It does not modify shared content or production data.

The installed Miniflare ProxyWorker can drop its next upstream connection after an intentionally oversized request is rejected with 413. The harness tests that boundary last, after all ordinary persistence checks, and retries sign-out if the local transport drops it. Normal reader progress payloads are below 1 KiB; the oversized probe is 70 KiB. Neither cancelling the unread body nor closing the client connection resolved the development proxy issue, so no speculative change to production HTTP handling is included.
