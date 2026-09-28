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

The Prabhupada selection contains one verified English lecture from
[The Acharya](https://www.youtube.com/@TheAcharya1), channel ID
`UCDTX-lo7YZCg_P28_Mo4NOg`:

- [Knowledge | Srila Prabhupada English Lecture](https://www.youtube.com/watch?v=V6hmXsFUy2w)

This is an editorial selection, not a complete course or a claim about the
channel's full catalog. YouTube oEmbed confirms the title, author name, and
author handle. oEmbed does not supply duration, so its duration is deliberately
absent from the saved catalog.

The catalog is English-only. `englishPrabhupadaSelections` is the shared verified
allowlist for the saved catalog and refresh script; it contains only the lecture
above. Any addition requires an English-language source review. The refresh
rejects a changed title instead of silently accepting a changed selection. The
two previous Hindi selections are removed from discovery and future refreshes.
Historical user bookmarks, completions, and watched minutes are not deleted or
filtered when a video leaves the catalog.

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

Install `yt-dlp` separately, or set `YTDLP_BIN` to an existing executable; `curl`
must also be available. From the repository root, run:

```sh
npx tsx scripts/refresh-learning-catalog.ts --check
npx tsx scripts/refresh-learning-catalog.ts
```

The first command fetches and validates without writing. The second fetches both
complete public playlists using yt-dlp's metadata-only mode and checks the English
Prabhupada allowlist with YouTube oEmbed. It requires no API key, account cookies,
or media download. yt-dlp is a maintenance prerequisite, not an application runtime
dependency. Public metadata extraction can change; this is not a claim that
YouTube guarantees the extraction format as a stable API.

The script rejects wrong owners, empty results, missing continuation entries,
unavailable videos, and invalid IDs or durations. Every source must pass before
the saved catalog is replaced. A failure leaves the existing snapshot intact.
Review the resulting source diff and this document's snapshot counts after a
refresh. It never commits, pushes, deploys, or changes a remote playlist.

## Playback progress

YouTube's [IFrame API](https://developers.google.com/youtube/iframe_api_reference)
supports elapsed seconds through `getCurrentTime`, state changes, and cueing or
seeking a video to a saved position. The application owns its progress records;
embedding does not provide access to the user's YouTube watch history. Restore a
saved video and timestamp through a visible Resume action, account for keyframe
seek precision, and handle browsers blocking autoplay. Learning progress is not
evidence that the user watched attentively.
