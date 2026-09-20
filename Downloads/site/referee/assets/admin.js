/* Garsoore — admin panel (business.buurwen.com/admin.html). Role 'admin' only; the server enforces it.
   Accounts: consumer · business (seller / FBG / wholesale buyer / supplier / logistics) · agent · staff · admin.
   Everything here is logged in admin_log with who did it, so an account change can always be traced to a person. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
function when(iso) { return new Date(iso).toLocaleString("so-SO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
var TABS = [["home", "Guud"], ["users", "Akoonnada"], ["biz", "Ganacsiyada"], ["agents", "Wakiillada"], ["log", "Diiwaanka"]];
var ROLE_SO = { consumer: "Macmiil", business: "Ganacsi", agent: "Wakiil", staff: "Shaqaale", admin: "Maamule" };
var KINDS = {};

RF.adminUI = function (app, tab) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Maamulku wuxuu u baahan yahay server-ka (API).</div>'; return; }
  if (!RF.api.user) {
    app.innerHTML = '<div class="wrap g-empty">Maamulaha Garsoore oo keliya. <button class="btn" id="adIn">Gal</button></div>';
    $("adIn").onclick = function () { RF.authUI.open("Maamulaha Garsoore").then(function () { RF.adminUI(app, tab); }).catch(function () {}); };
    return;
  }
  if (RF.api.user.role !== "admin") { app.innerHTML = '<div class="wrap g-empty">Akoonkan (' + e(RF.api.user.name) + ' · ' + e(ROLE_SO[RF.api.user.role] || RF.api.user.role) + ') ma laha fasax maamul.</div>'; return; }
  var call = RF.api.call;
  app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:30px"><h1>Maamulka</h1><span class="g-eta">👤 ' + e(RF.api.user.name) + ' · maamule</span></div>' +
    '<div class="g-seg ops-tabs" id="adTabs">' + TABS.map(function (t) { return '<span data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + '>' + t[1] + '<em id="an-' + t[0] + '"></em></span>'; }).join("") + '</div>' +
    '<div id="adBody" style="margin-top:16px"><div class="g-empty sm">⏳</div></div></div>';
  $("adTabs").onclick = function (ev) { var t = ev.target.closest("span"); if (!t) return; history.replaceState(null, "", "?tab=" + t.dataset.t); RF.adminUI(app, t.dataset.t); };
  var body = $("adBody");
  function fail(x) { toast(x.message || "Khalad"); }
  function reload() { RF.adminUI(app, tab); }
  function act(sel, f) { [].forEach.call(body.querySelectorAll(sel), function (b) { b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true; p.then(function (r) { toast(r && r.pin ? "PIN cusub: " + r.pin : "✓"); reload(); }).catch(function (x) { b.disabled = false; fail(x); }); }; }); }

  call("GET", "/admin/overview").then(function (o) {
    KINDS = o.kinds;
    if (o.pending.b && $("an-biz")) $("an-biz").textContent = o.pending.b;
    if (o.pending.a && $("an-agents")) $("an-agents").textContent = o.pending.a;
    if (tab !== "home") return;
    var byRole = {}; o.roles.forEach(function (r) { byRole[r.role] = r.n; });
    var susp = (o.status.filter(function (x) { return x.status === "suspended"; })[0] || {}).n || 0;
    var kinds = {}; o.businesses.forEach(function (b) { kinds[b.kind] = (kinds[b.kind] || 0) + b.n; });
    body.innerHTML = '<div class="ops-kpi">' +
      Object.keys(o.roleList).map(function (r) { return '<div><span>' + e(ROLE_SO[r] || r) + '</span><b>' + (byRole[r] || 0) + '</b><em>' + e(o.roleList[r]) + '</em></div>'; }).join("") +
      '<div class="' + (susp ? "bad" : "") + '"><span>La hakiyay</span><b>' + susp + '</b><em>akoonno xidhan</em></div>' +
      '<div class="' + (o.pending.b || o.pending.a ? "bad" : "good") + '"><span>Sugaya ansixin</span><b>' + (o.pending.b + o.pending.a) + '</b><em>' + o.pending.b + ' ganacsi · ' + o.pending.a + ' wakiil</em></div></div>' +
      '<div class="g-sec"><h2>Noocyada ganacsiga</h2></div><div class="ops-kpi">' +
        Object.keys(o.kinds).map(function (k) { return '<div><span>' + e(o.kinds[k]) + '</span><b>' + (kinds[k] || 0) + '</b><em>' + k.toUpperCase() + '</em></div>'; }).join("") + '</div>' +
      '<div class="g-sec"><h2>Samee akoon</h2></div><div class="g-eta" style="margin-bottom:10px">Akoon cusub wuxuu ku bilaabmaa PIN ku meel gaadh ah oo qofku beddelayo markuu markii ugu horreysay galo.</div>' +
      '<button class="btn" id="adNew">+ Akoon cusub</button>';
    $("adNew").onclick = function () { newUser(function () { RF.adminUI(app, "users"); }); };
  }).catch(fail);

  if (tab === "users") {
    var q = new URLSearchParams(location.search).get("q") || "", role = new URLSearchParams(location.search).get("role") || "";
    body.innerHTML = '<div class="ad-bar"><input class="g-in" id="adQ" placeholder="Raadi magac ama lambar…" value="' + e(q) + '">' +
      '<select class="g-in" id="adRole"><option value="">Dhammaan noocyada</option>' + Object.keys(ROLE_SO).map(function (r) { return '<option value="' + r + '"' + (role === r ? " selected" : "") + '>' + ROLE_SO[r] + '</option>'; }).join("") + '</select>' +
      '<button class="btn" id="adNew3">+ Akoon cusub</button></div><div id="adList"><div class="g-empty sm">⏳</div></div>';
    var go = function () { location.href = "?tab=users&q=" + encodeURIComponent($("adQ").value) + "&role=" + $("adRole").value; };
    $("adQ").onkeydown = function (ev) { if (ev.key === "Enter") go(); };
    $("adRole").onchange = go;
    $("adNew3").onclick = function () { newUser(reload); };
    return call("GET", "/admin/users?q=" + encodeURIComponent(q) + "&role=" + role).then(function (j) {
      $("adList").innerHTML = j.users.length ? j.users.map(function (u) {
        return '<div class="g-order ad-row' + (u.status === "suspended" ? " cx" : "") + '"><div class="g-ohead"><div style="flex:1"><b>' + e(u.name) + '</b> <span class="ad-tag r-' + u.role + '">' + e(ROLE_SO[u.role] || u.role) + '</span>' +
          (u.status === "suspended" ? ' <span class="ad-tag sus">La hakiyay</span>' : "") + (u.mustChangePin ? ' <span class="ad-tag">PIN ku meel gaadh</span>' : "") +
          '<div class="g-eta">' + e(u.phone) + ' · ' + u.id + ' · ' + u.orders + ' dalab · dheeraad ' + money(u.credit) + ' · koodh ' + e(u.refCode) + ' · ' + when(u.createdAt) + '</div>' +
          (u.company ? '<div class="g-eta">🏢 ' + e(u.company) + ' · ' + e(KINDS[u.kind] || u.kind) + ' · ' + e(u.bizStatus) + '</div>' : "") +
          (u.agentStatus ? '<div class="g-eta">🤝 wakiil: ' + e(u.agentStatus) + '</div>' : "") + '</div>' +
          '<select class="g-in ad-sel" data-role="' + u.id + '"' + (u.role === "admin" ? " disabled" : "") + '>' + Object.keys(ROLE_SO).map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + (r === "admin" ? " disabled" : "") + '>' + ROLE_SO[r] + '</option>'; }).join("") + '</select>' +
          (u.role === "admin" ? "" : '<button class="btn ghost" data-sus="' + u.id + '" data-to="' + (u.status === "suspended" ? "active" : "suspended") + '">' + (u.status === "suspended" ? "Fur" : "Haki") + '</button>' +
            '<button class="btn ghost" data-pin="' + u.id + '">PIN cusub</button><button class="btn ghost" data-cr="' + u.id + '" data-c="' + u.credit + '">Dheeraad</button>') +
        '</div></div>';
      }).join("") : '<div class="g-empty sm">Akoon lama helin.</div>';
      body = $("adList");
      act("[data-sus]", function (b) { var n = prompt("Sababta (diiwaanka ayay gelaysaa):") ; if (n === null) return null; return call("POST", "/admin/users/" + b.dataset.sus, { status: b.dataset.to, note: n }); });
      act("[data-pin]", function (b) { return confirm("PIN ku meel gaadh ah oo cusub? Qofku wuu ka bixi doonaa, PIN-kuna waa la tusi doonaa.") ? call("POST", "/admin/users/" + b.dataset.pin, { resetPin: true }) : null; });
      act("[data-cr]", function (b) { var v = prompt("Dheeraadka cusub ($):", b.dataset.c); if (v === null) return null; var n = prompt("Sababta:") || ""; return call("POST", "/admin/users/" + b.dataset.cr, { credit: +v, note: n }); });
      [].forEach.call($("adList").querySelectorAll("[data-role]"), function (sel) {
        sel.onchange = function () { sel.disabled = true; call("POST", "/admin/users/" + sel.dataset.role, { role: sel.value }).then(function () { toast("✓ nooca waa la beddelay"); reload(); }).catch(function (x) { sel.disabled = false; fail(x); }); };
      });
    }).catch(fail);
  }

  if (tab === "biz") return call("GET", "/admin/businesses").then(function (j) {
    KINDS = j.kinds;
    body.innerHTML = j.businesses.length ? j.businesses.map(function (b) {
      return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + e(b.company) + '</b> <span class="ad-tag">' + e(b.kindName) + '</span> <span class="ad-tag ' + (b.status === "approved" ? "ok" : b.status === "pending" ? "" : "sus") + '">' + e(b.status) + '</span>' +
        '<div class="g-eta">' + b.id + ' · ' + e(b.owner) + ' ' + e(b.phone) + (b.city ? ' · ' + e(b.city) : "") + (b.regNo ? ' · diiwaan ' + e(b.regNo) : "") + ' · ' + when(b.createdAt) + '</div>' +
        '<div class="g-eta">Komishan: ' + (b.commission == null ? "caadi (8%)" : b.commission + "%") + (b.note ? ' · ' + e(b.note) : "") + '</div></div>' +
        (b.status !== "approved" ? '<button class="btn" data-ok="' + b.id + '">Ansixi</button>' : '<button class="btn ghost" data-pause="' + b.id + '">Haki</button>') +
        '<button class="btn ghost" data-com="' + b.id + '">Komishan</button></div></div>';
    }).join("") : '<div class="g-empty sm">Akoon ganacsi weli ma jiro.</div>';
    act("[data-ok]", function (b) { return call("POST", "/admin/businesses/" + b.dataset.ok, { status: "approved" }); });
    act("[data-pause]", function (b) { var n = prompt("Sababta hakinta:") ; if (n === null) return null; return call("POST", "/admin/businesses/" + b.dataset.pause, { status: "paused", note: n }); });
    act("[data-com]", function (b) { var v = prompt("Komishanka ganacsigan (%):", "8"); if (v === null) return null; return call("POST", "/admin/businesses/" + b.dataset.com, { commission: +v }); });
  }).catch(fail);

  if (tab === "agents") return call("GET", "/ops/agents").then(function (j) {
    body.innerHTML = '<p class="g-eta">Wakiilladu waxay qaataan mandate dadka kale, waxayna haystaan farqiga qiimaha. Ansixi kaliya qof aad aqoonsi ka heshay.</p>' +
      (j.agents.length ? j.agents.map(function (a) {
        return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + e(a.name) + '</b> <span class="ad-tag ' + (a.status === "approved" ? "ok" : a.status === "pending" ? "" : "sus") + '">' + e(a.status) + '</span>' +
          '<div class="g-eta">' + a.id + ' · ' + e(a.phone) + ' · awood ' + a.capacity + ' mandate · ' + (a.cats || []).join(", ") + ' · ' + (a.cities || []).join(", ") + ' · ' + when(a.createdAt) + '</div></div>' +
          (a.status !== "approved" ? '<button class="btn" data-aok="' + a.id + '">Ansixi</button>' : '<button class="btn ghost" data-apause="' + a.id + '">Haki</button>') +
          '<button class="btn ghost" data-ablock="' + a.id + '">Xidh</button></div></div>';
      }).join("") : '<div class="g-empty sm">Codsi wakiilnimo ma jiro.</div>') +
      '<div class="g-sec"><h2>Mandate-yada firfircoon</h2></div>' +
      (j.mandates.length ? '<div class="ad-tbl">' + j.mandates.map(function (m) {
        return '<div><span>' + m.id + '</span><span>' + e(m.title.slice(0, 40)) + '</span><span>' + (m.mode === "liquidity" ? "degdeg" : "faa\'iido") + '</span><span>' + money(m.floor) + '</span><span>' + e(m.state) + '</span><span>' + e(m.agentName || "—") + '</span></div>';
      }).join("") + '</div>' : '<div class="g-empty sm">Mandate firfircoon ma jiro.</div>');
    act("[data-aok]", function (b) { return call("POST", "/ops/agents/" + b.dataset.aok, { status: "approved" }); });
    act("[data-apause]", function (b) { return call("POST", "/ops/agents/" + b.dataset.apause, { status: "paused" }); });
    act("[data-ablock]", function (b) { var n = prompt("Sababta xidhitaanka:"); if (n === null) return null; return call("POST", "/ops/agents/" + b.dataset.ablock, { status: "blocked", note: n }); });
  }).catch(fail);

  if (tab === "log") return call("GET", "/admin/log").then(function (j) {
    body.innerHTML = j.log.length ? '<div class="ad-tbl log">' + j.log.map(function (x) {
      return '<div><span>' + when(x.at) + '</span><span>' + e(x.who) + '</span><span>' + e(x.action) + '</span><span>' + e(x.target || "") + '</span><span>' + e(x.detail || "") + '</span></div>';
    }).join("") + '</div>' : '<div class="g-empty sm">Diiwaanku waa madhan yahay.</div>';
  }).catch(fail);

  /* ---------------- create an account */
  function newUser(after) {
    var box = $("modalBox"), role = "consumer";
    function draw(msg, pinOut) {
      if (pinOut) {
        box.innerHTML = '<div class="g-co"><h2>Akoonka waa la sameeyay</h2><div class="g-paybox"><div class="g-lbl" style="margin:0">PIN ku meel gaadh ah</div><b class="g-amt">' + e(pinOut) + '</b>' +
          '<div class="g-eta">U sheeg qofka. Markuu galo waa inuu beddelaa. Halkan mar kale lama tusi doono.</div></div>' +
          '<button class="btn g-buy full" id="adDone">Waan qoray</button></div>';
        $("adDone").onclick = function () { $("modal").classList.remove("on"); after(); };
        return;
      }
      box.innerHTML = '<div class="g-co"><h2>Akoon cusub</h2><div class="g-sku">Nooca akoonku wuxuu go\'aaminayaa waxa uu arki karo</div>' +
        '<label class="g-lbl">Nooca</label><div class="g-pay ad-roles">' + ["consumer", "business", "agent", "staff"].map(function (r) { return '<div data-r="' + r + '" class="' + (role === r ? "on" : "") + '">' + ROLE_SO[r] + '</div>'; }).join("") + '</div>' +
        '<label class="g-lbl">Magaca</label><input class="g-in" id="nuName" placeholder="Magaca oo buuxa">' +
        '<label class="g-lbl">Lambarka taleefanka</label><input class="g-in" id="nuPhone" inputmode="tel" placeholder="61 5xx xxxx">' +
        (role === "business" ? '<label class="g-lbl">Shirkadda</label><input class="g-in" id="nuCo" placeholder="Magaca shirkadda">' +
          '<label class="g-lbl">Nooca ganacsiga</label><select class="g-in" id="nuKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + e(KINDS[k]) + '</option>'; }).join("") + '</select>' +
          '<label class="g-lbl">Magaalada</label><input class="g-in" id="nuCity" placeholder="Muqdisho">' +
          '<label class="g-lbl">Lambarka diiwaangelinta (ikhtiyaari)</label><input class="g-in" id="nuReg">' : "") +
        (role === "agent" ? '<label class="g-lbl">Magaalada</label><input class="g-in" id="nuCity" placeholder="Muqdisho">' +
          '<label class="g-lbl">Immisa mandate ayuu hal mar qaadi karaa?</label><input class="g-in" id="nuCap" type="number" min="1" max="50" value="5">' : "") +
        '<label class="g-lbl">PIN ku meel gaadh ah (faaruq = mid la abuuro)</label><input class="g-in" id="nuPin" inputmode="numeric" maxlength="6" placeholder="tusaale 4821">' +
        '<div class="g-err sm" id="nuErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
        '<button class="btn g-buy full" id="nuGo">Samee akoonka</button>' +
        '<div class="g-escrow">Wax kasta oo maamulku sameeyo waa la duubaa (diiwaanka). Maamule kale halkan lagama samayn karo.</div></div>';
      [].forEach.call(box.querySelectorAll("[data-r]"), function (d) { d.onclick = function () { role = d.dataset.r; draw(); }; });
      $("nuGo").onclick = function () {
        var b = { name: $("nuName").value, phone: $("nuPhone").value, role: role, pin: $("nuPin").value };
        if (role === "business") { b.company = $("nuCo").value; b.kind = $("nuKind").value; b.city = $("nuCity").value; b.regNo = $("nuReg").value; }
        if (role === "agent") { b.city = $("nuCity").value; b.capacity = +$("nuCap").value; }
        $("nuGo").disabled = true;
        call("POST", "/admin/users", b).then(function (r) { draw(null, r.pin); }).catch(function (x) { $("nuGo").disabled = false; draw(x.message); });
      };
    }
    draw();
    $("modal").classList.add("on");
  }
};

})();
