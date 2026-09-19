/* ==========================================================================
   Garsoore — Somali commodity exchange  (window.RF.market)
   Continuous limit order book per (commodity, delivery point) for Somalia's
   export and staple trade: export livestock (Berbera / Bosaso → Gulf),
   frankincense, sesame and domestic sorghum. Orders are quoted on a
   PAR-GRADE basis so one clean book holds every deliverable grade; a better
   grade clears at the par price plus its published differential. Matched
   lots settle as "exchange" deals (engine.js lifecycle) with grading at the
   port / terminal market and mobile-money or letter-of-credit escrow.
   Depends on engine.js (RF.store, RF.identity, RF.lifecycle, RF.SCHEMA).
   ========================================================================== */
(function () {
"use strict";
var RF = window.RF, S = RF.store;

/* -------------------------------------------------- grade schedules */
// rank: higher = better grade. diff: premium(+) / discount(-) per unit vs par.
var GRADE_SYSTEMS = {
  // Somali export sheep & goat — grading as used by the Berbera / Bosaso livestock trade to the Gulf.
  somali_livestock: {
    label: "Sheep & goat — age / condition / export fitness", parGradeId: "exp1",
    grades: [
      { id: "cull", label: "Cull",           rank: 0, diff: -18, spec: "Old or thin, teeth worn. Local slaughter only — no export health certificate." },
      { id: "loc2", label: "Local grade 2",  rank: 1, diff: -7,  spec: "1–2 yr, fair condition, minor blemishes. Domestic market and Xamar suuq." },
      { id: "exp1", label: "Export grade (par)", rank: 2, diff: 0, spec: "2–3 yr, sound and well-fleshed, vaccinated, movement & health certificate issued. Hajj-suitable." },
      { id: "prime",label: "Prime export",   rank: 3, diff: +12, spec: "Heavy-weight prime condition, buyer-branded, quarantine-cleared, ship-ready at berth." }
    ]
  },
  // Frankincense (Beeyo — Boswellia carteri/sacra) — Sanaag / Bari production, sorted by tear size & purity.
  somali_frankincense: {
    label: "Frankincense (Beeyo) — tear size / colour / bark content", parGradeId: "b2",
    grades: [
      { id: "fus", label: "Fusus (siftings)", rank: 0, diff: -3.50, spec: "Dust and small chips, high bark. Distillation / incense-powder feed." },
      { id: "b3",  label: "Grade 3",          rank: 1, diff: -1.75, spec: "Small mixed tears, ≤ 8% bark, some discolouration. Oil extraction." },
      { id: "b2",  label: "Grade 2 (par)",    rank: 2, diff: 0.00,  spec: "Hand-sorted medium tears, light amber, ≤ 3% bark, ≤ 5% moisture." },
      { id: "mus", label: "Mushuq (Grade 1)", rank: 3, diff: +4.25, spec: "Large clear amber tears, hand-picked, ≤ 1% bark, uniform size. Premium chewing / resin grade." }
    ]
  },
  // Somali sesame seed (whitish) — Lower Shabelle crop, graded on purity, admixture, moisture.
  somali_sesame: {
    label: "Sesame seed (whitish) — purity / admixture / moisture", parGradeId: "s1",
    grades: [
      { id: "faq", label: "FAQ",          rank: 0, diff: -120, spec: "Fair average quality, 96% purity, mixed colour, free fatty acid > 2%." },
      { id: "s2",  label: "Grade 2",      rank: 1, diff: -45,  spec: "98% purity, mostly whitish, ≤ 2% admixture, ≤ 8% moisture." },
      { id: "s1",  label: "Grade 1 (par)",rank: 2, diff: 0.00, spec: "99% purity whitish, ≤ 1% admixture, ≤ 8% moisture, sortex-cleaned, FFA ≤ 2%." },
      { id: "hul", label: "Hulled",       rank: 3, diff: +260, spec: "Machine-hulled white sesame, ≥ 99.95% purity, food-grade, low bacterial count." }
    ]
  },
  // Domestic red sorghum — Bay region harvest, Bakaara / Baidoa trade grades.
  somali_sorghum: {
    label: "Red sorghum — broken / moisture / foreign matter", parGradeId: "r1",
    grades: [
      { id: "feed", label: "Feed grade",   rank: 0, diff: -4.00, spec: "Broken and weevil-damaged, > 20% foreign matter. Animal feed." },
      { id: "r2",   label: "Grade 2",      rank: 1, diff: -1.50, spec: "≤ 15% broken, ≤ 14% moisture, some chaff and stones." },
      { id: "r1",   label: "Grade 1 (par)",rank: 2, diff: 0.00,  spec: "Clean red sorghum, ≤ 5% broken, ≤ 12.5% moisture, current harvest." },
      { id: "food", label: "White food-grade", rank: 3, diff: +3.00, spec: "White low-tannin sorghum, milling quality, ≤ 3% broken, cleaned and bagged." }
    ]
  }
};

/* -------------------------------------------------- markets */
var MARKETS = [
  { id: "LSK", name: "Export Livestock — Sheep & Goat", commodity: "Export Livestock", gradeSystemId: "somali_livestock",
    unitLabel: "$/head", unitShort: "head", lotSize: 50, lotLabel: "50 head", tick: 1, currency: "USD",
    deliveryPoints: ["Berbera", "Bosaso", "Mogadishu"], centerPar: 62, decimals: 0 },
  { id: "FRK", name: "Frankincense (Beeyo)", commodity: "Frankincense", gradeSystemId: "somali_frankincense",
    unitLabel: "$/kg", unitShort: "kg", lotSize: 50, lotLabel: "50 kg sack", tick: 0.25, currency: "USD",
    deliveryPoints: ["Bosaso", "Erigavo", "Berbera"], centerPar: 9.50, decimals: 2 },
  { id: "SES", name: "Sesame Seed (Whitish)", commodity: "Sesame Seed", gradeSystemId: "somali_sesame",
    unitLabel: "$/tonne", unitShort: "t", lotSize: 5, lotLabel: "5 t", tick: 5, currency: "USD",
    deliveryPoints: ["Mogadishu", "Marka", "Kismayo"], centerPar: 1360, decimals: 0 },
  { id: "SGH", name: "Red Sorghum (Domestic)", commodity: "Red Sorghum", gradeSystemId: "somali_sorghum",
    unitLabel: "$/quintal", unitShort: "quintal", lotSize: 50, lotLabel: "50 quintals (5 t)", tick: 0.5, currency: "USD",
    deliveryPoints: ["Baidoa", "Mogadishu", "Beledweyne"], centerPar: 22, decimals: 2 }
];

var TRADERS = ["Indhadeero Trading", "Mahad Gaani Livestock", "Beeyo Exporters", "Cadaado General Trading",
  "Barwaaqo Agro", "Xamar Suuq Traders", "Golis Frankincense Co.", "Juba Valley Sesame"];

/* -------------------------------------------------- helpers */
// Static markets ship with the app; dynamic markets are registered at runtime
// (e.g. by the B2B layer promoting a standardised product) and persist in the store.
function dynMarkets() { return (S._db && S._db.dynMarkets) || []; }
function dynGradeSystems() { return (S._db && S._db.dynGradeSystems) || {}; }
function allMarkets() { return MARKETS.concat(dynMarkets()); }
function marketById(id) {
  var all = allMarkets();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
}
function gradeSystem(id) { return GRADE_SYSTEMS[id] || dynGradeSystems()[id]; }

// Register a market at runtime. `def.gradeSystem` is the inline schedule
// ({ label, parGradeId, grades:[{id,label,rank,diff,spec}] }); everything else
// matches the static MARKETS shape.
function registerMarket(def) {
  if (!S._db) S.load();
  if (!S._db.dynMarkets) S._db.dynMarkets = [];
  if (!S._db.dynGradeSystems) S._db.dynGradeSystems = {};
  if (marketById(def.id)) return marketById(def.id);
  var gsId = def.gradeSystemId || (def.id + "_grades");
  S._db.dynGradeSystems[gsId] = def.gradeSystem;
  var m = {
    id: def.id, name: def.name, commodity: def.commodity, gradeSystemId: gsId,
    unitLabel: def.unitLabel, unitShort: def.unitShort, lotSize: def.lotSize, lotLabel: def.lotLabel,
    tick: def.tick, currency: def.currency || "USD", decimals: def.decimals != null ? def.decimals : 2,
    deliveryPoints: def.deliveryPoints.slice(), centerPar: def.centerPar, dynamic: true
  };
  S._db.dynMarkets.push(m);
  S.save();
  return m;
}
function gradeById(gs, id) { for (var i = 0; i < gs.grades.length; i++) if (gs.grades[i].id === id) return gs.grades[i]; }
function diffFor(gs, id) { var g = gradeById(gs, id); return g ? g.diff : 0; }
function parRank(gs) { return gradeById(gs, gs.parGradeId).rank; }
function round2(n) { return Math.round(n * 100) / 100; }
function clampTick(m, px) { return round2(Math.round(px / m.tick) * m.tick); }
function remaining(o) { return o.lots - o.lotsFilled; }
function fmtPx(m, n) { return n == null ? "—" : Number(n).toFixed(m.decimals); }
RF.marketFmt = fmtPx;

function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
function nextSeq() { var db = S._db; db.orderSeq = (db.orderSeq || 0) + 1; return db.orderSeq; }
function weightedGradePool(gs) {
  var pool = [], pr = parRank(gs);
  gs.grades.forEach(function (g) {
    var w = g.id === gs.parGradeId ? 5 : Math.abs(g.rank - pr) === 1 ? 3 : 1;
    for (var i = 0; i < w; i++) pool.push(g.id);
  });
  return pool;
}

/* -------------------------------------------------- order book */
function book(marketId) {
  var open = S.orders(marketId).filter(function (o) { return o.status === "open" || o.status === "partial"; });
  var bids = open.filter(function (o) { return o.side === "buy"; })
    .sort(function (a, b) { return b.parLimit - a.parLimit || a.seq - b.seq; });
  var asks = open.filter(function (o) { return o.side === "sell"; })
    .sort(function (a, b) { return a.parLimit - b.parLimit || a.seq - b.seq; });
  return { bids: bids, asks: asks };
}
RF.marketBook = book;

function depth(marketId, dp, levels) {
  levels = levels || 6;
  var b = book(marketId);
  function agg(list) {
    var map = {};
    list.forEach(function (o) {
      if (dp && o.deliveryPoint !== dp) return;
      var k = o.parLimit.toFixed(4);
      map[k] = (map[k] || 0) + remaining(o);
    });
    return Object.keys(map).map(function (k) { return { px: +k, lots: map[k] }; });
  }
  var bids = agg(b.bids).sort(function (x, y) { return y.px - x.px; }).slice(0, levels);
  var asks = agg(b.asks).sort(function (x, y) { return x.px - y.px; }).slice(0, levels);
  var c = 0; bids.forEach(function (l) { c += l.lots; l.cum = c; });
  c = 0; asks.forEach(function (l) { c += l.lots; l.cum = c; });
  var max = Math.max(bids.length ? bids[bids.length - 1].cum : 0, asks.length ? asks[asks.length - 1].cum : 0, 1);
  return { bids: bids, asks: asks, max: max };
}

function quote(marketId, dp) {
  var b = book(marketId);
  var bb = b.bids.filter(function (o) { return !dp || o.deliveryPoint === dp; })[0];
  var ba = b.asks.filter(function (o) { return !dp || o.deliveryPoint === dp; })[0];
  var tr = S.trades(marketId).slice().sort(function (x, y) { return new Date(x.at) - new Date(y.at); });
  if (dp) tr = tr.filter(function (t) { return t.deliveryPoint === dp; });
  var last = tr[tr.length - 1], first = tr[0];
  var pars = tr.map(function (t) { return t.par; });
  return {
    bestBid: bb ? bb.parLimit : null,
    bestAsk: ba ? ba.parLimit : null,
    spread: bb && ba ? round2(ba.parLimit - bb.parLimit) : null,
    mid: bb && ba ? round2((ba.parLimit + bb.parLimit) / 2) : (last ? last.par : null),
    last: last ? last.par : null,
    lastSettle: last ? last.settlePrice : null,
    lastGrade: last ? last.deliveredGrade : null,
    changePct: last && first && first.par ? round2((last.par - first.par) / first.par * 100) : 0,
    dayHigh: pars.length ? Math.max.apply(null, pars) : null,
    dayLow: pars.length ? Math.min.apply(null, pars) : null,
    volume: tr.reduce(function (s, t) { return s + t.lots; }, 0),
    count: tr.length
  };
}

function tape(marketId, dp, n) {
  var tr = S.trades(marketId).slice().sort(function (x, y) { return new Date(y.at) - new Date(x.at); });
  if (dp) tr = tr.filter(function (t) { return t.deliveryPoint === dp; });
  return tr.slice(0, n || 12);
}

/* -------------------------------------------------- matching engine */
function makeSettlement(m, trade) {
  var now = new Date().toISOString();
  var gs = gradeSystem(m.gradeSystemId), g = gradeById(gs, trade.deliveredGrade);
  return S.addDeal({
    id: RF.uid("stl"), board: "exchange", listingId: null,
    title: m.commodity + " · " + trade.lots + " × " + m.lotLabel + " @ " + fmtPx(m, trade.settlePrice) + " " + m.unitLabel,
    parties: { owner: trade.seller, counterparty: trade.buyer },
    counterpartyRole: "buyer",
    state: "MATCHED",
    escrow: "held",
    amount: round2(trade.settlePrice * trade.lots * m.lotSize),
    currency: m.currency,
    history: [{ state: "MATCHED", at: now, by: "match-engine" }],
    createdAt: now, updatedAt: now,
    meta: {
      market: m.id, marketName: m.name, gradeId: trade.deliveredGrade,
      grade: g ? g.label : trade.deliveredGrade, gradeSpec: g ? g.spec : "",
      lots: trade.lots, lotLabel: m.lotLabel, deliveryPoint: trade.deliveryPoint,
      par: trade.par, settlePrice: trade.settlePrice, unit: m.unitLabel,
      differential: g ? g.diff : 0, tradeId: trade.id, aggressor: trade.aggressor
    }
  });
}

function submitOrder(input) {
  var m = marketById(input.marketId);
  if (!m) return { error: "Unknown market." };
  var gs = gradeSystem(m.gradeSystemId);
  var g = gradeById(gs, input.gradeId);
  if (!g) return { error: "Pick a grade." };
  if (m.deliveryPoints.indexOf(input.deliveryPoint) < 0) return { error: "Pick a delivery point." };
  var lots = Math.floor(+input.lots);
  if (!(lots >= 1)) return { error: "Lots must be a whole number ≥ 1." };
  var limit = +input.limit;
  if (!(limit > 0)) return { error: "Enter a limit price." };
  limit = clampTick(m, limit);
  if (input.side !== "buy" && input.side !== "sell") return { error: "Side must be buy or sell." };

  var trader = (input.trader || RF.identity.get() || "").trim();
  if (!trader) return { error: "Set your name before trading." };

  var order = {
    id: RF.uid("ord"), seq: nextSeq(), marketId: m.id, trader: trader, side: input.side,
    gradeId: input.gradeId, deliveryPoint: input.deliveryPoint,
    lots: lots, lotsFilled: 0, limit: limit, parLimit: round2(limit - g.diff),
    status: "open", createdAt: new Date().toISOString()
  };
  S._db.orders.push(order);

  var trades = [], settlements = [];
  var opp = book(m.id)[order.side === "buy" ? "asks" : "bids"].filter(function (o) {
    return o.deliveryPoint === order.deliveryPoint && o.trader !== trader;
  });

  for (var i = 0; i < opp.length && remaining(order) > 0; i++) {
    var rest = opp[i];
    var cross = order.side === "buy" ? order.parLimit >= rest.parLimit : order.parLimit <= rest.parLimit;
    if (!cross) break; // list is best-first — nothing past here crosses

    var buyGradeId  = order.side === "buy" ? order.gradeId : rest.gradeId;
    var sellGradeId = order.side === "buy" ? rest.gradeId  : order.gradeId;
    // seller's grade must be the buyer's required grade or better
    if (gradeById(gs, sellGradeId).rank < gradeById(gs, buyGradeId).rank) continue;

    var qty = Math.min(remaining(order), remaining(rest));
    var tradePar = rest.parLimit; // trade prints at the passive (resting) price
    var settlePrice = round2(tradePar + gradeById(gs, sellGradeId).diff);
    var buyer = order.side === "buy" ? trader : rest.trader;
    var seller = order.side === "buy" ? rest.trader : trader;

    var tr = S.addTrade({
      marketId: m.id, at: new Date().toISOString(), par: tradePar, settlePrice: settlePrice,
      lots: qty, deliveredGrade: sellGradeId, deliveryPoint: order.deliveryPoint,
      buyer: buyer, seller: seller, aggressor: order.side,
      buyOrderId: order.side === "buy" ? order.id : rest.id,
      sellOrderId: order.side === "buy" ? rest.id : order.id
    });
    order.lotsFilled += qty;
    rest.lotsFilled += qty;
    rest.status = remaining(rest) <= 0 ? "filled" : "partial";
    trades.push(tr);
    settlements.push(makeSettlement(m, tr));
  }

  order.status = remaining(order) <= 0 ? "filled" : (order.lotsFilled > 0 ? "partial" : "open");
  S.save();

  var filledLots = order.lotsFilled;
  var vwap = trades.length
    ? round2(trades.reduce(function (s, t) { return s + t.settlePrice * t.lots; }, 0) / filledLots)
    : null;
  return { order: order, trades: trades, settlements: settlements, resting: remaining(order), filled: filledLots, vwap: vwap };
}

function cancelOrder(id) {
  var o = S.order(id);
  if (!o) return { error: "Order not found." };
  if (o.status === "filled") return { error: "Order already filled." };
  if (o.status === "cancelled") return { error: "Already cancelled." };
  o.status = "cancelled"; o.updatedAt = new Date().toISOString();
  S.save();
  return o;
}

function myOrders(trader, marketId) {
  return S.orders(marketId).filter(function (o) { return o.trader === trader; })
    .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
}

/* -------------------------------------------------- seeding */
function restOrder(m, side, gradeId, dp, lots, rawLimit, trader, rnd) {
  var gs = gradeSystem(m.gradeSystemId), diff = diffFor(gs, gradeId);
  S._db.orders.push({
    id: RF.uid("ord"), seq: nextSeq(), marketId: m.id, trader: trader, side: side,
    gradeId: gradeId, deliveryPoint: dp, lots: lots, lotsFilled: 0,
    limit: round2(rawLimit), parLimit: round2(rawLimit - diff),
    status: "open", createdAt: new Date(Date.now() - Math.floor(rnd() * 5400000)).toISOString(), synthetic: true
  });
}

function seedMarkets() {
  MARKETS.forEach(function (m) {
    var rnd = mulberry32(hashStr(m.id));
    var gs = gradeSystem(m.gradeSystemId);
    var pool = weightedGradePool(gs);

    // historical prints — a short random walk around the centre
    var px = m.centerPar;
    var horizon = 6 * 3600 * 1000, t0 = Date.now() - horizon;
    var n = 12 + Math.floor(rnd() * 6);
    for (var i = 0; i < n; i++) {
      px = clampTick(m, px * (1 + (rnd() - 0.5) * 0.018));
      var g = pick(rnd, pool);
      S.addTrade({
        marketId: m.id, at: new Date(t0 + (i + rnd()) * (horizon / n)).toISOString(),
        par: px, settlePrice: round2(px + diffFor(gs, g)),
        lots: 1 + Math.floor(rnd() * 5), deliveredGrade: g,
        deliveryPoint: m.deliveryPoints[Math.floor(rnd() * m.deliveryPoints.length)],
        buyer: pick(rnd, TRADERS), seller: pick(rnd, TRADERS), aggressor: rnd() < 0.5 ? "buy" : "sell"
      });
    }
    var lastPar = px;

    // resting book — a ladder each side, per delivery point, quoted in par terms
    m.deliveryPoints.forEach(function (dp) {
      var levels = 4 + Math.floor(rnd() * 3);
      var apar = clampTick(m, lastPar + m.tick * (1 + Math.floor(rnd() * 2)));
      for (var a = 0; a < levels; a++) {
        var ga = pick(rnd, pool);
        restOrder(m, "sell", ga, dp, 2 + Math.floor(rnd() * 8), round2(apar + diffFor(gs, ga)), pick(rnd, TRADERS), rnd);
        apar = clampTick(m, apar + m.tick * (1 + Math.floor(rnd() * 3)));
      }
      var bpar = clampTick(m, lastPar - m.tick * (1 + Math.floor(rnd() * 2)));
      for (var b = 0; b < levels; b++) {
        var gb = pick(rnd, pool);
        restOrder(m, "buy", gb, dp, 2 + Math.floor(rnd() * 8), round2(bpar + diffFor(gs, gb)), pick(rnd, TRADERS), rnd);
        bpar = clampTick(m, bpar - m.tick * (1 + Math.floor(rnd() * 3)));
      }
    });
  });
  S.markMarketSeeded();
}

function ensureSeed() {
  if (!S._db) S.load();
  if (!S.marketSeeded()) seedMarkets();
}

/* -------------------------------------------------- export */
RF.market = {
  MARKETS: MARKETS,
  GRADE_SYSTEMS: GRADE_SYSTEMS,
  TRADERS: TRADERS,
  list: allMarkets,
  registerMarket: registerMarket,
  marketById: marketById,
  gradeSystem: gradeSystem,
  gradeById: gradeById,
  diffFor: function (systemId, gradeId) { return diffFor(gradeSystem(systemId), gradeId); },
  parRank: function (systemId) { return parRank(gradeSystem(systemId)); },
  fmtPx: fmtPx,
  clampTick: clampTick,
  ensureSeed: ensureSeed,
  reseed: function () { S._db.orders = []; S._db.trades = []; S._db.orderSeq = 0; delete S._db.marketSeededAt; S.save(); seedMarkets(); },
  book: book,
  depth: depth,
  quote: quote,
  tape: tape,
  submitOrder: submitOrder,
  cancelOrder: cancelOrder,
  myOrders: myOrders,
  remaining: remaining
};

})();
