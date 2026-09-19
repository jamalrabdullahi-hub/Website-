/* Garsoore — China supply proxy (Cloudflare Worker) backed by Apify actors. Keeps the Apify token OFF the browser.
   Site side: assets/config.js  →  window.GARSOORE_CONFIG = { chinaEndpoint: "https://china.garsoore.com" }

   Routes → normalised offer shape (see assets/sources.js):
     GET /item?platform=1688|taobao&id=<numeric id>     one product, full detail
     GET /search?q=<text>&platforms=1688,jd             keyword search (1688 + JD)
     GET /link?url=<any http(s) product page>          generic page reader: title / image / price from the page's own data
                                                         (Open Graph tags + schema.org JSON-LD). Used for any link the actors can't do.
   Not covered by the Apify actors below (returns 501, the site then falls back to a staff-priced quote request):
     /item for jd · pdd · alibaba,   /search for taobao · pdd · alibaba

   Actors (verify each in the Apify console before relying on it — actor inputs change):
     1688    automation-lab/1688-scraper        input: { productUrls:[..] } | { keywords:[..], maxResults }     ~$0.001–0.004 / product
     taobao  zen-studio/taobao-detail-scraper   input: { items:[ids or urls] }                                  ~$9.99 / 1,000 products
     jd      zen-studio/jd-com-search-scraper   input: { keyword, maxItems, enrichWithDetails }                 ~$5.99 / 1,000 products
   None of them return product WEIGHT, so weight is a guess here (kg:1, kgGuess:true) — freight on live one-offs is
   therefore an estimate, and the site routes live one-offs through the staff-quote flow.

   Secrets / vars (wrangler secret put APIFY_TOKEN):  APIFY_TOKEN, ALLOW_ORIGINS="https://garsoore.com,https://business.garsoore.com",
   CACHE_SECONDS (default 21600 = 6h).  NOTE: the Workers Cache API only caches on a custom domain (not *.workers.dev).
   COST CONTROL: also set a monthly usage limit in the Apify console and a Cloudflare rate-limiting rule on this route. */

const ACTORS = {
  "1688": "automation-lab~1688-scraper",
  taobao: "zen-studio~taobao-detail-scraper",
  jd: "zen-studio~jd-com-search-scraper"
};
const ITEM_OK = ["1688", "taobao"];
const SEARCH_OK = ["1688", "jd"];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    const allowed = (env.ALLOW_ORIGINS || "https://garsoore.com").split(",").map(s => s.trim());
    const cors = { "access-control-allow-origin": allowed.includes(origin) ? origin : allowed[0], "content-type": "application/json", vary: "origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET" } });
    if (origin && !allowed.includes(origin)) return json({ error: "origin not allowed" }, 403, cors);
    const needApify = () => (env.APIFY_TOKEN ? null : json({ error: "APIFY_TOKEN not configured" }, 500, cors));   // /link does not use Apify

    try {
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const hit = await caches.default.match(cacheKey);
      if (hit) return new Response(hit.body, { status: hit.status, headers: { ...cors, "x-cache": "hit" } });

      let body, status = 200;
      if (url.pathname === "/item") {
        const noTok = needApify(); if (noTok) return noTok;
        const platform = url.searchParams.get("platform"), id = url.searchParams.get("id") || "";
        if (!/^\d{5,20}$/.test(id)) return json({ error: "bad id" }, 400, cors);
        if (!ITEM_OK.includes(platform)) return json({ error: "unsupported", platform }, 501, cors);
        body = await getItem(platform, id, env);
        if (!body) return json({ error: "not found" }, 404, cors);
      } else if (url.pathname === "/search") {
        const noTok = needApify(); if (noTok) return noTok;
        const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
        if (q.length < 2) return json({ error: "query too short" }, 400, cors);
        const plats = (url.searchParams.get("platforms") || "1688").split(",").filter(p => SEARCH_OK.includes(p));
        const parts = await Promise.allSettled(plats.map(p => searchPlatform(p, q, env)));
        body = parts.flatMap(r => (r.status === "fulfilled" ? r.value : []));
      } else if (url.pathname === "/link") {
        const target = url.searchParams.get("url") || "";
        if (!isPublicUrl(target)) return json({ error: "link not allowed" }, 400, cors);
        const html = await readPage(target);
        if (!html) return json({ error: "page could not be read" }, 502, cors);
        body = mapLink(parseHtml(html.text, html.finalUrl), html.finalUrl);
        if (!body) return json({ error: "no product data on this page" }, 404, cors);
      } else return json({ error: "not found" }, 404, cors);

      const res = json(body, status, { ...cors, "cache-control": `public, max-age=${Number(env.CACHE_SECONDS) || 21600}` });
      await caches.default.put(cacheKey, res.clone());
      return res;
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 502, cors);
    }
  }
};

/* ---------------------------------------------------------------- Apify */
async function apify(actor, input, env) {
  const r = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=110&format=json&clean=true`,
    { method: "POST", headers: { authorization: `Bearer ${env.APIFY_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(input) });
  if (r.status === 408) throw new Error("apify timeout");
  if (!r.ok) throw new Error(`apify ${r.status}`);
  return r.json();
}
async function getItem(platform, id, env) {
  if (platform === "taobao") { const a = await apify(ACTORS.taobao, { items: [id] }, env); return a[0] ? mapTaobao(a[0]) : null; }
  const a = await apify(ACTORS["1688"], { productUrls: [`https://detail.1688.com/offer/${id}.html`] }, env);
  return a[0] ? map1688(a[0]) : null;
}
async function searchPlatform(platform, q, env) {
  if (platform === "jd") return (await apify(ACTORS.jd, { keyword: q, maxItems: 12, enrichWithDetails: false }, env)).map(mapJd);
  return (await apify(ACTORS["1688"], { keywords: [q], maxResults: 20 }, env)).map(map1688);
}

/* ---------------------------------------------------------------- mappers → normalised offer (exported for tests) */
const num = v => { const n = Number(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return isFinite(n) ? n : 0; };
function base(platform, ref, url, title, titleZh, extra) {
  return Object.assign({ platform, ref: String(ref), url: url || "", title: title || titleZh || "", titleZh: titleZh || "", brand: "", modelNo: "",
    icon: "📦", kg: 1, kgGuess: true, cat: "ELC", currency: "CNY", live: true, stock: 0, moq: 1 }, extra);
}
export function mapTaobao(r) {
  const skus = (r.skus || []).map(s => ({ id: String(s.skuId), label: [].concat(s.propsNames || []).join(" · ") || "Standard", attrs: {}, cost: num(s.price) || num(r.price) }));
  const price = num(r.price) || (skus[0] && skus[0].cost) || 0;
  return base("taobao", r.itemId, r.url || r.resolvedUrl, r.title, r.titleOriginal, {
    brand: r.brandName || "", skus: skus.length ? skus : [{ id: String(r.itemId) + "-A", label: "Standard", attrs: {}, cost: price }],
    tiers: [{ minQty: 1, cost: price }], moq: num(r.minOrderQuantity) || 1, stock: num(r.stock), image: r.mainPictureUrl || "",
    seller: { id: String((r.shop && (r.shop.sellerId || r.shop.shopId)) || ""), name: (r.shop && r.shop.shopName) || "", city: r.location || "", years: 0, rating: 0, verified: !!r.isTmall, factory: false }
  });
}
export function map1688(r) {
  const tiers = (r.quantityPrices || []).map(t => ({ minQty: num(t.minQty || t.quantity) || 1, cost: num(t.priceCny) })).filter(t => t.cost > 0).sort((a, b) => a.minQty - b.minQty);
  const price = num(r.priceCny) || (tiers[0] && tiers[0].cost) || 0;
  const t2 = tiers.length ? tiers : [{ minQty: num(r.moq) || 1, cost: price }];
  return base("1688", r.productId, r.url, r.title, r.title, {
    skus: [{ id: String(r.productId) + "-A", label: "Standard", attrs: {}, cost: t2[0].cost }], tiers: t2, moq: num(r.moq) || t2[0].minQty || 1, image: r.thumbnailUrl || "",
    seller: { id: String(r.supplierId || ""), name: r.supplierName || "", city: r.city || r.province || r.location || "", years: 0, rating: 0, verified: false,
              factory: /工厂|factory/i.test(JSON.stringify(r.serviceTags || [])) }
  });
}
export function mapJd(r) {
  const price = num(r.price);
  return base("jd", r.skuId || r.itemId, r.url, r.title, r.title, {
    skus: [{ id: String(r.skuId || r.itemId) + "-A", label: "Standard", attrs: {}, cost: price }], tiers: [{ minQty: 1, cost: price }], image: r.image || "",
    modelNo: (r.detail && r.detail.model) || "",
    seller: { id: String((r.shop && r.shop.id) || ""), name: (r.shop && r.shop.name) || "JD", city: "", years: 0, rating: 0, verified: !!r.selfOperated, factory: false }
  });
}

/* ---------------------------------------------------------------- generic link reader
   SSRF guard: only public http(s) hosts on the default ports; no IP literals, localhost or internal suffixes — checked again after redirects.
   The bot identifies itself honestly; sites that block it simply fall back to a staff-priced quote request. */
export function isPublicUrl(u) {
  let x; try { x = new URL(u); } catch { return false; }
  if (x.protocol !== "http:" && x.protocol !== "https:") return false;
  if (x.port && x.port !== "80" && x.port !== "443") return false;
  const h = x.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || /\.(local|internal|localdomain|lan|home|corp)$/.test(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || /^\[/.test(h)) return false;     // IPv4 / IPv6 literals
  return true;
}
async function readPage(target) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(target, { redirect: "follow", signal: ctl.signal, headers: {
      "user-agent": "Mozilla/5.0 (compatible; GarsooreBot/1.0; +https://garsoore.com)", "accept": "text/html,application/xhtml+xml", "accept-language": "en,zh;q=0.8,so;q=0.6" } });
    if (!r.ok || !isPublicUrl(r.url || target) || !/html/i.test(r.headers.get("content-type") || "")) return null;
    const reader = r.body.getReader(), dec = new TextDecoder("utf-8", { fatal: false }); let text = "", n = 0;
    while (n < 600000) { const { done, value } = await reader.read(); if (done) break; n += value.length; text += dec.decode(value, { stream: true }); }
    try { reader.cancel(); } catch {}
    return { text, finalUrl: r.url || target };
  } catch { return null; } finally { clearTimeout(t); }
}
const ent = v => String(v == null ? "" : v).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, g) => {
  g = g.toLowerCase(); if (g[0] === "#") { const c = g[1] === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return isFinite(c) ? String.fromCodePoint(c) : m; }
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[g] || m; }).trim();
function metaContent(html, key) {
  const k = key.replace(/[.:]/g, "\\$&");
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*?content=["']([^"']*)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name|itemprop)=["']${k}["']`, "i"));
  return ent((a && a[1]) || (b && b[1]) || "");
}
function ldProducts(html) {
  const out = [], re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  const walk = n => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(walk);
    const t = [].concat(n["@type"] || []); if (t.includes("Product")) out.push(n); if (n["@graph"]) walk(n["@graph"]); };
  while ((m = re.exec(html))) { try { walk(JSON.parse(m[1])); } catch {} }
  return out;
}
export function parseHtml(html, pageUrl) {
  const p = ldProducts(html)[0] || {}, offer = [].concat(p.offers || [])[0] || {};
  const pick = v => (Array.isArray(v) ? pick(v[0]) : v && typeof v === "object" ? v.url || v.contentUrl || v.name : v);
  const title = ent(metaContent(html, "og:title") || metaContent(html, "twitter:title") || p.name || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").slice(0, 200);
  let image = pick(p.image) || metaContent(html, "og:image") || metaContent(html, "twitter:image");
  try { image = image ? new URL(image, pageUrl).href : ""; } catch { image = ""; }
  const price = offer.price || offer.lowPrice || metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount");
  const cur = String(offer.priceCurrency || metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency") || "").toUpperCase();
  return { title, image, brand: ent(pick(p.brand) || metaContent(html, "product:brand")), modelNo: ent(p.mpn || p.sku || ""), price: num(price), currency: cur,
           description: ent(metaContent(html, "og:description") || p.description || "").slice(0, 300) };
}
export function mapLink(d, url) {
  if (!d.title) return null;
  const host = new URL(url).hostname.replace(/^www\./, ""), cny = d.currency === "CNY" || d.currency === "RMB", cost = cny ? d.price : 0;
  return base("web", url, url, d.title, "", { brand: d.brand, modelNo: d.modelNo, image: d.image, icon: "🔗", description: d.description,
    skus: [{ id: "web-A", label: "Standard", attrs: {}, cost }], tiers: [{ minQty: 1, cost }],
    priceOriginal: d.price || 0, currencyOriginal: d.currency || "",          // non-CNY prices are shown to staff, never used as our cost
    seller: { id: "", name: host, city: "", years: 0, rating: 0, verified: false, factory: false } });
}

function json(body, status, headers) { return new Response(JSON.stringify(body), { status, headers }); }
