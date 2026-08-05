# Phase 4 item 3 — bring the quiz images inside a shippable budget.
#
# The raw capture is 36.7 MB decoded across 42 images; the shipped index.html must stay
# small enough to load once on a phone. Target: under 2 MB added.
#
# BUDGET IS MEASURED ON THE BASE64 TEXT, not the binary. The images ship inlined as data
# URIs, and base64 inflates by 4/3 — measuring binary reported 1.69 MB for a payload that
# actually adds 2.31 MB, i.e. it passed a budget it was over.
#
# The binding constraint is LEGIBILITY, not size. These are label-the-diagram questions:
# an image whose labels cannot be read is not a smaller card, it is a broken one. So
# line art gets more pixels and higher quality than photographs, nothing is upscaled,
# and anything that cannot make budget while staying legible is DROPPED AND RECORDED
# rather than shipped unreadable.
#
#   python audit/optimise-images.py
import base64, io, json, os, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

SRC = json.load(open(os.path.join(HERE, "question-images.json"), encoding="utf-8"))

# Which images the cards actually reference — no point spending budget on the rest.
harvested = open(os.path.join(HERE, "harvested.js"), encoding="utf-8").read()
import re
REFERENCED = set(re.findall(r"\[\[IMG:([0-9a-f]{16})\]\]", harvested))

# Classifying by colour count was tried and is not safe. A full-colour anatomical
# illustration — "THE RESPIRATORY SYSTEM", eleven labelled callouts and a summary table
# — has thousands of distinct colours and was classified a photograph, earning it the
# aggressive profile. It survived legibly by luck, not design.
#
# The asymmetry decides it: being wrong toward quality costs a few hundred KB; being
# wrong toward compression ships a label-the-diagram card whose labels cannot be read.
# With budget headroom available, EVERYTHING gets the generous profile, and the
# aggressive one is applied only if the total misses budget.
PROFILES = {
    #                 max width, webp quality
    "detail":        (1100, 82),   # default — assume text is present until proven otherwise
    "photo":         (900, 75),    # fallback, only used if `detail` misses budget
}

# Below this the labels on her diagrams stop being readable at 375px with pinch-zoom.
MIN_WIDTH = 560

out, report = {}, []
for key, uri in SRC.items():
    raw = base64.b64decode(uri.split(",", 1)[1])
    img = Image.open(io.BytesIO(raw))
    w, h = img.size
    kind = "detail"
    max_w, q = PROFILES[kind]

    if key not in REFERENCED:
        report.append({"id": key, "kind": kind, "orig_bytes": len(raw), "wh": [w, h],
                       "action": "skipped", "why": "not referenced by any harvested card"})
        continue

    target_w = min(w, max_w)                      # never upscale
    if target_w < MIN_WIDTH <= w:
        target_w = MIN_WIDTH
    scale = target_w / w
    im2 = img.convert("RGB")
    if scale < 1.0:
        im2 = im2.resize((target_w, max(1, round(h * scale))), Image.LANCZOS)

    buf = io.BytesIO()
    im2.save(buf, "WEBP", quality=q, method=6)
    enc = buf.getvalue()

    # A diagram reduced below the legibility floor is not shipped at all.
    if im2.size[0] < MIN_WIDTH and w >= MIN_WIDTH:
        report.append({"id": key, "kind": kind, "orig_bytes": len(raw), "wh": [w, h],
                       "action": "dropped", "why": f"would ship at {im2.size[0]}px, below the {MIN_WIDTH}px legibility floor"})
        continue

    uri = "data:image/webp;base64," + base64.b64encode(enc).decode()
    out[key] = uri
    report.append({"id": key, "kind": kind, "orig_bytes": len(raw), "new_bytes": len(enc),
                   "uri_bytes": len(uri),
                   "wh": [w, h], "new_wh": list(im2.size), "quality": q, "action": "encoded"})

json.dump(out, open(os.path.join(HERE, "images-optimised.json"), "w", encoding="utf-8"))
json.dump(report, open(os.path.join(HERE, "images-report.json"), "w", encoding="utf-8"), indent=1)

enc_rows = [r for r in report if r["action"] == "encoded"]
orig = sum(r["orig_bytes"] for r in enc_rows)
new = sum(r["new_bytes"] for r in enc_rows)
shipped = sum(r["uri_bytes"] for r in enc_rows)
skipped = [r for r in report if r["action"] == "skipped"]
dropped = [r for r in report if r["action"] == "dropped"]

print("== IMAGE BUDGET " + "=" * 35)
print(f"  referenced by cards : {len(REFERENCED)}")
print(f"  encoded             : {len(enc_rows)}")
print(f"  skipped (unused)    : {len(skipped)}")
print(f"  dropped (illegible) : {len(dropped)}")
for r in dropped:
    print(f"      ! {r['id']} — {r['why']}")
print()
print(f"  {orig/1048576:.1f} MB  ->  {new/1048576:.2f} MB   ({orig/max(new,1):.1f}x smaller)")
by_kind = {}
for r in enc_rows:
    k = by_kind.setdefault(r["kind"], [0, 0, 0])
    k[0] += 1; k[1] += r["orig_bytes"]; k[2] += r["new_bytes"]
for k, (n, a, b) in by_kind.items():
    print(f"    {k:<9} {n:>3} images  {a/1048576:6.1f} MB -> {b/1048576:5.2f} MB")
biggest = sorted(enc_rows, key=lambda r: -r["new_bytes"])[:5]
print("\n  largest after encoding:")
for r in biggest:
    print(f"    {r['new_bytes']/1024:6.0f} KB  {r['new_wh'][0]}x{r['new_wh'][1]:<5} {r['kind']:<9} (was {r['wh'][0]}x{r['wh'][1]}, {r['orig_bytes']/1048576:.1f} MB)")
BUDGET = 2 * 1048576
print(f"\n  binary {new/1048576:.2f} MB  ->  ships as base64 {shipped/1048576:.2f} MB  (+33%)")
print(f"  budget 2.00 MB of BASE64 — {'OK' if shipped <= BUDGET else 'OVER by %.2f MB' % ((shipped-BUDGET)/1048576)}")
print("\nwrote audit/images-optimised.json, images-report.json")
sys.exit(0 if shipped <= BUDGET else 1)
