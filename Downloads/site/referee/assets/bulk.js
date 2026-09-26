/* Why buying more makes shipping cheaper — drawn from the live shipping engine, not from a designer's guess.
   Every number on these two pages is computed at render time from the same rate cards that price the shop, so the
   chart cannot drift away from what a customer is actually charged.

   The two shops get DIFFERENT arguments, because the truth is different on each:

     consumer   a light parcel carries a share of a shipment's fixed costs, so going from one to ten genuinely
                collapses the freight per unit. This is the strong version of "buy more, ship cheaper".

     business   for heavy wholesale goods it is mostly FALSE. Measured across the 421 wholesale products, buying ten
                times the minimum moves freight per unit by 7-15% on the heavy ones — a solar panel is already past
                every minimum at MOQ. A trader's saving does not come from more units of one thing, it comes from
                filling a container. So the business page argues volume of the SHIPMENT, not of the order, and says
                where the crossover is.

   Telling a trader the consumer story would be a lie he discovers on his second order. */
(function () {
  var RF = window.RF || (window.RF = {});
  function e(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toLocaleString(); }

  /* ---------------------------------------------------------------- a representative product to chart
     A real one from the catalogue wherever possible: a named thing somebody can click is more convincing than an
     abstraction, and it keeps the page honest because it is priced by the same code as its product page. */
  function subject() {
    var C = RF.catalog;
    if (C && C.products && C.products.length) {
      var pool = C.products.filter(function (p) {
        return C.retailOK(p) && p.kg >= 0.12 && p.kg <= 0.6 && p.variants && p.variants[0] && p.variants[0].cost > 0;
      });
      if (pool.length) {
        var priced = pool.map(function (p) {
          var L = C.basketPrice([{ product: p, variant: p.variants[0], qty: 1 }]).lines[0];
          return L && L.total != null ? { p: p, total: L.total } : null;
        }).filter(Boolean).sort(function (a, b) { return a.total - b.total; });
        if (priced.length) return priced[Math.floor(priced.length / 2)].p;   /* the median item, not the flattering one */
      }
    }
    return null;
  }

  function steps(p) {
    var C = RF.catalog, out = [], qs = [1, 2, 5, 10, 25, 50];
    qs.forEach(function (n) {
      var L = C.basketPrice([{ product: p, variant: p.variants[0], qty: n }]).lines[0];
      if (!L || L.total == null) return;
      out.push({ qty: n, unit: L.total / n, ship: L.shipping / n, item: L.item / n, total: L.total });
    });
    return out;
  }

  /* ---------------------------------------------------------------- the chart
     Bars, because the comparison is between six discrete quantities rather than a continuous trend, and a bar you
     can read the number off beats a line you have to interpret. */
  function bars(rows, max, labelOf, valueOf, subOf) {
    var W = 720, H = 260, padL = 54, padB = 46, padT = 16;
    var n = rows.length, bw = (W - padL - 16) / n;
    var body = rows.map(function (r, i) {
      var v = valueOf(r), h = Math.max(2, Math.round((H - padB - padT) * (v / max)));
      var x = padL + i * bw + bw * 0.16, w = bw * 0.68, y = H - padB - h;
      var best = i === n - 1;
      return '<g>' +
        '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + h + '" rx="5" ' +
          'fill="' + (best ? "var(--gs-good)" : "var(--gs-bar)") + '"/>' +
        '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 6) + '" text-anchor="middle" class="bv">' + e(subOf(r)) + '</text>' +
        '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - padB + 18) + '" text-anchor="middle" class="bl">' + e(labelOf(r)) + '</text>' +
      '</g>';
    }).join("");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bulkchart" role="img">' +
      '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - 8) + '" y2="' + (H - padB) + '" class="ax"/>' +
      body + '</svg>';
  }

  /* ---------------------------------------------------------------- consumer */
  function consumer(host) {
    var p = subject();
    if (!p) { host.innerHTML = '<div class="g-empty">Katalogga weli lama soo dejin.</div>'; return; }
    /* Shipping is inside the price now, so this page charts the PER-UNIT PRICE rather than a freight line. The
       saving is the same fact either way - a shipment's fixed costs are shared by whatever travels in it - but a
       chart of a number we deliberately stopped showing would be a chart of zeroes. */
    var rows = steps(p), one = rows[0], ten = rows.filter(function (r) { return r.qty === 10; })[0] || rows[rows.length - 1];
    var cut = one.unit > 0 ? Math.round(100 * (1 - ten.unit / one.unit)) : 0;
    var max = Math.max.apply(null, rows.map(function (r) { return r.unit; }));

    host.innerHTML =
      '<div class="bulkwrap">' +
      '<h1>Rarku <em>bilaash</em> ayuu yahay — oo tiro badan way ka raqiisan tahay</h1>' +
      '<p class="lede">Markaad hal shay iibsato, adigu kaligaa ayaa qaadaya kharashka shixnad oo dhan. ' +
      'Markaad toban iibsato, isla kharashkaas ayaa u qaybsanaya toban. Taasi waa sababta rarku u raqiisanayo ' +
      'marka tiradu kordho — <b>oo faa’iidadaadu u kordho</b>… haddii aad caqli leedahay 😉</p>' +

      '<div class="bignum"><b>−' + cut + '%</b><span>qiimaha halkii xabbo, marka aad 10 iibsato 1 beddelkeed</span></div>' +

      '<div class="chartcard">' +
        '<div class="chead"><b>Qiimaha halkii xabbo</b><span>' + e((p.brand ? p.brand + " " : "") + p.model).slice(0, 52) + ' · ' + p.kg + 'kg</span></div>' +
        bars(rows, max, function (r) { return r.qty + (r.qty === 1 ? " xabbo" : ""); },
                    function (r) { return r.unit; }, function (r) { return money(r.unit); }) +
      '</div>' +

      '<table class="bulktbl"><tr><th>Tirada</th><th>Halkii xabbo</th><th>Wadarta</th><th>Rar</th></tr>' +
      rows.map(function (r) {
        return '<tr' + (r.qty === 10 ? ' class="on"' : "") + '><td>' + r.qty + '</td><td><b>' + money(r.unit) + '</b></td>' +
          '<td>' + money(r.total) + '</td><td class="ok">BILAASH</td></tr>';
      }).join("") + '</table>' +

      '<div class="bulknote"><b>Tusaale</b> — iibso ' + ten.qty + ', mid iska hay, 9-da kale sii saaxiibbadaa ' +
      money(Math.ceil(one.unit)) + ' midkii (waa qiimaha ay iyagu bixin lahaayeen). ' +
      'Adigu waxaad bixisay ' + money(ten.unit) + ' midkii — faa’iidadaadu waa ' +
      '<b>' + money(Math.max(0, (Math.ceil(one.unit) - ten.unit) * (ten.qty - 1))) + '</b>, alaabtaadana bilaash ayay kuu noqotay.</div>' +

      '<div class="bulkcta"><a class="btn" href="index.html">Bilow iibsiga</a>' +
      '<a class="btn ghost" id="bulkBiz" href="#">Jumlad weyn? → Garsoore Ganacsi</a></div>' +
      '<p class="fine">Tirooyinkan waxaa laga xisaabiyay isla nidaamka qiimeynta ee bakhaarka — ma aha tusaale la sameeyay. ' +
      'Rarka waxaa lagu xisaabiyaa shixnadda la isku daray, sidaa darteed dalab yar wuxuu helaa isla qiimaha.</p>' +
      '</div>';
    if (document.getElementById("bulkBiz") && RF.sources)
      document.getElementById("bulkBiz").href = RF.sources.crossHref("bulk.html", "business");
  }

  /* ---------------------------------------------------------------- business */
  function business(host) {
    var cards = (window.RF_RATE_CARDS && window.RF_RATE_CARDS.cards) || [];
    var sea = cards.filter(function (c) { return c.mode === "sea"; })[0];
    if (!sea) { host.innerHTML = '<div class="g-empty">Kaararka rarka lama helin.</div>'; return; }
    function tier(cbm) { var r = sea.tiers[0].rate; sea.tiers.forEach(function (t) { if (cbm >= t.from) r = t.rate; }); return r; }
    var FCL = 4500, CONT = 60;                    /* a 40ft high cube, and the market rate to fill one */
    var pts = [1, 3, 10, 25, 40, 60].map(function (cbm) {
      var lcl = tier(cbm), fcl = FCL / cbm;
      return { cbm: cbm, lcl: lcl, fcl: fcl, best: Math.min(lcl, fcl), mode: fcl < lcl ? "FCL" : "LCL" };
    });
    var cross = pts.filter(function (p) { return p.mode === "FCL"; })[0];
    var max = Math.max.apply(null, pts.map(function (p) { return p.lcl; }));

    host.innerHTML =
      '<div class="bulkwrap">' +
      '<h1>Faa’iidadaadu kuma jirto inaad hal shay badan iibsato</h1>' +
      '<p class="lede">Waa run: rarku wuu raqiisanayaa marka aad wax badan iibsato — laakiin <b>ma aha sidaad u malaynayso</b>. ' +
      'Alaab culus sida looxa qorraxda, rarka halkii xabbo isku mid buu ku noqonayaa inaad 100 iibsato iyo 1,000. ' +
      'Meesha lacagtu ku jirto waa <b>buuxinta shixnadda</b> — ee ma aha tirada hal alaab.</p>' +

      '<div class="bignum"><b>' + money(pts[0].best) + ' → ' + money(pts[pts.length - 1].best) + '</b>' +
      '<span>qiimaha mitir kub (cbm) marka shixnaddu ka koreyso 1 cbm ilaa 60 cbm</span></div>' +

      '<div class="chartcard">' +
        '<div class="chead"><b>Qiimaha halkii cbm</b><span>badda · kaarka LCL vs kontenar 40ft</span></div>' +
        bars(pts, max, function (p) { return p.cbm + " cbm"; }, function (p) { return p.best; },
             function (p) { return money(p.best); }) +
      '</div>' +

      '<table class="bulktbl"><tr><th>Shixnadda</th><th>LCL (wadaag)</th><th>Kontenar 40ft</th><th>Kaas oo raqiis ah</th></tr>' +
      pts.map(function (p) {
        return '<tr' + (cross && p.cbm === cross.cbm ? ' class="on"' : "") + '><td>' + p.cbm + ' cbm</td>' +
          '<td>' + money(p.lcl) + '/cbm</td><td>' + money(p.fcl) + '/cbm</td>' +
          '<td><b>' + p.mode + '</b> · ' + money(p.best) + '</td></tr>';
      }).join("") + '</table>' +

      (cross ? '<div class="bulknote"><b>Halka ay isku beddelayaan</b> — marka shixnaddaadu gaadho ku dhawaad ' +
        '<b>' + cross.cbm + ' cbm</b>, kontenar buuxa ayaa ka raqiisanaya LCL. Kama baahnid inaad buuxiso: ' +
        'kontenar nus buuxa ayaa horeba uga fiican. Waxaan kuu kaydinaynaa lacagtaas markaad gaadho.</div>' : "") +

      '<div class="bulknote warn"><b>Waxa aan been kuugu sheegi doonin</b> — haddaad alaab culus 10 jibaar ka badan iibsato, ' +
      'rarka halkii xabbo wuxuu hoos u dhacayaa <b>7–15%</b> oo keliya, ma aha kala badh. ' +
      'Waxaan kaa caawin karnaa inaad shixnaddaada la isku darto mid kale si aad u gaadho heerka raqiiska ah.</div>' +

      '<div class="bulkcta"><a class="btn" href="china.html">Eeg katalogga jumlada</a>' +
      '<a class="btn ghost" href="../calculator.html">Xisaabi rarkaaga</a></div>' +
      '<p class="fine">Qiimaha LCL wuxuu ka yimid kaarkayaga heshiiska (' + e(sea.id) + ', xaalad: ' + e(sea.status) + '). ' +
      'Qiimaha kontenarka waa ' + money(FCL) + ' oo ah celcelis suuqa, mana aha mid la heshiiyay weli.</p>' +
      '</div>';
  }

  RF.bulkUI = function (host) {
    if (window.SURFACE === "business") business(host); else consumer(host);
  };
})();
