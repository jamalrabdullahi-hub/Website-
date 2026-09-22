"""Look at what the SUNSKY Open API actually returns, before anybody writes an importer against it.

    set SUNSKY_APP_KEY=...        (Windows)   /   export SUNSKY_APP_KEY=...   (bash)
    set SUNSKY_APP_SECRET=...
    python tools/probe-sunsky.py --keyword "phone case"

This exists because the CJ importer was written twice: once against the field names the docs implied, and once
against the ones the API actually sends. The feed turned out to nest products under content[].productList and to
carry no weight at all in search results. Guessing cost more than looking.

So this prints the raw shape of one search result and one product detail, and then says plainly whether the three
fields that decide everything are present:

  * a packed WEIGHT      - without it freight cannot be priced, and the product can only be sold by quote
  * a WAREHOUSE field    - Shenzhen stock ships domestically to our Guangzhou facility for a few yuan;
                           Hong Kong stock would have to be IMPORTED into China first, duty and all
  * a real PRICE         - and whether wholesale tiers come with it

Credentials are read from the environment only. They are never written to a file, never committed, and error
bodies are truncated so a failure cannot echo them back.
"""
import argparse, hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

API = "https://open.sunsky-online.com/openapi"

ap = argparse.ArgumentParser()
ap.add_argument("--keyword", default="phone case", help="what to search for")
ap.add_argument("--size", type=int, default=5, help="how many results to ask for")
ap.add_argument("--raw", action="store_true", help="dump the whole JSON rather than a trimmed view")
a = ap.parse_args()

KEY = os.environ.get("SUNSKY_APP_KEY", "").strip()
SECRET = os.environ.get("SUNSKY_APP_SECRET", "").strip()
if not (KEY and SECRET):
    sys.exit("Set SUNSKY_APP_KEY and SUNSKY_APP_SECRET in your shell (SUNSKY account -> Open API).\n"
             "Do not paste either into a file or into chat.")


def sign(params):
    """Most Chinese open platforms sign as md5(secret + sorted k+v pairs + secret). If SUNSKY differs, the first
    call comes back with a signature error rather than data, and the fix is one function rather than a rewrite."""
    joined = "".join(k + str(params[k]) for k in sorted(params))
    return hashlib.md5((SECRET + joined + SECRET).encode("utf-8")).hexdigest().upper()


def call(path, params):
    p = dict(params)
    p.setdefault("appKey", KEY)
    p.setdefault("timestamp", time.strftime("%Y-%m-%d %H:%M:%S"))
    p["sign"] = sign(p)
    url = API + path + "?" + urllib.parse.urlencode(p)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        sys.exit("SUNSKY %s on %s: %s" % (e.code, path, e.read().decode("utf-8", "replace")[:300]))
    except Exception as ex:
        sys.exit("could not reach SUNSKY (%s): %s" % (type(ex).__name__, str(ex)[:200]))
    try:
        return json.loads(body)
    except ValueError:
        sys.exit("SUNSKY did not return JSON. First 300 characters:\n" + body[:300])


def walk(obj, depth=0, path=""):
    """Print the shape, not the contents, so a long feed stays readable."""
    pad = "  " * depth
    if isinstance(obj, dict):
        for k, v in list(obj.items())[:40]:
            if isinstance(v, (dict, list)):
                print("%s%s:" % (pad, k))
                walk(v, depth + 1, path + "." + k)
            else:
                print("%s%-24s %s" % (pad, k, repr(v)[:70]))
    elif isinstance(obj, list):
        print("%s[%d item(s)]" % (pad, len(obj)))
        if obj:
            walk(obj[0], depth + 1, path + "[0]")


print("== search: %r" % a.keyword)
res = call("/product!search.do", {"keyword": a.keyword, "pageSize": a.size, "pageNo": 1})
if a.raw:
    print(json.dumps(res, ensure_ascii=False, indent=1)[:4000])
else:
    walk(res)

# find the first item number anywhere in the response, whatever it is nested under
item_no = None


def find_item(o):
    global item_no
    if item_no or not isinstance(o, (dict, list)):
        return
    if isinstance(o, dict):
        for k, v in o.items():
            if k.lower() in ("itemno", "item_no", "sku", "code") and isinstance(v, str) and len(v) >= 6:
                item_no = v
                return
            find_item(v)
    else:
        for v in o:
            find_item(v)


find_item(res)

if item_no:
    print("\n== detail: %s" % item_no)
    det = call("/product!detail.do", {"itemNo": item_no})
    if a.raw:
        print(json.dumps(det, ensure_ascii=False, indent=1)[:4000])
    else:
        walk(det)
    blob = json.dumps(det, ensure_ascii=False).lower()
else:
    blob = json.dumps(res, ensure_ascii=False).lower()
    print("\n(no item number found in the search response - the detail call was skipped)")

print("\n---- the three fields that decide whether this can be an integration")
for label, needles in (("packed weight", ("weight", "grossweight", "netweight")),
                       ("warehouse", ("warehouse", "stockarea", "location", "depot")),
                       ("price", ("price", "wholesaleprice", "tier"))):
    hit = [n for n in needles if '"%s"' % n in blob or n in blob]
    print("  %-14s %s" % (label, ("present: " + ", ".join(hit)) if hit else "NOT FOUND"))
print("\nIf weight is missing here, SUNSKY products can only be sold by quote, exactly like the")
print("AliExpress feed - the shipping engine cannot price what it cannot weigh.")
