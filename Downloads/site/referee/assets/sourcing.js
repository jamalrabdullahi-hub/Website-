/* Garsoore — the purchaser-agent storefront (window.RF.sourcingUI), business.<domain>/sourcing.html

   This is the front door of the SERVICE, not just a form. A trader arrives with a link or a description and leaves
   with an agent who will go and source it. So the page states the whole deal before anything is typed: the two ways
   to engage (a $50/month subscription, or a 30% deposit), the $500 goods minimum, and the commission — 5% down to 3%
   of the GOODS value, never the shipping — and who that commission pays (the sales agent who owns the client, the
   China agent who sources it, and Garsoore).

   "Assign yourself an agent" is a picker here, not a support ticket. A client with no agent is a sale nobody is paid
   for, so if they do not choose, Garsoore assigns the approved sales agent carrying the fewest clients.

   Nothing about a cancellation charge is discovered later; a rule you only learn when it is applied to you is a
   trap, however fair the number is. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function when(iso) { return iso ? new Date(iso).toLocaleDateString("so-SO", { day: "numeric", month: "short" }) : "—"; }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }

var STATE = {
  AWAITING_DEPOSIT: ["Sugaya carbuun", "gold"], SOURCING: ["Waa la raadinayaa", ""], QUOTED: ["Qiimo waa diyaar", "gold"],
  ACCEPTED: ["Waa la aqbalay", ""], ORDERED: ["Waa la dalbaday", ""], DELIVERED: ["Waa la keenay", ""],
  CANCELLED: ["La joojiyay", ""], UNSOURCEABLE: ["Lama heli karin", ""], DECLINED: ["La diiday", ""]
};
var CARD = "flex:1;min-width:230px;border:1px solid var(--line,#e4e7ec);border-radius:14px;padding:14px 16px;background:var(--card,#fff)";
var CARD_ON = CARD + ";border-color:var(--link,#1d4ed8);box-shadow:0 0 0 3px rgba(29,78,216,.10)";
function commLabel(C) { if (!C || !C.tiers || !C.tiers.length) return "5%–3%"; var r = C.tiers.map(function (t) { return t.rate; }); return r[0] + "%–" + r[r.length - 1] + "%"; }

RF.sourcingUI = function (app) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  var call = RF.api.call, CFG = RF.api.config || {};
  var T = CFG.sourcing || { depositPct: 30, subscriptionUsd: 50, cancelDecayPctPerDay: 5, minDeposit: 20, quoteValidDays: 7, commission: {} };
  var COMM = T.commission || { tiers: [{ from: 0, rate: 5 }, { from: 5000, rate: 3 }], salesPct: 50, chinaPct: 25, minGoods: 500 };
  var signedIn = !!RF.api.user;

  function plans(sub) {
    return '<div class="g-sec"><h2>Laba nooc oo lacag bixin</h2></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
        '<div style="' + (sub.active ? CARD_ON : CARD) + '"><b>Rukni</b>' +
          '<div style="font-size:26px;font-weight:700;margin:4px 0">' + money(T.subscriptionUsd) + '<span style="font-size:13px;color:var(--muted)">/bishii</span></div>' +
          '<ul style="margin:6px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.6">' +
            '<li>Carbuun ma jiro</li><li>Xaddidaad qiime ma jiro — xitaa wax yar</li><li>Wakiil ayaa raadiya, gorgortama, hubiya</li></ul>' +
          (sub.active ? '<div style="margin-top:8px"><span class="g-pill">✓ Waad ku jirtaa ilaa ' + when(sub.until) + '</span></div>' : '') + '</div>' +
        '<div style="' + CARD + '"><b>Carbuun</b>' +
          '<div style="font-size:26px;font-weight:700;margin:4px 0">' + T.depositPct + '%<span style="font-size:13px;color:var(--muted)"> alaabta</span></div>' +
          '<ul style="margin:6px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.6">' +
            '<li>Carbuun = ' + T.depositPct + '% ee qiimaha alaabta (rar ma aha)</li>' +
            '<li>Ugu yaraan <b>' + money(COMM.minGoods || 500) + '</b> oo alaab</li>' +
            '<li>Aan helin karin? carbuunka oo dhan waa laguu celiyaa</li></ul></div>' +
      '</div>' +
      '<p class="g-eta" style="max-width:78ch;margin-top:10px">Komishanku waa <b>' + commLabel(COMM) + '</b> ee <b>qiimaha alaabta oo keliya</b> — rarka lagama qaadayo. ' +
      'Wakiilkaaga iibi (sales agent) wuxuu ka qaataa <b>' + (COMM.salesPct || 50) + '%</b>, wakiilka Shiinaha qayb, Garsoore inta kale. ' +
      '<b>MOQ:</b> ' + money(COMM.minGoods || 500) + ' oo alaab, ama rukni.</p>';
  }
  function agentPicker(reps, sel) {
    return '<label class="g-lbl" style="margin-top:10px">Wakiilkaaga (sales agent) — ama Garsoore ha kuu dooro</label>' +
      '<select class="g-in" id="srAgent"><option value="">— Garsoore ha ii dooro —</option>' +
      (reps || []).map(function (r) { return '<option value="' + e(r.userId) + '"' + (r.userId === sel ? " selected" : "") + '>' + e(r.name) + (r.city ? ' · ' + e(r.city) : "") + (r.clients != null ? ' · ' + r.clients + ' macmiil' : "") + '</option>'; }).join("") + '</select>';
  }
  function hero(extra) {
    return '<div class="wrap"><section class="g-chero biz"><span class="g-tagw">GARSOORE — WAKIILKAAGA IIBSIGA</span>' +
      '<h1>Tus alaabta. Inteeda kale annagaa qabanayna.</h1>' +
      '<p>Ku dheji link Alibaba, 1688 ama Made-in-China — ama kaliya <b>sharax waxa aad rabto</b>. Wakiilkeennu wuu la ' +
      'xiriirayaa warshadda, wuu la gorgortamayaa, wuuna hubinayaa inay dhab tahay. Waxaad hesha <b>hal qiime</b>.</p>' +
      '<ol class="g-how"><li><b>Warshadda</b>waan raadinaa oo aan la gorgortamnaa</li><li><b>Dekedda</b>annaga ayaa qabanayna</li>' +
      '<li><b>Gudbinta</b>canshuurta iyo warqadaha</li><li><b>Muqdisho</b>gacantaada</li></ol>' + extra + '</section></div>';
  }

  var repsP = call("GET", "/reps?kind=sales").then(function (j) { return (j && j.reps) || []; }).catch(function () { return []; });
  var dataP = signedIn ? call("GET", "/sourcing") : Promise.resolve(null);

  Promise.all([repsP, dataP]).then(function (a) {
    var reps = a[0], j = a[1], sub = (j && j.sub) || { active: false };

    var form =
      '<div class="g-sec"><h2>Dir codsiga</h2></div>' +
      '<div class="sr-form">' +
        '<label class="g-lbl">Link (Alibaba, 1688, Made-in-China) — ama ka tag oo sharax</label>' +
        '<input class="g-in" id="srUrl" placeholder="https://www.alibaba.com/product-detail/...">' +
        '<label class="g-lbl">Waa maxay alaabtu?</label>' +
        '<input class="g-in" id="srTitle" placeholder="tusaale: 500 kursi caag ah oo cad">' +
        '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="srQty" type="number" min="1" value="100"></div>' +
        '<div><label class="g-lbl">Qiimaha alaabta ee aad filayso ($)</label><input class="g-in" id="srGoods" type="number" min="1" placeholder="tusaale: 2000"></div></div>' +
        '<div class="g-eta">Lacagtan waa <b>alaabta oo keliya</b> — rarka ha ku darin. Carbuunka waxaa laga xisaabiyaa tan.</div>' +
        agentPicker(reps, j && j.agent && j.agent.id) +
        '<label class="g-lbl" style="margin-top:10px">Wax kale oo aan ogaano</label>' +
        '<input class="g-in" id="srNote" placeholder="midab, cabbir, sida aad rabto in la soo diro…">' +
        '<div class="sr-dep" id="srDep"></div>' +
        '<button class="btn g-buy full" id="srGo">Dir codsiga</button>' +
        (signedIn ? "" : '<div class="g-eta" style="margin-top:8px">Weli akoon ma lihid — markaad dirto waxaan kuu samaynaynaa mid 20 ilbiriqsi gudahood.</div>') +
      '</div>';

    var terms = signedIn ?
      '<div class="sr-terms"><b>Sida carbuunku u shaqeeyo</b>' +
        (j && j.agent ? '<div class="g-eta" style="margin:8px 0">Wakiilkaaga: <b>' + e(j.agent.name) + '</b> · <a href="https://wa.me/' + e(j.agent.phone.replace(/\D/g, "")) + '" style="color:var(--link)">' + e(j.agent.phone) + '</a> — la hadal isaga ama Garsoore.</div>' : '') +
        '<ul>' +
          '<li><b>' + T.depositPct + '%</b> carbuun ah oo <b>qiimaha alaabta oo keliya</b> — rarka lagama qaadayo carbuun.</li>' +
          '<li>Haddii aanan heli karin — <b>carbuunkaaga oo dhan waa laguu celinayaa</b>. Khaladkaygu waa kaygu.</li>' +
          '<li>Haddii <b>adigu</b> joojiso inta aan gorgortamayno — maalin kasta <b>' + T.cancelDecayPctPerDay + '%</b> carbuunka. Maalinta koowaad waa bilaash.</li>' +
          '<li>Qiimaha lagu soo celiyo wuxuu shaqeeyaa <b>' + T.quoteValidDays + ' maalmood</b>.</li>' +
        '</ul></div>' : '';

    app.innerHTML = hero(plans(sub) + (signedIn ? terms : ''));
    var body = $("srBody");
    body.innerHTML = form + (signedIn ? '<div class="g-sec"><h2>Codsiyadayda</h2></div>' +
      (j.requests.length ? j.requests.map(row).join("") : '<div class="g-empty sm">Weli codsi ma dirin.</div>') : '');

    function dep() {
      var g = +$("srGoods").value || 0;
      var d = sub.active ? 0 : Math.max(T.minDeposit, Math.round(g * T.depositPct) / 100);
      var belowMoq = !sub.active && g > 0 && g < (COMM.minGoods || 500);
      $("srDep").innerHTML = g > 0
        ? (sub.active ? '<b>Carbuun ma jiro</b> — waxaad ku jirtaa bishii ' + money(T.subscriptionUsd) + '.'
          : 'Carbuunka: <b>' + money(d) + '</b> (' + T.depositPct + '% ee ' + money(g) + ')' +
            (belowMoq ? ' · <span style="color:var(--warn,#b54708)">ugu yaraan ' + money(COMM.minGoods || 500) + ' ama rukni.</span>' : ''))
        : "";
    }
    $("srGoods").oninput = dep; dep();

    function payload() {
      var url = $("srUrl").value.trim();
      var id = url && RF.sources ? RF.sources.identify(url) : null;
      var title = $("srTitle").value.trim() || (id ? "Alaab ka timid " + RF.sources.label(id) : "");
      return { title: title, url: url, platform: id ? id.platform : "", qty: +$("srQty").value || 1,
        goodsEst: +$("srGoods").value, notes: $("srNote").value, agent: $("srAgent") ? $("srAgent").value : "" };
    }
    function doPost(p) {
      if (p.title.length < 3) { $("srGo").disabled = false; return toast("Sharax waxa aad rabto."); }
      if (!(p.goodsEst > 0)) { $("srGo").disabled = false; return toast("Ku qor qiyaasta qiimaha alaabta."); }
      call("POST", "/sourcing", p).then(function () { RF.sourcingUI(app); })
        .catch(function (x) { $("srGo").disabled = false; toast(x.message); });
    }
    $("srGo").onclick = function () {
      var p = payload(); $("srGo").disabled = true;
      /* signed out: create the account inside the same tap, carrying the agent they picked — no second form */
      if (!RF.api.user) RF.authUI.open("Garsoore — dir codsiga").then(function () { doPost(p); }).catch(function () { $("srGo").disabled = false; });
      else doPost(p);
    };

    if (signedIn) {
      [].forEach.call(body.querySelectorAll("[data-dep]"), function (b) {
        b.onclick = function () {
          var txn = prompt("Lambarka macaamilka ee lacagta aad dirtay:");
          if (!txn) return;
          call("POST", "/sourcing/" + b.dataset.dep + "/deposit", { txn: txn }).then(function () { RF.sourcingUI(app); }).catch(function (x) { toast(x.message); });
        };
      });
      [].forEach.call(body.querySelectorAll("[data-acc]"), function (b) {
        b.onclick = function () { call("POST", "/sourcing/" + b.dataset.acc + "/accept", {}).then(function () { toast("✓ Waa la aqbalay"); RF.sourcingUI(app); }).catch(function (x) { toast(x.message); }); };
      });
      [].forEach.call(body.querySelectorAll("[data-can]"), function (b) {
        b.onclick = function () {
          if (!confirm(b.dataset.warn)) return;
          call("POST", "/sourcing/" + b.dataset.can + "/cancel", { why: "" }).then(function (r) {
            toast(r.forfeit ? "La joojiyay · waxaa la hayay " + money(r.forfeit) : "La joojiyay"); RF.sourcingUI(app);
          }).catch(function (x) { toast(x.message); });
        };
      });
    }
  }).catch(function (x) { app.innerHTML = hero('<div class="g-empty">' + e(x.message) + '</div>'); });

  function row(r) {
    var st = STATE[r.state] || [r.state, ""];
    var days = r.depositAt ? Math.max(0, Math.floor((Date.now() - Date.parse(r.depositAt)) / 864e5)) : 0;
    var keepPct = Math.min(100, days * T.cancelDecayPctPerDay);
    var keep = Math.round((r.depositPaid || 0) * keepPct) / 100;
    var open = ["AWAITING_DEPOSIT", "SOURCING", "QUOTED", "ACCEPTED"].indexOf(r.state) >= 0;
    return '<div class="g-order"><div class="g-ohead"><div style="flex:1">' +
      '<b>' + e(r.title) + '</b>' +
      '<div class="g-eta">' + r.id + ' · ' + r.qty + ' ' + e(r.unit || "xabbo") + ' · qiyaas ' + money(r.goodsEst) +
        (r.url ? ' · <a href="' + e(r.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link)">liiska ↗</a>' : "") + '</div>' +
      (r.state === "AWAITING_DEPOSIT" ? '<div class="g-eta">Carbuun: <b>' + money(r.depositDue) + '</b>' + (r.depositTxn ? ' · la diray (' + e(r.depositTxn) + ') — waa la hubinayaa' : "") + '</div>' : "") +
      (r.state === "QUOTED" ? '<div class="g-eta">Alaabta ' + money(r.quoteGoods) + ' + rar ' + money(r.quoteShip) + ' = <b style="color:var(--fg)">' + money(r.quoteTotal) + '</b> · ~' + r.quoteEta + ' maalmood' + (r.quoteNote ? ' · ' + e(r.quoteNote) : "") + '</div>' : "") +
      (r.state === "UNSOURCEABLE" ? '<div class="g-eta">' + e(r.closeReason || "") + ' · <b>Carbuunkaagii oo dhan waa laguu celiyay (' + money(r.refund) + ')</b></div>' : "") +
      (r.state === "CANCELLED" ? '<div class="g-eta">La joojiyay · la hayay ' + money(r.forfeit) + ' · la celiyay ' + money(r.refund) + '</div>' : "") +
      (r.state === "SOURCING" && r.depositPaid ? '<div class="g-eta">Carbuun ' + money(r.depositPaid) + ' la helay ' + when(r.depositAt) + ' · haddii aad hadda joojiso waxaa la hayn lahaa ' + money(keep) + '</div>' : "") +
      '</div><span class="g-pill ' + st[1] + '">' + st[0] + '</span>' +
      (r.state === "AWAITING_DEPOSIT" && !r.depositTxn ? '<button class="btn" data-dep="' + r.id + '">Waan diray carbuunka</button>' : "") +
      (r.state === "QUOTED" ? '<button class="btn" data-acc="' + r.id + '">Aqbal</button>' : "") +
      (open ? '<button class="btn ghost" data-can="' + r.id + '" data-warn="' +
        e(keep > 0 ? "Haddii aad hadda joojiso, Garsoore wuxuu hayn doonaa " + money(keep) + " (" + keepPct + "% carbuunka, " + days + " maalmood). Waxaa laguu celinayaa " + money((r.depositPaid || 0) - keep) + ". Ma hubtaa?"
                   : "Ma hubtaa inaad joojinayso? Wax lacag ah lagaama hayn doono.") + '">Jooji</button>' : "") +
      '</div></div>';
  }
};
})();
