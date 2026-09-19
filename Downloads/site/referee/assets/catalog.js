/* Garsoore — canonical catalogue, China supply channel and consumer orders (window.RF.catalog / RF.china / RF.orders)
   No DOM. Garsoore SKUs (GRS-<CAT>-<5>) are the product identity; JD / 1688 / domestic sellers are only *sources* behind them.
   Consumers only ever see price() → { total, etaDays }; the cost build-up stays internal. */
(function () {
var RF = window.RF = window.RF || {};

/* ---------------------------------------------------------------- categories */
var CATS = [
  { id: "PHN", so: "Taleefanno", en: "Phones", icon: "📱" },
  { id: "CMP", so: "Kombiyuutar", en: "Computers", icon: "💻" },
  { id: "APL", so: "Qalab guri", en: "Appliances", icon: "🧊" },
  { id: "FRN", so: "Alaab guri", en: "Furniture", icon: "🛋️" },
  { id: "VEH", so: "Baabuur & qalab", en: "Vehicles & parts", icon: "🚗" },
  { id: "ELC", so: "Elektaroonik", en: "Electronics", icon: "🎧" },
  { id: "SOL", so: "Solar", en: "Solar", icon: "☀️" },
  { id: "HOM", so: "Guriga & jikada", en: "Home & kitchen", icon: "🍳" },
  { id: "CLO", so: "Dhar & kabo", en: "Clothing", icon: "👘" },
  { id: "BLD", so: "Dhismo & amni", en: "Building & security", icon: "🔧" }
];

/* ---------------------------------------------------------------- canonical products
   variants: exact identity — vsku + attributes. sources: where Garsoore can procure it. */
var P = [
  { sku: "GRS-CMP-00318", cat: "CMP", brand: "Lenovo", model: "Xiaoxin Pro 14 (2025)", modelNo: "83HB", icon: "💻", kg: 2.4,
    blurb: "Shaashad 2.8K OLED, Intel Core Ultra 5, batari 84Wh, miisaan 1.4kg.",
    specs: [["Processor", "Core Ultra 5 125H"], ["Shaashad", "14″ 2.8K OLED"], ["Batari", "84Wh"], ["Miisaan", "1.4 kg"]],
    variants: [{ vsku: "83HB-16-512-GR", label: "16GB · 512GB", ram: "16GB", storage: "512GB", color: "Grey", hex: "#9A9DA4", cost: 5299 },
               { vsku: "83HB-32-1T-GR", label: "32GB · 1TB", ram: "32GB", storage: "1TB", color: "Grey", hex: "#9A9DA4", cost: 6499 }],
    sources: [{ channel: "jd", ref: "100071383535" }] },
  { sku: "GRS-PHN-00142", cat: "PHN", brand: "Xiaomi", model: "Redmi Note 14 Pro", modelNo: "24115RA8EC", icon: "📱", kg: 0.6,
    blurb: "Kaamiro 200MP, batari 5,500mAh, shaashad AMOLED 6.67″, dallacaad 45W.",
    specs: [["Kaamiro", "200MP"], ["Batari", "5,500mAh"], ["Shaashad", "6.67″ AMOLED"], ["Dallacaad", "45W"]],
    variants: [{ vsku: "RN14P-12-256-BK", label: "12GB · 256GB", ram: "12GB", storage: "256GB", color: "Midnight", hex: "#2E3A4F", cost: 1699 },
               { vsku: "RN14P-12-256-WH", label: "12GB · 256GB", ram: "12GB", storage: "256GB", color: "White", hex: "#E9E4DA", cost: 1699 },
               { vsku: "RN14P-8-256-BK", label: "8GB · 256GB", ram: "8GB", storage: "256GB", color: "Midnight", hex: "#2E3A4F", cost: 1499 }],
    sources: [{ channel: "jd", ref: "100113459881" }] },
  { sku: "GRS-APL-00077", cat: "APL", brand: "Midea", model: "Inverter AC 1.5HP", modelNo: "KFR-35GW", icon: "🌀", kg: 42,
    blurb: "Qaboojiye inverter ah, koronto yar, 220V, ku habboon kulaylka Muqdisho.",
    specs: [["Awood", "1.5HP / 12,000 BTU"], ["Koronto", "220V · A++"], ["Qaylo", "22 dB"], ["Dammaanad", "12 bil"]],
    variants: [{ vsku: "KFR35-WH", label: "1.5HP", color: "White", hex: "#F3F1EC", cost: 1580 }],
    sources: [{ channel: "1688", ref: "712288934512" }] },
  { sku: "GRS-SOL-00031", cat: "SOL", brand: "Jinko", model: "550W panel + 5kW inverter set", modelNo: "JKM550-SET5", icon: "☀️", kg: 0,
    blurb: "Set solar guri oo dhammaystiran — 4 panel, inverter 5kW, rakibid Muqdisho gudaheeda.",
    specs: [["Panel", "4 × 550W"], ["Inverter", "5kW hybrid"], ["Rakibid", "Ku jirta"], ["Dammaanad", "5 sano"]],
    variants: [{ vsku: "JKSET5", label: "Set dhammaystiran", color: "—", price: 1140 }],
    sources: [{ channel: "domestic", seller: "Km4 Solar Center", city: "Muqdisho" }] },
  { sku: "GRS-PHN-00009", cat: "PHN", brand: "Samsung", model: "Galaxy A55 5G", modelNo: "SM-A556E", icon: "📱", kg: 0,
    blurb: "Cusub, sanduuqeeda ku jira, dammaanad iibiye 6 bil.",
    specs: [["Shaashad", "6.6″ AMOLED"], ["Kaamiro", "50MP"], ["Batari", "5,000mAh"], ["Xaalad", "Cusub"]],
    variants: [{ vsku: "A556E-8-256-NV", label: "8GB · 256GB", color: "Navy", hex: "#2B3A55", price: 365 },
               { vsku: "A556E-8-128-LC", label: "8GB · 128GB", color: "Lilac", hex: "#CDBFE0", price: 329 }],
    sources: [{ channel: "domestic", seller: "Hodan Mobile", city: "Muqdisho" }] },
  { sku: "GRS-ELC-00054", cat: "ELC", brand: "Anker", model: "Soundcore Q30", modelNo: "A3028", icon: "🎧", kg: 0,
    blurb: "Headphone noise-cancelling, 40 saac batari.",
    specs: [["ANC", "Haa"], ["Batari", "40 saac"], ["Bluetooth", "5.0"], ["Xaalad", "Cusub"]],
    variants: [{ vsku: "A3028-BK", label: "Standard", color: "Black", hex: "#222", price: 64 }],
    sources: [{ channel: "domestic", seller: "Bakaaraha Electronics", city: "Muqdisho" }] },
  { sku: "GRS-CMP-00402", cat: "CMP", brand: "HP", model: "LaserJet Pro M141w", modelNo: "7MD74A", icon: "🖨️", kg: 7.5,
    blurb: "Printer + scanner + copier, WiFi, ku habboon xafiis yar.",
    specs: [["Nooca", "Laser mono"], ["Xawaare", "20 ppm"], ["WiFi", "Haa"], ["Scan", "Haa"]],
    variants: [{ vsku: "7MD74A", label: "Standard", color: "White", hex: "#F3F1EC", cost: 1049 }],
    sources: [{ channel: "jd", ref: "100009938112" }] },
  { sku: "GRS-FRN-00021", cat: "FRN", brand: "Garsoore Local", model: "Kursi fadhi 3+2", modelNo: "SOFA-32", icon: "🛋️", kg: 0,
    blurb: "Kursi fadhi cusub, maro adag, Hodan workshop — keenis bilaash ah Muqdisho.",
    specs: [["Qaab", "3 + 2 kursi"], ["Maro", "Velvet"], ["Midab", "Beige"], ["Keenis", "Bilaash"]],
    variants: [{ vsku: "SOFA-32-BG", label: "3 + 2", color: "Beige", hex: "#D8C8AA", price: 420 }],
    sources: [{ channel: "domestic", seller: "Hodan Furniture", city: "Muqdisho" }] },
  { sku: "GRS-APL-00112", cat: "APL", brand: "Haier", model: "Fridge 2-door 260L", modelNo: "BCD-260", icon: "🧊", kg: 58,
    blurb: "Talaajad laba albaab, inverter, koronto yar.",
    specs: [["Mug", "260L"], ["Inverter", "Haa"], ["Koronto", "220V"], ["Dammaanad", "12 bil"]],
    variants: [{ vsku: "BCD260-SL", label: "260L", color: "Silver", hex: "#C9CCD1", cost: 1899 }],
    sources: [{ channel: "1688", ref: "683312001477" }] },
  { sku: "GRS-VEH-00008", cat: "VEH", brand: "Bajaj", model: "RE bajaj — cusub", modelNo: "RE-4S", icon: "🛺", kg: 0,
    blurb: "Bajaj cusub, diiwaan-gelin ku jirta, Km4.",
    specs: [["Mishiin", "236cc"], ["Shidaal", "Petrol"], ["Rakaab", "3"], ["Xaalad", "Cusub"]],
    variants: [{ vsku: "RE4S-GR", label: "Standard", color: "Green", hex: "#4E7A4A", price: 3450 }],
    sources: [{ channel: "domestic", seller: "Km4 Motors", city: "Muqdisho" }] }
];

/* core catalogue (~1,000 SKUs) generated from data/catalog.csv by tools/import-catalog.py */
if (window.RF_CATALOG_DATA) P = P.concat(window.RF_CATALOG_DATA);

/* ---------------------------------------------------------------- pricing (internal) */
var FX = 7.2;             // CNY per USD
var RULES = { cnFreight: 0.04, consolidation: 3, airPerKg: 7.5, seaPerKg: 1.1, duty: 0.05, margin: 0.10 };
function isChina(p) { return p.sources.some(function (s) { return s.channel !== "domestic"; }); }
function breakdown(costCny, kg) {
  var goods = costCny / FX, cn = goods * RULES.cnFreight, freight = kg > 20 ? kg * RULES.seaPerKg : Math.max(kg, 0.5) * RULES.airPerKg;
  var duty = (goods + freight) * RULES.duty, sub = goods + cn + RULES.consolidation + freight + duty;
  var margin = sub * RULES.margin;
  return { goods: goods, chinaFreight: cn, consolidation: RULES.consolidation, intlFreight: freight, duty: duty, margin: margin,
           total: Math.ceil(sub + margin), etaDays: kg > 20 ? 38 : 20 };
}
function chName(c) { return (RF.sources && RF.sources.ADAPTERS[c]) ? RF.sources.ADAPTERS[c].name.split(" ")[0].replace(".com", "") : ({ jd: "JD", "1688": "1688" }[c] || c); }
RF.chName = chName;
function price(p, v) {
  if (v.price != null && v.quoted) return { total: v.price, etaDays: v.etaDays || 20, local: false, quoted: true };
  if (v.price != null) return { total: v.price, etaDays: 0, local: true };
  var b = breakdown(v.cost, p.kg);
  return { total: b.total, etaDays: b.etaDays, local: false };
}

/* exact identity: never merge on names */
function sameVariant(a, b) {
  return a.brand === b.brand && a.modelNo === b.modelNo &&
    ["ram", "storage", "color", "region"].every(function (k) { return (a[k] || "") === (b[k] || ""); });
}

function card(p) {
  var v = p.variants[0], pr = price(p, v), src = p.sources[0];
  return { sku: p.sku, icon: p.icon, title: p.brand + " " + p.model + (v.label && v.label !== "Standard" ? " · " + v.label : ""),
    total: pr.total, etaDays: pr.etaDays, china: !pr.local,
    where: pr.local ? (src.seller + " · " + src.city) : chName(src.channel) };
}

RF.catalog = {
  CATS: CATS, products: P, isChina: isChina, price: price, sameVariant: sameVariant, card: card, _breakdown: breakdown,
  get: function (sku) { return P.filter(function (p) { return p.sku === sku; })[0]; },
  search: function (q, opts) {
    opts = opts || {}; q = (q || "").toLowerCase().trim();
    return P.filter(function (p) {
      if (opts.cat && p.cat !== opts.cat) return false;
      if (opts.china === true && !isChina(p)) return false;
      if (opts.china === false && isChina(p)) return false;
      if (!q) return true;
      var hay = (p.brand + " " + p.model + " " + p.modelNo + " " + p.blurb + " " + p.cat).toLowerCase();
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
  },
  /* one product from each category in turn — a mixed default feed instead of 200 phones in a row */
  mixed: function (list) {
    var by = {}, ids = [], out = [];
    list.forEach(function (p) { (by[p.cat] = by[p.cat] || (ids.push(p.cat), [])).push(p); });
    for (var i = 0, more = true; more; i++) { more = false; ids.forEach(function (c) { if (by[c][i]) { out.push(by[c][i]); more = true; } }); }
    return out;
  }
};

/* ---------------------------------------------------------------- China: paste a link */
function rng(seed) { var a = 0; for (var i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var LONGTAIL = [
  ["Xiaomi Mi Smart Kettle Pro", "🫖", 199, 1.8], ["Baseus 65W GaN charger", "🔌", 129, 0.3], ["Dell 27″ monitor P2723D", "🖥️", 1899, 8],
  ["Ugreen USB-C hub 7-in-1", "🧩", 159, 0.3], ["Deli office chair ergonomic", "🪑", 499, 16], ["Hikvision 4MP CCTV kit", "📷", 1299, 6],
  ["Philips air fryer 4.1L", "🍳", 599, 5], ["Huawei MatePad 11.5", "📲", 1999, 1.1]
];
RF.china = {
  parse: function (url) {
    url = String(url || "").trim();
    var m = url.match(/item\.(?:m\.)?jd\.com\/(?:product\/)?(\d{5,})/i); if (m) return { channel: "jd", ref: m[1] };
    m = url.match(/1688\.com\/offer\/(\d{5,})/i); if (m) return { channel: "1688", ref: m[1] };
    return null;
  },
  resolve: function (url) {
    var id = this.parse(url);
    if (!id) return { error: "Ku dheji link JD ama 1688 ah (tusaale: https://item.jd.com/100071383535.html)." };
    var hit = P.filter(function (p) { return p.sources.some(function (s) { return s.channel === id.channel && s.ref === id.ref; }); })[0];
    if (hit) return { mode: "catalog", product: hit };
    var r = rng(id.channel + id.ref), t = LONGTAIL[Math.floor(r() * LONGTAIL.length)];
    var cost = Math.round(t[2] * (0.9 + r() * 0.25));
    var p = { sku: "GRS-TMP-" + id.ref.slice(-5), cat: "ELC", brand: "", model: t[0], modelNo: id.channel.toUpperCase() + "-" + id.ref, icon: t[1], kg: t[3],
      blurb: "Dalab hal mar ah — Garsoore ayaa ka iibsan doona " + (id.channel === "jd" ? "JD" : "1688") + " oo kuu keeni doona.",
      specs: [["Il", id.channel === "jd" ? "JD.com" : "1688.com"], ["Tixraac", id.ref], ["Nooca", "Hal mar"], ["Celin", "7 maalmood"]],
      variants: [{ vsku: id.ref + "-STD", label: "Standard", cost: cost }], sources: [{ channel: id.channel, ref: id.ref }], oneoff: true };
    return { mode: "oneoff", product: p };
  }
};

/* ---------------------------------------------------------------- consumer orders
   Internal legs (supplier PO, China warehouse, consolidation, flight) are kept on the order but never shown by default. */
var KEY = "garsoore.orders";
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (x) { return []; } }
function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (x) {} }
var FLOW = {
  china: ["PLACED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY", "COMPLETED"],
  local: ["PLACED", "CONFIRMED", "READY", "COMPLETED"]
};
var STATE_SO = { PLACED: "Dalab", CONFIRMED: "La xaqiijiyay", SOURCING: "Laga iibsaday", IN_TRANSIT: "Soo socda", ARRIVED: "Yimid Soomaaliya", READY: "Diyaar", COMPLETED: "La qaatay", CANCELLED: "La joojiyay" };
RF.orders = {
  FLOW: FLOW, STATE_SO: STATE_SO,
  list: function () { return load(); },
  place: function (p, v, opts) {
    var pr = price(p, v), a = load(), china = !pr.local;
    var o = { id: "GRS-" + Date.now().toString(36).toUpperCase(), sku: p.sku, vsku: v.vsku, title: p.brand + " " + p.model, icon: p.icon,
      variant: [v.label, v.color].filter(function (x) { return x && x !== "—" && x !== "Standard"; }).join(" · "),
      total: pr.total + (opts.delivery ? 5 : 0), etaDays: pr.etaDays, flow: china ? "china" : "local", state: "PLACED",
      pickup: opts.delivery ? "Gaarsiin guriga" : "Xarunta Garsoore · Km4, Muqdisho", pay: opts.pay, escrow: "held",
      createdAt: new Date().toISOString(), oneoff: !!p.oneoff,
      internal: china ? { source: p.sources[0], cost: v.cost != null ? breakdown(v.cost, p.kg) : { quotedTotal: v.price }, legs: [] } : { seller: p.sources[0].seller } };
    a.unshift(o); save(a); return o;
  },
  advance: function (id) {
    var a = load(), o = a.filter(function (x) { return x.id === id; })[0]; if (!o) return null;
    var f = FLOW[o.flow], i = f.indexOf(o.state); if (i < 0 || i >= f.length - 1) return o;
    o.state = f[i + 1];
    var leg = { SOURCING: "Supplier PO → " + (o.internal.source ? o.internal.source.channel.toUpperCase() : ""), IN_TRANSIT: "Guangzhou consolidation → MGQ air", ARRIVED: "Customs cleared · Mogadishu" }[o.state];
    if (leg && o.internal.legs) o.internal.legs.push({ at: new Date().toISOString(), leg: leg });
    if (o.state === "COMPLETED") o.escrow = "released";
    save(a); return o;
  }
};

/* ---------------------------------------------------------------- staff-priced quote requests
   A pasted link for something outside the core range becomes a request. Staff price it (business/quotes.html);
   the customer then sees a fixed Garsoore price and can buy. */
var QKEY = "garsoore.quotes";
function qload() { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch (x) { return []; } }
function qsave(a) { try { localStorage.setItem(QKEY, JSON.stringify(a)); } catch (x) {} }
RF.quotes = {
  list: function () { return qload(); },
  request: function (product, note, contact) {
    var a = qload(), src = product.sources[0], q = { id: "Q-" + Date.now().toString(36).toUpperCase(), status: "pending", createdAt: new Date().toISOString(),
      title: (product.brand ? product.brand + " " : "") + product.model, icon: product.icon, platform: src.channel, ref: src.ref, url: RF.sources ? RF.sources.ADAPTERS[src.channel].url(src.ref) : "",
      seller: src.seller || "", kg: product.kg, estimate: price(product, product.variants[0]).total, note: note || "", contact: contact || RF.identity && RF.identity.get() || "" };
    a.unshift(q); qsave(a); return q;
  },
  /* a link we could not read automatically — staff price it from scratch (no estimate) */
  requestLink: function (id, url, contact) {
    var a = qload(), q = { id: "Q-" + Date.now().toString(36).toUpperCase(), status: "pending", createdAt: new Date().toISOString(),
      title: "Alaab ka timid " + (RF.chName ? RF.chName(id.platform) : id.platform), icon: "📦", platform: id.platform, ref: id.ref, url: url || "", seller: "", kg: null,
      estimate: null, note: "", contact: contact || RF.identity && RF.identity.get() || "" };
    a.unshift(q); qsave(a); return q;
  },
  price: function (id, total, etaDays, note) {
    var a = qload(), q = a.filter(function (x) { return x.id === id; })[0]; if (!q) return null;
    q.status = "quoted"; q.total = Math.round(total); q.etaDays = etaDays || 20; q.staffNote = note || ""; q.quotedAt = new Date().toISOString(); qsave(a); return q;
  },
  decline: function (id, why) { var a = qload(), q = a.filter(function (x) { return x.id === id; })[0]; if (q) { q.status = "declined"; q.staffNote = why || ""; qsave(a); } return q; },
  /* turn an accepted quote into a buyable product with a fixed price */
  asProduct: function (q) {
    return { sku: "GRS-Q-" + q.id.slice(2), cat: "ELC", brand: "", model: q.title, modelNo: q.ref, icon: q.icon || "📦", kg: q.kg || 1, oneoff: true,
      blurb: "Qiimo rasmi ah oo Garsoore ku bixisay. Waa ku sugan yahay ilaa la waayo.",
      specs: [["Il", RF.chName ? RF.chName(q.platform) : q.platform], ["Tixraac", q.ref], ["Qiimo", "Rasmi"], ["Celin", "7 maalmood"]],
      variants: [{ vsku: q.id, label: "Standard", price: q.total, quoted: true, etaDays: q.etaDays }], sources: [{ channel: q.platform, ref: q.ref, seller: q.seller }] };
  }
};
})();
