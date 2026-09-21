/* Garsoore — managed wholesale sourcing (window.RF.sourcingUI), business.<domain>/sourcing.html

   Written for one person: a Somali trader with money to spend and no interest in learning freight. They can find the
   stock themselves — Alibaba is not the hard part. The hard part is everything after "I want this": what an incoterm
   is, how goods leave a factory, how they leave a port in Mogadishu. This page never asks them to know any of it.

   So the form asks three things a trader already knows — what, how many, roughly what it is worth — and the deposit
   terms are stated in full on the same screen as the button. Nothing about the cancellation charge is discovered
   later; a rule you only learn when it is applied to you is a trap, however fair the number is. */
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

RF.sourcingUI = function (app) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  var call = RF.api.call, T = (RF.api.config && RF.api.config.sourcing) || { depositPct: 30, subscriptionUsd: 100, cancelDecayPctPerDay: 5, minDeposit: 20, quoteValidDays: 7 };

  function hero(extra) {
    return '<div class="wrap"><section class="g-chero biz"><span class="g-tagw">GARSOORE — ANNAGA AYAA KUU IIBSANAYNA</span>' +
      '<h1>Tus alaabta. Inteeda kale annagaa qabanayna.</h1>' +
      '<p>Ku dheji link Alibaba, 1688 ama Made-in-China ah — ama kaliya sharax waxa aad rabto. Wakiilkeennu wuu la ' +
      'xiriirayaa warshadda, wuu la gorgortamayaa, wuuna hubinayaa inay dhab tahay. Waxaad hesha <b>hal qiime</b>.</p>' +
      '<ol class="g-how"><li><b>Warshadda</b>waan raadinaa oo aan la gorgortamnaa</li><li><b>Dekedda</b>annaga ayaa qabanayna</li>' +
      '<li><b>Gudbinta</b>canshuurta iyo warqadaha</li><li><b>Muqdisho</b>gacantaada</li></ol>' +
      '<p class="g-eta" style="max-width:74ch;margin-top:10px">Uma baahnid inaad garato <i>incoterm</i>, <i>bill of lading</i>, ' +
      'ama sida looga saaro alaabta dekedda. Taasi waa shaqadayada. ' +
      '<a href="../calculator.html" style="color:var(--link);font-weight:700">Xisaabiye rar oo bilaash ah →</a></p></section>' + extra + '</div>';
  }

  if (!RF.api.user) {
    app.innerHTML = hero('<div class="g-empty">Gal si aad codsi u dirto. <button class="btn" id="srIn">Gal</button></div>');
    $("srIn").onclick = function () { RF.authUI.open("Garsoore — raadinta jumlada").then(function () { RF.sourcingUI(app); }).catch(function () {}); };
    return;
  }

  app.innerHTML = hero('<div id="srBody"><div class="g-empty sm">⏳</div></div>');
  var body = $("srBody");
  function reload() { RF.sourcingUI(app); }
  function fail(x) { toast(x.message || "Khalad"); }

  call("GET", "/sourcing").then(function (j) {
    var sub = j.sub || {};
    body.innerHTML =
      /* the terms, in full, on the same screen as the button */
      '<div class="sr-terms"><b>Sida carbuunku u shaqeeyo</b>' +
        '<ul>' +
          '<li><b>' + T.depositPct + '%</b> carbuun ah oo <b>qiimaha alaabta oo keliya</b> — rarka lagama qaadayo carbuun.</li>' +
          '<li>Haddii aanan heli karin (liiska been ah, iibiye maqan, iwm) — <b>carbuunkaaga oo dhan waa laguu celinayaa</b>. Khaladkaygu waa kaygu.</li>' +
          '<li>Haddii <b>adigu</b> joojiso inta aan gorgortamayno — maalin kasta oo aad na sugsiisay waxaan hayn doonnaa <b>' + T.cancelDecayPctPerDay + '%</b> carbuunka. Maalinta koowaad waa bilaash.</li>' +
          '<li>Qiimaha lagu soo celiyo wuxuu shaqeeyaa <b>' + T.quoteValidDays + ' maalmood</b>.</li>' +
          '<li><b>' + money(T.subscriptionUsd) + ' bishii</b> — carbuun ma jiro oo dhan. ' +
            (sub.active ? '<span class="g-pill">✓ Waad ku jirtaa ilaa ' + when(sub.until) + '</span>' : '<span class="g-pill gold">Ma lihid</span>') + '</li>' +
        '</ul></div>' +

      '<div class="g-sec"><h2>Codsi cusub</h2></div>' +
      '<div class="sr-form">' +
        '<label class="g-lbl">Link (Alibaba, 1688, Made-in-China) — ama ka tag oo sharax</label>' +
        '<input class="g-in" id="srUrl" placeholder="https://www.alibaba.com/product-detail/...">' +
        '<label class="g-lbl">Waa maxay alaabtu?</label>' +
        '<input class="g-in" id="srTitle" placeholder="tusaale: 500 kursi caag ah oo cad">' +
        '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="srQty" type="number" min="1" value="100"></div>' +
        '<div><label class="g-lbl">Qiimaha alaabta ee aad filayso ($)</label><input class="g-in" id="srGoods" type="number" min="1" placeholder="tusaale: 2000"></div></div>' +
        '<div class="g-eta">Lacagtan waa <b>alaabta oo keliya</b> — rarka ha ku darin. Carbuunka waxaa laga xisaabiyaa tan.</div>' +
        '<label class="g-lbl" style="margin-top:10px">Wax kale oo aan ogaano</label>' +
        '<input class="g-in" id="srNote" placeholder="midab, cabbir, sida aad rabto in la soo diro…">' +
        '<div class="sr-dep" id="srDep"></div>' +
        '<button class="btn g-buy full" id="srGo">Dir codsiga</button>' +
      '</div>' +

      '<div class="g-sec"><h2>Codsiyadayda</h2></div>' +
      (j.requests.length ? j.requests.map(row).join("") : '<div class="g-empty sm">Weli codsi ma dirin.</div>');

    function dep() {
      var g = +$("srGoods").value || 0;
      var d = sub.active ? 0 : Math.max(T.minDeposit, Math.round(g * T.depositPct) / 100);
      $("srDep").innerHTML = g > 0
        ? (sub.active ? '<b>Carbuun ma jiro</b> — waxaad ku jirtaa bishii ' + money(T.subscriptionUsd) + '.'
                      : 'Carbuunka: <b>' + money(d) + '</b> (' + T.depositPct + '% ee ' + money(g) + ')')
        : "";
    }
    $("srGoods").oninput = dep; dep();

    $("srGo").onclick = function () {
      var title = $("srTitle").value.trim(), url = $("srUrl").value.trim();
      var id = url && RF.sources ? RF.sources.identify(url) : null;
      if (!title && id) title = "Alaab ka timid " + RF.sources.label(id);
      if (title.length < 3) return toast("Sharax waxa aad rabto.");
      var g = +$("srGoods").value;
      if (!(g > 0)) return toast("Ku qor qiyaasta qiimaha alaabta.");
      $("srGo").disabled = true;
      call("POST", "/sourcing", { title: title, url: url, platform: id ? id.platform : "", qty: +$("srQty").value || 1,
        goodsEst: g, notes: $("srNote").value })
        .then(reload).catch(function (x) { $("srGo").disabled = false; fail(x); });
    };

    [].forEach.call(body.querySelectorAll("[data-dep]"), function (b) {
      b.onclick = function () {
        var txn = prompt("Lambarka macaamilka ee lacagta aad dirtay:");
        if (!txn) return;
        call("POST", "/sourcing/" + b.dataset.dep + "/deposit", { txn: txn }).then(reload).catch(fail);
      };
    });
    [].forEach.call(body.querySelectorAll("[data-acc]"), function (b) {
      b.onclick = function () { call("POST", "/sourcing/" + b.dataset.acc + "/accept", {}).then(function () { toast("✓ Waa la aqbalay"); reload(); }).catch(fail); };
    });
    [].forEach.call(body.querySelectorAll("[data-can]"), function (b) {
      b.onclick = function () {
        /* the exact number, before they decide — not after */
        if (!confirm(b.dataset.warn)) return;
        call("POST", "/sourcing/" + b.dataset.can + "/cancel", { why: "" }).then(function (r) {
          toast(r.forfeit ? "La joojiyay · waxaa la hayay " + money(r.forfeit) : "La joojiyay");
          reload();
        }).catch(fail);
      };
    });
  }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });

  function row(r) {
    var st = STATE[r.state] || [r.state, ""];
    /* what cancelling would cost them today, worked out on the page so the confirm box can state it plainly */
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
