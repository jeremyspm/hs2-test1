# Phase 1a sidecar — PDF text extraction.
# Node has no PDF reader; PyMuPDF does it faithfully. Writes pdf-units.json which
# build-corpus.mjs merges into the corpus. Extraction only — no interpretation.
#
#   python audit/extract-pdfs.py
import os, re, json, sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF not installed:  pip install pymupdf")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INBOX = os.path.join(os.path.dirname(ROOT), "_inbox")
# Both roots — the 2026 export, and the restored legacy archive that holds the
# 30-question `MODULE 1 : Formative Test` cited by 20 cards.
ROOTS = [
    os.path.join(INBOX, "Health Science 2 Export Module 1"),
    os.path.join(INBOX, "HEALTH SCIENCE 2"),
]

out, empty = [], []
for dp, _, fs in ((dp, d, f) for r in ROOTS for dp, d, f in os.walk(r)):
    for f in sorted(fs):
        if not f.lower().endswith(".pdf"):
            continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, os.path.dirname(ROOT)).replace("\\", "/")
        try:
            doc = fitz.open(p)
        except Exception as e:
            empty.append({"file": rel, "why": f"open failed: {e}"})
            continue
        pages = 0
        for i, page in enumerate(doc, 1):
            t = re.sub(r"\s+", " ", page.get_text("text")).strip()
            if t:
                out.append({"file": rel, "loc": f"page {i}", "t": t})
                pages += 1
        # A PDF of scanned slides yields no text layer. Say so rather than let it
        # silently contribute nothing and look like it was covered. A PARTIAL
        # extraction is the more dangerous case — it looks like success — so it is
        # reported too.
        if pages == 0:
            empty.append({"file": rel, "why": f"no text layer ({doc.page_count} pages) — scanned/image PDF"})
        elif pages < doc.page_count:
            empty.append({"file": rel, "why": f"PARTIAL: text on {pages}/{doc.page_count} pages"})
        doc.close()

json.dump({"units": out, "empty": empty},
          open(os.path.join(HERE, "pdf-units.json"), "w", encoding="utf-8"),
          ensure_ascii=False)

files = len({u["file"] for u in out})
print(f"{len(out)} page-units from {files} PDFs, {sum(len(u['t']) for u in out):,} chars")
for e in empty:
    print(f"  ! {e['file']} — {e['why']}")
