/* Garsoore — the agent desk (window.RF.agentDesk), business.<domain>/agent.html

   One page, two jobs depending on who is signed in:
     sales agent    a book of clients: who they are, how many requests, what they have earned from each.
     China agent    the sourcing desk: the requests waiting to be sourced, and the one form that matters — a quote.

   Both are paid out of the goods commission, so both need to see the money plainly: an agent who cannot see what a
   job pays cannot be asked to judge whether it is worth doing. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function when(iso) { return iso ? new Date(iso).toLocaleDateString("so-SO", { day: "numeric", month: "short" }) : "—"; }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
var ST = { AWAITING_DEPOSIT: "Sugaya carbuun", SOURCING: "Raadin", QUOTED: "Qiimo diyaar", ACCEPTED: "La aqbalay", ORDERED: "La dalbaday", DELIVERED: "La keenay" };

RF.agentDesk = function (app) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  var call = RF.api.call;
  function fail(x) { app.innerHTML = '<div class="wrap"><div class="g-empty g-err">' + e(x.message || x) + '</div></div>'; }
  function need() {
    app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Bogga wakiilka</h1></div>' +
      '<div class="g-empty">Gal si aad u gasho shaqadaada. <div style="margin-top:12px"><button class="btn" id="adIn">Gal</button></div></div></div>';
    $("adIn").onclick = function () { RF.authUI.open("Garsoore — wakiil").then(function () { RF.agentDesk(app); }).catch(function () {}); };
  }
  if (!RF.api.user) return need();

  function apply(app) {
    app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Noqo wakiil Garsoore</h1></div>' +
      '<div class="sr-form"><div class="g-eta">Wakiil iib (sales agent) wuxuu sameeyaa macaamiil, wuxuuna ka qaataa 50% komishanka alaabta. ' +
      'Wakiil Shiinaha (china agent) wuxuu raadiyaa oo gorgortamaa, wuuna qaataa qayb.</div>' +
      '<label class="g-lbl">Nooc</label><select class="g-in" id="adKind"><option value="sales">Wakiil iib (sales agent)</option><option value="china">Wakiil Shiinaha (china agent)</option></select>' +
      '<label class="g-lbl">Magaalada</label><input class="g-in" id="adCity" placeholder="Muqdisho / Guangzhou">' +
      '<button class="btn g-buy full" id="adGo">Codso</button></div></div>';
    $("adGo").onclick = function () {
      this.disabled = true;
      call("POST", "/rep/apply", { kind: $("adKind").value, city: $("adCity").value })
        .then(function () { toast("Codsi la diray — Garsoore ayaa ansixin doona"); RF.agentDesk(app); })
        .catch(function (x) { toast(x.message); this.disabled = false; });
    };
  }

  function sales(app, j) {
    call("GET", "/rep/clients").then(function (k) {
      var C = k.clients || [];
      app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Macmiiladayda</h1>' +
        '<span class="g-pill">' + money(k.balance) + ' la kasbaday</span></div>' +
        '<div class="g-stats"><div><b>' + C.length + '</b>macmiil</div><div><b>' + C.reduce(function (s, c) { return s + c.live; }, 0) + '</b>codsi socda</div>' +
        '<div><b>' + C.filter(function (c) { return c.subscriber; }).length + '</b>ruknile</div><div><b>' + money(k.balance) + '</b>komishan</div></div>' +
        (C.length ? C.map(function (c) {
          return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + e(c.name) + '</b>' +
            '<div class="g-eta">' + e(c.phone) + (c.kind ? ' · ' + e(c.kind) : '') + ' · <a href="https://wa.me/' + e(c.phone.replace(/\D/g, "")) + '" style="color:var(--link)">WhatsApp</a></div></div>' +
            (c.subscriber ? '<span class="g-pill">ruknile</span>' : '<span class="g-pill gold">carbuun</span>') +
            '<div style="text-align:right;min-width:90px"><div class="g-price sm">' + money(c.earned) + '</div><div class="g-eta">' + c.requests + ' codsi</div></div></div></div>';
        }).join("") : '<div class="g-empty">Weli macmiil ma lihid. Wakiilka cusub waxaa loo qoondeeyaa macaamiisha cusub ee Garsoore.</div>') + '</div>';
    }).catch(fail);
  }

  function china(app, j) {
    call("GET", "/rep/work").then(function (k) {
      var W = k.work || [];
      app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Miiska Shiinaha</h1>' +
        '<span class="g-pill">' + money(j.balance) + ' la kasbaday</span></div>' +
        '<div class="g-stats"><div><b>' + W.filter(function (w) { return !w.mine; }).length + '</b>shaqo furan</div><div><b>' + W.filter(function (w) { return w.mine; }).length + '</b>tayda</div><div><b>' + j.open + '</b>socda</div><div><b>' + money(j.balance) + '</b>komishan</div></div>' +
        (W.length ? W.map(function (w) {
          return '<div class="g-order"><div class="g-ohead"><div style="flex:1"><b>' + e(w.title) + '</b>' +
            '<div class="g-eta">' + w.id + ' · ' + w.qty + ' ' + e(w.unit || "xabbo") + ' · qiyaas ' + money(w.goodsEst) + (w.city ? ' · ' + e(w.city) : "") + '</div>' +
            (w.url ? '<div class="g-eta"><a href="' + e(w.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link)">liiska fur ↗</a></div>' : '') +
            (w.notes ? '<div class="g-eta">' + e(w.notes) + '</div>' : '') + '</div>' +
            '<span class="g-pill">' + e(ST[w.state] || w.state) + '</span>' +
            (w.mine ? '<button class="btn" data-quote="' + w.id + '">Qiimee</button>'
                    : (w.state === "SOURCING" ? '<button class="btn ghost" data-claim="' + w.id + '">Qaado</button>' : '')) +
            '</div></div>';
        }).join("") : '<div class="g-empty">Hadda wax shaqo ah ma jiraan. Waxay soo muuqan doonaan marka macmiil codsi diro.</div>') + '</div>';

      [].forEach.call(app.querySelectorAll("[data-claim]"), function (b) {
        b.onclick = function () { b.disabled = true; call("POST", "/rep/work/" + b.dataset.claim + "/claim", {}).then(function () { toast("✓ Waa tayda"); RF.agentDesk(app); }).catch(function (x) { toast(x.message); b.disabled = false; }); };
      });
      [].forEach.call(app.querySelectorAll("[data-quote]"), function (b) {
        b.onclick = function () {
          var goods = prompt("Qiimaha alaabta ($) — rarka gooni:"); if (goods === null) return;
          var ship = prompt("Qiimaha rarka ($):") || 0;
          var eta = prompt("Maalmood inta rar qaadanayo:", "30") || 30;
          var note = prompt("Faallo ku dar (nooc, tijaabo, iwm):") || "";
          b.disabled = true;
          call("POST", "/rep/work/" + b.dataset.quote + "/quote", { goods: +goods, ship: +ship, etaDays: +eta, note: note })
            .then(function (r) { toast("Qiimo la diray: $" + r.total); RF.agentDesk(app); })
            .catch(function (x) { toast(x.message); b.disabled = false; });
        };
      });
    }).catch(fail);
  }

  call("GET", "/rep/me").then(function (j) {
    if (!j.rep) return apply(app);
    if (j.rep.status !== "approved") {
      app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Bogga wakiilka</h1></div>' +
        '<div class="g-empty">Akoonkaaga wakiil <b>(' + e(j.rep.kind) + ')</b> waa la sugayaa ansixin Garsoore. Wax yar kadib isku day mar kale.</div></div>';
      return;
    }
    if (j.rep.kind === "china") china(app, j); else sales(app, j);
  }).catch(fail);
};
})();
