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
  ["money", "💰", "Lacagta"], ["accounts", "👥", "Akoonnada"], ["business", "🏢", "Ganacsiyada"],
  ["buy", "🛒", "Iibsiga"], ["fbg", "📦", "FBG"], ["agents", "🤝", "Wakiillada"], ["catalogue", "🏷", "Katalogga"],
  ["ops", "⚙", "Hawlgalka"], ["log", "📜", "Diiwaanka"]
];
var ROLE_SO = { consumer: "Macmiil", business: "Ganacsi", agent: "Wakiil", staff: "Shaqaale", admin: "Maamule" };
var STATE_SO = { AWAITING_PAYMENT: "Sugaya lacag", PAYMENT_REVIEW: "Hubinta lacagta", PLACED: "La bixiyay", CONFIRMED: "La xaqiijiyay", SOURCING: "Laga iibsanayo", IN_TRANSIT: "Socda", ARRIVED: "Yimid", READY: "Diyaar", COMPLETED: "Dhammaystiran", CANCELLED: "La joojiyay", EXPIRED: "Dhacay" };

function boot() {
  app = $("app"); call = RF.api.call;
  RF.api.ready.then(function () {
    if (!RF.api.remote) { app.innerHTML = '<div class="cs-gate"><h1>Console</h1><p>Server-ka lama helin.</p></div>'; return; }
    if (!RF.api.user) return gate();
    if (RF.api.user.role !== "admin") return gate("Akoonkan (" + RF.api.user.name + " · " + (ROLE_SO[RF.api.user.role] || RF.api.user.role) + ") ma laha fasax maamul. Ka bax oo ku gal akoonka maamulaha.", true);
    shell();
  });
}
function gate(msg, out) {
  app.innerHTML = '<div class="cs-gate"><div class="cs-logo">▦</div><h1>Garsoore Console</h1>' +
    '<p>' + e(msg || "Maamulaha Garsoore oo keliya. Gal si aad u sii wadato.") + '</p>' +
    '<button class="btn g-buy" id="csIn">' + (out ? "Ka bax oo mid kale ku gal" : "Gal") + '</button>' +
    '<div class="cs-foot">' + (window.GARSOORE_CONFIG && GARSOORE_CONFIG.build ? "build " + e(GARSOORE_CONFIG.build) : "") + '</div></div>';
  $("csIn").onclick = function () {
    (out ? RF.api.logout() : Promise.resolve()).then(function () {
      RF.authUI.open("Garsoore Console — maamulaha").then(boot).catch(function () {});
    });
  };
}
function shell() {
  app.innerHTML =
    '<aside class="cs-side"><div class="cs-brand">▦ <b>Console</b></div>' +
      '<nav>' + NAV.map(function (n) { return '<a href="#' + n[0] + '" data-v="' + n[0] + '"><i>' + n[1] + '</i>' + n[2] + '<em id="cs-n-' + n[0] + '"></em></a>'; }).join("") + '</nav>' +
      '<div class="cs-me"><b>' + e(RF.api.user.name) + '</b><span>' + e(RF.api.user.phone) + '</span>' +
        '<a href="#" id="csLang"></a><a href="#" id="csOut">Ka bax</a><a href="https://' + location.hostname.replace(/^admin\./, "") + '" target="_blank" rel="noopener">Suuqa ↗</a>' +
        '<a href="https://' + location.hostname.replace(/^admin\./, "business.") + '" target="_blank" rel="noopener">Ganacsi ↗</a></div>' +
      '<div class="cs-build">' + (window.GARSOORE_CONFIG && GARSOORE_CONFIG.build ? e(GARSOORE_CONFIG.build) : "") + '</div></aside>' +
    '<main class="cs-main"><header class="cs-top"><h1 id="csTitle"></h1><div id="csTools"></div>' +
      '<button class="btn ghost" id="csRefresh">↻</button></header><div id="csBody"><div class="cs-boot">⏳</div></div></main>';
  $("csOut").onclick = function (ev) { ev.preventDefault(); RF.api.logout().then(function () { location.reload(); }); };
  if (RF.i18n) {
    var en = RF.i18n.lang() === "en";
    $("csLang").textContent = en ? "Af Soomaali" : "English";
    $("csLang").onclick = function (ev) { ev.preventDefault(); RF.i18n.set(en ? "so" : "en"); };
  }
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
  ({ money: money_, accounts: accounts, business: business, buy: buy, fbg: fbg, agents: agents, catalogue: catalogue, ops: ops, log: log }[view] || money_)();
}

/* ---------------------------------------------------------------- money: is the business making any? */
function money_() {
  var days = +(sessionStorage.getItem("cs.days") || 30);
  head("Lacagta", [7, 30, 90, 365].map(function (d) { return '<button class="chip' + (d === days ? " on" : "") + '" data-days="' + d + '">' + d + 'd</button>'; }).join(""));
  [].forEach.call($("csTools").querySelectorAll("[data-days]"), function (b) { b.onclick = function () { sessionStorage.setItem("cs.days", b.dataset.days); render(); }; });
  call("GET", "/ops/stats?days=" + days).then(function (s) {
    var f = s.funnel || {}, steps = [["view", "Eegay"], ["cart", "Dambiil"], ["checkout", "Bilaabay"], ["order", "Dalbaday"], ["paid", "Bixiyay"]];
    var margin = s.gmv ? (100 * s.gross / s.gmv).toFixed(1) : "0";
    panel('<div class="cs-kpis">' +
        card("GMV", money(s.gmv), s.paidOrders + " dalab · " + days + "d") +
        card("Dakhli", money(s.revenue), "komishan + faa'iido") +
        card("Faa'iido guud", money(s.gross), margin + "% GMV", s.gross < 0 ? "bad" : "good") +
        card("AOV", money(s.aov), "celceliska dalabka") +
        card("Escrow", money(s.held), "lacag la hayo") +
        card("Celin sugaysa", money(s.refundDue), "", s.refundDue ? "bad" : "") +
        card("Cabasho", s.openDisputes, "furan", s.openDisputes ? "bad" : "") +
        card("Macmiil", s.users, "akoon") + '</div>' +
      '<h2>Funnel</h2><div class="cs-funnel">' + steps.map(function (st, i) {
        var v = f[st[0]] || 0, prev = i ? (f[steps[i - 1][0]] || 0) : 0, top = f.view || 1;
        return '<div><span>' + st[1] + '</span><i style="width:' + Math.max(2, Math.round(100 * v / top)) + '%"></i><b>' + v + '</b><em>' + (i && prev ? Math.round(100 * v / prev) + "%" : "") + '</em></div>';
      }).join("") + '</div>' +
      '<h2>Dalabyada xaaladooda</h2><div class="cs-chips">' + Object.keys(s.byState || {}).map(function (k) { return '<span class="cs-chip">' + e(STATE_SO[k] || k) + ' <b>' + s.byState[k] + '</b></span>'; }).join("") + '</div>' +
      '<h2>Qaanacsiga (server)</h2><div class="cs-note">Komishan gudaha ' + Math.round(s.econ.commission * 100) + '% · gaarsiin $' + s.econ.deliveryFee + ' (kharash $' + s.econ.deliveryCost + ', bilaash ka sarreeya $' + s.econ.freeDeliveryOver + ') · kharash lacag bixin ' + Math.round(s.econ.payFee * 100) + '% · abaalmarin saaxiib $' + s.econ.refReward + ' · Shiinaha 10% faa\'iido. Beddelkoodu wuxuu ku jiraa <code>deploy/api.js → ECON</code>.</div>' +
      '<h2>Katalogga</h2><div class="cs-note">' + s.catalog.verified + ' / ' + s.catalog.products + ' alaab oo qiimahooda la hubiyay · launch mode: ' + (s.catalog.requireVerified ? "SHIDAN (kuwa kale = codso qiimo)" : "DAMAN (dhammaan waa la iibin karaa)") + '</div>');
  }).catch(fail);
}

/* ---------------------------------------------------------------- accounts */
function accounts() {
  var q = sessionStorage.getItem("cs.q") || "", role = sessionStorage.getItem("cs.role") || "";
  head("Akoonnada", '<input class="cs-in" id="csQ" placeholder="raadi magac / lambar" value="' + e(q) + '">' +
    '<select class="cs-in" id="csRole"><option value="">dhammaan</option>' + Object.keys(ROLE_SO).map(function (r) { return '<option value="' + r + '"' + (role === r ? " selected" : "") + '>' + ROLE_SO[r] + '</option>'; }).join("") + '</select>' +
    '<button class="btn" id="csNew">+ Akoon</button>');
  $("csQ").onkeydown = function (ev) { if (ev.key === "Enter") { sessionStorage.setItem("cs.q", this.value); render(); } };
  $("csRole").onchange = function () { sessionStorage.setItem("cs.role", this.value); render(); };
  $("csNew").onclick = function () { newUser(); };
  call("GET", "/admin/users?q=" + encodeURIComponent(q) + "&role=" + role).then(function (j) {
    panel(table([["Qofka", "1.4fr"], ["Nooca", ".8fr"], ["Xaalad", ".7fr"], ["Dalab", ".5fr"], ["Dheeraad", ".6fr"], ["Ficil", "1.3fr"]],
      j.users.map(function (u) {
        return ['<b>' + e(u.name) + '</b><br><i class="cs-dim">' + e(u.phone) + ' · ' + u.id + (u.company ? ' · ' + e(u.company) : "") + '</i>',
          '<select class="cs-in sm" data-role="' + u.id + '"' + (u.role === "admin" ? " disabled" : "") + '>' + Object.keys(ROLE_SO).map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + (r === "admin" ? " disabled" : "") + '>' + ROLE_SO[r] + '</option>'; }).join("") + '</select>',
          u.status === "suspended" ? '<span class="cs-bad">hakis</span>' : u.mustChangePin ? '<span class="cs-warn">PIN cusub</span>' : '<span class="cs-ok">firfircoon</span>',
          u.orders, money(u.credit),
          u.role === "admin" ? '<i class="cs-dim">maamule</i>' :
            '<button class="btn ghost sm" data-sus="' + u.id + '" data-to="' + (u.status === "suspended" ? "active" : "suspended") + '">' + (u.status === "suspended" ? "fur" : "haki") + '</button>' +
            '<button class="btn ghost sm" data-pin="' + u.id + '">PIN</button>' +
            '<button class="btn ghost sm" data-cr="' + u.id + '" data-c="' + u.credit + '">$</button>'];
      })));
    act("[data-sus]", function (b) { var n = prompt("Sababta:"); if (n === null) return null; return call("POST", "/admin/users/" + b.dataset.sus, { status: b.dataset.to, note: n }); });
    act("[data-pin]", function (b) { return confirm("PIN ku meel gaadh ah? Qofku wuu ka bixi doonaa.") ? call("POST", "/admin/users/" + b.dataset.pin, { resetPin: true }) : null; });
    act("[data-cr]", function (b) { var v = prompt("Dheeraadka cusub ($):", b.dataset.c); if (v === null) return null; var n = prompt("Sababta:") || ""; return call("POST", "/admin/users/" + b.dataset.cr, { credit: +v, note: n }); });
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
      box.innerHTML = '<div class="g-co"><h2>Akoonka waa diyaar</h2><div class="g-paybox"><div class="g-lbl" style="margin:0">PIN ku meel gaadh ah</div><b class="g-amt">' + e(pin) + '</b>' +
        '<div class="g-eta">U sheeg qofka — waa inuu beddelaa markuu galo. Mar dambe lama tusi doono.</div></div><button class="btn g-buy full" id="nuDone">Waan qoray</button></div>';
      $("nuDone").onclick = function () { $("modal").classList.remove("on"); render(); };
      return;
    }
    box.innerHTML = '<div class="g-co"><h2>Akoon cusub</h2>' +
      '<label class="g-lbl">Nooca</label><div class="g-pay">' + ["consumer", "business", "agent", "staff"].map(function (r) { return '<div data-r="' + r + '" class="' + (role === r ? "on" : "") + '">' + ROLE_SO[r] + '</div>'; }).join("") + '</div>' +
      '<label class="g-lbl">Magaca</label><input class="g-in" id="nuName">' +
      '<label class="g-lbl">Lambarka taleefanka</label><input class="g-in" id="nuPhone" inputmode="tel" placeholder="61 5xx xxxx">' +
      (role === "business" ? '<label class="g-lbl">Shirkadda</label><input class="g-in" id="nuCo">' +
        '<label class="g-lbl">Nooca ganacsiga</label><select class="g-in" id="nuKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + e(KINDS[k]) + '</option>'; }).join("") + '</select>' +
        '<label class="g-lbl">Magaalada</label><input class="g-in" id="nuCity">' : "") +
      (role === "agent" ? '<label class="g-lbl">Magaalada</label><input class="g-in" id="nuCity"><label class="g-lbl">Awoodda mandate</label><input class="g-in" id="nuCap" type="number" value="5">' : "") +
      '<label class="g-lbl">PIN (faaruq = mid la abuuro)</label><input class="g-in" id="nuPin" inputmode="numeric" maxlength="6">' +
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
  head("Ganacsiyada");
  call("GET", "/admin/businesses").then(function (j) {
    panel(table([["Shirkadda", "1.5fr"], ["Nooca", "1.2fr"], ["Xaalad", ".7fr"], ["Komishan", ".7fr"], ["Ficil", "1fr"]],
      j.businesses.map(function (b) {
        return ['<b>' + e(b.company) + '</b><br><i class="cs-dim">' + e(b.owner) + ' · ' + e(b.phone) + (b.city ? ' · ' + e(b.city) : "") + '</i>',
          e(b.kindName), b.status === "approved" ? '<span class="cs-ok">ansixsan</span>' : b.status === "pending" ? '<span class="cs-warn">sugaya</span>' : '<span class="cs-bad">' + e(b.status) + '</span>',
          b.commission == null ? "caadi" : b.commission + "%",
          (b.status !== "approved" ? '<button class="btn sm" data-ok="' + b.id + '">ansixi</button>' : '<button class="btn ghost sm" data-pause="' + b.id + '">haki</button>') +
          '<button class="btn ghost sm" data-com="' + b.id + '">komishan</button>'];
      })));
    act("[data-ok]", function (b) { return call("POST", "/admin/businesses/" + b.dataset.ok, { status: "approved" }); });
    act("[data-pause]", function (b) { var n = prompt("Sababta:"); if (n === null) return null; return call("POST", "/admin/businesses/" + b.dataset.pause, { status: "paused", note: n }); });
    act("[data-com]", function (b) { var v = prompt("Komishanka (%):", "8"); if (v === null) return null; return call("POST", "/admin/businesses/" + b.dataset.com, { commission: +v }); });
  }).catch(fail);
}

/* ---------------------------------------------------------------- buying queue */
function buy() {
  head("Iibsiga Shiinaha");
  panel('<div id="buyBox"><div class="cs-boot">⏳</div></div>');
  RF.procUI($("buyBox"), call, render);
}

/* ---------------------------------------------------------------- FBG: China facility + warehouse */
function fbg() {
  head("FBG — Shiinaha iyo bakhaarka");
  call("GET", "/ops/fbg").then(function (j) {
    var inb = j.inbound, cons = j.consignments, rel = j.releases;
    panel('<div class="cs-kpis">' + card("Shixnado", inb.length, "socda") +
      card("Sugaya qaabilaad", inb.filter(function (x) { return x.state === "EXPECTED"; }).length, "Shiinaha") +
      card("Diyaar rar", inb.filter(function (x) { return ["RECEIVED", "INSPECTED"].indexOf(x.state) >= 0; }).length, "la isku darayo") +
      card("Dhibaato", inb.filter(function (x) { return x.state === "PROBLEM"; }).length, "", inb.some(function (x) { return x.state === "PROBLEM"; }) ? "bad" : "") + '</div>' +
      '<h2>Shixnadaha</h2><div id="fbgBox"></div>');
    RF.fbgOps($("fbgBox"), call, render);
  }).catch(fail);
}

/* ---------------------------------------------------------------- agents & mandates */
function agents() {
  head("Wakiillada");
  call("GET", "/ops/agents").then(function (j) {
    panel('<h2>Wakiillada</h2>' + table([["Wakiil", "1.3fr"], ["Xaalad", ".6fr"], ["Awood", ".5fr"], ["Qaybaha", "1fr"], ["Ficil", "1fr"]],
        j.agents.map(function (a) {
          return ['<b>' + e(a.name) + '</b><br><i class="cs-dim">' + e(a.phone) + ' · ' + a.id + '</i>',
            a.status === "approved" ? '<span class="cs-ok">ansixsan</span>' : a.status === "pending" ? '<span class="cs-warn">sugaya</span>' : '<span class="cs-bad">' + e(a.status) + '</span>',
            a.capacity, e((a.cats || []).join(", ")),
            (a.status !== "approved" ? '<button class="btn sm" data-aok="' + a.id + '">ansixi</button>' : '<button class="btn ghost sm" data-apause="' + a.id + '">haki</button>') +
            '<button class="btn ghost sm" data-ablock="' + a.id + '">xidh</button>'];
        })) +
      '<h2>Mandate-yada</h2>' + table([["Mandate", "1.4fr"], ["Nooca", ".6fr"], ["Hoose", ".6fr"], ["Xaalad", ".8fr"], ["Wakiil", ".9fr"]],
        j.mandates.map(function (m) {
          return ['<b>' + e(m.title.slice(0, 44)) + '</b><br><i class="cs-dim">' + m.id + ' · ' + e(m.principal || "") + ' · ' + m.qty + '</i>',
            m.mode === "liquidity" ? "degdeg" : "faa'iido", money(m.floor), e(m.state), e(m.agentName || "—")];
        })));
    act("[data-aok]", function (b) { return call("POST", "/ops/agents/" + b.dataset.aok, { status: "approved" }); });
    act("[data-apause]", function (b) { return call("POST", "/ops/agents/" + b.dataset.apause, { status: "paused" }); });
    act("[data-ablock]", function (b) { var n = prompt("Sababta:"); if (n === null) return null; return call("POST", "/ops/agents/" + b.dataset.ablock, { status: "blocked", note: n }); });
  }).catch(fail);
}

/* ---------------------------------------------------------------- catalogue + live FBG listings */
function catalogue() {
  head("Katalogga");
  Promise.all([call("GET", "/ops/stats?days=365"), call("GET", "/listings")]).then(function (a) {
    var s = a[0], l = a[1].listings;
    panel('<div class="cs-kpis">' + card("Alaab katalog", s.catalog.products, "Shiinaha (mic)") +
      card("Qiimo la hubiyay", s.catalog.verified, s.catalog.requireVerified ? "launch mode shidan" : "launch mode daman", s.catalog.verified ? "good" : "bad") +
      card("FBG suuqa", l.length, "kayd Muqdisho") + '</div>' +
      '<div class="cs-note">Katalogga waxaa laga soo qaadaa iibiyeyaasha Shiinaha (<code>tools/harvest-mic.py</code>) — qiimo kastaa waa mid iibiyuhu weydiisanayo ilaa qof uu xaqiijiyo. Marka <code>REQUIRE_VERIFIED=1</code>, kuwa aan la xaqiijin waxay maraan codso-qiimo.</div>' +
      '<h2>Kaydka FBG ee suuqa</h2>' + table([["Alaabta", "1.6fr"], ["Milkiile", "1fr"], ["Qiimo", ".6fr"], ["Kayd", ".5fr"]],
        l.map(function (x) { return ['<b>' + e(x.title) + '</b><br><i class="cs-dim">' + x.id + '</i>', e(x.seller), money(x.price), x.qty]; })));
  }).catch(fail);
}

/* ---------------------------------------------------------------- daily operations */
function ops() {
  head("Hawlgalka", '<a class="btn ghost" href="https://' + location.hostname.replace(/^admin\./, "business.") + '/ops.html" target="_blank" rel="noopener">Console shaqaalaha ↗</a>');
  Promise.all([call("GET", "/ops/orders"), call("GET", "/quotes?all=1")]).then(function (a) {
    var o = a[0].orders, q = a[1].quotes.filter(function (x) { return x.status === "pending"; });
    var live = o.filter(function (x) { return ["PAYMENT_REVIEW", "PLACED", "CONFIRMED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY"].indexOf(x.state) >= 0; });
    panel('<h2>Dalabyada firfircoon (' + live.length + ')</h2>' +
      table([["Dalab", "1.5fr"], ["Macmiil", "1fr"], ["Xaalad", ".9fr"], ["Qiimo", ".6fr"], ["Faa'iido", ".6fr"], ["Da'", ".5fr"]],
        live.map(function (x) {
          return ['<b>' + e(x.title.slice(0, 40)) + '</b> ×' + x.qty + '<br><i class="cs-dim">' + x.id + (x.payTxn ? ' · ' + e(x.payTxn) : "") + '</i>',
            e(x.customer.name) + '<br><i class="cs-dim">' + e(x.customer.phone) + '</i>',
            e(STATE_SO[x.state] || x.state), money(x.total), money((x.econ || {}).gross), ago(x.createdAt)];
        })) +
      '<h2>Codsiyo qiimo sugaya (' + q.length + ')</h2>' +
      table([["Alaabta", "1.8fr"], ["Macmiil", "1fr"], ["Qiyaas", ".6fr"], ["Da'", ".5fr"]],
        q.map(function (x) { return ['<b>' + e(x.title.slice(0, 46)) + '</b><br><i class="cs-dim">' + x.id + '</i>', e(x.contact || ""), x.estimate == null ? "—" : money(x.estimate), ago(x.createdAt)]; })));
  }).catch(fail);
}

/* ---------------------------------------------------------------- audit */
function log() {
  head("Diiwaanka maamulka");
  call("GET", "/admin/log").then(function (j) {
    panel('<div class="cs-note">Ficil kasta oo maamulku qabto halkan ayuu ku qornaa — cidda, waqtiga iyo waxa la beddelay.</div>' +
      table([["Waqti", ".8fr"], ["Qofka", ".8fr"], ["Ficil", ".9fr"], ["Target", ".8fr"], ["Faahfaahin", "1.6fr"]],
        j.log.map(function (x) { return [when(x.at), e(x.who), '<code>' + e(x.action) + '</code>', e(x.target || ""), e(x.detail || "")]; })));
  }).catch(fail);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
