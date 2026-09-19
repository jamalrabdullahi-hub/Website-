/* ==========================================================================
   Garsoore — B2B layer  (window.RF.b2b)
   Phase 1: a wholesale marketplace for Somali business — GOODS + SERVICES,
   catalogue + RFQ → quotes → purchase orders → delivery → invoice → payment,
   with a business wallet holding funds in escrow.
   The transaction core is built exchange-ready: any standardised, warehouse-
   backed good can be promoted to a live order book on assets/market.js —
   that is the seam to Phase 3 (Commodity Exchange). No rebuild required:
     RFQ → Quotes → Orders → Standardisation → Warehouse receipt → Bid/Ask.
   Depends on engine.js (RF.store, RF.identity, RF.lifecycle) and market.js.
   ========================================================================== */
(function () {
"use strict";
var RF = window.RF, S = RF.store;

/* -------------------------------------------------- reference data */
var GOODS_CATS = ["Staple foods", "Cooking oil & sugar", "Construction materials", "Fuel & lubricants",
  "Agri inputs", "Packaging", "Hardware & tools", "Solar & electrical"];
var SERVICE_CATS = ["Transport & trucking", "Customs & clearing", "Warehousing", "Construction",
  "Engineering", "Security", "Accounting & audit", "Legal", "Maintenance", "IT & telecom"];
var UNITS = ["kg", "MT", "quintal", "50 kg bag", "25 kg bag", "carton", "litre", "20 L jerrican", "drum",
  "piece", "pallet", "truck load (10 T)", "20ft container", "m³", "hour", "day", "guard / month", "pallet / month", "month", "project"];
var INCOTERMS = ["Ex-warehouse", "FOB Mogadishu", "FOB Berbera", "FOB Bosaso", "CFR", "DAP (buyer site)", "DDP"];
var WAREHOUSES = ["Mogadishu — Port free zone", "Mogadishu — Bakaara bonded", "Berbera — Port warehouse",
  "Bosaso — Port warehouse", "Hargeisa — Central store", "Baidoa — Regional store", "Kismayo — Port shed"];

// standardised commodities → warehouse-receipt contract spec (the exchange seam)
var STD = {
  "Sesame Seed": {
    unitLabel: "$/MT", unitShort: "MT", lotSize: 1, lotLabel: "1 MT", tick: 5, decimals: 0, centerPar: 1320,
    parGradeId: "a",
    grades: [
      { id: "c", label: "FAQ",          rank: 0, diff: -90, spec: "Fair average quality, 96% purity, mixed colour." },
      { id: "b", label: "Grade B",      rank: 1, diff: -35, spec: "98% purity whitish, ≤ 2% admixture." },
      { id: "a", label: "Grade A (par)",rank: 2, diff: 0,   spec: "99% purity whitish, ≤ 1% admixture, ≤ 8% moisture, sortex-clean." }
    ]
  },
  "White Maize": {
    unitLabel: "$/MT", unitShort: "MT", lotSize: 1, lotLabel: "1 MT", tick: 2, decimals: 0, centerPar: 255,
    parGradeId: "m",
    grades: [
      { id: "f", label: "Feed",          rank: 0, diff: -28, spec: "Broken / weevil-damaged, animal feed." },
      { id: "m", label: "Milling (par)", rank: 1, diff: 0,   spec: "Clean white maize, ≤ 13.5% moisture, ≤ 4% broken." }
    ]
  }
};

RF.b2b_ref = { GOODS_CATS: GOODS_CATS, SERVICE_CATS: SERVICE_CATS, UNITS: UNITS, INCOTERMS: INCOTERMS, WAREHOUSES: WAREHOUSES, STD: STD };

/* -------------------------------------------------- store shape */
function db() {
  if (!S._db) S.load();
  if (!S._db.offers) S._db.offers = [];
  if (!S._db.rfqs) S._db.rfqs = [];
  if (!S._db.wallets) S._db.wallets = {};
  return S._db;
}
function money(n) { return "$" + Math.round(n).toLocaleString(); }
function slug(s) { return s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function nowISO() { return new Date().toISOString(); }
function ago(days) { var d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); }

/* -------------------------------------------------- wallet */
function ensureWallet(biz) {
  var d = db();
  if (!d.wallets[biz]) d.wallets[biz] = { balance: 0, held: 0, ledger: [] };
  return d.wallets[biz];
}
function walletEntry(biz, kind, amount, ref, note) {
  var w = ensureWallet(biz);
  w.ledger.unshift({ at: nowISO(), kind: kind, amount: amount, ref: ref || "", note: note || "" });
}
var wallet = {
  get: function (biz) { return biz ? ensureWallet(biz) : null; },
  topUp: function (biz, amount) {
    amount = Math.round(+amount); if (!(amount > 0)) return { error: "Enter an amount." };
    var w = ensureWallet(biz); w.balance += amount;
    walletEntry(biz, "top-up", amount, "", "Mobile money / bank transfer in");
    S.save(); return w;
  },
  hold: function (biz, amount, ref, note) {
    var w = ensureWallet(biz);
    if (w.balance < amount) return { error: "Wallet short by " + money(amount - w.balance) + ". Top up first." };
    w.balance -= amount; w.held += amount;
    walletEntry(biz, "hold", -amount, ref, note || "Funds held in escrow");
    S.save(); return w;
  },
  settle: function (buyer, supplier, amount, ref) {
    var wb = ensureWallet(buyer), ws = ensureWallet(supplier);
    wb.held = Math.max(0, wb.held - amount);
    ws.balance += amount;
    walletEntry(buyer, "settle", 0, ref, "Escrow released to " + supplier);
    walletEntry(supplier, "payout", amount, ref, "Order settled — funds received");
    S.save();
  },
  refund: function (buyer, amount, ref, note) {
    var w = ensureWallet(buyer);
    w.held = Math.max(0, w.held - amount); w.balance += amount;
    walletEntry(buyer, "refund", amount, ref, note || "Escrow refunded");
    S.save();
  }
};

/* -------------------------------------------------- catalogue */
function isStandardized(o) {
  return o.kind === "good" && !!o.commodity && !!STD[o.commodity] && !!o.grade && !!o.warehouse;
}
var catalogue = {
  all: function () { return db().offers.slice(); },
  get: function (id) { return db().offers.filter(function (o) { return o.id === id; })[0]; },
  find: function (kind, category, q) {
    q = (q || "").trim().toLowerCase();
    return db().offers.filter(function (o) {
      if (kind && o.kind !== kind) return false;
      if (category && o.category !== category) return false;
      if (q && (o.name + " " + o.spec + " " + o.supplier + " " + o.category + " " + (o.origin || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  },
  add: function (o) {
    o.id = o.id || RF.uid("of");
    o.createdAt = o.createdAt || nowISO();
    o.currency = "USD";
    o.standardized = isStandardized(o);
    db().offers.unshift(o);
    S.save();
    return o;
  }
};

/* -------------------------------------------------- RFQ / quotes */
var rfqStore = {
  all: function () { return db().rfqs.slice(); },
  get: function (id) { return db().rfqs.filter(function (r) { return r.id === id; })[0]; },
  forUser: function (who) {
    return db().rfqs.filter(function (r) {
      if (!who) return r.status === "open";
      if (r.buyer === who) return true;
      return (r.quotes || []).some(function (q) { return q.supplier === who; });
    });
  },
  post: function (r) {
    r.id = r.id || RF.uid("rfq");
    r.status = "open"; r.quotes = []; r.createdAt = nowISO();
    db().rfqs.unshift(r);
    S.save();
    return r;
  },
  quote: function (rfqId, q) {
    var r = this.get(rfqId); if (!r) return { error: "RFQ not found." };
    if (r.status !== "open") return { error: "RFQ is closed." };
    q.id = RF.uid("q"); q.status = "submitted"; q.at = nowISO();
    q.lineTotal = Math.round(q.unitPrice * (q.qty || r.qty));
    r.quotes.push(q);
    S.save();
    return q;
  },
  accept: function (rfqId, quoteId, buyer) {
    var r = this.get(rfqId); if (!r) return { error: "RFQ not found." };
    var q = (r.quotes || []).filter(function (x) { return x.id === quoteId; })[0];
    if (!q) return { error: "Quote not found." };
    var order = createOrder({
      buyer: buyer || r.buyer, supplier: q.supplier, kind: r.kind, category: r.category,
      lines: [{ name: r.title, qty: q.qty || r.qty, unit: r.unit, unitPrice: q.unitPrice }],
      incoterm: q.incoterm || r.incoterm, deliverTo: r.deliverTo, leadDays: q.leadDays,
      warehouse: r.kind === "good" ? (r.warehouse || "") : "", rfqId: r.id
    });
    if (order.error) return order;
    q.status = "accepted";
    r.quotes.forEach(function (x) { if (x.id !== quoteId) x.status = "declined"; });
    r.status = "awarded"; r.orderId = order.id;
    S.save();
    return order;
  }
};

/* -------------------------------------------------- orders (deals, board 'b2b') */
function orderNo() { return "PO-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000); }

function createOrder(spec) {
  var buyer = (spec.buyer || RF.identity.get() || "").trim();
  if (!buyer) return { error: "Set your business name first." };
  var lines = spec.lines.map(function (l) {
    return { name: l.name, qty: +l.qty, unit: l.unit, unitPrice: +l.unitPrice, lineTotal: Math.round(l.qty * l.unitPrice) };
  });
  var total = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);

  var h = wallet.hold(buyer, total, "", "Held for order to " + spec.supplier);
  if (h.error) return { error: h.error, need: "topup", amount: total };

  var now = nowISO(), po = orderNo();
  var deal = {
    id: RF.uid("po"), board: "b2b", listingId: null,
    title: lines.length === 1 ? lines[0].qty + " " + lines[0].unit + " · " + lines[0].name : lines.length + " lines · " + spec.category,
    parties: { owner: spec.supplier, counterparty: buyer },
    counterpartyRole: "buyer",
    state: "PLACED", escrow: "held",
    amount: total, currency: "USD",
    history: [{ state: "PLACED", at: now, by: buyer }],
    createdAt: now, updatedAt: now,
    meta: {
      kind: spec.kind, category: spec.category, lines: lines,
      incoterm: spec.incoterm || "Ex-warehouse", warehouse: spec.warehouse || "",
      deliverTo: spec.deliverTo || "", leadDays: spec.leadDays || null,
      poNo: po, invoiceNo: null, receiptNo: null,
      rfqId: spec.rfqId || null, offerId: spec.offerId || null
    }
  };
  S.addDeal(deal);
  return deal;
}

function orderFromOffer(offerId, qty, buyer) {
  var o = catalogue.get(offerId);
  if (!o) return { error: "Offer not found." };
  qty = +qty;
  if (!(qty >= (o.moq || 1))) return { error: "Minimum order is " + (o.moq || 1) + " " + o.unit + "." };
  if (o.availableQty != null && qty > o.availableQty) return { error: "Only " + o.availableQty + " " + o.unit + " available." };
  var order = createOrder({
    buyer: buyer, supplier: o.supplier, kind: o.kind, category: o.category,
    lines: [{ name: o.name, qty: qty, unit: o.unit, unitPrice: o.unitPrice }],
    incoterm: o.incoterm, warehouse: o.warehouse || "", leadDays: o.leadDays, offerId: o.id
  });
  if (!order.error && o.availableQty != null) { o.availableQty -= qty; S.save(); }
  return order;
}

function orders(who) {
  return S.deals(who).filter(function (d) { return d.board === "b2b"; });
}

// wraps RF.lifecycle.advance with wallet + document effects
function advanceOrder(id, toState, actor) {
  var d = S.deal(id); if (!d) return { error: "Order not found." };
  var r = RF.lifecycle.advance(id, toState, actor);
  if (r && r.error) return r;
  var buyer = d.parties.counterparty, supplier = d.parties.owner;

  if (toState === "READY" && d.meta.warehouse && !d.meta.receiptNo) {
    d.meta.receiptNo = "WR-" + slug(d.meta.warehouse.split(" — ")[0]) + "-" + Math.floor(10000 + Math.random() * 89999);
  }
  if (toState === "SHIPPED" && !d.meta.invoiceNo) {
    d.meta.invoiceNo = "INV-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
  }
  if (toState === "SETTLED") wallet.settle(buyer, supplier, d.amount, d.meta.poNo);
  else if (toState === "CANCELLED" || toState === "DISPUTED") wallet.refund(buyer, d.amount, d.meta.poNo, "Order " + toState.toLowerCase());
  S.save();
  return S.deal(id);
}

/* -------------------------------------------------- exchange seam */
// A standardised, warehouse-backed offer can list a bid/ask on a live order book.
// The book is a runtime-registered market on assets/market.js — same matching
// engine, same settlement lifecycle as the built-in commodity markets.
function marketFor(commodity) {
  var spec = STD[commodity];
  if (!spec) return null;
  var id = "WR-" + slug(commodity);
  var existing = RF.market.marketById(id);
  if (existing) return existing;
  // delivery points = warehouses where this commodity is offered, else all
  var whs = {};
  db().offers.forEach(function (o) { if (o.commodity === commodity && o.warehouse) whs[o.warehouse] = 1; });
  var dps = Object.keys(whs);
  if (!dps.length) dps = ["Mogadishu — Port free zone", "Berbera — Port warehouse"];
  return RF.market.registerMarket({
    id: id, name: commodity + " — Warehouse Receipt", commodity: commodity,
    unitLabel: spec.unitLabel, unitShort: spec.unitShort, lotSize: spec.lotSize, lotLabel: spec.lotLabel,
    tick: spec.tick, decimals: spec.decimals, currency: "USD", centerPar: spec.centerPar,
    deliveryPoints: dps,
    gradeSystem: { label: commodity + " — warehouse-receipt grade", parGradeId: spec.parGradeId, grades: spec.grades }
  });
}

function promote(offerId, opts) {
  var o = catalogue.get(offerId);
  if (!o) return { error: "Offer not found." };
  if (!isStandardized(o)) return { error: "Only standardised, graded, warehouse-backed goods can be listed on the exchange." };
  var m = marketFor(o.commodity);
  if (!m) return { error: "No exchange contract for " + o.commodity + "." };
  opts = opts || {};
  var side = opts.side || "sell";
  var lots = Math.floor(opts.lots || o.availableQty || o.moq || 1);
  var limit = opts.limit != null ? +opts.limit : o.unitPrice;
  return RF.market.submitOrder({
    marketId: m.id, side: side, gradeId: o.grade, deliveryPoint: o.warehouse,
    lots: lots, limit: limit, trader: (opts.trader || o.supplier)
  });
}

function commodityQuotes() {
  return Object.keys(STD).map(function (c) {
    var m = RF.market.marketById("WR-" + slug(c));
    if (!m) return { commodity: c, listed: false };
    var q = RF.market.quote(m.id);
    return { commodity: c, listed: true, marketId: m.id, unitLabel: m.unitLabel,
      bid: q.bestBid, ask: q.bestAsk, last: q.last, vol: q.volume };
  });
}

/* -------------------------------------------------- seed */
function O(supplier, verified, rating, kind, category, name, spec, unit, unitPrice, moq, avail, origin, incoterm, leadDays, warehouse, commodity, grade, age) {
  return { id: RF.uid("of"), supplier: supplier, verified: verified, rating: rating, kind: kind, category: category,
    name: name, spec: spec, unit: unit, unitPrice: unitPrice, currency: "USD", moq: moq, availableQty: avail,
    origin: origin, incoterm: incoterm, leadDays: leadDays, warehouse: warehouse || "", commodity: commodity || "",
    grade: grade || "", standardized: false, createdAt: ago(age || 5) };
}

var SEED_OFFERS = [
  O("Barwaaqo Rice Import", true, 4.7, "good", "Staple foods", "White rice (Sonaali)", "Long grain, 5% broken, 2024 crop, double-sewn 50 kg PP", "50 kg bag", 34, 200, 8200, "India", "Ex-warehouse", 2, "Mogadishu — Bakaara bonded", "", "", 3),
  O("Juba Agro Export", true, 4.9, "good", "Agri inputs", "Sesame seed — Grade A whitish", "99% purity, ≤ 1% admixture, ≤ 8% moisture, sortex-clean", "MT", 1310, 5, 220, "Lower Shabelle", "FOB Mogadishu", 4, "Mogadishu — Port free zone", "Sesame Seed", "a", 2),
  O("Juba Agro Export", true, 4.9, "good", "Staple foods", "White maize — milling grade", "Clean white maize, ≤ 13.5% moisture, ≤ 4% broken", "MT", 255, 10, 900, "Bay region", "Ex-warehouse", 3, "Baidoa — Regional store", "White Maize", "m", 6),
  O("Golings Oil Co.", true, 4.5, "good", "Cooking oil & sugar", "Palm cooking oil", "RBD palm olein, 20 L food-grade jerrican, sealed carton x1", "20 L jerrican", 23, 100, 4000, "Malaysia", "Ex-warehouse", 2, "Mogadishu — Port free zone", "", "", 7),
  O("Sweet Somali Trading", true, 4.4, "good", "Cooking oil & sugar", "White refined sugar", "ICUMSA 45, 50 kg bag, granulated", "50 kg bag", 31, 200, 6000, "Brazil", "Ex-warehouse", 3, "Mogadishu — Bakaara bonded", "", "", 9),
  O("Baraka Flour Mills", true, 4.6, "good", "Staple foods", "Wheat flour — bakery grade", "12.5% protein, fortified, 50 kg bag", "50 kg bag", 19, 300, 5200, "Local mill", "Ex-warehouse", 1, "Mogadishu — Bakaara bonded", "", "", 4),
  O("Berbera Cement Traders", true, 4.8, "good", "Construction materials", "Cement OPC 42.5N", "Ordinary Portland, 50 kg bag, moisture-sealed", "50 kg bag", 7.2, 500, 30000, "UAE", "FOB Berbera", 3, "Berbera — Port warehouse", "", "", 3),
  O("Horn Steel", true, 4.3, "good", "Construction materials", "Reinforcement bar 12 mm", "Grade 60, 12 m lengths, mill test cert", "MT", 640, 3, 140, "Turkey", "CFR", 12, "Berbera — Port warehouse", "", "", 8),
  O("Deeqa Fuel", true, 4.2, "good", "Fuel & lubricants", "Automotive diesel (AGO)", "50 ppm sulphur, delivered by road tanker", "litre", 0.92, 5000, 400000, "Import terminal", "DAP (buyer site)", 1, "", "", "", 2),
  O("Qorax Solar Distribution", true, 4.7, "good", "Solar & electrical", "Solar panel 550 W mono", "Monocrystalline half-cell, 25-yr perf. warranty, pallet of 31", "piece", 95, 20, 1240, "China", "Ex-warehouse", 2, "Mogadishu — Port free zone", "", "", 6),
  O("Cadaani Packaging", false, 4.0, "good", "Packaging", "PP woven bag 50 kg", "Laminated, printed 1 colour, bottom-sewn", "piece", 0.28, 10000, 500000, "Local", "Ex-warehouse", 4, "Mogadishu — Bakaara bonded", "", "", 11),
  O("Tooso Hardware", true, 4.1, "good", "Hardware & tools", "Galvanised roofing sheet 0.4 mm", "Corrugated, 3 m, Z120 coating", "piece", 9.5, 100, 9000, "Kenya", "Ex-warehouse", 3, "Mogadishu — Bakaara bonded", "", "", 10),
  O("Juba Agro Export", true, 4.9, "good", "Agri inputs", "Sesame seed — Grade B", "98% purity, ≤ 2% admixture", "MT", 1270, 5, 90, "Lower Shabelle", "FOB Mogadishu", 4, "Mogadishu — Port free zone", "Sesame Seed", "b", 5),

  O("Waberi Transport", true, 4.6, "service", "Transport & trucking", "Trucking — Mogadishu ⇄ Baidoa", "10-tonne flatbed, tarpaulin, GPS-tracked, driver + turnboy", "truck load (10 T)", 480, 1, null, "", "DAP (buyer site)", 1, "", "", "", 3),
  O("Sahal Clearing & Forwarding", true, 4.5, "service", "Customs & clearing", "Import customs clearance", "HS classification, duty computation, port release, 1 x 20ft", "20ft container", 350, 1, null, "", "", 2, "", "", "", 4),
  O("Berbera Bonded Stores", true, 4.4, "service", "Warehousing", "Bonded warehousing", "Covered pallet storage, 24/7 guarded, monthly billing", "pallet / month", 6, 20, null, "", "", 1, "Berbera — Port warehouse", "", "", 6),
  O("Nabad Security Services", true, 4.3, "service", "Security", "Static guarding", "Licensed guard, 12-hr shift, supervisor rounds", "guard / month", 220, 2, null, "", "", 3, "", "", "", 8),
  O("Xisaab Associates", true, 4.7, "service", "Accounting & audit", "Bookkeeping & VAT filing", "Monthly ledgers, payroll, tax authority filing", "month", 180, 1, null, "", "", 2, "", "", "", 7),
  O("Cadaalad Legal", true, 4.6, "service", "Legal", "Contract drafting & review", "Commercial contracts, bilingual Somali/English", "hour", 40, 2, null, "", "", 1, "", "", "", 9),
  O("Danab Engineering", true, 4.5, "service", "Engineering", "Generator install & commissioning", "Sizing, cabling, ATS, load test, O&M handover", "project", 0, 1, null, "", "", 7, "", "", "", 5),
  O("Cabdalla Construction", true, 4.2, "service", "Construction", "Warehouse & shed construction", "Steel-frame, concrete slab, roofing — priced on drawings", "project", 0, 1, null, "", "", 30, "", "", "", 12),
  O("Xamar IT", false, 4.0, "service", "IT & telecom", "POS & network setup", "Cabling, switches, Wi-Fi, POS terminals, staff training", "project", 0, 1, null, "", "", 5, "", "", "", 10)
];

var SEED_RFQS = [
  { id: RF.uid("rfq"), buyer: "Baraka Wholesale", kind: "good", category: "Staple foods",
    title: "White rice, 5% broken, 50 kg bags", spec: "Need 5,000 kg (100 bags), current crop, delivered to store in Bakaara.",
    qty: 5000, unit: "kg", deliverTo: "Mogadishu", neededBy: "2026-09-12", incoterm: "DAP (buyer site)",
    warehouse: "", status: "open", createdAt: ago(2),
    quotes: [
      { id: RF.uid("q"), supplier: "Barwaaqo Rice Import", unitPrice: 0.70, qty: 5000, leadDays: 3, incoterm: "DAP (buyer site)", validDays: 7, note: "Ex Bakaara bonded, own transport.", status: "submitted", at: ago(1), lineTotal: 3500 },
      { id: RF.uid("q"), supplier: "Deeqa Trading", unitPrice: 0.68, qty: 5000, leadDays: 5, incoterm: "Ex-warehouse", validDays: 5, note: "Collection only.", status: "submitted", at: ago(1), lineTotal: 3400 }
    ] },
  { id: RF.uid("rfq"), buyer: "Hargeisa Builders Ltd", kind: "good", category: "Construction materials",
    title: "Cement OPC 42.5, 40 MT", spec: "40 MT (800 bags) delivered to a site in Hargeisa within two weeks.",
    qty: 800, unit: "50 kg bag", deliverTo: "Hargeisa", neededBy: "2026-09-20", incoterm: "DAP (buyer site)",
    warehouse: "", status: "open", createdAt: ago(4),
    quotes: [
      { id: RF.uid("q"), supplier: "Berbera Cement Traders", unitPrice: 8.10, qty: 800, leadDays: 6, incoterm: "DAP (buyer site)", validDays: 10, note: "Includes road freight Berbera→Hargeisa.", status: "submitted", at: ago(2), lineTotal: 6480 }
    ] },
  { id: RF.uid("rfq"), buyer: "Jubba Traders", kind: "service", category: "Transport & trucking",
    title: "12 truck loads, Kismayo → Mogadishu", spec: "General cargo, 12 x 10-tonne loads over three weeks, tracked.",
    qty: 12, unit: "truck load (10 T)", deliverTo: "Mogadishu", neededBy: "2026-09-30", incoterm: "DAP (buyer site)",
    warehouse: "", status: "open", createdAt: ago(3),
    quotes: [
      { id: RF.uid("q"), supplier: "Waberi Transport", unitPrice: 690, qty: 12, leadDays: 2, incoterm: "DAP (buyer site)", validDays: 14, note: "Convoy scheduling, escort extra if needed.", status: "submitted", at: ago(1), lineTotal: 8280 }
    ] }
];

function ensureSeed() {
  var d = db();
  if (d.b2bSeededAt) return;
  d.offers = SEED_OFFERS.map(function (o) { o.standardized = isStandardized(o); return o; });
  d.rfqs = SEED_RFQS;
  d.wallets = {
    "Baraka Wholesale": { balance: 42000, held: 0, ledger: [{ at: ago(6), kind: "top-up", amount: 42000, ref: "", note: "Opening balance" }] },
    "Hargeisa Builders Ltd": { balance: 55000, held: 0, ledger: [{ at: ago(8), kind: "top-up", amount: 55000, ref: "", note: "Opening balance" }] }
  };
  d.b2bSeededAt = nowISO();
  S.save();
}

/* -------------------------------------------------- export */
RF.b2b = {
  GOODS_CATS: GOODS_CATS, SERVICE_CATS: SERVICE_CATS, UNITS: UNITS, INCOTERMS: INCOTERMS,
  WAREHOUSES: WAREHOUSES, STD: STD,
  ensureSeed: ensureSeed,
  reseed: function () { var d = db(); delete d.b2bSeededAt; d.offers = []; d.rfqs = []; d.wallets = {}; S.save(); ensureSeed(); },
  catalogue: catalogue,
  rfqs: rfqStore,
  wallet: wallet,
  isStandardized: isStandardized,
  createOrder: createOrder,
  orderFromOffer: orderFromOffer,
  orders: orders,
  advanceOrder: advanceOrder,
  promote: promote,
  marketFor: marketFor,
  commodityQuotes: commodityQuotes,
  money: money
};

})();
