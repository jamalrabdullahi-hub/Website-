"""Package the PUBLIC site into deploy/public (only what visitors need — no data/, tools/, server/, mockups/, README).
    python tools/build-site.py                                   # demo-data build
    python tools/build-site.py --china https://china.buurwen.com # live-proxy build (writes endpoint into the built config.js only)
The repo's assets/config.js is never modified."""
import argparse, datetime, json, glob, hashlib, os, re, shutil, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("--china", default="", help="proxy endpoint to bake into the built config.js")
a = ap.parse_args()

# server-side prices for the API (deploy/catalog.gen.js, bundled into the Worker) — same price() as the browser
subprocess.check_call(["node", os.path.join("tools", "export-catalog.js")])

OUT = os.path.join("deploy", "public")
os.makedirs(OUT, exist_ok=True)
for name in os.listdir(OUT):          # empty it in place (a running `wrangler dev` keeps the folder itself open on Windows)
    pth = os.path.join(OUT, name)
    shutil.rmtree(pth) if os.path.isdir(pth) else os.remove(pth)

for f in glob.glob("*.html"):
    shutil.copy(f, OUT)
shutil.copytree("assets", os.path.join(OUT, "assets"))
shutil.copytree("business", os.path.join(OUT, "business"))

if a.china:
    cfg = os.path.join(OUT, "assets", "config.js")
    s = open(cfg, encoding="utf-8").read().replace('chinaEndpoint: ""', 'chinaEndpoint: "%s"' % a.china.rstrip("/"))
    assert a.china.rstrip("/") in s, "config.js format changed"
    open(cfg, "w", encoding="utf-8").write(s)

# ---- cache-busting + visible build stamp (so a stale browser copy is obvious and cannot linger)
h = hashlib.sha1()
for root, _, fs in sorted(os.walk(os.path.join(OUT, "assets"))):
    for f in sorted(fs):
        h.update(open(os.path.join(root, f), "rb").read())
ver = h.hexdigest()[:8]
try:
    commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
except Exception:
    commit = "local"
stamp = "%s · %s · %s" % (commit, ver, datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
cfg = os.path.join(OUT, "assets", "config.js")
open(cfg, "a", encoding="utf-8").write("\nwindow.GARSOORE_CONFIG.build = %s;\n" % json.dumps(stamp))
ref = re.compile(r'((?:src|href)="(?:\.\./)?assets/[^"?]+\.(?:js|css))"')
pages = glob.glob(os.path.join(OUT, "*.html")) + glob.glob(os.path.join(OUT, "business", "*.html"))
for f in pages:
    t = open(f, encoding="utf-8").read()
    open(f, "w", encoding="utf-8").write(ref.sub(lambda m: m.group(1) + "?v=" + ver + '"', t))

open(os.path.join(OUT, "_headers"), "w").write(
    "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n")
open(os.path.join(OUT, "robots.txt"), "w").write("# development site\nUser-agent: *\nDisallow: /\n")   # keep the dev site out of search engines

n = sum(len(fs) for _, _, fs in os.walk(OUT))
print("build stamp:", stamp)
print("built %d files -> %s%s" % (n, OUT, " (china endpoint: %s)" % a.china if a.china else " (demo data)"))
