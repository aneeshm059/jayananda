# The Acharya source snapshot

The fixed source is [The Acharya](https://www.youtube.com/channel/UCDTX-lo7YZCg_P28_Mo4NOg),
also published at [@TheAcharya1](https://www.youtube.com/@TheAcharya1).
The public [uploads playlist](https://www.youtube.com/playlist?list=UUDTX-lo7YZCg_P28_Mo4NOg)
and channel Videos tab each returned **875 unique videos** in the initial scan.
**386** had listed durations from **1,800 through 2,700 seconds**, inclusive.

The bundled snapshot records the exact titles, IDs, durations, language evidence,
and upload timestamps returned by YouTube. All 386 duration candidates remain in
the metadata snapshot so exclusions and unresolved checks are traceable. Only
eligible records are exported for discovery.

At this snapshot, **296** records have original automatic-caption language `en`,
**83** have `hi`, **5** have `bn`, and **2** returned no usable original language
evidence. The completed in-app sync resolved the initial 44 rate-limited requests:
42 had English ASR and 2 had Hindi ASR. These verified public metadata records
were read from the local sync cache and merged into the bundled snapshot, with
the latest check at **29 September 2026, 04:41:28 UTC**.

`FNqAVH2e3iQ` and `YjM9FbvRvGs` remain explicitly recorded in
`unresolvedVideoIds`. They are excluded pending language evidence, not classified
as non-English. Every duration candidate was checked; these two recordings still
lack enough metadata to determine eligibility.

Examples in the English snapshot:

| Original title                                                                             | Duration | Public source                                                |
| ------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------ |
| Chanting Krishna Is Direct Association \| SB 3.25.5-6 \| Mumbai, India \| Srila Prabhupada | 44:29    | [YouTube video](https://www.youtube.com/watch?v=tzvTRToR6ls) |
| Queen Kuntī’s Powerful Prayer for Pure Devotion \| SB 1.8.41 \| Los Angeles, California \| | 39:52    | [YouTube video](https://www.youtube.com/watch?v=s4zHJJ1GMQo) |
| Do Not Manufacture Truth \| SB 1.5.30 \| \| Vrindavan, India \| Srila Prabhupada           | 30:44    | [YouTube video](https://www.youtube.com/watch?v=IS1Fcnh-W-M) |

## Language and eligibility

`selectAcharyaLecture` is shared by bundled data and server sync. It requires the
fixed channel and duration range, and rejects known unavailable or non-embeddable
videos. It accepts original/default English audio metadata, English ASR for the
primary/sole audio track, or an explicit publisher label such as “English Lecture”.
Known contradictory language metadata rejects the record. Latin-script titles,
uploaded English subtitles, and translated caption choices are not language proof.

The original ASR language is YouTube's automatic classification, not a manual
audio audit or a guarantee that every second is English. Sanskrit quotations may
occur in an English lecture. All initial accepted records use original ASR
evidence; the source did not explicitly label these 386 titles “English”.

Official YouTube documentation distinguishes
[default audio language from title language](https://developers.google.com/youtube/v3/docs/videos)
and defines [ASR caption tracks and their language](https://developers.google.com/youtube/v3/docs/captions).
Those definitions support the evidence model; the app does not use an authenticated
YouTube Data API or claim official support for extracting public-page JSON.
The public browse/watch metadata protocol is undocumented and can change or throttle.

## Rebuilding the bundled snapshot

From the repository root:

```sh
npx tsx scripts/refresh-acharya-catalog.ts --check
npx tsx scripts/refresh-acharya-catalog.ts
npx tsx scripts/refresh-acharya-catalog.ts --recheck
```

`--check` validates the committed snapshot without network access. The normal
refresh follows every public channel continuation using the same parser as the
server, then verifies duration candidates. It reuses unchanged language evidence
for up to 14 days. `--recheck` requests fresh watch metadata for every candidate.
The initial snapshot was collected with yt-dlp's flat, metadata-only uploads scan
and the same original-ASR rule applied to public watch metadata.

Refresh makes one request at a time with a delay. A request failure stops the run
and leaves the bundled snapshot unchanged. Successful checks are cached in the
ignored `.local/acharya-refresh-cache.json` for a later run. No video, audio,
transcripts, cookies, or account credentials are downloaded. Review count changes
and unresolved IDs before publishing. This maintainer script is separate from the
authenticated in-app Sync action, which maintains the server catalog.

Neither a refresh nor sync changes historical bookmarks, completion records, or
watched minutes. Video IDs remain the stable progress keys.
