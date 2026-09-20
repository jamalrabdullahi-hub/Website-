/* Garsoore — staff operations console (business.buurwen.com/ops.html). Everything a small team needs to run the shop daily:
   verify mobile-money payments → move orders along → hand over with the customer's pickup code → price quote requests →
   refunds & disputes → see whether the business makes money (GMV, revenue, gross profit, funnel).
   Server enforces the staff role; this page only draws. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function ago(iso) { var m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return m < 60 ? m + " daq" : m < 1440 ? Math.round(m / 60) + " saac" : Math.round(m / 1440) + " maalin"; }
/* one tap to WhatsApp the customer with the right words already written */
function wa(phone, text) {
  var n = String(phone || "").replace(/\D/g, "");
  return n ? '<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/' + n + '?text=' + encodeURIComponent(text) + '">\ud83d\udcac WhatsApp</a>' : "";
}
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
var NEXT_SO = { SOURCING: "Laga iibsaday", IN_TRANSIT: "Soo socda", ARRIVED: "Yimid", CONFIRMED: "Iibiyaha xaqiijiyay", READY: "Diyaar (u sheeg macmiilka)" };
var TABS = [["stats", "Tirakoob"], ["pay", "Lacag bixin"], ["orders", "Dalabyo"], ["pickup", "Qaadasho"], ["buy", "Iibsiga"], ["fbg", "FBG (Shiinaha)"], ["quotes", "Codsiyo qiimo"], ["issues", "Celin & cabasho"]];

RF.opsUI = function (app, tab) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Hawlgalku wuxuu u baahan yahay server-ka (API). Ku fur bogga live-ka ah ama <code>wrangler dev</code>.</div>'; return; }
  if (!RF.api.user) {
    app.innerHTML = '<div class="wrap g-empty">Shaqaalaha Garsoore oo keliya. <button class="btn" id="opsIn">Gal</button></div>';
    $("opsIn").onclick = function () { RF.authUI.open("Shaqaalaha Garsoore — gal").then(function () { RF.opsUI(app, tab); }).catch(function () {}); };
    return;
  }
  if (RF.api.user.role !== "staff") { app.innerHTML = '<div class="wrap g-empty">Akoonkan (' + e(RF.api.user.name) + ') ma laha fasax shaqaale.</div>'; return; }
  app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:30px"><h1>Hawlgalka</h1><span class="g-eta" id="opsBadge"></span></div>' +
    '<div class="g-seg ops-tabs" id="opsTabs">' + TABS.map(function (t) { return '<span data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + '>' + t[1] + '<em id="n-' + t[0] + '"></em></span>'; }).join("") + '</div>' +
    '<div id="opsBody" style="margin-top:16px"><div class="g-empty sm">⏳</div></div></div>';
  $("opsTabs").onclick = function (ev) { var t = ev.target.closest("span"); if (!t) return; history.replaceState(null, "", "?tab=" + t.dataset.t); RF.opsUI(app, t.dataset.t); };
  var call = RF.api.call, body = $("opsBody");
  function fail(x) { toast(x.message || "Khalad"); }
  function reload() { RF.opsUI(app, tab); }
  /* counts on the tabs = today's to-do list */
  Promise.all([call("GET", "/ops/stats?days=365"), call("GET", "/quotes?all=1")]).then(function (a) {
    var s = a[0], bs = s.byState || {};
    var n = { pay: bs.PAYMENT_REVIEW || 0, pickup: bs.READY || 0, quotes: s.pendingQuotes, issues: s.openDisputes + (s.refundDue ? 1 : 0), orders: (bs.PLACED || 0) + (bs.CONFIRMED || 0) + (bs.SOURCING || 0) + (bs.IN_TRANSIT || 0) + (bs.ARRIVED || 0) };
    Object.keys(n).forEach(function (k) { if ($("n-" + k) && n[k]) $("n-" + k).textContent = n[k]; });
    $("opsBadge").textContent = "👤 " + RF.api.user.name + " · " + s.users + " macmiil";
  }).catch(function () {});

  if (tab === "stats") return call("GET", "/ops/stats?days=" + (+(new URLSearchParams(location.search).get("days")) || 30)).then(function (s) {
    var f = s.funnel || {}, steps = [["view", "Eegay alaab"], ["cart", "Dambiil"], ["checkout", "Lacag bixin"], ["order", "Dalbaday"], ["paid", "Bixiyay"]];
    var margin = s.gmv ? Math.round(100 * s.gross / s.gmv * 10) / 10 : 0;
    body.innerHTML = '<div class="g-eta" style="margin-bottom:10px">' + [7, 30, 90, 365].map(function (d) { return '<a class="chip' + (d === s.days ? " on" : "") + '" href="?tab=stats&days=' + d + '">' + d + ' maalmood</a>'; }).join(" ") + '</div>' +
      '<div class="ops-kpi">' +
        kpi("GMV (lacag la bixiyay)", money(s.gmv), s.paidOrders + " dalab") + kpi("Dakhli Garsoore", money(s.revenue), "faa'iido + komishan") +
        kpi("Faa'iido guud", money(s.gross), margin + "% ee GMV", s.gross < 0 ? "bad" : "good") + kpi("Celceliska dalabka", money(s.aov), "AOV") +
        kpi("Lacag la hayo", money(s.held), "escrow") + kpi("Lacag celin sugaysa", money(s.refundDue), "", s.refundDue ? "bad" : "") +
        kpi("Codsiyo qiimo", s.pendingQuotes, s.oldestQuote ? "ugu da'weyn: " + ago(s.oldestQuote) : "", s.oldestQuote && Date.now() - Date.parse(s.oldestQuote) > 4 * 36e5 ? "bad" : "") +
        kpi("Cabashooyin furan", s.openDisputes, "", s.openDisputes ? "bad" : "") +
        kpi("Katalog: qiimo la hubiyay", s.catalog.verified + " / " + s.catalog.products, s.catalog.requireVerified ? "launch mode: kuwa kale = codso qiimo" : "dev: dhammaan waa la iibin karaa", s.catalog.verified < 50 ? "bad" : "good") + '</div>' +
      '<div class="g-sec"><h2>Funnel</h2><span class="g-eta">browsers kala duwan · ' + s.days + ' maalmood</span></div><div class="ops-funnel">' +
        steps.map(function (st, i) { var v = f[st[0]] || 0, prev = i ? (f[steps[i - 1][0]] || 0) : 0, top = f.view || 1;
          return '<div><span>' + st[1] + '</span><i style="width:' + Math.max(2, Math.round(100 * v / top)) + '%"></i><b>' + v + '</b><em>' + (i && prev ? Math.round(100 * v / prev) + "%" : "") + '</em></div>'; }).join("") + '</div>' +
      '<div class="g-sec"><h2>Dalabyada xaaladooda</h2></div><div class="ops-kpi">' + Object.keys(s.byState || {}).map(function (k) { return kpi(k, s.byState[k], ""); }).join("") + '</div>' +
      '<div class="g-sec"><h2>Dhaqaalaha (server)</h2></div><div class="g-eta">Komishan iibiyeyaasha gudaha ' + Math.round(s.econ.commission * 100) + '% · gaarsiin $' + s.econ.deliveryFee + ' (kharash $' + s.econ.deliveryCost + ', bilaash $' + s.econ.freeDeliveryOver + '+) · kharash lacag bixin ~' + Math.round(s.econ.payFee * 100) + '% · abaalmarin saaxiib $' + s.econ.refReward + ' · Shiinaha: 10% faa\'iido ka dib kharashka la keenay. Beddel: deploy/api.js → ECON.</div>';
  }).catch(fail);

  if (tab === "pay") return call("GET", "/ops/orders?state=PAYMENT_REVIEW").then(function (j) {
    body.innerHTML = '<p class="g-eta">Isbarbar dhig lambarka macaamilka iyo qadarka bayaanka akoonka ganacsiga (' + e(Object.keys(RF.api.config.merchants).filter(function (k) { return RF.api.config.merchants[k]; }).join(", ") || "weli lama dejin") + '). Kadib lacagta waa la hayaa (escrow).</p>' +
      (j.orders.length ? groupBaskets(j.orders).map(function (g) {
        var o = g[0], tot = g.reduce(function (s, x) { return s + x.total; }, 0);
        return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + money(tot) + ' · ' + e(o.pay) + ' · ' + e(o.payPhone ? "+" + o.payPhone : "") + '</b>' +
          '<div class="g-eta">Macaamil: <b style="color:var(--fg)">' + e(o.payTxn) + '</b> · ' + e(o.customer.name) + ' ' + e(o.customer.phone) + ' · ' + ago(o.createdAt) + ' kahor · ' + (o.basket || o.id) + '</div>' +
          '<div class="g-eta">' + g.map(function (x) { return e(x.title) + " ×" + x.qty; }).join(" · ") + '</div></div>' +
          '<button class="btn" data-ok="' + g.map(function (x) { return x.id; }).join(",") + '">✓ La helay</button><button class="btn ghost" data-no="' + g.map(function (x) { return x.id; }).join(",") + '">✕ Lama helin</button>' +
          wa(o.customer.phone, "Salaan " + o.customer.name + ", waa Garsoore. Lacagtaada " + money(tot) + " ee " + (o.basket || o.id) + " ma hubin karnaa? Fadlan noo soo dir lambarka macaamilka haddii aan weli helin.") + '</div></div>';
      }).join("") : '<div class="g-empty sm">Lacag sugaysa hubin ma jirto. ✓</div>');
    bind("[data-ok]", function (b) { return all(b.dataset.ok, function (id) { return call("POST", "/ops/orders/" + id + "/verify", { ok: true }); }); });
    bind("[data-no]", function (b) { return all(b.dataset.no, function (id) { return call("POST", "/ops/orders/" + id + "/verify", { ok: false }); }); });
  }).catch(fail);

  if (tab === "orders") return call("GET", "/ops/orders").then(function (j) {
    var act = j.orders.filter(function (o) { return ["PLACED", "CONFIRMED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY"].indexOf(o.state) >= 0; });
    var flows = RF.api.config.flows;
    body.innerHTML = act.length ? act.map(function (o) {
      var f = flows[o.flow], nx = f[f.indexOf(o.state) + 1], c = o.econ || {};
      return '<div class="g-order"><div class="g-ohead"><div class="g-th">' + o.icon + '</div><div style="flex:1"><b>' + e(o.title) + ' ×' + o.qty + '</b>' +
        '<div class="g-eta">' + o.id + ' · <b>' + o.state + '</b> · ' + ago((o.history[o.history.length - 1] || {}).at || o.createdAt) + ' xaaladdan · ' + (o.flow === "china" ? "Shiinaha" : "Gudaha" + (c.seller ? " · " + e(c.seller) : "")) + '</div>' +
        '<div class="g-eta">' + e(o.customer.name) + ' ' + e(o.customer.phone) + ' · ' + e(o.pickup) + (o.address ? " · " + e(o.address) : "") + '</div>' +
        '<div class="g-eta">' + money(o.total) + ' · faa\'iido guud ' + money(c.gross) + (c.cogs != null ? ' · kharash ' + money(c.cogs) : "") + '</div></div>' +
        (nx && nx !== "COMPLETED" ? '<button class="btn" data-adv="' + o.id + '">→ ' + (NEXT_SO[nx] || nx) + '</button>' : '<span class="g-pill">Sugaya koodhka macmiilka</span>') +
        wa(o.customer.phone, o.state === "READY"
          ? "Salaan " + o.customer.name + ", waa Garsoore. " + o.title + " waa diyaar — waxaad ka qaadan kartaa xarunta Km4. La imow koodhkaaga 6-ta lambar."
          : "Salaan " + o.customer.name + ", waa Garsoore. Warbixin dalabkaaga " + o.id + " (" + o.title + "): ") + '</div></div>';
    }).join("") : '<div class="g-empty sm">Dalab socda ma jiro.</div>';
    bind("[data-adv]", function (b) { return call("POST", "/ops/orders/" + b.dataset.adv + "/advance", {}); });
  }).catch(fail);

  if (tab === "pickup") {
    body.innerHTML = '<div class="g-order" style="max-width:520px"><h2 style="margin-top:0">Wareejin alaab</h2><p class="g-eta">Macmiilka ha hubiyo alaabta, kadibna ha ku tuso koodhkiisa 6-da lambar ah. Koodhka saxda ah ayaa dhammaystiraya dalabka oo lacagta iibiyaha u sii daaya. Koodhka shaqaalaha looma muujiyo.</p>' +
      '<form id="pkF"><input class="g-in ops-code" id="pkC" inputmode="numeric" maxlength="7" placeholder="000 000" autocomplete="off"><button class="btn g-buy full" style="margin-top:10px">Xaqiiji qaadashada</button></form><div id="pkR" style="margin-top:12px"></div></div>';
    $("pkC").focus();
    $("pkF").onsubmit = function (ev) {
      ev.preventDefault();
      call("POST", "/ops/pickup", { code: $("pkC").value }).then(function (r) {
        $("pkR").innerHTML = '<div class="g-found">✓ ' + e(r.order.title) + ' ×' + r.order.qty + ' → ' + e(r.order.customer) + ' · ' + r.order.id + ' dhammaaday. Lacagta waa la sii daayay.' + (r.referralPaid ? " Abaalmarinta saaxiibka waa la bixiyay." : "") + '</div>';
        $("pkC").value = ""; $("pkC").focus();
      }).catch(function (x) { $("pkR").innerHTML = '<div class="g-err sm">' + e(x.message) + '</div>'; });
    };
    return;
  }

  if (tab === "buy") return RF.procUI(body, call, reload);

  if (tab === "fbg") return RF.fbgOps(body, call, reload);

  if (tab === "quotes") return call("GET", "/quotes?all=1").then(function (j) {
    var list = j.quotes;
    body.innerHTML = '<p class="g-eta" style="max-width:75ch">Codsiyada alaabta aan katalogga ku jirin. Hubi isku-xigga, qiimee (¥ + rar + canshuur + faa\'iido 10%+), ku qor qiimaha doolarka ee kama dambaysta ah. Ballanta macmiilka: <b>saacado gudahood</b> — codsi ka weyn 4 saac waa casaan.</p>' +
      (list.length ? list.map(function (x) {
        var late = x.status === "pending" && Date.now() - Date.parse(x.createdAt) > 4 * 36e5;
        return '<div class="g-order' + (late ? " late" : "") + '"><div class="g-ohead"><div class="g-th">' + (x.icon || "📦") + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
          '<div class="g-eta">' + x.id + ' · ' + ago(x.createdAt) + ' kahor · ' + (x.url ? '<a href="' + e(x.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link);font-weight:700">' + e(RF.chName ? RF.chName(x.platform) : x.platform) + ' ↗</a>' : e(x.platform)) + (x.kg ? ' · ' + x.kg + ' kg' : "") + ' · ' + e(x.contact || "") + '</div>' +
          '<div class="g-eta">Qiyaasta nidaamka: ' + (x.estimate == null ? "aan la garanayn" : money(x.estimate)) + (x.note ? ' · “' + e(x.note) + '”' : "") + '</div>' +
          /* the services the buyer paid us to perform: the price you quote must already include them */
          (x.services && x.services.length
            ? '<div class="g-eta">🛠 ' + x.services.map(function (k) { var c = RF.api.config && RF.api.config.services; return e((c && c.items[k] && c.items[k].so) || k); }).join(" · ") +
              ' — adeegyo ' + money(x.serviceFee || 0) + (x.qty > 1 ? ' · ' + x.qty + ' xabbo' : "") + '</div>' : "") + '</div>' +
          (x.status === "pending" ? '<div class="g-oqty"><label class="g-eta">Qiimo $</label><input type="number" min="1" value="' + (x.estimate == null ? "" : x.estimate) + '" data-t="' + x.id + '"></div>' +
            '<div class="g-oqty"><label class="g-eta">Maalmo</label><input type="number" min="1" value="20" data-d="' + x.id + '"></div>' +
            '<button class="btn" data-q="' + x.id + '">Qiimee</button><button class="btn ghost" data-x="' + x.id + '">Diid</button>' :
            '<span class="g-pill ' + (x.status === "quoted" ? "" : "gold") + '">' + (x.status === "quoted" ? "✓ " + money(x.total) + " · " + x.etaDays + "m" : "La diiday") + '</span>') + '</div></div>';
      }).join("") : '<div class="g-empty sm">Codsi ma jiro weli.</div>');
    bind("[data-q]", function (b) { var id = b.dataset.q, t = +body.querySelector('[data-t="' + id + '"]').value, d = +body.querySelector('[data-d="' + id + '"]').value;
      if (!(t > 0)) return Promise.reject(new Error("Ku qor qiimo sax ah.")); return call("POST", "/ops/quotes/" + id, { action: "price", total: t, etaDays: d }); });
    bind("[data-x]", function (b) { var why = prompt("Sababta (macmiilka ayaa arkaya):", "Alaabtan ma keeni karno."); if (why === null) return null; return call("POST", "/ops/quotes/" + b.dataset.x, { action: "decline", note: why }); });
  }).catch(fail);

  if (tab === "issues") return call("GET", "/ops/orders").then(function (j) {
    var refunds = j.orders.filter(function (o) { return o.escrow === "refund_due"; }), disp = j.orders.filter(function (o) { return o.dispute && o.dispute.status === "open"; });
    body.innerHTML = '<div class="g-sec"><h2>Lacag celin</h2><span class="g-eta">U celi lambarka macmiilka, kadib calaamadee</span></div>' +
      (refunds.length ? refunds.map(function (o) { return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + money(o.total) + ' → ' + e(o.pay) + ' ' + e(o.payPhone ? "+" + o.payPhone : "") + '</b><div class="g-eta">' + o.id + ' · ' + e(o.title) + ' · ' + e(o.customer.name) + ' · ' + (o.state === "CANCELLED" ? "la joojiyay" : "cabasho") + (o.payTxn ? " · macaamil " + e(o.payTxn) : "") + '</div></div><button class="btn" data-rf="' + o.id + '">✓ Waa la celiyay</button></div></div>'; }).join("") : '<div class="g-empty sm">Lacag celin sugaysa ma jirto.</div>') +
      '<div class="g-sec"><h2>Cabashooyin</h2><span class="g-eta">Garsoore waa garsooraha — go\'aan 48 saac gudahood</span></div>' +
      (disp.length ? disp.map(function (o) { return '<div class="g-order late"><div class="g-ohead"><div style="flex:1"><b>' + e(o.title) + ' ×' + o.qty + ' · ' + money(o.total) + '</b><div class="g-eta">' + o.id + ' · ' + e(o.customer.name) + ' ' + e(o.customer.phone) + ' · ' + ago(o.dispute.at) + ' kahor</div><p style="margin:6px 0 0">“' + e(o.dispute.reason) + '”</p></div>' +
        '<button class="btn" data-dr="' + o.id + '">Celi lacagta</button><button class="btn ghost" data-dj="' + o.id + '">Diid</button></div></div>'; }).join("") : '<div class="g-empty sm">Cabasho furan ma jirto.</div>');
    bind("[data-rf]", function (b) { return call("POST", "/ops/orders/" + b.dataset.rf + "/refunded", {}); });
    bind("[data-dr]", function (b) { var n = prompt("Qoraal go'aanka (macmiilka ayaa arkaya):", "Waan ogolaanay — lacagta waa laguu celinayaa."); if (n === null) return null; return call("POST", "/ops/orders/" + b.dataset.dr + "/resolve", { refund: true, note: n }); });
    bind("[data-dj]", function (b) { var n = prompt("Sababta diidmada (macmiilka ayaa arkaya):"); if (!n) return null; return call("POST", "/ops/orders/" + b.dataset.dj + "/resolve", { refund: false, note: n }); });
  }).catch(fail);

  function kpi(label, val, sub, tone) { return '<div class="' + (tone || "") + '"><span>' + e(label) + '</span><b>' + e(val) + '</b><em>' + e(sub || "") + '</em></div>'; }
  function groupBaskets(list) { var g = {}, out = []; list.forEach(function (o) { var k = o.basket || o.id; if (!g[k]) out.push(g[k] = []); g[k].push(o); }); return out; }
  function all(ids, f) { return Promise.all(ids.split(",").map(f)); }
  function bind(sel, f) {
    [].forEach.call(body.querySelectorAll(sel), function (b) { b.onclick = function () {
      var p = f(b); if (!p) return; b.disabled = true;
      p.then(function () { toast("✓"); reload(); }).catch(function (x) { b.disabled = false; fail(x); });
    }; });
  }
};
})();
