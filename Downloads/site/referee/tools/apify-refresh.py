"""Refresh the core catalogue's costs from Apify:  data/catalog.csv  ->  updated cost_cny.
Only rows that have a source_url on 1688 or Taobao/Tmall are refreshed (the JD actor cannot look up a product by link, so JD rows
are skipped). Prices are written back with cost_verified = "check" - a HUMAN must confirm the listing really is this product/variant
and then set it to "yes". Nothing is ever marked verified automatically.

    set APIFY_TOKEN=...           (PowerShell:  $env:APIFY_TOKEN="...")   - never commit the token
    python tools/apify-refresh.py --dry-run            show what would be called + estimated cost
    python tools/apify-refresh.py --limit 25           refresh at most 25 products (start small - you pay per product)
    python tools/apify-refresh.py --limit 25 --yes     actually run
After a run:  python tools/import-catalog.py"""
import argparse, csv, json, os, re, shutil, sys, urllib.request, urllib.error

ACTORS = {"1688": "automation-lab~1688-scraper", "taobao": "zen-studio~taobao-detail-scraper"}
EST_USD = {"1688": 0.004, "taobao": 0.010}   # worst-case per product, from the actor pages - check current pricing before big runs


def item_id(url):
    m = re.search(r"(?:offer/|[?&]id=)(\d{5,})", url or "")
    return m.group(1) if m else ""


def num(v):
    try:
        return float(re.sub(r"[^\d.]", "", str(v)))
    except ValueError:
        return 0.0


def apify(actor, payload, token):
    req = urllib.request.Request("https://api.apify.com/v2/acts/%s/run-sync-get-dataset-items?timeout=280&format=json&clean=true" % actor,
                                 data=json.dumps(payload).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode())


def price_1688(o):
    tiers = sorted([(num(t.get("minQty") or t.get("quantity")) or 1, num(t.get("priceCny"))) for t in (o.get("quantityPrices") or []) if num(t.get("priceCny")) > 0])
    return tiers[0][1] if tiers else num(o.get("priceCny"))


def price_taobao(o):
    return num(o.get("price"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--yes", action="store_true", help="really call Apify (costs money)")
    a = ap.parse_args()

    with open("data/catalog.csv", encoding="utf-8-sig", newline="") as f:
        rd = csv.DictReader(f); fields = rd.fieldnames; rows = list(rd)

    by_sku = {}
    for r in rows:
        if r["source_platform"] in ACTORS and item_id(r["source_url"]):
            by_sku.setdefault(r["sku"], []).append(r)
    todo = list(by_sku.items())[:a.limit]
    est = sum(EST_USD[rs[0]["source_platform"]] for _, rs in todo)
    print("%d product(s) have a usable 1688/Taobao source_url; this run covers %d, worst-case cost ~ $%.2f" % (len(by_sku), len(todo), est))
    if a.dry_run or not a.yes:
        print("(dry run - add --yes to call Apify)"); return
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        sys.exit("Set APIFY_TOKEN first.")

    shutil.copy("data/catalog.csv", "data/catalog.backup.csv")
    changed = 0
    for sku, rs in todo:
        plat, ident = rs[0]["source_platform"], item_id(rs[0]["source_url"])
        try:
            if plat == "1688":
                out = apify(ACTORS[plat], {"productUrls": ["https://detail.1688.com/offer/%s.html" % ident]}, token); new = price_1688(out[0]) if out else 0
            else:
                out = apify(ACTORS[plat], {"items": [ident]}, token); new = price_taobao(out[0]) if out else 0
        except (urllib.error.URLError, ValueError) as ex:
            print("  %s: FAILED (%s)" % (sku, ex)); continue
        if new <= 0:
            print("  %s: no price returned" % sku); continue
        old = float(rs[0]["cost_cny"])
        ratio = new / old                                    # keep the relative gaps between variants
        for r in rs:
            r["cost_cny"] = str(round(float(r["cost_cny"]) * ratio)); r["cost_verified"] = "check"
        print("  %s: CNY %s -> CNY %s  (%+.0f%%)  - CHECK the listing matches, then set cost_verified=yes" % (sku, round(old), round(new), (ratio - 1) * 100))
        changed += 1
    with open("data/catalog.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
    print("updated %d product(s); backup at data/catalog.backup.csv. Now run: python tools/import-catalog.py" % changed)


if __name__ == "__main__":
    main()
