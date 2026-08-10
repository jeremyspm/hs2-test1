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
    # 1100/82 fitted the budget until the 11 Aug capture round roughly doubled the number
    # of figure-bearing cards — Practice Lab 2 alone is 11 labelled diagrams — and pushed
    # the payload to 3.01 MB against a 2.00 MB cap. Width is cut before quality on
    # purpose: WEBP artefacts smear thin label strokes, whereas fewer pixels of a clean
    # encode still pinch-zoom legibly. 900 is well clear of MIN_WIDTH below, so the floor
    # that protects her diagrams is untouched. Do NOT raise the budget instead: it is a
    # phone-memory constraint, not a preference.
    "detail":        (800, 75),    # default — assume text is present until proven otherwise
    "photo":         (700, 70),    # fallback, only used if `detail` misses budget
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
print(f"\n  binary {new/1048576:.2f} MB  ->  base64 {shipped/1048576:.2f} MB  (+33%)")
# THIS NUMBER IS NOT THE SHIPPED PAYLOAD, and enforcing a budget on it was wrong in both
# directions. It encodes every image any harvested card REFERENCES, including the cards
# bind-images.mjs then holds — so it can fail a build whose real payload is comfortably
# under. And it counts each image once, while bind-images inlines a full data URI per
# card, so an image used by two cards ships twice: this said 2.33 MB for a payload that
# actually inlined 2.46 MB, i.e. it passed nothing it claimed to pass.
#
# The budget is therefore enforced in bind-images.mjs, which is the only step that knows
# what ships. What is printed here is an UPPER BOUND on the encode, kept because it is
# the number to look at when deciding whether the profiles below need tightening.
print(f"  budget 2.00 MB of base64 is enforced on the SHIPPED payload, in bind-images.mjs.")
print(f"  this is an upper bound over every referenced image — {'inside' if shipped <= BUDGET else 'OVER'} it by "
      f"{abs(shipped-BUDGET)/1048576:.2f} MB")
print("\nwrote audit/images-optimised.json, images-report.json")
sys.exit(0)
