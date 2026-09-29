# Learning catalog

The application ships its own verified video metadata in `lib/domain/learning-catalog.ts`.
Browsing the learning catalog needs no YouTube Data API key. Playback uses the
original YouTube videos and still requires an internet connection and a video
that permits embedding. No video files, audio, or transcripts are bundled.

## Sources

Metadata was checked on 28 September 2026 against public YouTube playlist data.
The channel is [ISKCON Bangalore Sanga](https://www.youtube.com/@iskconbangaloresanga),
ID `UCaL10tuZXQpURxqH2o1C2Jw`.

| Course                                     | Public playlist                                                                                  | Official attribution                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soulful Japa                               | [SOULFUL JAPA SESSION](https://www.youtube.com/playlist?list=PLKVQRAZMT7-kNyVocJzO1MXqsvimBMOMy) | [ISKCON Bangalore](https://www.iskconbangalore.org/soulful-japa/) and [Madhu Pandit Dasa](https://www.madhupanditdasa.com/contribution/soulful-japa) |
| Krishna Consciousness Happiness & Pleasure | [YouTube playlist](https://www.youtube.com/playlist?list=PLKVQRAZMT7-k1hMlGnAmNT8uMpfw68HNO)     | [ISKCON Bangalore](https://www.iskconbangalore.org/happiness-and-pleasure/)                                                                          |

Both playlist IDs appear in the respective official temple pages' embedded
players. Their speaker is Madhu Pandit Dasa. The official Soulful Japa introduction
describes progressive learning. Its historical plan for 108 written modules is
not a statement about the present number of unique YouTube videos.

The Prabhupada library uses [The Acharya](https://www.youtube.com/@TheAcharya1),
channel ID `UCDTX-lo7YZCg_P28_Mo4NOg`. Its separate metadata snapshot is in
`lib/domain/acharya-catalog.snapshot.json`. The library admits only English
lectures with a verified duration from **1,800 through 2,700 seconds** inclusive.
The length filter applies to Prabhupada lectures, not the two guided series.

Original/default audio-language metadata or the original automatic-caption
language establishes the spoken language. Translated or manually uploaded English
subtitles and Latin-script titles alone do not. An explicit publisher title such
as “English Lecture” is also accepted unless audio evidence contradicts it. Unknown
language, Hindi labels, known non-English audio, unavailable recordings, and videos
that disallow embedding are excluded. This is metadata-based classification, not
a claim that every minute of every recording was independently listened to.

The older short English selection and Hindi selections are no longer offered.
Historical bookmarks, completions, and watched minutes remain intact even when a
video leaves discovery. Each video retains its YouTube ID; syncing new metadata
never edits personal learning progress.

The existing Soulful Japa and Happiness & Pleasure metadata contain no videos
labeled Hindi. This is a metadata review, not a new audio-language audit of all
121 recordings. A refresh rejects any newly Hindi-labeled playlist entry for
manual review instead of adding it to the English catalog.

## Learning order and completeness

The complete Soulful Japa playlist response contains **119 source positions and
100 unique video IDs**. Nineteen positions repeat videos already in the playlist.
The unique videos include sessions **1 through 98**, a second distinct recording
also titled **Session 97**, and one unnumbered training talk. The learning queue preserves
both Session 97 recordings adjacent to each other, then continues to Session 98.
The unnumbered training talk comes last. It does not invent sessions 99–108.

The Happiness & Pleasure playlist contains **21 source positions and 21 unique
videos**, labeled Sessions 1 through 21.

The catalog uses these rules:

1. Keep each real video ID once; retain its exact source title and duration.
2. Order numbered videos by their explicit **video session** number. If the same
   session has explicit part numbers, use those part numbers and retain every part.
3. Keep distinct recordings with the same session and part labels in source order.
4. Place unnumbered supplements after the numbered course, in source order.
5. Store `position` as one-based learning order. `sourcePosition` is the first
   one-based source playlist position; `sourcePositions` records every occurrence
   when a video is repeated. `sessionNumber` comes only from the title's session label.

Written-module numbers differ from video-session numbers and are never used to
sort videos. This matters for multipart videos and later revisits of earlier
modules. The publisher's playlist has some repeats and out-of-sequence sessions;
the saved provenance makes the learning queue's changes traceable.

Sample current playlist durations: Soulful Japa Session 1 is **15:09**, Session 2
is **37:27**, and Session 3 is **42:57**. Happiness & Pleasure Session 1 is **54:10**.
An older course website lists a different introductory lecture at 31:40; that
duration is not substituted for the actual playlist video.

Soulful Japa uses the user's requested 30-minute daily target. Happiness & Pleasure
and the Prabhupada selection also start at an adjustable 30-minute target. These
are listening-plan settings, not source metadata or requirements from the speaker.

## Refreshing

Install `yt-dlp` separately, or set `YTDLP_BIN` to an existing executable. From the repository root, run:

```sh
npx tsx scripts/refresh-learning-catalog.ts --check
npx tsx scripts/refresh-learning-catalog.ts
```

The first command fetches and validates without writing. The second fetches both
complete public playlists using yt-dlp's metadata-only mode. It preserves the
separate Acharya snapshot rather than restoring the old one-video selection. It requires no API key, account cookies,
or media download. yt-dlp is a maintenance prerequisite, not an application runtime
dependency. Public metadata extraction can change; this is not a claim that
YouTube guarantees the extraction format as a stable API.

The script rejects wrong owners, empty results, missing continuation entries,
unavailable videos, and invalid IDs or durations. Every source must pass before
the saved catalog is replaced. A failure leaves the existing snapshot intact.
Review the resulting source diff and this document's snapshot counts after a
refresh. It never commits, pushes, deploys, or changes a remote playlist.

## In-app Acharya sync

Authenticated readers can select **Sync lectures** in the Prabhupada window.
`GET /api/lectures/acharya` reads the latest published catalog, falling back to the
bundled verified snapshot. `POST` with `{ "action": "sync" }` advances one bounded
chunk of the channel scan. Requests accept no user-supplied source URLs, channel
IDs, video IDs, or pagination cursors. The source is fixed on the server.

The server follows upload-page continuations and checks duration-eligible watch
metadata. Cached classifications limit repeated requests. It stages a complete
scan before publishing; interrupted or failed scans retain the previous catalog.
The UI reports progress and can pause/resume. Sync never downloads video, audio,
or transcripts and needs no personal YouTube credentials or API key. YouTube's
public metadata format and throttling are outside this app's control; a failed
request is reported and can be retried, rather than shown as a successful sync.

The first library keeps publisher upload order. Existing published lectures keep
their queue positions, and newly found matching lectures are appended. Removed
or disqualified videos leave discovery without deleting personal progress. The
two guided series retain all their lessons in session order.

## Playback progress

YouTube's [IFrame API](https://developers.google.com/youtube/iframe_api_reference)
supports elapsed seconds through `getCurrentTime`, state changes, and cueing or
seeking a video to a saved position. The application owns its progress records;
embedding does not provide access to the user's YouTube watch history. Restore a
saved video and timestamp through a visible Resume action, account for keyframe
seek precision, and handle browsers blocking autoplay. Learning progress is not
evidence that the user watched attentively.

The iframe is prepared on opening a lesson. A user's Play click calls the ready
player directly instead of waiting for script/iframe creation after the click.
Bookmark restoration cues the saved timestamp without triggering autoplay.
Natural video completion saves the completed state and offers **Next lecture** or
**Next lesson**; the next video waits for a deliberate Play action. Manual marks
and seeks do not manufacture watched minutes. The Japa instruction form appears
only in Soulful Japa.
