/* Garsoore Console — admin.<domain>. One screen for running the whole business: money, accounts, China facility,
   warehouse, agents, catalogue, audit. Admin role only; the server rejects everything else, this just draws it.
   No site chrome here on purpose: the console is not part of either shop. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return (n < 0 ? "−$" : "$") + Math.abs(Number(n || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function when(iso) { return iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; }
function ago(iso) { var m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
var call = null, app = null, view = "money";

var NAV = [
  ["money", "💰", "Money"], ["accounts", "👥", "Accounts"], ["business", "🏢", "Businesses"],
  ["buy", "🛒", "Buying"], ["fbg", "📦", "FBG"], ["agents", "🤝", "Agents"], ["catalogue", "🏷", "Catalogue"],
  ["shipping", "🛩", "Shipping"], ["calibration", "🎯", "Calibration"], ["ops", "⚙", "Operations"], ["log", "📜", "Log"]
];
var ROLE = { consumer: "Consumer", business: "Business", agent: "Agent", staff: "Staff", admin: "Admin" };
var STATE = { AWAITING_PAYMENT: "Awaiting payment", PAYMENT_REVIEW: "Payment review", PLACED: "Paid", CONFIRMED: "Confirmed", SOURCING: "Sourcing", IN_TRANSIT: "In transit", ARRIVED: "Arrived", READY: "Ready", COMPLETED: "Completed", CANCELLED: "Cancelled", EXPIRED: "Expired" };

function boot() {
  app = $("app"); call = RF.api.call;
  RF.api.ready.then(function () {
    if (!RF.api.remote) { app.innerHTML = '<div class="cs-gate"><h1>Console</h1><p>Server unavailable.</p></div>'; return; }
    if (!RF.api.user) return gate();
    if (RF.api.user.role !== "admin") return gate("This account (" + RF.api.user.name + " · " + (ROLE[RF.api.user.role] || RF.api.user.role) + ") does not have admin access. Sign out and sign in as the administrator.", true);
    shell();
  });
}
function gate(msg, out) {
  app.innerHTML = '<div class="cs-gate"><div class="cs-logo">▦</div><h1>Garsoore Console</h1>' +
    '<p>' + e(msg || "Garsoore administrator only. Sign in to continue.") + '</p>' +
    '<button class="btn g-buy" id="csIn">' + (out ? "Sign out and use another account" : "Sign in") + '</button>' +
    '<div class="cs-foot">' + (window.GARSOORE_CONFIG && GARSOORE_CONFIG.build ? "build " + e(GARSOORE_CONFIG.build) : "") + '</div></div>';
  $("csIn").onclick = function () {
    (out ? RF.api.logout() : Promise.resolve()).then(function () {
      RF.authUI.open("Garsoore Console — administrator").then(boot).catch(function () {});
    });
  };
}
function shell() {
  app.innerHTML =
    '<aside class="cs-side"><div class="cs-brand">▦ <b>Console</b></div>' +
      '<nav>' + NAV.map(function (n) { return '<a href="#' + n[0] + '" data-v="' + n[0] + '"><i>' + n[1] + '</i>' + n[2] + '<em id="cs-n-' + n[0] + '"></em></a>'; }).join("") + '</nav>' +
      '<div class="cs-me"><b>' + e(RF.api.user.name) + '</b><span>' + e(RF.api.user.phone) + '</span>' +
        '<a href="#" id="csOut">Sign out</a><a href="https://' + location.hostname.replace(/^admin\./, "") + '" target="_blank" rel="noopener">Shop ↗</a>' +
        '<a href="https://' + location.hostname.replace(/^admin\./, "business.") + '" target="_blank" rel="noopener">Business ↗</a></div>' +
      '<div class="cs-build">' + (window.GARSOORE_CONFIG && GARSOORE_CONFIG.build ? e(GARSOORE_CONFIG.build) : "") + '</div></aside>' +
    '<main class="cs-main"><header class="cs-top"><h1 id="csTitle"></h1><div id="csTools"></div>' +
      '<button class="btn ghost" id="csRefresh">↻</button></header><div id="csBody"><div class="cs-boot">⏳</div></div></main>';
  $("csOut").onclick = function (ev) { ev.preventDefault(); RF.api.logout().then(function () { location.reload(); }); };
  /* no language switch here on purpose: the console is English only (see admin/index.html) */
  $("csRefresh").onclick = function () { render(); };
  app.querySelector(".cs-side nav").onclick = function (ev) { var a = ev.target.closest("a"); if (!a) return; view = a.dataset.v; render(); };
  window.onhashchange = function () { var v = location.hash.slice(1); if (v) { view = v; render(); } };
  if (location.hash.slice(1)) view = location.hash.slice(1);
  badges();
  render();
}
function badges() {
  Promise.all([call("GET", "/ops/stats?days=365"), call("GET", "/admin/overview")]).then(function (a) {
    var s = a[0], o = a[1], b = s.byState || {};
    set("money", (b.PAYMENT_REVIEW || 0) + (s.refundDue ? 1 : 0) + s.openDisputes);
    set("buy", (b.PLACED || 0) + (b.SOURCING || 0));
    set("business", o.pending.b); set("agents", o.pending.a); set("ops", (b.READY || 0) + s.pendingQuotes);
  }).catch(function () {});
  function set(k, n) { var el = $("cs-n-" + k); if (el) el.textContent = n || ""; }
}
function head(title, tools) { $("csTitle").textContent = title; $("csTools").innerHTML = tools || ""; }
function panel(body) { $("csBody").innerHTML = body; }
function card(label, value, sub, tone) { return '<div class="cs-kpi ' + (tone || "") + '"><span>' + e(label) + '</span><b>' + value + '</b><em>' + e(sub || "") + '</em></div>'; }
function table(cols, rows) {
  return '<div class="cs-tbl" style="--cols:' + cols.map(function (c) { return c[1]; }).join(" ") + '">' +
    '<div class="cs-th">' + cols.map(function (c) { return '<span>' + e(c[0]) + '</span>'; }).join("") + '</div>' +
    (rows.length ? rows.map(function (r) { return '<div class="cs-tr">' + r.map(function (x) { return '<span>' + x + '</span>'; }).join("") + '</div>'; }).join("") : '<div class="cs-empty">—</div>') + '</div>';
}
function act(sel, f) {
  [].forEach.call($("csBody").querySelectorAll(sel), function (b) {
    b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true; p.then(function (r) { toast(r && r.pin ? "PIN: " + r.pin : "✓"); render(); badges(); }).catch(function (x) { b.disabled = false; toast(x.message); }); };
  });
}
function fail(x) { panel('<div class="g-err">' + e(x.message || x) + '</div>'); }

function render() {
  location.hash = view;
  [].forEach.call(app.querySelectorAll(".cs-side nav a"), function (a) { a.classList.toggle("on", a.dataset.v === view); });
  panel('<div class="cs-boot">⏳</div>');
  ({ money: money_, accounts: accounts, business: business, buy: buy, fbg: fbg, agents: agents, catalogue: catalogue, shipping: shipping, calibration: calibration, ops: ops, log: log }[view] || money_)();
}

/* ---------------------------------------------------------------- calibration: what the guesses got wrong
   Four numbers hold up every consumer price and not one of them has been checked against reality: the freight rate
   card, the clearance loading, the packed density per category, and the transit window. This page puts each one next
   to what actually happened on shipments that have landed.

   It deliberately does NOT edit anything. One shipment is a sample of one, and quietly re-pricing 421 products from
   it would replace a stated guess with a hidden one. It tells you what it saw; you decide. */
function calibration() {
  head("Calibration", '<span class="cs-note">Predicted against what actually happened</span>');
  call("GET", "/admin/calibration").then(function (c) {
    if (!c.samples) {
      panel('<div class="cs-warn"><b>No shipment has landed yet</b>' +
        '<div>Every price in the shop rests on four assumptions nobody has checked yet: the freight rate card, ' +
        'clearance cost (' + c.clearance.assumedPerKgAir + '$/kg air · ' + c.clearance.assumedPerCbmSea + '$/cbm sea), ' +
        'the clearance loading, the packed density per category and the transit window. <b>One real shipment settles all four.</b> ' +
        'When your first shipment lands, enter what it actually cost on the FBG page — it appears here.</div></div>' +
        '<div class="cs-note2">Waiting on: a consignment in state ARRIVED with its freight and clearance costs filled in.</div>');
      return;
    }
    var f = c.freight, cl = c.clearance, tr = c.transit;
    function verdict(errPct, tol) {
      if (errPct == null) return '<span class="g-pill">no data</span>';
      var bad = Math.abs(errPct) > (tol || 10);
      return '<span class="g-pill' + (bad ? " gold" : "") + '">' + (errPct > 0 ? "+" : "") + errPct + '%' + (bad ? " — sax" : " — fiican") + '</span>';
    }
    panel(
      '<div class="cs-note2" style="margin-bottom:14px">' + c.samples + ' shipments analysed. Nothing is re-priced here — ' +
        'read it, then correct <code>data/rate-cards.json</code> or <code>data/customs.json</code> yourself.</div>' +

      '<div class="cs-kv" style="margin-bottom:18px">' +
        kv("Freight predicted", "$" + f.predicted) + kv("Freight actual", "$" + f.actual) +
        kv("Error", (f.errorPct == null ? "—" : (f.errorPct > 0 ? "+" : "") + f.errorPct + "%")) +
        kv("Clearance predicted", "$" + cl.predicted) + kv("Clearance actual", "$" + cl.actual) +
        kv("Error", (cl.errorPct == null ? "—" : (cl.errorPct > 0 ? "+" : "") + cl.errorPct + "%")) +
      '</div>' +

      '<div class="cs-card"><div class="cs-cardh"><b>1 · Freight rate card</b>' + verdict(f.errorPct) + '</div>' +
        '<div class="cs-note2">' + (f.errorPct == null ? "Not checked yet — no actual freight cost recorded."
          : f.errorPct > 0 ? "Freight cost more than predicted. That comes straight out of margin — raise the card’s tiers or renegotiate."
          : "Freight cost less than predicted — you are earning on it, but you are pricing above the market.") + '</div></div>' +

      '<div class="cs-card"><div class="cs-cardh"><b>2 · Clearance cost</b>' + verdict(cl.errorPct) + '</div>' +
        '<div class="cs-note2">Currently: <b>$' + cl.assumedPerKgAir + '/kg</b> (cir) · <b>$' + cl.assumedPerCbmSea + '/cbm</b> (bad). ' +
        (cl.errorPct == null ? "Enter the real clearance cost when a shipment arrives."
          : "When this is badly off, the usual culprit is <code>typical</code> — the expected consignment size in data/customs.json.") + '</div></div>' +

      '<div class="cs-card"><div class="cs-cardh"><b>3 · Packed density</b>' +
        '<span class="g-pill' + (Object.keys(c.density).length ? "" : " gold") + '">' + Object.keys(c.density).length + ' categories</span></div>' +
        (Object.keys(c.density).length ? table([["Category", "1fr"], ["Assumed", "1fr"], ["Measured", "1fr"], ["Error", "1fr"], ["Items", "1fr"]],
          Object.keys(c.density).map(function (k) {
            var d = c.density[k], diff = d.assumed ? Math.round((d.measured - d.assumed) / d.assumed * 100) : null;
            return [e(k), (d.assumed || "—") + " kg/cbm", '<b>' + d.measured + " kg/cbm</b>",
              diff == null ? "—" : '<span class="g-pill' + (Math.abs(diff) > 15 ? " gold" : "") + '">' + (diff > 0 ? "+" : "") + diff + '%</span>', String(d.items)];
          }))
        : '<div class="cs-note2">No cartons measured yet. This fills in once the China facility weighs and measures them.</div>') +
        '<div class="cs-note2">Density decides air freight on bulky, light goods. Correct <code>packedDensity</code>.</div></div>' +

      '<div class="cs-card"><div class="cs-cardh"><b>4 · Transit time</b>' +
        (tr ? '<span class="g-pill' + (tr.avgActual > tr.avgPredictedMax ? " gold" : "") + '">' + tr.avgActual + ' days</span>' : '<span class="g-pill gold">no data</span>') + '</div>' +
        (tr ? '<div class="cs-note2">Average actual <b>' + tr.avgActual + ' days</b>, against a promised maximum of <b>' + tr.avgPredictedMax + '</b>. ' +
          (tr.avgActual > tr.avgPredictedMax ? "Customers are waiting longer than promised — widen the quoted window." : "The promised window is achievable.") + '</div>'
          : '<div class="cs-note2">Needs a consignment with both a shipped date and an arrival date.</div>') + '</div>' +

      '<div class="g-sec"><h2>Shipments</h2></div>' +
      table([["Consignment", "1fr"], ["Hab", ".6fr"], ["Weight", ".8fr"], ["Freight: predicted → actual", "1.4fr"], ["Clearance: predicted → actual", "1.4fr"], ["Days", ".7fr"]],
        c.shipments.map(function (x) {
          return ['<code>' + e(x.id) + '</code>', x.mode === "air" ? "✈" : "🚢",
            (x.kg || 0) + " kg / " + (x.cbm || 0) + " cbm",
            (x.freightPredicted == null ? "—" : "$" + x.freightPredicted) + " → " + (x.freightActual == null ? '<i>not recorded</i>' : "<b>$" + x.freightActual + "</b>"),
            (x.clearancePredicted == null ? "—" : "$" + x.clearancePredicted) + " → " + (x.clearanceActual == null ? '<i>not recorded</i>' : "<b>$" + x.clearanceActual + "</b>"),
            x.transitDays == null ? "—" : x.transitDays + (x.transitPredicted ? " / " + x.transitPredicted[1] : "")];
        })) +
      '<div class="cs-note2" style="margin-top:14px">Cards: ' + c.cards.map(function (k) { return e(k.id) + " (" + (k.status === "contracted" ? "signed" : "unsigned") + ")"; }).join(" · ") +
        ' · customs: ' + (c.customsStatus === "confirmed" ? "confirmed" : "unconfirmed") + '</div>');
  }).catch(function (x) { panel('<div class="cs-empty">' + e(x.message) + '</div>'); });
}

/* ---------------------------------------------------------------- shipping: the contracts behind every price
   Every customer-facing shipping number on the site comes from one of these cards. If a card is not signed, the shop
   is quoting a rate nobody has agreed to honour, and that is the single largest un-hedged risk in the business — so
   it is stated at the top of the page in plain words rather than buried in a field. */
function shipping() {
  var S = RF.shipping;
  if (!S) { head("Shipping"); return panel('<div class="cs-empty">Shipping engine not loaded.</div>'); }
  var cards = S.cards(), unsigned = S.unsigned();
  head("Shipping · contracts", '<span class="cs-note">' + cards.length + ' card</span>');
  panel(
    (unsigned.length
      ? '<div class="cs-warn"><b>⚠ ' + unsigned.length + ' unsigned card(s)</b>' +
        '<div>Every shipping price shown to a customer comes from these cards. Until a contract is signed, ' +
        'Garsoore has no agreement obliging anyone to honour that price — the largest single risk in the business. ' +
        e(unsigned.join(" · ")) + '</div></div>'
      : '<div class="cs-ok"><b>✓ All cards are signed</b></div>') +
    cards.map(function (c) {
      var tiers = (c.tiers || []).map(function (t) { return t.from + "+ → $" + t.rate + "/" + c.unit; }).join(" · ");
      return '<div class="cs-card"><div class="cs-cardh"><b>' + e(c.id) + '</b>' +
        '<span class="g-pill ' + (c.status === "contracted" ? "" : "gold") + '">' + (c.status === "contracted" ? "✓ Signed" : "⚠ Unsigned") + '</span></div>' +
        '<div class="cs-kv">' +
          kv("Mode", c.mode === "air" ? "Air" : "Sea") +
          kv("From", c.origin) + kv("To", c.destination) +
          kv("Transit", c.transitMinDays + "–" + c.transitMaxDays + " days") +
          kv("Rate", tiers) +
          kv("Minimum", "$" + c.minimumCharge + " (min billable " + c.minimumBillable + " " + c.unit + ")") +
          (c.volumetricDivisor ? kv("Volumetric divisor", String(c.volumetricDivisor)) : "") +
          (c.weightCapPerCbm ? kv("Weight per CBM", c.weightCapPerCbm + " kg") : "") +
          kv("Valid", c.effectiveFrom + " → " + (c.effectiveUntil || "—")) +
          kv("Capacity", c.capacityPerWeek + " " + c.capacityUnit + "/week") +
          kv("Change notice", (c.rateChangeNoticeDays || "—") + " days") +
          kv("Contract ref", c.providerReference || "—") +
          kv("Included", (c.includedSurcharges || []).join(", ")) +
          kv("Excluded", (c.excludedSurcharges || []).join(", ")) +
          kv("Exceptional events", (c.exceptionalEvents || []).join(", ")) +
        '</div>' + (c.notes ? '<div class="cs-note2">' + e(c.notes) + '</div>' : "") + '</div>';
    }).join("") +
    '<div class="cs-note2" style="margin-top:14px">A sold order keeps the card that priced it (<code>rate_card_id</code>) — ' +
    'a rate change affects new orders only.</div>');
}
function kv(k, v) { return '<div><span>' + e(k) + '</span><b>' + e(v || "—") + '</b></div>'; }

/* ---------------------------------------------------------------- money: is the business making any? */
function money_() {
  var days = +(sessionStorage.getItem("cs.days") || 30);
  head("Money", [7, 30, 90, 365].map(function (d) { return '<button class="chip' + (d === days ? " on" : "") + '" data-days="' + d + '">' + d + 'd</button>'; }).join(""));
  [].forEach.call($("csTools").querySelectorAll("[data-days]"), function (b) { b.onclick = function () { sessionStorage.setItem("cs.days", b.dataset.days); render(); }; });
  call("GET", "/ops/stats?days=" + days).then(function (s) {
    var f = s.funnel || {}, steps = [["view", "Viewed"], ["cart", "Dambiil"], ["checkout", "Bilaabay"], ["order", "Dalbaday"], ["paid", "Paid"]];
    var margin = s.gmv ? (100 * s.gross / s.gmv).toFixed(1) : "0";
    panel('<div class="cs-kpis">' +
        card("GMV", money(s.gmv), s.paidOrders + " orders · " + days + "d") +
        card("Dakhli", money(s.revenue), "commission + margin") +
        card("Gross profit", money(s.gross), margin + "% GMV", s.gross < 0 ? "bad" : "good") +
        card("AOV", money(s.aov), "average order value") +
        card("Escrow", money(s.held), "held in escrow") +
        card("Refunds due", money(s.refundDue), "", s.refundDue ? "bad" : "") +
        card("Cabasho", s.openDisputes, "open", s.openDisputes ? "bad" : "") +
        card("Consumer", s.users, "accounts") + '</div>' +
      '<h2>Funnel</h2><div class="cs-funnel">' + steps.map(function (st, i) {
        var v = f[st[0]] || 0, prev = i ? (f[steps[i - 1][0]] || 0) : 0, top = f.view || 1;
        return '<div><span>' + st[1] + '</span><i style="width:' + Math.max(2, Math.round(100 * v / top)) + '%"></i><b>' + v + '</b><em>' + (i && prev ? Math.round(100 * v / prev) + "%" : "") + '</em></div>';
      }).join("") + '</div>' +
      '<h2>Orders by state</h2><div class="cs-chips">' + Object.keys(s.byState || {}).map(function (k) { return '<span class="cs-chip">' + e(STATE[k] || k) + ' <b>' + s.byState[k] + '</b></span>'; }).join("") + '</div>' +
      '<h2>Economics (server)</h2><div class="cs-note">Domestic commission ' + Math.round(s.econ.commission * 100) + '% · delivery $' + s.econ.deliveryFee + ' (cost $' + s.econ.deliveryCost + ', free over $' + s.econ.freeDeliveryOver + ') · payment fee ' + Math.round(s.econ.payFee * 100) + '% · referral reward $' + s.econ.refReward + ' · China 10% margin. Change these in <code>deploy/api.js → ECON</code>.</div>' +
      '<h2>Catalogue</h2><div class="cs-note">' + s.catalog.verified + ' / ' + s.catalog.products + ' products with a confirmed price · launch mode: ' + (s.catalog.requireVerified ? "ON (others = request a quote)" : "OFF (everything is sellable)") + '</div>');
  }).catch(fail);
}

/* ---------------------------------------------------------------- accounts */
function accounts() {
  var q = sessionStorage.getItem("cs.q") || "", role = sessionStorage.getItem("cs.role") || "";
  head("Accounts", '<input class="cs-in" id="csQ" placeholder="search name / number" value="' + e(q) + '">' +
    '<select class="cs-in" id="csRole"><option value="">all</option>' + Object.keys(ROLE).map(function (r) { return '<option value="' + r + '"' + (role === r ? " selected" : "") + '>' + ROLE[r] + '</option>'; }).join("") + '</select>' +
    '<button class="btn" id="csNew">+ Account</button>');
  $("csQ").onkeydown = function (ev) { if (ev.key === "Enter") { sessionStorage.setItem("cs.q", this.value); render(); } };
  $("csRole").onchange = function () { sessionStorage.setItem("cs.role", this.value); render(); };
  $("csNew").onclick = function () { newUser(); };
  call("GET", "/admin/users?q=" + encodeURIComponent(q) + "&role=" + role).then(function (j) {
    panel(table([["Person", "1.4fr"], ["Type", ".8fr"], ["State", ".7fr"], ["Order", ".5fr"], ["Credit", ".6fr"], ["Action", "1.3fr"]],
      j.users.map(function (u) {
        return ['<b>' + e(u.name) + '</b><br><i class="cs-dim">' + e(u.phone) + ' · ' + u.id + (u.company ? ' · ' + e(u.company) : "") + '</i>',
          '<select class="cs-in sm" data-role="' + u.id + '"' + (u.role === "admin" ? " disabled" : "") + '>' + Object.keys(ROLE).map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + (r === "admin" ? " disabled" : "") + '>' + ROLE[r] + '</option>'; }).join("") + '</select>',
          u.status === "suspended" ? '<span class="cs-bad">suspended</span>' : u.mustChangePin ? '<span class="cs-warn">new PIN</span>' : '<span class="cs-ok">active</span>',
          u.orders, money(u.credit),
          u.role === "admin" ? '<i class="cs-dim">admin</i>' :
            '<button class="btn ghost sm" data-sus="' + u.id + '" data-to="' + (u.status === "suspended" ? "active" : "suspended") + '">' + (u.status === "suspended" ? "unlock" : "suspend") + '</button>' +
            '<button class="btn ghost sm" data-pin="' + u.id + '">PIN</button>' +
            '<button class="btn ghost sm" data-cr="' + u.id + '" data-c="' + u.credit + '">$</button>'];
      })));
    act("[data-sus]", function (b) { var n = prompt("Reason:"); if (n === null) return null; return call("POST", "/admin/users/" + b.dataset.sus, { status: b.dataset.to, note: n }); });
    act("[data-pin]", function (b) { return confirm("One-time PIN? They must change it at first sign-in.") ? call("POST", "/admin/users/" + b.dataset.pin, { resetPin: true }) : null; });
    act("[data-cr]", function (b) { var v = prompt("New credit ($):", b.dataset.c); if (v === null) return null; var n = prompt("Reason:") || ""; return call("POST", "/admin/users/" + b.dataset.cr, { credit: +v, note: n }); });
    [].forEach.call($("csBody").querySelectorAll("[data-role]"), function (sel) {
      sel.onchange = function () { sel.disabled = true; call("POST", "/admin/users/" + sel.dataset.role, { role: sel.value }).then(function () { toast("✓"); render(); }).catch(function (x) { sel.disabled = false; toast(x.message); }); };
    });
  }).catch(fail);
}
function newUser() {
  var box = $("modalBox"), role = "consumer", KINDS = {};
  call("GET", "/admin/overview").then(function (o) { KINDS = o.kinds; draw(); });
  function draw(msg, pin) {
    if (pin) {
      box.innerHTML = '<div class="g-co"><h2>Account ready</h2><div class="g-paybox"><div class="g-lbl" style="margin:0">One-time PIN</div><b class="g-amt">' + e(pin) + '</b>' +
        '<div class="g-eta">Read it to them — they must change it at first sign-in. It is not shown again.</div></div><button class="btn g-buy full" id="nuDone">I have written it down</button></div>';
      $("nuDone").onclick = function () { $("modal").classList.remove("on"); render(); };
      return;
    }
    box.innerHTML = '<div class="g-co"><h2>New account</h2>' +
      '<label class="g-lbl">Type</label><div class="g-pay">' + ["consumer", "business", "agent", "staff"].map(function (r) { return '<div data-r="' + r + '" class="' + (role === r ? "on" : "") + '">' + ROLE[r] + '</div>'; }).join("") + '</div>' +
      '<label class="g-lbl">Name</label><input class="g-in" id="nuName">' +
      '<label class="g-lbl">Phone number</label><input class="g-in" id="nuPhone" inputmode="tel" placeholder="61 5xx xxxx">' +
      (role === "business" ? '<label class="g-lbl">Shirkadda</label><input class="g-in" id="nuCo">' +
        '<label class="g-lbl">Business type</label><select class="g-in" id="nuKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + e(KINDS[k]) + '</option>'; }).join("") + '</select>' +
        '<label class="g-lbl">City</label><input class="g-in" id="nuCity">' : "") +
      (role === "agent" ? '<label class="g-lbl">City</label><input class="g-in" id="nuCity"><label class="g-lbl">Mandate capacity</label><input class="g-in" id="nuCap" type="number" value="5">' : "") +
      '<label class="g-lbl">PIN (blank = generate one)</label><input class="g-in" id="nuPin" inputmode="numeric" maxlength="6">' +
      '<div class="g-err sm" id="nuErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
      '<button class="btn g-buy full" id="nuGo">Samee</button></div>';
    [].forEach.call(box.querySelectorAll("[data-r]"), function (d) { d.onclick = function () { role = d.dataset.r; draw(); }; });
    $("nuGo").onclick = function () {
      var b = { name: $("nuName").value, phone: $("nuPhone").value, role: role, pin: $("nuPin").value };
      if (role === "business") { b.company = $("nuCo").value; b.kind = $("nuKind").value; b.city = $("nuCity").value; }
      if (role === "agent") { b.city = $("nuCity").value; b.capacity = +$("nuCap").value; }
      $("nuGo").disabled = true;
      call("POST", "/admin/users", b).then(function (r) { draw(null, r.pin); }).catch(function (x) { $("nuGo").disabled = false; draw(x.message); });
    };
  }
  $("modal").classList.add("on");
}

/* ---------------------------------------------------------------- businesses */
function business() {
  head("Businesses");
  call("GET", "/admin/businesses").then(function (j) {
    panel(table([["Shirkadda", "1.5fr"], ["Type", "1.2fr"], ["State", ".7fr"], ["Commission", ".7fr"], ["Action", "1fr"]],
      j.businesses.map(function (b) {
        return ['<b>' + e(b.company) + '</b><br><i class="cs-dim">' + e(b.owner) + ' · ' + e(b.phone) + (b.city ? ' · ' + e(b.city) : "") + '</i>',
          e(b.kindName), b.status === "approved" ? '<span class="cs-ok">ansixsan</span>' : b.status === "pending" ? '<span class="cs-warn">waiting</span>' : '<span class="cs-bad">' + e(b.status) + '</span>',
          b.commission == null ? "caadi" : b.commission + "%",
          (b.status !== "approved" ? '<button class="btn sm" data-ok="' + b.id + '">approve</button>' : '<button class="btn ghost sm" data-pause="' + b.id + '">suspend</button>') +
          '<button class="btn ghost sm" data-com="' + b.id + '">commission</button>'];
      })));
    act("[data-ok]", function (b) { return call("POST", "/admin/businesses/" + b.dataset.ok, { status: "approved" }); });
    act("[data-pause]", function (b) { var n = prompt("Reason:"); if (n === null) return null; return call("POST", "/admin/businesses/" + b.dataset.pause, { status: "paused", note: n }); });
    act("[data-com]", function (b) { var v = prompt("Commission (%):", "8"); if (v === null) return null; return call("POST", "/admin/businesses/" + b.dataset.com, { commission: +v }); });
  }).catch(fail);
}

/* ---------------------------------------------------------------- buying queue */
function buy() {
  head("China buying");
  panel('<div id="buyBox"><div class="cs-boot">⏳</div></div>');
  RF.procUI($("buyBox"), call, render);
}

/* ---------------------------------------------------------------- FBG: China facility + warehouse */
function fbg() {
  head("FBG — China and the warehouse");
  call("GET", "/ops/fbg").then(function (j) {
    var inb = j.inbound, cons = j.consignments, rel = j.releases;
    panel('<div class="cs-kpis">' + card("Shipments", inb.length, "moving") +
      card("Awaiting receipt", inb.filter(function (x) { return x.state === "EXPECTED"; }).length, "in China") +
      card("Ready to ship", inb.filter(function (x) { return ["RECEIVED", "INSPECTED"].indexOf(x.state) >= 0; }).length, "to consolidate") +
      card("Dhibaato", inb.filter(function (x) { return x.state === "PROBLEM"; }).length, "", inb.some(function (x) { return x.state === "PROBLEM"; }) ? "bad" : "") + '</div>' +
      '<h2>Shipments</h2><div id="fbgBox"></div>');
    RF.fbgOps($("fbgBox"), call, render);
  }).catch(fail);
}

/* ---------------------------------------------------------------- agents & mandates */
function agents() {
  head("Agents");
  call("GET", "/ops/agents").then(function (j) {
    panel('<h2>Agents</h2>' + table([["Agent", "1.3fr"], ["State", ".6fr"], ["Cap", ".5fr"], ["Categories", "1fr"], ["Action", "1fr"]],
        j.agents.map(function (a) {
          return ['<b>' + e(a.name) + '</b><br><i class="cs-dim">' + e(a.phone) + ' · ' + a.id + '</i>',
            a.status === "approved" ? '<span class="cs-ok">ansixsan</span>' : a.status === "pending" ? '<span class="cs-warn">waiting</span>' : '<span class="cs-bad">' + e(a.status) + '</span>',
            a.capacity, e((a.cats || []).join(", ")),
            (a.status !== "approved" ? '<button class="btn sm" data-aok="' + a.id + '">approve</button>' : '<button class="btn ghost sm" data-apause="' + a.id + '">suspend</button>') +
            '<button class="btn ghost sm" data-ablock="' + a.id + '">block</button>'];
        })) +
      '<h2>Mandate-yada</h2>' + table([["Mandate", "1.4fr"], ["Type", ".6fr"], ["Floor", ".6fr"], ["State", ".8fr"], ["Agent", ".9fr"]],
        j.mandates.map(function (m) {
          return ['<b>' + e(m.title.slice(0, 44)) + '</b><br><i class="cs-dim">' + m.id + ' · ' + e(m.principal || "") + ' · ' + m.qty + '</i>',
            m.mode === "liquidity" ? "liquidity" : "margin", money(m.floor), e(m.state), e(m.agentName || "—")];
        })));
    act("[data-aok]", function (b) { return call("POST", "/ops/agents/" + b.dataset.aok, { status: "approved" }); });
    act("[data-apause]", function (b) { return call("POST", "/ops/agents/" + b.dataset.apause, { status: "paused" }); });
    act("[data-ablock]", function (b) { var n = prompt("Reason:"); if (n === null) return null; return call("POST", "/ops/agents/" + b.dataset.ablock, { status: "blocked", note: n }); });
  }).catch(fail);
}

/* ---------------------------------------------------------------- catalogue + live FBG listings */
function catalogue() {
  head("Catalogue");
  Promise.all([call("GET", "/ops/stats?days=365"), call("GET", "/listings")]).then(function (a) {
    var s = a[0], l = a[1].listings;
    panel('<div class="cs-kpis">' + card("Catalogue products", s.catalog.products, "China (Made-in-China)") +
      card("Confirmed price", s.catalog.verified, s.catalog.requireVerified ? "launch mode on" : "launch mode off", s.catalog.verified ? "good" : "bad") +
      card("FBG listed", l.length, "Mogadishu stock") + '</div>' +
      '<div class="cs-note">The catalogue is harvested from Chinese suppliers (<code>tools/harvest-mic.py</code>) — every price is the supplier’s asking price until a person confirms it. With <code>REQUIRE_VERIFIED=1</code>, unconfirmed items route to a quote instead.</div>' +
      '<h2>FBG stock on sale</h2>' + table([["Item", "1.6fr"], ["Owner", "1fr"], ["Price", ".6fr"], ["Stock", ".5fr"]],
        l.map(function (x) { return ['<b>' + e(x.title) + '</b><br><i class="cs-dim">' + x.id + '</i>', e(x.seller), money(x.price), x.qty]; })));
  }).catch(fail);
}

/* ---------------------------------------------------------------- daily operations */
function ops() {
  head("Operations", '<a class="btn ghost" href="https://' + location.hostname.replace(/^admin\./, "business.") + '/ops.html" target="_blank" rel="noopener">Console shaqaalaha ↗</a>');
  Promise.all([call("GET", "/ops/orders"), call("GET", "/quotes?all=1")]).then(function (a) {
    var o = a[0].orders, q = a[1].quotes.filter(function (x) { return x.status === "pending"; });
    var live = o.filter(function (x) { return ["PAYMENT_REVIEW", "PLACED", "CONFIRMED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY"].indexOf(x.state) >= 0; });
    panel('<h2>Active orders (' + live.length + ')</h2>' +
      table([["Order", "1.5fr"], ["Consumer", "1fr"], ["State", ".9fr"], ["Price", ".6fr"], ["Margin", ".6fr"], ["Age", ".5fr"]],
        live.map(function (x) {
          return ['<b>' + e(x.title.slice(0, 40)) + '</b> ×' + x.qty + '<br><i class="cs-dim">' + x.id + (x.payTxn ? ' · ' + e(x.payTxn) : "") + '</i>',
            e(x.customer.name) + '<br><i class="cs-dim">' + e(x.customer.phone) + '</i>',
            e(STATE[x.state] || x.state), money(x.total), money((x.econ || {}).gross), ago(x.createdAt)];
        })) +
      '<h2>Quote requests waiting (' + q.length + ')</h2>' +
      table([["Item", "1.8fr"], ["Consumer", "1fr"], ["Estimate", ".6fr"], ["Age", ".5fr"]],
        q.map(function (x) { return ['<b>' + e(x.title.slice(0, 46)) + '</b><br><i class="cs-dim">' + x.id + '</i>', e(x.contact || ""), x.estimate == null ? "—" : money(x.estimate), ago(x.createdAt)]; })));
  }).catch(fail);
}

/* ---------------------------------------------------------------- audit */
function log() {
  head("Admin log");
  call("GET", "/admin/log").then(function (j) {
    panel('<div class="cs-note">Every admin action is recorded here — who, when, and what changed.</div>' +
      table([["Waqti", ".8fr"], ["Person", ".8fr"], ["Action", ".9fr"], ["Target", ".8fr"], ["Faahfaahin", "1.6fr"]],
        j.log.map(function (x) { return [when(x.at), e(x.who), '<code>' + e(x.action) + '</code>', e(x.target || ""), e(x.detail || "")]; })));
  }).catch(fail);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
