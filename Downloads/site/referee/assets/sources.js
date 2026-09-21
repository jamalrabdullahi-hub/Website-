/* Garsoore — China supply adapters (window.RF.sources), no DOM. Load after catalog.js.
   One adapter per platform: JD, 1688, Taobao/Tmall, Pinduoduo, Alibaba.com, plus direct Chinese vendors.
   Every adapter returns the SAME normalised offer shape, so catalogue, pricing, orders and B2B never care where it came from:
     { platform, ref, url, title, titleZh, brand, modelNo, icon, kg, currency:"CNY",
       skus:[{ id, label, attrs:{ram,storage,color}, cost }], tiers:[{ minQty, cost }], moq, stock,
       seller:{ id, name, city, years, rating, verified, factory } }
   LIVE mode: set RF.sources.config.endpoint to a server proxy (see server/china-proxy.js) holding the platform
   / aggregator API keys. Browsers must never hold those keys. Without an endpoint, adapters return deterministic demo data. */
(function () {
var RF = window.RF, C = RF.catalog;

function rng(seed) { var a = 0; for (var i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------------------------------------------------------- Chinese vendors (direct + store sellers) */
var VENDORS = [
  { id: "V-SZ-001", name: "Shenzhen Huaqiang Mobile Trading", zh: "深圳华强通讯", city: "Shenzhen", years: 9, rating: 4.8, verified: true, factory: false, cats: ["PHN", "ELC"], platforms: ["1688", "direct"] },
  { id: "V-GZ-002", name: "Guangzhou Baiyun Home Appliance", zh: "广州白云家电", city: "Guangzhou", years: 12, rating: 4.7, verified: true, factory: true, cats: ["APL"], platforms: ["1688", "alibaba"] },
  { id: "V-YW-003", name: "Yiwu Jinlong Household Goods", zh: "义乌金龙日用品", city: "Yiwu", years: 7, rating: 4.6, verified: true, factory: false, cats: ["HOM", "ELC"], platforms: ["1688", "pdd"] },
  { id: "V-FS-004", name: "Foshan Shunde Furniture Works", zh: "佛山顺德家具厂", city: "Foshan", years: 15, rating: 4.9, verified: true, factory: true, cats: ["FRN"], platforms: ["1688", "alibaba", "direct"] },
  { id: "V-HZ-005", name: "Hangzhou Solar Tech", zh: "杭州光伏科技", city: "Hangzhou", years: 6, rating: 4.5, verified: true, factory: true, cats: ["SOL"], platforms: ["1688", "alibaba"] },
  { id: "V-DG-006", name: "Dongguan Lianxin Computer Parts", zh: "东莞联鑫电脑配件", city: "Dongguan", years: 8, rating: 4.6, verified: false, factory: true, cats: ["CMP", "ELC"], platforms: ["1688", "taobao"] },
  { id: "V-JD-SELF", name: "JD Self-operated (京东自营)", zh: "京东自营", city: "Beijing", years: 20, rating: 4.9, verified: true, factory: false, cats: ["PHN", "CMP", "APL", "ELC"], platforms: ["jd"] },
  { id: "V-TM-007", name: "Xiaomi Official Flagship (Tmall)", zh: "小米官方旗舰店", city: "Beijing", years: 11, rating: 4.9, verified: true, factory: false, cats: ["PHN", "ELC", "APL"], platforms: ["taobao"] }
];

/* ---------------------------------------------------------------- demo supply pool (used when no live endpoint) */
var POOL = [
  ["Xiaomi Mi Smart Kettle Pro", "米家恒温电水壶Pro", "Xiaomi", "MJHWSH02YM", "🫖", 199, 1.8, "APL"],
  ["Baseus 65W GaN charger", "倍思65W氮化镓充电器", "Baseus", "CCGAN65", "🔌", 129, 0.3, "ELC"],
  ["Dell 27″ monitor P2723D", "戴尔27英寸显示器", "Dell", "P2723D", "🖥️", 1899, 8, "CMP"],
  ["Ugreen USB-C hub 7-in-1", "绿联七合一扩展坞", "Ugreen", "CM512", "🧩", 159, 0.3, "ELC"],
  ["Ergonomic office chair", "人体工学办公椅", "Deli", "DL-4930", "🪑", 499, 16, "FRN"],
  ["Hikvision 4MP CCTV kit (4 cam)", "海康威视监控套装", "Hikvision", "DS-7104", "📷", 1299, 6, "ELC"],
  ["Philips air fryer 4.1L", "飞利浦空气炸锅", "Philips", "HD9252", "🍳", 599, 5, "APL"],
  ["Huawei MatePad 11.5", "华为平板MatePad", "Huawei", "BTK-W00", "📲", 1999, 1.1, "CMP"],
  ["Solar LED street light 200W", "太阳能路灯200W", "", "SL-200", "💡", 268, 9, "SOL"],
  ["Stainless steel gas stove 2-burner", "不锈钢双灶燃气灶", "", "GS-2B", "🔥", 189, 7, "APL"],
  ["Men's cotton thobe (khamiis)", "男士棉质长袍", "", "TH-01", "👘", 58, 0.6, "HOM"],
  ["Plastic chairs stackable (set 10)", "塑料叠椅10把", "", "PC-10", "🪑", 320, 25, "FRN"]
];

/* ---------------------------------------------------------------- adapters */
function demoOffer(platform, ref, hint) {
  var r = rng(platform + ref), row = hint || POOL[Math.floor(r() * POOL.length)];
  var base = Math.round(row[5] * (0.88 + r() * 0.24)), bulk = platform === "1688" || platform === "alibaba";
  var vend = VENDORS.filter(function (v) { return v.platforms.indexOf(platform === "tmall" ? "taobao" : platform) >= 0; });
  var seller = vend.length ? vend[Math.floor(r() * vend.length)] : VENDORS[0];
  var skus = [{ id: ref + "-A", label: "Standard", attrs: {}, cost: base }];
  if (r() > 0.5) skus.push({ id: ref + "-B", label: "Pro / weyn", attrs: {}, cost: Math.round(base * 1.22) });
  return {
    platform: platform, ref: ref, url: A[platform].url(ref), title: row[0], titleZh: row[1], brand: row[2], modelNo: row[3],
    icon: row[4], kg: row[6], cat: row[7], currency: "CNY", skus: skus,
    moq: bulk ? [2, 5, 10, 20][Math.floor(r() * 4)] : 1,
    tiers: bulk ? [{ minQty: 1, cost: base }, { minQty: 50, cost: Math.round(base * 0.9) }, { minQty: 200, cost: Math.round(base * 0.82) }] : [{ minQty: 1, cost: base }],
    stock: 50 + Math.floor(r() * 5000), seller: seller, live: false
  };
}
var A = {
  jd:      { name: "JD.com", zh: "京东", retail: true,  re: /(?:item\.(?:m\.)?jd\.com\/(?:product\/)?|jd\.com\/.*?sku=)(\d{5,})/i, url: function (id) { return "https://item.jd.com/" + id + ".html"; } },
  "1688":  { name: "1688.com", zh: "阿里巴巴1688", retail: false, re: /1688\.com\/offer\/(\d{5,})/i, url: function (id) { return "https://detail.1688.com/offer/" + id + ".html"; } },
  taobao:  { name: "Taobao / Tmall", zh: "淘宝/天猫", retail: true, re: /(?:taobao|tmall)\.com\/.*?[?&]id=(\d{5,})/i, url: function (id) { return "https://item.taobao.com/item.htm?id=" + id; } },
  /* AliExpress — the retail face of the same Chinese supply base. Sold by the piece at a fixed price, in English,
     and it will sell one. That is what makes it the single-unit channel 1688 cannot be: no MOQ, no negotiation.
     Short a.aliexpress.com links cannot be read without resolving them, so those fall through to the generic reader. */
  aliexpress: { name: "AliExpress", zh: "速卖通", retail: true, re: /aliexpress\.[a-z.]{2,8}\/item\/(\d{6,})/i,
                url: function (id) { return "https://www.aliexpress.com/item/" + id + ".html"; } },
  /* CJdropshipping — a dropshipping catalogue, so every listing is MOQ 1 with a visible price. Sits on the consumer
     side for that reason, even though CJ is a wholesaler underneath. */
  cj:      { name: "CJdropshipping", zh: "", retail: true, re: /cjdropshipping\.com\/product\/[^?#]*?-p-([A-Za-z0-9-]{6,})\.html/i,
             url: function (id) { return "https://cjdropshipping.com/product/-p-" + id + ".html"; } },
  /* SHEIN — retail fashion, sold by the piece. The goods id is the -p-NNNNNN segment of any regional host
     (us.shein.com, m.shein.com, www.shein.com/ar, …), so the region is dropped and the id kept. */
  shein:   { name: "SHEIN", zh: "希音", retail: true, re: /shein\.com\/.*?-p-(\d{5,})/i, url: function (id) { return "https://us.shein.com/-p-" + id + ".html"; } },
  pdd:     { name: "Pinduoduo", zh: "拼多多", retail: true, re: /(?:yangkeduo|pinduoduo)\.com\/.*?goods_id=(\d{5,})/i, url: function (id) { return "https://mobile.yangkeduo.com/goods.html?goods_id=" + id; } },
  alibaba: { name: "Alibaba.com", zh: "阿里巴巴国际站", retail: false, re: /alibaba\.com\/product-detail\/[^?#]*?_(\d{6,})\.html/i, url: function (id) { return "https://www.alibaba.com/product-detail/_" + id + ".html"; } },
  /* Made-in-China.com — source of the real core catalogue (tools/harvest-mic.py). The full product URL is the reference
     (it carries the supplier's subdomain). No live search API: pasted links are read by the proxy's generic /link reader. */
  mic:     { name: "Made-in-China", zh: "中国制造网", retail: false, nosearch: true, re: /(https?:\/\/[a-z0-9-]+\.en\.made-in-china\.com\/product\/[A-Za-z0-9]+\/[^\s?#"]+?\.html)/i, url: function (id) { return id; } },
  web:     { name: "Web", zh: "", retail: true, nosearch: true, re: /(?!)/, url: function (id) { return id; } }   // any other product link
};

/* ---------------------------------------------------------------- which marketplace belongs to which shop
   The two sites buy from different halves of China and they should not pretend otherwise.

     buurwen.com           JD, Tmall/Taobao, Pinduoduo — retail. One piece, a fixed price, a brand you can name.
     business.buurwen.com  1688, Alibaba.com, Made-in-China — wholesale. A minimum order, tier pricing, a factory.

   A person pasting a 1688 link into the consumer shop is not making a mistake, they are on the wrong site, so we carry
   the link across rather than refusing it. The business side accepts a retail link too — buying one JD sample before
   committing to a 1688 carton is exactly what a trader should do — but it says plainly that retail pricing applies.
   "web" (any other product page) is allowed on both: a link is a link. */
var SURFACES = {
  consumer: { platforms: ["jd", "taobao", "pdd", "aliexpress", "cj", "shein"], kind: "retail", so: "Tafaariiq", en: "Retail" },
  business: { platforms: ["1688", "alibaba", "mic"],    kind: "wholesale", so: "Jumlad",    en: "Wholesale" }
};
function surfaceOf(platform) {
  if (platform === "web") return null;                                   // belongs to neither, welcome on both
  return SURFACES.business.platforms.indexOf(platform) >= 0 ? "business" : "consumer";
}
function platformsFor(surface) { return (SURFACES[surface] || SURFACES.consumer).platforms.slice(); }
function allowedOn(surface, platform) { var s = surfaceOf(platform); return !s || s === surface; }
/* Where the current page sits. business/*.html sets window.SURFACE; everything else is the consumer shop. */
function here() { return window.SURFACE === "business" ? "business" : "consumer"; }
/* supplier directory: the real suppliers behind the catalogue when the harvest has run, else the illustrative list above */
if (window.RF_SUPPLIERS && window.RF_SUPPLIERS.length) VENDORS = window.RF_SUPPLIERS.map(function (v, i) {
  return { id: "V-MIC-" + (i + 1), name: v.name, zh: "", city: "", verified: false, factory: /manufactur|factory|industr|technology|co\., ltd/i.test(v.name) && false,
    cats: v.cats, platforms: [v.platform], products: v.products, sample: v.sample, real: true };
});
var config = { endpoint: (window.GARSOORE_CONFIG && window.GARSOORE_CONFIG.chinaEndpoint) || "", fx: 7.2 };

/* Pull the first web link out of whatever was pasted: a bare URL, "item.jd.com/123.html" without https, or a WeChat / Taobao
   share text such as "【淘宝】https://e.tb.cn/h.abc 「Some item」". Returns "" when the text is not a link (i.e. a normal search). */
var URL_RE = /https?:\/\/[^\s\u3000-\u303f\u4e00-\u9fff\uff00-\uffef<>"'【】「」（）]+/i;
function urlOf(text) {
  text = String(text || "").trim();
  var m = text.match(URL_RE);
  if (m) return m[0].replace(/[).,;!?]+$/, "");
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(text) && text.indexOf(" ") < 0) return "https://" + text;   // scheme-less link
  return "";
}
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (x) { return ""; } }
function shortId(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36).slice(-5).toUpperCase().padStart(5, "0"); }
function identify(text) {
  var url = urlOf(text); if (!url) return null;
  for (var k in A) { var m = url.match(A[k].re); if (m) return { platform: k, ref: m[1], url: url }; }
  return { platform: "web", ref: url, url: url };            // any other product page
}
function label(o) { return o.platform === "web" ? (hostOf(o.url || o.ref) || "Web") : A[o.platform].name; }

/* Demo stand-in for an unknown web page: title comes from the link itself, price is unknown (→ staff quote). No invented prices. */
function demoWeb(url) {
  var u; try { u = new URL(url); } catch (x) { return null; }
  var seg = u.pathname.split("/").filter(Boolean).map(function (s) { try { return decodeURIComponent(s); } catch (x) { return s; } })
    .sort(function (a, b) { return (b.match(/[A-Za-z\u4e00-\u9fff]/g) || []).length - (a.match(/[A-Za-z\u4e00-\u9fff]/g) || []).length; })[0] || "";
  var slug = seg.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_+.]+/g, " ").replace(/\d{6,}/g, "").trim();
  var host = u.hostname.replace(/^www\./, "");
  return { platform: "web", ref: url, url: url, title: slug.length > 3 ? slug.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }) : host, titleZh: "", brand: "", modelNo: "",
    icon: "🔗", kg: 1, kgGuess: true, cat: "ELC", currency: "CNY", moq: 1, stock: 0, live: false, demoWeb: true, confidence: "low",
    skus: [{ id: shortId(url) + "-A", label: "Standard", attrs: {}, cost: 0 }], tiers: [{ minQty: 1, cost: 0 }],
    seller: { id: "", name: host, city: "", years: 0, rating: 0, verified: false, factory: false } };
}
/* live: ask the proxy to read ANY product page (title / image / price from its page data) */
function fetchLink(url, cb) {
  fetch(config.endpoint + "/link?url=" + encodeURIComponent(url))
    .then(function (r) { if (!r.ok) throw new Error("proxy " + r.status); return r.json(); })
    .then(function (o) {
      o.live = true;
      if (!o.skus) o.skus = (o.tiers && o.tiers.length) ? [{ id: o.ref + "-STD", label: "Standard", cost: o.tiers[0].cost }] : [];
      cb(null, o);
    })
    .catch(function (err) { cb(err, null); });
}
/* sync in demo mode; async live via proxy. Live mode NEVER substitutes demo data for a real product:
   a known platform tries its Apify route first, then the generic page reader, then gives up (→ staff quote). */
function fetchOffer(platform, ref, cb) {
  if (!config.endpoint) return cb(null, platform === "web" ? demoWeb(ref) : demoOffer(platform, ref));
  if (platform === "web") return fetchLink(ref, cb);
  fetch(config.endpoint + "/item?platform=" + encodeURIComponent(platform) + "&id=" + encodeURIComponent(ref))
    .then(function (r) { if (!r.ok) throw new Error("proxy " + r.status); return r.json(); })
    .then(function (o) { o.live = true; cb(null, o); })
    .catch(function (err) {
      fetchLink(A[platform].url(ref), function (e2, o2) { if (o2) { o2.platform = platform; o2.ref = ref; o2.viaLink = true; } cb(o2 ? null : err, o2 || null); });
    });
}

/* normalise an offer into a Garsoore product; attach to an existing catalogue SKU only on exact identity */
function toProduct(o) {
  var existing = C.products.filter(function (p) {
    return p.sources.some(function (s) { return s.channel === o.platform && s.ref === o.ref; }) ||
      (o.brand && o.modelNo && p.brand === o.brand && p.modelNo === o.modelNo);
  })[0];
  if (existing) {
    if (!existing.sources.some(function (s) { return s.channel === o.platform && s.ref === o.ref; }))
      existing.sources.push({ channel: o.platform, ref: o.ref, seller: o.seller.name });
    return { mode: "catalog", product: existing, offer: o };
  }
  var name = label(o), web = o.platform === "web";
  var p = { sku: "GRS-TMP-" + (web ? shortId(o.ref) : o.ref.slice(-5)), image: /^https?:\/\//.test(o.image || "") ? o.image : "", pageUrl: /^https?:\/\//.test(o.url || "") ? o.url : "", cat: o.cat || "ELC", brand: o.brand || "", model: (o.brand && o.title.indexOf(o.brand) === 0) ? o.title.slice(o.brand.length).trim() : o.title, modelNo: o.modelNo || "", icon: o.icon || "📦", kg: o.kg || 1,
    blurb: web ? "Alaab laga helay " + name + ". Garsoore ayaa hubinaysa oo kuu keeni doona — koox ayaa kuu soo diraysa qiimo rasmi ah."
               : "Dalab hal mar ah — Garsoore ayaa ka iibsan doona " + name + " oo kuu keeni doona.",
    specs: [["Il", name], ["Iibiye", (o.seller.verified ? "✓ " : "") + (o.seller.city || o.seller.name || "—")], ["Kayd", o.stock > 100 ? "Badan" : o.stock ? String(o.stock) : "La hubinayo"], ["Celin", "7 maalmood"]],
    /* a source can be readable but priceless (JD masks its price): keep the real name and photo, leave cost unknown
       so price() returns null and the page asks for a staff quote instead of inventing a number */
    variants: (o.skus && o.skus.length ? o.skus.map(function (s) { return { vsku: s.id, label: s.label, cost: s.cost }; })
                                       : [{ vsku: o.ref + "-STD", label: "Standard" }]),
    sources: [{ channel: o.platform, ref: o.ref, seller: o.seller.name }], oneoff: true };
  return { mode: "oneoff", product: p, offer: o };
}

/* cross-platform search (demo pool; live → proxy /search) */
function search(q, opts, cb) {
  opts = opts || {}; q = (q || "").toLowerCase();
  var plats = opts.platforms || ["jd", "1688", "taobao", "pdd", "alibaba"];
  if (config.endpoint) {
    return fetch(config.endpoint + "/search?q=" + encodeURIComponent(q) + "&platforms=" + plats.join(","))
      .then(function (r) { return r.json(); })
      .then(function (a) { var core = coreOffers(q, plats); cb(core.concat(Array.isArray(a) ? a : [])); })
      .catch(function () { cb(coreOffers(q, plats)); });
  }
  cb(demoSearch(q, plats));
}
function coreOffers(q, plats) {
  var words = (q || "").toLowerCase().split(/\s+/).filter(Boolean), out = [];
  C.products.forEach(function (p) {
    if (!p.core) return;
    var src = p.sources[0]; if (plats.indexOf(src.channel) < 0) return;
    var hay = (p.brand + " " + p.model + " " + p.modelNo + " " + p.cat).toLowerCase();
    if (words.length && !words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
    var base = p.variants[0].cost, vend = VENDORS.filter(function (v) { return v.name === src.seller; })[0] || VENDORS[0];
    out.push({ platform: src.channel, ref: p.sku, url: src.url || A[src.channel].url(src.ref || "0"), title: (p.brand ? p.brand + " " : "") + p.model, titleZh: p.sku,
      brand: p.brand, modelNo: p.modelNo, icon: p.icon, kg: p.kg, cat: p.cat, currency: "CNY",
      skus: p.variants.map(function (v) { return { id: v.vsku, label: v.label, attrs: {}, cost: v.cost }; }),
      moq: p.moq || 1, tiers: [{ minQty: 1, cost: base }, { minQty: 50, cost: Math.round(base * .93) }, { minQty: 200, cost: Math.round(base * .86) }],
      stock: 500, seller: vend, live: false, core: true, verified: p.verified });
  });
  return out;
}
function demoSearch(q, plats) {
  /* Only ever the real catalogue. This used to fall back to POOL when nothing matched, which invented products at
     invented prices and attached them to REAL supplier names — filtering by Alibaba, where Garsoore has no listings
     at all, produced a convincing page of goods that do not exist. An empty result is the honest answer, and the
     caller turns it into "paste a link instead". */
  return coreOffers(q, plats).slice(0, 40);
}

/* landed pricing — consumer gets total only; business gets per-unit landed + tier */
function tierCost(o, qty) { var c = o.tiers[0].cost; o.tiers.forEach(function (t) { if (qty >= t.minQty) c = t.cost; }); return c; }
function landed(o, qty, mode) {
  qty = Math.max(qty || 1, o.moq || 1);
  var unitCny = tierCost(o, qty), kg = (o.kg || 1) * qty;
  var sea = mode === "sea" || kg > 300;
  var b = C._breakdown(unitCny * qty, kg);
  if (sea) { b.intlFreight = kg * 0.45 + 180; b.etaDays = 42; }
  var total = Math.ceil(b.goods + b.chinaFreight + b.consolidation + b.intlFreight + b.duty + b.margin);
  return { qty: qty, unitCny: unitCny, total: total, perUnit: Math.round(total / qty * 100) / 100, etaDays: b.etaDays, mode: sea ? "sea" : "air", moq: o.moq };
}

/* business: send a China procurement RFQ into the existing B2B flow, with Garsoore China as a quoting supplier */
function procure(o, qty, buyer) {
  if (!RF.b2b) return { error: "B2B module not loaded." };
  var L = landed(o, qty);
  var rfq = RF.b2b.rfqs.post({ buyer: buyer || RF.identity.get() || "Your company", kind: "good", category: "China procurement",
    title: o.title + " (" + A[o.platform].name + ")", qty: L.qty, unit: "pcs", deliverTo: "Mogadishu", incoterm: "DAP",
    notes: "Source: " + o.url + " · seller " + o.seller.name, source: { platform: o.platform, ref: o.ref } });
  RF.b2b.rfqs.quote(rfq.id, { supplier: "Garsoore China Procurement", unitPrice: L.perUnit, qty: L.qty, leadDays: L.etaDays, incoterm: "DAP Mogadishu",
    note: "Landed, all-in: goods + China freight + consolidation + " + L.mode + " freight + duty." });
  return { rfq: rfq, landed: L };
}

RF.sources = { urlOf: urlOf, hostOf: hostOf, label: label, ADAPTERS: A, VENDORS: VENDORS, config: config, identify: identify, fetchOffer: fetchOffer, toProduct: toProduct,
  search: search, landed: landed, tierCost: tierCost, procure: procure,
  SURFACES: SURFACES, surfaceOf: surfaceOf, platformsFor: platformsFor, allowedOn: allowedOn, here: here,
  /* the other site's address for this same link, so a misplaced paste is one tap from being handled */
  /* A link to the SAME page on the other shop. crossLink below is for handing a pasted supplier link over; this is
     for ordinary pages, where only the host changes. Locally the two shops are folders, not hosts. */
  crossHref: function (path, surface) {
    var root = (location.hostname.split(".").slice(-2).join(".") || "buurwen.com");
    if (/^(localhost|127\.|\[)/.test(location.hostname) || location.protocol === "file:")
      return (surface === "business" ? "business/" : "../") + path;
    return location.protocol + "//" + (surface === "business" ? "business." + root : root) + "/" + path;
  },
  crossLink: function (url, surface) {
    var root = (location.hostname.split(".").slice(-2).join(".") || "buurwen.com"), q = "china.html?u=" + encodeURIComponent(url);
    if (/^(localhost|127\.|\[)/.test(location.hostname) || location.protocol === "file:")
      return surface === "business" ? "business/" + q : "../" + q;       // local: the two shops are folders
    return location.protocol + "//" + (surface === "business" ? "business." + root : root) + "/" + q;
  } };

/* consumer entry point keeps the same API: RF.china.resolve(url) → { mode, product } | { error } */
RF.china = {
  parse: identify,
  resolve: function (url) {
    var id = identify(url);
    if (!id) return { error: "Ku dheji link alaab (JD, 1688, Taobao, Pinduoduo, Alibaba ama bog kale)." };
    var out; fetchOffer(id.platform, id.ref, function (err, o) { out = o ? toProduct(o) : null; }); // sync in demo mode
    return out || { pending: true, id: id };
  },
  resolveAsync: function (url, cb) {
    var id = identify(url); if (!id) return cb({ error: this.resolve(url).error });
    if (id.platform === "web" && !/^https?:\/\/[^/]+\.[^/]+/.test(id.url)) return cb({ error: "Link-gan ma sax aha." });
    fetchOffer(id.platform, id.ref, function (err, o) {
      if (!o) return cb({ error: "Ma helin macluumaadka alaabtan hadda — waxaad codsan kartaa qiimo rasmi ah.", canQuote: true, id: id, url: url });
      cb(toProduct(o)); });
  }
};
})();
