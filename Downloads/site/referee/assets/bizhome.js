/* Garsoore Ganacsi — the front door.
 *
 * business.buurwen.com used to open straight into a trading board, which assumed the visitor already knew what
 * Garsoore Business was. A trader arriving from a WhatsApp link did not, and a board of unfamiliar rows is not a
 * thing anybody reads their way into.
 *
 * The page answers three questions in order: what is this, what does it cost to ship, and what can I buy. The
 * demand feelers at the bottom are the only part that is not a product — they are a question back, and what
 * people click there decides what gets sourced next.
 */
(function () {
  var RF = window.RF || (window.RF = {});
  function $(id) { return document.getElementById(id); }
  function e(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function money(n) { return "$" + Math.round(+n).toLocaleString(); }

  /* Real numbers or none: the hero quote runs the same shipping engine the checkout does, so a trader who
     believes this figure and then orders sees the same one. */
  function quote(kg) {
    var S = RF.shipping;
    if (!S || !S.basket) return null;
    /* Ask for each lane BY NAME. basket() reads the mode off the line and defaults to air, so passing one line
       without a mode quietly prices air twice and calls it the cheapest - which is how a sea-freight business
       ends up quoting air on its own front page. */
    function lane(mode) {
      var g = S.basket([{ kg: kg, cat: "HOM", qty: 1, mode: mode }], null).groups[mode];
      return g && g.ok ? g.cost : null;
    }
    return { sea: lane("sea"), air: lane("air") };
  }

  function feelers() {
    var C = RF.catalog;
    var solar = C && C.products ? C.products.filter(function (p) { return p.cat === "SOL" && C.wholesaleOK(p); }).length : 0;
    /* Only the first of these is real. The other three are questions, and the page says so rather than implying a
       price we could not stand behind — a trader told "let me find out" on his first enquiry does not come back. */
    return [
      { key: "SOL", name: "Qorraxda", blurb: "Looxyo, batteriyo, inverter-yo iyo matoorada biyaha ee qorraxda.",
        have: solar, href: "market.html?cat=SOL",
        icon: '<rect x="2" y="4" width="20" height="11" rx="1"></rect><path d="M2 9h20"></path><path d="M9 4v11"></path><path d="M15 4v11"></path><path d="M7 20h10"></path><path d="M12 15v5"></path>' },
      { key: "PUMP", name: "Matoorada biyaha", blurb: "Matoorada ceelasha, kuwa beeraha iyo tuubooyinka.",
        have: 0, href: "sourcing.html?want=Matoorada%20biyaha",
        icon: '<circle cx="9" cy="13" r="5"></circle><path d="M9 8V4h6"></path><path d="M14 13h6"></path><path d="M17 10l3 3-3 3"></path><path d="M4 20h12"></path>' },
      { key: "STEEL", name: "Bir iyo qalab dhisme", blurb: "Bir xabag ah, saxan, tuubo iyo alaabta dhismaha.",
        have: 0, href: "sourcing.html?want=Bir%20iyo%20qalab%20dhisme",
        icon: '<path d="M3 8l9-4 9 4-9 4-9-4z"></path><path d="M3 12l9 4 9-4"></path><path d="M3 16l9 4 9-4"></path>' },
      { key: "TRACTOR", name: "Tarakteero iyo qalab beereed", blurb: "Tarakteero yar, qalab beereed iyo qaybo.",
        have: 0, href: "sourcing.html?want=Tarakteero",
        icon: '<circle cx="7" cy="17" r="4"></circle><circle cx="18" cy="17" r="2.5"></circle><path d="M7 13V7h5l3 5h3"></path><path d="M11 17h4"></path>' }
    ];
  }

  function svg(paths) {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  RF.bizHomeUI = function (app) {
    var C = RF.catalog;
    var nWhole = C && C.products ? C.products.filter(C.wholesaleOK).length : 0;
    var q = quote(240);

    app.innerHTML = '<div class="wrap">' +

      '<div class="bh-hero">' +
        '<div class="bh-heroL">' +
          '<div class="bh-kicker">Jumlad · Shiinaha → Muqdisho</div>' +
          '<h1>Ma aha inaad Shiinaha tagto.<br>Annaga ayaa kuu iibsanayna.</h1>' +
          '<p class="bh-lede">Dooro katalogga, ama noo soo dir link 1688 ah. Waanu la xisaabtamnaa iibiyaha, waan hubinnaa, ' +
          'waan isku darnaa, waanan keennaa — hal qiimo oo la keenay Muqdisho.</p>' +
          '<div class="bh-cta">' +
            '<a class="btn g-buy" href="market.html">Eeg katalogga jumlada</a>' +
            '<a class="btn ghost" href="china.html">Soo dir link</a>' +
          '</div>' +
        '</div>' +
        '<div class="bh-calc">' +
          '<div class="bh-calcT">Xisaabi rarka</div>' +
          '<label class="g-lbl" for="bhKg">Miisaanka guud (kg)</label>' +
          '<input class="g-in" id="bhKg" type="number" min="1" step="10" value="240">' +
          '<div class="bh-out" id="bhOut"></div>' +
          '<div class="g-eta">Isla nidaamka qiimeynta ee bakhaarka — ma aha qiyaas.</div>' +
        '</div>' +
      '</div>' +

      '<div class="bh-cards">' +
        '<a class="bh-card" href="market.html">' + svg('<path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle>') +
          '<b>Katalog jumlad</b><span>' + nWhole + ' alaab oo laga keeno 1688 iyo Made-in-China, MOQ iyo qiimo la keenay.</span></a>' +
        '<a class="bh-card" href="fbg.html">' + svg('<path d="M3 7h13v10H3z"></path><path d="M16 10h4l1 3v4h-5"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>') +
          '<b>FBG</b><span>Alaabtaadu waxay ku jirtaa bakhaarkayaga Muqdisho. Adigu leh, annagu iibinayna.</span></a>' +
        '<a class="bh-card" href="sourcing.html">' + svg('<path d="M12 3v18"></path><path d="M5 8h14"></path><path d="M5 16h14"></path>') +
          '<b>Naga iibso</b><span>Soo dir link ama sharax. Wakiil ayaa raadinaya, qiimo ayaad heleysaa, 30% carbuun.</span></a>' +
      '</div>' +

      '<div class="bh-pro">' +
        '<div><b>Garsoore Business Pro — $50 bishii</b>' +
        '<div>Carbuun la’aan, FBG furan, iyo mudnaanta shixnadaha. Jooji markaad rabto.</div></div>' +
        '<a class="btn g-buy" href="pro.html">Bilow Pro</a>' +
      '</div>' +

      '<div class="bh-feelH"><h2>Waxa badanaa nala weydiiyo</h2>' +
      '<span class="g-eta">Qaar katalogga kuma jiraan weli — noo sheeg, qiimo ayaan kuu raadinaynaa</span></div>' +
      '<div class="bh-feel">' + feelers().map(function (f) {
        return '<a class="bh-fc' + (f.have ? " on" : "") + '" href="' + f.href + '">' + svg(f.icon) +
          '<b>' + e(f.name) + '</b><span>' + e(f.blurb) + '</span>' +
          '<em>' + (f.have ? "✓ " + f.have + " alaab katalogga ku jira" : "Codso qiimo →") + '</em></a>';
      }).join("") + '</div>' +

      '<div class="bh-ask">' +
        '<span>Wax aanad halkan ka arag? <b>Noo sheeg</b> — codsiyada ayaa noo sheegaya waxa aan ku darno katalogga xigga.</span>' +
        '<a class="btn g-buy" href="sourcing.html">Codso alaab</a>' +
      '</div>' +

      '</div>';

    function draw() {
      var kg = Math.max(1, +$("bhKg").value || 240), r = quote(kg);
      if (!r || (r.sea == null && r.air == null)) { $("bhOut").innerHTML = '<div class="g-eta">Kaararka rarka lama helin.</div>'; return; }
      var best = r.sea != null && (r.air == null || r.sea < r.air) ? { m: "Badda", v: r.sea, d: "25–45 maalmood" } : { m: "Cirka", v: r.air, d: "7–14 maalmood" };
      $("bhOut").innerHTML = '<div class="bh-outRow"><span>' + best.m + '</span><b>' + money(best.v) + '</b></div>' +
        '<div class="g-eta">' + best.d + ' · rar keliya, alaabta ma ku jirto</div>';
    }
    $("bhKg").oninput = draw;
    draw();
  };
})();
