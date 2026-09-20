/* Garsoore Ganacsi — Fudud (simple) mode.
   The business side has two faces. FUDUD asks one question at a time and does the thinking for you: pick the job,
   answer three or four things, done. XIRFADLE (pro) is the full surface — mandate boards, landed cost, ledgers,
   freight batches, tiers — for people who want every lever.
   Both drive exactly the same server. Simple mode never hides money: prices, fees and the escrow promise always show. */
(function () {
var RF = window.RF = window.RF || {};
var KEY = "garsoore.bizmode";
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return (n < 0 ? "−$" : "$") + Math.abs(Number(n || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }

RF.mode = {
  get: function () { try { return localStorage.getItem(KEY) === "pro" ? "pro" : "simple"; } catch (x) { return "simple"; } },
  set: function (m) { try { localStorage.setItem(KEY, m === "pro" ? "pro" : "simple"); } catch (x) {} location.reload(); },
  simple: function () { return RF.mode.get() === "simple"; }
};

/* the jobs a Somali business actually comes here to do */
var JOBS = [
  { id: "china", icon: "🇨🇳", t: "Shiinaha wax iga keen", s: "Ku dheji link ama sharax waxa aad rabto. Waxaan kuu soo dirnaa hal qiimo — rar, canshuur iyo adeeg oo ku jira.", btn: "Bilow" },
  { id: "fbg", icon: "📦", t: "Waan iibsaday — ii qaabil oo ii keen", s: "Hel cinwaan Shiinaha oo kaliya adiga. Waan qaabilnaa, isku darnaa oo Muqdisho keennaa. Alaabtu adigaa iska leh.", btn: "Hel cinwaanka" },
  { id: "agent", icon: "🤝", t: "Alaab baan haystaa — ii iibi", s: "Wakiil la hubiyay ayaa suuqa u geynaya. Waxaad dooranaysaa: dhaqso, ama faa'iido badan.", btn: "Dooro" },
  { id: "list", icon: "🏷", t: "Kaydkayga ku iib Garsoore", s: "Alaabta bakhaarkeena ku jirta ku dhig suuqa Garsoore.com — macmiilku maanta ayuu qaadan karaa.", btn: "Eeg kaydka" },
  { id: "orders", icon: "📋", t: "Dalabyadayda iyo qiimayaasha", s: "Waxa socda, waxa la bixiyay, iyo codsiyada qiimaha ee lagu soo celiyay.", btn: "Fur" }
];

RF.simpleUI = function (app, job) {
  var call = RF.api && RF.api.call;
  if (!RF.api) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  if (!RF.api.checked) {                      /* the health check is still in flight — draw once it answers */
    app.innerHTML = '<div class="wrap g-empty sm">⏳</div>';
    return void RF.api.ready.then(function () { RF.simpleUI(app, job); });
  }
  if (!RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  app.innerHTML = '<div class="wrap sm-wrap">' +
    '<section class="sm-hero"><span class="g-tagw">GARSOORE GANACSI</span><h1>Maxaad rabtaa inaan kuu qabanno?</h1>' +
      '<p>Dooro shaqada. Su\'aalo yar ayaan ku weydiinaynaa — inteeda kale annaga ayaa qabanayna.</p></section>' +
    '<div class="sm-jobs">' + JOBS.map(function (j) {
      return '<button class="sm-job" data-job="' + j.id + '"><span class="sm-ic">' + j.icon + '</span><b>' + j.t + '</b><em>' + j.s + '</em><i>' + j.btn + ' →</i></button>';
    }).join("") + '</div>' +
    '<div id="smBody"></div>' +
    '<div class="sm-foot">Ma doonaysaa qalab dhammaystiran — mandate-yo, kharashka la keenay, xisaabaad, rar? ' +
      '<button class="btn ghost" id="smPro">U beddel Xirfadle</button></div></div>';
  $("smPro").onclick = function () { RF.mode.set("pro"); };
  [].forEach.call(app.querySelectorAll("[data-job]"), function (b) { b.onclick = function () { open(b.dataset.job); }; });

  /* Asking a business to sign in before it can even read the form is how you lose it. The forms are public; the
     account is asked for at the moment of committing. Only the jobs that show *your own* records need one up front,
     and they say so in the page rather than throwing a sheet over it. */
  var MINE = {
    fbg:    "Cinwaanka Shiinaha iyo shixnadahaagu waa kuwaaga gaarka ah — waxaan u baahannahay inaan ognaanno kii aad tahay.",
    list:   "Kaydkaagu waa kaaga — gal si aad u aragto oo aad suuqa ugu dhigto.",
    orders: "Dalabyada, qiimayaasha iyo mandate-yadaadu waa kuwaaga — gal si aad u aragto."
  };
  function open(id) {
    [].forEach.call(app.querySelectorAll(".sm-job"), function (x) { x.classList.toggle("on", x.dataset.job === id); });
    var body = $("smBody"), fn = { china: china, fbg: fbg, agent: agent, list: listStock, orders: orders }[id] || china;
    body.innerHTML = '<div class="g-empty sm">⏳</div>';
    body.scrollIntoView({ behavior: "smooth", block: "start" });
    if (MINE[id] && !RF.api.user) {
      body.innerHTML = card("🔒 Waa kaaga", '<p class="g-eta">' + MINE[id] + '</p>', "Gal ama samee akoon",
        "Lambarkaaga taleefanka iyo PIN — daqiiqad ayay qaadanaysaa.");
      $("smGo").onclick = function () { RF.authUI.open("Garsoore Ganacsi").then(function () { open(id); }).catch(function () {}); };
      return;
    }
    fn(body);
  }
  if (job) open(job);              /* after MINE is set: open() reads it */

  /* commit step: sign in if needed, then run. Cancelling the sheet leaves the form exactly as it was. */
  function submit(run) {
    busy();
    return RF.backend.needUser("Gal si aan shaqadaada u bilowno.").then(run).catch(function (x) {
      if (x && x.message === "cancelled") { var g = $("smGo"); if (g) { g.disabled = false; g.textContent = g.dataset.t || g.textContent; } }
      else err((x && x.message) || "Khalad");
    });
  }

  /* ---- 1. source something from China: a link or a description, priced by a person */
  function china(body) {
    body.innerHTML = card("🇨🇳 Shiinaha wax iga keen",
      '<label class="g-lbl">Ku dheji link (1688, JD, Taobao, Alibaba…) ama sharax alaabta</label>' +
      '<input class="g-in" id="smQ" placeholder="https://detail.1688.com/… ama: 200 kursi caag ah">' +
      '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="smQty" type="number" min="1" value="1"></div>' +
      '<div><label class="g-lbl">Magaalada aad rabto in lagu keeno</label><input class="g-in" id="smCity" placeholder="Muqdisho" value="Muqdisho"></div></div>',
      "Codso qiimo", "Hal qiimo ayaa kuu imanaya (alaab + rar + canshuur + adeeg). Waxba ma bixinaysid ilaa aad aqbasho.");
    $("smGo").onclick = function () {
      var v = $("smQ").value.trim(), qty = +$("smQty").value || 1;
      if (v.length < 4) return err("Ku qor link ama sharax alaabta.");
      var url = RF.sources && RF.sources.urlOf(v), id = url && RF.sources.identify(url);
      submit(function () {
        return call("POST", "/quotes", { title: (url ? "Alaab ka timid " + (id ? id.platform : "web") : v) + " × " + qty, qty: qty, url: url || "", platform: id ? id.platform : "web", note: "Fudud · " + $("smCity").value + " · " + v })
          .then(function (r) { done("Codsigaagii waa la diray · " + r.id, "Koox Garsoore ah ayaa qiimaynaysa (saacado gudahood). Waxaad ka arki doontaa " + link("orders.html", "Dalabyadayda") + " — kadibna hal badhan ayaad ku iibsan kartaa."); });
      });
    };
  }

  /* ---- 2. FBG: address first, shipment second */
  function fbg(body) {
    call("GET", "/fbg/me").then(function (j) {
      if (!j.account) {
        body.innerHTML = card("📦 Hel cinwaankaaga Shiinaha",
          '<p class="g-eta">Waxaad hesha kood iyo cinwaan Shiinaha. Iibiyayaashaadu halkaas ayay u diraan — annaga ayaa qaabilayna, sawirayna, miisaamayna, isku darayna oo Muqdisho keenayna. <b>Alaabtu adigaa iska leh</b> ilaa ay iibsanto.</p>' +
          '<div class="sm-fees"><div><b>' + money(j.fees.receivingPerCarton) + '</b><span>sanduuqii — qaabilaad</span></div>' +
            '<div><b>' + money(j.fees.seaPerKg) + '/kg</b><span>bad (cir ' + money(j.fees.airPerKg) + '/kg)</span></div>' +
            '<div><b>' + j.fees.freeStorageDays + ' maalmood</b><span>kayd bilaash</span></div>' +
            '<div><b>' + j.fees.commissionPct + '%</b><span>haddii aan kuu iibinno</span></div></div>',
          "Hel cinwaanka", "Wax kharash ah ma bixinaysid ilaa aad alaab soo dirto.");
        $("smGo").onclick = function () { busy(); call("POST", "/fbg/enroll", {}).then(function () { fbg(body); }).catch(function (x) { err(x.message); }); };
        return;
      }
      body.innerHTML = card("📦 Cinwaankaaga Shiinaha",
        '<div class="sm-addr"><div><span>Koodhkaaga</span><b>' + e(j.account.suite) + '</b></div>' +
          '<div><span>Cinwaanka</span><p>' + e(j.address) + '</p></div></div>' +
        '<p class="g-eta">Koodhkan ku qor <b>sanduuq kasta</b>. Markaad wax iibsato, halkan noo sheeg si aan u aqoonsanno markay timaaddo:</p>' +
        '<label class="g-lbl">Waa maxay alaabta?</label><input class="g-in" id="smT" placeholder="tusaale: 500 kiis taleefan">' +
        '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="smQty" type="number" min="1" value="1"></div>' +
          '<div><label class="g-lbl">Lacagta aad bixisay ($)</label><input class="g-in" id="smVal" type="number" min="0"></div></div>' +
        '<label class="g-lbl">Markay timaaddo, maxaad rabtaa?</label>' +
        '<div class="g-rad on" data-d="sell"><i></i>Ku iib Garsoore</div>' +
        '<div class="g-rad" data-d="keep"><i></i>Ii keen, aniga ayaa qaadanaya</div>' +
        '<div class="g-rad" data-d="agent"><i></i>Wakiil ha iibiyo</div>',
        "Kaydi shixnadda", "Waad beddeli kartaa go'aankaaga ilaa alaabtu ka baxdo Shiinaha.");
      var disp = "sell";
      [].forEach.call(body.querySelectorAll("[data-d]"), function (d) { d.onclick = function () { disp = d.dataset.d; [].forEach.call(body.querySelectorAll("[data-d]"), function (x) { x.classList.toggle("on", x === d); }); }; });
      $("smGo").onclick = function () {
        var t = $("smT").value.trim();
        if (t.length < 2) return err("Ku qor alaabta.");
        busy();
        call("POST", "/fbg/inbound", { title: t, qty: +$("smQty").value || 1, value: +$("smVal").value || 0, disposition: disp })
          .then(function () { done("Waa la kaydiyay", "Markay Shiinaha timaaddo waan sawiraynaa oo aan ku tusaynaa. Ka sii daawo " + link("fbg.html", "FBG") + "."); })
          .catch(function (x) { err(x.message); });
      };
    }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });
  }

  /* ---- 3. hand it to an agent: two questions, plain words */
  function agent(body) {
    var A = (RF.api.config && RF.api.config.agent) || { capLiquidity: 15, capMargin: 40, platformPct: 10 };
    var mode = "liquidity";
    body.innerHTML = card("🤝 Wakiil ha ii iibiyo",
      '<label class="g-lbl">Waa maxay alaabta?</label><input class="g-in" id="smT" placeholder="tusaale: 200 jeeg sonkor 50kg">' +
      '<div class="ag-row"><div><label class="g-lbl">Tirada</label><input class="g-in" id="smQty" type="number" min="1" value="1"></div>' +
        '<div><label class="g-lbl">Qiimaha ugu yar ee aad aqbali karto ($)</label><input class="g-in" id="smFloor" type="number" min="1"></div></div>' +
      '<label class="g-lbl">Maxaad doorbidaysaa?</label>' +
      '<div class="g-rad on" data-m="liquidity"><i></i><div><b>Degdeg</b> — qiimahaaga ayaad hesha, si dhaqso ah<div class="g-eta">Wakiilku wuxuu haystaa farqiga (ugu badnaan +' + A.capLiquidity + '%). Wakiillo badan ayaa qaata.</div></div></div>' +
      '<div class="g-rad" data-m="margin"><i></i><div><b>Faa\'iido</b> — waan sugi karaa, lacag badanna waan rabaa<div class="g-eta">Waxaad haysataa 50% farqiga. Waqti dheer ayay qaadan kartaa.</div></div></div>',
      "Dir wakiillada", "Farqiga waxaa lagu qaybiyaa hab cad — mar kasta waad arki kartaa.");
    [].forEach.call(body.querySelectorAll("[data-m]"), function (d) { d.onclick = function () { mode = d.dataset.m; [].forEach.call(body.querySelectorAll("[data-m]"), function (x) { x.classList.toggle("on", x === d); }); }; });
    $("smGo").onclick = function () {
      var t = $("smT").value.trim(), f = +$("smFloor").value;
      if (t.length < 3) return err("Ku qor alaabta.");
      if (!(f > 0)) return err("Ku qor qiimaha ugu yar ee aad aqbali karto.");
      submit(function () {
        return call("POST", "/mandates", { side: "sell", mode: mode, title: t, qty: +$("smQty").value || 1, floor: f, sellerPct: 50, city: "Muqdisho", days: 30 })
          .then(function () { done("Waa la diray wakiillada", (mode === "liquidity" ? "Wakiillo badan ayaa arka — badanaa dhaqso ayay u qaataan." : "Faa'iido mandate-yada waqti dheer ayay qaadan karaan.") + " Ka daawo " + link("agents.html?tab=mine", "Mandate-yadayda") + "."); });
      });
    };
  }

  /* ---- 4. put your own stock on the consumer marketplace */
  function listStock(body) {
    call("GET", "/fbg/me").then(function (j) {
      var inv = (j.inventory || []).filter(function (x) { return ["stored", "listed"].indexOf(x.disposition) >= 0; });
      if (!inv.length) { body.innerHTML = card("🏷 Kaydkayga", '<p class="g-eta">Weli kayd bakhaarkeena kuma lihid. Isticmaal <b>“Waan iibsaday — ii qaabil oo ii keen”</b> si aad alaab u soo dirto.</p>', null); return; }
      body.innerHTML = card("🏷 Kaydkaaga — ku dhig suuqa",
        inv.map(function (x) {
          var net = x.price ? x.price * (1 - j.fees.commissionPct / 100) - j.fees.pickPack : 0;
          return '<div class="sm-row"><div><b>' + e(x.title) + '</b><div class="g-eta">' + x.qtyAvailable + ' diyaar' + (x.landedUnit ? ' · kharashkaagu ' + money(x.landedUnit) + '/xabbo' : "") +
            (x.disposition === "listed" ? ' · suuqa ' + money(x.price) + ' → adigu ' + money(net) : "") + '</div></div>' +
            '<div class="sm-price"><input class="g-in" type="number" min="1" placeholder="qiimo $" value="' + (x.price || "") + '" data-p="' + x.id + '">' +
            '<button class="btn" data-list="' + x.id + '">' + (x.disposition === "listed" ? "Beddel" : "Dhig suuqa") + '</button></div></div>';
        }).join(""), null, "Komishanka Garsoore waa " + j.fees.commissionPct + "% + " + money(j.fees.pickPack) + " diyaarin marka la iibiyo. Alaabtu adigaa iska leh ilaa taas.");
      [].forEach.call(body.querySelectorAll("[data-list]"), function (b) {
        b.onclick = function () {
          var price = +body.querySelector('[data-p="' + b.dataset.list + '"]').value;
          if (!(price > 0)) return toast("Ku qor qiimo.");
          b.disabled = true;
          call("POST", "/fbg/inventory/" + b.dataset.list, { action: "list", price: price })
            .then(function (r) { toast("✓ Suuqa ayay ku jirtaa · adigu waxaad hesha " + money(r.net) + " xabbadii"); listStock(body); })
            .catch(function (x) { b.disabled = false; toast(x.message); });
        };
      });
    }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });
  }

  /* ---- 5. one list of everything that is moving */
  function orders(body) {
    Promise.all([call("GET", "/orders"), call("GET", "/quotes"), call("GET", "/mandates?scope=mine")]).then(function (a) {
      var o = a[0].orders, q = a[1].quotes, m = a[2].mandates;
      body.innerHTML = card("📋 Waxa socda",
        (q.length ? '<h3 class="sm-h">Codsiyada qiimaha</h3>' + q.map(function (x) {
          return '<div class="sm-row"><div><b>' + e(x.title) + '</b><div class="g-eta">' + x.id + ' · ' + (x.status === "pending" ? "waa la qiimaynayaa" : x.status === "quoted" ? "qiimo: " + money(x.total) : "lama helin") + '</div></div>' +
            (x.status === "quoted" ? '<a class="btn" href="' + (location.hostname.indexOf("business.") === 0 ? "https://" + location.hostname.replace("business.", "") : "../") + 'product.html?quote=' + x.id + '">Iibso</a>' : "") + '</div>';
        }).join("") : "") +
        (o.length ? '<h3 class="sm-h">Dalabyada</h3>' + o.slice(0, 10).map(function (x) {
          return '<div class="sm-row"><div><b>' + e(x.title) + '</b><div class="g-eta">' + x.id + ' · ' + money(x.total) + ' · ' + e(x.state) + '</div></div></div>';
        }).join("") : "") +
        (m.length ? '<h3 class="sm-h">Mandate-yada wakiilka</h3>' + m.map(function (x) {
          return '<div class="sm-row"><div><b>' + e(x.title) + '</b><div class="g-eta">' + x.id + ' · ' + (x.mode === "liquidity" ? "dhaqso" : "faa\'iido") + ' · ' + e(x.state) + (x.dealPrice ? ' · la iibiyay ' + money(x.dealPrice) : "") + '</div></div></div>';
        }).join("") : "") +
        (!q.length && !o.length && !m.length ? '<p class="g-eta">Weli waxba ma socdaan.</p>' : ""), null);
    }).catch(function (x) { body.innerHTML = '<div class="g-err">' + e(x.message) + '</div>'; });
  }

  /* ---- little helpers so every flow looks the same */
  function card(title, inner, btn, foot) {
    return '<div class="sm-card"><h2>' + title + '</h2>' + inner +
      '<div class="g-err sm" id="smErr" hidden></div>' +
      (btn ? '<button class="btn g-buy full" id="smGo">' + btn + '</button>' : "") +
      (foot ? '<div class="g-escrow">' + foot + '</div>' : "") + '</div>';
  }
  function link(href, text) { return '<a href="' + href + '" style="color:var(--link);font-weight:700">' + text + '</a>'; }
  function err(m) { var el = $("smErr"); if (el) { el.textContent = m; el.hidden = false; } var g = $("smGo"); if (g) { g.disabled = false; g.textContent = g.dataset.t || g.textContent; } }
  function busy() { var g = $("smGo"); if (g) { g.dataset.t = g.textContent; g.disabled = true; g.textContent = "…"; } }
  function done(title, text) {
    $("smBody").innerHTML = '<div class="sm-card ok"><div class="sm-tick">✓</div><h2>' + e(title) + '</h2><p>' + text + '</p>' +
      '<button class="btn ghost" id="smBack">Ku laabo shaqooyinka</button></div>';
    $("smBack").onclick = function () { $("smBody").innerHTML = ""; [].forEach.call(app.querySelectorAll(".sm-job"), function (x) { x.classList.remove("on"); }); };
  }
};
})();
