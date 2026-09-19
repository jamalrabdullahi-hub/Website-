/* ==========================================================================
   Garsoore — Logistics layer  (window.RF.logi)
   A freight board built on rails: shippers press "Just move it" and answer a
   short guided RFQ; underneath is the mechanism real carriers & coordinators
   use — capacity posted against fixed ROUTES/LANES per mode:
     · AIR  — air-cargo routes (domestic + regional feeder)
     · SEA  — domestic coastal / feeder port routes
     · LAND — domestic road corridors
   A load is matched to posted capacity on a lane; the booking runs the `logi`
   lifecycle (engine.js) with escrow held in the business wallet (b2b.js).
   Depends on engine.js; uses RF.b2b.wallet when available.
   ========================================================================== */
(function () {
"use strict";
var RF = window.RF, S = RF.store;

/* -------------------------------------------------- nodes */
var AIR_NODES = [
  { code: "MGQ", name: "Mogadishu — Aden Adde" }, { code: "HGA", name: "Hargeisa — Egal" },
  { code: "BSA", name: "Bosaso — Bender Qassim" }, { code: "GGR", name: "Garowe" },
  { code: "GLK", name: "Galkayo" }, { code: "KMU", name: "Kismayo" }, { code: "BIB", name: "Baidoa" },
  { code: "BBO", name: "Berbera" }, { code: "NBO", name: "Nairobi (feeder)" }, { code: "JIB", name: "Djibouti (feeder)" }
];
var SEA_NODES = ["Mogadishu Port", "Berbera Port", "Bosaso Port", "Kismayo Port", "Marka anchorage"];
var LAND_NODES = ["Mogadishu (Km4 yard)", "Afgooye", "Baidoa", "Beledweyne", "Dhusamareb", "Galkayo",
  "Garowe", "Bosaso", "Hargeisa", "Berbera", "Wajaale (border)", "Kismayo", "Dhobley (border)", "Doolow (border)"];

function airName(code) { for (var i = 0; i < AIR_NODES.length; i++) if (AIR_NODES[i].code === code) return AIR_NODES[i].name; return code; }

/* -------------------------------------------------- lanes (routes on rails) */
// [from, to, transitHours, frequency, note]
var AIR_L = [
  ["MGQ", "HGA", 1.5, "Daily", ""], ["MGQ", "BSA", 1.8, "Daily", ""], ["MGQ", "GGR", 1.5, "5x / week", ""],
  ["MGQ", "GLK", 1.3, "4x / week", ""], ["MGQ", "KMU", 1.0, "Daily", ""], ["MGQ", "BIB", 0.8, "3x / week", ""],
  ["HGA", "BSA", 1.0, "3x / week", ""], ["HGA", "BBO", 0.4, "On request", "Short hop"],
  ["MGQ", "NBO", 2.3, "Daily", "Regional feeder"], ["MGQ", "JIB", 2.0, "4x / week", "Regional feeder"]
];
var SEA_L = [
  ["Mogadishu Port", "Bosaso Port", 72, "Weekly", "Coastal feeder"],
  ["Mogadishu Port", "Kismayo Port", 36, "Weekly", "Coastal feeder"],
  ["Berbera Port", "Bosaso Port", 48, "Fortnightly", "Gulf of Aden coastal"],
  ["Berbera Port", "Mogadishu Port", 84, "Fortnightly", "Long coastal"],
  ["Mogadishu Port", "Marka anchorage", 12, "On demand", "Dhow lighterage"]
];
var LAND_L = [
  ["Mogadishu (Km4 yard)", "Baidoa", 24, "Daily", "256 km · Afgooye corridor"],
  ["Mogadishu (Km4 yard)", "Beledweyne", 36, "Daily", "335 km"],
  ["Mogadishu (Km4 yard)", "Kismayo", 48, "3x / week", "490 km · convoy advised"],
  ["Mogadishu (Km4 yard)", "Galkayo", 48, "Daily", "700 km"],
  ["Galkayo", "Garowe", 24, "Daily", "250 km"],
  ["Garowe", "Bosaso", 36, "Daily", "450 km"],
  ["Berbera", "Hargeisa", 12, "Daily", "160 km"],
  ["Hargeisa", "Wajaale (border)", 8, "Daily", "80 km · Ethiopia border"],
  ["Baidoa", "Doolow (border)", 36, "3x / week", "320 km · Ethiopia border"],
  ["Kismayo", "Dhobley (border)", 12, "Daily", "130 km · Kenya border"],
  ["Afgooye", "Baidoa", 22, "Daily", "220 km"]
];

var LANES = [];
function addLanes(mode, arr, both) {
  arr.forEach(function (r) {
    LANES.push({ id: mode + ":" + r[0] + ">" + r[1], mode: mode, from: r[0], to: r[1], transitHrs: r[2], freq: r[3], note: r[4] });
    if (both) LANES.push({ id: mode + ":" + r[1] + ">" + r[0], mode: mode, from: r[1], to: r[0], transitHrs: r[2], freq: r[3], note: r[4] });
  });
}
addLanes("Air", AIR_L, true);
addLanes("Sea", SEA_L, true);
addLanes("Land", LAND_L, true);

function laneById(id) { for (var i = 0; i < LANES.length; i++) if (LANES[i].id === id) return LANES[i]; }
function laneLabel(l) {
  if (l.mode === "Air") return l.from + " → " + l.to + "  ·  " + airName(l.from).split(" — ")[0] + " / " + airName(l.to).split(" — ")[0];
  return l.from + "  →  " + l.to;
}

var MODES = ["Air", "Sea", "Land"];
function modesFor(pick) { return (pick === "Air" || pick === "Sea" || pick === "Land") ? [pick] : MODES; }

var CARRIERS = ["Jubba Airways Cargo", "African Express Cargo", "Halla Airlines", "Freedom Air Freight",
  "Barwaqo Coastal Lines", "Xeebta Feeder Co.", "Berbera Maritime", "Trans-Somali Trucking",
  "Km4 Fleet Services", "Danab Haulage", "Nomad Logistics", "Horn Freight Coordinators"];

var SERVICES = {
  Air: ["General cargo", "Express", "Perishables / cool", "Valuables", "Live animals"],
  Sea: ["Breakbulk", "Containerised (FCL)", "Containerised (LCL)", "Bulk", "Ro-Ro"],
  Land: ["FTL — full truck", "LTL — part load", "Reefer truck", "Flatbed / oversize", "Tanker", "Container haulage"]
};
var RATE_BASES = { Air: ["$/kg"], Sea: ["$/MT", "$/m³", "$/TEU"], Land: ["$/truck", "$/MT"] };

/* -------------------------------------------------- store */
function db() {
  if (!S._db) S.load();
  if (!S._db.logiCapacity) S._db.logiCapacity = [];
  if (!S._db.logiShipments) S._db.logiShipments = [];
  return S._db;
}
function nowISO() { return new Date().toISOString(); }
function addDays(iso, n) { var d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fMoney(n) { return "$" + Math.round(n).toLocaleString(); }

/* -------------------------------------------------- chargeable weight / volume */
function chargeable(ship, basis) {
  var w = +ship.weightKg || 0, v = +ship.volumeM3 || 0;
  switch (basis) {
    case "$/kg":  return Math.round(Math.max(w, v * 167));                 // IATA volumetric, 1 m³ ≈ 167 kg
    case "$/MT":  return Math.round(Math.max(w / 1000, v) * 10) / 10;      // revenue ton (weight or measure)
    case "$/m³":  return Math.round(v * 10) / 10;
    case "$/TEU": return Math.max(1, Math.ceil(Math.max(v / 33, w / 21000)));
    case "$/truck": return Math.max(1, Math.ceil(Math.max(w / 28000, v / 60)));
    default: return Math.max(w, v);
  }
}
function basisUnit(basis) { return basis.replace("$/", ""); }
function quote(cap, ship) {
  var q = chargeable(ship, cap.rateBasis);
  var raw = cap.rate * q;
  var price = Math.max(raw, cap.minCharge || 0);
  return { price: Math.round(price), basisQty: q, basis: cap.rateBasis, unit: basisUnit(cap.rateBasis) };
}

/* -------------------------------------------------- matching */
function handlingOk(cap, ship) {
  var h = ship.handling || "None", sv = (cap.service || "").toLowerCase();
  var pk = (ship.packaging || "").toLowerCase();
  // equipment / packaging compatibility
  if (/tanker/.test(sv) && !/loose|bulk/.test(pk)) return false;            // tanker only for bulk liquids
  if (/ro-ro/.test(sv) && !/vehicle|rolling/.test(pk)) return false;         // Ro-Ro only for rolling stock
  if (/vehicle|rolling/.test(pk) && !/ro-ro|flatbed|breakbulk/.test(sv)) return false;
  if (/containerised/.test(pk) && !/container|fcl|lcl/.test(sv)) return false;
  // handling requirements
  if (h.indexOf("Refrigerated") === 0) return cap.reefer === true || /reefer|cool|perishable/.test(sv);
  if (h.indexOf("Hazardous") === 0) return cap.hazmat === true || /bulk|tanker/.test(sv);
  if (h.indexOf("Oversize") === 0) return /flatbed|breakbulk|bulk|ro-ro|oversize|project/.test(sv);
  return true;
}
function matchLoad(ship) {
  var modes = modesFor(ship.mode);
  var laneIds = {};
  LANES.forEach(function (l) { if (modes.indexOf(l.mode) >= 0 && l.from === ship.from && l.to === ship.to) laneIds[l.id] = 1; });
  var out = [];
  db().logiCapacity.forEach(function (c) {
    if (!laneIds[c.laneId] || c.available <= 0 || c.status === "closed") return;
    if (!handlingOk(c, ship)) return;
    if (ship.deliverBy && c.depart && c.depart > ship.deliverBy) return;
    if (ship.ready && c.depart && c.depart < addDays(ship.ready, -3)) return;
    var q = quote(c, ship);
    if (q.basisQty > c.available) return;
    out.push({ capacityId: c.id, carrier: c.carrier, verified: c.verified, lane: laneById(c.laneId),
      service: c.service, equipment: c.equipment, depart: c.depart, transitHrs: c.transitHrs,
      price: q.price, basisQty: q.basisQty, unit: q.unit, rate: c.rate, rateBasis: c.rateBasis });
  });
  out.sort(function (a, b) {
    return ship.mode === "Fastest" ? a.transitHrs - b.transitHrs : a.price - b.price;
  });
  return out;
}

/* -------------------------------------------------- shipments (RFQ) */
function shipments(who) {
  var all = db().logiShipments.slice();
  return who ? all.filter(function (s) { return s.shipper === who; }) : all.filter(function (s) { return s.status === "open"; });
}
function createShipment(v, shipper) {
  shipper = (shipper || RF.identity.get() || "").trim();
  if (!shipper) return { error: "Set your business name first." };
  var s = {
    id: RF.uid("shp"), shipper: shipper, mode: v.mode, from: v.from, to: v.to,
    cargo: v.cargo, packaging: v.packaging, weightKg: +v.weightKg || 0, volumeM3: +v.volumeM3 || 0,
    ready: v.ready, deliverBy: v.deliverBy, value: +v.value || 0, handling: v.handling || "None",
    tempC: v.tempC != null ? +v.tempC : null, service: v.service || "Door to door",
    status: "open", createdAt: nowISO(), bookingId: null
  };
  db().logiShipments.unshift(s);
  S.save();
  return s;
}

/* -------------------------------------------------- capacity postings */
function capacity(filter) {
  var all = db().logiCapacity.slice();
  filter = filter || {};
  return all.filter(function (c) {
    if (filter.mode && laneById(c.laneId) && laneById(c.laneId).mode !== filter.mode) return false;
    if (filter.laneId && c.laneId !== filter.laneId) return false;
    return true;
  });
}
function postCapacity(v, carrier) {
  carrier = (carrier || RF.identity.get() || "").trim();
  if (!carrier) return { error: "Set your carrier name first." };
  var lane = laneById(v.laneId);
  if (!lane) return { error: "Pick a route." };
  var c = {
    id: RF.uid("cap"), carrier: carrier, verified: false, laneId: v.laneId,
    service: v.service, equipment: v.equipment, depart: v.depart, cutoff: v.cutoff,
    transitHrs: +v.transitHrs || lane.transitHrs, rateBasis: v.rateBasis, rate: +v.rate || 0,
    minCharge: +v.minCharge || 0, available: +v.available || 0, notes: v.notes || "",
    reefer: v.reefer === true, hazmat: v.hazmat === true, status: "open", createdAt: nowISO()
  };
  db().logiCapacity.unshift(c);
  S.save();
  return c;
}

/* -------------------------------------------------- booking (deal, board 'logi') */
function docNo(mode) {
  var p = mode === "Air" ? "AWB" : mode === "Sea" ? "BL" : "CN";
  return p + "-" + Math.floor(100000 + Math.random() * 899999);
}
function book(shipmentId, capacityId) {
  var s = db().logiShipments.filter(function (x) { return x.id === shipmentId; })[0];
  var c = db().logiCapacity.filter(function (x) { return x.id === capacityId; })[0];
  if (!s || !c) return { error: "Shipment or capacity not found." };
  if (s.status !== "open") return { error: "Shipment already booked." };
  var lane = laneById(c.laneId);
  var q = quote(c, s);
  if (q.basisQty > c.available) return { error: "Not enough space on that departure." };

  var shipper = s.shipper;
  if (window.RF.b2b) {
    var h = RF.b2b.wallet.hold(shipper, q.price, "", "Held for freight " + lane.from + "→" + lane.to);
    if (h.error) return { error: h.error, need: "topup", amount: q.price };
  }
  var now = nowISO();
  var deal = {
    id: RF.uid("bkg"), board: "logi", listingId: null,
    title: (lane.mode === "Air" ? "✈ " : lane.mode === "Sea" ? "⚓ " : "🚚 ") + lane.from + " → " + lane.to +
      "  ·  " + q.basisQty + " " + q.unit,
    parties: { owner: c.carrier, counterparty: shipper },
    counterpartyRole: "shipper",
    state: "BOOKED", escrow: window.RF.b2b ? "held" : "n/a",
    amount: q.price, currency: "USD",
    history: [{ state: "BOOKED", at: now, by: shipper }],
    createdAt: now, updatedAt: now,
    meta: {
      mode: lane.mode, laneId: lane.id, from: lane.from, to: lane.to, carrier: c.carrier,
      service: c.service, equipment: c.equipment, depart: c.depart, transitHrs: c.transitHrs,
      rate: c.rate, rateBasis: c.rateBasis, basisQty: q.basisQty, unit: q.unit,
      cargo: s.cargo, packaging: s.packaging, handling: s.handling, weightKg: s.weightKg, volumeM3: s.volumeM3,
      docNo: null, podNo: null, shipmentId: s.id, capacityId: c.id
    }
  };
  S.addDeal(deal);
  c.available = Math.round((c.available - q.basisQty) * 100) / 100;
  s.status = "booked"; s.bookingId = deal.id;
  S.save();
  return deal;
}
function bookings(who) { return S.deals(who).filter(function (d) { return d.board === "logi"; }); }

function advanceBooking(id, toState, actor) {
  var d = S.deal(id); if (!d) return { error: "Booking not found." };
  var r = RF.lifecycle.advance(id, toState, actor);
  if (r && r.error) return r;
  if (toState === "CONFIRMED" && !d.meta.docNo) d.meta.docNo = docNo(d.meta.mode);
  if (toState === "DELIVERED" && !d.meta.podNo) d.meta.podNo = "POD-" + Math.floor(10000 + Math.random() * 89999);
  if (window.RF.b2b) {
    if (toState === "SETTLED") RF.b2b.wallet.settle(d.parties.counterparty, d.parties.owner, d.amount, d.meta.docNo || d.id);
    else if (toState === "CANCELLED") RF.b2b.wallet.refund(d.parties.counterparty, d.amount, d.id, "Booking cancelled");
  }
  S.save();
  return S.deal(id);
}

/* -------------------------------------------------- wizard fieldsets (on rails) */
function optOrigins(v) {
  var set = {};
  modesFor(v.mode).forEach(function (m) {
    LANES.forEach(function (l) { if (l.mode === m) set[l.from] = 1; });
  });
  return Object.keys(set).map(function (x) { return { value: x, label: (v.mode === "Air" || (modesFor(v.mode).length === 3)) && airName(x) !== x ? airName(x) : x }; });
}
function optDests(v) {
  if (!v.from) return [];
  var set = {};
  modesFor(v.mode).forEach(function (m) {
    LANES.forEach(function (l) { if (l.mode === m && l.from === v.from) set[l.to] = 1; });
  });
  return Object.keys(set).map(function (x) { return { value: x, label: airName(x) !== x ? airName(x) : x }; });
}
var SHIP_FIELDS = [
  { id: "mode", label: "How should it move?", type: "enum", required: true,
    options: ["Air", "Sea", "Land", "Cheapest", "Fastest"],
    help: "Air is fastest, Sea is cheapest for heavy bulk, Land covers the domestic road corridors. Not sure? pick Cheapest or Fastest and we compare every mode." },
  { id: "from", label: "Collect from", type: "enum", required: true, options: optOrigins },
  { id: "to", label: "Deliver to", type: "enum", required: true, options: optDests },
  { id: "cargo", label: "What are we moving?", type: "text", required: true, placeholder: "e.g. 6 pallets of medical supplies" },
  { id: "packaging", label: "How is it packed?", type: "enum", required: true,
    options: ["Palletised", "Boxed / cartons", "Sacks / bags", "Loose / bulk", "Containerised", "Vehicle / rolling", "Project / oversize"] },
  { id: "weightKg", label: "Total weight (kg)", type: "number", required: true },
  { id: "volumeM3", label: "Total volume (m³)", type: "number", required: true,
    help: "A rough figure is fine. For air freight, volume often drives the price more than weight." },
  { id: "ready", label: "Ready for pick-up", type: "date", required: true },
  { id: "deliverBy", label: "Needed by", type: "date", required: true },
  { id: "value", label: "Cargo value (USD)", type: "money", help: "Sets the insurance basis and the escrow hold." },
  { id: "handling", label: "Special handling", type: "enum",
    options: ["None", "Refrigerated / cold chain", "Fragile", "Hazardous (DG)", "High-value / security", "Oversize / heavy"] },
  { id: "tempC", label: "Target temperature (°C)", type: "number",
    dependsOn: [{ field: "handling", op: "eq", value: "Refrigerated / cold chain" }] },
  { id: "service", label: "Service scope", type: "enum",
    options: ["Door to door", "Port / airport to port / airport", "Door to port / airport", "Port / airport to door"] }
];

function optLanes(v) {
  return LANES.filter(function (l) { return l.mode === v.mode; })
    .map(function (l) { return { value: l.id, label: laneLabel(l) + "  ·  ~" + (l.transitHrs >= 24 ? Math.round(l.transitHrs / 24) + " d" : l.transitHrs + " h") }; });
}
var CAP_FIELDS = [
  { id: "mode", label: "Mode", type: "enum", required: true, options: MODES },
  { id: "laneId", label: "Route", type: "enum", required: true, options: optLanes },
  { id: "service", label: "Service", type: "enum", required: true, options: function (v) { return SERVICES[v.mode] || []; } },
  { id: "equipment", label: "Aircraft / vessel / vehicle", type: "text", required: true,
    placeholder: "e.g. B737-300F · coastal feeder 180 TEU · flatbed 30 t" },
  { id: "depart", label: "Departure date", type: "date", required: true },
  { id: "cutoff", label: "Cargo cut-off", type: "date", required: true },
  { id: "transitHrs", label: "Transit time (hours)", type: "number", required: true },
  { id: "rateBasis", label: "Rate basis", type: "enum", required: true, options: function (v) { return RATE_BASES[v.mode] || []; } },
  { id: "rate", label: "Rate (USD per unit)", type: "money", required: true },
  { id: "minCharge", label: "Minimum charge (USD)", type: "money" },
  { id: "available", label: "Capacity available (in the rate-basis unit)", type: "number", required: true },
  { id: "reefer", label: "Reefer / temperature-controlled", type: "bool" },
  { id: "hazmat", label: "Accepts dangerous goods", type: "bool" },
  { id: "notes", label: "Notes / restrictions", type: "textarea", placeholder: "Escort, convoy, DG class, oversize limits…" }
];

/* -------------------------------------------------- seed */
function C(carrier, verified, laneId, service, equipment, departDays, cutoffDays, transitHrs, basis, rate, minCharge, avail, reefer, hazmat, notes) {
  return { id: RF.uid("cap"), carrier: carrier, verified: verified, laneId: laneId, service: service, equipment: equipment,
    depart: addDays(nowISO(), departDays), cutoff: addDays(nowISO(), cutoffDays), transitHrs: transitHrs,
    rateBasis: basis, rate: rate, minCharge: minCharge, available: avail, reefer: !!reefer, hazmat: !!hazmat,
    notes: notes || "", status: "open", createdAt: nowISO() };
}
var SEED_CAP = [
  C("Jubba Airways Cargo", true, "Air:MGQ>HGA", "General cargo", "B737-300F", 3, 2, 1.5, "$/kg", 0.95, 45, 4200, false, false, "Belly + main deck. DG on approval."),
  C("African Express Cargo", true, "Air:MGQ>HGA", "Perishables / cool", "B727F cool hold", 5, 4, 1.5, "$/kg", 1.25, 60, 1800, true, false, "Chilled hold 2–8 °C."),
  C("Halla Airlines", true, "Air:MGQ>BSA", "General cargo", "An-24 combi", 4, 3, 1.8, "$/kg", 1.10, 50, 2600, false, false, ""),
  C("Freedom Air Freight", true, "Air:MGQ>KMU", "General cargo", "Do-228", 2, 1, 1.0, "$/kg", 1.30, 40, 900, false, false, "Small hold, 250 kg pieces max."),
  C("Jubba Airways Cargo", true, "Air:MGQ>GGR", "General cargo", "B737-300F", 6, 5, 1.5, "$/kg", 1.05, 45, 3800, false, false, ""),
  C("African Express Cargo", true, "Air:MGQ>NBO", "General cargo", "B767F", 2, 1, 2.3, "$/kg", 1.60, 75, 12000, false, true, "Regional feeder, DG accepted."),
  C("Halla Airlines", true, "Air:HGA>MGQ", "General cargo", "An-24 combi", 3, 2, 1.5, "$/kg", 0.98, 45, 2400, false, false, ""),

  C("Barwaqo Coastal Lines", true, "Sea:Mogadishu Port>Bosaso Port", "Breakbulk", "MV Barwaqo — 1,900 DWT", 6, 4, 72, "$/MT", 34, 250, 900, false, false, "Weekly sailing, general & bagged cargo."),
  C("Xeebta Feeder Co.", true, "Sea:Mogadishu Port>Bosaso Port", "Containerised (LCL)", "Feeder 180 TEU", 9, 7, 72, "$/m³", 42, 120, 260, false, false, "LCL consolidation, weekly."),
  C("Berbera Maritime", true, "Sea:Berbera Port>Bosaso Port", "Containerised (FCL)", "Feeder 320 TEU", 8, 6, 48, "$/TEU", 640, 0, 40, false, false, "20ft & 40ft, fortnightly."),
  C("Barwaqo Coastal Lines", true, "Sea:Mogadishu Port>Kismayo Port", "Bulk", "MV Juba — 1,200 DWT", 4, 3, 36, "$/MT", 28, 200, 700, false, false, "Grain & aggregates."),
  C("Xeebta Feeder Co.", true, "Sea:Berbera Port>Mogadishu Port", "Breakbulk", "MV Xeebta", 10, 8, 84, "$/MT", 46, 300, 800, false, false, "Long coastal, fortnightly."),

  C("Trans-Somali Trucking", true, "Land:Mogadishu (Km4 yard)>Baidoa", "FTL — full truck", "Flatbed 30 t", 1, 1, 24, "$/truck", 520, 0, 6, false, false, "Daily departures, tarpaulin, GPS."),
  C("Km4 Fleet Services", true, "Land:Mogadishu (Km4 yard)>Baidoa", "LTL — part load", "Curtainside 12 t", 2, 1, 26, "$/MT", 22, 40, 30, false, false, "Groupage, 3x weekly."),
  C("Danab Haulage", true, "Land:Mogadishu (Km4 yard)>Beledweyne", "FTL — full truck", "Flatbed 28 t", 2, 1, 36, "$/truck", 700, 0, 4, false, false, ""),
  C("Nomad Logistics", true, "Land:Mogadishu (Km4 yard)>Kismayo", "FTL — full truck", "Container chassis 2x20ft", 3, 2, 48, "$/truck", 1150, 0, 3, false, false, "Convoy on Fridays, escort optional."),
  C("Trans-Somali Trucking", true, "Land:Mogadishu (Km4 yard)>Galkayo", "Reefer truck", "Reefer 20ft", 4, 3, 48, "$/truck", 1400, 0, 2, true, false, "−18 to +8 °C, generator set."),
  C("Danab Haulage", true, "Land:Berbera>Hargeisa", "FTL — full truck", "Flatbed 30 t", 1, 1, 12, "$/truck", 260, 0, 8, false, false, "Port shuttle, hourly."),
  C("Km4 Fleet Services", true, "Land:Garowe>Bosaso", "FTL — full truck", "Flatbed 28 t", 2, 1, 36, "$/truck", 620, 0, 5, false, false, ""),
  C("Nomad Logistics", true, "Land:Mogadishu (Km4 yard)>Baidoa", "Tanker", "Fuel tanker 30,000 L", 3, 2, 24, "$/truck", 780, 0, 3, false, true, "AGO / petrol only.")
];
var SEED_SHIP = [
  { id: RF.uid("shp"), shipper: "Baraka Wholesale", mode: "Land", from: "Mogadishu (Km4 yard)", to: "Baidoa",
    cargo: "180 bags of wheat flour (50 kg)", packaging: "Sacks / bags", weightKg: 9000, volumeM3: 14,
    ready: addDays(nowISO(), 1), deliverBy: addDays(nowISO(), 5), value: 3400, handling: "None", tempC: null,
    service: "Door to door", status: "open", createdAt: nowISO(), bookingId: null },
  { id: RF.uid("shp"), shipper: "Hormuud Pharma", mode: "Air", from: "MGQ", to: "HGA",
    cargo: "Vaccines & cold-chain medicines", packaging: "Boxed / cartons", weightKg: 220, volumeM3: 1.6,
    ready: addDays(nowISO(), 2), deliverBy: addDays(nowISO(), 4), value: 18000, handling: "Refrigerated / cold chain",
    tempC: 4, service: "Airport / port to door", status: "open", createdAt: nowISO(), bookingId: null },
  { id: RF.uid("shp"), shipper: "Golings Oil Co.", mode: "Sea", from: "Mogadishu Port", to: "Bosaso Port",
    cargo: "1,200 jerricans of cooking oil (20 L)", packaging: "Palletised", weightKg: 24000, volumeM3: 30,
    ready: addDays(nowISO(), 3), deliverBy: addDays(nowISO(), 12), value: 27000, handling: "None", tempC: null,
    service: "Port / airport to port / airport", status: "open", createdAt: nowISO(), bookingId: null }
];

function ensureSeed() {
  var d = db();
  if (d.logiSeededAt) return;
  d.logiCapacity = SEED_CAP;
  d.logiShipments = SEED_SHIP;
  d.logiSeededAt = nowISO();
  S.save();
}

/* -------------------------------------------------- export */
RF.logi = {
  MODES: MODES, CARRIERS: CARRIERS, SERVICES: SERVICES, RATE_BASES: RATE_BASES,
  LANES: LANES, laneById: laneById, laneLabel: laneLabel, airName: airName,
  SHIP_FIELDS: SHIP_FIELDS, CAP_FIELDS: CAP_FIELDS,
  ensureSeed: ensureSeed,
  reseed: function () { var d = db(); delete d.logiSeededAt; d.logiCapacity = []; d.logiShipments = []; S.save(); ensureSeed(); },
  lanesForMode: function (m) { return LANES.filter(function (l) { return l.mode === m; }); },
  capacity: capacity,
  postCapacity: postCapacity,
  shipments: shipments,
  createShipment: createShipment,
  match: matchLoad,
  quote: quote,
  chargeable: chargeable,
  book: book,
  bookings: bookings,
  advanceBooking: advanceBooking,
  money: fMoney
};

})();
