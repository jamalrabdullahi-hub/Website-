/* ==========================================================================
   Garsoore — operations engine  (window.RF)
   Vanilla ES5-ish, no build step. Ported from the "Market Cypher" prototype:
     · staged posting wizard   (was engine/classifier.ts + types.ts)
     · free-text proposal parser (was engine/parser.ts)
     · deal lifecycle state machine (was lib/marketTypes.ts + orders API)
     · verification checklist / publish gate (was Verification interface)
     · deterministic Garsoore Score (was engine/resolver.ts scoring idea)
     · localStorage-backed store + identity (was lib/store.ts + useIdentity.ts)
   ========================================================================== */
(function () {
"use strict";
var RF = (window.RF = window.RF || {});

/* ======================================================================
   1. SCHEMA — board field definitions, lifecycles, verification rules
   ====================================================================== */

// Condition ops mirror the TS engine: eq | neq | in | notIn | exists
function conditionHolds(cond, values) {
  var v = values[cond.field];
  switch (cond.op) {
    case "exists": return v !== undefined && v !== "" && v !== null;
    case "eq":     return v === cond.value;
    case "neq":    return v !== cond.value;
    case "in":     return Array.isArray(cond.value) && cond.value.indexOf(v) >= 0;
    case "notIn":  return Array.isArray(cond.value) && cond.value.indexOf(v) < 0;
    default:       return true;
  }
}
RF.conditionHolds = conditionHolds;

var CITIES = ["Remote", "Mogadishu", "Hargeisa", "Bosaso", "Kismayo", "Berbera", "Baidoa", "Garowe", "Beledweyne"];
RF.CITIES = CITIES;

var LABEL = { tenders: "Contract", jobs: "Job", services: "Service", classifieds: "Marketplace", exchange: "Exchange", b2b: "B2B order", logi: "Freight" };
var PAGE = {
  tenders:     { slug: "contracts.html",  name: "Contracts",   noun: "notice" },
  jobs:        { slug: "jobs.html",        name: "Jobs",        noun: "role" },
  services:    { slug: "services.html",    name: "Services",    noun: "service" },
  classifieds: { slug: "marketplace.html", name: "Marketplace", noun: "listing" }
};
RF.LABEL = LABEL;
RF.PAGE = PAGE;

var HERO = {
  tenders: { eyebrow: "Contracts & Tenders", title: "Tenders you can actually find.",
    sub: "Federal, member-state and NGO notices from across Somalia in one place — in plain language, with the reference, bid bond, site-visit rule and real closing date on the notice itself." },
  jobs: { eyebrow: "Jobs", title: "Real jobs. Salary shown.",
    sub: "Verified employers — telecoms, banks, ports, NGOs — every listing dated and delisted when filled. No wasta-only postings, and no job without a pay range." },
  services: { eyebrow: "Local Services", title: "Vetted fundis, fixed prices.",
    sub: "Solar, boreholes, generators, construction — licence and references checked, price agreed up front, payment released on mobile money when the job is done." },
  classifieds: { eyebrow: "Marketplace", title: "Buy and sell with escrow.",
    sub: "ID-checked sellers, livestock movement permits and vehicle records checked at listing, and mobile-money escrow on anything over $500 — safe for diaspora buyers too." }
};
RF.HERO = HERO;

// Shared header fields every board asks for first.
var COMMON_FIELDS = [
  { id: "title",    label: "Title",              type: "text",     required: true,  placeholder: "One line — what is it?" },
  { id: "org",      label: "Organisation / name", type: "text",    required: true,  placeholder: "Who is posting?" },
  { id: "loc",      label: "Location",           type: "enum",     required: true,  options: CITIES },
  { id: "desc",     label: "Details",            type: "textarea", required: false, placeholder: "Scope, terms, condition…" }
];

var SCHEMA = {
  tenders: {
    subs: ["Government", "Construction", "Humanitarian / NGO", "IT", "Supply", "Consulting"],
    fields: [
      { id: "sub",             label: "Category",          type: "enum", required: true, options: ["Government", "Construction", "Humanitarian / NGO", "IT", "Supply", "Consulting"] },
      { id: "procurementType", label: "Procurement type",  type: "enum", required: true, options: ["Open tender", "Selective — invited", "RFP — two envelope", "NGO RFQ", "Framework agreement", "Direct award"] },
      { id: "estValue",        label: "Estimated value",   type: "money", required: true, help: "The engineer's estimate or ceiling budget, in USD. Shown to bidders." },
      { id: "closingDate",     label: "Closing date",      type: "date", required: true },
      { id: "contractLength",  label: "Contract length",   type: "text", placeholder: "e.g. 14 months" },
      { id: "paymentTerms",    label: "Payment terms",     type: "enum", options: ["Milestone, net 30", "Deliverable-based", "On delivery", "Monthly", "Net 30", "Net 60", "Letter of credit"] },
      { id: "bidBond",         label: "Bid bond",          type: "enum", options: ["None", "1%", "2%", "5%"] },
      { id: "prequal",         label: "Prequalification",  type: "enum", options: ["Not required", "SQ / questionnaire required", "Grade 1 contractors only", "Registered NGO vendor list", "Invited list only"] },
      { id: "siteVisit",       label: "Mandatory site visit", type: "bool" },
      { id: "refNumber",       label: "Reference number",  type: "text", placeholder: "e.g. BRA-RFP-118" }
    ],
    // main-line deal states + the actor who advances into each
    lifecycle: {
      order: ["NOTICE_OPEN", "INTENT_REGISTERED", "CLARIFICATIONS", "BID_SUBMITTED", "UNDER_EVALUATION", "AWARDED", "CONTRACT_SIGNED"],
      actor: { INTENT_REGISTERED: "bidder", CLARIFICATIONS: "bidder", BID_SUBMITTED: "bidder", UNDER_EVALUATION: "owner", AWARDED: "owner", CONTRACT_SIGNED: "both" },
      branches: { UNDER_EVALUATION: [{ to: "UNSUCCESSFUL", actor: "owner", label: "Decline bid" }] },
      terminal: ["CONTRACT_SIGNED", "UNSUCCESSFUL"],
      actionLabel: "Register interest", counterparty: "bidder"
    },
    verify: [
      { id: "identity", label: "Identity of the buying authority / NGO confirmed" },
      { id: "mandate",  label: "Procurement mandate / budget line / donor funding evidenced" },
      { id: "history",  label: "Past awards & payment record published on profile" }
    ]
  },

  jobs: {
    subs: ["Telecoms", "Finance & banking", "Construction", "Health", "Education", "Operations & logistics"],
    fields: [
      { id: "sub",            label: "Function",        type: "enum", required: true, options: ["Telecoms", "Finance & banking", "Construction", "Health", "Education", "Operations & logistics"] },
      { id: "employment",     label: "Employment type", type: "enum", required: true, options: ["Full-time, permanent", "Fixed-term", "Contract", "Part-time"] },
      { id: "salaryMin",      label: "Salary — minimum", type: "money", required: true, help: "In USD. Garsoore will not publish a job without a pay range." },
      { id: "salaryMax",      label: "Salary — maximum", type: "money", required: true },
      { id: "salaryBasis",    label: "Pay basis",       type: "enum", required: true, options: ["per month", "per year", "per day", "per hour"] },
      { id: "remote",         label: "Work location",   type: "enum", options: ["On-site", "Hybrid", "Remote"] },
      { id: "interviewStages",label: "Interview stages", type: "number", help: "How many rounds before an offer. Shown to candidates." },
      { id: "unpaidTask",     label: "Includes an unpaid trial task", type: "bool", help: "Disclosed on the listing. Roles without one rank higher." },
      { id: "visa",           label: "Eligibility",     type: "enum", options: ["Somali nationals only", "Somali or diaspora", "Diaspora / relocation supported", "Open to non-nationals"] }
    ],
    lifecycle: {
      order: ["OPEN", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"],
      actor: { APPLIED: "applicant", SCREENING: "employer", INTERVIEW: "employer", OFFER: "employer", HIRED: "both" },
      branches: {
        SCREENING: [{ to: "REJECTED", actor: "employer", label: "Not progressing" }],
        INTERVIEW: [{ to: "REJECTED", actor: "employer", label: "Not progressing" }],
        OFFER:     [{ to: "REJECTED", actor: "employer", label: "Offer withdrawn" }, { to: "DECLINED", actor: "applicant", label: "Decline offer" }]
      },
      terminal: ["HIRED", "REJECTED", "DECLINED"],
      // filling the role closes the listing
      onTerminal: { HIRED: "close" },
      actionLabel: "Apply", counterparty: "applicant"
    },
    verify: [
      { id: "identity",   label: "Employer identity confirmed" },
      { id: "registered", label: "Company registration checked" },
      { id: "pay",        label: "Salary range disclosed", auto: function (l) { return l.fields.salaryMin != null && l.fields.salaryMax != null; } }
    ]
  },

  services: {
    subs: ["Solar & power", "Water & boreholes", "Generator & electrical", "Construction & fundi", "Auto & bajaj", "Home & cleaning"],
    fields: [
      { id: "sub",           label: "Trade",           type: "enum", required: true, options: ["Solar & power", "Water & boreholes", "Generator & electrical", "Construction & fundi", "Auto & bajaj", "Home & cleaning"] },
      { id: "licenceNumber", label: "Licence / registration number", type: "text", required: true, help: "Checked with the Chamber of Commerce or district trade office before the listing goes live." },
      { id: "licenceBody",   label: "Issuing body",    type: "text", placeholder: "e.g. Chamber of Commerce, district trade office", dependsOn: [{ field: "licenceNumber", op: "exists" }] },
      { id: "insured",       label: "Carry liability cover / guarantee", type: "bool", required: true },
      { id: "insuranceCover",label: "Cover amount",    type: "money", dependsOn: [{ field: "insured", op: "eq", value: true }] },
      { id: "rate",          label: "Published rate",  type: "money", required: true, help: "Garsoore services quote a rate up front — no 'call for a price'." },
      { id: "rateBasis",     label: "Rate basis",      type: "enum", required: true, options: ["per hour", "per visit", "per job", "per day", "per metre"] },
      { id: "serviceArea",   label: "Service area",    type: "text", required: true, placeholder: "e.g. Hodan & Waberi districts" },
      { id: "responseTime",  label: "Typical response", type: "enum", options: ["Within 1 hour", "Same day", "Within 24 hours", "2–3 days"] }
    ],
    lifecycle: {
      order: ["REQUESTED", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "RELEASED"],
      actor: { ACCEPTED: "provider", SCHEDULED: "provider", IN_PROGRESS: "provider", COMPLETED: "both", RELEASED: "client" },
      branches: { REQUESTED: [{ to: "DECLINED", actor: "provider", label: "Can't take this on" }] },
      terminal: ["RELEASED", "DECLINED"],
      actionLabel: "Book direct", counterparty: "client",
      escrow: true
    },
    verify: [
      { id: "identity", label: "Provider identity confirmed" },
      { id: "licence",  label: "Licence verified with Chamber / district office", auto: function (l) { return !!l.fields.licenceNumber; } },
      { id: "insurance",label: "Cover / completion guarantee on file",            auto: function (l) { return l.fields.insured === true; } }
    ]
  },

  classifieds: {
    subs: ["Vehicles", "Livestock", "Solar & generators", "Land & property", "Electronics", "Farm & irrigation"],
    fields: [
      { id: "sub",           label: "Category",   type: "enum", required: true, options: ["Vehicles", "Livestock", "Solar & generators", "Land & property", "Electronics", "Farm & irrigation"] },
      { id: "sellerType",    label: "Seller type", type: "enum", required: true, options: ["Private seller", "Business / trade"] },
      { id: "price",         label: "Asking price", type: "money", required: true },
      { id: "negotiable",    label: "Price negotiable", type: "bool" },
      { id: "condition",     label: "Condition",  type: "enum", required: true, options: ["New", "Used — excellent", "Used — good", "Used — fair", "For parts / not working"],
        dependsOn: [{ field: "sub", op: "notIn", value: ["Land & property"] }] },
      { id: "registryCheck", label: "Records check", type: "enum", options: ["Passed", "Pending", "Not applicable"],
        dependsOn: [{ field: "sub", op: "in", value: ["Vehicles", "Electronics", "Livestock"] }] },
      { id: "collectionOnly",label: "Collection only", type: "bool" }
    ],
    lifecycle: {
      order: ["ENQUIRY", "RESERVED", "PAYMENT_HELD", "INSPECTION", "RELEASED", "COMPLETED"],
      actor: { RESERVED: "seller", PAYMENT_HELD: "buyer", INSPECTION: "buyer", RELEASED: "buyer", COMPLETED: "both" },
      branches: {
        RESERVED:   [{ to: "CANCELLED", actor: "both", label: "Cancel" }],
        INSPECTION: [{ to: "REFUNDED", actor: "both", label: "Fails inspection — refund" }]
      },
      terminal: ["COMPLETED", "CANCELLED", "REFUNDED"],
      onTerminal: { COMPLETED: "close", RELEASED: "close" },
      actionLabel: "Contact seller", counterparty: "buyer",
      escrow: true
    },
    verify: [
      { id: "identity",  label: "Seller ID verified" },
      { id: "ownership", label: "Ownership / title documents cross-checked" },
      { id: "registry",  label: "Vehicle record / livestock movement permit checked",
        appliesWhen: function (l) { return ["Vehicles", "Electronics", "Livestock"].indexOf(l.fields.sub) >= 0; } }
    ]
  },

  // The commodity exchange. Listings/wizard don't touch this board — its
  // mechanism lives in assets/market.js — but the settlement of every matched
  // trade is a deal on this lifecycle, so it flows through "My activity".
  exchange: {
    subs: [], fields: [], verify: [],
    lifecycle: {
      order: ["MATCHED", "GRADE_SUBMITTED", "GRADE_VERIFIED", "IN_TRANSIT", "DELIVERED", "SETTLED"],
      actor: { GRADE_SUBMITTED: "seller", GRADE_VERIFIED: "both", IN_TRANSIT: "seller", DELIVERED: "buyer", SETTLED: "buyer" },
      branches: {
        GRADE_SUBMITTED: [{ to: "GRADE_REJECTED", actor: "buyer", label: "Reject on grade" }],
        GRADE_VERIFIED:  [{ to: "GRADE_REJECTED", actor: "buyer", label: "Reject on grade" }],
        DELIVERED:       [{ to: "GRADE_REJECTED", actor: "buyer", label: "Reject — off spec on arrival" }]
      },
      terminal: ["SETTLED", "GRADE_REJECTED"],
      actionLabel: "Trade", counterparty: "buyer", escrow: true
    }
  },

  // B2B purchase orders. The catalog / RFQ / quote flow lives in assets/b2b.js;
  // every confirmed order is a deal on this lifecycle so it shows in "My activity".
  // Warehouse-backed orders issue a receipt at READY — the bridge to the exchange.
  b2b: {
    subs: [], fields: [], verify: [],
    lifecycle: {
      order: ["PLACED", "ACCEPTED", "PROCESSING", "READY", "SHIPPED", "RECEIVED", "SETTLED"],
      actor: { ACCEPTED: "supplier", PROCESSING: "supplier", READY: "supplier", SHIPPED: "supplier", RECEIVED: "buyer", SETTLED: "buyer" },
      branches: {
        PLACED:   [{ to: "CANCELLED", actor: "both", label: "Cancel order" }],
        ACCEPTED: [{ to: "CANCELLED", actor: "both", label: "Cancel order" }],
        RECEIVED: [{ to: "DISPUTED", actor: "buyer", label: "Raise dispute" }]
      },
      terminal: ["SETTLED", "CANCELLED", "DISPUTED"],
      actionLabel: "Order", counterparty: "buyer", escrow: true
    }
  },

  // Logistics bookings. The lane board + matching live in assets/logistics.js;
  // every booking is a deal on this lifecycle (carrier = owner, shipper = counterparty).
  logi: {
    subs: [], fields: [], verify: [],
    lifecycle: {
      order: ["BOOKED", "CONFIRMED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "DELIVERED", "POD", "SETTLED"],
      actor: { CONFIRMED: "carrier", PICKED_UP: "carrier", IN_TRANSIT: "carrier", ARRIVED: "carrier", DELIVERED: "carrier", POD: "shipper", SETTLED: "shipper" },
      branches: {
        BOOKED:     [{ to: "CANCELLED", actor: "both", label: "Cancel booking" }],
        CONFIRMED:  [{ to: "CANCELLED", actor: "both", label: "Cancel booking" }],
        IN_TRANSIT: [{ to: "EXCEPTION", actor: "carrier", label: "Flag exception (delay / damage / diversion)" }],
        ARRIVED:    [{ to: "EXCEPTION", actor: "carrier", label: "Flag exception" }]
      },
      terminal: ["SETTLED", "CANCELLED", "EXCEPTION"],
      actionLabel: "Book", counterparty: "shipper", escrow: true
    }
  }
};
RF.SCHEMA = SCHEMA;
RF.boardFields = function (board) { return COMMON_FIELDS.concat(SCHEMA[board].fields); };

// Ordered list of fields whose dependsOn is satisfied given current values.
RF.relevantFieldsFrom = function (fields, values) {
  return fields.filter(function (f) {
    return !f.dependsOn || f.dependsOn.every(function (c) { return conditionHolds(c, values); });
  });
};
RF.relevantFields = function (board, values) {
  return RF.relevantFieldsFrom(RF.boardFields(board), values);
};

/* Escrow rule: money changing hands above the threshold is protected. */
RF.ESCROW_THRESHOLD = 500;
RF.escrowApplies = function (board, fields) {
  var lc = SCHEMA[board].lifecycle;
  if (!lc.escrow) return board === "tenders";
  var amt = fields.price || fields.rate || 0;
  return board === "services" ? true : amt >= RF.ESCROW_THRESHOLD;
};

/* ======================================================================
   2. STORE — localStorage persistence + identity (stand-in for a DB + auth)
   ====================================================================== */

var LKEY = "Garsoore.v1";
function readDB() {
  try { return JSON.parse(localStorage.getItem(LKEY)) || {}; }
  catch (e) { return {}; }
}
function writeDB(db) {
  try { localStorage.setItem(LKEY, JSON.stringify(db)); } catch (e) {}
}
function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 9); }
RF.uid = uid;

var store = {
  _db: null,
  load: function () {
    this._db = readDB();
    if (!this._db.listings) this._db.listings = [];
    if (!this._db.deals) this._db.deals = [];
    if (!this._db.orders) this._db.orders = [];
    if (!this._db.trades) this._db.trades = [];
    return this._db;
  },
  save: function () { writeDB(this._db); },
  seeded: function () { return !!this._db.seededAt; },
  seed: function (listings) {
    this._db.listings = listings;
    this._db.seededAt = new Date().toISOString();
    this.save();
  },
  reset: function () { localStorage.removeItem(LKEY); this.load(); },

  listings: function (board) {
    var all = this._db.listings.slice();
    return board ? all.filter(function (l) { return l.board === board; }) : all;
  },
  listing: function (id) { return this._db.listings.filter(function (l) { return l.id === id; })[0]; },
  addListing: function (l) { l.id = l.id || uid("lst"); this._db.listings.unshift(l); this.save(); return l; },
  updateListing: function (id, patch) {
    var l = this.listing(id); if (!l) return;
    for (var k in patch) l[k] = patch[k];
    l.updatedAt = new Date().toISOString();
    this.save(); return l;
  },

  // --- exchange: order book + tape ---
  orders: function (marketId) {
    var all = this._db.orders.slice();
    return marketId ? all.filter(function (o) { return o.marketId === marketId; }) : all;
  },
  order: function (id) { return this._db.orders.filter(function (o) { return o.id === id; })[0]; },
  addOrder: function (o) { o.id = o.id || uid("ord"); this._db.orders.push(o); this.save(); return o; },
  trades: function (marketId) {
    var all = this._db.trades.slice();
    return marketId ? all.filter(function (t) { return t.marketId === marketId; }) : all;
  },
  addTrade: function (t) { t.id = t.id || uid("trd"); this._db.trades.push(t); this.save(); return t; },
  marketSeeded: function () { return !!this._db.marketSeededAt; },
  markMarketSeeded: function () { this._db.marketSeededAt = new Date().toISOString(); this.save(); },

  deals: function (who) {
    var all = this._db.deals.slice();
    if (!who) return all;
    return all.filter(function (d) { return d.parties.owner === who || d.parties.counterparty === who; });
  },
  deal: function (id) { return this._db.deals.filter(function (d) { return d.id === id; })[0]; },
  addDeal: function (d) { d.id = d.id || uid("dl"); this._db.deals.unshift(d); this.save(); return d; },
  updateDeal: function (id, patch) {
    var d = this.deal(id); if (!d) return;
    for (var k in patch) d[k] = patch[k];
    d.updatedAt = new Date().toISOString();
    this.save(); return d;
  }
};
RF.store = store;

var identity = {
  get: function () { try { return localStorage.getItem("Garsoore.identity") || ""; } catch (e) { return ""; } },
  set: function (n) { try { localStorage.setItem("Garsoore.identity", n); } catch (e) {} },
  orAnon: function () { return this.get() || "You (guest)"; }
};
RF.identity = identity;

/* ======================================================================
   3. VERIFICATION — checklist + publish gate + completeness ratio
   ====================================================================== */

var verify = {
  required: function (listing) {
    var checks = SCHEMA[listing.board].verify;
    return checks.filter(function (c) { return !c.appliesWhen || c.appliesWhen(listing); });
  },
  // auto checks pass from listing content; the rest need a human reviewer (listing.reviewed[])
  status: function (listing) {
    var req = this.required(listing);
    var reviewed = listing.reviewed || [];
    var done = [], pending = [];
    req.forEach(function (c) {
      var ok = (c.auto && c.auto(listing)) || reviewed.indexOf(c.id) >= 0;
      (ok ? done : pending).push(c);
    });
    return { done: done, pending: pending, ratio: req.length ? done.length / req.length : 1 };
  },
  publishable: function (listing) { return this.status(listing).pending.length === 0; },
  // simulate a reviewer clearing every outstanding human check
  approve: function (listing) {
    listing.reviewed = this.required(listing).map(function (c) { return c.id; });
    listing.state = "active";
    return listing;
  }
};
RF.verify = verify;

/* ======================================================================
   4. Garsoore SCORE — deterministic 0–100 confidence rating
   ====================================================================== */

function daysSince(iso) { return (Date.now() - new Date(iso).getTime()) / 86400000; }

var score = {
  compute: function (listing) {
    var f = {};
    // verification completeness — 40
    f.verification = Math.round(40 * verify.status(listing).ratio);
    // freshness — 20, linear decay over 30 days
    var age = daysSince(listing.createdAt);
    f.freshness = Math.max(0, Math.round(20 * (1 - age / 30)));
    // transparency — 25
    var t = 0, fld = listing.fields;
    if (listing.board === "jobs" && fld.salaryMin != null && fld.salaryMax != null) t += 15;
    if (listing.board === "tenders" && fld.estValue != null) t += 12;
    if (listing.board === "services" && fld.rate != null) t += 12;
    if (listing.board === "classifieds" && fld.price != null) t += 10;
    if (listing.paymentProtected) t += 8;
    if (fld.closingDate || fld.responseTime) t += 5;
    if (listing.board === "jobs" && fld.unpaidTask === false) t += 5;
    f.transparency = Math.min(25, t);
    // responsiveness — 15, parsed from "responds NN%" hint or neutral
    var m = /responds\s+(\d+)%/i.exec(JSON.stringify(listing.meta || {}));
    f.responsiveness = m ? Math.round(15 * (+m[1] / 100)) : 8;
    var total = f.verification + f.freshness + f.transparency + f.responsiveness;
    return { score: Math.max(0, Math.min(100, total)), band: total >= 80 ? "A" : total >= 60 ? "B" : "C", factors: f };
  }
};
RF.score = score;

/* ======================================================================
   5. DEAL LIFECYCLE — per-board state machine
   ====================================================================== */

var lifecycle = {
  def: function (board) { return SCHEMA[board].lifecycle; },
  states: function (board) { return this.def(board).order.slice(); },
  startState: function (board) { return this.def(board).order[0]; },
  isTerminal: function (board, s) { return this.def(board).terminal.indexOf(s) >= 0; },

  // main-line next state, or null at the end
  nextState: function (board, s) {
    var o = this.def(board).order, i = o.indexOf(s);
    return i >= 0 && i < o.length - 1 ? o[i + 1] : null;
  },

  // every move available from `state` for `actor`: the main-line advance + branches
  transitions: function (board, state, actor) {
    var def = this.def(board), out = [];
    var nxt = this.nextState(board, state);
    if (nxt) out.push({ to: nxt, actor: def.actor[nxt] || "both", label: "Advance to " + prettyState(nxt), primary: true });
    (def.branches[state] || []).forEach(function (b) { out.push({ to: b.to, actor: b.actor, label: b.label }); });
    if (actor) out = out.filter(function (t) { return t.actor === "both" || t.actor === actor; });
    return out;
  },

  create: function (listing, counterpartyName, opts) {
    opts = opts || {};
    var board = listing.board, def = this.def(board), now = new Date().toISOString();
    var start = this.startState(board);
    var first = this.nextState(board, start); // creating a deal moves it off the "open" state
    var deal = {
      board: board,
      listingId: listing.id,
      title: listing.title,
      parties: { owner: listing.org, counterparty: counterpartyName },
      counterpartyRole: def.counterparty,
      state: first || start,
      escrow: RF.escrowApplies(board, listing.fields) ? "held" : "n/a",
      amount: opts.amount != null ? opts.amount : (listing.fields.price || listing.fields.rate || listing.fields.estValue || null),
      currency: opts.currency || "USD",
      note: opts.note || "",
      history: [
        { state: start, at: now, by: "system" },
        { state: first || start, at: now, by: counterpartyName }
      ],
      createdAt: now, updatedAt: now
    };
    return store.addDeal(deal);
  },

  advance: function (dealId, toState, actor) {
    var d = store.deal(dealId); if (!d) return { error: "deal not found" };
    var allowed = this.transitions(d.board, d.state, actor).map(function (t) { return t.to; });
    if (allowed.indexOf(toState) < 0) return { error: "transition " + d.state + " → " + toState + " not allowed for " + (actor || "?") };
    var now = new Date().toISOString();
    d.history.push({ state: toState, at: now, by: actor || "?" });
    var patch = { state: toState, history: d.history };

    // escrow follows the state
    var def = this.def(d.board);
    if (d.escrow !== "n/a") {
      if (toState === "RELEASED" || toState === "CONTRACT_SIGNED" || toState === "COMPLETED" || toState === "SETTLED") patch.escrow = "released";
      else if (toState === "REFUNDED" || toState === "GRADE_REJECTED" || toState === "CANCELLED" || toState === "DISPUTED") patch.escrow = "refunded";
    }
    store.updateDeal(dealId, patch);

    // terminal side-effects on the listing (e.g. a hired role closes)
    var effect = (def.onTerminal || {})[toState];
    if (effect === "close") store.updateListing(d.listingId, { state: "closed" });
    return store.deal(dealId);
  }
};
RF.lifecycle = lifecycle;

function prettyState(s) { return s.replace(/_/g, " ").toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }); }
RF.prettyState = prettyState;

/* ======================================================================
   6. FREE-TEXT PARSER — paste a notice / JD / ad → structured proposal
   ====================================================================== */

var MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseMoney(s) {
  var m = /(?:\$|£|€|usd|gbp|eur)?\s?([\d][\d,]*(?:\.\d+)?)\s?(k|m|bn|million|billion)?/i.exec(s);
  if (!m) return null;
  var n = parseFloat(m[1].replace(/,/g, ""));
  var suf = (m[2] || "").toLowerCase();
  if (suf === "k") n *= 1e3;
  else if (suf === "m" || suf === "million") n *= 1e6;
  else if (suf === "bn" || suf === "billion") n *= 1e9;
  return Math.round(n);
}

function parseDate(text) {
  var m = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})?/i.exec(text);
  if (m) {
    var y = m[3] ? +m[3] : new Date().getFullYear();
    var mo = MONTHS[m[2].toLowerCase()] + 1;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(+m[1]).padStart(2, "0");
  }
  var iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? iso[0] : null;
}

var parser = {
  parse: function (board, raw) {
    var text = (raw || "").trim();
    var low = text.toLowerCase();
    var fields = {}, notes = [];
    var schemaFields = RF.boardFields(board);
    var need = schemaFields.filter(function (f) { return f.required; }).length;

    // title = first non-empty line, trimmed
    var firstLine = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || "";
    if (firstLine) fields.title = firstLine.slice(0, 90);

    // location
    for (var i = 0; i < CITIES.length; i++) {
      if (low.indexOf(CITIES[i].toLowerCase()) >= 0) { fields.loc = CITIES[i]; break; }
    }
    if (/\bremote\b/.test(low) && !fields.loc) fields.loc = "Remote";

    // category — keyword match against this board's category options
    var cats = SCHEMA[board].subs;
    for (var c = 0; c < cats.length; c++) {
      if (low.indexOf(cats[c].toLowerCase()) >= 0) { fields.sub = cats[c]; break; }
    }

    if (board === "tenders") {
      var ref = /\b(?:ref|reference|tender|rfp|solicitation|notice)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,})/i.exec(text);
      if (ref) fields.refNumber = ref[1].toUpperCase();
      var close = /(?:clos(?:e|es|ing)|deadline|submission by|due)\D{0,20}(\d{1,2}\s+\w+\s*\d{0,4}|\d{4}-\d{2}-\d{2})/i.exec(text);
      if (close) { var d = parseDate(close[1]); if (d) fields.closingDate = d; }
      var val = /(?:value|budget|estimate|worth|ceiling)\D{0,15}((?:\$|£|€)?\s?[\d][\d,\.]*\s?(?:k|m|million|billion)?)/i.exec(text);
      if (val) fields.estValue = parseMoney(val[1]);
      if (/two[- ]envelope/.test(low)) fields.procurementType = "RFP — two envelope";
      else if (/framework/.test(low)) fields.procurementType = "Framework agreement";
      else if (/\bopen tender\b/.test(low)) fields.procurementType = "Open tender";
      else if (/invited|selective|prequalif/.test(low)) fields.procurementType = "Selective — invited";
      var bond = /bid bond\D{0,6}(\d)\s?%/i.exec(text); if (bond) fields.bidBond = bond[1] + "%";
      if (/site visit/.test(low)) fields.siteVisit = /mandatory|required|compulsory/.test(low);
    }

    if (board === "jobs") {
      var range = /(?:\$|£|€)?\s?([\d][\d,\.]*\s?k?)\s?(?:–|-|to)\s?(?:\$|£|€)?\s?([\d][\d,\.]*\s?k?)/i.exec(text);
      if (range) { fields.salaryMin = parseMoney(range[1]); fields.salaryMax = parseMoney(range[2]); }
      else {
        var one = /(?:salary|pay|comp|rate)\D{0,12}((?:\$|£|€)?\s?[\d][\d,\.]*\s?k?)/i.exec(text);
        if (one) { fields.salaryMin = parseMoney(one[1]); }
      }
      if (/per day|\/day|day rate|per diem/.test(low)) fields.salaryBasis = "per day";
      else if (/per hour|\/hr|hourly|per hr/.test(low)) fields.salaryBasis = "per hour";
      else if (/per month|monthly|\/mo\b/.test(low)) fields.salaryBasis = "per month";
      else if (fields.salaryMin) fields.salaryBasis = "per year";
      if (/\bcontract\b|fixed[- ]term/.test(low)) fields.employment = "Contract";
      else if (/part[- ]time/.test(low)) fields.employment = "Part-time";
      else if (/permanent|full[- ]time/.test(low)) fields.employment = "Full-time, permanent";
      if (/\bhybrid\b/.test(low)) fields.remote = "Hybrid";
      else if (/\bremote\b/.test(low)) fields.remote = "Remote";
      else if (/on[- ]site|onsite|in office/.test(low)) fields.remote = "On-site";
      var stages = /(\d+)[- ]stage|(\d+)\s+round/i.exec(text);
      if (stages) fields.interviewStages = +(stages[1] || stages[2]);
      if (/take[- ]home|unpaid (?:task|exercise|assignment)/.test(low)) fields.unpaidTask = true;
      if (/no take[- ]home|no unpaid/.test(low)) fields.unpaidTask = false;
      if (/sponsor(ship)?\b/.test(low) && !/no sponsor|not sponsor/.test(low)) fields.visa = "Sponsored";
      else if (/no sponsor|not sponsor/.test(low)) fields.visa = "Not sponsored";
    }

    if (board === "services") {
      var lic = /\b(?:licen[cs]e|lic|registration|reg|cert)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z]{1,5}-?[A-Z0-9-]{3,})/i.exec(text);
      if (lic) fields.licenceNumber = lic[1].toUpperCase();
      var rate = /((?:\$|£|€)\s?[\d][\d,\.]*)\s?(?:\/|per)\s?(hour|hr|visit|job|day)/i.exec(text);
      if (rate) { fields.rate = parseMoney(rate[1]); fields.rateBasis = "per " + (rate[2].toLowerCase() === "hr" ? "hour" : rate[2].toLowerCase()); }
      if (/insured|insurance|liability cover/.test(low)) fields.insured = true;
      var cover = /(?:insur\w+|cover|liability)\D{0,10}((?:\$|£|€)?\s?[\d][\d,\.]*\s?(?:k|m|million)?)/i.exec(text);
      if (cover && fields.insured) fields.insuranceCover = parseMoney(cover[1]);
      if (/1[- ]hour|within an hour|one hour/.test(low)) fields.responseTime = "Within 1 hour";
      else if (/same[- ]day/.test(low)) fields.responseTime = "Same day";
      else if (/24[- ]?h|next day|within a day/.test(low)) fields.responseTime = "Within 24 hours";
    }

    if (board === "classifieds") {
      var price = /(?:price|asking|for sale|selling)\D{0,10}((?:\$|£|€)?\s?[\d][\d,\.]*\s?(?:k|m)?)/i.exec(text)
              || /((?:\$|£|€)\s?[\d][\d,\.]{2,})/.exec(text);
      if (price) fields.price = parseMoney(price[1]);
      if (/brand new|\bnew\b(?! )/.test(low)) fields.condition = "New";
      else if (/for parts|not working|spares/.test(low)) fields.condition = "For parts / not working";
      else if (/mint|excellent|like new/.test(low)) fields.condition = "Used — excellent";
      else if (/\bfair\b|well used|worn/.test(low)) fields.condition = "Used — fair";
      else if (/\bused\b|second[- ]hand/.test(low)) fields.condition = "Used — good";
      if (/collection only|pickup only|no delivery|buyer collects/.test(low)) fields.collectionOnly = true;
      if (/negotiable|\bono\b|or near/.test(low)) fields.negotiable = true;
      if (/dealer|trade seller|business seller/.test(low)) fields.sellerType = "Business / trade";
      else fields.sellerType = "Private seller";
    }

    // confidence = fraction of required fields the parser could fill
    var got = schemaFields.filter(function (f) { return f.required && fields[f.id] != null; }).length;
    var confidence = need ? got / need : 0;
    notes.push("Filled " + Object.keys(fields).length + " field(s); " + got + "/" + need + " required.");
    if (confidence < 0.5) notes.push("Low confidence — review every field before submitting.");
    if (!fields.desc && text.length > (firstLine.length + 10)) fields.desc = text;

    return { raw: text, board: board, fields: fields, confidence: confidence, notes: notes };
  }
};
RF.parser = parser;

/* ======================================================================
   7. POSTING WIZARD — staged flow with history / back / skip / prefill
   ====================================================================== */

function Wizard(board, customFields) {
  this.board = board || null;
  this.fields = customFields || null; // an explicit field list overrides the board's schema
  this.values = {};
  this.skipped = {};
  this.history = [];
  this.stage = (board || customFields) ? "fields" : "board";
  this.cursor = 0;
}
Wizard.prototype._rel = function (values) {
  return this.fields ? RF.relevantFieldsFrom(this.fields, values) : RF.relevantFields(this.board, values);
};
Wizard.prototype._snapshot = function () {
  this.history.push(JSON.stringify({ v: this.values, s: this.skipped, st: this.stage, c: this.cursor, b: this.board }));
};
Wizard.prototype.back = function () {
  if (!this.history.length) return false;
  var h = JSON.parse(this.history.pop());
  this.values = h.v; this.skipped = h.s; this.stage = h.st; this.cursor = h.c; this.board = h.b;
  return true;
};
Wizard.prototype.setBoard = function (board) {
  this._snapshot(); this.board = board; this.stage = "fields"; this.cursor = 0;
};
Wizard.prototype.queue = function () {
  // relevant, not-yet-answered, not-skipped — required first, then optional
  var vals = this.values, skipped = this.skipped;
  var rel = this._rel(vals).filter(function (f) {
    return vals[f.id] === undefined && !skipped[f.id];
  });
  return rel.sort(function (a, b) { return (b.required ? 1 : 0) - (a.required ? 1 : 0); });
};
Wizard.prototype.current = function () { return this.queue()[0] || null; };
Wizard.prototype.set = function (id, value) {
  this._snapshot();
  if (value === "" || value == null) delete this.values[id];
  else this.values[id] = value;
  // auto-derive escrow eligibility hint for marketplace
  if (this.board === "classifieds" && id === "price") {
    this.values.escrowEligible = value >= RF.ESCROW_THRESHOLD;
  }
  if (!this.current()) this.stage = "review";
};
Wizard.prototype.skip = function () {
  var f = this.current();
  if (!f || f.required) return false;
  this._snapshot();
  this.skipped[f.id] = true;
  if (!this.current()) this.stage = "review";
  return true;
};
Wizard.prototype.applyProposal = function (parsed) {
  this._snapshot();
  var rel = this._rel(parsed.fields);
  var ok = {};
  rel.forEach(function (f) { ok[f.id] = 1; });
  for (var k in parsed.fields) {
    if (ok[k] || k === "title" || k === "org" || k === "loc" || k === "desc") this.values[k] = parsed.fields[k];
  }
  this.stage = this.current() ? "fields" : "review";
};
Wizard.prototype.missingRequired = function () {
  var vals = this.values;
  return this._rel(vals).filter(function (f) {
    return f.required && (vals[f.id] === undefined || vals[f.id] === "");
  });
};
Wizard.prototype.canFinish = function () { return (this.board || this.fields) && this.missingRequired().length === 0; };
Wizard.prototype.progress = function () {
  var rel = this._rel(this.values);
  var self = this;
  var done = rel.filter(function (f) { return self.values[f.id] !== undefined; }).length;
  return { done: done, total: rel.length, pct: rel.length ? Math.round(100 * done / rel.length) : 0 };
};
Wizard.prototype.build = function () {
  var f = this.values, board = this.board, now = new Date().toISOString();
  var amountTxt = money(f.price) || rangeTxt(f.salaryMin, f.salaryMax, f.salaryBasis) || money(f.rate, f.rateBasis) || money(f.estValue) || "On request";
  var listing = {
    id: RF.uid("lst"),
    board: board,
    title: f.title || "Untitled",
    org: f.org || RF.identity.orAnon(),
    loc: f.loc || "Unspecified",
    sub: f.sub || SCHEMA[board].subs[0],
    desc: f.desc || "No details provided.",
    fields: f,
    amountTxt: amountTxt,
    amountKind: amountKind(board, f),
    due: f.closingDate ? formatDate(f.closingDate) : null,
    createdAt: now, updatedAt: now,
    state: "in_review",            // hidden until verification clears
    reviewed: [],
    paymentProtected: RF.escrowApplies(board, f),
    meta: {},
    facts: buildFacts(board, f)
  };
  listing.rs = RF.score.compute(listing);
  return listing;
};
RF.Wizard = Wizard;

/* ---- formatting helpers shared with the UI ---- */
function money(n, basis) {
  if (n == null || isNaN(n)) return null;
  var s = "$" + Number(n).toLocaleString();
  return basis ? s + " " + String(basis).replace("per ", "/ ") : s;
}
function rangeTxt(a, b, basis) {
  if (a == null && b == null) return null;
  var lo = a != null ? "$" + Number(a).toLocaleString() : "?";
  var hi = b != null ? "$" + Number(b).toLocaleString() : "?";
  var suff = basis ? " " + String(basis).replace("per ", "/ ") : "";
  return lo + "–" + hi + suff;
}
function amountKind(board, f) {
  if (board === "jobs") return f.employment || "Compensation";
  if (board === "tenders") return "Estimated value";
  if (board === "services") return "Published rate";
  return f.negotiable ? "Negotiable" : "Asking price";
}
var MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return m[3] + " " + MON3[+m[2] - 1] + " " + m[1];
  return iso;
}
RF.formatDate = formatDate;
RF.money = money;
RF.rangeTxt = rangeTxt;

function buildFacts(board, f) {
  var out = [];
  if (board === "tenders") {
    if (f.refNumber) out.push("Ref " + f.refNumber);
    if (f.bidBond && f.bidBond !== "None") out.push("Bid bond " + f.bidBond);
    if (f.siteVisit) out.push("Site visit required");
    if (f.prequal && f.prequal !== "Not required") out.push(f.prequal);
  } else if (board === "jobs") {
    if (f.salaryMin != null) out.push("Salary published");
    if (f.interviewStages) out.push(f.interviewStages + " interview stage" + (f.interviewStages > 1 ? "s" : ""));
    if (f.unpaidTask === false) out.push("No unpaid task");
    if (f.remote) out.push(f.remote);
  } else if (board === "services") {
    if (f.licenceNumber) out.push("Licence " + f.licenceNumber);
    if (f.insured) out.push("Insured" + (f.insuranceCover ? " " + money(f.insuranceCover) : ""));
    if (f.responseTime) out.push(f.responseTime);
  } else {
    if (f.sellerType) out.push(f.sellerType);
    if (f.condition) out.push(f.condition);
    if (f.registryCheck === "Passed") out.push("Registry check passed");
    if (f.collectionOnly) out.push("Collection only");
  }
  if (!out.length) out.push("Awaiting verification");
  return out;
}
RF.buildFacts = buildFacts;

})();
