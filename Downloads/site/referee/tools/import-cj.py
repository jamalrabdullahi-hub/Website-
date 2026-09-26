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
ap.add_argument("--keywords", default="",
                help="comma-separated search terms (omit to use the full curated KEYWORDS list below)")
ap.add_argument("--kw-file", default="", help="a text file of search terms, one per line (# comments ignored)")
ap.add_argument("--per", type=int, default=40, help="products per keyword (max 100)")
ap.add_argument("--max-price", type=float, default=200.0, help="skip anything dearer than this, in USD")
ap.add_argument("--dry", action="store_true", help="print the rows, write nothing")
ap.add_argument("--force", action="store_true",
                help="write even when the run looks degraded (see the guard below) - use only when the shrinkage is real")
a = ap.parse_args()

# CJ issues a long-lived API key, which is NOT what the product endpoints accept. The key is exchanged for a
# short-lived access token (15 days), so do that here rather than making somebody keep a fresh token in their shell.
# Both values come from the environment; neither is written anywhere.
TOKEN = os.environ.get("CJ_ACCESS_TOKEN", "").strip()
if not TOKEN:
    email, key = os.environ.get("CJ_EMAIL", "").strip(), os.environ.get("CJ_API_KEY", "").strip()
    if not key:
        sys.exit("Set CJ_API_KEY (CJ -> Authorization -> API; the CJxxxx@api@... value) in your shell. "
                 "Do not paste it into a file or into chat.")
    # CJ accepts the API key on its own; email (if present) is sent too but is not required.
    body = {"apiKey": key}
    if email: body["email"] = email
    req = urllib.request.Request(API + "/authentication/getAccessToken",
                                 data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as ex:
        sys.exit("CJ auth %s: %s" % (ex.code, ex.read().decode("utf-8", "replace")[:200]))
    TOKEN = ((j.get("data") or {}).get("accessToken") or "").strip()
    if not TOKEN:
        # CJ allows one token request every 5 minutes; that limit arrives here as a plain failure message
        sys.exit("CJ would not issue a token: %s" % j.get("message"))
    print("authenticated" + (" as %s" % email if email else ""))

# The curated search set. This IS the breadth of the catalogue: every term is one CJ search, and CJ holds the
# price, weight and China stock for what it returns. Grouped so the catalogue grows in the shapes Somali buyers
# actually shop. Phones and laptops are deliberately absent — CJ does not carry them (confirmed by probing their API).
KEYWORDS = [
    # home & kitchen
    "electric kettle", "blender", "rice cooker", "air fryer", "coffee maker", "electric iron", "toaster",
    "sandwich maker", "food processor", "juicer", "water dispenser", "vacuum cleaner", "humidifier",
    "air purifier", "mosquito killer lamp", "thermos flask", "dinnerware set", "cookware set", "kitchen knife set",
    "storage box", "laundry basket", "mop", "wall clock", "photo frame", "scented candle", "spice rack", "trash can",
    # electric & electronics accessories
    "rechargeable fan", "mini fan", "desk fan", "power bank", "wireless charger", "bluetooth earbuds",
    "bluetooth speaker", "smart watch", "car charger", "usb cable", "charging cable", "selfie stick", "ring light",
    "mini camera", "webcam", "mouse", "keyboard", "usb hub", "memory card", "led strip", "wifi router",
    "laptop stand", "phone screen protector", "phone case", "phone holder", "phone stand", "tv box",
    "bluetooth receiver", "headphone", "speaker light", "smart plug", "surge protector", "extension cord", "power strip",
    # computers
    "flash drive", "mousepad", "laptop bag", "computer speaker", "hdmi cable", "usb adapter", "card reader",
    # clothing & accessories
    "women dress", "men shirt", "t-shirt", "hoodie", "jeans", "leggings", "abaya", "hijab", "sneakers", "sandals",
    "handbag", "backpack", "wallet", "belt", "scarf", "hat", "cap", "sunglasses", "wrist watch", "jewelry necklace",
    "earrings", "socks", "underwear", "kids clothing", "baby romper", "men suit",
    # furniture & storage
    "office chair", "storage rack", "shoe rack", "wardrobe", "bedside table", "wall shelf", "folding table",
    "laundry hamper", "bookshelf", "clothes hanger", "drawer organizer", "kitchen cabinet",
    # tools, hardware, security, lighting
    "led bulb", "flashlight", "camping light", "work light", "tool set", "screwdriver set", "wrench set", "drill",
    "tape measure", "door lock", "padlock", "cctv camera", "security camera", "night light", "desk lamp", "floor lamp",
    # auto & moto
    "car phone holder", "car vacuum cleaner", "led car light", "tire inflator", "motorcycle phone mount",
    "car seat cover", "steering wheel cover", "dash cam", "car cleaning kit", "bike light",
    # solar
    "solar panel", "solar inverter", "solar battery", "solar charge controller", "solar street light",
    "solar garden light", "solar power station", "solar lamp", "solar generator",
    # beauty & care
    "perfume", "face mask", "makeup brush", "hair comb", "hair curler", "nail kit", "skincare set", "lipstick",
    "eyelash", "trimming machine", "hair dryer",
    # baby, kids & school
    "baby bottle", "diaper bag", "baby toy", "kids backpack", "school backpack", "pencil case", "stationery set",
    "calculator", "notebook set", "water bottle",
    # pets & misc
    "pet food storage", "pet bowl", "pet leash",
]

# ---- CJ category name -> Garsoore category. Anything unmapped is skipped rather than guessed into the wrong place.
CATMAP = [
    # Specific things first, matched against the product NAME before the category path: CJ files a rechargeable
    # fan under "Home Office Storage", so their taxonomy is the fallback, not the source of truth.
    (r"solar|inverter|charge controller", "SOL"),
    (r"perfume|cosmetic|makeup|skincare|lipstick|hair (dryer|curler)|nail|beauty|eyelash|trimming", "BEA"),
    (r"baby|infant|diaper|toddler|kids|child|school ?bag|pencil case|stationer|notebook", "KID"),
    (r"power ?bank|charger|earbud|headphone|earphone|speaker|smart ?watch|camera|audio|usb|hdmi|adapter|hub|memory card|keyboard|mouse|ring light|selfie|led strip|router|tv box", "ELC"),
    (r"\bphone\b|mobile|cell(phone)?|screen protector", "PHN"),
    (r"computer|laptop|tablet|mousepad|flash drive|card reader", "CMP"),
    (r"women|men|clothing|apparel|dress|shirt|t-shirt|hoodie|jacket|jeans|legging|abaya|hijab|shoe|sneaker|sandal|boot|handbag|backpack|wallet|purse|belt|scarf|hat|cap|sunglass|watch|jewel|earring|sock|underwear|garment", "CLO"),
    (r"(^|[ -])fan([ s-]|$)|blender|kettle|cooker|rice ?cook|coffee|humidifier|air ?fry|air ?purif|vacuum|juicer|toaster|iron|dinnerware|cookware|kitchen|household|home applian|mop|wall clock|frame|candle|thermos|dispenser|storage box|laundry", "HOM"),
    (r"sofa|chair|table|bed|wardrobe|furniture|shelf|rack|hamper|bookshelf|cabinet|drawer|hanger", "FRN"),
    (r"car|auto(motive)?|motorcycle|bike|truck|vehicle|tire|dash cam", "VEH"),
    (r"tool|hardware|security|cctv|lock|light|lamp|torch|bulb|drill|wrench|screwdriver|tape measure|extension", "BLD"),
]
def cat_of(name):
    """CJ gives a path like "Home Garden & Furniture/Household Appliances/Fan". Read it from the most specific
    segment outwards, or a desk fan gets filed as furniture because its top-level parent says so."""
    segs = [s.strip().lower() for s in re.split(r"[/>]", name or "") if s.strip()]
    for seg in reversed(segs or [(name or "").lower()]):
        for rx, c in CATMAP:
            if re.search(rx, seg):
                return c
    return None

# which search terms to run: an explicit list, a file, or the full curated set
KWS = [k.strip() for k in a.keywords.split(",") if k.strip()]
if not KWS and a.kw_file:
    KWS = [l.strip() for l in io.open(a.kw_file, encoding="utf-8") if l.strip() and not l.startswith("#")]
if not KWS:
    KWS = KEYWORDS
print("running %d keyword(s)" % len(KWS))

def get(path, params, tries=4):
    """A long import is thousands of calls over half an hour, so a single dropped connection must not be fatal.
    Retries with backoff and, when it finally gives up, returns an empty result so the caller skips that item
    instead of losing every row gathered so far."""
    q = urllib.parse.urlencode(params)
    for attempt in range(tries):
        req = urllib.request.Request(API + path + "?" + q, headers={"CJ-Access-Token": TOKEN})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(3 * (attempt + 1)); continue
            # never echo the token back, even in an error
            sys.exit("CJ API %s on %s: %s" % (e.code, path, body))
        except Exception as ex:                      # timeouts, resets, DNS - all transient on a long run
            if attempt < tries - 1:
                time.sleep(3 * (attempt + 1)); continue
            print("  ! giving up on %s after %d tries (%s)" % (path, tries, type(ex).__name__))
            FAILED.append(path)
            return {}
    return {}

rows, seen, skipped_foreign = [], set(), 0
FAILED = []   # every call that exhausted its retries; a long run on a bad line can lose dozens of products

def detail(pid):
    """CJ's search feed carries no weight and no category path, and freight cannot be priced without a weight.
    Both live on /product/query, so every candidate costs a second call. CJ allows roughly one a second."""
    j = get("/product/query", {"pid": pid}) or {}
    time.sleep(1.1)
    return j.get("data") if isinstance(j.get("data"), dict) else None

def first_variant(pid):
    """Variants carry the vid needed to ask where the stock physically is, and a per-variant weight that is more
    specific than the product-level one."""
    j = get("/product/variant/query", {"pid": pid}) or {}
    time.sleep(1.1)
    d = j.get("data")
    return d[0] if isinstance(d, list) and d else None

def china_stock(vid):
    """Garsoore consolidates in Guangzhou, so a product held only in CJ's US or EU warehouse is no use: buying it
    would mean shipping goods INTO China before exporting them again.

    countryCode on /product/listV2 is accepted and then ignored - CN and US return identical results - so the
    warehouse has to be read per variant from the stock endpoint, which is the only place that tells the truth.
    Returns the units available in China, 0 if the stock is anywhere else."""
    j = get("/product/stock/queryByVid", {"vid": vid}) or {}
    time.sleep(1.1)
    for r in (j.get("data") or []):
        if str(r.get("countryCode") or "").upper() == "CN":
            return int(r.get("totalInventoryNum") or r.get("storageNum") or 0)
    return 0

def usd(v):
    """sellPrice is a string, and on variant products it is a range like "10.00-12.00". Take the low end: it is the
    one a customer can actually reach, and it is the conservative choice for a price we then mark up."""
    try: return float(str(v).split("-")[0].strip())
    except (TypeError, ValueError, AttributeError): return 0.0

for kw in KWS:
    j = get("/product/listV2", {"keyWord": kw, "pageNum": 1, "pageSize": min(100, max(1, a.per))})
    if not j.get("result"):
        print("  ! %s: %s" % (kw, j.get("message"))); continue
    data = j.get("data") or {}
    # data.content is a list of groups, each holding a productList
    flat = []
    for g in (data.get("content") or []):
        flat.extend((g or {}).get("productList") or [])
    kept = 0
    for it in flat[:a.per]:
        pid, sku = str(it.get("id") or ""), str(it.get("sku") or "")
        if not (pid and sku) or sku in seen: continue
        price = usd(it.get("nowPrice") or it.get("sellPrice"))
        if not (0 < price <= a.max_price): continue
        # where the goods physically are, checked BEFORE the detail call so foreign stock costs one call, not two
        var = first_variant(pid)
        if not var: continue
        cn = china_stock(var.get("vid"))
        if cn <= 0:
            skipped_foreign += 1
            continue
        d = detail(pid)
        if not d: continue
        name = (d.get("productNameEn") or it.get("nameEn") or "").strip()
        cat = cat_of(name) or cat_of(d.get("categoryName") or "")   # name first: see CATMAP
        if not (name and cat): continue
        try: kg = float(d.get("productWeight"))
        except (TypeError, ValueError): continue
        # productWeight is ALWAYS grams. Treating small values as kilograms priced a 35 g earbud case as 35 kg
        # of air freight, so there is no threshold here on purpose.
        kg = kg / 1000.0
        if not (kg > 0): continue
        seen.add(sku); kept += 1
        rows.append({
            "sku": "", "cat": cat, "brand": "", "model": name[:120], "model_no": sku,
            "variant": "Standard", "color": "—", "color_hex": "",
            # CJ sells in USD; the catalogue works in CNY, so convert at the same FX the pricing engine uses
            "cost_cny": round(price * 7.2, 2), "kg": round(kg, 3), "moq": 1,
            "source_platform": "cj", "source_url": "https://cjdropshipping.com/product/-p-%s.html" % pid,
            "supplier": "CJdropshipping", "cost_verified": "check",
            "blurb_so": "", "image": it.get("bigImage") or "", "price_usd": price,
            "moq_unit": "pieces", "specs": "",
            "captured": time.strftime("%Y-%m-%d"), "search": name[:80],
        })
    print("  %-28s %d kept" % (kw, kept))

print("")
print("skipped %d product(s) whose stock is not in China" % skipped_foreign)

if not rows:
    sys.exit("nothing usable came back — check the keywords, or the token's permissions")

# ---- give each row a Garsoore SKU, continuing the existing numbering per category
existing = list(csv.DictReader(io.open(CSV, encoding="utf-8-sig")))
# number against the rows we are KEEPING, not the CJ block we are about to replace, or every re-run walks the
# SKUs forward and yesterday's links stop resolving
nxt = {}
for r in [x for x in existing if x.get("source_platform") != "cj"]:
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

# ---- do not let a bad network quietly shrink the catalogue.
# A run that lost calls to timeouts produces fewer products, and because this importer REPLACES its own block,
# writing that result would silently delete good rows. One flaky afternoon cost 60 products exactly this way.
# So a run that both failed calls and came back materially smaller refuses to write unless it is forced.
prev_cj = len([r for r in existing if r.get("source_platform") == "cj"])
if FAILED and prev_cj and len(rows) < prev_cj * 0.8 and not a.dry and not a.force:
    sys.exit("REFUSING TO WRITE. This run gathered %d products but the catalogue already holds %d, and %d call(s) "
             "failed after retries - that looks like a bad connection, not a smaller catalogue. "
             "Nothing was changed. Re-run it, or pass --force if the shrinkage is genuine."
             % (len(rows), prev_cj, len(FAILED)))
if FAILED:
    print("note: %d call(s) failed after retries; some products were skipped" % len(FAILED))

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
