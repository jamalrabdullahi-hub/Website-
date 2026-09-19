"""Package the PUBLIC site into deploy/public (only what visitors need — no data/, tools/, server/, mockups/, README).
    python tools/build-site.py                                   # demo-data build
    python tools/build-site.py --china https://china.buurwen.com # live-proxy build (writes endpoint into the built config.js only)
The repo's assets/config.js is never modified."""
import argparse, glob, os, shutil

ap = argparse.ArgumentParser()
ap.add_argument("--china", default="", help="proxy endpoint to bake into the built config.js")
a = ap.parse_args()

OUT = os.path.join("deploy", "public")
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

for f in glob.glob("*.html"):
    shutil.copy(f, OUT)
shutil.copytree("assets", os.path.join(OUT, "assets"))
shutil.copytree("business", os.path.join(OUT, "business"))

if a.china:
    cfg = os.path.join(OUT, "assets", "config.js")
    s = open(cfg, encoding="utf-8").read().replace('chinaEndpoint: ""', 'chinaEndpoint: "%s"' % a.china.rstrip("/"))
    assert a.china.rstrip("/") in s, "config.js format changed"
    open(cfg, "w", encoding="utf-8").write(s)

open(os.path.join(OUT, "_headers"), "w").write(
    "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n")
open(os.path.join(OUT, "robots.txt"), "w").write("# development site\nUser-agent: *\nDisallow: /\n")   # keep the dev site out of search engines

n = sum(len(fs) for _, _, fs in os.walk(OUT))
print("built %d files -> %s%s" % (n, OUT, " (china endpoint: %s)" % a.china if a.china else " (demo data)"))
