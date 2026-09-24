/* Garsoore freight engine — the lane, as data and pure functions.
 *
 * This module knows one thing: how goods physically move from a Chinese supplier to a customer in Mogadishu, and
 * what that movement costs. It has no DOM, no database and no network, so it can be reasoned about, unit-tested, and
 * reused by the Worker, the ops console and any future scheduled job without any of them disagreeing about a state.
 *
 * The lane:
 *   supplier → FORWARDER'S CHINA WAREHOUSE (consolidation) → one AWB/BL → Mogadishu
 *            → arrived PORT OF MOGADISHU (sea) or ADEN ADDE / MGQ (air cargo)
 *            → import clearance, run by Garsoore → port/airport pickup → last mile → customer.
 *
 * Two corrections are baked in here and are the reason this file exists:
 *   1. The consolidation point is the forwarder's warehouse, NOT one Garsoore owns. We borrow a shed; we do not
 *      build one. The per-batch `receive_code` is what the supplier writes on the label.
 *   2. There is no Cainiao. The forwarder is a China→Somalia specialist; how we hear from them is `webhook | poll |
 *      portal | manual`, and every one of those lands as the same event shape (see applyEvent).
 *
 * Everything here is deterministic: same inputs, same numbers, every time. That matters because these numbers are
 * shown to customers and written into orders, and two code paths quietly disagreeing is how a customer pays one
 * price and is billed another.
 */
import { RATES } from "./rates.gen.js";
import { PRICING } from "./catalog.gen.js";

/* ------------------------------------------------------------------ states
   Two sequences, one physical consignment under them. A procurement line tracks one order's goods; a consignment
   tracks the batch they ride in. The customer's order state is derived from the consignment, never set by hand. */

export const PROCUREMENT = ["QUEUED", "ORDERED", "IN_CHINA", "AT_FORWARDER", "CONSOLIDATED", "SHIPPED", "ARRIVED", "CLEARED", "PICKED_UP", "DELIVERED"];
export const CONSIGNMENT = ["OPEN", "SEALED", "HANDED_OVER", "IN_TRANSIT", "ARRIVED_PORT", "IN_CLEARANCE", "CLEARED", "COLLECTED", "CLOSED"];

/* A consignment can only move forward, or into a named branch. HELD is not a failure — it is a customs hold, which
   is a real thing that happens and that a customer must be told about rather than left in the dark. */
const TRANSITIONS = {
  OPEN:         ["SEALED", "CANCELLED"],
  SEALED:       ["HANDED_OVER", "OPEN", "CANCELLED"],
  HANDED_OVER:  ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT:   ["ARRIVED_PORT", "HELD"],
  ARRIVED_PORT: ["IN_CLEARANCE", "CLEARED", "HELD"],
  IN_CLEARANCE: ["CLEARED", "HELD"],
  HELD:         ["IN_CLEARANCE", "CLEARED"],
  CLEARED:      ["COLLECTED"],
  COLLECTED:    ["CLOSED"],
  CLOSED:       [],
  CANCELLED:    []
};
export const canMove = (from, to) => (TRANSITIONS[from] || []).includes(to);
export const isTerminal = s => (TRANSITIONS[s] || []).length === 0;
export const isOpen = s => s === "OPEN" || s === "SEALED";

/* Move a consignment, or refuse and say why. Returns a new object; never mutates. */
export function advance(cons, to, { at, by, note } = {}) {
  const from = cons.state;
  if (from === to) return { ok: true, cons, noop: true };
  if (!canMove(from, to)) return { ok: false, cons, why: `Kama gudbi karo ${from} → ${to}.` };
  const history = (cons.history || []).concat([{ state: to, at: at || new Date().toISOString(), by: by || null, note: note || null }]);
  const next = Object.assign({}, cons, { state: to, history, updatedAt: at || new Date().toISOString() });
  if (to === "HANDED_OVER" && !next.departed_at) next.departed_at = at || null;
  if (to === "ARRIVED_PORT") next.arrived_at = at || null;
  if (to === "CLEARED") next.cleared_at = at || null;
  if (to === "COLLECTED") next.collected_at = at || null;
  return { ok: true, cons: next };
}

/* ------------------------------------------------------------------ events → legs
   Forwarders word events differently and change them without notice. We read loosely, map what we recognise onto a
   LEG, and leave the rest as an observation that changes no state — because inventing a "your goods arrived" out of
   a message we did not understand is the one error a customer never forgives. */
const LEGS = [
  ["received",      /\b(received|arrived\s*at\s*warehouse|warehouse\s*receipt|inbound|signed\s*for|caabiyay)\b/i],
  ["consolidated",  /\b(consolidat|repack|re-pack|sealed|loaded\s*for\s*export)\b/i],
  ["handed_over",   /\b(handed\s*over|departed\s*origin|export\s*customs\s*cleared|awb|bill\s*of\s*lading|booked)\b/i],
  ["in_transit",    /\b(in\s*transit|departed|uplifted|on\s*board|en\s*route|in\s*transit|socdaa)\b/i],
  ["arrived_port",  /\b(arrived|arrival|discharged|landed|at\s*port|at\s*airport|airport|gareyay)\b/i],
  ["customs_hold",  /\b(hold|detained|exam|inspection\s*required|duty\s*due|held\s*by\s*customs)\b/i],
  ["cleared",       /\b(cleared|released\s*by\s*customs|release\s*document|delivery\s*order)\b/i],
  ["collected",     /\b(collected|picked\s*up|delivered|signed\s*out|qaaday)\b/i]
];
export function classifyEvent(text, code) {
  const s = String(text || "") + " " + String(code || "");
  for (const [leg, re] of LEGS) if (re.test(s)) return leg;
  return "observed";                 // true, but it does not move anything
}

/* Where a consignment state puts its child procurement lines. This is the single mapping — no route re-derives it. */
const CONS_TO_PROC = {
  OPEN: "AT_FORWARDER", SEALED: "CONSOLIDATED", HANDED_OVER: "SHIPPED", IN_TRANSIT: "SHIPPED",
  ARRIVED_PORT: "ARRIVED", IN_CLEARANCE: "ARRIVED", HELD: "ARRIVED", CLEARED: "CLEARED",
  COLLECTED: "PICKED_UP", CLOSED: "DELIVERED"
};
export const procStateFor = consState => CONS_TO_PROC[consState] || null;

/* And where it puts the customer's order (FLOW.china in api.js). ARRIVED is deliberately kept short: the honest
   "your goods are in the country but not yet cleared and not yet yours to collect" state. */
const CONS_TO_ORDER = {
  IN_TRANSIT: "IN_TRANSIT", ARRIVED_PORT: "ARRIVED", IN_CLEARANCE: "ARRIVED", HELD: "ARRIVED",
  CLEARED: "READY", COLLECTED: "READY"
};
export const orderStateFor = consState => CONS_TO_ORDER[consState] || null;

/* Apply a tracking event (from any source) to a consignment. Returns { cons, leg, moved } — `moved` is false when
   the event was understood but the consignment was already at or past that leg. Callers persist `cons` and, when the
   order target changed, advance the child orders in the same batch. */
export function applyEvent(cons, ev) {
  const leg = classifyEvent(ev.text, ev.code);
  const target = { received: null, consolidated: "SEALED", handed_over: "HANDED_OVER", in_transit: "IN_TRANSIT",
    arrived_port: "ARRIVED_PORT", customs_hold: "HELD", cleared: "CLEARED", collected: "COLLECTED", observed: null }[leg];
  if (!target || cons.state === target) return { cons, leg, moved: false };
  const r = advance(cons, target, { at: ev.at, by: ev.by });
  return r.ok ? { cons: r.cons, leg, moved: true } : { cons, leg, moved: false, why: r.why };
}

/* ------------------------------------------------------------------ costing
   Same arithmetic as assets/shipping.js and deploy/api.js against the same generated cards. Kept here so the
   consignment ledger, the customer's basket and the ops console all read one implementation. */
export function rateCardFor(mode, at) {
  const when = (at || new Date().toISOString()).slice(0, 10);
  const live = RATES.cards.filter(c => c.mode === mode && c.status !== "expired" && c.effectiveFrom <= when && (!c.effectiveUntil || c.effectiveUntil >= when));
  const pool = live.length ? live : RATES.cards.filter(c => c.mode === mode && c.status !== "expired");
  return pool.sort((a, b) => a.effectiveFrom < b.effectiveFrom ? 1 : -1)[0] || null;
}
function rawUnits(mode, kg, cbm, card) {
  if (mode === "air") return Math.max(kg, card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0);
  return Math.max(cbm, card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0);
}
export function packedCbm(kg, cat) { const d = RATES.packedDensity || {}; return kg / (d[cat] || d._default || 175); }

/* What the main leg costs Garsoore under the contracted card — the number we PAY, not the price we charge a merchant. */
export function freightCost(mode, kg, cbm, at) {
  const card = rateCardFor(mode, at);
  if (!card) return null;
  kg = +kg || 0; cbm = +cbm || 0;
  let chargeable = (card.mode === "air")
    ? Math.max(kg, card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0)
    : Math.max(cbm, card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0);
  let rate, cost;
  const typical = +card.typicalConsignment || 0;
  if (typical > 0 && chargeable < typical) {           // pooled: the shipment minimum is shared, not paid per line
    rate = card.tiers[0].rate;
    card.tiers.forEach(t => { if (typical >= t.from) rate = t.rate; });
    cost = Math.max(rate * typical, card.minimumCharge || 0) * (chargeable / typical);
    chargeable = Math.round(chargeable * 1000) / 1000;
  } else {
    chargeable = Math.max(chargeable, card.minimumBillable || 0);
    const step = card.roundingUnit || 0;
    if (step > 0) chargeable = Math.ceil(chargeable / step - 1e-9) * step;
    rate = card.tiers[0].rate;
    card.tiers.forEach(t => { if (chargeable >= t.from) rate = t.rate; });
    cost = Math.max(rate * chargeable, card.minimumCharge || 0);
  }
  return { cost: Math.round(cost * 100) / 100, chargeable: Math.round(chargeable * 1000) / 1000, rate, unit: card.unit,
    rateCardId: card.id, rateCardStatus: card.status, transitMin: card.transitMinDays, transitMax: card.transitMaxDays };
}
export function dutyRate(cat) {
  const b = (RATES.customs && RATES.customs.dutyBands) || {};
  return b[cat] != null ? b[cat] : (b._default != null ? b._default : PRICING.rules.duty);
}
export function clearanceRate(mode) {
  const c = ((RATES.customs && RATES.customs.perConsignment) || {})[mode === "sea" ? "sea" : "air"];
  if (!c || !(c.typical > 0)) return 0;
  const fees = c.fees || {};
  return Object.keys(fees).reduce((n, k) => n + (+fees[k] || 0), 0) / c.typical;
}

/* Cost a whole consignment: main-leg freight (once, pooled), duty on CIF per line, and the fixed clearance loading
   shared over the batch. Returns the total plus a per-line share, so the ledger and the order line agree to the cent. */
export function consignmentCost(lines, mode, at) {
  const items = lines.map(l => {
    const kg = (+l.kg || 0) * Math.max(1, +l.qty || 1);
    return { sku: l.sku, qty: Math.max(1, +l.qty || 1), kg, cbm: l.cbm != null ? +l.cbm : packedCbm(kg, l.cat),
      value: +l.value || 0, cat: l.cat };
  });
  const kg = items.reduce((a, x) => a + x.kg, 0), cbm = items.reduce((a, x) => a + x.cbm, 0);
  const q = freightCost(mode, kg, cbm, at);
  if (!q) return { ok: false, why: "No live rate card for " + mode };
  const card = RATES.cards.find(c => c.id === q.rateCardId);
  const units = items.map(x => Math.max(rawUnits(mode, x.kg, x.cbm, card), 1e-9));
  const totalUnits = units.reduce((a, b) => a + b, 0) || 1;
  const clrTotal = Math.round(clearanceRate(mode) * q.chargeable * 100) / 100;
  let fAlloc = 0, cAlloc = 0, biggest = 0;
  units.forEach((u, k) => { if (u > units[biggest]) biggest = k; });
  const perLine = items.map((x, k) => {
    const freight = Math.round(q.cost * units[k] / totalUnits * 100) / 100;
    const clearance = Math.round(clrTotal * units[k] / totalUnits * 100) / 100;
    fAlloc += freight; cAlloc += clearance;
    const rate = dutyRate(x.cat);
    const duty = Math.round((x.value + freight) * rate * 100) / 100;     // CIF: goods + the freight that carried them
    return { sku: x.sku, qty: x.qty, kg: Math.round(x.kg * 1000) / 1000, freight, clearance, duty, dutyRate: rate, value: x.value };
  });
  /* rounding remainder goes to the largest line so the shares always sum to the freight actually paid */
  const fDrift = Math.round((q.cost - fAlloc) * 100) / 100, cDrift = Math.round((clrTotal - cAlloc) * 100) / 100;
  if (fDrift) perLine[biggest].freight = Math.round((perLine[biggest].freight + fDrift) * 100) / 100;
  if (cDrift) perLine[biggest].clearance = Math.round((perLine[biggest].clearance + cDrift) * 100) / 100;
  const dutyTotal = perLine.reduce((a, x) => a + x.duty, 0);
  return { ok: true, mode, rateCardId: q.rateCardId, rateCardStatus: q.rateCardStatus,
    kg: Math.round(kg * 1000) / 1000, cbm: Math.round(cbm * 1000) / 1000, chargeable: q.chargeable,
    transitMin: q.transitMin, transitMax: q.transitMax,
    freight: q.cost, clearance: clrTotal, duty: Math.round(dutyTotal * 100) / 100,
    total: Math.round((q.cost + clrTotal + dutyTotal) * 100) / 100, perLine };
}

/* ------------------------------------------------------------------ grouping
   Turn open purchase lines into proposed consignments. The rule: one batch per (mode, forwarder warehouse) that
   leaves on the same cut-off. We never pool air and sea — they are different shipments and different customers'
   ETAs — and we never split a single order across batches. */
export function proposeConsignments(pos, { mode, forwarder, cutOff } = {}) {
  const buckets = {};
  for (const po of pos) {
    if (!po || !po.qty) continue;
    const m = mode || po.mode || "air";
    const key = m + "|" + (forwarder || po.forwarder || "manual");
    (buckets[key] = buckets[key] || { mode: m, forwarder: forwarder || po.forwarder || "manual", lines: [] }).lines.push(po);
  }
  return Object.values(buckets).map(b => {
    const cost = consignmentCost(b.lines, b.mode, cutOff);
    return { mode: b.mode, forwarder: b.forwarder, arrivalPort: b.mode === "sea" ? "PORT_MOGADISHU" : "AIRPORT_MGQ",
      lines: b.lines.map(l => l.id || l.po || l.sku), cutOff: cutOff || null,
      weightKg: cost.ok ? cost.kg : null, cbm: cost.ok ? cost.cbm : null, estCost: cost.ok ? cost.total : null };
  });
}

/* A suggested ETA window for the customer, from the card's transit days off the handover date. */
export function etaWindow(mode, handoverAt) {
  const q = freightCost(mode, 0, 0, handoverAt);
  if (!q) return null;
  const base = new Date(handoverAt || Date.now());
  const add = d => new Date(base.getTime() + d * 864e5).toISOString().slice(0, 10);
  return { min: add(q.transitMin || 0), max: add(q.transitMax || 0), transitMin: q.transitMin, transitMax: q.transitMax };
}
