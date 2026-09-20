/* Garsoore FBG — Fulfilment by Garsoore (business.buurwen.com/fbg.html) + the staff view inside the ops console.
   Buy in China → ship to your Garsoore China suite → we receive, photograph, weigh, consolidate → freight to Mogadishu
   → then you choose: keep it, sell it on Garsoore, or hand it to an agent. The goods stay yours until they sell;
   Garsoore charges for the rail (receiving, freight, storage, pick & pack) and a commission on what sells. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return (n < 0 ? "−$" : "$") + Math.abs(Number(n || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function when(iso) { return new Date(iso).toLocaleDateString("so-SO", { day: "numeric", month: "short" }); }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
var STATE_SO = { EXPECTED: "La sugayo Shiinaha", RECEIVED: "Waa la helay (Shiinaha)", INSPECTED: "Waa la hubiyay", CONSOLIDATED: "Waa la isku daray", SHIPPED: "Waa la diray", ARRIVED: "Yimid Muqdisho", PROBLEM: "Dhibaato", CLOSED: "Xidhan" };
var DISP_SO = { keep: "Ii keen (aniga ayaa qaadanaya)", sell: "Ku iib Garsoore (FBG)", agent: "Wakiil ha iibiyo" };
var LEDGER_SO = { receiving: "Qaabilaad Shiinaha", storage: "Kayd", freight: "Rar", duty: "Canshuur", pickpack: "Diyaarin dalab", commission: "Komishan Garsoore", sale: "Iib", payout: "Lacag la bixiyay", adjust: "Saxitaan" };
var F = null;

RF.fbgUI = function (app) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">FBG waxay u baahan tahay server-ka.</div>'; return; }
  F = (RF.api.config && RF.api.config.fbg) || {};
  var call = RF.api.call;
  function intro(extra) {
    return '<div class="wrap"><section class="g-chero biz"><span class="g-tagw">GARSOORE FBG</span><h1>Ka soo iibso Shiinaha. Annaga ayaa qaabilayna, isku darayna, keenayna — kadibna waad iibin kartaa.</h1>' +
      '<p>Waxaad hesha <b>cinwaan Shiinaha oo kaliya adiga</b>. Iibiyayaashaadu halkaas ayay u soo diraan. Waxaan qaabilnaa, sawirnaa, miisaannaa, isku darnaa alaabtaada — kadibna hal shixnad ayaa Muqdisho timaadda. Alaabtu <b>adigaa iska leh</b> ilaa ay iibsanto.</p>' +
      '<ol class="g-how"><li><b>Iibso</b>Shiinaha (1688, JD, warshad…)</li><li><b>U dir</b>cinwaankaaga Garsoore China</li><li><b>Waan isku darnaa</b>oo aan keenaa</li><li><b>Dooro</b>qaado, iib, ama wakiil</li></ol></section>' + extra + '</div>';
  }
  if (!RF.api.user) {
    app.innerHTML = intro('<div class="g-empty">Gal si aad u hesho cinwaankaaga Shiinaha. <button class="btn" id="fbIn">Gal</button></div>');
    $("fbIn").onclick = function () { RF.authUI.open("FBG — Fulfilment by Garsoore").then(function () { RF.fbgUI(app); }).catch(function () {}); };
    return;
  }
  app.innerHTML = intro('<div id="fbBody"><div class="g-empty sm">⏳</div></div>');
  var body = $("fbBody");
  function fail(x) { toast(x.message || "Khalad"); }
  function reload() { RF.fbgUI(app); }
  function act(sel, f) { [].forEach.call(body.querySelectorAll(sel), function (b) { b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true; p.then(function () { toast("✓"); reload(); }).catch(function (x) { b.disabled = false; fail(x); }); }; }); }

  call("GET", "/fbg/me").then(function (j) {
    F = j.fees || F;
    if (!j.account) {
      body.innerHTML = '<div class="g-order"><b>Bilow FBG</b><div class="g-eta" style="margin:6px 0 12px">Waxaad hesha kood iyo cinwaan Shiinaha. Kharashka: qaabilaad $' + F.receivingPerCarton + ' sanduuqii · rar ' + F.seaPerKg + '$/kg (bad) ama ' + F.airPerKg + '$/kg (cir) · kayd bilaash ' + F.freeStorageDays + ' maalmood, kadib $' + F.storagePerCbmDay + '/cbm maalintii · komishan ' + F.commissionPct + '% marka la iibiyo.</div><button class="btn gold" id="fbGo">Samee akoon FBG</button></div>';
      $("fbGo").onclick = function () { call("POST", "/fbg/enroll", {}).then(reload).catch(fail); };
      return;
    }
    var inb = j.inbound, inv = j.inventory;
    body.innerHTML =
      '<div class="fb-addr"><div><div class="g-lbl" style="margin:0">Koodhkaaga</div><b class="g-mno">' + e(j.account.suite) + '</b>' +
        '<div class="g-eta">Koodhkan ku qor <b>sanduuq kasta</b> oo iibiyuhu kuu soo diro.</div></div>' +
        '<div><div class="g-lbl" style="margin:0">Cinwaanka Shiinaha (Garsoore)</div><div class="fb-addrtxt">' + e(j.address) + '</div>' +
        '<button class="chip" id="fbCopy">Koobbi cinwaanka</button></div>' +
        '<div><div class="g-lbl" style="margin:0">Xisaabtaada</div><b class="g-amt' + (j.balance < 0 ? " neg" : "") + '">' + money(j.balance) + '</b>' +
        '<div class="g-eta">' + (j.balance >= 0 ? "Garsoore ayaa kuu haysa" : "Waxaad ku leedahay Garsoore") + '</div></div></div>' +
      '<div class="g-sec"><h2>Shixnadaha soo socda</h2><button class="btn" id="fbNew">+ Ku sheeg shixnad</button></div>' +
      (inb.length ? inb.map(inboundCard).join("") : '<div class="g-empty sm">Weli shixnad ma jirto. Marka aad Shiinaha wax ka iibsato, halkan ku sheeg si aan u aqoonsanno markay timaaddo.</div>') +
      '<div class="g-sec"><h2>Kaydkaaga Muqdisho</h2><span class="g-eta">Alaabtu adigaa iska leh ilaa ay iibsanto</span></div>' +
      (inv.length ? inv.map(invCard).join("") : '<div class="g-empty sm">Weli kayd ma jiro.</div>') +
      '<div class="g-sec"><h2>Xisaabta</h2></div>' +
      (j.ledger.length ? '<div class="ad-tbl fb-led">' + j.ledger.map(function (l) {
        return '<div><span>' + when(l.at) + '</span><span>' + e(LEDGER_SO[l.kind] || l.kind) + '</span><span class="' + (l.amount < 0 ? "neg" : "pos") + '">' + money(l.amount) + '</span><span>' + e(l.ref || "") + '</span><span>' + e(l.note || "") + '</span></div>';
      }).join("") + '</div>' : '<div class="g-empty sm">Weli wax dhaqaale ah ma dhicin.</div>');
    $("fbCopy").onclick = function () { navigator.clipboard.writeText(j.address + " (" + j.account.suite + ")").then(function () { toast("Waa la koobbiyay"); }, function () {}); };
    $("fbNew").onclick = function () { newInbound(reload); };
    act("[data-cancel]", function (b) { return confirm("Ma joojinaysaa shixnaddan?") ? call("POST", "/fbg/inbound/" + b.dataset.cancel, { cancel: true }) : null; });
    [].forEach.call(body.querySelectorAll("[data-disp]"), function (sel) {
      sel.onchange = function () { sel.disabled = true; call("POST", "/fbg/inbound/" + sel.dataset.disp, { disposition: sel.value }).then(function () { toast("✓"); reload(); }).catch(function (x) { sel.disabled = false; fail(x); }); };
    });
    act("[data-unlist]", function (b) { return call("POST", "/fbg/inventory/" + b.dataset.unlist, { action: "unlist" }); });
    act("[data-release]", function (b) { return confirm("Alaabtan ma rabtaa in laguu diyaariyo qaadasho?") ? call("POST", "/fbg/inventory/" + b.dataset.release, { action: "release" }) : null; });
    [].forEach.call(body.querySelectorAll("[data-sell]"), function (b) { b.onclick = function () { sellSheet(b.dataset.sell, +b.dataset.landed || 0, +b.dataset.qty || 1, reload); }; });
  }).catch(fail);

  function inboundCard(x) {
    var live = ["EXPECTED", "RECEIVED", "INSPECTED", "CONSOLIDATED", "SHIPPED", "ARRIVED"], i = live.indexOf(x.state);
    return '<div class="g-order' + (x.state === "PROBLEM" ? " late" : "") + '"><div class="g-ohead"><div class="g-th">📦</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
      '<div class="g-eta">' + x.id + ' · ' + x.qtyExpected + ' xabbo' + (x.supplier ? ' · ' + e(x.supplier) : "") + (x.tracking ? ' · tracking ' + e(x.tracking) : "") + (x.value ? ' · ' + money(x.value) : "") + '</div>' +
      (x.kg ? '<div class="g-eta">' + x.cartons + ' sanduuq · ' + x.kg + ' kg' + (x.cbm ? ' · ' + x.cbm + ' cbm' : "") + (x.qtyReceived != null ? ' · la helay ' + x.qtyReceived + ' xabbo' : "") + '</div>' : "") +
      (x.problem ? '<div class="g-err sm" style="margin-top:6px">⚠ ' + e(x.problem) + '</div>' : "") +
      (x.photos.length ? '<div class="fb-photos">' + x.photos.map(function (u) { return '<a href="' + e(u) + '" target="_blank" rel="noopener noreferrer"><img src="' + e(u) + '" alt="" referrerpolicy="no-referrer"></a>'; }).join("") + '</div>' : "") + '</div>' +
      (["EXPECTED", "RECEIVED", "INSPECTED", "CONSOLIDATED"].indexOf(x.state) >= 0
        ? '<select class="g-in ad-sel" data-disp="' + x.id + '">' + Object.keys(DISP_SO).map(function (k) { return '<option value="' + k + '"' + (x.disposition === k ? " selected" : "") + '>' + DISP_SO[k] + '</option>'; }).join("") + '</select>' : '<span class="ad-tag">' + e(DISP_SO[x.disposition] || x.disposition) + '</span>') +
      (x.state === "EXPECTED" ? '<button class="btn ghost" data-cancel="' + x.id + '">Jooji</button>' : "") + '</div>' +
      (i >= 0 ? '<div class="g-track">' + live.map(function (s, k) { return '<div class="' + (k < i ? "d" : k === i ? "n" : "") + '"><i></i>' + STATE_SO[s] + '</div>'; }).join("") + '</div>' : "") + '</div>';
  }
  function invCard(x) {
    var net = x.price ? (x.price * (1 - (F.commissionPct || 10) / 100) - (F.pickPack || 1)) : 0;
    return '<div class="g-order"><div class="g-ohead"><div class="g-th">' + (x.icon || "📦") + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
      '<div class="g-eta">' + x.id + ' · diyaar ' + x.qtyAvailable + ' · la dalbaday ' + x.qtyReserved + ' · la iibiyay ' + x.qtySold + ' / ' + x.qtyTotal +
        (x.landedUnit ? ' · kharashkaagu ' + money(x.landedUnit) + '/xabbo' : "") + ' · ' + e(x.location || "") + '</div>' +
      (x.disposition === "listed" ? '<div class="g-eta">Suuqa: <b>' + money(x.price) + '</b> · adigu waxaad hesha <b>' + money(net) + '</b> xabbadii (komishan ' + (F.commissionPct || 10) + '% + diyaarin $' + (F.pickPack || 1) + ')</div>' : "") +
      (x.disposition === "agent" ? '<div class="g-eta">Wakiil ayaa haysta · <a href="agents.html?tab=mine" style="color:var(--link);font-weight:700">' + e(x.mandateId) + '</a></div>' : "") +
      (x.disposition === "release" ? '<div class="g-eta">Waa la diyaarinayaa in aad qaadato — Garsoore ayaa kula soo xidhiidhaya.</div>' : "") + '</div>' +
      (x.disposition === "listed" ? '<button class="btn ghost" data-unlist="' + x.id + '">Ka saar suuqa</button>' : "") +
      (["stored", "listed"].indexOf(x.disposition) >= 0 ? '<button class="btn" data-sell="' + x.id + '" data-landed="' + (x.landedUnit || 0) + '" data-qty="' + x.qtyAvailable + '">' + (x.disposition === "listed" ? "Beddel qiimaha" : "Iib / wakiil") + '</button>' : "") +
      (x.disposition === "stored" ? '<button class="btn ghost" data-release="' + x.id + '">Ii keen</button>' : "") + '</div></div>';
  }

  function newInbound(after) {
    var box = $("modalBox"), disp = "sell";
    function draw(msg) {
      box.innerHTML = '<div class="g-co"><h2>Ku sheeg shixnad</h2><div class="g-sku">Markaad Shiinaha wax ka iibsato, halkan noo sheeg — sidaa ayaan u aqoonsanaynaa markay timaaddo.</div>' +
        '<label class="g-lbl">Waa maxay alaabta?</label><input class="g-in" id="fiTitle" placeholder="tusaale: 500 kiis taleefan">' +
        '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="fiQty" type="number" min="1" value="1"></div>' +
          '<div><label class="g-lbl">Lacagta aad bixisay ($)</label><input class="g-in" id="fiVal" type="number" min="0" placeholder="canshuurta iyo caymiska"></div></div>' +
        '<div class="ag-row"><div><label class="g-lbl">Iibiyaha</label><input class="g-in" id="fiSup" placeholder="magaca iibiyaha / warshadda"></div>' +
          '<div><label class="g-lbl">Meesha</label><select class="g-in" id="fiPlat"><option value="1688">1688</option><option value="jd">JD</option><option value="taobao">Taobao</option><option value="mic">Made-in-China</option><option value="factory">Warshad toos</option><option value="other">Meel kale</option></select></div></div>' +
        '<label class="g-lbl">Tracking (ikhtiyaari)</label><input class="g-in" id="fiTrk" placeholder="lambarka boostada Shiinaha">' +
        '<label class="g-lbl">Maxaad ku samaynaysaa markay timaaddo?</label>' +
        Object.keys(DISP_SO).map(function (k) { return '<div class="g-rad' + (disp === k ? " on" : "") + '" data-d="' + k + '"><i></i>' + DISP_SO[k] + '</div>'; }).join("") +
        '<div class="g-err sm" id="fiErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
        '<button class="btn g-buy full" id="fiGo">Kaydi shixnadda</button>' +
        '<div class="g-escrow">Mar kasta waad beddeli kartaa go\'aankaaga ilaa alaabtu ka baxdo Shiinaha.</div></div>';
      [].forEach.call(box.querySelectorAll("[data-d]"), function (d) { d.onclick = function () { disp = d.dataset.d; draw(); }; });
      $("fiGo").onclick = function () {
        var t = $("fiTitle").value.trim();
        if (t.length < 2) return draw("Ku qor alaabta.");
        $("fiGo").disabled = true;
        call("POST", "/fbg/inbound", { title: t, qty: +$("fiQty").value || 1, value: +$("fiVal").value || 0, supplier: $("fiSup").value, platform: $("fiPlat").value, tracking: $("fiTrk").value, disposition: disp })
          .then(function () { $("modal").classList.remove("on"); toast("Waa la kaydiyay"); after(); })
          .catch(function (x) { $("fiGo").disabled = false; draw(x.message); });
      };
    }
    draw();
    $("modal").classList.add("on");
  }

  /* choose what to do with stock that has arrived: sell it yourself, or hand it to an agent */
  function sellSheet(id, landed, qty, after) {
    var box = $("modalBox"), mode = "self", agMode = "liquidity", pct = 50, A = (RF.api.config && RF.api.config.agent) || { capLiquidity: 15, capMargin: 40, platformPct: 10, sellerPctMin: 25, sellerPctMax: 80 };
    function draw(msg) {
      var price = +($("fsPrice") ? $("fsPrice").value : 0) || 0, floor = +($("fsFloor") ? $("fsFloor").value : 0) || 0;
      var net = price ? price * (1 - F.commissionPct / 100) - F.pickPack : 0;
      box.innerHTML = '<div class="g-co"><h2>' + e(id) + ' · ' + qty + ' xabbo</h2><div class="g-sku">' + (landed ? "Kharashkaagu waa " + money(landed) + " xabbadii" : "Dooro sidee loo iibinayo") + '</div>' +
        '<div class="g-pay ag-pick">' + [["self", "Aniga ayaa qiimeeya"], ["agent", "Wakiil ha iibiyo"]].map(function (x) { return '<div data-m="' + x[0] + '" class="' + (mode === x[0] ? "on" : "") + '">' + x[1] + '</div>'; }).join("") + '</div>' +
        (mode === "self"
          ? '<label class="g-lbl">Qiimaha suuqa ($ xabbadii)</label><input class="g-in" id="fsPrice" type="number" min="1" value="' + (price || "") + '">' +
            (price ? '<div class="ag-split"><div><span>Macmiilku wuxuu bixinayaa</span><b>' + money(price) + '</b></div><div><span>Komishan ' + F.commissionPct + '% + diyaarin</span><b>' + money(price * F.commissionPct / 100 + F.pickPack) + '</b></div>' +
              '<div><span>Adigu waxaad hesha</span><b>' + money(net) + '</b></div>' + (landed ? '<div><span>Faa\'iidadaada</span><b>' + money(net - landed) + '</b></div>' : "") + '</div>' : "") +
            '<div class="g-eta" style="margin-top:8px">Alaabtaadu waxay ka muuqan doontaa Garsoore.com sida "diyaar maanta" — Garsoore ayaa diyaarinaya oo wareejinaya.</div>'
          : '<div class="g-rad' + (agMode === "liquidity" ? " on" : "") + '" data-a="liquidity"><i></i><div><b>Degdeg</b> — qiimahaaga hoose, dhaqso<div class="g-eta">Wakiilku wuxuu haystaa farqiga (xadka +' + A.capLiquidity + '%).</div></div></div>' +
            '<div class="g-rad' + (agMode === "margin" ? " on" : "") + '" data-a="margin"><i></i><div><b>Faa\'iido</b> — waad wadaagaysaa farqiga<div class="g-eta">Waxaad haysataa ' + pct + '% farqiga (xadka +' + A.capMargin + '%).</div></div></div>' +
            (agMode === "margin" ? '<label class="g-lbl">Qaybtaada farqiga: <b>' + pct + '%</b></label><input id="fsPct" type="range" min="' + A.sellerPctMin + '" max="' + A.sellerPctMax + '" step="5" value="' + pct + '" style="width:100%">' : "") +
            '<label class="g-lbl">Qiimaha ugu yar ee aad aqbali karto ($ xabbadii)</label><input class="g-in" id="fsFloor" type="number" min="1" value="' + (floor || "") + '">') +
        '<div class="g-err sm" id="fsErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
        '<button class="btn g-buy full" id="fsGo">' + (mode === "self" ? "Ku dhig suuqa" : "U dir wakiillada") + '</button></div>';
      [].forEach.call(box.querySelectorAll("[data-m]"), function (d) { d.onclick = function () { mode = d.dataset.m; draw(); }; });
      [].forEach.call(box.querySelectorAll("[data-a]"), function (d) { d.onclick = function () { agMode = d.dataset.a; draw(); }; });
      if ($("fsPct")) $("fsPct").oninput = function () { pct = +this.value; draw(); };
      if ($("fsPrice")) $("fsPrice").oninput = function () { var v = this.value; draw(); $("fsPrice").value = v; $("fsPrice").focus(); };
      $("fsGo").onclick = function () {
        var p = mode === "self" ? { action: "list", price: +$("fsPrice").value } : { action: "agent", mode: agMode, sellerPct: pct, floor: +$("fsFloor").value };
        $("fsGo").disabled = true;
        call("POST", "/fbg/inventory/" + id, p).then(function () { $("modal").classList.remove("on"); toast("✓"); after(); })
          .catch(function (x) { $("fsGo").disabled = false; draw(x.message); });
      };
    }
    draw();
    $("modal").classList.add("on");
  }
};

/* ---------------------------------------------------------------- staff: the buying queue (paid orders -> Chinese vendors)
   No marketplace in China lets an outside merchant order through an API, so the job is made one-click instead:
   the exact link, the quantity, the most that may be paid, and the reference code for the carton. */
RF.procUI = function (body, call, reload) {
  call("GET", "/ops/procurement").then(function (j) {
    var t = j.tasks;
    body.innerHTML = '<p class="g-eta">Dalab kasta oo la bixiyay oo Shiinaha laga keenayo halkan ayuu ku soo baxaa. Iibso, ku qor lacagta aad bixisay iyo tracking-ga — kadib alaabta ayaa dalabka horay u wadda.</p>' +
      '<div class="cs-note" style="margin-bottom:12px">Cinwaanka loo dirayo: <b>' + e(j.address) + '</b> — <b>tixraaca PO</b> ku qor sanduuqa.</div>' +
      (t.length ? t.map(function (p) {
        var over = p.paidCny && p.targetCny && p.paidCny > p.targetCny;
        return '<div class="g-order' + (over ? " late" : "") + '"><div class="g-ohead"><div class="g-th">\u{1F6D2}</div><div style="flex:1">' +
          '<b>' + e(p.title) + ' \u00d7' + p.qty + '</b> <span class="ad-tag">' + e(p.state) + '</span>' +
          '<div class="g-eta">' + p.id + ' \u00b7 dalab ' + e(p.orderId) + ' \u00b7 ' + e(p.customer ? p.customer.name : "") + ' \u00b7 ' +
            (p.sourceUrl ? '<a href="' + e(p.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link);font-weight:700">' + e(p.platform) + ' \u2197</a>' : e(p.platform || "")) + '</div>' +
          '<div class="g-eta">Qiyaasta katalogga: <b>' + (p.targetCny ? "\u00a5" + p.targetCny : "\u2014") + '</b>' +
            (p.paidCny ? ' \u00b7 aad bixisay <b>\u00a5' + p.paidCny + '</b>' + (over ? ' \u26a0 ka badan qiyaasta' : "") : "") +
            (p.tracking ? ' \u00b7 ' + e(p.tracking) : "") + (p.kg ? ' \u00b7 ' + p.cartons + ' sanduuq ' + p.kg + ' kg' : "") + '</div>' +
          (p.note ? '<div class="g-eta">\u201c' + e(p.note) + '\u201d</div>' : "") + '</div>' +
          (p.state === "QUEUED" ? '<button class="btn" data-po="' + p.id + '">Waan iibsaday</button>' : "") +
          (p.state === "ORDERED" ? '<button class="btn" data-prec="' + p.id + '">Waa la helay Shiinaha</button>' : "") +
          '<button class="btn ghost" data-pnote="' + p.id + '">Qoraal</button>' +
          (["QUEUED", "ORDERED"].indexOf(p.state) >= 0 ? '<button class="btn ghost" data-pcx="' + p.id + '">Jooji</button>' : "") + '</div></div>';
      }).join("") : '<div class="g-empty sm">Shaqo iibsi ma jirto \u2014 dalab kasta oo la bixiyay ayaa halkan ku soo bixi doona.</div>');
    function bind(sel, f) {
      [].forEach.call(body.querySelectorAll(sel), function (b) {
        b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true;
          p.then(function (r) { toast(r && r.overTarget ? "\u2713 laakiin \u00a5" + r.overTarget + " ka badan qiyaasta" : "\u2713"); reload(); })
           .catch(function (x) { b.disabled = false; toast(x.message); }); };
      });
    }
    bind("[data-po]", function (b) {
      var paid = prompt("Immisa ayaad bixisay? (\u00a5)"); if (!paid) return null;
      var trk = prompt("Tracking-ga iibiyuhu ku siiyay (ikhtiyaari):") || "";
      var sup = prompt("Iibiyaha (ikhtiyaari):") || "";
      return call("POST", "/ops/procurement/" + b.dataset.po + "/ordered", { paidCny: +paid, tracking: trk, supplier: sup });
    });
    bind("[data-prec]", function (b) {
      var c = prompt("Immisa sanduuq?", "1"); if (c === null) return null;
      var kg = prompt("Miisaanka (kg)?"); if (!kg) return null;
      var cbm = prompt("Cabbirka (cbm, ikhtiyaari)?") || "0";
      return call("POST", "/ops/procurement/" + b.dataset.prec + "/received", { cartons: +c, kg: +kg, cbm: +cbm });
    });
    bind("[data-pnote]", function (b) { var n = prompt("Qoraal:"); if (n === null) return null; return call("POST", "/ops/procurement/" + b.dataset.pnote + "/note", { note: n }); });
    bind("[data-pcx]", function (b) { var n = prompt("Sababta joojinta (dalabka macmiilka waa in la joojiyaa oo lacagta la celiyaa):"); if (!n) return null; return call("POST", "/ops/procurement/" + b.dataset.pcx + "/cancel", { note: n }); });
  }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });
};

/* ---------------------------------------------------------------- staff: China facility + warehouse (ops console tab) */
RF.fbgOps = function (body, call, reload) {
  var pick = {};
  call("GET", "/ops/fbg").then(function (j) {
    F = j.fees;
    body.innerHTML = '<p class="g-eta">Xarunta Shiinaha: qaabil sanduuqyada, sawir, miisaan, kadib isku dar oo dir. Marka ay Muqdisho yimaadaan, alaabtu waxay noqonaysaa kayd milkiilaha leeyahay.</p>' +
      (j.purchases || []).map(function (p) {
        return '<div class="g-order"><div class="g-ohead">' +
          (p.state === "IN_CHINA" ? '<input type="checkbox" data-pick="' + p.id + '" style="width:20px;height:20px">' : '<div class="g-th">\u{1F6D2}</div>') +
          '<div style="flex:1"><b>' + e(p.title) + ' \u00d7' + p.qty + '</b> <span class="ad-tag">Garsoore</span> <span class="ad-tag">' + e(p.state) + '</span>' +
          '<div class="g-eta">' + p.id + ' \u00b7 dalab ' + e(p.orderId) + ' \u00b7 ' + (p.tracking ? e(p.tracking) : "tracking ma jiro") +
            (p.kg ? ' \u00b7 ' + p.cartons + ' sanduuq ' + p.kg + ' kg' : "") + '</div></div>' +
          (p.state === "ORDERED" ? '<button class="btn" data-prec2="' + p.id + '">Waa la helay</button>' : "") + '</div></div>';
      }).join("") +
      (j.inbound.length ? j.inbound.map(function (x) {
        return '<div class="g-order' + (x.state === "PROBLEM" ? " late" : "") + '"><div class="g-ohead">' +
          (["RECEIVED", "INSPECTED"].indexOf(x.state) >= 0 ? '<input type="checkbox" data-pick="' + x.id + '" style="width:20px;height:20px">' : '<div class="g-th">📦</div>') +
          '<div style="flex:1"><b>' + e(x.title) + '</b> <span class="ad-tag">' + e(x.suite || "—") + '</span> <span class="ad-tag">' + e(STATE_SO[x.state] || x.state) + '</span>' +
          '<div class="g-eta">' + x.id + ' · ' + e(x.owner) + ' ' + e(x.phone) + ' · ' + x.qtyExpected + ' xabbo · ' + e(x.supplier || "") + ' ' + e(x.tracking || "") + ' · ' + DISP_SO[x.disposition] + '</div>' +
          (x.kg ? '<div class="g-eta">' + x.cartons + ' sanduuq · ' + x.kg + ' kg · ' + (x.cbm || 0) + ' cbm' + (x.consignment ? ' · ' + x.consignment : "") + '</div>' : "") +
          (x.problem ? '<div class="g-err sm" style="margin-top:6px">⚠ ' + e(x.problem) + '</div>' : "") + '</div>' +
          (x.state === "EXPECTED" ? '<button class="btn" data-rec="' + x.id + '" data-q="' + x.qtyExpected + '">Qaabil</button>' : "") +
          (x.state === "RECEIVED" ? '<button class="btn" data-insp="' + x.id + '">Hubi</button>' : "") +
          (["EXPECTED", "RECEIVED", "INSPECTED"].indexOf(x.state) >= 0 ? '<button class="btn ghost" data-prob="' + x.id + '">Dhibaato</button>' : "") + '</div></div>';
      }).join("") : '<div class="g-empty sm">Shixnad ma jirto.</div>') +
      '<div class="g-orow" style="margin:12px 0"><span class="g-eta" id="fbPickN">0 la doortay</span><span class="g-oacts">' +
        '<button class="btn ghost" id="fbConsSea">Isku dar → bad</button><button class="btn" id="fbConsAir">Isku dar → cir</button></span></div>' +
      '<div class="g-sec"><h2>Shixnadaha rarka</h2></div>' +
      (j.consignments.length ? j.consignments.map(function (c) {
        return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + c.id + ' · ' + (c.mode === "air" ? "cir" : "bad") + '</b>' +
          '<div class="g-eta">' + (c.kg || 0) + ' kg · ' + (c.cbm || 0) + ' cbm · ' + e(c.state) + (c.awb ? ' · ' + e(c.awb) : "") + (c.cost ? ' · kharash ' + money(c.cost) : "") + '</div></div>' +
          (c.state === "OPEN" ? '<button class="btn" data-ship="' + c.id + '">Dir</button>' : '<button class="btn" data-arr="' + c.id + '">Yimid Muqdisho</button>') + '</div></div>';
      }).join("") : '<div class="g-empty sm">Shixnad rar ah ma jirto.</div>') +
      '<div class="g-sec"><h2>Alaab la rabo in la qaado</h2></div>' +
      (j.releases.length ? j.releases.map(function (x) {
        return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + e(x.title) + '</b><div class="g-eta">' + x.id + ' · ' + e(x.owner) + ' · ' + x.qtyAvailable + ' xabbo · ' + e(x.location || "") + '</div></div>' +
          '<button class="btn" data-rel="' + x.id + '">Waa la wareejiyay</button></div></div>';
      }).join("") : '<div class="g-empty sm">Mid ma jiro.</div>');

    function sel() { return Object.keys(pick).filter(function (k) { return pick[k]; }); }
    [].forEach.call(body.querySelectorAll("[data-pick]"), function (c) { c.onchange = function () { pick[c.dataset.pick] = c.checked; $("fbPickN").textContent = sel().length + " la doortay"; }; });
    function bind(sel2, f) { [].forEach.call(body.querySelectorAll(sel2), function (b) { b.onclick = function () { var p = f(b); if (!p) return; b.disabled = true; p.then(function () { toast("✓"); reload(); }).catch(function (x) { b.disabled = false; toast(x.message); }); }; }); }
    bind("[data-rec]", function (b) {
      var cartons = prompt("Immisa sanduuq?", "1"); if (cartons === null) return null;
      var kg = prompt("Miisaanka guud (kg)?"); if (!kg) return null;
      var cbm = prompt("Cabbirka (cbm, ikhtiyaari)?") || "0";
      var qty = prompt("Immisa xabbo ayaa ku jira?", b.dataset.q) || b.dataset.q;
      var ph = prompt("Link sawir (ikhtiyaari, kala saar comma):") || "";
      return call("POST", "/ops/fbg/inbound/" + b.dataset.rec + "/receive", { cartons: +cartons, kg: +kg, cbm: +cbm, qty: +qty, photos: ph.split(",").map(function (x) { return x.trim(); }).filter(Boolean) });
    });
    bind("[data-insp]", function (b) { var n = prompt("Natiijada hubinta (ikhtiyaari):") ; if (n === null) return null; return call("POST", "/ops/fbg/inbound/" + b.dataset.insp + "/inspect", { note: n }); });
    bind("[data-prob]", function (b) { var n = prompt("Dhibaatada (tirada yar, jab, alaab khaldan):"); if (!n) return null; return call("POST", "/ops/fbg/inbound/" + b.dataset.prob + "/problem", { note: n }); });
    bind("[data-ship]", function (b) { var awb = prompt("AWB / B/L:") || ""; var cost = prompt("Kharashka rarka ($, faaruq = xisaabi):") || ""; var eta = prompt("Goorta la filayo (tusaale 2026-10-12):") || ""; return call("POST", "/ops/fbg/consignments/" + b.dataset.ship + "/ship", { awb: awb, cost: +cost || 0, eta: eta }); });
    bind("[data-arr]", function (b) { return confirm("Ma xaqiijinaysaa inay Muqdisho timid? Alaabtu waxay noqonaysaa kayd.") ? call("POST", "/ops/fbg/consignments/" + b.dataset.arr + "/arrive", {}) : null; });
    bind("[data-rel]", function (b) { return call("POST", "/ops/fbg/inventory/" + b.dataset.rel + "/released", {}); });
    bind("[data-prec2]", function (b) {
      var c = prompt("Immisa sanduuq?", "1"); if (c === null) return null;
      var kg = prompt("Miisaanka (kg)?"); if (!kg) return null;
      return call("POST", "/ops/procurement/" + b.dataset.prec2 + "/received", { cartons: +c, kg: +kg, cbm: +(prompt("cbm (ikhtiyaari)?") || 0) });
    });

    $("fbConsSea").onclick = function () { cons("sea"); };
    $("fbConsAir").onclick = function () { cons("air"); };
    function cons(mode) {
      var ids = sel(); if (!ids.length) return toast("Dooro shixnado la isku darayo.");
      call("POST", "/ops/fbg/consolidate", { ids: ids, mode: mode }).then(function (r) { toast("✓ " + r.items + " la isku daray · " + r.kg + " kg"); reload(); }).catch(function (x) { toast(x.message); });
    }
  }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });
};
})();
