"""Build the REAL core catalogue from live supplier listings on Made-in-China.com (public product pages).

    python tools/harvest-mic.py            # harvest -> data/catalog.csv (+ data/suppliers.json), then run import-catalog.py
    python tools/harvest-mic.py --offline  # rebuild from the page cache only (no network)

Every row is a real listing: real product URL, real supplier, real photo, the supplier's own price range, minimum order
(MOQ) and weight as published on the page, plus the capture date. Nothing is invented. Prices are the supplier's FOB
asking prices, so every row is marked cost_verified=check — a person confirms the price (and freight weight) with the
supplier before setting it to yes. With REQUIRE_VERIFIED=1 the site sells unconfirmed items only through a staff quote.

Politeness: one request at a time, ~1.5 s apart, and pages are cached in data/harvest-cache/ (gitignored) so re-runs
do not hit the site again. Filters per search (below) drop accessories, bait prices and per-watt / per-metre listings.
"""
import argparse, csv, datetime, hashlib, html, json, os, re, sys, time, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--offline", action="store_true")
ap.add_argument("--take", type=int, default=5, help="products kept per search")
ap.add_argument("--maxmoq", type=int, default=100, help="skip listings whose minimum order is larger")
ap.add_argument("--only", default="", help="test run: only searches containing this text (does not write the CSV)")
a = ap.parse_args()

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CACHE = os.path.join(ROOT, "data", "harvest-cache")
os.makedirs(CACHE, exist_ok=True)
FX = 7.2                    # CNY per USD — same as assets/catalog.js
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
PIECE = {"piece", "pieces", "set", "sets", "unit", "units", "pair", "pairs", "pc", "pcs", "box", "boxes", "carton", "cartons", "bag", "bags"}
JUNK = r"\b(china|factory direct|factory|fctory|direct|prices?|hot|selling|sale|manufacturer|supplier|wholesale|hot[- ]sale|hot[- ]selling|best[- ]price|cheap|high[- ]quality|oem|odm|new arrival|2024|2025|2026|free shipping|customized|custom)\b"

# (cat, search, usd_min, usd_max, must (any of, lowercase), exclude (any of), kg_default, blurb_so)
Q = [
  # ---- solar & power
  ("SOL", "Solar Panel 550W", 45, 220, ["550", "540", "545", "555", "560"], ["watt price", "per watt", "cell only"], 28, "Panel solar mono ah oo awood sare leh — guryaha, dukaamada iyo beeraha."),
  ("SOL", "Solar Panel 450W", 35, 180, ["450", "455", "460"], [], 24, "Panel solar mono ah — ku habboon saqafka guryaha."),
  ("SOL", "Hybrid Solar Inverter 5kw", 200, 1600, ["inverter"], ["micro", "pump"], 15, "Inverter hybrid ah — solar, batari iyo koronto isku mar."),
  ("SOL", "Hybrid Solar Inverter 3kw", 150, 1000, ["inverter"], ["micro", "pump"], 11, "Inverter hybrid ah oo guri dhexdhexaad ah ku filan."),
  ("SOL", "Lithium Battery 48V 100Ah", 350, 2200, ["48v", "51.2v"], ["charger", "ebike", "golf"], 48, "Batari lithium (LiFePO4) oo cimri dheer — solar iyo koronto kaydin."),
  ("SOL", "Lithium Battery 12V 100Ah", 80, 600, ["12v", "12.8v"], ["charger", "car jump"], 12, "Batari lithium 12V — nal solar, tv iyo qalab yar."),
  ("SOL", "Solar Street Light", 15, 600, ["street"], ["pole only", "controller only"], 8, "Nal waddo solar ah — iftiin habeenkii, koronto la'aan."),
  ("SOL", "Solar Home Lighting System", 15, 500, ["solar"], [], 6, "Nidaam iftiin solar ah oo guri — nalal, dallac taleefan."),
  ("SOL", "Portable Power Station", 100, 1500, ["power station", "portable"], [], 12, "Kaydiye koronto la qaadi karo — taleefan, laptop, fan."),
  ("SOL", "Solar Water Pump", 100, 1500, ["pump"], [], 20, "Bamb biyo solar ah — ceelal iyo beero."),
  ("SOL", "MPPT Solar Charge Controller", 20, 400, ["mppt"], [], 3, "Kontaroole MPPT ah oo batariga ilaaliya."),
  # ---- appliances
  ("APL", "Split Air Conditioner 12000BTU", 150, 900, ["air conditioner", "split"], ["portable", "part"], 40, "Qaboojiye split ah oo inverter — kulaylka Muqdisho."),
  ("APL", "Solar Air Conditioner", 300, 2500, ["air conditioner"], [], 45, "Qaboojiye ku shaqeeya solar — kharash koronto yar."),
  ("APL", "Chest Freezer", 100, 900, ["freezer"], ["part", "compressor"], 45, "Firiisar — hilib, kalluun iyo dukaamada."),
  ("APL", "Double Door Refrigerator", 120, 1200, ["refrigerator", "fridge"], ["part", "compressor"], 55, "Talaajad laba albaab ah."),
  ("APL", "DC Solar Refrigerator", 100, 1200, ["refrigerator", "fridge", "freezer"], [], 40, "Talaajad DC ah oo si toos ah solar ugu shaqeysa."),
  ("APL", "Twin Tub Washing Machine", 60, 500, ["washing machine"], ["part"], 25, "Mashiinka dharka lagu dhaqo — laba haan."),
  ("APL", "Water Dispenser", 30, 400, ["dispenser"], ["cup", "bottle only"], 14, "Qalabka biyaha qabow iyo kulul bixiya."),
  ("APL", "Rechargeable Fan", 10, 150, ["fan"], ["blade only"], 4, "Marawaxad dallacaad leh — waxay shaqeysaa marka korontadu go'do."),
  ("APL", "Stand Fan 16 inch", 8, 120, ["fan"], ["blade only"], 5, "Marawaxad taagan."),
  ("APL", "Ceiling Fan", 12, 250, ["ceiling fan"], [], 6, "Marawaxad saqafka."),
  ("APL", "Microwave Oven", 30, 300, ["microwave"], ["part"], 14, "Foorno microwave ah."),
  ("APL", "Gas Cooker 4 Burner", 30, 500, ["burner", "cooker", "stove"], ["part", "knob"], 25, "Burjiko gaas ah oo afar af leh."),
  # ---- home & kitchen
  ("HOM", "Electric Kettle", 3, 60, ["kettle"], [], 1.2, "Kildhi koronto — shaah iyo biyo kulul dhakhso."),
  ("HOM", "Blender", 5, 150, ["blender"], ["part", "jar only"], 3, "Blender — cabitaan, casiir iyo cunto."),
  ("HOM", "Rice Cooker", 8, 150, ["rice cooker"], [], 3, "Karinta bariiska."),
  ("HOM", "Air Fryer", 15, 200, ["air fryer"], [], 5, "Air fryer — cunto shiilan saliid yar."),
  ("HOM", "Cookware Set", 10, 250, ["cookware", "pot"], [], 6, "Digsiyo iyo maacuun karin."),
  ("HOM", "Vacuum Flask Thermos", 2, 60, ["flask", "thermos"], [], 1, "Termo shaah iyo qaxwo — kulaylka hayo saacado."),
  ("HOM", "Dinnerware Set", 10, 200, ["dinnerware", "dinner set", "plate"], [], 6, "Saxanno iyo koobab."),
  ("HOM", "Electric Iron", 4, 80, ["iron"], ["steel", "cast iron"], 1.5, "Kaawiyad koronto."),
  ("HOM", "Bed Sheet Set", 5, 120, ["sheet", "bedding"], [], 2, "Go'yaal sariir."),
  ("HOM", "Carpet Rug", 5, 300, ["carpet", "rug"], ["car mat", "floor mat for car"], 6, "Roog guri."),
  # ---- furniture
  ("FRN", "Office Chair", 20, 300, ["chair"], ["part", "wheel", "cover"], 15, "Kursi xafiis oo raaxo leh."),
  ("FRN", "Plastic Chair", 3, 60, ["chair"], ["mould", "mold"], 3, "Kursi caag ah — aroos, masjid, dukaan."),
  ("FRN", "Sofa Set", 150, 2500, ["sofa"], ["cover", "leg"], 90, "Fadhi guri."),
  ("FRN", "Spring Mattress", 30, 600, ["mattress"], ["protector", "cover", "topper"], 30, "Joodari sariir."),
  ("FRN", "Metal Bed Frame", 30, 500, ["bed"], ["sheet", "cover"], 35, "Sariir bir ah."),
  ("FRN", "Office Desk", 30, 700, ["desk", "table"], [], 30, "Miis xafiis."),
  ("FRN", "Steel Wardrobe", 40, 500, ["wardrobe", "cabinet"], [], 40, "Armaajo dhar."),
  ("FRN", "Dining Table Set", 60, 1500, ["dining"], [], 60, "Miis cunto iyo kuraas."),
  # ---- electronics
  ("ELC", "Smart LED TV 43 inch", 80, 500, ["tv", "television"], ["mount", "bracket", "remote only"], 10, "TV smart ah — YouTube, Netflix, kanaalada."),
  ("ELC", "Smart LED TV 32 inch", 50, 300, ["tv", "television"], ["mount", "bracket"], 6, "TV smart ah oo 32 inji."),
  ("ELC", "Bluetooth Speaker", 5, 200, ["speaker"], [], 1.5, "Sameecad Bluetooth."),
  ("ELC", "Power Bank 20000mAh", 4, 60, ["power bank"], [], 0.5, "Power bank — taleefanka ku dallac meel kasta."),
  ("ELC", "TWS Wireless Earbuds", 3, 60, ["earbuds", "earphone", "tws", "headphone"], [], 0.2, "Dhegaha Bluetooth (earbuds)."),
  ("ELC", "Smart Watch", 5, 120, ["watch"], ["strap only", "band only"], 0.3, "Saacad smart ah."),
  ("ELC", "4G WiFi Router with SIM", 10, 150, ["router", "mifi", "wifi"], ["antenna only"], 0.6, "Router 4G oo SIM qaata — internet guriga iyo dukaanka."),
  ("ELC", "CCTV Camera Kit", 30, 500, ["cctv", "camera", "nvr", "dvr"], ["lens only"], 5, "Kaamirooyin amni — guri iyo dukaan."),
  ("ELC", "WiFi Security Camera", 8, 120, ["camera"], ["lens only", "dash"], 0.6, "Kaamiro WiFi ah oo taleefanka laga daawado."),
  ("ELC", "LED Bulb", 0.3, 10, ["bulb", "lamp"], [], 0.1, "Nal LED ah oo koronto yar."),
  # ---- phones, tablets, computers
  ("PHN", "4G Smartphone", 30, 400, ["smartphone", "phone", "mobile"], ["case", "cover", "screen protector", "glass", "holder", "charger", "cable", "lcd", "battery for"], 0.5, "Taleefan smart 4G ah oo cusub."),
  ("PHN", "Feature Phone Dual SIM", 4, 60, ["phone", "mobile"], ["case", "cover", "lcd", "battery for", "charger"], 0.3, "Taleefan fudud oo laba SIM ah — batari dheer."),
  ("PHN", "Android Tablet 10 inch", 30, 300, ["tablet"], ["case", "cover", "glass", "stand", "holder"], 1, "Tablet Android ah — waxbarasho iyo daawasho."),
  ("PHN", "Fast Charger 20W", 1, 30, ["charger", "adapter"], ["wireless car", "laptop"], 0.2, "Dallac taleefan oo dhakhso ah."),
  ("CMP", "Laptop 15.6 inch", 120, 800, ["laptop", "notebook"], ["bag", "sleeve", "stand", "keyboard", "battery", "screen", "adapter"], 2.5, "Laptop — xafiis, iskuul iyo ganacsi."),
  ("CMP", "Mini PC", 50, 600, ["mini pc", "computer"], ["case only"], 1.2, "Kombiyuutar yar oo xoog leh."),
  ("CMP", "Computer Monitor 24 inch", 50, 300, ["monitor"], ["arm", "stand", "mount"], 5, "Shaashad kombiyuutar."),
  ("CMP", "UPS 1kVA", 30, 500, ["ups"], ["battery only"], 10, "UPS — kombiyuutarka ilaaliya marka korontadu go'do."),
  ("CMP", "Wireless Keyboard Mouse Combo", 3, 60, ["keyboard"], [], 0.8, "Kiiboord iyo jiir wireless ah."),
  # ---- building, tools, security, generators
  ("BLD", "Diesel Generator 10kVA", 600, 6000, ["generator", "genset"], ["part", "alternator only"], 350, "Matoor koronto diesel ah — dukaan, xafiis, guri."),
  ("BLD", "Gasoline Generator 3kW", 80, 900, ["generator"], ["part", "carburetor"], 45, "Matoor koronto baansiin ah oo yar."),
  ("BLD", "Water Pump Electric", 20, 500, ["pump"], ["part", "seal"], 12, "Bamb biyo koronto ah."),
  ("BLD", "Plastic Water Tank 1000L", 30, 500, ["tank"], ["fish", "toilet"], 25, "Haan biyo caag ah."),
  ("BLD", "Cordless Drill", 10, 200, ["drill"], ["bit only", "bits"], 2, "Dariil batari ah."),
  ("BLD", "Inverter Welding Machine", 40, 600, ["welding", "welder"], ["helmet", "rod", "electrode"], 10, "Mashiinka alxanka."),
  ("BLD", "Steel Security Door", 60, 900, ["door"], ["lock only", "handle"], 70, "Albaab bir ah oo amni leh."),
  ("BLD", "Padlock", 0.5, 30, ["padlock", "lock"], [], 0.4, "Quful."),
  ("BLD", "Paint Sprayer", 15, 400, ["spray", "sprayer"], [], 4, "Qalabka rinjiga lagu buufiyo."),
  # ---- vehicles & parts
  ("VEH", "Cargo Tricycle", 400, 3500, ["tricycle", "three wheel"], ["part", "tyre"], 350, "Mooto saddex lugood ah oo xamuul qaada."),
  ("VEH", "Passenger Tricycle Bajaj", 500, 4000, ["tricycle", "three wheel", "auto rickshaw", "tuk"], ["part", "tyre"], 380, "Bajaj rakaab — ganacsi taksi."),
  ("VEH", "Motorcycle 150cc", 350, 2500, ["motorcycle", "motorbike"], ["part", "helmet"], 120, "Mooto 150cc."),
  ("VEH", "Car Battery 12V", 20, 200, ["battery"], ["charger", "tester"], 18, "Batari baabuur."),
  ("VEH", "Motorcycle Helmet", 5, 80, ["helmet"], [], 1.5, "Koofiyad mooto — badbaado."),
  ("VEH", "Car Tyre 195/65R15", 15, 150, ["tyre", "tire"], ["valve", "inner tube"], 9, "Taayir baabuur."),
  ("VEH", "Brake Pads", 2, 60, ["brake"], [], 1.5, "Faramiin baabuur."),
  # ---- clothing
  ("CLO", "Abaya", 5, 80, ["abaya", "dress"], [], 0.6, "Cabaaya."),
  ("CLO", "Men Thobe", 5, 60, ["thobe", "jubba", "robe", "kaftan"], [], 0.5, "Khamiis rag."),
  ("CLO", "Hijab Scarf", 0.5, 20, ["hijab", "scarf"], [], 0.2, "Xijaab / masar."),
  ("CLO", "Men Sandals", 2, 40, ["sandal", "slipper"], [], 0.6, "Kabo sandal ah."),
  ("CLO", "Sneakers", 5, 60, ["sneaker", "shoe"], [], 0.9, "Kabo isboorti."),
]

last = [0.0]
def get(url):
    key = hashlib.sha1(url.encode()).hexdigest()[:20]
    path = os.path.join(CACHE, key + ".html")
    if os.path.exists(path):
        return open(path, encoding="utf-8", errors="ignore").read()
    if a.offline:
        return ""
    wait = 1.5 - (time.time() - last[0])
    if wait > 0: time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8", errors="ignore")
    except Exception as ex:
        print("   ! fetch failed", url[:90], ex); body = ""
    last[0] = time.time()
    if body: open(path, "w", encoding="utf-8").write(body)
    return body

def text(s):
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)))

def num(x):
    return float(x.replace(",", ""))

def search(q):
    u = "https://www.made-in-china.com/products-search/hot-china-products/" + re.sub(r"[^A-Za-z0-9]+", "_", q).strip("_") + ".html"
    s = get(u)
    seen, out = set(), []
    for m in re.finditer(r'href="(https?://[a-z0-9-]+\.en\.made-in-china\.com/product/([A-Za-z0-9]+)/[^"]+?\.html)"', s):
        url, pid = m.group(1), m.group(2)
        if pid in seen: continue
        seen.add(pid)
        near = s[m.end():m.end() + 4000]
        pm = re.search(r"US\$\s?([\d,.]+)(?:\s?-\s?([\d,.]+))?", near)
        out.append({"url": url, "pid": pid, "hint": (num(pm.group(1)), num(pm.group(2) or pm.group(1))) if pm else None})
    return out

def product(url):
    s = get(url)
    if not s: return None
    d = {}
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            j = json.loads(m.group(1))
        except Exception:
            continue
        if isinstance(j, dict) and j.get("@type") == "Product": d = j
    if not d: return None
    specs = [(html.unescape(re.sub(r"\s+", " ", k)).strip(), html.unescape(re.sub(r"<[^>]+>|\s+", " ", v)).strip())
             for k, v in re.findall(r'bac-item-label fl">(.*?)</div>\s*<div class="bac-item-value fl">(.*?)</div>', s, re.S)]
    sp = dict(specs)
    t = text(s)
    # price + MOQ, e.g. "US$0.06-0.10 5,000 Watt (MOQ)" or tier tables "US$120.00 1-9 Pieces"
    pm = re.search(r"US\$\s?([\d,.]+)(?:\s?-\s?([\d,.]+))?\s+([\d,]+)\s+([A-Za-z]+)\s*\(MOQ\)", t)
    tiers = re.findall(r"US\$\s?([\d,.]+)\s+([\d,]+)(?:\s?-\s?([\d,]+)|\+)?\s+([A-Za-z]+)", t[:t.find("Product Description") if "Product Description" in t else 20000])
    if pm:
        lo, hi, moq, unit = num(pm.group(1)), num(pm.group(2) or pm.group(1)), int(num(pm.group(3))), pm.group(4).lower()
    elif tiers:
        ps = [num(x[0]) for x in tiers]; lo, hi = min(ps), max(ps); moq = int(num(tiers[0][1])); unit = tiers[0][3].lower()
    else:
        return None
    kg = None
    for k in ("Package Gross Weight", "Gross Weight", "Weight", "Net Weight", "Package Weight", "Product Weight"):
        v = sp.get(k)
        if v:
            wm = re.search(r"([\d.]+)\s*(kg|kgs|g)\b", v, re.I)
            if wm:
                kg = float(wm.group(1)) / (1000 if wm.group(2).lower() == "g" else 1); break
    if kg is None:
        wm = re.search(r"(?:Gross|Net)?\s?Weight\s*[:：]?\s*([\d.]+)\s*(kg|kgs)\b", t, re.I)
        if wm: kg = float(wm.group(1))
    imgs = d.get("image") or []
    if isinstance(imgs, str): imgs = [imgs]
    return {"name": html.unescape(d.get("name", "")).strip(), "company": ((d.get("brand") or {}).get("name") or "").strip(),
            "images": imgs, "lo": lo, "hi": hi, "moq": moq, "unit": unit, "kg": kg, "specs": specs,
            "model": sp.get("Model NO.", ""), "trademark": sp.get("Trademark", ""), "origin": sp.get("Origin", ""), "url": url}

def clean_title(n):
    n = re.sub(JUNK, " ", n, flags=re.I)
    n = re.sub(r"\s+", " ", re.sub(r"\s*[,/|]\s*$", "", n)).strip(" -,/")
    if len(n) > 78: n = n[:78].rsplit(" ", 1)[0]
    return n

def good_brand(tm):
    tm = (tm or "").strip()
    if not tm or len(tm) > 24 or re.search(r"oem|odm|custom|neutral|no brand|none|n/a|accept|logo|according", tm, re.I): return ""
    return tm

rows, suppliers, today, seen_pid = [], {}, datetime.date.today().isoformat(), set()
counters = {}
for cat, q, lo_ok, hi_ok, must, excl, kg0, blurb in Q:
    if a.only and a.only.lower() not in q.lower(): continue
    got, tried = 0, 0
    cands = search(q)
    print("%s  %-34s %3d listings" % (cat, q, len(cands)), end="", flush=True)
    for c in cands:
        if got >= a.take or tried >= a.take * 3: break
        if c["pid"] in seen_pid: continue
        if c["hint"] and (c["hint"][1] < lo_ok * 0.5 or c["hint"][0] > hi_ok * 1.5): continue   # clearly the wrong kind of item
        tried += 1
        p = product(c["url"])
        if not p: continue
        nm = p["name"].lower()
        if not any(w in nm for w in must) or any(w in nm for w in excl): continue
        if p["unit"].rstrip("s") + "s" not in PIECE and p["unit"] not in PIECE: continue   # per watt / metre / kg etc.
        if p["moq"] > a.maxmoq: continue
        if not (lo_ok <= p["hi"] <= hi_ok): continue                                        # bait or wrong item
        if p["hi"] > p["lo"] * 2.2: continue          # one listing covering many sizes: the price is ambiguous, skip it
        seen_pid.add(c["pid"])
        counters[cat] = counters.get(cat, 0) + 1
        sku = "GRS-%s-%05d" % (cat, 20000 + counters[cat])
        kg = p["kg"] if p["kg"] and 0.05 <= p["kg"] <= 2000 else kg0
        keep = [s for s in p["specs"] if s[0] not in ("Model NO.", "Trademark", "Origin", "HS Code", "Production Capacity", "Transport Package", "Specification")][:6]
        rows.append({"sku": sku, "cat": cat, "brand": good_brand(p["trademark"]) or "Generic", "model": clean_title(p["name"]),
                     "model_no": (p["model"] or c["pid"])[:40], "variant": "Standard", "color": "—", "color_hex": "",
                     "cost_cny": round(p["hi"] * FX, 2), "kg": round(kg, 2), "moq": p["moq"], "source_platform": "mic",
                     "source_url": p["url"], "supplier": p["company"], "cost_verified": "check", "blurb_so": blurb,
                     "image": (p["images"][0] if p["images"] else ""), "price_usd": "%s-%s" % (p["lo"], p["hi"]), "moq_unit": p["unit"],
                     "specs": " | ".join("%s: %s" % s for s in keep), "captured": today, "search": q})
        sup = suppliers.setdefault(p["company"], {"name": p["company"], "platform": "mic", "cats": set(), "products": 0, "sample": p["url"]})
        sup["cats"].add(cat); sup["products"] += 1
        got += 1
    print("  -> kept %d" % got)

if not rows:
    sys.exit("no products harvested")
if a.only:
    for r in rows: print(json.dumps({k: r[k] for k in ("sku", "brand", "model", "cost_cny", "price_usd", "moq", "moq_unit", "kg", "supplier", "specs")}, ensure_ascii=False))
    sys.exit(0)
cols = ["sku", "cat", "brand", "model", "model_no", "variant", "color", "color_hex", "cost_cny", "kg", "moq", "source_platform", "source_url",
        "supplier", "cost_verified", "blurb_so", "image", "price_usd", "moq_unit", "specs", "captured", "search"]
with open(os.path.join(ROOT, "data", "catalog.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
with open(os.path.join(ROOT, "data", "suppliers.json"), "w", encoding="utf-8") as f:
    json.dump(sorted([dict(v, cats=sorted(v["cats"])) for v in suppliers.values()], key=lambda x: -x["products"]), f, ensure_ascii=False, indent=1)
by = {}
for r in rows: by[r["cat"]] = by.get(r["cat"], 0) + 1
print("\n%d real products from %d suppliers -> data/catalog.csv  %s" % (len(rows), len(suppliers), by))
