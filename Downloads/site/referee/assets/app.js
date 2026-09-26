/* Garsoore — UI layer. Depends on assets/engine.js (window.RF).
   Each page sets window.BOARD ("tenders"|"jobs"|"services"|"classifieds"|"activity"|null). */
(function () {
"use strict";
var RF = window.RF, S = RF.store, LC = RF.lifecycle, V = RF.verify;
var LABEL = RF.LABEL, PAGE = RF.PAGE, HERO = RF.HERO, SCHEMA = RF.SCHEMA;

/* ---------------------------------------------------------------- seed data */
function D(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
var SEED = [
 { board:"tenders", sub:"Construction", title:"Rehabilitation of Berbera–Hargeisa road — Lot 3 (32 km)", org:"Somaliland Roads Development Agency", loc:"Berbera", age:2,
   desc:"Design-and-build resurfacing and drainage, Lot 3. Grade 1 contractors only. Mandatory site visit 14 Sep. Two-envelope submission, 2% bid bond.",
   amountTxt:"$4.2M", amountKind:"Engineer's estimate", due:"2026-10-05", open:1,
   fields:{ sub:"Construction", procurementType:"RFP — two envelope", estValue:4200000, closingDate:"2026-10-05", contractLength:"14 months", paymentTerms:"Milestone, net 30", bidBond:"2%", prequal:"Grade 1 contractors only", siteVisit:true, refNumber:"SLRDA-2026-014" },
   meta:{ profile:"Agency · 26 awards · pays in 34 days avg" } },
 { board:"tenders", sub:"Humanitarian / NGO", title:"Supply of 12,000 food baskets — Bay & Bakool", org:"World Food Programme — Somalia", loc:"Baidoa", age:5,
   desc:"Framework call-off for monthly food baskets (cereal, pulses, oil, salt). Registered WFP vendors only. Delivery to 4 field hubs.",
   amountTxt:"$1,800,000", amountKind:"Call-off ceiling", due:"2026-09-22", open:1,
   fields:{ sub:"Humanitarian / NGO", procurementType:"NGO RFQ", estValue:1800000, closingDate:"2026-09-22", contractLength:"12 months", paymentTerms:"Deliverable-based", bidBond:"None", prequal:"Registered NGO vendor list", siteVisit:false, refNumber:"WFP-SOM-RFP-3391" },
   meta:{ profile:"UN agency · donor-funded · pays 21 days" } },
 { board:"tenders", sub:"Government", title:"Supply & install classroom furniture — 60 schools", org:"Ministry of Education, Culture & Higher Education (FGS)", loc:"Mogadishu", age:1,
   desc:"Open tender for desks, chairs and blackboards across 60 schools in Banadir and Hirshabelle. Delivery in three phases before term start.",
   amountTxt:"$520,000", amountKind:"Estimated award", due:"2026-09-18", open:1,
   fields:{ sub:"Government", procurementType:"Open tender", estValue:520000, closingDate:"2026-09-18", contractLength:"6 months", paymentTerms:"On delivery", bidBond:"2%", prequal:"SQ / questionnaire required", siteVisit:false, refNumber:"MOECHE-T-2026-40" } },
 { board:"tenders", sub:"IT", title:"Revenue management system — Banadir Regional Administration", org:"Banadir Regional Administration", loc:"Mogadishu", age:6,
   desc:"RFP for a property-tax and business-licence billing platform, ~900 users. Two-envelope submission. Incumbent spreadsheets to be migrated.",
   amountTxt:"$340,000", amountKind:"Ceiling budget", due:"2026-10-08", open:1,
   fields:{ sub:"IT", procurementType:"RFP — two envelope", estValue:340000, closingDate:"2026-10-08", contractLength:"18 months", paymentTerms:"Deliverable-based", bidBond:"None", prequal:"Not required", siteVisit:false, refNumber:"BRA-RFP-118" } },
 { board:"tenders", sub:"Supply", title:"Framework: medical consumables for 7 hospitals (2026–2028)", org:"Ministry of Health (FGS)", loc:"Mogadishu", age:11,
   desc:"Multi-lot framework across seven regional hospitals. Lots may be bid individually. Cold-chain items in a separate lot.",
   amountTxt:"Framework", amountKind:"Call-off, no ceiling", due:"2026-09-25", open:1,
   fields:{ sub:"Supply", procurementType:"Framework agreement", closingDate:"2026-09-25", contractLength:"24 months", paymentTerms:"Letter of credit", bidBond:"None", prequal:"SQ / questionnaire required", siteVisit:false, refNumber:"MOH-FW-2026-07" } },

 { board:"jobs", sub:"Telecoms", title:"Senior Network Engineer — Core", org:"Hormuud Telecom", loc:"Mogadishu", age:1,
   desc:"Own the packet core and interconnect for a 4G/LTE rollout. IP/MPLS, BGP, mobile-money traffic engineering. Three-stage interview, documented up front.",
   amountTxt:"$1,800–2,600 / mo", amountKind:"Plus medical & transport", open:1,
   fields:{ sub:"Telecoms", employment:"Full-time, permanent", salaryMin:1800, salaryMax:2600, salaryBasis:"per month", remote:"On-site", interviewStages:3, unpaidTask:false, visa:"Somali or diaspora" },
   meta:{ profile:"Hiring manager verified · responds 92%" } },
 { board:"jobs", sub:"Construction", title:"Site Foreman — port expansion", org:"Red Sea Contracting", loc:"Berbera", age:4,
   desc:"14-month berth and yard works at Berbera port. Requires heavy-civils experience and a current site-safety certificate. Accommodation provided on site.",
   amountTxt:"$900 / mo", amountKind:"Plus housing & rotation", open:1,
   fields:{ sub:"Construction", employment:"Fixed-term", salaryMin:900, salaryMax:900, salaryBasis:"per month", remote:"On-site", interviewStages:2, unpaidTask:false, visa:"Somali or diaspora" },
   meta:{ profile:"Hiring manager verified · responds 84%" } },
 { board:"jobs", sub:"Finance & banking", title:"Branch Manager", org:"Premier Bank", loc:"Hargeisa", age:8,
   desc:"Run the Hargeisa main branch — deposits growth, SME lending, compliance. Retail banking background and team leadership required.",
   amountTxt:"$1,200–1,700 / mo", amountKind:"Plus performance bonus", open:1,
   fields:{ sub:"Finance & banking", employment:"Full-time, permanent", salaryMin:1200, salaryMax:1700, salaryBasis:"per month", remote:"On-site", interviewStages:3, unpaidTask:false, visa:"Somali nationals only" },
   meta:{ profile:"Hiring manager verified · responds 88%" } },
 { board:"jobs", sub:"Health", title:"Registered Nurse — MCH", org:"Save the Children", loc:"Baidoa", age:14,
   desc:"Maternal & child health unit at a stabilisation centre. 12-month contract with hardship and relocation allowance. Somali registration required.",
   amountTxt:"$700–950 / mo", amountKind:"Plus hardship allowance", open:0,
   fields:{ sub:"Health", employment:"Fixed-term", salaryMin:700, salaryMax:950, salaryBasis:"per month", remote:"On-site", interviewStages:2, unpaidTask:false, visa:"Diaspora / relocation supported" },
   meta:{ profile:"Hiring manager verified · responds 76%" } },
 { board:"jobs", sub:"Operations & logistics", title:"Warehouse & Logistics Lead", org:"Dahabshiil Group", loc:"Mogadishu", age:3,
   desc:"Own inbound and last-mile flow for the central warehouse — 35 staff, fleet of 14. Stock accuracy, dispatch planning, a new WMS going live.",
   amountTxt:"$850 / mo", amountKind:"Plus bonus", open:1,
   fields:{ sub:"Operations & logistics", employment:"Full-time, permanent", salaryMin:850, salaryMax:850, salaryBasis:"per month", remote:"On-site", interviewStages:3, unpaidTask:false, visa:"Somali nationals only" },
   meta:{ profile:"Hiring manager verified · responds 81%" } },

 { board:"services", sub:"Solar & power", title:"Solar install & maintenance — homes & shops", org:"Qorax Solar", loc:"Mogadishu", age:3,
   desc:"Panels, inverters, lithium and lead-acid banks. Load assessment and fixed quote before work starts. Warranty on installation labour.",
   amountTxt:"From $120 / site", amountKind:"Survey included", open:1,
   fields:{ sub:"Solar & power", licenceNumber:"MOG-TL-4471", licenceBody:"Banadir district trade office", insured:true, insuranceCover:15000, rate:120, rateBasis:"per job", serviceArea:"Hodan, Waberi & Wardhiigley", responseTime:"Same day" },
   meta:{ profile:"4.8 · 190 jobs" } },
 { board:"services", sub:"Water & boreholes", title:"Borehole drilling & pump install", org:"Biyo Nadiif Drilling", loc:"Baidoa", age:6,
   desc:"Percussion and rotary rig, 60–180 m. Submersible pump and solar-pump packages. Yield test and water-quality sample on completion.",
   amountTxt:"From $65 / metre", amountKind:"Pump quoted separately", open:1,
   fields:{ sub:"Water & boreholes", licenceNumber:"SWALIM-REG-882", licenceBody:"Regional water authority", insured:true, insuranceCover:25000, rate:65, rateBasis:"per metre", serviceArea:"Bay & Bakool", responseTime:"2–3 days" },
   meta:{ profile:"4.9 · 71 boreholes" } },
 { board:"services", sub:"Generator & electrical", title:"Generator service & rewinding — 5–250 kVA", org:"Danab Power", loc:"Hargeisa", age:9,
   desc:"Scheduled servicing, AVR and alternator rewinding, ATS wiring. Loan generator available during major repairs.",
   amountTxt:"$45 / hr", amountKind:"Parts at cost + 10%", open:1,
   fields:{ sub:"Generator & electrical", licenceNumber:"HRG-CC-2290", licenceBody:"Hargeisa Chamber of Commerce", insured:true, insuranceCover:30000, rate:45, rateBasis:"per hour", serviceArea:"Hargeisa & Berbera", responseTime:"Within 24 hours" },
   meta:{ profile:"4.9 · 260 jobs" } },
 { board:"services", sub:"Construction & fundi", title:"Mason & finishing crew", org:"Barwaaqo Builders", loc:"Mogadishu", age:5,
   desc:"Blockwork, plaster, tiling and screed. Day-rate per mason with a chargehand supervising. References from three completed villas.",
   amountTxt:"$28 / day per mason", amountKind:"Chargehand included", open:1,
   fields:{ sub:"Construction & fundi", licenceNumber:"MOG-TL-6612", licenceBody:"Banadir district trade office", insured:true, insuranceCover:8000, rate:28, rateBasis:"per day", serviceArea:"Banadir", responseTime:"2–3 days" },
   meta:{ profile:"4.7 · 44 projects" } },
 { board:"services", sub:"Auto & bajaj", title:"Bajaj & Noah mechanic — mobile", org:"Xamar Auto", loc:"Mogadishu", age:12,
   desc:"Roadside and workshop repair for bajaj, Noah and Vitz. Diagnostics, brakes, suspension, CV joints. Fixed price quoted before work.",
   amountTxt:"$9 / hr", amountKind:"Callout $4 in Banadir", open:1,
   fields:{ sub:"Auto & bajaj", licenceNumber:"MOG-TL-7781", licenceBody:"Banadir district trade office", insured:false, rate:9, rateBasis:"per hour", serviceArea:"Banadir", responseTime:"Within 1 hour" },
   meta:{ profile:"4.8 · 320 jobs" } },

 { board:"classifieds", sub:"Livestock", title:"40 export-grade Blackhead sheep, health-certified", org:"Mahad Gaani Livestock", loc:"Berbera", age:2,
   desc:"2–3 yr, sound condition, vaccinated. Movement permit and health certificate issued. Quarantine-cleared, ready at the holding ground.",
   amountTxt:"$2,600", amountKind:"Lot of 40 · escrow", open:1,
   fields:{ sub:"Livestock", sellerType:"Business / trade", price:2600, negotiable:true, condition:"Used — good", registryCheck:"Passed", collectionOnly:true },
   meta:{ profile:"Business verified · 60+ lots" } },
 { board:"classifieds", sub:"Vehicles", title:"2016 Toyota Noah, 128,000 km", org:"Private seller · ID verified", loc:"Mogadishu", age:2,
   desc:"One owner in Somalia, petrol, clean interior. Import papers and local registration uploaded and cross-checked.",
   amountTxt:"$9,800", amountKind:"Negotiable · escrow", open:1,
   fields:{ sub:"Vehicles", sellerType:"Private seller", price:9800, negotiable:true, condition:"Used — good", registryCheck:"Passed", collectionOnly:false },
   meta:{ profile:"ID verified · 4 sales" } },
 { board:"classifieds", sub:"Solar & generators", title:"10 kVA diesel generator, 900 hrs", org:"Danab Power", loc:"Hargeisa", age:7,
   desc:"Perkins engine, sound-proof canopy, ATS included. Service log complete. Inspection welcome before funds release.",
   amountTxt:"$3,200", amountKind:"Escrow required", open:1,
   fields:{ sub:"Solar & generators", sellerType:"Business / trade", price:3200, negotiable:false, condition:"Used — good", collectionOnly:true },
   meta:{ profile:"Business verified · 38 sales" } },
 { board:"classifieds", sub:"Land & property", title:"600 m² residential plot, Taleex district", org:"Hodan Properties", loc:"Mogadishu", age:4,
   desc:"Cornered plot, walled, near tarmac road. Title deed and district letter cross-checked. Agent handles transfer at the district office.",
   amountTxt:"$28,000", amountKind:"Title verified", open:1,
   fields:{ sub:"Land & property", sellerType:"Business / trade", price:28000, negotiable:true, collectionOnly:false },
   meta:{ profile:"Licensed agent — verified" } },
 { board:"classifieds", sub:"Farm & irrigation", title:"Used diesel water pump + 200 m layflat pipe", org:"Private seller · ID verified", loc:"Kismayo", age:8,
   desc:"3-inch pump, runs well, used one season on the Jubba. Pipe has minor patches. Buyer arranges transport from the farm.",
   amountTxt:"$650", amountKind:"Collection only", open:1,
   fields:{ sub:"Farm & irrigation", sellerType:"Private seller", price:650, negotiable:true, condition:"Used — fair", collectionOnly:true },
   meta:{ profile:"ID verified · 2 sales" } }
];

function hydrate(seed) {
  var now = new Date().toISOString();
  var l = {
    id: RF.uid("seed"), board: seed.board, title: seed.title, org: seed.org, loc: seed.loc,
    sub: seed.sub, desc: seed.desc, fields: seed.fields,
    amountTxt: seed.amountTxt, amountKind: seed.amountKind,
    due: seed.fields.closingDate ? RF.formatDate(seed.fields.closingDate) : null,
    createdAt: D(seed.age), updatedAt: now,
    state: seed.open ? "active" : "shortlisting",
    reviewed: SCHEMA[seed.board].verify.map(function (c) { return c.id; }), // seed data is pre-verified
    paymentProtected: RF.escrowApplies(seed.board, seed.fields),
    meta: seed.meta || {},
    facts: RF.buildFacts(seed.board, seed.fields)
  };
  l.rs = RF.score.compute(l);
  return l;
}

function ensureSeed() {
  S.load();
  if (!S.seeded()) S.seed(SEED.map(hydrate));
  else S.load();
}

/* ---------------------------------------------------------------- helpers */
function e(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
function ago(iso) { var n = Math.round((Date.now() - new Date(iso).getTime()) / 86400000); return n < 1 ? "today" : n === 1 ? "yesterday" : n + " days ago"; }
var TICK = '<svg class="tick" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 6.5l2.6 2.6L10 3.4"/></svg>';
var FLAG = '<svg width="28" height="28" viewBox="0 0 8 8" aria-label="Garsoore"><rect width="8" height="8" fill="var(--bg)" stroke="var(--line)" stroke-width=".15"/><g fill="var(--fg)">' +
  (function () { var s = ""; for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) if ((x + y) % 2 === 0) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; return s; })() + '</g></svg>';

function rsChip(rs) { return '<span class="badge rs rs-' + rs.band + '" title="Garsoore Score — verification, freshness, transparency, responsiveness">GS ' + rs.score + '</span>'; }

function toast(msg) {
  var t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add("in"); }, 10);
  setTimeout(function () { t.classList.remove("in"); }, 3600);
  setTimeout(function () { t.remove(); }, 4000);
}

/* ---------------------------------------------------------------- chrome */
function chrome() {
  var cur = window.BOARD, sp = window.SHOP;
  function nl(href, label, on, cls) { return '<a href="' + href + '"' + (on || cls ? ' class="' + (on ? "on " : "") + (cls || "") + '"' : "") + '>' + label + '</a>'; }
  /* two surfaces: consumer at the root (garsoore.com), business under /business/ (business.garsoore.com) */
  var biz = window.SURFACE === "business";
  /* On a real domain the two surfaces are subdomains (buurwen.com / business.buurwen.com); locally and on *.workers.dev they are folders. */
  var H = location.hostname, real = /\.[a-z]{2,}$/i.test(H) && !/(^|\.)(workers|pages)\.dev$/.test(H), root = H.replace(/^business\./, "");
  var CP = biz ? (real ? location.protocol + "//" + root + "/" : "../") : "", BP = biz ? "" : (real ? location.protocol + "//business." + root + "/" : "business/");
  document.body.classList.toggle("biz", biz);
  document.documentElement.setAttribute("data-surface", biz ? "business" : "consumer");   // hard visual boundary (tokens in style.css)
  /* ONE-CLICK SWITCH: the same page on the other site when an equivalent exists (search / link carried over), else its home. */
  var file = (location.pathname.split("/").pop() || "index.html").replace(/^$/, "index.html"), qsn = new URLSearchParams(location.search), carry = new URLSearchParams();
  if (file === "china.html") { ["q", "u"].forEach(function (k) { if (qsn.get(k)) carry.set(k, qsn.get(k)); }); }
  var EQ = biz ? { "china.html": "china.html", "activity.html": "orders.html", "index.html": "index.html" } : { "china.html": "china.html", "orders.html": "activity.html", "activity.html": "activity.html", "index.html": "index.html" };
  var other = (biz ? CP : BP) + (EQ[file] || "index.html") + (EQ[file] === "china.html" && String(carry) ? "?" + carry : "");
  var thisHome = "index.html";
  document.body.insertAdjacentHTML("afterbegin", '<div class="surfbar" aria-hidden="true"></div>');
  /* cream/beige (light) is the default; dark is opt-in only:  ?theme=dark  (remembered)  /  ?theme=light  (back) */
  try {
    var th = new URLSearchParams(location.search).get("theme"); if (th) localStorage.setItem("garsoore.theme", th === "dark" ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", localStorage.getItem("garsoore.theme") === "dark" ? "dark" : "light");
  } catch (x) { document.documentElement.setAttribute("data-theme", "light"); }
  document.body.insertAdjacentHTML("afterbegin",
    '<header class="site"><div class="wrap bar">' +
      '<a class="brand" href="' + (biz ? "index.html" : "index.html") + '">' + FLAG + '<span class="bname"> Garsoore</span>' + (biz ? ' <span class="bizmark">Ganacsi</span>' : '') + '</a>' +
      '<nav class="nav">' +
        (biz
          /* index.html is the front door now; the trading board moved to board.html, and china.html became
             market.html (the old address still redirects, because those links are already in WhatsApp threads). */
          ? nl("index.html", "Bilow", window.SHOP === "bizhome") + nl("market.html", "Suuqa jumlada", window.SHOP === "bizchina" || window.SHOP === "product", "cnlink") + nl("sourcing.html", "Naga iibso", window.SHOP === "sourcing") + nl("fbg.html", "FBG", window.SHOP === "fbg") + nl("pro.html", "Pro", window.SHOP === "pro") + nl("board.html", "Suuqa ganacsiga", cur === "b2b") + nl("agents.html", "Wakiillo", window.SHOP === "agents") + nl("agent.html", "Bogga wakiilka", window.SHOP === "agent") + nl("contracts.html", "Qandaraasyo", cur === "tenders") +
            nl("logistics.html", "Rar", cur === "logi") + nl("exchange.html", "Suuqa badeecada", cur === "exchange") +
            nl("activity.html", "Hawlaha shirkadda", cur === "activity")
          /* Four doors, not six. Xayeysiis, Adeegyo and Shaqooyin were three empty rooms, and an empty room on a
             marketplace reads as an abandoned marketplace. Gacan ka Gacan takes their place: it earns nothing,
             which is the point - it gives the site a reason to be opened on a day nobody is importing. */
          : nl("index.html", "Suuqa", sp === "home") + nl("h2h.html", "Gacan ka Gacan", sp === "h2h") +
            nl("china.html", "Ka iibso Shiinaha", sp === "china", "cnlink") + nl("orders.html", "Dalabyadayda", sp === "orders")) +
      '</nav>' +
      '<span class="spacer"></span>' +
      '<button class="btn ghost" id="whoBtn"></button>' +
      (biz && RF.mode ? '<button class="btn ghost modebtn" id="modeBtn"></button>' : "") +
      '<button class="btn ghost langbtn" id="langBtn" title="Language"></button>' +
      (biz || !RF.cart ? "" : '<a class="btn ghost cartbtn' + (sp === "cart" ? " on" : "") + '" href="cart.html" aria-label="Dambiisha">🛒<span id="cartN"></span></a>') +
      '<div class="surfsw" role="navigation" aria-label="Garsoore ⇄ Ganacsi">' +
        '<a data-switch="consumer" class="' + (biz ? "" : "on") + '" href="' + (biz ? other : thisHome) + '"' + (biz ? "" : ' aria-current="page"') + '>Garsoore</a>' +
        '<a data-switch="business" class="' + (biz ? "on" : "") + '" href="' + (biz ? thisHome : other) + '"' + (biz ? ' aria-current="page"' : "") + '>Ganacsi</a>' +
      '</div>' +
      '<button class="btn" id="postBtn">' + (biz ? "Dhig" : "Iibi") + '</button>' +
    '</div></header>');
  document.body.insertAdjacentHTML("beforeend",
    '<footer class="site"><div class="wrap fgrid">' +
      '<div><b>Garsoore</b> — garsooraha u dhexeeya iibsadaha iyo iibiyaha. Prototype · xogtu waxay ku jirtaa browser-kaaga. ' +
        '<a href="#" id="resetBtn" style="text-decoration:underline">Dib u deji xogta</a>' + (window.GARSOORE_CONFIG && GARSOORE_CONFIG.build ? ' <span style="opacity:.6">· build ' + GARSOORE_CONFIG.build + '</span>' : '') + '</div>' +
      '<div class="fnav"><a href="' + (biz ? "../" : "") + 'help.html">Caawimo</a><a href="' + (biz ? "../" : "") + 'terms.html">Shuruudaha</a>' +
        '<a href="' + (biz ? "../" : "") + 'returns.html">Celinta</a><a href="' + (biz ? "../" : "") + 'privacy.html">Asturnaanta</a></div>' +
      '<div>' + (biz ? '<a href="' + other + '">← Garsoore ' + (real ? "(" + root + ")" : "") + '</a>' : '<a href="' + other + '">Ganacsi ' + (real ? "(business." + root + ")" : "") + ' →</a>') + '</div>' +
    '</div></footer>' +
    '<div class="scrim" id="scrim"></div>' +
    '<div class="drawer" id="drawer"><button class="close" id="drawerClose">&times;</button>' +
      '<div class="dhead" id="dhead"></div><div class="dbody" id="dbody"></div></div>' +
    '<div class="modal" id="modal"><div class="box" id="modalBox"></div></div>');

  refreshWho();
  if (RF.bell) RF.bell.mount(document.querySelector("header.site .bar"));
  if (biz && RF.mode && document.getElementById("modeBtn")) {
    /* two faces of the business site: Fudud asks a few questions, Xirfadle gives every lever */
    var mb = document.getElementById("modeBtn"), pro = RF.mode.get() === "pro";
    mb.textContent = pro ? "Fudud" : "Xirfadle";
    mb.title = pro ? "Habka fudud" : "Habka xirfadlaha";
    mb.onclick = function () { RF.mode.set(pro ? "simple" : "pro"); };
  }
  /* Somali is the interface language; this switches the rendered text to English and remembers the choice */
  if (RF.i18n) {
    var lb = document.getElementById("langBtn"), en = RF.i18n.lang() === "en";
    lb.textContent = en ? "SO" : "EN";
    lb.title = en ? "Af Soomaali" : "English";
    lb.onclick = function () { RF.i18n.set(en ? "so" : "en"); };
  }
  if (RF.cart && document.getElementById("cartN")) {
    RF.cart.onchange = function () { var n = RF.cart.count(), el = document.getElementById("cartN"); el.textContent = n || ""; el.className = n ? "n" : ""; };
    RF.cart.onchange();
    window.addEventListener("storage", function (ev) { if (ev.key === "garsoore.cart") RF.cart.onchange(); });   // other tabs
  }
  /* real accounts when the API is there: one login across both sites; staff get the operations console in the business nav */
  if (RF.api) RF.api.onUser(function (u) {
    refreshWho();
    var nav = document.querySelector("header.site .nav"), has = nav && nav.querySelector(".opslink");
    var isStaff = u && (u.role === "staff" || u.role === "admin");
    if (isStaff && nav && !has) nav.insertAdjacentHTML("beforeend", '<a class="opslink' + (window.SHOP === "ops" || window.SHOP === "quotes" ? " on" : "") + '" href="' + (biz ? "" : BP) + 'ops.html">⚙ Hawlgalka</a>' +
      (u.role === "admin" ? '<a class="opslink" target="_blank" rel="noopener" href="' + (real ? location.protocol + "//admin." + root + "/" : "../admin/index.html") + '">🛡 Console ↗</a>' : ""));
    if (!isStaff && has) [].forEach.call(nav.querySelectorAll(".opslink"), function (x) { x.remove(); });
    if (u && u.mustChangePin && RF.pinGate) RF.pinGate();
  });
  document.getElementById("whoBtn").onclick = function () {
    if (RF.api && RF.api.remote) { location.href = (biz ? "" : "") + "account.html"; return; }
    var n = prompt("Your name or organisation (used to sign your listings and track your deals):", RF.identity.get());
    if (n != null) { RF.identity.set(n.trim()); refreshWho(); if (window.BOARD === "activity") activityPage(); }
  };
  document.getElementById("postBtn").onclick = function () { openWizard(window.BOARD && PAGE[window.BOARD] ? window.BOARD : null); };
  document.getElementById("scrim").onclick = closeAll;
  document.getElementById("drawerClose").onclick = closeDrawer;
  document.getElementById("resetBtn").onclick = function (ev) { ev.preventDefault(); if (confirm("Clear all listings and deals stored in this browser and reload the seed data?")) { S.reset(); location.reload(); } };
  document.getElementById("modal").onclick = function (ev) { if (ev.target.id === "modal") closeModal(); };
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeAll(); });
}
function refreshWho() {
  var n = RF.api && RF.api.remote ? (RF.api.user ? RF.api.user.name.split(" ")[0] : "") : RF.identity.get();
  var wb = document.getElementById("whoBtn"); wb.textContent = n ? "👤 " + n : (RF.api && RF.api.remote ? "Samee akoon" : "Gal"); wb.classList.toggle("in", !!n); wb.title = n || "Gal";
}
function closeModal() { document.getElementById("modal").classList.remove("on"); }
function closeDrawer() { document.getElementById("drawer").classList.remove("on"); document.getElementById("scrim").classList.remove("on"); }
function closeAll() { closeModal(); closeDrawer(); }

/* ---------------------------------------------------------------- row + drawer */
function rowHTML(l) {
  return '<div class="row" data-id="' + l.id + '">' +
    '<div><div class="head"><span class="mono type">' + LABEL[l.board] + ' · ' + e(l.sub) + '</span>' +
      rsChip(l.rs) +
      (V.publishable(l) ? '<span class="badge solid">' + TICK + ' Verified</span>' : '<span class="badge">In review</span>') +
      (l.paymentProtected ? '<span class="badge">' + (l.board === "tenders" ? "Bonded" : "Payment protected") + '</span>' : "") +
      (l.state === "shortlisting" ? '<span class="badge">Shortlisting</span>' : "") +
      (l.state === "closed" ? '<span class="badge">Closed</span>' : "") +
    '</div>' +
    '<h3>' + e(l.title) + '</h3><div class="org">' + e(l.org) + ' · ' + e(l.loc) + '</div>' +
    '<div class="desc">' + e(l.desc) + '</div>' +
    '<div class="facts mono">' + l.facts.map(function (f) { return "<span>" + e(f) + "</span>"; }).join("") + '</div></div>' +
    '<div class="rail"><div class="amt">' + e(l.amountTxt) + '</div><div class="amt-k mono">' + e(l.amountKind) + '</div>' +
      '<div class="due">' + (l.due ? "Closes <b>" + e(l.due) + "</b>" : "Posted <b>" + ago(l.createdAt) + "</b>") + '</div></div>' +
  '</div>';
}
function wireRows(container) {
  container.querySelectorAll(".row").forEach(function (r) { r.onclick = function () { openDrawer(r.getAttribute("data-id")); }; });
}

function openDrawer(id) {
  var l = S.listing(id); if (!l) return;
  var lc = SCHEMA[l.board].lifecycle;
  var vs = V.status(l);
  document.getElementById("dhead").innerHTML =
    '<span class="mono type">' + LABEL[l.board] + ' · ' + e(l.sub) + '</span>' +
    '<h2>' + e(l.title) + '</h2>' +
    '<div class="org" style="color:var(--muted)">' + e(l.org) + ' · ' + e(l.loc) + '</div>' +
    '<div class="head" style="margin-top:12px">' + rsChip(l.rs) +
      (V.publishable(l) ? '<span class="badge solid">' + TICK + ' Verified</span>' : '<span class="badge">In review</span>') +
      (l.paymentProtected ? '<span class="badge">' + (l.board === "tenders" ? "Performance bond" : "Payment protected") + '</span>' : "") + '</div>';

  var rows = "";
  var order = ["closingDate", "estValue", "salaryMin", "salaryMax", "salaryBasis", "employment", "rate", "rateBasis",
               "price", "condition", "procurementType", "contractLength", "paymentTerms", "bidBond", "prequal",
               "interviewStages", "unpaidTask", "visa", "remote", "licenceNumber", "licenceBody", "insured",
               "insuranceCover", "serviceArea", "responseTime", "registryCheck", "sellerType", "negotiable", "collectionOnly", "siteVisit", "refNumber"];
  var defs = {}; RF.boardFields(l.board).forEach(function (f) { defs[f.id] = f; });
  order.forEach(function (k) {
    if (l.fields[k] === undefined || !defs[k]) return;
    var v = l.fields[k];
    if (typeof v === "boolean") v = v ? "Yes" : "No";
    else if (typeof v === "number") v = defs[k].type === "money" ? RF.money(v) : v;
    rows += "<dt>" + e(defs[k].label) + "</dt><dd>" + e(v) + "</dd>";
  });

  var factorRows = "";
  var fac = l.rs.factors;
  factorRows = '<div class="scorebars">' +
    bar("Verification", fac.verification, 40) + bar("Freshness", fac.freshness, 20) +
    bar("Transparency", fac.transparency, 25) + bar("Responsiveness", fac.responsiveness, 15) + '</div>';

  var checks = V.required(l).map(function (c) {
    var done = vs.done.indexOf(c) >= 0;
    return '<li>' + (done ? TICK : '<span class="tick" style="opacity:.3">•</span>') +
      '<span' + (done ? "" : ' style="color:var(--faint)"') + '>' + e(c.label) + (done ? "" : " — pending") + '</span></li>';
  }).join("");

  var canAct = l.state === "active" && V.publishable(l);
  document.getElementById("dbody").innerHTML =
    '<p style="color:var(--muted)">' + e(l.desc) + '</p>' +
    (l.meta.profile ? '<p class="mono" style="color:var(--faint);margin-top:8px">' + e(l.meta.profile) + '</p>' : "") +
    '<dl class="kv"><dt>' + (l.board === "jobs" ? "Compensation" : l.board === "services" ? "Rate" : "Value") + '</dt>' +
      '<dd>' + e(l.amountTxt) + ' <span style="color:var(--faint);font-weight:400">— ' + e(l.amountKind) + '</span></dd>' +
      (l.due ? "<dt>Closing date</dt><dd>" + e(l.due) + "</dd>" : "") +
      "<dt>Posted</dt><dd>" + ago(l.createdAt) + "</dd>" + rows + '</dl>' +
    '<div class="trust"><div class="k mono">Garsoore Score — ' + l.rs.score + ' / 100 (band ' + l.rs.band + ')</div>' + factorRows + '</div>' +
    '<div class="trust"><div class="k mono">Verification checklist</div><ul>' + checks + '</ul></div>' +
    '<div class="dactions">' +
      '<button class="btn" id="actBtn"' + (canAct ? "" : " disabled") + '>' + e(lc.actionLabel) + '</button>' +
      '<button class="btn ghost" onclick="alert(\'Saved (not persisted in this prototype).\')">Save</button>' +
    '</div>' +
    (canAct ? "" : '<p class="mono" style="color:var(--faint);margin-top:10px">' + (l.state === "closed" ? "This listing is closed." : "Available once verification completes.") + '</p>');

  var b = document.getElementById("actBtn");
  if (b && canAct) b.onclick = function () { startDeal(l); };
  document.getElementById("drawer").classList.add("on");
  document.getElementById("scrim").classList.add("on");
}
function bar(label, val, max) {
  return '<div class="sb"><span class="mono">' + label + '</span><span class="track"><i style="width:' + Math.round(100 * val / max) + '%"></i></span><span class="mono">' + val + '/' + max + '</span></div>';
}

function startDeal(l) {
  var me = RF.identity.get();
  if (!me) {
    me = (prompt("Your name or organisation — this identifies you to the other party:", "") || "").trim();
    if (!me) return;
    RF.identity.set(me); refreshWho();
  }
  if (me === l.org) { toast("That's your own listing."); return; }
  var d = LC.create(l, me);
  closeDrawer();
  toast(SCHEMA[l.board].lifecycle.actionLabel + " recorded — now " + RF.prettyState(d.state) + ". Track it in My activity.");
}

/* ---------------------------------------------------------------- board page */
function boardPage() {
  var board = window.BOARD, h = HERO[board], app = document.getElementById("app");
  app.innerHTML =
    '<section class="hero sm"><div class="wrap">' +
      '<p class="mono type eyebrow">' + e(h.eyebrow) + '</p>' +
      '<h1>' + e(h.title) + '</h1><p class="sub">' + e(h.sub) + '</p>' +
      '<div class="searchrow"><input id="q" type="text" placeholder="Search ' + e(PAGE[board].name.toLowerCase()) + '…">' +
        '<select id="loc"><option value="">Anywhere</option>' + RF.CITIES.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select>' +
        '<button id="searchBtn">Search</button></div>' +
    '</div></section>' +
    '<div class="wrap shell"><aside class="facets">' +
      '<div class="facet"><div class="k mono">Category</div><div class="chiplist" id="subs"></div></div>' +
      '<div class="facet"><div class="k mono">Trust filters</div>' +
        '<label><input type="checkbox" id="f-ver" checked> Verified only</label>' +
        '<label><input type="checkbox" id="f-pay"> Payment protected</label>' +
        '<label><input type="checkbox" id="f-rs"> Garsoore Score 80+</label></div>' +
      '<div class="facet"><div class="k mono">Posted</div>' +
        '<label><input type="radio" name="age" value="0" checked> Any time</label>' +
        '<label><input type="radio" name="age" value="7"> Last 7 days</label>' +
        '<label><input type="radio" name="age" value="2"> Last 48 hours</label></div>' +
    '</aside><section>' +
      '<div class="resbar"><span class="n" id="count">—</span><span class="mono" style="color:var(--faint)" id="scope"></span>' +
        '<span class="sort"><select id="sort"><option value="rs">Garsoore Score</option><option value="new">Newest</option>' +
          '<option value="due">Closing soonest</option><option value="val">Highest value</option></select></span></div>' +
      '<div id="list"></div>' +
      '<div class="empty" id="empty" style="display:none"><div class="checkstrip"></div>Nothing matches those filters yet.</div>' +
    '</section></div>';

  var state = { sub: null };
  function renderSubs() {
    var el = document.getElementById("subs"); el.innerHTML = "";
    SCHEMA[board].subs.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "chip" + (state.sub === s ? " on" : ""); b.textContent = s;
      b.onclick = function () { state.sub = state.sub === s ? null : s; renderSubs(); render(); };
      el.appendChild(b);
    });
  }
  function render() {
    var q = document.getElementById("q").value.trim().toLowerCase();
    var loc = document.getElementById("loc").value;
    var ver = document.getElementById("f-ver").checked;
    var pay = document.getElementById("f-pay").checked;
    var rs = document.getElementById("f-rs").checked;
    var age = +document.querySelector("input[name=age]:checked").value;
    var sort = document.getElementById("sort").value;
    var rows = S.listings(board).filter(function (l) {
      if (l.state === "in_review") return false;
      if (state.sub && l.sub !== state.sub) return false;
      if (loc && l.loc !== loc) return false;
      if (ver && !V.publishable(l)) return false;
      if (pay && !l.paymentProtected) return false;
      if (rs && l.rs.score < 80) return false;
      if (age && (Date.now() - new Date(l.createdAt)) / 86400000 > age) return false;
      if (q && (l.title + " " + l.org + " " + l.desc + " " + l.sub + " " + l.loc).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (sort === "val") rows.sort(function (a, b) { return (b.fields.estValue || b.fields.price || b.fields.salaryMax || b.fields.rate || 0) - (a.fields.estValue || a.fields.price || a.fields.salaryMax || a.fields.rate || 0); });
    else if (sort === "due") rows.sort(function (a, b) { return (a.fields.closingDate ? new Date(a.fields.closingDate) : 9e15) - (b.fields.closingDate ? new Date(b.fields.closingDate) : 9e15); });
    else if (sort === "new") rows.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    else rows.sort(function (a, b) { return b.rs.score - a.rs.score; });
    document.getElementById("count").textContent = rows.length + (rows.length === 1 ? " result" : " results");
    document.getElementById("scope").textContent = state.sub || "";
    document.getElementById("empty").style.display = rows.length ? "none" : "block";
    var list = document.getElementById("list");
    list.innerHTML = rows.map(rowHTML).join("");
    wireRows(list);
  }
  window.__render = render;
  document.getElementById("searchBtn").onclick = render;
  document.getElementById("q").onkeydown = function (ev) { if (ev.key === "Enter") render(); };
  ["loc", "f-ver", "f-pay", "f-rs", "sort"].forEach(function (id) { document.getElementById(id).onchange = render; });
  document.querySelectorAll("input[name=age]").forEach(function (r) { r.onchange = render; });
  renderSubs(); render();
}

/* ---------------------------------------------------------------- landing */
function landing() {
  var app = document.getElementById("app");
  var META = {
    tenders: ["Tenders, without the runaround", "FGS, member-state and NGO notices — plain language, real deadlines, one search."],
    jobs: ["Jobs, without the wasta", "Employer-verified, salary shown, delisted when the role is filled."],
    services: ["Fundis, without the guesswork", "Licence and references checked, price agreed up front, pay on completion."],
    classifieds: ["Marketplace, without the risk", "ID-checked sellers, permits verified, mobile-money escrow over $500."]
  };
  var cards = Object.keys(PAGE).map(function (k) {
    return '<a class="board-card" href="' + PAGE[k].slug + '"><div class="k mono">' + e(HERO[k].eyebrow) + '</div>' +
      '<div class="v">' + META[k][0] + '</div><div class="d">' + META[k][1] + '</div>' +
      '<div class="go">Open ' + PAGE[k].name + ' &rarr;</div></a>';
  }).join("");
  app.innerHTML =
    '<section class="hero"><div class="wrap"><h1>Every deal, Garsoored.</h1>' +
      '<p class="sub">Somalia\'s tenders, jobs, trades and private sales — on one board where every counterparty is verified before they can post, and payment is held until both sides are done.</p>' +
      '<div class="searchrow"><input id="q" type="text" placeholder="Search everything…">' +
        '<select id="loc"><option value="">Anywhere</option>' + RF.CITIES.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select>' +
        '<button id="searchBtn">Search</button></div>' +
      '<div class="boards">' + cards + '</div>' +
      '<a class="xstrip b2bstrip" href="b2b.html"><div><div class="k mono">B2B Exchange &nbsp;·&nbsp; wholesale</div>' +
        '<div class="v">Business supply — goods &amp; services, RFQ to invoice</div>' +
        '<div class="d">Verified suppliers, bulk pricing and MOQs, RFQ → quotes → purchase order → delivery → payment, with funds held in a business wallet. Standardised graded goods list straight onto the commodity order book.</div></div>' +
        '<span class="go">Open B2B &rarr;</span></a>' +
      '<a class="xstrip b2bstrip" href="logistics.html"><div><div class="k mono">Logistics &nbsp;·&nbsp; freight</div>' +
        '<div class="v">Just move it — air, sea and land routes on rails</div>' +
        '<div class="d">Air-cargo routes, domestic sea-port routes and land corridors. Shippers post a short RFQ; carriers post capacity on fixed lanes; the board matches load to space, then books, documents and settles through escrow.</div></div>' +
        '<span class="go">Open Logistics &rarr;</span></a>' +
      '<a class="xstrip" href="exchange.html"><div><div class="k mono">Commodity Exchange</div>' +
        '<div class="v">Somalia\'s export &amp; staple commodities, on an order book</div>' +
        '<div class="d">Export livestock, frankincense, sesame and sorghum — bid and offer on a par-grade basis, better grades clear at a published differential, matched lots settle through escrow with grading at the port.</div></div>' +
        '<span class="go">Open Exchange &rarr;</span></a>' +
    '</div></section>' +
    '<div class="wrap" style="padding:36px 28px 90px"><div class="resbar"><span class="n">Top-rated across all boards</span>' +
      '<span class="mono sort" style="color:var(--faint)">by Garsoore Score</span></div><div id="list"></div></div>';
  function run() {
    var q = document.getElementById("q").value.trim().toLowerCase();
    var loc = document.getElementById("loc").value;
    var rows = S.listings().filter(function (l) {
      if (l.state === "in_review") return false;
      if (loc && l.loc !== loc) return false;
      if (q && (l.title + " " + l.org + " " + l.desc + " " + l.sub + " " + l.loc).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    rows.sort(function (a, b) { return q || loc ? new Date(b.createdAt) - new Date(a.createdAt) : b.rs.score - a.rs.score; });
    if (!q && !loc) rows = rows.slice(0, 8);
    var list = document.getElementById("list");
    list.innerHTML = rows.map(rowHTML).join("");
    wireRows(list);
  }
  document.getElementById("searchBtn").onclick = run;
  document.getElementById("q").onkeydown = function (ev) { if (ev.key === "Enter") run(); };
  document.getElementById("loc").onchange = run;
  run();
}

/* ---------------------------------------------------------------- wizard modal */
var WIZ = null;
function openWizard(board) {
  WIZ = new RF.Wizard(board);
  document.getElementById("modal").classList.add("on");
  renderWizard();
}
function renderWizard() {
  var box = document.getElementById("modalBox");
  var w = WIZ;

  if (w.stage === "board") {
    box.innerHTML = wizShell("What are you posting?", "",
      '<div class="wgrid">' + Object.keys(PAGE).filter(function (k) { return (k === "tenders") === (window.SURFACE === "business"); }).map(function (k) {
        return '<button class="wpick" data-b="' + k + '"><b>' + PAGE[k].name + '</b><span>' + e(HERO[k].eyebrow) + '</span></button>';
      }).join("") + '</div>', false);
    box.querySelectorAll(".wpick").forEach(function (b) {
      b.onclick = function () { w.setBoard(b.getAttribute("data-b")); w.stage = "intake"; renderWizard(); };
    });
    return;
  }

  if (w.stage === "intake") {
    box.innerHTML = wizShell(PAGE[w.board].name + " — quick start",
      "Paste an existing " + PAGE[w.board].noun + " and Garsoore will pre-fill the form. Or skip and answer one question at a time.",
      '<textarea id="wPaste" rows="7" placeholder="Paste a job description, tender notice, or ad here…"></textarea>' +
      '<div class="wrow"><button class="btn" id="wParse">Parse &amp; pre-fill</button>' +
        '<button class="btn ghost" id="wScratch">Start from scratch</button></div>' +
      '<div id="wParseNote" class="note" style="display:none"></div>', true);
    box.querySelector("#wParse").onclick = function () {
      var txt = box.querySelector("#wPaste").value.trim();
      if (!txt) return;
      var parsed = RF.parser.parse(w.board, txt);
      w.applyProposal(parsed);
      var n = box.querySelector("#wParseNote");
      n.style.display = "block";
      n.innerHTML = "Confidence " + Math.round(parsed.confidence * 100) + "%. " + parsed.notes.map(e).join(" ") +
        " <b>Review every field.</b>";
      setTimeout(function () { w.stage = w.current() ? "fields" : "review"; renderWizard(); }, 900);
    };
    box.querySelector("#wScratch").onclick = function () { w.stage = "fields"; renderWizard(); };
    return;
  }

  if (w.stage === "fields") {
    var f = w.current();
    if (!f) { w.stage = "review"; renderWizard(); return; }
    var p = w.progress();
    box.innerHTML = wizShell(PAGE[w.board].name + " listing",
      "",
      '<div class="wprog"><i style="width:' + p.pct + '%"></i></div>' +
      '<div class="wq"><label>' + e(f.label) + (f.required ? ' <span class="req">required</span>' : "") + '</label>' +
      (f.help ? '<p class="whelp">' + e(f.help) + '</p>' : "") +
      fieldControl(f, w.values[f.id]) + '</div>' +
      '<div class="wrow">' +
        '<button class="btn ghost" id="wBack"' + (w.history.length ? "" : " disabled") + '>Back</button>' +
        (f.required ? "" : '<button class="btn ghost" id="wSkip">Skip</button>') +
        '<button class="btn" id="wNext">Continue</button>' +
      '</div>', true);
    var ctl = box.querySelector("#wCtl");
    if (ctl && ctl.focus) try { ctl.focus(); } catch (x) {}
    box.querySelector("#wNext").onclick = function () {
      var val = readControl(f, box);
      if (f.required && (val === "" || val == null)) { ctl.classList.add("err"); return; }
      w.set(f.id, val);
      w.stage = w.current() ? "fields" : "review";
      renderWizard();
    };
    if (box.querySelector("#wSkip")) box.querySelector("#wSkip").onclick = function () { w.skip(); w.stage = w.current() ? "fields" : "review"; renderWizard(); };
    box.querySelector("#wBack").onclick = function () { w.back(); renderWizard(); };
    if (ctl) ctl.onkeydown = function (ev) { if (ev.key === "Enter" && f.type !== "textarea") { ev.preventDefault(); box.querySelector("#wNext").click(); } };
    return;
  }

  if (w.stage === "review") {
    var missing = w.missingRequired();
    var vals = w.values;
    var rows = RF.relevantFields(w.board, vals).filter(function (fl) { return vals[fl.id] !== undefined; }).map(function (fl) {
      var v = vals[fl.id];
      if (typeof v === "boolean") v = v ? "Yes" : "No";
      else if (fl.type === "money") v = RF.money(v);
      return '<dt>' + e(fl.label) + '</dt><dd>' + e(v) + '<button class="wedit" data-f="' + fl.id + '">edit</button></dd>';
    }).join("");
    var escrow = RF.escrowApplies(w.board, vals);
    box.innerHTML = wizShell("Review — " + PAGE[w.board].name,
      "Nothing is published yet. On submit this enters verification; it stays hidden until every required check clears.",
      (missing.length ? '<div class="note err">Still required: ' + missing.map(function (m) { return e(m.label); }).join(", ") + '</div>' : "") +
      '<dl class="kv wreview">' + rows + '</dl>' +
      '<div class="note">' + (escrow ? "This deal will settle through escrow. " : "") +
        "Verification needed: " + SCHEMA[w.board].verify.map(function (c) { return e(c.label); }).join("; ") + ".</div>" +
      '<div class="wrow"><button class="btn ghost" id="wBack2">Back</button>' +
        '<button class="btn" id="wSubmit"' + (missing.length ? " disabled" : "") + '>Submit for verification</button></div>', true);
    box.querySelectorAll(".wedit").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-f");
        w._snapshot(); delete w.values[id]; delete w.skipped[id];
        w.stage = "fields"; renderWizard();
      };
    });
    box.querySelector("#wBack2").onclick = function () { w.back(); renderWizard(); };
    var sub = box.querySelector("#wSubmit");
    if (sub && !missing.length) sub.onclick = function () {
      var listing = w.build();
      if (!listing.org || listing.org === "") listing.org = RF.identity.orAnon();
      S.addListing(listing);
      w.stage = "done"; w._listing = listing; renderWizard();
    };
    return;
  }

  if (w.stage === "done") {
    var l = w._listing;
    box.innerHTML = wizShell("Submitted",
      "",
      '<div class="wdone">' + TICK + '<div><b>' + e(l.title) + '</b> is in verification.<br>' +
      '<span class="mono" style="color:var(--faint)">Garsoore Score ' + l.rs.score + ' · ' + V.status(l).pending.length + ' check(s) pending</span></div></div>' +
      '<p style="color:var(--muted);font-size:14px">You can watch its status and simulate the reviewer clearing it on the ' +
      '<a href="activity.html" style="text-decoration:underline">My activity</a> page.</p>' +
      '<div class="wrow"><button class="btn ghost" id="wClose">Close</button>' +
        '<a class="btn" href="activity.html">Go to My activity</a></div>', true);
    box.querySelector("#wClose").onclick = function () { closeModal(); if (window.__render) window.__render(); };
    return;
  }
}
function wizShell(title, sub, body, showClose) {
  return '<div class="mh"><h2>' + e(title) + '</h2>' + (showClose ? '<button class="close" id="wX">&times;</button>' : "") + '</div>' +
    '<div class="mb">' + (sub ? '<p class="wsub">' + e(sub) + '</p>' : "") + body + '</div>';
}
function fieldControl(f, val) {
  if (f.type === "enum") {
    return '<select id="wCtl"><option value="">—</option>' + f.options.map(function (o) {
      return '<option' + (val === o ? " selected" : "") + '>' + e(o) + '</option>';
    }).join("") + '</select>';
  }
  if (f.type === "bool") {
    return '<div class="wbool"><label><input type="radio" name="wCtl" value="true"' + (val === true ? " checked" : "") + '> Yes</label>' +
      '<label><input type="radio" name="wCtl" value="false"' + (val === false ? " checked" : "") + '> No</label></div>';
  }
  if (f.type === "textarea") return '<textarea id="wCtl" rows="4">' + e(val || "") + '</textarea>';
  if (f.type === "money" || f.type === "number") return '<input id="wCtl" type="number" inputmode="numeric" value="' + (val != null ? e(val) : "") + '"' + (f.type === "money" ? ' placeholder="amount"' : "") + '>';
  if (f.type === "date") return '<input id="wCtl" type="date" value="' + e(val || "") + '">';
  return '<input id="wCtl" type="text" value="' + e(val || "") + '"' + (f.placeholder ? ' placeholder="' + e(f.placeholder) + '"' : "") + '>';
}
function readControl(f, box) {
  if (f.type === "bool") {
    var c = box.querySelector('input[name=wCtl]:checked');
    return c ? c.value === "true" : undefined;
  }
  var el = box.querySelector("#wCtl");
  if (!el) return undefined;
  var v = el.value.trim();
  if (v === "") return undefined;
  if (f.type === "money" || f.type === "number") return parseFloat(v.replace(/[^0-9.]/g, ""));
  return v;
}

/* ---------------------------------------------------------------- activity page */
var OWNER_ACTOR = { tenders: "owner", jobs: "employer", services: "provider", classifieds: "seller", exchange: "seller", b2b: "supplier", logi: "carrier" };
function myActor(d, me) {
  if (me && d.parties.owner === me) return OWNER_ACTOR[d.board];
  if (me && d.parties.counterparty === me) return d.counterpartyRole;
  return null;
}
function activityPage() {
  var me = RF.identity.get();
  var app = document.getElementById("app");
  var isBiz = window.SURFACE === "business", BIZ_BOARDS = ["tenders", "b2b", "logi", "exchange"];
  var side = function (x) { return isBiz === (BIZ_BOARDS.indexOf(x.board) >= 0); };          // hard boundary: consumer never sees business work
  var mine = me ? S.listings().filter(function (l) { return l.org === me; }).filter(side) : [];
  var deals = me ? S.deals(me).filter(side) : [];

  app.innerHTML =
    '<section class="hero sm"><div class="wrap"><p class="mono type eyebrow">My activity</p>' +
      '<h1>Your listings &amp; deals.</h1>' +
      '<div class="idbar"><label class="mono">You are</label>' +
        '<input id="idInput" value="' + e(me) + '" placeholder="name or organisation">' +
        '<button class="btn" id="idSave">Save</button></div>' +
      (me ? "" : '<p class="sub" style="font-size:15px">Set a name to see the listings you post and the deals you enter. It is stored only in this browser.</p>') +
    '</div></section>' +
    '<div class="wrap" style="padding:30px 28px 90px">' +
      (isBiz && window.RF.b2b && me ? '<div id="wallet"></div>' : "") +
      '<div class="resbar"><span class="n">Listings you posted</span><span class="mono" style="color:var(--faint)">' + mine.length + '</span></div>' +
      '<div id="mine"></div>' +
      '<div class="resbar" style="margin-top:40px"><span class="n">Deals &amp; orders you\'re in</span><span class="mono" style="color:var(--faint)">' + deals.length + '</span></div>' +
      '<div id="deals"></div>' +
      (isBiz && window.RF.b2b && me ? '<div class="resbar" style="margin-top:40px"><span class="n">Your RFQs</span></div><div id="myrfqs"></div>' : "") +
    '</div>';

  document.getElementById("idSave").onclick = function () {
    RF.identity.set(document.getElementById("idInput").value.trim()); refreshWho(); activityPage();
  };

  var mineEl = document.getElementById("mine");
  if (!me) mineEl.innerHTML = '<p class="empty" style="padding:24px 0">Set your name above.</p>';
  else if (!mine.length) mineEl.innerHTML = '<p class="empty" style="padding:24px 0">You haven\'t posted anything yet. Use <b>Post a listing</b>.</p>';
  else mineEl.innerHTML = mine.map(function (l) {
    var vs = V.status(l);
    return '<div class="mrow"><div><div class="head"><span class="mono type">' + LABEL[l.board] + ' · ' + e(l.sub) + '</span>' +
      rsChip(l.rs) + '<span class="badge">' + e(stateLabel(l)) + '</span></div>' +
      '<h3>' + e(l.title) + '</h3>' +
      '<div class="facts mono"><span>' + vs.done.length + "/" + V.required(l).length + ' checks cleared</span>' +
        (vs.pending.length ? '<span>Pending: ' + vs.pending.map(function (c) { return e(c.label); }).join(", ") + '</span>' : "") + '</div></div>' +
      '<div class="rail">' +
        (vs.pending.length ? '<button class="btn" data-approve="' + l.id + '">Simulate reviewer</button>' : '<span class="badge solid">' + TICK + ' Live</span>') +
        (l.state !== "closed" ? '<button class="btn ghost" data-close="' + l.id + '" style="margin-top:8px">Close listing</button>' : "") +
      '</div></div>';
  }).join("");
  mineEl.querySelectorAll("[data-approve]").forEach(function (b) {
    b.onclick = function () { var l = S.listing(b.getAttribute("data-approve")); V.approve(l); l.rs = RF.score.compute(l); S.save(); toast("Verification cleared — listing is live."); activityPage(); };
  });
  mineEl.querySelectorAll("[data-close]").forEach(function (b) {
    b.onclick = function () { S.updateListing(b.getAttribute("data-close"), { state: "closed" }); activityPage(); };
  });

  var dealsEl = document.getElementById("deals");
  if (!me) dealsEl.innerHTML = "";
  else if (!deals.length) dealsEl.innerHTML = '<p class="empty" style="padding:24px 0">No deals yet. Open a listing and use its action button.</p>';
  else dealsEl.innerHTML = deals.map(function (d) { return dealCard(d, me); }).join("");
  wireDeals(dealsEl, me);

  if (isBiz && window.RF.b2b && me) {
    var w = RF.b2b.wallet.get(me);
    document.getElementById("wallet").innerHTML =
      '<div class="walletcard"><div class="wc-bal"><div><span class="mono k">Available</span><b>' + RF.b2b.money(w.balance) + '</b></div>' +
        '<div><span class="mono k">In escrow</span><b>' + RF.b2b.money(w.held) + '</b></div>' +
        '<button class="btn" id="wTop">Top up</button></div>' +
      (w.ledger.length ? '<div class="wc-ledger">' + w.ledger.slice(0, 6).map(function (x) {
        return '<div class="wl"><span class="mono">' + e(RF.formatDate(x.at.slice(0, 10))) + '</span><span>' + e(x.note || x.kind) + '</span>' +
          '<span class="mono ' + (x.amount > 0 ? "px-up" : x.amount < 0 ? "px-down" : "") + '">' + (x.amount > 0 ? "+" : "") + (x.amount ? RF.b2b.money(x.amount) : "—") + '</span></div>';
      }).join("") + '</div>' : "") + '</div>';
    document.getElementById("wTop").onclick = function () {
      var a = prompt("Top up amount (USD, demo funds):", "20000");
      if (a && +a > 0) { RF.b2b.wallet.topUp(me, +a); toast("Wallet topped up " + RF.b2b.money(+a) + "."); activityPage(); }
    };

    var rfqEl = document.getElementById("myrfqs");
    var myr = RF.b2b.rfqs.forUser(me).filter(function (r) { return r.buyer === me; });
    rfqEl.innerHTML = myr.length ? "" : '<p class="empty" style="padding:20px 0">No RFQs yet — post one from the B2B page.</p>';
    if (myr.length) { rfqEl.innerHTML = myr.map(function (r) { return rfqCard(r, "buyer"); }).join(""); wireRfqCards(rfqEl); }
  }
}
function stateLabel(l) {
  return l.state === "in_review" ? "In review" : l.state === "active" ? "Live" : l.state === "shortlisting" ? "Shortlisting" : l.state === "closed" ? "Closed" : l.state;
}
function dealCard(d, me) {
  var states = LC.states(d.board);
  var idx = states.indexOf(d.state);
  var terminal = LC.isTerminal(d.board, d.state);
  var actor = myActor(d, me);
  var role = d.parties.owner === me ? "as " + OWNER_ACTOR[d.board] : "as " + d.counterpartyRole;
  var other = d.parties.owner === me ? d.parties.counterparty : d.parties.owner;
  var steps = states.map(function (s, i) {
    var cls = i < idx || terminal && i <= idx ? "done" : i === idx ? "now" : "";
    return '<span class="step ' + cls + '">' + e(RF.prettyState(s)) + '</span>';
  }).join('<span class="sep">›</span>');
  var trans = terminal ? [] : LC.transitions(d.board, d.state, actor);
  var btns = trans.map(function (t) {
    return '<button class="btn' + (t.primary ? "" : " ghost") + '" data-deal="' + d.id + '" data-to="' + t.to + '" data-actor="' + (actor || "") + '">' + e(t.label) + '</button>';
  }).join("");
  // solo demo: when the main-line move belongs to the other side, let you simulate it
  if (!terminal && !trans.some(function (t) { return t.primary; })) {
    LC.transitions(d.board, d.state).filter(function (t) { return t.primary; }).forEach(function (t) {
      btns += '<button class="btn ghost" data-deal="' + d.id + '" data-to="' + t.to + '" data-actor="' + t.actor + '">Simulate ' + e(t.actor) + ': ' + e(t.label) + '</button>';
    });
  }
  return '<div class="mrow deal"><div>' +
    '<div class="head"><span class="mono type">' + LABEL[d.board] + '</span>' +
      '<span class="badge">' + e(role) + '</span>' +
      (d.escrow !== "n/a" ? '<span class="badge">Escrow: ' + e(d.escrow) + '</span>' : "") +
      (terminal ? '<span class="badge solid">' + e(RF.prettyState(d.state)) + '</span>' : "") + '</div>' +
    '<h3>' + e(d.title) + '</h3>' +
    '<div class="org">with ' + e(other) + (d.amount ? ' · ' + RF.money(d.amount) : "") +
      (d.meta && d.meta.market ? ' · ' + e(d.meta.grade) + ' · ' + e(d.meta.deliveryPoint) : "") +
      (d.board === "b2b" && d.meta ? ' · ' + e(d.meta.poNo) + (d.meta.incoterm ? ' · ' + e(d.meta.incoterm) : "") : "") + '</div>' +
    (d.board === "b2b" && d.meta ? '<div class="facts mono">' +
      (d.meta.warehouse ? '<span>' + e(d.meta.warehouse) + '</span>' : "") +
      (d.meta.receiptNo ? '<span>Receipt ' + e(d.meta.receiptNo) + '</span>' : "") +
      (d.meta.invoiceNo ? '<span>' + e(d.meta.invoiceNo) + '</span>' : "") +
      (d.meta.rfqId ? '<span>from RFQ</span>' : "") + '</div>' : "") +
    (d.board === "logi" && d.meta ? '<div class="facts mono"><span>' + e(d.meta.service) + '</span>' +
      '<span>' + e(d.meta.equipment) + '</span><span>dep ' + e(RF.formatDate(d.meta.depart)) + '</span>' +
      (d.meta.docNo ? '<span>' + e(d.meta.docNo) + '</span>' : "") +
      (d.meta.podNo ? '<span>' + e(d.meta.podNo) + '</span>' : "") + '</div>' : "") +
    '<div class="stepper">' + steps + '</div></div>' +
    '<div class="rail">' + (btns || '<span class="mono" style="color:var(--faint)">' + (terminal ? "Closed" : "Waiting on " + (LC.transitions(d.board, d.state).map(function (t) { return t.actor; })[0] || "other party")) + '</span>') + '</div></div>';
}
function wireDeals(el, me) {
  el.querySelectorAll("[data-deal]").forEach(function (b) {
    b.onclick = function () {
      var id = b.getAttribute("data-deal"), to = b.getAttribute("data-to"), actor = b.getAttribute("data-actor") || undefined;
      var d = S.deal(id);
      var r = (d && d.board === "b2b" && window.RF.b2b) ? RF.b2b.advanceOrder(id, to, actor)
        : (d && d.board === "logi" && window.RF.logi) ? RF.logi.advanceBooking(id, to, actor)
        : LC.advance(id, to, actor);
      if (r && r.error) { toast(r.error); return; }
      toast("Moved to " + RF.prettyState(to) + ".");
      activityPage();
    };
  });
}

/* ---------------------------------------------------------------- exchange */
var XSEL = { marketId: null, dp: null, side: "buy" };

function exchangePage() {
  RF.market.ensureSeed();
  var app = document.getElementById("app");
  app.innerHTML =
    '<section class="hero sm"><div class="wrap"><p class="mono type eyebrow">Exchange</p>' +
      '<h1>Somalia\'s commodities, matched.</h1>' +
      '<p class="sub">A continuous order book for the export and staple trade — livestock for the Gulf, frankincense, sesame and sorghum. Quote on a par-grade basis per delivery point; a better grade clears at a published differential; matched lots settle through escrow with grading at Berbera, Bosaso or the terminal market.</p>' +
      '<div class="idbar"><label class="mono">Trading as</label>' +
        '<input id="xId" value="' + e(RF.identity.get()) + '" placeholder="your name / desk">' +
        '<button class="btn" id="xIdSave">Save</button>' +
        '<a href="activity.html" class="btn ghost">My settlements</a></div>' +
    '</div></section>' +
    '<div class="wrap xwrap"><aside class="xmarkets" id="xmarkets"></aside>' +
      '<section class="xmain" id="xmain"></section></div>';
  document.getElementById("xIdSave").onclick = function () {
    RF.identity.set(document.getElementById("xId").value.trim()); refreshWho(); drawExchange();
  };
  if (!XSEL.marketId) { XSEL.marketId = RF.market.list()[0].id; XSEL.dp = RF.market.list()[0].deliveryPoints[0]; }
  drawExchange();
}

function drawExchange() {
  var M = RF.market;
  var rail = document.getElementById("xmarkets");
  rail.innerHTML = '<div class="k mono">Markets</div>' + M.list().map(function (m) {
    var q = M.quote(m.id);
    var chg = q.changePct || 0;
    return '<button class="xrow' + (m.id === XSEL.marketId ? " on" : "") + '" data-m="' + m.id + '">' +
      '<div class="xr-name">' + e(m.commodity) + '</div>' +
      '<div class="xr-px">' + M.fmtPx(m, q.last) + ' <span class="mono ' + (chg >= 0 ? "px-up" : "px-down") + '">' + (chg >= 0 ? "+" : "") + chg.toFixed(2) + '%</span></div>' +
      '<div class="xr-sub mono">' + m.unitLabel + ' · spread ' + (q.spread != null ? M.fmtPx(m, q.spread) : "—") + '</div>' +
    '</button>';
  }).join("");
  rail.querySelectorAll(".xrow").forEach(function (b) {
    b.onclick = function () {
      XSEL.marketId = b.getAttribute("data-m");
      XSEL.dp = M.marketById(XSEL.marketId).deliveryPoints[0];
      drawExchange();
    };
  });

  var m = M.marketById(XSEL.marketId);
  var gs = M.gradeSystem(m.gradeSystemId);
  if (m.deliveryPoints.indexOf(XSEL.dp) < 0) XSEL.dp = m.deliveryPoints[0];
  var q = M.quote(m.id, XSEL.dp);
  var dep = M.depth(m.id, XSEL.dp, 6);
  var me = RF.identity.get();
  var chg = q.changePct || 0;

  var dpChips = m.deliveryPoints.map(function (d) {
    return '<button class="chip' + (d === XSEL.dp ? " on" : "") + '" data-dp="' + e(d) + '">' + e(d) + '</button>';
  }).join("");

  function ladder(side) {
    var rows = dep[side];
    if (side === "asks") rows = rows.slice().reverse();
    return rows.map(function (l) {
      return '<div class="lvl ' + side + '"><span class="bar" style="width:' + Math.round(100 * l.cum / dep.max) + '%"></span>' +
        '<span class="mono px">' + M.fmtPx(m, l.px) + '</span>' +
        '<span class="mono sz">' + l.lots + '</span><span class="mono cum">' + l.cum + '</span></div>';
    }).join("") || '<div class="lvl empty mono">no ' + side + '</div>';
  }

  var tp = M.tape(m.id, XSEL.dp, 12).map(function (t) {
    var tm = new Date(t.at);
    return '<tr><td class="mono">' + String(tm.getHours()).padStart(2, "0") + ":" + String(tm.getMinutes()).padStart(2, "0") + '</td>' +
      '<td class="mono ' + (t.aggressor === "buy" ? "px-up" : "px-down") + '">' + M.fmtPx(m, t.settlePrice) + '</td>' +
      '<td class="mono">' + t.lots + '</td><td>' + e(M.gradeById(gs, t.deliveredGrade).label.replace(" (par)", "")) + '</td></tr>';
  }).join("");

  var gradeOpts = gs.grades.map(function (g) {
    var s = g.diff === 0 ? "par" : (g.diff > 0 ? "+" : "") + M.fmtPx(m, g.diff);
    return '<option value="' + g.id + '"' + (g.id === gs.parGradeId ? " selected" : "") + '>' + e(g.label) + '  (' + s + ')</option>';
  }).join("");

  var gradeTable = gs.grades.slice().reverse().map(function (g) {
    return '<div class="grow"><span class="mono ' + (g.diff > 0 ? "px-up" : g.diff < 0 ? "px-down" : "") + '">' +
      (g.diff === 0 ? "par" : (g.diff > 0 ? "+" : "") + M.fmtPx(m, g.diff)) + '</span>' +
      '<span><b>' + e(g.label) + '</b><br><span class="gspec">' + e(g.spec) + '</span></span></div>';
  }).join("");

  var mine = me ? M.myOrders(me, m.id).filter(function (o) { return o.status === "open" || o.status === "partial"; }) : [];

  document.getElementById("xmain").innerHTML =
    '<div class="xhead"><div><h2>' + e(m.name) + '</h2>' +
      '<div class="mono" style="color:var(--faint)">' + e(gs.label) + ' · ' + m.lotLabel + ' lot · tick ' + M.fmtPx(m, m.tick) + ' ' + m.unitLabel + '</div>' +
      '<div class="cats" style="margin-top:10px">' + dpChips + '</div></div>' +
      '<div class="xstat"><div class="big">' + M.fmtPx(m, q.last) + ' <span class="mono">' + m.unitLabel + '</span></div>' +
        '<div class="mono ' + (chg >= 0 ? "px-up" : "px-down") + '">' + (chg >= 0 ? "▲ " : "▼ ") + Math.abs(chg).toFixed(2) + '% session</div>' +
        '<div class="mono" style="color:var(--faint)">bid ' + M.fmtPx(m, q.bestBid) + ' · ask ' + M.fmtPx(m, q.bestAsk) +
          ' · range ' + M.fmtPx(m, q.dayLow) + "–" + M.fmtPx(m, q.dayHigh) + ' · vol ' + q.volume + ' lots</div></div>' +
    '</div>' +

    '<div class="xgrid">' +
      '<div class="book"><div class="bookhead mono"><span>Price (par)</span><span>Lots</span><span>Cum</span></div>' +
        ladder("asks") +
        '<div class="midrow mono">spread ' + (q.spread != null ? M.fmtPx(m, q.spread) : "—") + ' · mid ' + M.fmtPx(m, q.mid) + '</div>' +
        ladder("bids") +
      '</div>' +

      '<div class="xside">' +
        '<div class="ticket">' +
          '<div class="sidetoggle"><button class="' + (XSEL.side === "buy" ? "on" : "") + '" data-side="buy">Buy</button>' +
            '<button class="' + (XSEL.side === "sell" ? "on" : "") + '" data-side="sell">Sell</button></div>' +
          '<label class="mono">Grade</label><select id="tGrade">' + gradeOpts + '</select>' +
          '<label class="mono">Delivery</label><select id="tDp">' + m.deliveryPoints.map(function (d) {
            return '<option' + (d === XSEL.dp ? " selected" : "") + '>' + e(d) + '</option>'; }).join("") + '</select>' +
          '<div class="trow"><div><label class="mono">Lots</label><input id="tLots" type="number" min="1" value="1"></div>' +
            '<div><label class="mono">Limit (' + m.unitLabel + ')</label><input id="tLimit" type="number" step="' + m.tick + '" value="' + M.fmtPx(m, XSEL.side === "buy" ? (q.bestAsk || q.last) : (q.bestBid || q.last)) + '"></div></div>' +
          '<button class="btn ghost xbtn-sm" id="tCross">Take best ' + (XSEL.side === "buy" ? "offer" : "bid") + '</button>' +
          '<div class="tcalc mono" id="tCalc"></div>' +
          '<button class="btn" id="tSubmit">Place ' + XSEL.side + ' order</button>' +
          '<p class="tnote mono">Fills print at the resting order\'s par price; the delivered grade\'s differential is added on settlement.</p>' +
        '</div>' +
        '<div class="tape"><div class="k mono">Recent prints — ' + e(XSEL.dp) + '</div>' +
          '<table><thead><tr><th>Time</th><th>Px</th><th>Lots</th><th>Grade</th></tr></thead><tbody>' + (tp || '<tr><td colspan="4" class="mono">no prints</td></tr>') + '</tbody></table></div>' +
      '</div>' +
    '</div>' +

    '<div class="xgrid2">' +
      '<div class="gtable"><div class="k mono">Deliverable grades &amp; differentials — ' + m.unitLabel + '</div>' + gradeTable + '</div>' +
      '<div class="myorders"><div class="k mono">Your working orders</div>' +
        (mine.length ? mine.map(function (o) {
          return '<div class="oorow"><span class="mono ' + (o.side === "buy" ? "px-up" : "px-down") + '">' + o.side.toUpperCase() + '</span>' +
            '<span>' + M.remaining(o) + '/' + o.lots + ' lots · ' + e(M.gradeById(gs, o.gradeId).label.replace(" (par)", "")) + ' · ' + e(o.deliveryPoint) + '</span>' +
            '<span class="mono">@ ' + M.fmtPx(m, o.limit) + ' (par ' + M.fmtPx(m, o.parLimit) + ')</span>' +
            '<button class="wedit" data-cancel="' + o.id + '">cancel</button></div>';
        }).join("") : '<p class="mono" style="color:var(--faint);padding:6px 0">' + (me ? "No working orders in this market." : "Set your name to trade.") + '</p>') +
      '</div>' +
    '</div>';

  var main = document.getElementById("xmain");
  main.querySelectorAll("[data-dp]").forEach(function (b) { b.onclick = function () { XSEL.dp = b.getAttribute("data-dp"); drawExchange(); }; });
  main.querySelectorAll("[data-side]").forEach(function (b) { b.onclick = function () { XSEL.side = b.getAttribute("data-side"); drawExchange(); }; });
  main.querySelectorAll("[data-cancel]").forEach(function (b) {
    b.onclick = function () { var r = RF.market.cancelOrder(b.getAttribute("data-cancel")); toast(r.error || "Order cancelled."); drawExchange(); };
  });
  var gEl = main.querySelector("#tGrade"), lEl = main.querySelector("#tLimit"), qEl = main.querySelector("#tLots"), dEl = main.querySelector("#tDp");
  function recalc() {
    var g = M.gradeById(gs, gEl.value);
    var lots = Math.max(1, Math.floor(+qEl.value || 1));
    var lim = +lEl.value || 0;
    var par = M.clampTick(m, lim - g.diff);
    var val = lots * m.lotSize * lim;
    main.querySelector("#tCalc").innerHTML =
      "par-equivalent " + M.fmtPx(m, par) + " " + m.unitLabel +
      " · " + lots + " × " + m.lotLabel + " = " + lots * m.lotSize + " " + m.unitShort +
      " · order value ≈ " + m.currency + " " + Math.round(val).toLocaleString();
  }
  [gEl, lEl, qEl].forEach(function (el) { el.oninput = recalc; el.onchange = recalc; });
  recalc();
  main.querySelector("#tCross").onclick = function () {
    var g = M.gradeById(gs, gEl.value);
    var base = XSEL.side === "buy" ? q.bestAsk : q.bestBid;
    if (base == null) { toast("No resting " + (XSEL.side === "buy" ? "offer" : "bid") + " to take."); return; }
    lEl.value = M.fmtPx(m, base + g.diff);
    recalc();
  };
  main.querySelector("#tSubmit").onclick = function () {
    var r = RF.market.submitOrder({
      marketId: m.id, side: XSEL.side, gradeId: gEl.value, deliveryPoint: dEl.value,
      lots: qEl.value, limit: lEl.value, trader: RF.identity.get()
    });
    if (r.error) { toast(r.error); return; }
    if (r.filled > 0) {
      var verb = XSEL.side === "buy" ? "Bought " : "Sold ";
      toast(verb + r.filled + " lot" + (r.filled > 1 ? "s" : "") + " · avg " + M.fmtPx(m, r.vwap) + " " + m.unitLabel +
        (r.resting ? " · " + r.resting + " resting" : "") + " · " + r.settlements.length + " settlement" + (r.settlements.length > 1 ? "s" : "") + " started");
    } else {
      toast("Order resting — " + r.resting + " lot" + (r.resting > 1 ? "s" : "") + " on the book.");
    }
    drawExchange();
  };
}

/* ---------------------------------------------------------------- B2B marketplace */
var BSEL = { kind: "good", cat: null, q: "", tab: "catalogue" };

function b2bPage() {
  RF.b2b.ensureSeed();
  var app = document.getElementById("app");
  var me = RF.identity.get();
  app.innerHTML =
    '<section class="hero sm"><div class="wrap"><p class="mono type eyebrow">B2B Exchange</p>' +
      '<h1>Business supply, Garsoored.</h1>' +
      '<p class="sub">Wholesale goods and services from verified suppliers. Buy off the catalogue or post an RFQ; funds sit in your wallet in escrow until the order is received. Standardised graded goods list straight onto the commodity order book.</p>' +
      '<div class="idbar"><label class="mono">Your business</label>' +
        '<input id="bId" value="' + e(me) + '" placeholder="business name">' +
        '<button class="btn" id="bIdSave">Save</button>' +
        '<a href="activity.html" class="btn ghost">Orders &amp; wallet</a></div>' +
    '</div></section>' +
    '<div class="wrap b2bwrap">' +
      '<div class="b2btabs" id="b2btabs">' +
        '<button data-tab="catalogue"' + (BSEL.tab === "catalogue" ? ' class="on"' : "") + '>Catalogue</button>' +
        '<button data-tab="rfq"' + (BSEL.tab === "rfq" ? ' class="on"' : "") + '>RFQs</button>' +
        '<button data-tab="prices"' + (BSEL.tab === "prices" ? ' class="on"' : "") + '>Commodity prices</button>' +
      '</div>' +
      '<div id="b2bbody"></div>' +
    '</div>';
  document.getElementById("bIdSave").onclick = function () {
    RF.identity.set(document.getElementById("bId").value.trim()); refreshWho(); b2bPage();
  };
  document.querySelectorAll("#b2btabs button").forEach(function (b) {
    b.onclick = function () { BSEL.tab = b.getAttribute("data-tab"); b2bPage(); };
  });
  if (BSEL.tab === "catalogue") b2bCatalogue();
  else if (BSEL.tab === "rfq") b2bRfq();
  else b2bPrices();
}

function b2bCatalogue() {
  var body = document.getElementById("b2bbody");
  var cats = BSEL.kind === "good" ? RF.b2b.GOODS_CATS : RF.b2b.SERVICE_CATS;
  body.innerHTML =
    '<div class="b2bctrl">' +
      '<div class="sidetoggle b2btoggle"><button class="' + (BSEL.kind === "good" ? "on" : "") + '" data-k="good">Goods</button>' +
        '<button class="' + (BSEL.kind === "service" ? "on" : "") + '" data-k="service">Services</button></div>' +
      '<input id="bq" class="b2bsearch" type="text" placeholder="Search catalogue…" value="' + e(BSEL.q) + '">' +
      '<button class="btn" id="bRfqNew">Post an RFQ</button>' +
    '</div>' +
    '<div class="chiplist b2bchips" id="bchips"><button class="chip' + (BSEL.cat ? "" : " on") + '" data-c="">All</button>' +
      cats.map(function (c) { return '<button class="chip' + (BSEL.cat === c ? " on" : "") + '" data-c="' + e(c) + '">' + e(c) + '</button>'; }).join("") + '</div>' +
    '<div class="b2bgrid" id="bgrid"></div>';

  body.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { BSEL.kind = b.getAttribute("data-k"); BSEL.cat = null; b2bCatalogue(); }; });
  body.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { BSEL.cat = b.getAttribute("data-c") || null; renderBGrid(); }; });
  var bq = body.querySelector("#bq");
  bq.oninput = function () { BSEL.q = bq.value; renderBGrid(); };
  body.querySelector("#bRfqNew").onclick = openRfqModal;
  renderBGrid();
}
function renderBGrid() {
  var rows = RF.b2b.catalogue.find(BSEL.kind, BSEL.cat, BSEL.q);
  var grid = document.getElementById("bgrid");
  document.querySelectorAll("#bchips .chip").forEach(function (c) {
    c.classList.toggle("on", (c.getAttribute("data-c") || null) === BSEL.cat);
  });
  if (!rows.length) { grid.innerHTML = '<p class="empty" style="padding:40px 0">Nothing in the catalogue matches.</p>'; return; }
  grid.innerHTML = rows.map(function (o) {
    var priced = o.unitPrice > 0;
    return '<div class="ocard" data-id="' + o.id + '">' +
      '<div class="head"><span class="mono type">' + e(o.category) + '</span>' +
        (o.verified ? '<span class="badge solid">' + TICK + ' Verified</span>' : '<span class="badge">Unverified</span>') +
        (o.standardized ? '<span class="badge">Exchange-listable</span>' : "") + '</div>' +
      '<h3>' + e(o.name) + '</h3>' +
      '<div class="org">' + e(o.supplier) + ' · ★ ' + o.rating + (o.origin ? ' · ' + e(o.origin) : "") + '</div>' +
      '<div class="desc">' + e(o.spec) + '</div>' +
      '<div class="facts mono">' +
        (priced ? '<span>' + RF.b2b.money(o.unitPrice) + ' / ' + e(o.unit) + '</span>' : '<span>Price on RFQ</span>') +
        '<span>MOQ ' + o.moq + ' ' + e(o.unit) + '</span>' +
        (o.availableQty != null ? '<span>' + o.availableQty.toLocaleString() + ' available</span>' : '<span>Capacity-based</span>') +
        (o.warehouse ? '<span>' + e(o.warehouse) + '</span>' : "") +
        '<span>Lead ' + o.leadDays + ' d</span></div>' +
    '</div>';
  }).join("");
  grid.querySelectorAll(".ocard").forEach(function (c) { c.onclick = function () { openOfferDrawer(c.getAttribute("data-id")); }; });
}

function openOfferDrawer(id) {
  var o = RF.b2b.catalogue.get(id);
  if (!o) return;
  var priced = o.unitPrice > 0;
  var std = RF.b2b.isStandardized(o);
  document.getElementById("dhead").innerHTML =
    '<span class="mono type">' + LABEL.b2b + ' · ' + e(o.category) + '</span>' +
    '<h2>' + e(o.name) + '</h2>' +
    '<div class="org" style="color:var(--muted)">' + e(o.supplier) + ' · ★ ' + o.rating + '</div>' +
    '<div class="head" style="margin-top:12px">' +
      (o.verified ? '<span class="badge solid">' + TICK + ' Verified supplier</span>' : '<span class="badge">Unverified</span>') +
      (std ? '<span class="badge">Exchange-listable</span>' : "") + '</div>';
  var minQ = o.moq || 1;
  document.getElementById("dbody").innerHTML =
    '<p style="color:var(--muted)">' + e(o.spec) + '</p>' +
    '<dl class="kv">' +
      '<dt>' + (o.kind === "good" ? "Unit price" : "Rate") + '</dt><dd>' + (priced ? RF.b2b.money(o.unitPrice) + ' / ' + e(o.unit) : "Quote only") + '</dd>' +
      '<dt>Minimum order</dt><dd>' + minQ + ' ' + e(o.unit) + '</dd>' +
      (o.availableQty != null ? '<dt>Available</dt><dd>' + o.availableQty.toLocaleString() + ' ' + e(o.unit) + '</dd>' : "") +
      (o.origin ? '<dt>Origin</dt><dd>' + e(o.origin) + '</dd>' : "") +
      (o.incoterm ? '<dt>Terms</dt><dd>' + e(o.incoterm) + '</dd>' : "") +
      (o.warehouse ? '<dt>Warehouse</dt><dd>' + e(o.warehouse) + '</dd>' : "") +
      (std ? '<dt>Grade</dt><dd>' + e((RF.b2b.STD[o.commodity].grades.filter(function (g) { return g.id === o.grade; })[0] || {}).label || o.grade) + '</dd>' : "") +
      '<dt>Lead time</dt><dd>' + o.leadDays + ' days</dd>' +
    '</dl>' +
    (priced
      ? '<div class="trust"><div class="k mono">Place an order</div>' +
          '<label class="mono" style="display:block;color:var(--faint);margin-bottom:4px">Quantity (' + e(o.unit) + ')</label>' +
          '<input id="bOrderQty" type="number" min="' + minQ + '" value="' + minQ + '" style="width:100%;border:1px solid var(--line);background:transparent;padding:10px 12px;border-radius:var(--r);font-size:14px">' +
          '<div class="tcalc mono" id="bOrderCalc" style="margin:10px 0"></div>' +
          '<div class="dactions"><button class="btn" id="bOrderBtn">Place order</button>' +
            '<button class="btn ghost" id="bQuoteBtn">Request custom quote</button></div></div>'
      : '<div class="dactions"><button class="btn" id="bQuoteBtn">Request a quote</button></div>') +
    (std ? '<div class="trust"><div class="k mono">Exchange</div>' +
        '<p style="font-size:13px;color:var(--muted)">This is a standardised, graded, warehouse-backed good. The supplier can post it as a live offer on the ' +
        e(o.commodity) + ' warehouse-receipt order book.</p>' +
        '<button class="btn ghost" id="bPromoteBtn" style="margin-top:10px">List ' + (o.availableQty || minQ) + ' ' + e(o.unitShort || o.unit) + ' as an ask</button></div>' : "");

  var qEl = document.getElementById("bOrderQty");
  function calc() {
    var q = Math.max(minQ, +qEl.value || minQ);
    document.getElementById("bOrderCalc").textContent =
      q + " × " + RF.b2b.money(o.unitPrice) + " = " + RF.b2b.money(q * o.unitPrice) + "  (held in wallet escrow on placement)";
  }
  if (qEl) { qEl.oninput = calc; calc(); }
  var ob = document.getElementById("bOrderBtn");
  if (ob) ob.onclick = function () {
    var me = requireBiz(); if (!me) return;
    var r = RF.b2b.orderFromOffer(o.id, +qEl.value, me);
    if (r.error) {
      if (r.need === "topup") { if (confirm(r.error + "\n\nTop up " + RF.b2b.money(r.amount) + " now (demo funds)?")) { RF.b2b.wallet.topUp(me, r.amount); ob.onclick(); } }
      else toast(r.error);
      return;
    }
    closeDrawer(); toast("Order " + r.meta.poNo + " placed · " + RF.b2b.money(r.amount) + " held in escrow. Track it in My activity.");
  };
  var qb = document.getElementById("bQuoteBtn");
  if (qb) qb.onclick = function () { closeDrawer(); openRfqModal(o); };
  var pb = document.getElementById("bPromoteBtn");
  if (pb) pb.onclick = function () {
    var r = RF.b2b.promote(o.id, { side: "sell", lots: (o.availableQty || minQ), limit: o.unitPrice });
    if (r.error) { toast(r.error); return; }
    closeDrawer();
    toast("Listed on the " + o.commodity + " book" + (r.filled ? " · " + r.filled + " lot(s) filled immediately" : " · resting as an ask") + ".");
  };
  document.getElementById("drawer").classList.add("on");
  document.getElementById("scrim").classList.add("on");
}

function b2bRfq() {
  var me = RF.identity.get();
  var body = document.getElementById("b2bbody");
  var mine = RF.b2b.rfqs.forUser(me);
  var open = RF.b2b.rfqs.forUser(null).filter(function (r) { return !me || r.buyer !== me; });
  body.innerHTML =
    '<div class="b2bctrl"><span class="n" style="font-weight:650">Requests for quote</span>' +
      '<button class="btn" id="bRfqNew2">Post an RFQ</button></div>' +
    '<div class="resbar" style="margin-top:8px"><span class="mono" style="color:var(--faint)">YOUR RFQs</span></div>' +
    '<div id="myrfqs"></div>' +
    '<div class="resbar" style="margin-top:32px"><span class="mono" style="color:var(--faint)">OPEN — QUOTE AS A SUPPLIER</span></div>' +
    '<div id="openrfqs"></div>';
  body.querySelector("#bRfqNew2").onclick = openRfqModal;

  document.getElementById("myrfqs").innerHTML = !me ? '<p class="empty" style="padding:20px 0">Set your business name to see your RFQs.</p>'
    : !mine.filter(function (r) { return r.buyer === me; }).length ? '<p class="empty" style="padding:20px 0">You have no RFQs. Post one above.</p>'
    : mine.filter(function (r) { return r.buyer === me; }).map(function (r) { return rfqCard(r, "buyer"); }).join("");
  document.getElementById("openrfqs").innerHTML = !open.length ? '<p class="empty" style="padding:20px 0">No open RFQs right now.</p>'
    : open.map(function (r) { return rfqCard(r, "supplier"); }).join("");
  wireRfqCards(body);
}
function rfqCard(r, view) {
  var qs = r.quotes || [];
  return '<div class="mrow"><div>' +
    '<div class="head"><span class="mono type">RFQ · ' + e(r.category) + '</span>' +
      '<span class="badge">' + (r.status === "open" ? qs.length + " quote" + (qs.length === 1 ? "" : "s") : r.status) + '</span></div>' +
    '<h3>' + e(r.title) + '</h3>' +
    '<div class="org">' + e(r.buyer) + ' · ' + r.qty.toLocaleString() + ' ' + e(r.unit) + ' · to ' + e(r.deliverTo) + ' by ' + e(RF.formatDate(r.neededBy)) + '</div>' +
    '<div class="desc" style="margin-top:6px">' + e(r.spec) + '</div>' +
    (view === "buyer" && qs.length
      ? '<div class="quotes">' + qs.map(function (q) {
          return '<div class="qrow"><span>' + e(q.supplier) + '</span>' +
            '<span class="mono">' + RF.b2b.money(q.unitPrice) + ' / ' + e(r.unit) + ' · ' + q.leadDays + ' d · ' + RF.b2b.money(q.lineTotal) + '</span>' +
            (q.status === "accepted" ? '<span class="badge solid">Accepted</span>'
              : r.status === "open" ? '<button class="btn" data-accept="' + r.id + '|' + q.id + '">Accept</button>' : '<span class="badge">' + q.status + '</span>') +
          '</div>'; }).join("") + '</div>'
      : "") +
    (view === "supplier" && r.status === "open"
      ? '<button class="btn ghost" data-quote="' + r.id + '" style="margin-top:12px">Submit a quote</button>' : "") +
    '</div><div class="rail"></div></div>';
}
function wireRfqCards(root) {
  root.querySelectorAll("[data-accept]").forEach(function (b) {
    b.onclick = function () {
      var p = b.getAttribute("data-accept").split("|");
      var me = requireBiz(); if (!me) return;
      var r = RF.b2b.rfqs.accept(p[0], p[1], me);
      if (r.error) {
        if (r.need === "topup") { if (confirm(r.error + "\n\nTop up " + RF.b2b.money(r.amount) + " now (demo funds)?")) { RF.b2b.wallet.topUp(me, r.amount); b.onclick(); } }
        else toast(r.error);
        return;
      }
      toast("Quote accepted · order " + r.meta.poNo + " created, " + RF.b2b.money(r.amount) + " held in escrow.");
      b2bPage();
    };
  });
  root.querySelectorAll("[data-quote]").forEach(function (b) {
    b.onclick = function () {
      var rfqId = b.getAttribute("data-quote"), r = RF.b2b.rfqs.get(rfqId);
      var me = requireBiz("supplier"); if (!me) return;
      var px = prompt("Your unit price ($ per " + r.unit + "):", "");
      if (px == null || !(+px > 0)) return;
      var lead = prompt("Lead time (days):", "3");
      RF.b2b.rfqs.quote(rfqId, { supplier: me, unitPrice: +px, qty: r.qty, leadDays: +lead || 3, incoterm: r.incoterm, validDays: 7, note: "" });
      toast("Quote submitted to " + r.buyer + ".");
      b2bPage();
    };
  });
}

function openRfqModal(prefillOffer) {
  var kinds = prefillOffer ? [prefillOffer.kind] : ["good", "service"];
  var cats = (prefillOffer ? (prefillOffer.kind === "good" ? RF.b2b.GOODS_CATS : RF.b2b.SERVICE_CATS)
    : RF.b2b.GOODS_CATS.concat(RF.b2b.SERVICE_CATS));
  document.getElementById("modalBox").innerHTML =
    '<div class="mh"><h2>Post an RFQ</h2><button class="close" id="rX">&times;</button></div><div class="mb">' +
    '<p class="wsub">Suppliers see this and send you quotes. Nothing is committed until you accept one.</p>' +
    '<div class="f2"><div class="f"><label class="mono">Type</label><select id="rKind">' +
      kinds.map(function (k) { return '<option value="' + k + '">' + (k === "good" ? "Goods" : "Service") + '</option>'; }).join("") + '</select></div>' +
      '<div class="f"><label class="mono">Category</label><select id="rCat">' + cats.map(function (c) { return '<option>' + e(c) + '</option>'; }).join("") + '</select></div></div>' +
    '<div class="f"><label class="mono">What you need</label><input id="rTitle" value="' + (prefillOffer ? e(prefillOffer.name) : "") + '" placeholder="e.g. White rice, 5% broken, 50 kg bags"></div>' +
    '<div class="f"><label class="mono">Specification / notes</label><textarea id="rSpec" rows="2" placeholder="Quality, packaging, delivery window…"></textarea></div>' +
    '<div class="f2"><div class="f"><label class="mono">Quantity</label><input id="rQty" type="number" min="1" value="' + (prefillOffer ? (prefillOffer.moq || 1) : 100) + '"></div>' +
      '<div class="f"><label class="mono">Unit</label><select id="rUnit">' + RF.b2b.UNITS.map(function (u) { return '<option' + (prefillOffer && prefillOffer.unit === u ? " selected" : "") + '>' + e(u) + '</option>'; }).join("") + '</select></div></div>' +
    '<div class="f2"><div class="f"><label class="mono">Deliver to</label><select id="rTo">' + RF.CITIES.filter(function (c) { return c !== "Remote"; }).map(function (c) { return '<option>' + c + '</option>'; }).join("") + '</select></div>' +
      '<div class="f"><label class="mono">Needed by</label><input id="rBy" type="date"></div></div>' +
    '<div style="display:flex;gap:10px;margin-top:18px"><button class="btn ghost" id="rCancel" style="flex:1;padding:11px">Cancel</button>' +
      '<button class="btn" id="rSubmit" style="flex:1;padding:11px">Post RFQ</button></div></div>';
  document.getElementById("modal").classList.add("on");
  if (prefillOffer) document.getElementById("rKind").value = prefillOffer.kind;
  document.getElementById("rKind").onchange = function () {
    var k = this.value, cs = k === "good" ? RF.b2b.GOODS_CATS : RF.b2b.SERVICE_CATS;
    document.getElementById("rCat").innerHTML = cs.map(function (c) { return '<option>' + e(c) + '</option>'; }).join("");
  };
  document.getElementById("rX").onclick = closeModal;
  document.getElementById("rCancel").onclick = closeModal;
  document.getElementById("rSubmit").onclick = function () {
    var me = requireBiz(); if (!me) return;
    var title = document.getElementById("rTitle").value.trim();
    if (!title) { toast("Say what you need."); return; }
    RF.b2b.rfqs.post({
      buyer: me, kind: document.getElementById("rKind").value, category: document.getElementById("rCat").value,
      title: title, spec: document.getElementById("rSpec").value.trim(),
      qty: +document.getElementById("rQty").value || 1, unit: document.getElementById("rUnit").value,
      deliverTo: document.getElementById("rTo").value, neededBy: document.getElementById("rBy").value || "2026-10-01",
      incoterm: "DAP (buyer site)", warehouse: ""
    });
    closeModal(); toast("RFQ posted. Suppliers can now quote."); BSEL.tab = "rfq"; b2bPage();
  };
}

function b2bPrices() {
  var body = document.getElementById("b2bbody");
  var q = RF.b2b.commodityQuotes();
  body.innerHTML =
    '<p class="wsub" style="margin:4px 0 18px">Standardised, warehouse-backed goods traded on a live order book. A supplier "lists" stock from the catalogue; buyers hit the bid or lift the ask. Settlement, grading and escrow run on the same engine as the commodity exchange.</p>' +
    '<div class="pxtable"><div class="pxhead mono"><span>Commodity</span><span>Bid</span><span>Ask</span><span>Last</span><span>Vol</span><span></span></div>' +
    q.map(function (x) {
      if (!x.listed) return '<div class="pxrow"><span>' + e(x.commodity) + '</span><span class="mono" colspan>—</span><span class="mono">—</span><span class="mono">—</span><span class="mono">—</span>' +
        '<span class="mono" style="color:var(--faint)">no listings yet</span></div>';
      var m = RF.market.marketById(x.marketId);
      return '<div class="pxrow"><span>' + e(x.commodity) + ' <span class="mono" style="color:var(--faint)">' + x.unitLabel + '</span></span>' +
        '<span class="mono px-up">' + RF.market.fmtPx(m, x.bid) + '</span>' +
        '<span class="mono px-down">' + RF.market.fmtPx(m, x.ask) + '</span>' +
        '<span class="mono">' + RF.market.fmtPx(m, x.last) + '</span>' +
        '<span class="mono">' + x.vol + '</span>' +
        '<a class="mono" style="text-decoration:underline" href="exchange.html">open book →</a></div>';
    }).join("") + '</div>' +
    '<p class="tnote mono" style="margin-top:16px">This is the seam to Phase 3: RFQ → Quotes → Orders → Standardisation → Warehouse receipt → Bid/Ask. Same database, no rebuild.</p>';
}

function requireBiz(role) {
  var me = RF.identity.get();
  if (me) return me;
  me = (prompt((role === "supplier" ? "Your supplier / business name:" : "Your business name (used on orders and your wallet):"), "") || "").trim();
  if (!me) return null;
  RF.identity.set(me); refreshWho();
  return me;
}

/* ---------------------------------------------------------------- generic on-rails wizard */
function railResolveOpts(f, values) {
  var o = typeof f.options === "function" ? f.options(values) : (f.options || []);
  return o.map(function (x) { return typeof x === "object" ? x : { value: x, label: x }; });
}
function railControl(f, val, values) {
  if (f.type === "enum") {
    return '<select id="rwCtl"><option value="">—</option>' + railResolveOpts(f, values).map(function (o) {
      return '<option value="' + e(o.value) + '"' + (val === o.value ? " selected" : "") + '>' + e(o.label) + '</option>';
    }).join("") + '</select>';
  }
  if (f.type === "bool") {
    return '<div class="wbool"><label><input type="radio" name="rwCtl" value="true"' + (val === true ? " checked" : "") + '> Yes</label>' +
      '<label><input type="radio" name="rwCtl" value="false"' + (val === false ? " checked" : "") + '> No</label></div>';
  }
  if (f.type === "textarea") return '<textarea id="rwCtl" rows="3">' + e(val || "") + '</textarea>';
  if (f.type === "money" || f.type === "number") return '<input id="rwCtl" type="number" inputmode="decimal" value="' + (val != null ? e(val) : "") + '">';
  if (f.type === "date") return '<input id="rwCtl" type="date" value="' + e(val || "") + '">';
  return '<input id="rwCtl" type="text" value="' + e(val || "") + '"' + (f.placeholder ? ' placeholder="' + e(f.placeholder) + '"' : "") + '>';
}
function railRead(f, box) {
  if (f.type === "bool") { var c = box.querySelector('input[name=rwCtl]:checked'); return c ? c.value === "true" : undefined; }
  var el = box.querySelector("#rwCtl"); if (!el) return undefined;
  var v = el.value.trim(); if (v === "") return undefined;
  if (f.type === "money" || f.type === "number") return parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return v;
}
function railWizard(opts) {
  var w = new RF.Wizard(null, opts.fields);
  document.getElementById("modal").classList.add("on");
  function render() {
    var box = document.getElementById("modalBox");
    setTimeout(function () { var x = box.querySelector("#wX"); if (x) x.onclick = closeModal; }, 0);
    if (w.stage === "fields") {
      var f = w.current();
      if (!f) { w.stage = "review"; render(); return; }
      var p = w.progress();
      box.innerHTML = wizShell(opts.title, opts.subtitle && !w.history.length ? opts.subtitle : "",
        '<div class="wprog"><i style="width:' + p.pct + '%"></i></div>' +
        '<div class="wq"><label>' + e(f.label) + (f.required ? ' <span class="req">required</span>' : "") + '</label>' +
        (f.help ? '<p class="whelp">' + e(f.help) + '</p>' : "") +
        railControl(f, w.values[f.id], w.values) + '</div>' +
        '<div class="wrow"><button class="btn ghost" id="rwBack"' + (w.history.length ? "" : " disabled") + '>Back</button>' +
        (f.required ? "" : '<button class="btn ghost" id="rwSkip">Skip</button>') +
        '<button class="btn" id="rwNext">Continue</button></div>', true);
      var ctl = box.querySelector("#rwCtl");
      box.querySelector("#rwNext").onclick = function () {
        var val = railRead(f, box);
        if (f.required && (val === "" || val == null)) { if (ctl) ctl.classList.add("err"); return; }
        w.set(f.id, val);
        w.stage = w.current() ? "fields" : "review";
        render();
      };
      if (box.querySelector("#rwSkip")) box.querySelector("#rwSkip").onclick = function () { w.skip(); w.stage = w.current() ? "fields" : "review"; render(); };
      box.querySelector("#rwBack").onclick = function () { w.back(); render(); };
      if (ctl) ctl.onkeydown = function (ev) { if (ev.key === "Enter" && f.type !== "textarea") { ev.preventDefault(); box.querySelector("#rwNext").click(); } };
      if (ctl && ctl.focus) try { ctl.focus(); } catch (x) {}
      return;
    }
    // review
    var vals = w.values, missing = w.missingRequired();
    var rows = RF.relevantFieldsFrom(opts.fields, vals).filter(function (fl) { return vals[fl.id] !== undefined; }).map(function (fl) {
      var v = vals[fl.id];
      if (typeof v === "boolean") v = v ? "Yes" : "No";
      else if (fl.type === "money") v = RF.money(v);
      else if (fl.type === "enum") { var o = railResolveOpts(fl, vals).filter(function (x) { return x.value === v; })[0]; if (o) v = o.label; }
      return '<dt>' + e(fl.label) + '</dt><dd>' + e(v) + '<button class="wedit" data-f="' + fl.id + '">edit</button></dd>';
    }).join("");
    box.innerHTML = wizShell(opts.title, "",
      (missing.length ? '<div class="note err">Still required: ' + missing.map(function (m) { return e(m.label); }).join(", ") + '</div>' : "") +
      '<dl class="kv wreview">' + rows + '</dl>' +
      (opts.reviewNote ? '<div class="note">' + e(opts.reviewNote) + '</div>' : "") +
      '<div class="wrow"><button class="btn ghost" id="rwBack2">Back</button>' +
      '<button class="btn" id="rwSubmit"' + (missing.length ? " disabled" : "") + '>' + e(opts.submitLabel || "Submit") + '</button></div>', true);
    box.querySelectorAll(".wedit").forEach(function (b) {
      b.onclick = function () { var id = b.getAttribute("data-f"); w._snapshot(); delete w.values[id]; delete w.skipped[id]; w.stage = "fields"; render(); };
    });
    box.querySelector("#rwBack2").onclick = function () { w.back(); render(); };
    var sb = box.querySelector("#rwSubmit");
    if (sb && !missing.length) sb.onclick = function () { closeModal(); opts.onDone(w.values); };
  }
  render();
}

/* ---------------------------------------------------------------- Logistics board */
var GSEL = { tab: "loads", mode: "Land" };

function logiPage() {
  RF.logi.ensureSeed();
  if (window.RF.b2b) RF.b2b.ensureSeed();
  var app = document.getElementById("app");
  var me = RF.identity.get();
  app.innerHTML =
    '<section class="hero sm"><div class="wrap"><p class="mono type eyebrow">Logistics</p>' +
      '<h1>Just move it.</h1>' +
      '<p class="sub">Air cargo, domestic sea routes and land corridors on one board. Tell us what to move and where — we run it against posted capacity on the lane and come back with real rates and transit times. Booking, documents and payment are held on rails.</p>' +
      '<div class="jmi"><button class="btn jmi-btn" id="jmiBtn">🚚 &nbsp;Just move it</button>' +
        '<button class="btn ghost" id="capBtn">I\'m a carrier — post capacity</button>' +
        '<a href="activity.html" class="btn ghost">My bookings</a></div>' +
      '<div class="idbar" style="margin-top:14px"><label class="mono">You are</label>' +
        '<input id="gId" value="' + e(me) + '" placeholder="shipper / carrier / coordinator name">' +
        '<button class="btn" id="gIdSave">Save</button></div>' +
    '</div></section>' +
    '<div class="wrap b2bwrap"><div class="b2btabs" id="gtabs">' +
      '<button data-tab="loads"' + (GSEL.tab === "loads" ? ' class="on"' : "") + '>Open loads</button>' +
      '<button data-tab="lanes"' + (GSEL.tab === "lanes" ? ' class="on"' : "") + '>Lane board</button>' +
      '<button data-tab="mine"' + (GSEL.tab === "mine" ? ' class="on"' : "") + '>My shipments</button>' +
    '</div><div id="gbody"></div></div>';

  document.getElementById("jmiBtn").onclick = openJustMoveIt;
  document.getElementById("capBtn").onclick = openPostCapacity;
  document.getElementById("gIdSave").onclick = function () { RF.identity.set(document.getElementById("gId").value.trim()); refreshWho(); logiPage(); };
  document.querySelectorAll("#gtabs button").forEach(function (b) { b.onclick = function () { GSEL.tab = b.getAttribute("data-tab"); logiPage(); }; });

  if (GSEL.tab === "loads") logiLoads();
  else if (GSEL.tab === "lanes") logiLanes();
  else logiMine();
}

function modeIcon(m) { return m === "Air" ? "✈" : m === "Sea" ? "⚓" : "🚚"; }

function logiLanes() {
  var body = document.getElementById("gbody");
  body.innerHTML =
    '<div class="sidetoggle b2btoggle" id="gmode" style="max-width:280px;margin-bottom:16px">' +
      RF.logi.MODES.map(function (m) { return '<button class="' + (GSEL.mode === m ? "on" : "") + '" data-m="' + m + '">' + modeIcon(m) + ' ' + m + '</button>'; }).join("") + '</div>' +
    '<div id="lanelist"></div>';
  body.querySelectorAll("#gmode button").forEach(function (b) { b.onclick = function () { GSEL.mode = b.getAttribute("data-m"); logiLanes(); }; });
  var lanes = RF.logi.lanesForMode(GSEL.mode);
  document.getElementById("lanelist").innerHTML = lanes.map(function (l) {
    var caps = RF.logi.capacity({ laneId: l.id }).filter(function (c) { return c.available > 0 && c.status !== "closed"; });
    return '<div class="lane"><div class="lane-h"><b>' + e(RF.logi.laneLabel(l)) + '</b>' +
      '<span class="mono" style="color:var(--faint)">' + (l.transitHrs >= 24 ? Math.round(l.transitHrs / 24) + " d" : l.transitHrs + " h") + ' · ' + e(l.freq) + (l.note ? ' · ' + e(l.note) : "") + '</span></div>' +
      (caps.length ? '<div class="lane-caps">' + caps.map(function (c) {
        return '<div class="capr"><span>' + e(c.carrier) + (c.verified ? ' ' + TICK : "") + '</span>' +
          '<span class="mono">' + e(c.service) + ' · ' + e(c.equipment) + '</span>' +
          '<span class="mono">dep ' + e(RF.formatDate(c.depart)) + ' · ' + Math.round(c.transitHrs) + ' h</span>' +
          '<span class="mono">' + RF.logi.money(c.rate) + ' ' + c.rateBasis + (c.minCharge ? ' · min ' + RF.logi.money(c.minCharge) : "") + '</span>' +
          '<span class="mono" style="color:var(--faint)">' + c.available + ' ' + c.rateBasis.replace("$/", "") + ' left</span></div>';
      }).join("") + '</div>' : '<div class="lane-caps mono" style="color:var(--faint);padding:8px 0">no capacity posted — post yours or broadcast a load</div>') +
    '</div>';
  }).join("");
}

function logiLoads() {
  var body = document.getElementById("gbody");
  var me = RF.identity.get();
  var loads = RF.logi.shipments().filter(function (s) { return !me || s.shipper !== me; });
  body.innerHTML = '<p class="wsub" style="margin:4px 0 16px">Open shipments looking for capacity. As a carrier or coordinator, offer against a matching lane.</p>' +
    (loads.length ? loads.map(loadCard).join("") : '<p class="empty" style="padding:40px 0">No open loads right now.</p>');
  body.querySelectorAll("[data-load]").forEach(function (b) { b.onclick = function () { openLoadMatch(b.getAttribute("data-load")); }; });
}
function loadCard(s) {
  return '<div class="mrow"><div><div class="head"><span class="mono type">' + modeIcon(s.mode === "Cheapest" || s.mode === "Fastest" ? "Land" : s.mode) + ' ' + e(s.mode) + '</span>' +
    '<span class="badge">' + e(s.handling) + '</span></div>' +
    '<h3>' + e(RF.logi.airName(s.from)) + ' → ' + e(RF.logi.airName(s.to)) + '</h3>' +
    '<div class="org">' + e(s.shipper) + ' · ' + e(s.cargo) + '</div>' +
    '<div class="facts mono"><span>' + s.weightKg.toLocaleString() + ' kg</span><span>' + s.volumeM3 + ' m³</span>' +
      '<span>' + e(s.packaging) + '</span><span>ready ' + e(RF.formatDate(s.ready)) + '</span><span>by ' + e(RF.formatDate(s.deliverBy)) + '</span></div></div>' +
    '<div class="rail"><button class="btn ghost" data-load="' + s.id + '">See matches</button></div></div>';
}

function logiMine() {
  var me = RF.identity.get();
  var body = document.getElementById("gbody");
  if (!me) { body.innerHTML = '<p class="empty" style="padding:40px 0">Set your name to see your shipments and bookings.</p>'; return; }
  var mine = RF.logi.shipments(me);
  var bkgs = RF.logi.bookings(me);
  body.innerHTML =
    '<div class="resbar"><span class="n">Your shipments</span><span class="mono" style="color:var(--faint)">' + mine.length + '</span></div>' +
    (mine.length ? mine.map(function (s) {
      var matches = s.status === "open" ? RF.logi.match(s) : [];
      return '<div class="mrow"><div><div class="head"><span class="mono type">' + modeIcon(s.mode === "Cheapest" || s.mode === "Fastest" ? "Land" : s.mode) + ' ' + e(s.mode) + '</span>' +
        '<span class="badge">' + e(s.status) + '</span></div>' +
        '<h3>' + e(RF.logi.airName(s.from)) + ' → ' + e(RF.logi.airName(s.to)) + '</h3>' +
        '<div class="org">' + e(s.cargo) + ' · ' + s.weightKg.toLocaleString() + ' kg · ' + s.volumeM3 + ' m³</div></div>' +
        '<div class="rail">' + (s.status === "open"
          ? '<button class="btn" data-load="' + s.id + '">' + matches.length + ' match' + (matches.length === 1 ? "" : "es") + '</button>'
          : '<span class="badge solid">Booked</span>') + '</div></div>';
    }).join("") : '<p class="empty" style="padding:20px 0">No shipments yet — press <b>Just move it</b>.</p>') +
    '<div class="resbar" style="margin-top:36px"><span class="n">Your bookings</span><span class="mono" style="color:var(--faint)">' + bkgs.length + '</span></div>' +
    '<p class="mono" style="color:var(--faint);font-size:12px;margin-top:6px">Full booking tracking is on the <a href="activity.html" style="text-decoration:underline">My activity</a> page.</p>';
  body.querySelectorAll("[data-load]").forEach(function (b) { b.onclick = function () { openLoadMatch(b.getAttribute("data-load")); }; });
}

function openJustMoveIt() {
  railWizard({
    title: "Just move it", subtitle: "A few quick questions. Nothing is booked — you'll see rates first.",
    fields: RF.logi.SHIP_FIELDS, submitLabel: "Get rates",
    reviewNote: "We'll match this against posted capacity on the lane and hold the cargo value in escrow only when you book.",
    onDone: function (v) {
      var me = requireBiz(); if (!me) return;
      var s = RF.logi.createShipment(v, me);
      if (s.error) { toast(s.error); return; }
      GSEL.tab = "mine";
      openLoadMatch(s.id);
    }
  });
}
function openPostCapacity() {
  railWizard({
    title: "Post capacity", subtitle: "List space on a fixed lane. Shippers book against it directly.",
    fields: RF.logi.CAP_FIELDS, submitLabel: "Post to the lane board",
    onDone: function (v) {
      var me = requireBiz("supplier"); if (!me) return;
      var c = RF.logi.postCapacity(v, me);
      if (c.error) { toast(c.error); return; }
      toast("Capacity posted to " + RF.logi.laneLabel(RF.logi.laneById(v.laneId)) + ".");
      GSEL.tab = "lanes"; GSEL.mode = v.mode; logiPage();
    }
  });
}

function openLoadMatch(shipmentId) {
  var s = RF.logi.shipments().filter(function (x) { return x.id === shipmentId; })[0]
    || RF.logi.shipments(RF.identity.get()).filter(function (x) { return x.id === shipmentId; })[0];
  if (!s) { toast("Shipment not found."); return; }
  var matches = s.status === "open" ? RF.logi.match(s) : [];
  document.getElementById("dhead").innerHTML =
    '<span class="mono type">' + LABEL.logi + ' · ' + modeIcon(s.mode === "Cheapest" || s.mode === "Fastest" ? "Land" : s.mode) + ' ' + e(s.mode) + '</span>' +
    '<h2>' + e(RF.logi.airName(s.from)) + ' → ' + e(RF.logi.airName(s.to)) + '</h2>' +
    '<div class="org" style="color:var(--muted)">' + e(s.cargo) + '</div>' +
    '<div class="head" style="margin-top:12px"><span class="badge">' + s.weightKg.toLocaleString() + ' kg</span>' +
      '<span class="badge">' + s.volumeM3 + ' m³</span><span class="badge">' + e(s.packaging) + '</span>' +
      (s.handling !== "None" ? '<span class="badge">' + e(s.handling) + '</span>' : "") + '</div>';
  document.getElementById("dbody").innerHTML =
    '<dl class="kv"><dt>Ready</dt><dd>' + e(RF.formatDate(s.ready)) + '</dd><dt>Needed by</dt><dd>' + e(RF.formatDate(s.deliverBy)) + '</dd>' +
      (s.value ? '<dt>Cargo value</dt><dd>' + RF.money(s.value) + '</dd>' : "") +
      (s.tempC != null ? '<dt>Temperature</dt><dd>' + s.tempC + ' °C</dd>' : "") + '<dt>Service</dt><dd>' + e(s.service) + '</dd></dl>' +
    '<div class="trust"><div class="k mono">' + (s.status === "open" ? matches.length + ' matching offer' + (matches.length === 1 ? "" : "s") + ' on the lane' : "Booked") + '</div>' +
    (s.status !== "open" ? '<p class="mono" style="color:var(--faint)">This shipment is booked — see My activity.</p>'
      : matches.length ? '<div class="matchlist">' + matches.map(function (m, i) {
        return '<div class="matchr"><div><b>' + e(m.carrier) + '</b>' + (m.verified ? ' ' + TICK : "") +
          '<div class="mono" style="color:var(--muted);font-size:12px">' + e(m.service) + ' · ' + e(m.equipment) + ' · dep ' + e(RF.formatDate(m.depart)) +
          ' · ' + Math.round(m.transitHrs >= 24 ? m.transitHrs / 24 : m.transitHrs) + (m.transitHrs >= 24 ? " d" : " h") + ' transit</div>' +
          '<div class="mono" style="font-size:12px;color:var(--faint)">' + m.basisQty + ' ' + m.unit + ' × ' + RF.logi.money(m.rate) + ' ' + m.rateBasis + '</div></div>' +
          '<div class="matchr-r"><div class="amt">' + RF.logi.money(m.price) + '</div>' +
          '<button class="btn" data-book="' + s.id + '|' + m.capacityId + '">Book</button></div></div>';
      }).join("") + '</div>'
      : '<p style="color:var(--muted);font-size:14px">No posted capacity fits yet. Your load stays on the board so carriers can offer against it.</p>') +
    '</div>';
  document.getElementById("dbody").querySelectorAll("[data-book]").forEach(function (b) {
    b.onclick = function () {
      var p = b.getAttribute("data-book").split("|");
      var me = requireBiz(); if (!me) return;
      var r = RF.logi.book(p[0], p[1]);
      if (r.error) {
        if (r.need === "topup" && window.RF.b2b) {
          if (confirm(r.error + "\n\nTop up " + RF.b2b.money(r.amount) + " now (demo funds)?")) { RF.b2b.wallet.topUp(me, r.amount); b.onclick(); }
        } else toast(r.error);
        return;
      }
      closeDrawer();
      toast("Booked with " + r.meta.carrier + " · " + RF.money(r.amount) + (r.escrow === "held" ? " held in escrow" : "") + ". Track it in My activity.");
      logiPage();
    };
  });
  document.getElementById("drawer").classList.add("on");
  document.getElementById("scrim").classList.add("on");
}

/* ---------------------------------------------------------------- boot */
document.addEventListener("DOMContentLoaded", function () {
  ensureSeed();
  chrome();
  /* Fudud mode: the business boards are replaced by one task launcher (the shop + staff pages are untouched) */
  if (window.SURFACE === "business" && RF.mode && RF.mode.simple() && RF.simpleUI &&
      ["b2b", "exchange", "logi", "tenders", "activity"].indexOf(window.BOARD) >= 0) {
    RF.simpleUI(document.getElementById("app"), null);
    return;
  }
  if (window.STATIC) return;                       /* terms / returns / privacy / help: the words are in the HTML */
  if (window.BOARD === "activity") activityPage();
  else if (window.BOARD === "exchange") exchangePage();
  else if (window.BOARD === "b2b") b2bPage();
  else if (window.BOARD === "logi") logiPage();
  /* the calculator and the sourcing desk are standalone pages: they do not load the whole shop bundle, so they
     dispatch before the RF.shopUI branch rather than through it */
  else if (window.SHOP === "bizhome" && RF.bizHomeUI) RF.bizHomeUI(document.getElementById("app"));
  else if (window.SHOP === "h2h" && RF.h2hUI) RF.api.ready.then(function () { RF.h2hUI(document.getElementById("app")); });
  else if (window.SHOP === "bulk" && RF.bulkUI) RF.bulkUI(document.getElementById("app"));
  else if (window.SHOP === "calculator" && RF.calcUI) RF.calcUI(document.getElementById("app"));
  else if (window.SHOP === "pro" && RF.proUI) RF.api.ready.then(function () { RF.proUI(document.getElementById("app")); });
  else if (window.SHOP === "sourcing" && RF.sourcingUI) RF.api.ready.then(function () { RF.sourcingUI(document.getElementById("app")); });
  else if (window.SHOP === "agent" && RF.agentDesk) RF.api.ready.then(function () { RF.agentDesk(document.getElementById("app")); });
  else if (window.SHOP && RF.shopUI) RF.shopUI(window.SHOP, { toast: toast, e: e });
  else if (window.BOARD) boardPage();
  else landing();
});
})();
