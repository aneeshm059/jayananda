"""Verify display transforms against the supplied PDF, without changing image bytes.

Usage: python scripts/audit-soulful-image-orientation.py /path/to/source.pdf
"""
import hashlib
import json
import sys
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parents[1]
content = json.loads((root / "data/soulful-japa-modules.json").read_text())
manifest = json.loads((root / "data/soulful-japa-image-orientation.json").read_text())
source = Path(sys.argv[1])
assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest["sourceSha256"] == content["source"]["sha256"]
reader = PdfReader(source)


def multiply(a, b):
    return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3],
            a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
            a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]


placements = {}
for number, page in enumerate(reader.pages, 1):
    stack, figures, matrix = [], [], [1, 0, 0, 1, 0, 0]
    assert page.rotation == 0, "Re-audit rotated source pages"
    for operands, operator in ContentStream(page.get_contents(), reader).operations:
        if operator == b"q":
            stack.append(matrix[:])
        elif operator == b"Q":
            matrix = stack.pop()
        elif operator == b"cm":
            matrix = multiply([float(x) for x in operands], matrix)
        elif operator == b"Do":
            obj = page["/Resources"]["/XObject"][operands[0]]
            assert obj["/Subtype"] == "/Image", "Re-audit nested form XObjects"
            a, b, c, d, e, f = matrix
            assert b == c == 0, "Re-audit skewed images"
            height = float(page.mediabox.height)
            box = [min(e, e+a), height-max(f, f+d), max(e, e+a), height-min(f, f+d)]
            figures.append((matrix[:], box))
    placements[number] = figures

verified = []
for module in content["modules"]:
    for block in module["blocks"]:
        if block["type"] != "image":
            continue
        matches = [matrix for matrix, box in placements[block["page"]]
                   if all(abs(x-y) < .02 for x, y in zip(box, block["bbox"]))]
        assert len(matches) == 1, block["src"]
        a, b, c, d, e, f = matches[0]
        assert a > 0 and d < 0 and b == c == 0, block["src"]
        asset = root / "public" / block["src"].lstrip("/")
        assert hashlib.sha256(asset.read_bytes()).hexdigest() == block["sha256"]
        verified.append(block["src"])
assert verified == manifest["flipY"] and len(verified) == 195
print("Verified all 195 original image hashes, exact PDF placements and vertical reflections.")
