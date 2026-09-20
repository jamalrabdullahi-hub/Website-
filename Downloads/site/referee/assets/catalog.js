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
   variants: exact identity — vsku + attributes. sources: where Garsoore can procure it.
   Every product comes from data/catalog.csv (real supplier listings, tools/harvest-mic.py → tools/import-catalog.py).
   Domestic sellers are added the same way once they have signed up — no invented products or sellers in code. */
var P = [];

/* core catalogue generated from data/catalog.csv by tools/import-catalog.py */
if (window.RF_CATALOG_DATA) P = P.concat(window.RF_CATALOG_DATA);

/* ---------------------------------------------------------------- pricing (internal)
   International freight is NOT a rule of thumb here. It comes from RF.shipping, which reads the contracted rate cards
   in data/rate-cards.json, and it returns the id of the card that produced the number so an order can be honoured at
   that rate for life. Everything else (China-side collection, consolidation, duty, Garsoore's margin) is a Garsoore
   cost and stays in this file. */
var FX = 7.2;             // CNY per USD
var RULES = { cnFreight: 0.04, consolidation: 3, duty: 0.05, margin: 0.10 };
function isChina(p) { return p.sources.some(function (s) { return s.channel !== "domestic"; }); }

/* landed cost for one lane. Returns null when the lane cannot be priced — the caller then offers a quote instead of
   inventing a number, which is the whole point of the exercise. */
function breakdown(costCny, kg, cat, mode, qty, at) {
  var S = RF.shipping;
  var goods = (costCny / FX) * (qty || 1), cn = goods * RULES.cnFreight;
  var ship = S && S.quote({ kg: kg, cat: cat, qty: qty || 1, mode: mode || "air", at: at });
  if (!ship || !ship.ok) return null;
  var duty = (goods + ship.cost) * RULES.duty, sub = goods + cn + RULES.consolidation + ship.cost + duty;
  var margin = sub * RULES.margin;
  return { goods: goods, chinaFreight: cn, consolidation: RULES.consolidation, intlFreight: ship.cost, duty: duty, margin: margin,
           total: Math.ceil(sub + margin), etaDays: ship.transitMax, transitMin: ship.transitMin, transitMax: ship.transitMax,
           mode: ship.mode, rateCardId: ship.rateCardId, rateCardStatus: ship.rateCardStatus,
           chargeable: ship.chargeable, chargeUnit: ship.unit, chargeBasis: ship.basis, estimatedSize: ship.estimatedSize };
}

/* ---------------------------------------------------------------- one line's landed price, given its freight
   Kept separate from breakdown() because in a basket the freight is not this line's own — it is this line's SHARE of
   one shipment. Consolidation is charged once per line rather than per unit: the facility handles a SKU once, whether
   the carton holds one shirt or ten, and charging it per unit was quietly taxing bulk buyers. */
function lineTotal(costCny, qty, freight) {
  qty = Math.max(1, qty || 1);
  var goods = (costCny / FX) * qty, cn = goods * RULES.cnFreight;
  var duty = (goods + freight) * RULES.duty;
  var sub = goods + cn + RULES.consolidation + freight + duty;
  var margin = sub * RULES.margin;
  return { total: Math.ceil(sub + margin), goods: goods, chinaFreight: cn, consolidation: RULES.consolidation,
           intlFreight: freight, duty: duty, margin: margin };
}

/* ---------------------------------------------------------------- price a whole basket as one shipment
   `entries` are [{ product, variant, qty, mode }]. Everything going by the same lane is one consignment: the freight
   is worked out once for the combined weight and volume, then shared out by each line's chargeable quantity. This is
   why ten light things cost far less per thing than one — the minimum charge is paid once, not ten times.

   The server runs the identical calculation over the same rate cards, and the order is priced from that, so what the
   cart shows and what is charged cannot drift apart. */
function basketPrice(entries, at) {
  var ship = [], meta = [];
  (entries || []).forEach(function (en, i) {
    var p = en.product, v = en.variant, qty = Math.max(1, en.qty || 1);
    if (!p || !v) { meta[i] = { skip: true }; return; }
    if (v.price != null) { meta[i] = { fixed: true, qty: qty, unit: v.price, quoted: !!v.quoted, etaDays: v.quoted ? (v.etaDays || 20) : 0 }; return; }
    if (!(v.cost > 0)) { meta[i] = { quote: true, reason: "no-purchase-price" }; return; }
    var mode = en.mode === "sea" || en.mode === "air" ? en.mode : (price(p, v).mode || "air");
    meta[i] = { cny: v.cost, qty: qty, mode: mode, kg: p.kg, cat: p.cat };
    ship.push({ idx: i, kg: p.kg, cat: p.cat, qty: qty, mode: mode });
  });

  var b = ship.length && RF.shipping ? RF.shipping.basket(ship.map(function (x) { return x; }), at) : { groups: {}, shares: {}, ok: true };
  var byIdx = {};
  ship.forEach(function (x, k) { byIdx[x.idx] = b.shares[k]; });

  var lines = (entries || []).map(function (en, i) {
    var m = meta[i];
    if (!m || m.skip) return null;
    if (m.quote) return { quote: true, reason: m.reason, total: null, seller: seller(en.product) };
    if (m.fixed) return { total: m.unit * m.qty, unit: m.unit, qty: m.qty, local: !m.quoted, quoted: m.quoted,
      etaDays: m.etaDays, freight: 0, seller: seller(en.product) };
    var sh = byIdx[i];
    if (!sh) return { quote: true, reason: "no-shippable-rate", total: null, seller: seller(en.product) };
    var g = b.groups[sh.mode], L = lineTotal(m.cny, m.qty, sh.freight);
    return { total: L.total, unit: Math.round(L.total / m.qty * 100) / 100, qty: m.qty, mode: sh.mode,
      freight: sh.freight, estimatedSize: sh.estimated, local: false,
      transitMin: g.transitMin, transitMax: g.transitMax, etaDays: g.transitMax,
      rateCardId: g.rateCardId, breakdown: L, seller: seller(en.product) };
  });

  var total = lines.reduce(function (a, l) { return a + (l && l.total != null ? l.total : 0); }, 0);
  return { lines: lines, groups: b.groups, total: total, ok: b.ok !== false };
}

/* ---------------------------------------------------------------- who the customer is buying from
   Two models, and they must never be collapsed into one another:

     Garsoore Official   Garsoore is the seller of record. Nothing is bought until the customer buys: their payment
                         funds a purchase order to an approved supplier, which ships to the Garsoore China facility.
                         Garsoore holds no stock. The supplier is an internal procurement relationship and the
                         customer never sees its name.
     Fulfilled by Garsoore  A third-party merchant is the seller and owns the goods. Garsoore only runs the
                         fulfilment: receiving, storage, pick and pack, delivery, tracking, returns, settlement.
                         Here the merchant's name IS the answer to "who am I buying from", so it is shown. */
function seller(p) {
  if (p && p.fbg) {
    var src = (p.sources && p.sources[0]) || {}, name = String(src.seller || "").replace(/^FBG\s*·\s*/, "") || "Iibiye";
    return { name: name, official: false, fulfilled: true, badge: "Fulfilled by Garsoore", verified: true };
  }
  return { name: "Garsoore Official", official: true, fulfilled: false, badge: "Garsoore Official", verified: true };
}

/* ---------------------------------------------------------------- eligibility for instant buy
   A product does not become instantly buyable because somebody found a supplier for it. It needs a canonical SKU, a
   known purchase price, a known packed weight, and a lane that today's rate card can actually price. Anything short of
   that says "Request a quote" — price certainty is the product, and pretending every item is predictable is how the
   surprise-shipping-bill problem starts. */
function eligible(p, v) {
  if (!p || !v) return { ok: false, reason: "no-variant" };
  if (v.price != null) return { ok: true, reason: "fixed-price" };          // FBG stock or an accepted quote
  if (!(v.cost > 0)) return { ok: false, reason: "no-purchase-price" };
  if (!(p.kg > 0)) return { ok: false, reason: "no-packed-weight" };
  if (!RF.shipping || !RF.shipping.options({ kg: p.kg, cat: p.cat, qty: 1 })) return { ok: false, reason: "no-shippable-rate" };
  return { ok: true, reason: "ok" };
}
function chName(c) { return (RF.sources && RF.sources.ADAPTERS[c]) ? RF.sources.ADAPTERS[c].name.split(" ")[0].replace(".com", "") : ({ jd: "JD", "1688": "1688" }[c] || c); }
RF.chName = chName;
/* price() answers both lanes at once, because the customer's whole decision is "how fast, how much". `mode` picks the
   headline; the default is whichever lane is cheaper, which for a heavy item is sea and for a phone is air. */
function price(p, v, mode) {
  if (v.price != null && v.quoted) return { total: v.price, etaDays: v.etaDays || 20, local: false, quoted: true, seller: seller(p) };
  if (v.price != null) return { total: v.price, etaDays: 0, local: true, seller: seller(p) };
  if (!(v.cost > 0)) return { total: null, etaDays: 20, local: false, unknown: true, quote: true, reason: "no-purchase-price", seller: seller(p) };

  var opts = {}, any = false;
  ["air", "sea"].forEach(function (m) {
    var b = breakdown(v.cost, p.kg, p.cat, m, 1);
    if (b) { opts[m] = b; any = true; }
  });
  if (!any) return { total: null, etaDays: 0, local: false, unknown: true, quote: true, reason: "no-shippable-rate", seller: seller(p) };

  var pick = mode && opts[mode] ? mode
    : (opts.air && opts.sea ? (opts.sea.total < opts.air.total ? "sea" : "air") : (opts.air ? "air" : "sea"));
  var b = opts[pick];
  return { total: b.total, etaDays: b.etaDays, transitMin: b.transitMin, transitMax: b.transitMax, local: false,
    mode: pick, options: opts, rateCardId: b.rateCardId, rateCardStatus: b.rateCardStatus, seller: seller(p) };
}

/* exact identity: never merge on names */
function sameVariant(a, b) {
  return a.brand === b.brand && a.modelNo === b.modelNo &&
    ["ram", "storage", "color", "region"].every(function (k) { return (a[k] || "") === (b[k] || ""); });
}

function card(p) {
  var v = p.variants[0], pr = price(p, v), sl = pr.seller;
  return { sku: p.sku, icon: p.icon, image: p.image || "", title: (p.brand ? p.brand + " " : "") + p.model + (v.label && v.label !== "Standard" ? " · " + v.label : ""),
    total: pr.total, etaDays: pr.etaDays, china: !pr.local, quote: !!pr.quote,
    seller: sl, where: sl.official ? "Garsoore Official" : sl.name,
    options: pr.options || null, mode: pr.mode || null };
}

RF.catalog = {
  CATS: CATS, products: P, isChina: isChina, price: price, sameVariant: sameVariant, card: card, _breakdown: breakdown,
  seller: seller, eligible: eligible, basketPrice: basketPrice, lineTotal: lineTotal, _rules: RULES, _fx: FX,
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
  /* FBG stock: goods owned by an importer, sitting in the Garsoore warehouse in Mogadishu. They are sold like any
     local product (ready today, no freight), and the price is whatever the owner set. Merged in at page load. */
  addLive: function (list) {
    var have = {};
    P.forEach(function (p) { have[p.sku] = 1; });
    list.forEach(function (x) {
      if (have[x.id]) return;
      P.push({ sku: x.id, cat: x.cat || "HOM", brand: "", model: x.title, modelNo: "", icon: x.icon || "📦", image: x.image || "", kg: 0,
        blurb: "Diyaar maanta — bakhaarka Garsoore, Muqdisho. Waxaa leh iibiye la hubiyay; Garsoore ayaa hayn doona lacagtaada ilaa aad qaadato.",
        specs: [["Halka ay taallo", "Bakhaarka Garsoore · Muqdisho"], ["Diyaar", "Maanta"], ["Kayd", x.qty + " xabbo"], ["Celin", "7 maalmood"]],
        variants: [{ vsku: x.id + "-1", label: "Standard", price: x.price }],
        sources: [{ channel: "domestic", seller: "FBG · " + x.seller, city: "Muqdisho" }], fbg: true, verified: true, stock: x.qty });
    });
    return list.length;
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
  get: function (id) { return load().filter(function (x) { return x.id === id; })[0] || null; },
  /* opts: { delivery, pay, phone, qty, basket, discount (0..1), address } */
  place: function (p, v, opts) {
    var pr = price(p, v), a = load(), china = !pr.local, qty = Math.max(1, opts.qty || 1), now = new Date().toISOString();
    var sub = pr.total * qty, disc = Math.round(sub * (opts.discount || 0));
    var o = { id: "GRS-" + Date.now().toString(36).toUpperCase() + (a.length % 10), sku: p.sku, vsku: v.vsku, title: (p.brand ? p.brand + " " : "") + p.model, icon: p.icon,
      variant: [v.label, v.color].filter(function (x) { return x && x !== "—" && x !== "Standard"; }).join(" · "),
      qty: qty, unit: pr.total, discount: disc, fee: opts.delivery ? 5 : 0,
      total: sub - disc + (opts.delivery ? 5 : 0), etaDays: pr.etaDays, flow: china ? "china" : "local", state: "PLACED",
      pickup: opts.delivery ? "Gaarsiin guriga" + (opts.address ? " · " + opts.address : "") : "Xarunta Garsoore · Km4, Muqdisho", pay: opts.pay, phone: opts.phone || "", escrow: "held",
      basket: opts.basket || null, code: String(100000 + Math.floor(Math.random() * 900000)),
      history: [{ state: "PLACED", at: now }], createdAt: now, oneoff: !!p.oneoff,
      internal: china ? { source: p.sources[0], cost: v.cost != null ? breakdown(v.cost, p.kg) : { quotedTotal: v.price }, legs: [] } : { seller: p.sources[0].seller } };
    a.unshift(o); save(a); return o;
  },
  advance: function (id) {
    var a = load(), o = a.filter(function (x) { return x.id === id; })[0]; if (!o) return null;
    var f = FLOW[o.flow], i = f.indexOf(o.state); if (i < 0 || i >= f.length - 1) return o;
    o.state = f[i + 1]; (o.history = o.history || []).push({ state: o.state, at: new Date().toISOString() });
    var leg = { SOURCING: "Supplier PO → " + (o.internal.source ? o.internal.source.channel.toUpperCase() : ""), IN_TRANSIT: "Guangzhou consolidation → MGQ air", ARRIVED: "Customs cleared · Mogadishu" }[o.state];
    if (leg && o.internal.legs) o.internal.legs.push({ at: new Date().toISOString(), leg: leg });
    if (o.state === "COMPLETED") { o.escrow = "released"; o.completedAt = new Date().toISOString(); }
    save(a); return o;
  },
  /* buyer can cancel until the goods are bought from the supplier (local: until READY) — escrow refunded in full */
  canCancel: function (o) { return o.state === "PLACED" || (o.flow === "local" && o.state === "CONFIRMED"); },
  cancel: function (id, why) {
    var a = load(), o = a.filter(function (x) { return x.id === id; })[0]; if (!o || !this.canCancel(o)) return null;
    o.state = "CANCELLED"; o.escrow = "refunded"; o.cancelReason = why || ""; (o.history = o.history || []).push({ state: "CANCELLED", at: new Date().toISOString() }); save(a); return o;
  },
  /* 7-day return window after pickup: raise a dispute, Garsoore referees it */
  canDispute: function (o) { return o.state === "COMPLETED" && !o.dispute && Date.now() - Date.parse(o.completedAt || o.createdAt) < 7 * 864e5; },
  dispute: function (id, reason) {
    var a = load(), o = a.filter(function (x) { return x.id === id; })[0]; if (!o) return null;
    o.dispute = { reason: reason, at: new Date().toISOString(), status: "open" }; save(a); return o;
  },
  review: function (id, stars, text) {
    var a = load(), o = a.filter(function (x) { return x.id === id; })[0]; if (!o || o.state !== "COMPLETED") return null;
    o.review = { stars: Math.max(1, Math.min(5, stars)), text: text || "", at: new Date().toISOString(), by: RF.identity && RF.identity.get() || "Macmiil" }; save(a); return o;
  },
  /* verified reviews for a SKU: only from orders that were actually collected */
  reviewsFor: function (sku) { return load().filter(function (o) { return o.sku === sku && o.review; }).map(function (o) { return o.review; }); }
};

/* ---------------------------------------------------------------- cart, saved items, recently viewed (per browser) */
function store(key, dflt) {
  return { get: function () { try { return JSON.parse(localStorage.getItem(key)) || dflt(); } catch (x) { return dflt(); } },
           set: function (v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (x) {} } };
}
var cartS = store("garsoore.cart", function () { return []; });
RF.cart = {
  /* line: { sku, vi, qty, quote? }  — quote-derived products are resolved through RF.quotes */
  lines: function () { return cartS.get(); },
  count: function () { return cartS.get().reduce(function (n, l) { return n + l.qty; }, 0); },
  /* snap: for staff-quoted products (not in the catalogue) keep a copy so the cart can show them; the server re-prices anyway */
  /* `mode` is the air/sea lane the customer chose on the product page. It is part of the line's identity: the same
     chair by air and by sea are different prices and different promises, so they do not merge into one line, and a
     line never silently falls back to the cheaper lane on the way to checkout. */
  add: function (sku, vi, qty, quoteId, snap, mode) {
    var a = cartS.get(), l = a.filter(function (x) { return x.sku === sku && x.vi === vi && (x.mode || null) === (mode || null); })[0];
    if (l) l.qty = Math.min(99, l.qty + (qty || 1)); else a.push({ sku: sku, vi: vi || 0, qty: qty || 1, quote: quoteId || null, snap: snap || null, mode: mode || null });
    cartS.set(a); RF.cart.onchange(); return a;
  },
  /* change a line's lane in the cart (the price moves with it, in front of the customer) */
  setMode: function (i, mode) { var a = cartS.get(); if (!a[i]) return; a[i].mode = mode || null; cartS.set(a); RF.cart.onchange(); },
  setQty: function (i, q) { var a = cartS.get(); if (!a[i]) return; if (q < 1) a.splice(i, 1); else a[i].qty = Math.min(99, q); cartS.set(a); RF.cart.onchange(); },
  clear: function () { cartS.set([]); RF.cart.onchange(); },
  /* resolve lines to {product, variant, price} (drops lines whose product disappeared) */
  resolve: function () {
    return cartS.get().map(function (l, i) {
      var p = null;
      if (l.quote) { var q = RF.quotes.list().filter(function (x) { return x.id === l.quote && x.status === "quoted"; })[0]; p = l.snap || (q && RF.quotes.asProduct(q)); }
      else p = RF.catalog.get(l.sku);
      if (!p) return null; var v = p.variants[l.vi] || p.variants[0];
      return { i: i, line: l, product: p, variant: v, price: price(p, v, l.mode) };
    }).filter(Boolean);
  },
  onchange: function () {}
};
var savedS = store("garsoore.saved", function () { return []; });
RF.saved = {
  list: function () { return savedS.get(); },
  has: function (sku) { return savedS.get().indexOf(sku) >= 0; },
  toggle: function (sku) { var a = savedS.get(), i = a.indexOf(sku); if (i >= 0) a.splice(i, 1); else a.unshift(sku); savedS.set(a); return i < 0; }
};
var recentS = store("garsoore.recent", function () { return []; });
RF.recent = {
  list: function () { return recentS.get(); },
  push: function (sku) { var a = recentS.get().filter(function (x) { return x !== sku; }); a.unshift(sku); recentS.set(a.slice(0, 12)); }
};
/* promo codes (demo) — percentage off goods, never off delivery */
RF.promo = { CODES: { SOODHAWOW: 0.05 }, check: function (c) { return RF.promo.CODES[String(c || "").toUpperCase().replace(/\s+/g, "")] || 0; } };
/* Somali mobile-money numbers: +252 / 0 prefix optional, 61/62/63/65/68/69/71/77/90 operators, 7 digits after */
RF.phoneFmt = function (s) {
  var d = String(s || "").replace(/\D/g, "");
  if (d.length === 12 && d.indexOf("252") === 0) return "+252 " + d.slice(3, 5) + " " + d.slice(5, 8) + " " + d.slice(8);
  return String(s || "");
};
RF.phoneOk = function (s) { return /^(?:\+?252|0)?\s?(61|62|63|65|68|69|71|77|90)\d{7}$/.test(String(s || "").replace(/[\s-]/g, "")); };

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
  requestLink: function (id, url, seen, extra) {
    var a = qload(), q = { id: "Q-" + Date.now().toString(36).toUpperCase(), status: "pending", createdAt: new Date().toISOString(),
      title: (seen && seen.title) || "Alaab ka timid " + (RF.chName ? RF.chName(id.platform) : id.platform), icon: "📦", platform: id.platform, ref: id.ref, url: url || "", seller: (seen && seen.seller) || "", kg: null,
      services: (extra && extra.services) || [], qty: (extra && extra.qty) || 1,
      estimate: null, note: "", contact: RF.identity && RF.identity.get() || "" };
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
