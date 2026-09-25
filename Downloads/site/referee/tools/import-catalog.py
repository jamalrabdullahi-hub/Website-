"""Import the core catalogue: data/catalog.csv  ->  assets/catalog-data.js  (loaded by the site before catalog.js).
Edit the CSV in Excel / Google Sheets (one row per variant; rows sharing a `sku` become one product), then run:
    python tools/import-catalog.py
Columns: sku, cat, brand, model, model_no, variant, color, color_hex, cost_cny, kg, moq,
         source_platform (mic|jd|1688|taobao|pdd|alibaba), source_url, supplier, cost_verified (yes|check|no), blurb_so
Optional (written by tools/harvest-mic.py): image, price_usd, moq_unit, specs ("Key: value | Key: value"), captured, search
cost_verified: yes = a person confirmed the price with the supplier; check = captured from the live listing, not yet
confirmed; no = placeholder. Only "yes" counts as verified (REQUIRE_VERIFIED=1 sells the rest via staff quotes).
Rules enforced: cost_cny and kg must be numbers, sku unique per model_no, category must exist, source_platform must be known.
Rows that break a rule are reported and skipped; nothing is silently guessed."""
import csv, json, re, sys, collections

CATS = {"PHN", "CMP", "APL", "FRN", "VEH", "ELC", "SOL", "HOM", "CLO", "BLD", "BEA", "KID"}
BATTERY = {"unknown", "none", "in_equipment", "with_equipment", "standalone"}
PLATS = {"mic", "jd", "1688", "taobao", "pdd", "alibaba", "aliexpress", "shein", "cj", "sunsky"}
ICON = {"PHN": "📱", "CMP": "💻", "SOL": "☀️", "APL": "🧊", "HOM": "🍳", "FRN": "🪑", "CLO": "👘", "BLD": "🔧", "VEH": "🛺", "ELC": "🎧", "BEA": "💄", "KID": "🧸"}
PLAT_NAME = {"mic": "Made-in-China", "jd": "JD", "1688": "1688", "taobao": "Taobao", "pdd": "Pinduoduo", "alibaba": "Alibaba", "aliexpress": "AliExpress", "shein": "SHEIN", "cj": "CJdropshipping", "sunsky": "SUNSKY"}

def ref_from_url(u, plat=""):
    if plat == "mic":                      # Made-in-China: the product URL (with the supplier's subdomain) is the reference
        return (u or "").split("?")[0]
    m = re.search(r"(?:/|id=|goods_id=|sku=|_)(\d{5,})", u or "")
    return m.group(1) if m else ""

def num(v):
    try:
        n = float(str(v).strip())
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None

def specs_of(r):
    """Consumer-facing specs: the supplier's own attributes, then model. Supplier identity and cost stay internal
    (the consumer buys from Garsoore and never compares marketplaces)."""
    out = []
    for part in (r.get("specs") or "").split(" | "):
        if ": " in part:
            k, v = part.split(": ", 1)
            if k.strip() and v.strip() and len(v) < 60: out.append([k.strip(), v.strip()])
    mn = r["model_no"]
    if mn and len(mn) < 30 and any(c.isdigit() for c in mn): out.append(["Model", mn])
    out.append(["Celin", "7 maalmood"])
    return out[:8]

products, order, errors = {}, [], []
with open("data/catalog.csv", encoding="utf-8-sig", newline="") as f:
    for ln, r in enumerate(csv.DictReader(f), start=2):
        try:
            if r["cat"] not in CATS: raise ValueError("unknown cat " + r["cat"])
            if r["source_platform"] not in PLATS: raise ValueError("unknown platform " + r["source_platform"])
            bat = (r.get("battery") or "unknown").strip().lower()
            if bat not in BATTERY: raise ValueError("battery must be one of " + "/".join(sorted(BATTERY)) + ", got " + bat)
            cost, kg, moq = float(r["cost_cny"]), float(r["kg"]), int(float(r["moq"] or 1))
            if cost <= 0 or kg <= 0: raise ValueError("cost/kg must be > 0")
        except Exception as ex:
            errors.append("line %d (%s): %s" % (ln, r.get("sku"), ex)); continue
        p = products.get(r["sku"])
        if not p:
            name = (r["brand"] + " " if r["brand"] and r["brand"] != "Generic" else "")
            p = products[r["sku"]] = {
                "sku": r["sku"], "cat": r["cat"], "brand": "" if r["brand"] == "Generic" else r["brand"], "model": r["model"], "modelNo": r["model_no"],
                "icon": ICON[r["cat"]], "kg": kg, "moq": moq, "blurb": r["blurb_so"],
                "specs": specs_of(r),
                "variants": [], "sources": [{"channel": r["source_platform"], "ref": ref_from_url(r["source_url"], r["source_platform"]), "seller": r["supplier"], "url": r["source_url"]}],
                "verified": r["cost_verified"].strip().lower() == "yes", "core": True}
            # ---- what a forwarder and a customs broker need, carried through untouched.
            # battery is never inferred from a product name: a dangerous-goods declaration is a legal statement,
            # and "probably fine" is not one. Rows arrive as "unknown" and stay there until a person decides.
            ship = {}
            L, W, H = num(r.get("length_cm")), num(r.get("width_cm")), num(r.get("height_cm"))
            if L and W and H: ship["dims"] = [L, W, H]
            if r.get("hs_code"): ship["hs"] = r["hs_code"].strip()
            ship["battery"] = (r.get("battery") or "unknown").strip().lower()
            haz = [x.strip().lower() for x in (r.get("hazmat") or "").split("|") if x.strip()]
            if haz: ship["hazmat"] = haz
            ship["origin"] = (r.get("origin") or "CN").strip().upper()
            if r.get("customs_desc"): ship["desc"] = r["customs_desc"].strip()
            p["ship"] = ship
            if r.get("image"): p["image"] = r["image"]
            if r.get("captured"): p["captured"] = r["captured"]
            if r.get("moq_unit"): p["moqUnit"] = r["moq_unit"]
            order.append(r["sku"])
        v = {"vsku": r["sku"][-5:] + "-" + str(len(p["variants"]) + 1), "label": r["variant"], "cost": cost}
        if r["color"] and r["color"] != "—": v["color"] = r["color"]
        if r["color_hex"]: v["hex"] = r["color_hex"]
        p["variants"].append(v)
        if r["cost_verified"].strip().lower() != "yes": p["verified"] = False

out = [products[s] for s in order]
with open("assets/catalog-data.js", "w", encoding="utf-8") as f:
    f.write("/* GENERATED by tools/import-catalog.py from data/catalog.csv — do not edit by hand. */\n")
    f.write("window.RF_CATALOG_DATA=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    try:   # real supplier directory for the business site (written by tools/harvest-mic.py)
        sup = json.load(open("data/suppliers.json", encoding="utf-8"))
        f.write("window.RF_SUPPLIERS=" + json.dumps(sup, ensure_ascii=False, separators=(",", ":")) + ";\n")
    except FileNotFoundError:
        pass

by = collections.Counter(p["cat"] for p in out)
print("imported %d products, %d variants -> assets/catalog-data.js" % (len(out), sum(len(p["variants"]) for p in out)))
print("by category:", dict(by), "| verified:", sum(p["verified"] for p in out), "/", len(out))
if errors:
    print("SKIPPED %d row(s):" % len(errors)); [print("  ", e) for e in errors[:20]]; sys.exit(1)
