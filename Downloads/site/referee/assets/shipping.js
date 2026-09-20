/* Garsoore shipping engine (window.RF.shipping). No DOM. Load after config.js, before catalog.js.

   One rule governs this file: if Garsoore shows a customer a shipping price, Garsoore already knows how that shipment
   moves and which contracted rate produced the number. Nothing here invents a price from a market average, and nothing
   here quotes a route it cannot price — an unpriceable route returns { ok: false } and the product falls back to
   "Request a quote" rather than guessing.

   The rate cards live in data/rate-cards.json and are generated into assets/rate-cards.js (browser) and
   deploy/rates.gen.js (server) by tools/build-site.py, so the shop, the price export and the API all compute from the
   same contracted numbers. An order records the card id that priced it and is honoured at that rate for life.

   What the customer sees out of all this: "By Air 7-14 days $32" / "By Sea 25-45 days $9". Nothing else. */
(function () {
var RF = window.RF = window.RF || {};
var DATA = window.RF_RATE_CARDS || { cards: [], packedDensity: { _default: 175 } };

function cards() { return DATA.cards || []; }
function density(cat) { var d = DATA.packedDensity || {}; return d[cat] || d._default || 175; }

/* ---------------------------------------------------------------- picking the card that applies
   Newest effective card wins for a given lane and mode. `at` lets the server re-price an order against the card that
   was live when it was sold, which is how a locked price stays locked. */
function cardFor(mode, at) {
  var when = at ? String(at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  var live = cards().filter(function (c) {
    return c.mode === mode && c.status !== "expired" && c.effectiveFrom <= when && (!c.effectiveUntil || c.effectiveUntil >= when);
  });
  if (!live.length) live = cards().filter(function (c) { return c.mode === mode && c.status !== "expired"; });
  return live.sort(function (a, b) { return a.effectiveFrom < b.effectiveFrom ? 1 : -1; })[0] || null;
}
function cardById(id) { return cards().filter(function (c) { return c.id === id; })[0] || null; }

function roundUp(n, step) { return step > 0 ? Math.ceil(n / step - 1e-9) * step : n; }
function rateFor(card, qty) {
  var r = null;
  (card.tiers || []).forEach(function (t) { if (qty >= t.from) r = t.rate; });
  return r == null && card.tiers && card.tiers.length ? card.tiers[0].rate : r;
}

/* ---------------------------------------------------------------- packed size
   Real measured dimensions win. Otherwise volume is estimated from the item's own weight and its category's packed
   density, and the result is flagged as an estimate so nothing downstream can pass it off as measured. */
function packed(spec) {
  var qty = Math.max(1, spec.qty || 1), kg = (spec.kg || 0) * qty, d = spec.dims;
  if (d && d.l > 0 && d.w > 0 && d.h > 0) {
    var cbm = (d.l * d.w * d.h) / 1e6 * qty;
    return { kg: kg, cbm: cbm, source: "measured" };
  }
  if (!(kg > 0)) return { kg: 0, cbm: 0, source: "unknown" };
  return { kg: kg, cbm: kg / density(spec.cat), source: "estimated" };
}

/* ---------------------------------------------------------------- the calculation
   Air : chargeable = max(actual, volume / contracted divisor), rounded up to the contracted step.
   Sea : chargeable = CBM, but cargo denser than the contract's cap is charged on weight (the revenue-tonne rule every
         LCL agreement uses), then a minimum billable volume and a minimum charge apply. */
/* The chargeable quantity BEFORE the minimum and the rounding step. This is the number a basket shares its freight
   out by: apply the minimum per line and every line pays it, which is exactly the bug basket pricing exists to fix. */
function rawUnits(mode, kg, cbm, card) {
  if (mode === "air") return Math.max(kg, card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0);
  return Math.max(cbm, card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0);
}

/* Price ONE shipment of a given weight and volume. A basket is one shipment; so is a single item bought alone — the
   difference between them is entirely the minimum charge, which is why buying ten things is so much cheaper per thing. */
function bulk(mode, kg, cbm, at, rateCardId) {
  mode = mode === "sea" ? "sea" : "air";
  var card = rateCardId ? cardById(rateCardId) : cardFor(mode, at);
  if (!card) return { ok: false, reason: "no-rate-card", mode: mode };
  if (!(kg > 0) && !(cbm > 0)) return { ok: false, reason: "no-weight-or-dimensions", mode: mode };

  var units = rawUnits(mode, kg, cbm, card), basis;
  if (mode === "air") basis = (card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0) > kg ? "volumetric" : "actual";
  else basis = (card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0) > cbm ? "weight-capped" : "volume";

  var chargeable = roundUp(Math.max(units, card.minimumBillable || 0), card.roundingUnit || 0);
  var rate = rateFor(card, chargeable);
  if (rate == null) return { ok: false, reason: "no-tier", mode: mode };

  var raw = rate * chargeable, cost = Math.max(raw, card.minimumCharge || 0);
  return {
    ok: true, mode: mode, cost: Math.round(cost * 100) / 100,
    chargeable: Math.round(chargeable * 1000) / 1000, units: units, unit: card.unit, basis: basis,
    rate: rate, minimumApplied: cost > raw + 1e-9,
    rateCardId: card.id, rateCardStatus: card.status,
    transitMin: card.transitMinDays, transitMax: card.transitMaxDays,
    actualKg: Math.round(kg * 1000) / 1000, cbm: Math.round(cbm * 1000) / 1000
  };
}

function quote(spec) {
  var mode = spec.mode === "sea" ? "sea" : "air";
  var pk = packed(spec);
  var q = bulk(mode, pk.kg, pk.cbm, spec.at, spec.rateCardId);
  if (q.ok) { q.estimatedSize = pk.source === "estimated"; q.sizeSource = pk.source; }
  return q;
}

/* ---------------------------------------------------------------- one basket, one shipment
   `lines` are [{ kg, cat, qty, mode }]. Lines travelling by different lanes are different shipments and are priced
   separately; within a lane the freight is worked out once for the whole consignment and then shared out in
   proportion to each line's own chargeable quantity, so a heavy line cannot hide behind a light one.

   Everything this returns is what the CUSTOMER is charged. The identical calculation runs on the server, which is
   what the order is actually priced from. */
function basket(lines, at) {
  var groups = {}, i;
  (lines || []).forEach(function (l, idx) {
    var mode = l.mode === "sea" ? "sea" : "air";
    var pk = packed({ kg: l.kg, cat: l.cat, qty: l.qty || 1, dims: l.dims });
    (groups[mode] = groups[mode] || { lines: [], kg: 0, cbm: 0 });
    groups[mode].lines.push({ idx: idx, kg: pk.kg, cbm: pk.cbm, estimated: pk.source === "estimated" });
    groups[mode].kg += pk.kg; groups[mode].cbm += pk.cbm;
  });

  var out = { groups: {}, shares: {}, ok: true };
  for (var mode in groups) {
    var g = groups[mode], q = bulk(mode, g.kg, g.cbm, at);
    if (!q.ok) { out.ok = false; out.reason = q.reason; continue; }
    var card = cardById(q.rateCardId);
    var units = g.lines.map(function (x) { return Math.max(rawUnits(mode, x.kg, x.cbm, card), 1e-9); });
    var totalUnits = units.reduce(function (a, b) { return a + b; }, 0) || 1;
    /* allocate to the cent, then give any rounding remainder to the largest line so the shares always sum to the
       freight actually paid — a basket that does not add up is a basket somebody will not trust */
    var allocated = 0, biggest = 0;
    g.lines.forEach(function (x, k) { if (units[k] > units[biggest]) biggest = k; });
    g.lines.forEach(function (x, k) {
      var share = Math.round(q.cost * units[k] / totalUnits * 100) / 100;
      out.shares[x.idx] = { mode: mode, freight: share, estimated: x.estimated };
      allocated += share;
    });
    var drift = Math.round((q.cost - allocated) * 100) / 100;
    if (drift !== 0) out.shares[g.lines[biggest].idx].freight = Math.round((out.shares[g.lines[biggest].idx].freight + drift) * 100) / 100;
    out.groups[mode] = q;
  }
  return out;
}

/* both lanes at once, for the two buttons the customer actually sees */
function options(spec) {
  var out = {}, any = false;
  ["air", "sea"].forEach(function (m) {
    var q = quote({ kg: spec.kg, dims: spec.dims, cat: spec.cat, qty: spec.qty, mode: m, at: spec.at, rateCardId: spec.rateCardIds && spec.rateCardIds[m] });
    if (q.ok) { out[m] = q; any = true; }
  });
  return any ? out : null;
}

RF.shipping = {
  data: DATA, cards: cards, cardFor: cardFor, cardById: cardById, density: density,
  packed: packed, quote: quote, options: options, bulk: bulk, basket: basket, rawUnits: rawUnits,
  /* is every card that prices the shop actually signed? the admin console asks this */
  unsigned: function () { return cards().filter(function (c) { return c.status !== "contracted"; }).map(function (c) { return c.id; }); }
};
})();
