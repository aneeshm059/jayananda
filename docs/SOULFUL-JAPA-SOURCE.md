# Soulful Japa written source

The reader is extracted from the user's supplied **583-page** PDF,
`579297831-Soulful-Japa-Modules (2).pdf`, titled **SOULFUL JAPA | MODULES**.
The main module posts are attributed in the document to **Madhu Pandit Dasa**.
Quoted authors, signed group messages, and other contributors retain their
attributions in the body; this is not a claim that every included sentence has
the same author.

Source SHA-256:

```text
cc6c7af5b5623282d4ff7958b99569e8a0c5482d756658ea8ccb45480c448bbc
```

The document is a captured Telegram export, not a consistently typeset book.
The extraction preserves its words, spelling, punctuation, URLs, printed
placeholders, duplicated material, and mixed Sanskrit encodings. It adds no
summaries, replacement prose, corrected quotations, or invented missing modules.

## Structure preserved

- **106 numbered module entries**, with **149 printed module/part headings**.
  Parts of a base number remain together, in their original order.
- **38 and 42 are absent as numbered body headings.** The source's own index
  and later references sometimes assign different numbers. These discrepancies
  are preserved rather than reconciled.
- The source prints **Module 39/3** on page 194, **Module 40/4** on page 199,
  and **Module 40** on page 202. Both printed Module 40 sections belong to the
  same base-number entry. Part numbers are not silently renumbered.
- **Module 58/2** on page 271 has no body before Module 59. Its heading remains.
  Several later modules, including 83–90, contain title/placeholder posts such
  as `b`, `bl`, or `blank`. Those are printed source content, not extraction errors.
- **22 supplementary entries** retain the cue-card collection, practice
  instructions, all 16 weekly practice sections, the original index, a book-cover
  image, a letter, and announcements through page 583. No Module 109 is invented.
- **195 substantive image placements** are preserved, including repeated
  diagrams and cue cards. The original embedded image bytes are extracted
  without OCR, resampling, redrawing, or substituting screenshots of text pages.
  Twenty small Telegram attachment-icon placements are documented as interface
  decoration and excluded.

Module 108 ends on page 419 before **SIXTEEN BHAAVANAS FOR 16 MALAS OF SOULFUL
JAPA**, where the cue-card supplement begins. The index is retained independently
on pages 573–580, including its numbering discrepancies. The cover image on page
581 precedes the separately headed letter. Pages 582–583 remain available as
source announcements.

## Reader data and provenance

`data/soulful-japa-modules.json` contains:

- `source`: checksum, version, title, main author attribution, page count,
  extraction rules, numbering anomalies, and the complete printed-heading inventory.
- `modules`: a single ordered array. A module has `kind: "module"`, its printed
  base `number`, and stable ID such as `sj-module-001`. A supplement has
  `kind: "supplement"`, `number: null`, and a stable `sj-supplement-*` ID.
- Each entry retains `label`, `title`, `startPage`, `endPage`, and ordered `blocks`.
  Block types are `paragraph`, `heading`, `verse`, `quote`, and `image`.
  Every block has a one-based source `page` and a PDF-coordinate bounding box.
  Image blocks reference `/soulful-japa/` assets and retain their byte checksum
  and native pixel dimensions.
- `audit.pages`: a record for every page, with source/body character counts and
  SHA-256 values, excluded metadata fragments and their reasons/coordinates,
  image placements, and the page's coverage result. This audit is provenance;
  it is not added to the reader's prose.

Titles are taken from the printed module starts, not rewritten from the later
index. Where a supplement has no textual heading, its transparent navigation
label says **Source page…** or **Source pages…**; it is not attributed to the
author as a title. Source repetitions are retained as separate occurrences.

## Extraction rules

The script reads the existing PDF with `pdfplumber` and `pypdf`; it does not
modify the PDF. Text is ordered geometrically by source page and line. Source
paragraph gaps and text rendering mode are used for grouping. Acrobat often
uses synthetic bold with the same font name; the script reads the PDF's fill and
stroke text mode to distinguish it. Later pages use plain type without reliable
title/body gaps, so audited source-line counts delimit titles. They select
existing text and never create replacement wording.

Only whitespace changes are permitted in body text: wrapped prose lines are
joined, verse line breaks are retained, and a lower-case continuation after a
printed hyphen is joined without inserting a word space. At font boundaries,
literal PDF space characters are preferred when the source character order
already matches the geometric line. This avoids extraction artifacts such as
splitting `But` into `B ut`. Paragraphs may continue as a new block on the next
source page so references remain exact.

The following interface/export material is separated into audit metadata:

1. `Exported Data` and the captured browser's local-file footer at the outer
   page margin. This excludes no module prose or visible source URLs in the body.
2. Telegram sender/avatar initials, date separators, message timestamps, and
   forwarding/sender attribution displayed with the interface's source colors.
3. Attachment duration/file-size interface labels and reply/pinned-message
   interface indicators. Attachment titles and body text remain available.
4. The first document/course title is retained as source metadata.

Body signatures, source quotations, substantive headings, `END`, repeated
course headings, printed placeholders, and Telegram/YouTube URLs are retained.
Mojibake printed by the source, including `Ädi` and `Puräëa`, is not silently
converted to another transliteration. Original figures retain any text already
inside their image pixels; no speculative transcription is introduced.

## Reproducing and checking

Use a Python environment containing `pdfplumber` and `pypdf`:

```sh
python scripts/extract-soulful-japa.py /path/to/579297831-Soulful-Japa-Modules.pdf
```

The input filename may differ, but its SHA-256 must match the audited source.
The script writes the JSON dataset and original image assets, and aborts on an
unexpected heading count, missing-module set, figure count, or coverage failure.
An optional `--layout-cache` uses an ignored local layout cache for development;
omit it to perform a fresh PDF read.

Every retained non-whitespace character must match the extracted source page in
the same order. Each page also accounts for every excluded metadata character.
An independent audit compared the emitted data directly against all 583 PDF
pages, all 149 printed heading/page pairs, and the original bytes of all 195
substantive image placements. Representative original pages and module/appendix
boundaries were rendered for visual review. Regression checks live in
`tests/soulful-content.test.ts`.

The source PDF and extracted reading content are independent of personal reading
progress. Rebuilding this dataset does not edit accounts, bookmarks, completion
records, or database state.
