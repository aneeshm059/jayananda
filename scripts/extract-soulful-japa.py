#!/usr/bin/env python3
"""Extract the supplied Soulful Japa PDF without rewriting any source words.

Requires pdfplumber and pypdf. The source PDF itself is never modified.
Usage: python extract-soulful-japa.py /path/to/source.pdf [--layout-cache PATH]
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path

import pdfplumber
from pypdf import PdfReader
from pdfminer.converter import PDFLayoutAnalyzer
from pdfminer.pdfdevice import PDFTextDevice

EXPECTED_SHA256 = "cc6c7af5b5623282d4ff7958b99569e8a0c5482d756658ea8ccb45480c448bbc"
VERSION = "2026-10-03-v1"
GRAY = "(0.439, 0.467, 0.482)"
BLUE = "(0.22, 0.573, 0.859)"
WHITE = "(1.0,)"
# Audited against each printed module start. Most titles occupy one source line.
# The document switches to plain text without title/body spacing around page 89;
# these line counts preserve wrapped titles without mistaking prose for a title.
TITLE_LINE_COUNTS = {
    "9": 2, "18": 2, "21": 2, "22/3": 3, "23/1": 2,
    "24/2": 2, "24/3": 2, "25": 2, "31/2": 2, "31/3": 2,
    "31/5": 2, "31/8": 2, "31/10": 2, "39/3": 2, "40": 3,
    "58/2": 0, "62": 2, "64": 2, "68/1": 2, "68/2": 2,
    "68/6": 2, "72/3": 2, "73": 2, "94/2": 0, "95/1": 2,
    "99": 2, "100": 2, "101": 2, "102": 2, "104": 2,
}

# Acrobat uses fill+stroke text (render mode 2) for synthetic bold while keeping
# the same Lucida font name. Preserve that source signal before pdfplumber drops it.
_original_render_string = PDFTextDevice.render_string
_original_render_char = PDFLayoutAnalyzer.render_char


def _render_string(self, textstate, *args):
    self._soulful_render_mode = textstate.render
    return _original_render_string(self, textstate, *args)


def _render_char(self, *args):
    result = _original_render_char(self, *args)
    self.cur_item._objs[-1]._soulful_render_mode = getattr(self, "_soulful_render_mode", 0)
    return result


PDFTextDevice.render_string = _render_string
PDFLayoutAnalyzer.render_char = _render_char


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def without_space(text):
    return re.sub(r"\s+", "", text)


def join_lines(lines, preserve_breaks=False):
    if preserve_breaks:
        return "\n".join(lines)
    result = lines[0]
    for line in lines[1:]:
        result += ("" if result.endswith("-") and line[:1].islower() else " ") + line
    return result


def layout(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            lines = []
            render_modes = {}

            def record_modes(item):
                if hasattr(item, "_soulful_render_mode"):
                    render_modes[(round(item.x0, 3), round(item.y0, 3), item.get_text())] = item._soulful_render_mode
                for child in getattr(item, "_objs", []):
                    record_modes(child)

            record_modes(page.layout)
            for index, char in enumerate(page.chars):
                char["source_index"] = index
            for line in page.extract_text_lines(layout=False, strip=True):
                chars = line.pop("chars")
                indices = {char["source_index"] for char in chars}
                first_index, last_index = min(indices), max(indices)
                # Synthetic italic metrics can overlap at a font boundary, so
                # geometric word extraction occasionally turns "But" into
                # "B ut". Prefer literal PDF spaces only when all non-space
                # characters already match the geometric reading order exactly.
                source_text = "".join(char["text"] for index, char in enumerate(page.chars)
                    if index in indices or (first_index <= index <= last_index
                        and char["text"].isspace()
                        and line["top"] - 3 <= char["top"] <= line["bottom"] + 3))
                line["spaceSource"] = "geometry"
                if without_space(source_text) == without_space(line["text"]):
                    line["text"] = re.sub(r"\s+", " ", source_text).strip()
                    line["spaceSource"] = "literal PDF spaces"
                modes = [render_modes[(round(c["x0"], 3), round(c["y0"], 3), c["text"])] for c in chars]
                line["boldRatio"] = sum(mode in (1, 2, 5, 6) for mode in modes) / max(len(modes), 1)
                line["fonts"] = sorted({c["fontname"] for c in chars})
                line["sizes"] = sorted({round(c["size"], 3) for c in chars})
                line["colors"] = sorted({str(c.get("non_stroking_color")) for c in chars})
                line["words"] = [{k: w[k] for k in ["text", "x0", "x1", "top", "bottom"]}
                    for w in pdfplumber.utils.extract_words(chars, x_tolerance=2, y_tolerance=3,
                                                          expand_ligatures=False)]
                lines.append(line)
            images = [{k: v for k, v in image.items() if k in
                       ["x0", "x1", "top", "bottom", "width", "height", "name", "srcsize", "imagemask"]}
                      for image in page.images]
            pages.append({"page": number, "width": page.width, "height": page.height,
                          "lines": lines, "images": images, "charCount": len(page.chars)})
            if number % 50 == 0:
                print(f"Read layout: {number}/{len(pdf.pages)}", flush=True)
            page.close()
    return pages


def chrome(line, page):
    """Return (body text, excluded UI fragments); never normalize source spelling."""
    text = line["text"]
    colors = set(line["colors"])
    reason = None
    if line["x0"] < 20 and (line["top"] < 20 or line["top"] > 770):
        reason = "PDF web-export header/footer"
    elif page == 1 and text == "SOULFUL JAPA | MODULES":
        reason = "Document title retained in source metadata"
    elif colors == {WHITE} and line["x0"] < 210:
        reason = "Telegram sender avatar initials"
    elif BLUE in colors:
        reason = "Telegram sender attribution and timestamp"
    elif colors == {GRAY}:
        reason = "Telegram date, timestamp, or attachment duration/size"
    elif GRAY in colors and ("pinned this message" in text or "In reply to this message" in text):
        reason = "Telegram message relationship indicator"
    if reason:
        return "", [{"text": text, "reason": reason}]
    if GRAY in colors:
        # These are right-aligned timestamps sharing a baseline with body text.
        # Some touch the final body word; remove only the printed HH:MM suffix.
        match = re.search(r"\d{2}:\d{2}$", text)
        if match:
            return text[:match.start()].rstrip(), [{"text": match.group(), "reason": "Telegram inline timestamp"}]
        raise ValueError(f"Unclassified mixed UI/body line on page {page}: {text!r}")
    return text, []


def module_heading(text, page):
    if page > 414:
        return None
    match = re.fullmatch(r"Module\s+(\d{1,3})(?:/\s*(\d+))?\s*", text)
    if not match:
        match = re.match(r"^Module\s+(9[345])/\s*(1)\s+Practice of [Bb]haavana for Mala [123]\s*$", text)
    return (int(match[1]), int(match[2]) if match[2] else None) if match else None


def source_bbox(item):
    return [round(item[k], 3) for k in ["x0", "top", "x1", "bottom"]]


def verse_line(text):
    if len(text) > 70 or len(text.split()) > 8:
        return False
    if re.match(r"^(?:Hare|Krishna|Rama)(?:\s+(?:Hare|Krishna|Rama)){3,}", text):
        return True
    if re.search(r"[\u0900-\u097f]", text):
        return True
    return bool(re.match(r"^[‘'’a-zāīūṛśṣṅñṇṭḍ]", text) and
                (re.search(r"[āīūṛṅñṇṭḍśṣṃḥ]", text) or text.count("-") >= 2) and
                not re.search(r"[.!?]\s*$", text))


def extract(pdf_path, pages, output, asset_dir):
    reader = PdfReader(pdf_path)
    modules = []
    current = None
    pending = []
    expect_title = False
    title_pending = False
    title_lines_remaining = 0
    source_headings = []
    page_audit = []
    figure_count = 0
    icon_count = 0
    seen_weeks = set()
    previous_page = None

    def flush():
        nonlocal pending, title_pending, expect_title
        if not pending:
            return
        assert current is not None
        first = pending[0]
        is_title = first.get("titleLine", False)
        is_heading = first.get("heading", False) or is_title
        kind = "heading" if is_heading else "verse" if first.get("verse", False) else "paragraph"
        if kind == "paragraph" and re.match(r'^[“”"\[]', first["text"]):
            kind = "quote"
        text = join_lines([item["text"] for item in pending], kind == "verse")
        block = {"type": kind, "text": text, "page": first["page"],
                 "bbox": [first["x0"], first["top"], max(p["x1"] for p in pending), pending[-1]["bottom"]]}
        block["bbox"] = [round(value, 3) for value in block["bbox"]]
        if kind == "heading":
            block["level"] = 2 if first.get("moduleHeading") else 3
        current["blocks"].append(block)
        if is_title:
            if title_pending:
                current["title"] = text
                title_pending = False
            expect_title = False
        pending = []

    def start_entry(identifier, number, title, label, page, kind):
        nonlocal current, title_pending, expect_title
        flush()
        current = {"id": identifier, "kind": kind, "number": number, "label": label,
                   "title": title, "startPage": page, "endPage": page, "blocks": []}
        modules.append(current)
        title_pending = kind == "module"
        expect_title = False

    def supplement_for(text, page):
        if page == 419 and text == "SIXTEEN BHAAVANAS FOR 16 MALAS OF SOULFUL JAPA":
            return "cue-cards", text
        if page == 429 and text.startswith("16 WEEKS PRACTICE SESSIONS-"):
            return "practice-instructions", text
        if 431 <= page <= 572:
            match = re.match(r"^WEEK\s+(\d+)\b", text)
            if match and int(match[1]) not in seen_weeks:
                number = int(match[1])
                seen_weeks.add(number)
                return f"week-{number:02d}", text
        if page == 573 and text == "INDEX / CONTENTS":
            return "index", text
        if page == 581 and text == "A Letter from Srila Bhaktisiddhanta Sarasvati Thakura":
            return "letter", text
        return None

    for page in pages:
        number = page["page"]
        flush()  # Page references remain exact, even when a paragraph continues.
        excluded = []
        body_lines = []
        raw_text = "".join(line["text"] for line in page["lines"])
        for line in page["lines"]:
            body, removed = chrome(line, number)
            for item in removed:
                excluded.append({**item, "bbox": source_bbox(line)})
            if body:
                # Module 96's title and opening quotation share a printed line.
                # Split at the actual opening quotation; retain every character.
                if number == 398 and body.startswith('Contemplation for Priti or I OFFER WITH LOVE - "'):
                    index = body.index('"')
                    body_lines.extend([{**line, "text": body[:index].rstrip(), "page": number},
                                       {**line, "text": body[index:], "page": number}])
                else:
                    body_lines.append({**line, "text": body, "page": number})
        actual_chars = collections.Counter(without_space(raw_text))
        classified_chars = collections.Counter(without_space("".join(l["text"] for l in body_lines) + "".join(m["text"] for m in excluded)))
        assert actual_chars == classified_chars, f"Unaccounted source characters on page {number}"
        expected_body = without_space("".join(line["text"] for line in body_lines))
        events = [(line["top"], 1, line) for line in body_lines]
        page_images = []
        for occurrence, figure in enumerate(page["images"], 1):
            if max(figure["srcsize"]) <= 40:
                icon_count += 1
                page_images.append({"excluded": "Telegram attachment icon", "bbox": source_bbox(figure)})
                continue
            events.append((figure["top"], 0, {**figure, "occurrence": occurrence}))
        events.sort(key=lambda event: (event[0], event[1]))
        for _, event_type, item in events:
            if number == 582 and (current is None or current["id"] != "sj-supplement-announcements"):
                start_entry("sj-supplement-announcements", None, "Source pages 582–583", "Source pages 582–583", number, "supplement")
            if event_type == 0:
                flush()
                if number == 581 and current["id"] == "sj-supplement-index":
                    start_entry("sj-supplement-cover", None, "Source page 581", "Source page 581", number, "supplement")
                assert current is not None
                image = reader.pages[number - 1].images[f"/{item['name']}"]
                suffix = Path(image.name).suffix.lower()
                filename = f"page-{number:03d}-figure-{item['occurrence']:02d}{suffix}"
                (asset_dir / filename).write_bytes(image.data)
                image_hash = hashlib.sha256(image.data).hexdigest()
                block = {"type": "image", "text": "", "page": number,
                         "src": f"/soulful-japa/{filename}", "alt": f"Source figure, PDF page {number}",
                         "width": image.image.width, "height": image.image.height,
                         "bbox": source_bbox(item), "sha256": image_hash}
                current["blocks"].append(block)
                current["endPage"] = number
                page_images.append({"src": block["src"], "sha256": image_hash, "bbox": block["bbox"]})
                figure_count += 1
                continue
            text = item["text"]
            heading = module_heading(text, number)
            supplement = supplement_for(text, number)
            if heading:
                base, part = heading
                source_headings.append({"number": base, "part": part, "text": text, "page": number})
                if current is None or current["number"] != base or current["kind"] != "module":
                    start_entry(f"sj-module-{base:03d}", base, text, f"Module {base}", number, "module")
                else:
                    flush()
                item["heading"] = item["moduleHeading"] = True
                pending.append(item)
                flush()
                inline = re.sub(r"^Module\s+\d+(?:/\s*\d+)?\s*", "", text)
                if inline and title_pending:
                    current["title"] = inline
                    title_pending = False
                key = str(base) + (f"/{part}" if part else "")
                title_lines_remaining = TITLE_LINE_COUNTS.get(key, 1)
                expect_title = title_lines_remaining > 0
                current["endPage"] = number
                continue
            if supplement:
                key, title = supplement
                start_entry(f"sj-supplement-{key}", None, title, title, number, "supplement")
                item["heading"] = True
            if current is None:
                # The first printed course heading precedes Module 1. It is title
                # metadata, not an invented preface and not silently discarded.
                if number == 1 and text == "Soulful Japa":
                    excluded.append({"text": text, "reason": "Course title retained in source metadata", "bbox": source_bbox(item)})
                    continue
                raise ValueError(f"Unassigned content before Module 1: {text!r}")
            current["endPage"] = number
            item["verse"] = verse_line(text) and title_lines_remaining == 0
            if title_lines_remaining:
                item["titleLine"] = True
                title_lines_remaining -= 1
            is_standalone_heading = (text in {"END", "Soulful Japa", "INSTRUCTION", "INSTRUCTIONS", "IN A NUTSHELL", "INDEX / CONTENTS"}
                                     or bool(re.match(r"^(?:WEEK\s+\d+|SUBCUE CARD PRACTICE|MAIN BHAVANA CARD|In a Nutshell:)", text)))
            if is_standalone_heading:
                flush()
                item["heading"] = True
            if pending:
                previous = pending[-1]
                gap = item["top"] - previous["bottom"]
                changes_type = bool(item.get("verse")) != bool(previous.get("verse"))
                title_bold_ended = previous.get("titleLine") and previous.get("boldRatio", 0) > 0.8 and item.get("boldRatio", 0) < 0.8
                audited_title_continuation = item.get("titleLine") and previous.get("titleLine")
                if not audited_title_continuation and (gap > 9 or changes_type or previous.get("heading") or item.get("heading") or title_bold_ended):
                    flush()
                    # A title ends at its printed paragraph break.
                    if not expect_title:
                        item.pop("titleLine", None)
            pending.append(item)
            if item.get("titleLine") and title_lines_remaining == 0:
                flush()
        flush()
        # Compare every retained character, in order, with body blocks for this
        # source page. The only changed characters may be whitespace separators.
        extracted = without_space("".join(block["text"] for entry in modules for block in entry["blocks"] if block["page"] == number))
        if number == 1:
            expected_body = expected_body.removeprefix("SoulfulJapa")
        assert extracted == expected_body, f"Body coverage/order mismatch on page {number}"
        page_audit.append({"page": number, "sourceTextSha256": digest(without_space(raw_text)),
                           "bodyTextSha256": digest(extracted), "sourceCharacters": len(without_space(raw_text)),
                           "bodyCharacters": len(extracted), "excludedMetadata": excluded, "images": page_images,
                           "coverageVerified": True})
    numbers = [module["number"] for module in modules if module["kind"] == "module"]
    assert len(numbers) == 106 and len(set(numbers)) == 106
    assert set(range(1, 109)) - set(numbers) == {38, 42}
    assert len(source_headings) == 149
    assert figure_count == 195 and icon_count == 20
    result = {
        "source": {"sha256": EXPECTED_SHA256, "version": VERSION, "title": "SOULFUL JAPA | MODULES",
                   "author": "Madhu Pandit Dasa", "pageCount": len(pages),
                   "sourceFilename": pdf_path.name,
                   "extraction": "Geometric PDF text extraction; whitespace-only paragraph joins; original embedded figures; no OCR, rewriting, or spelling correction.",
                   "missingModuleNumbers": [38, 42], "moduleHeadingCount": len(source_headings),
                   "numberedModuleCount": len(numbers), "substantiveImageCount": figure_count,
                   "excludedAttachmentIconCount": icon_count,
                   "sourceHeadings": source_headings},
        "modules": modules,
        "audit": {"allPagesVerified": True, "normalization": "Remove Unicode whitespace only for coverage comparison.", "pages": page_audit},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(numbers)} numbered modules, {len(modules)-len(numbers)} supplements, {figure_count} figures; all {len(pages)} pages pass exact character/order coverage.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--layout-cache", type=Path, help="Reuse this source's geometric layout during development; source checksum is still required.")
    parser.add_argument("--output", type=Path, default=Path("data/soulful-japa-modules.json"))
    parser.add_argument("--asset-dir", type=Path, default=Path("public/soulful-japa"))
    args = parser.parse_args()
    actual_hash = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    if actual_hash != EXPECTED_SHA256:
        raise ValueError("This extraction's audited rules apply only to the supplied PDF checksum.")
    pages = json.loads(args.layout_cache.read_text()) if args.layout_cache and args.layout_cache.exists() else None
    if pages is None or "spaceSource" not in pages[0]["lines"][0]:
        pages = layout(args.pdf)
        if args.layout_cache:
            args.layout_cache.parent.mkdir(parents=True, exist_ok=True)
            args.layout_cache.write_text(json.dumps(pages, ensure_ascii=False))
    assert len(pages) == 583
    args.asset_dir.mkdir(parents=True, exist_ok=True)
    extract(args.pdf, pages, args.output, args.asset_dir)


if __name__ == "__main__":
    main()
