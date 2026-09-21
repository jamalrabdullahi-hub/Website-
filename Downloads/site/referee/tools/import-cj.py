"""Pull a product feed from CJdropshipping into data/catalog.csv.

    set CJ_ACCESS_TOKEN=...            (Windows)   /   export CJ_ACCESS_TOKEN=...   (bash)
    python tools/import-cj.py --keywords "power bank,rechargeable fan,women dress" --per 40
    python tools/import-cj.py --dry                 # show what would be written, change nothing

THE TOKEN IS NEVER STORED. It is read from the environment and used only for these calls; it is not written to any
file, not committed, and not printed. Get it from your CJ account under Authorization → API, and keep it out of chat
and out of the repo. If it ever appears in either, revoke it in the CJ console and issue a new one.

Why CJ is worth having alongside 1688 and Made-in-China:
  * every product is MOQ 1 by design — it is a dropshipping catalogue, so it fills the consumer shop rather than
    the wholesale side
  * prices are real and visible, where roughly 80% of Alibaba's MOQ-1 listings hide price behind "contact supplier"
  * productWeight comes from the feed, so freight is priced on a stated weight instead of a category guess

What it does NOT fix: whether the price is one a person has confirmed. Every row lands as cost_verified=check, the
same as the rest of the catalogue, and stays there until somebody checks it.
"""
import argparse, csv, io, json, os, re, sys, time, urllib.request, urllib.error

API = "https://developers.cjdropshipping.com/api2.0/v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, "data", "catalog.csv")

ap = argparse.ArgumentParser()
ap.add_argument("--keywords", default="power bank,rechargeable fan,women dress,bluetooth earbuds,phone charger",
                help="comma-separated search terms")
ap.add_argument("--per", type=int, default=40, help="products per keyword (max 100)")
ap.add_argument("--max-price", type=float, default=200.0, help="skip anything dearer than this, in USD")
ap.add_argument("--dry", action="store_true", help="print the rows, write nothing")
a = ap.parse_args()

TOKEN = os.environ.get("CJ_ACCESS_TOKEN", "").strip()
if not TOKEN:
    sys.exit("CJ_ACCESS_TOKEN is not set. Get it from CJ → Authorization → API, then set it in your shell.\n"
             "Do not paste it into a file or into chat.")

# ---- CJ category name -> Garsoore category. Anything unmapped is skipped rather than guessed into the wrong place.
CATMAP = [
    (r"phone|mobile|cell", "PHN"), (r"computer|laptop|tablet|office electronics", "CMP"),
    (r"women|men|clothing|apparel|dress|shirt|shoe", "CLO"),
    (r"home applian|kitchen|household", "HOM"), (r"furniture", "FRN"),
    (r"solar", "SOL"), (r"tool|hardware|security|light", "BLD"),
    (r"automotive|motorcycle|vehicle", "VEH"), (r"consumer electronic|audio|headphone|earbud|watch|camera|charger|power", "ELC"),
]
def cat_of(name):
    n = (name or "").lower()
    for rx, c in CATMAP:
        if re.search(rx, n):
            return c
    return None

def get(path, params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(API + path + "?" + q, headers={"CJ-Access-Token": TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        # never echo the token back, even in an error
        sys.exit("CJ API %s on %s: %s" % (e.code, path, body))

rows, seen = [], set()
for kw in [k.strip() for k in a.keywords.split(",") if k.strip()]:
    j = get("/product/listV2", {"keyWord": kw, "page": 1, "size": min(100, max(1, a.per))})
    if not j.get("result"):
        print("  ! %s: %s" % (kw, j.get("message"))); continue
    data = j.get("data") or {}
    items = data.get("list") or data.get("content") or (data if isinstance(data, list) else [])
    kept = 0
    for it in items:
        pid = str(it.get("pid") or it.get("productId") or "")
        sku = str(it.get("productSku") or "")
        name = (it.get("productNameEn") or it.get("productName") or "").strip()
        price = it.get("sellPrice")
        kg = it.get("productWeight")
        cat = cat_of(it.get("categoryName") or "") or cat_of(name)
        if not (pid and name and cat): continue
        if sku in seen or not sku: continue
        try: price = float(price)
        except (TypeError, ValueError): continue
        if not (price > 0) or price > a.max_price: continue
        try: kg = float(kg) / 1000.0 if float(kg) > 50 else float(kg)   # CJ reports grams on some rows
        except (TypeError, ValueError): kg = 0
        if not (kg > 0): continue
        seen.add(sku); kept += 1
        rows.append({
            "sku": "", "cat": cat, "brand": "", "model": name[:120], "model_no": sku,
            "variant": "Standard", "color": "—", "color_hex": "",
            # CJ sells in USD; the catalogue works in CNY, so convert at the same FX the pricing engine uses
            "cost_cny": round(price * 7.2, 2), "kg": kg, "moq": 1,
            "source_platform": "cj", "source_url": "https://cjdropshipping.com/product/-p-%s.html" % pid,
            "supplier": "CJdropshipping", "cost_verified": "check",
            "blurb_so": "", "image": it.get("productImage") or "", "price_usd": price,
            "moq_unit": it.get("productUnit") or "pieces", "specs": "",
            "captured": time.strftime("%Y-%m-%d"), "search": name[:80],
        })
    print("  %-28s %d kept" % (kw, kept))

if not rows:
    sys.exit("nothing usable came back — check the keywords, or the token's permissions")

# ---- give each row a Garsoore SKU, continuing the existing numbering per category
existing = list(csv.DictReader(io.open(CSV, encoding="utf-8-sig")))
nxt = {}
for r in existing:
    m = re.match(r"GRS-([A-Z]{3})-(\d+)", r.get("sku") or "")
    if m: nxt[m.group(1)] = max(nxt.get(m.group(1), 0), int(m.group(2)))
for r in rows:
    nxt[r["cat"]] = nxt.get(r["cat"], 20000) + 1
    r["sku"] = "GRS-%s-%d" % (r["cat"], nxt[r["cat"]])

print("\n%d products ready (%s)" % (len(rows), ", ".join(sorted({r["cat"] for r in rows}))))
for r in rows[:6]:
    print("  %-14s %-52s $%-8s %skg" % (r["sku"], r["model"][:52], r["price_usd"], r["kg"]))

if a.dry:
    print("\n--dry: nothing written."); sys.exit(0)

# rewrite our own CJ block each run, exactly as the 1688 importer does, so re-running never duplicates
keep = [r for r in existing if r.get("source_platform") != "cj"]
out = keep + rows
tmp = CSV + ".tmp"
with io.open(tmp, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(existing[0].keys()))
    w.writeheader()
    for r in out: w.writerow({k: r.get(k, "") for k in existing[0].keys()})
os.replace(tmp, CSV)
print("\nwrote %d rows to data/catalog.csv (%d kept + %d from CJ)" % (len(out), len(keep), len(rows)))
print("next: python tools/import-catalog.py && python tools/build-site.py --china https://china.buurwen.com")
