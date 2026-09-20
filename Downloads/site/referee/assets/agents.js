/* Garsoore — selling & buying agents (wakiillo), business.buurwen.com/agents.html
   A mandate hands a sale (or a purchase) to an agent who works the market for you. The agent's pay is the spread
   between your floor and what they actually achieve, so the incentive is visible on screen to both sides:
     Degdeg (liquidity) — you take your floor price, fast. The agent keeps the whole spread, with a hard price cap.
     Faa'iido (margin)  — you keep a share of the spread. Better for you, worse for the agent, so it takes longer to place.
   Everything the agent does to your listing is logged and shown to you (docs/DOCTRINE.md: the Referee Test). */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function ago(iso) { var m = Math.round((Date.now() - Date.parse(iso)) / 6e4); return m < 60 ? m + " daq" : m < 1440 ? Math.round(m / 60) + " saac" : Math.round(m / 1440) + " maalin"; }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
var STATE_SO = { OPEN: "Sugaya wakiil", ASSIGNED: "Wakiil ayaa qaatay", LISTED: "Suuqa ayuu ku jiraa", NEGOTIATING: "Gorgortan socda", SOLD: "La iibiyay", SETTLED: "Lacagta waa la qaybiyay", CANCELLED: "La joojiyay", EXPIRED: "Waqtigii dhamaaday" };
var TABS = [["mine", "Mandate-yadayda"], ["board", "Suuqa mandate-yada"], ["work", "Shaqadayda (wakiil)"], ["how", "Sida ay u shaqeyso"]];
var A = null;   // agent economics from /api/config

function split(mode, side, floor, price, sellerPct) {
  var spread = Math.max(0, side === "sell" ? price - floor : floor - price);
  var platform = spread * A.platformPct / 100, rest = spread - platform;
  var principal = rest * (mode === "liquidity" ? 0 : sellerPct) / 100;
  return { spread: spread, platform: platform, principal: principal, agent: rest - principal,
    principalTotal: side === "sell" ? floor + principal : price - principal };
}

RF.agentsUI = function (app, tab) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Wakiilladu waxay u baahan yihiin server-ka (API).</div>'; return; }
  A = (RF.api.config && RF.api.config.agent) || { capLiquidity: 15, capMargin: 40, platformPct: 10, sellerPctMin: 25, sellerPctMax: 80, defaultDays: 14 };
  var out = !RF.api.user;                 /* signed out: the explainer is public, the boards are not */
  var call = RF.api.call;
  app.innerHTML = '<div class="wrap"><section class="g-chero biz"><span class="g-tagw">GARSOORE WAKIIL</span><h1>Wakiil kaa iibiya — ama kuu soo iibiya.</h1>' +
    '<p>Dhig <b>mandate</b>: waxa aad haysato iyo qiimaha ugu yar ee aad aqbali karto. Wakiil la hubiyay ayaa suuqa geynaya, gorgortan kula galaya iibsadayaasha, rarka iyo wareejinta qabanaya. Faa\'iidada wakiilku waa <b>farqiga</b> u dhexeeya qiimahaaga iyo qiimaha uu gaadhsiiyo — sidaa darteed way kuu shaqeeyaan.</p>' +
    '<div class="ag-modes"><div><b>Degdeg</b><span>Qiimahaaga hoose ayaad hesha, dhaqso iyo wareeg badan. Wakiilku wuxuu haystaa farqiga oo dhan, qiimuhuna kama badan karo ' + A.capLiquidity + '%.</span></div>' +
      '<div><b>Faa\'iido</b><span>Waxaad haysataa ' + A.sellerPctMin + '–' + A.sellerPctMax + '% farqiga. Faa\'iido badan adiga, wakiilna waa ka yar — sidaa darteed way ka gaabis badan tahay in la qaato.</span></div></div>' +
    '<button class="btn gold" id="agNew">+ Mandate cusub</button></section>' +
    '<div class="g-seg ops-tabs" id="agTabs">' + TABS.map(function (t) { return '<span data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + '>' + t[1] + '</span>'; }).join("") + '</div>' +
    '<div id="agBody" style="margin-top:16px"><div class="g-empty sm">⏳</div></div></div>';
  if (out) {
    $("agBody").innerHTML = howHTML() + '<div class="g-empty" style="margin-top:16px">Gal si aad mandate u dhigto ama wakiil u noqoto. <button class="btn" id="agIn">Gal</button></div>';
    $("agNew").onclick = $("agIn").onclick = function () { RF.authUI.open("Wakiillada Garsoore").then(function () { RF.agentsUI(app, tab); }).catch(function () {}); };
    [].forEach.call(document.querySelectorAll("#agTabs span"), function (x) { x.classList.toggle("on", x.dataset.t === "how"); });
    document.getElementById("agTabs").onclick = function (ev) { var t = ev.target.closest("span"); if (t && t.dataset.t !== "how") RF.authUI.open("Wakiillada Garsoore").then(function () { RF.agentsUI(app, t.dataset.t); }).catch(function () {}); };
    return;
  }
  $("agTabs").onclick = function (ev) { var t = ev.target.closest("span"); if (!t) return; history.replaceState(null, "", "?tab=" + t.dataset.t); RF.agentsUI(app, t.dataset.t); };
  $("agNew").onclick = function () { newMandate(function () { RF.agentsUI(app, "mine"); }); };
  var body = $("agBody");
  function fail(x) { toast(x.message || "Khalad"); }
  function reload() { RF.agentsUI(app, tab); }

  if (tab === "how") { body.innerHTML = howHTML(); return; }

  if (tab === "mine") return call("GET", "/mandates?scope=mine").then(function (j) {
    body.innerHTML = j.mandates.length ? j.mandates.map(function (m) { return card(m, "principal"); }).join("")
      : '<div class="g-empty">Mandate weli ma lihid. <button class="btn" id="agNew2">+ Mandate cusub</button></div>';
    if ($("agNew2")) $("agNew2").onclick = function () { newMandate(reload); };
    wire();
  }).catch(fail);

  if (tab === "board") return call("GET", "/mandates?scope=open").then(function (j) {
    if (j.needAgent) {
      body.innerHTML = '<div class="g-empty">Suuqa mandate-yada waxaa arka wakiillada Garsoore ee la ansixiyay oo keliya. <div style="margin-top:12px"><button class="btn" id="agApply">Codso inaad wakiil noqoto</button></div></div>';
      $("agApply").onclick = function () { applyForm(reload); };
      return;
    }
    body.innerHTML = '<p class="g-eta">Mandate-yada furan. Degdeg = farqiga oo dhan adiga ayaa haysta (xadka qiimaha ' + A.capLiquidity + '%). Faa\'iido = farqiga waad la wadaagaysaa milkiilaha, laakiin xadkaagu waa ' + A.capMargin + '%.</p>' +
      (j.mandates.length ? j.mandates.map(function (m) { return card(m, "board"); }).join("") : '<div class="g-empty sm">Mandate furan ma jiro hadda.</div>');
    wire();
  }).catch(fail);

  if (tab === "work") return call("GET", "/mandates?scope=assigned").then(function (j) {
    var head = "";
    if (!j.agent) head = '<div class="g-order"><b>Ma tihid wakiil weli.</b><div class="g-eta" style="margin:6px 0 10px">Wakiilku wuxuu qaataa mandate-yo dad kale, wuxuuna haystaa farqiga qiimaha. Garsoore ayaa ansixiya wakiil kasta.</div><button class="btn" id="agApply2">Codso inaad wakiil noqoto</button></div>';
    else if (j.agent.status !== "approved") head = '<div class="g-order"><b>Codsigaagii wakiilnimo: ' + e(j.agent.status === "pending" ? "waa la eegayaa" : j.agent.status) + '</b><div class="g-eta">Garsoore ayaa kula soo xidhiidhaya.</div></div>';
    body.innerHTML = head + (j.mandates.length ? j.mandates.map(function (m) { return card(m, "agent"); }).join("") : '<div class="g-empty sm">Weli mandate ma qaadan. Eeg <a href="?tab=board">suuqa mandate-yada</a>.</div>');
    if ($("agApply2")) $("agApply2").onclick = function () { applyForm(reload); };
    wire();
  }).catch(fail);

  /* ---------------- one mandate card, rendered for the principal, for the board, or for the assigned agent */
  function card(m, view) {
    var sell = m.side === "sell", cap = Math.round(m.floor * (1 + m.capPct / 100)), capLo = Math.round(m.floor * (1 - m.capPct / 100));
    var sh = split(m.mode, m.side, m.floor, m.ask || (sell ? cap : capLo), m.sellerPct);
    var done = m.state === "SOLD" || m.state === "SETTLED", dead = m.state === "CANCELLED" || m.state === "EXPIRED";
    return '<div class="g-order ag-card' + (dead ? " cx" : "") + '"><div class="g-ohead"><div class="ag-badge ' + (m.mode === "liquidity" ? "liq" : "mar") + '">' + (m.mode === "liquidity" ? "DEGDEG" : "FAA\'IIDO") + '</div>' +
      '<div style="flex:1"><b>' + (sell ? "Iibi: " : "Ii soo iibi: ") + e(m.title) + '</b>' +
        '<div class="g-eta">' + m.id + ' · ' + m.qty + (m.unit ? " " + e(m.unit) : " xabbo") + ' · ' + (m.city ? e(m.city) + " · " : "") + '<b>' + e(STATE_SO[m.state] || m.state) + '</b>' +
          (m.agentName && view !== "agent" ? " · wakiil: " + e(m.agentName) : "") + (view !== "principal" && m.principal ? " · milkiile: " + e(m.principal) : "") + ' · ' + ago(m.createdAt) + ' kahor</div>' +
        (m.notes ? '<div class="g-eta">“' + e(m.notes) + '”</div>' : "") + '</div>' +
      '<div class="ag-nums"><div><span>' + (sell ? "Qiimahaaga hoose" : "Ugu badnaan") + '</span><b>' + money(m.floor) + '</b></div>' +
        '<div><span>Xadka wakiilka</span><b>' + money(sell ? cap : capLo) + '</b></div>' +
        (m.ask ? '<div><span>Qiimaha hadda</span><b>' + money(m.ask) + '</b></div>' : "") +
        (m.bestOffer ? '<div><span>Dalabka ugu fiican</span><b>' + money(m.bestOffer) + '</b></div>' : "") + '</div></div>' +
      (done && m.split ? '<div class="ag-split"><div><span>Qiimaha heshiiska</span><b>' + money(m.split.price) + '</b></div><div><span>Farqiga</span><b>' + money(m.split.spread) + '</b></div>' +
          '<div><span>Milkiilaha</span><b>' + money(m.split.principalTotal) + '</b></div><div><span>Wakiilka</span><b>' + money(m.split.agent) + '</b></div><div><span>Garsoore</span><b>' + money(m.split.platform) + '</b></div></div>'
        : '<div class="ag-fore"><span class="g-eta">Haddii uu ku iibiyo ' + money(sell ? cap : capLo) + ': milkiilaha ' + money(sh.principalTotal) + ' · wakiilka ' + money(sh.agent) + ' · Garsoore ' + money(sh.platform) + (m.mode === "liquidity" ? "" : " · " + m.sellerPct + "% farqiga milkiilaha") + '</span></div>') +
      '<div class="g-orow"><span class="g-eta">Waqtiga: ' + new Date(m.expiresAt).toLocaleDateString("so-SO", { day: "numeric", month: "short" }) + '</span><span class="g-oacts">' +
        (view === "board" ? '<button class="btn" data-claim="' + m.id + '">Qaado mandate-kan</button>' : "") +
        (view === "agent" && !done && !dead ? '<button class="btn ghost" data-ask="' + m.id + '" data-lo="' + (sell ? m.floor : capLo) + '" data-hi="' + (sell ? cap : m.floor) + '">Qiimo dhig</button>' +
          '<button class="btn ghost" data-offer="' + m.id + '">Diiwaangeli dalab</button><button class="btn" data-sold="' + m.id + '" data-lo="' + (sell ? m.floor : 1) + '" data-hi="' + (sell ? cap : m.floor) + '">Xidh heshiiska</button>' : "") +
        (view === "principal" && ["OPEN", "ASSIGNED", "LISTED"].indexOf(m.state) >= 0 ? '<button class="btn ghost" data-cancel="' + m.id + '">Jooji</button>' : "") +
        '<button class="btn ghost" data-log="' + m.id + '">Taariikhda</button></span></div><div id="log-' + m.id + '"></div></div>';
  }
  function wire() {
    function act(sel, f) { [].forEach.call(body.querySelectorAll(sel), function (b) { b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true; p.then(function () { toast("✓"); reload(); }).catch(function (x) { b.disabled = false; fail(x); }); }; }); }
    act("[data-claim]", function (b) { return call("POST", "/mandates/" + b.dataset.claim + "/claim", {}); });
    act("[data-ask]", function (b) { var v = prompt("Qiimaha aad suuqa u dhigayso ($" + b.dataset.lo + " – $" + b.dataset.hi + "):"); if (!v) return null; return call("POST", "/mandates/" + b.dataset.ask + "/ask", { ask: +v }); });
    act("[data-offer]", function (b) { var v = prompt("Dalabka iibsadaha ($):"); if (!v) return null; var who = prompt("Yaa bixiyay? (magac, ikhtiyaari)") || ""; return call("POST", "/mandates/" + b.dataset.offer + "/offer", { amount: +v, from: who }); });
    act("[data-sold]", function (b) { var v = prompt("Qiimaha heshiiska ($" + b.dataset.lo + " – $" + b.dataset.hi + "):"); if (!v) return null; var who = prompt("Iibsadaha (magac/lambar):") || ""; return call("POST", "/mandates/" + b.dataset.sold + "/sold", { price: +v, buyer: who }); });
    act("[data-cancel]", function (b) { var w = prompt("Sababta joojinta (ikhtiyaari):"); if (w === null) return null; return call("POST", "/mandates/" + b.dataset.cancel + "/cancel", { why: w }); });
    [].forEach.call(body.querySelectorAll("[data-log]"), function (b) {
      b.onclick = function () {
        var box = $("log-" + b.dataset.log);
        if (box.innerHTML) { box.innerHTML = ""; return; }
        box.innerHTML = '<div class="g-eta">⏳</div>';
        call("GET", "/mandates/" + b.dataset.log).then(function (j) {
          box.innerHTML = '<div class="ag-log">' + j.events.map(function (x) {
            return '<div><i>' + new Date(x.at).toLocaleString("so-SO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + '</i> <b>' + e(x.who) + '</b> ' +
              e({ created: "ayaa sameeyay mandate-ka", assigned: "ayaa qaatay", ask: "ayaa qiimo dhigay", offer: "dalab ayaa la diiwaangeliyay", sold: "heshiis ayaa la xidhay", settled: "lacagta waa la qaybiyay", cancelled: "waa la joojiyay", note: "" }[x.kind] || x.kind) +
              (x.amount ? " " + money(x.amount) : "") + (x.text ? ' — ' + e(x.text) : "") + '</div>'; }).join("") + '</div>';
        }).catch(fail);
      };
    });
  }

  /* ---------------- new mandate (with a live split preview, so nobody has to trust a number they cannot see) */
  function newMandate(after) {
    var st = { side: "sell", mode: "liquidity", sellerPct: 50, days: A.defaultDays };
    var box = $("modalBox");
    function draw(msg) {
      var floor = +($("mFloor") ? $("mFloor").value : 0) || 0;
      var cap = st.mode === "liquidity" ? A.capLiquidity : A.capMargin;
      var at = st.side === "sell" ? Math.round(floor * (1 + cap / 100)) : Math.round(floor * (1 - cap / 100));
      var sh = split(st.mode, st.side, floor, at, st.sellerPct);
      box.innerHTML = '<div class="g-co"><h2>Mandate cusub</h2><div class="g-sku">Wakiil ayaa kuu shaqeynaya — faa\'iidadiisu waa farqiga qiimaha</div>' +
        '<div class="g-pay ag-pick">' + [["sell", "Ii iibi (waan haystaa)"], ["buy", "Ii soo iibi (waan doonayaa)"]].map(function (x) { return '<div data-side="' + x[0] + '" class="' + (st.side === x[0] ? "on" : "") + '">' + x[1] + '</div>'; }).join("") + '</div>' +
        '<label class="g-lbl">Waa maxay?</label><input class="g-in" id="mTitle" placeholder="tusaale: 200 jeeg sonkor 50kg / Toyota Noah 2012" value="' + e($("mTitle") ? $("mTitle").value : "") + '">' +
        '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="mQty" type="number" min="1" value="' + (($("mQty") && $("mQty").value) || 1) + '"></div>' +
          '<div><label class="g-lbl">' + (st.side === "sell" ? "Qiimaha ugu yar ee aad aqbali karto ($)" : "Qiimaha ugu badan ee aad bixin karto ($)") + '</label><input class="g-in" id="mFloor" type="number" min="1" value="' + (floor || "") + '"></div></div>' +
        '<div class="ag-row"><div><label class="g-lbl">Magaalada</label><input class="g-in" id="mCity" placeholder="Muqdisho" value="' + e(($("mCity") && $("mCity").value) || "") + '"></div>' +
          '<div><label class="g-lbl">Muddada (maalmo)</label><input class="g-in" id="mDays" type="number" min="1" max="90" value="' + st.days + '"></div></div>' +
        '<label class="g-lbl">Nooca mandate-ka</label>' +
        '<div class="g-rad' + (st.mode === "liquidity" ? " on" : "") + '" data-mode="liquidity"><i></i><div><b>Degdeg</b> — qiimahaaga hoose, dhaqso<div class="g-eta">Wakiilku wuxuu haystaa farqiga oo dhan, qiimuhuna kama badan karo ' + A.capLiquidity + '%. Wakiillo badan ayaa qaata.</div></div></div>' +
        '<div class="g-rad' + (st.mode === "margin" ? " on" : "") + '" data-mode="margin"><i></i><div><b>Faa\'iido</b> — waad wadaagaysaa farqiga<div class="g-eta">Waxaad haysataa ' + st.sellerPct + '% farqiga; xadka qiimuhu waa ' + A.capMargin + '%. Waqti badan ayay qaadan kartaa in wakiil qaato.</div></div></div>' +
        (st.mode === "margin" ? '<label class="g-lbl">Qaybtaada farqiga: <b>' + st.sellerPct + '%</b></label><input id="mPct" type="range" min="' + A.sellerPctMin + '" max="' + A.sellerPctMax + '" step="5" value="' + st.sellerPct + '" style="width:100%">' : "") +
        '<label class="g-lbl">Faahfaahin (ikhtiyaari)</label><textarea class="g-in" id="mNotes" rows="2" placeholder="xaalada alaabta, halka ay taallo, waqtiga…">' + e(($("mNotes") && $("mNotes").value) || "") + '</textarea>' +
        (floor > 0 ? '<div class="ag-split"><div><span>Haddii uu gaadhsiiyo</span><b>' + money(at) + '</b></div><div><span>Farqiga</span><b>' + money(sh.spread) + '</b></div>' +
          '<div><span>' + (st.side === "sell" ? "Adiga" : "Adiga (waxaad bixinaysaa)") + '</span><b>' + money(sh.principalTotal) + '</b></div><div><span>Wakiilka</span><b>' + money(sh.agent) + '</b></div><div><span>Garsoore</span><b>' + money(sh.platform) + '</b></div></div>' : "") +
        '<div class="g-err sm" id="mErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
        '<button class="btn g-buy full" id="mGo">Dir mandate-ka</button>' +
        '<div class="g-escrow">🔒 Wax kasta oo wakiilku sameeyo waa la duubaa — taariikhda qiimaha iyo dalabyada adigaa arkaya. Mandate-ka waad joojin kartaa ilaa heshiis la xidho.</div></div>';
      [].forEach.call(box.querySelectorAll("[data-side]"), function (d) { d.onclick = function () { st.side = d.dataset.side; draw(); }; });
      [].forEach.call(box.querySelectorAll("[data-mode]"), function (d) { d.onclick = function () { st.mode = d.dataset.mode; draw(); }; });
      if ($("mPct")) $("mPct").oninput = function () { st.sellerPct = +this.value; draw(); };
      $("mFloor").oninput = function () { var v = this.value, p = this.selectionStart; draw(); $("mFloor").value = v; $("mFloor").setSelectionRange(p, p); $("mFloor").focus(); };
      $("mGo").onclick = function () {
        var t = $("mTitle").value.trim(), f = +$("mFloor").value;
        if (t.length < 3) return draw("Ku qor waxa aad rabto.");
        if (!(f > 0)) return draw("Ku qor qiimaha.");
        $("mGo").disabled = true;
        call("POST", "/mandates", { side: st.side, mode: st.mode, title: t, qty: +$("mQty").value || 1, floor: f, sellerPct: st.sellerPct,
          city: $("mCity").value, days: +$("mDays").value || A.defaultDays, notes: $("mNotes").value })
          .then(function () { $("modal").classList.remove("on"); toast("Mandate-ka waa la diray — wakiillada ayaa arki doona"); after(); })
          .catch(function (x) { $("mGo").disabled = false; draw(x.message); });
      };
    }
    draw();
    $("modal").classList.add("on");
  }

  function applyForm(after) {
    var box = $("modalBox"), cats = RF.catalog.CATS, picked = {};
    box.innerHTML = '<div class="g-co"><h2>Noqo wakiil Garsoore</h2><div class="g-sku">Waxaad qaadanaysaa mandate-yo dad kale, faa\'iidadaaduna waa farqiga qiimaha.</div>' +
      '<label class="g-lbl">Qaybaha aad xirfad u leedahay</label><div class="g-src" id="agCats">' + cats.map(function (c) { return '<a href="#" data-c="' + c.id + '">' + c.icon + ' ' + c.so + '</a>'; }).join("") + '</div>' +
      '<label class="g-lbl">Magaalooyinka</label><input class="g-in" id="agCity" placeholder="Muqdisho, Hargeysa">' +
      '<label class="g-lbl">Immisa mandate ayaad hal mar qaadi kartaa?</label><input class="g-in" id="agCap" type="number" min="1" max="50" value="5">' +
      '<button class="btn g-buy full" id="agGo">Dir codsiga</button>' +
      '<div class="g-escrow">Garsoore ayaa ansixiya wakiil kasta — aqoonsi iyo tixraac ayaa la weydiinayaa ka hor inta aan mandate lagu siin.</div></div>';
    $("agCats").onclick = function (ev) { var a = ev.target.closest("a"); if (!a) return; ev.preventDefault(); picked[a.dataset.c] = !picked[a.dataset.c]; a.style.background = picked[a.dataset.c] ? "var(--pri)" : ""; };
    $("agGo").onclick = function () {
      $("agGo").disabled = true;
      call("POST", "/agent/apply", { cats: Object.keys(picked).filter(function (k) { return picked[k]; }),
        cities: $("agCity").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), capacity: +$("agCap").value || 5 })
        .then(function () { $("modal").classList.remove("on"); toast("Codsigaagii waa la diray"); after(); })
        .catch(function (x) { $("agGo").disabled = false; toast(x.message); });
    };
    $("modal").classList.add("on");
  }

  function howHTML() {
    return '<div class="ag-how"><h3>Laba nooc oo mandate ah</h3>' +
      '<table class="ag-tbl"><tr><th></th><th>Degdeg</th><th>Faa\'iido</th></tr>' +
      '<tr><td>Waxaad hesha</td><td>Qiimahaaga hoose</td><td>Qiimahaaga hoose + ' + A.sellerPctMin + '–' + A.sellerPctMax + '% farqiga</td></tr>' +
      '<tr><td>Wakiilku wuxuu haystaa</td><td>Farqiga oo dhan (' + (100 - A.platformPct) + '% ka dib qaybta Garsoore)</td><td>Inta ka hadhay farqiga</td></tr>' +
      '<tr><td>Xadka qiimaha</td><td>+' + A.capLiquidity + '%</td><td>+' + A.capMargin + '%</td></tr>' +
      '<tr><td>Xawaaraha</td><td>Dhaqso — wakiillo badan ayaa qaata</td><td>Gaabis — wakiilku wax yar buu ka helayaa</td></tr>' +
      '<tr><td>Ugu fiican marka</td><td>Alaab badan, wareeg dhaqso ah, lacag degdeg ah</td><td>Alaab gaar ah, qiimo aan la aqoon, waqti aad haysato</td></tr></table>' +
      '<h3>Tusaale</h3><p class="g-eta">Waxaad haysataa qalab qiimihiisu hoosaadka yahay $1,000. Wakiilku wuxuu ku iibiyay $1,150 → farqigu waa $150. Garsoore waxay qaadataa ' + A.platformPct + '% farqiga ($' + (150 * A.platformPct / 100).toFixed(0) + ').<br>' +
      '<b>Degdeg:</b> adigu $1,000, wakiilku $' + (150 * (100 - A.platformPct) / 100).toFixed(0) + '.<br>' +
      '<b>Faa\'iido 50%:</b> adigu $' + (1000 + 150 * (100 - A.platformPct) / 100 / 2).toFixed(0) + ', wakiilku $' + (150 * (100 - A.platformPct) / 100 / 2).toFixed(0) + '.</p>' +
      '<h3>Waxa wakiilku samayn karo</h3><ul class="g-eta"><li>Qiimo dhig — laakiin kaliya xadka aad ogolaatay.</li><li>Gorgortan iyo diiwaangelin dalabyada.</li><li>Rar, keenis iyo wareejin (Garsoore ayaa taageeraya).</li><li>Wax kasta oo uu sameeyo waa la duubaa — adigaa arkaya taariikhda.</li></ul>' +
      '<h3>Waxa uusan samayn karin</h3><ul class="g-eta"><li>Kaama iibin karo wax ka hooseeya qiimahaaga.</li><li>Kama qaadi karo lacagtaada — Garsoore ayaa haya ilaa heshiisku dhammaado.</li><li>Ma beddeli karo nooca mandate-ka ama qaybta farqiga.</li></ul></div>';
  }
};
})();
