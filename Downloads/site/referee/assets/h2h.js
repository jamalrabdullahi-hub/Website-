/* Gacan ka Gacan — hand to hand.
 *
 * People selling to each other. Garsoore charges nothing, holds nothing and guarantees nothing here, and the page
 * says all three out loud. That last part is not modesty: the rest of this site is built on escrow, and a shopper
 * who assumes escrow covers a stranger's phone sold in a car park is a shopper we have actively misled.
 *
 * It earns no money on purpose. It exists so the site is worth opening on a day nobody is importing, and so a
 * person who came to sell a fridge walks past the China catalogue on the way.
 */
(function () {
  var RF = window.RF || (window.RF = {});
  function $(id) { return document.getElementById(id); }
  function e(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function money(n) { return "$" + (Math.round(+n * 100) / 100).toLocaleString(); }

  var CATS = [
    ["", "Dhammaan"], ["PHN", "Taleefanno"], ["ELC", "Elektaroonik"], ["HOM", "Guriga"],
    ["FRN", "Alaab guri"], ["VEH", "Gaadiid"], ["CLO", "Dhar"], ["OTHER", "Kale"]
  ];
  var COND = { "new": "Cusub", used: "La isticmaalay", parts: "Qaybo" };

  function ago(iso) {
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
    if (d < 60) return d <= 1 ? "hadda" : d + " daqiiqo";
    if (d < 1440) return Math.floor(d / 60) + " saac";
    return Math.floor(d / 1440) + " maalmood";
  }

  function card(l) {
    return '<a class="g-pc" href="h2h.html?id=' + encodeURIComponent(l.id) + '">' +
      '<div class="g-pimg">' + (l.images && l.images[0]
        ? '<img class="g-pimgi" loading="lazy" src="' + e(l.images[0]) + '" alt="" referrerpolicy="no-referrer">'
        : '<span class="h2h-noimg">' + e((l.title || "?").slice(0, 1).toUpperCase()) + '</span>') + '</div>' +
      '<div class="g-pb"><div class="g-pn">' + e(l.title) + '</div>' +
      '<div class="g-pr">' + (l.price == null ? '<span class="h2h-neg">Waa la heshiin karaa</span>' : money(l.price)) + '</div>' +
      '<div class="g-eta">' + e(COND[l.condition] || l.condition) + ' · ' + e(l.district || l.city || "") + ' · ' + ago(l.at) + '</div>' +
      '</div></a>';
  }

  function list(app) {
    var cat = "", q = "";
    app.innerHTML = '<div class="wrap">' +
      '<div class="h2h-head"><div>' +
        '<h1>Gacan ka Gacan</h1>' +
        '<p class="h2h-lede">Iibi wixii aad haysato. Garsoore <b>waxba kama qaadato</b> — ma jirto khidmad, ma jiro komishan. ' +
        'Iibiyaha iyo iibsadaha ayaa toos u kulma.</p>' +
      '</div><button class="btn g-buy" id="h2hNew">+ Dhig alaab</button></div>' +
      '<div class="g-filters">' +
        '<label>Raadi <input id="h2hQ" type="search" placeholder="taleefan, kursi, baabuur"></label>' +
        '<label>Qaybta <select id="h2hCat">' + CATS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select></label>' +
        '<span class="g-eta" id="h2hCount"></span>' +
      '</div>' +
      '<div class="g-grid" id="h2hGrid"><div class="g-empty">⏳</div></div>' +
      '<div class="h2h-warn">' +
        '<b>Garsoore lacagta kuma dhex jirto halkan.</b> Escrow-ka, hubinta iyo celinta waxay khuseeyaan oo keliya ' +
        'alaabta Shiinaha ee <a href="index.html">Suuqa</a>. Halkan si taxaddar leh u kulan: meel dadweyne ah ku kulma, ' +
        'alaabta hubi ka hor inta aanad lacag bixin.' +
      '</div></div>';

    function draw() {
      RF.api.call("GET", "/h2h?cat=" + encodeURIComponent(cat) + "&q=" + encodeURIComponent(q)).then(function (r) {
        var n = r.listings.length;
        $("h2hCount").textContent = n + (n === 1 ? " alaab" : " alaab");
        $("h2hGrid").innerHTML = n ? r.listings.map(card).join("")
          : '<div class="g-empty">Waxba lama helin. <b>Noqo kii ugu horreeyay ee dhiga.</b></div>';
      }).catch(function (x) { $("h2hGrid").innerHTML = '<div class="g-empty">' + e(x.message) + '</div>'; });
    }
    var tmr;
    $("h2hQ").oninput = function () { q = $("h2hQ").value.trim(); clearTimeout(tmr); tmr = setTimeout(draw, 250); };
    $("h2hCat").onchange = function () { cat = $("h2hCat").value; draw(); };
    $("h2hNew").onclick = function () { post(); };
    draw();
  }

  function post() {
    RF.backend.needUser("Gal si aad alaab u dhigto.").then(function () {
      var box = $("modalBox");
      box.innerHTML = '<div class="g-co"><h2>Dhig alaab</h2>' +
        '<div class="g-sku">Bilaash — Garsoore waxba kama qaadato</div>' +
        '<input class="g-in" id="nTitle" maxlength="90" placeholder="Waa maxay? (tusaale: iPhone 11 64GB)">' +
        '<div class="h2h-row">' +
          '<input class="g-in" id="nPrice" inputmode="decimal" placeholder="Qiimaha $ (ka tag madhan = la heshiin karo)">' +
          '<select class="g-in" id="nCat">' + CATS.slice(1).map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join("") + '</select>' +
        '</div>' +
        '<div class="h2h-row">' +
          '<select class="g-in" id="nCond"><option value="used">La isticmaalay</option><option value="new">Cusub</option><option value="parts">Qaybo</option></select>' +
          '<input class="g-in" id="nDist" maxlength="40" placeholder="Degmada (Hodan, Waberi…)">' +
        '</div>' +
        '<textarea class="g-in" id="nDescr" rows="3" maxlength="900" placeholder="Sharax xaaladda, sababta aad u iibinayso…"></textarea>' +
        '<input class="g-in" id="nPhone" inputmode="tel" placeholder="Lambarka lagaala soo xidhiidho">' +
        '<div class="g-eta">Lambarkaaga waxaa arka oo keliya dadka galay — ma aha internetka oo dhan.</div>' +
        '<div class="g-err sm" id="nErr" hidden></div>' +
        '<button class="btn g-buy full" id="nGo">Dhig</button></div>';
      var u = RF.api.user;
      if (u && u.profile && u.profile.phoneFull) $("nPhone").value = u.profile.phoneFull.replace(/^\+/, "");
      $("nGo").onclick = function () {
        var t = $("nTitle").value.trim();
        if (t.length < 3) return fail("Ku qor magaca alaabta.");
        if (!RF.phoneOk($("nPhone").value)) return fail("Ku qor lambar taleefan oo sax ah.");
        $("nGo").disabled = true;
        RF.api.call("POST", "/h2h", {
          title: t, descr: $("nDescr").value.trim(), price: $("nPrice").value.trim() === "" ? null : $("nPrice").value.trim(),
          cat: $("nCat").value, condition: $("nCond").value, district: $("nDist").value.trim(), phone: $("nPhone").value.trim()
        }).then(function (r) { location.href = "h2h.html?id=" + r.id; })
          .catch(function (x) { $("nGo").disabled = false; fail(x.message); });
      };
      function fail(msg) { $("nErr").textContent = msg; $("nErr").hidden = false; }
      $("modal").classList.add("on");
    }).catch(function () {});
  }

  function one(app, id) {
    app.innerHTML = '<div class="wrap g-empty">⏳</div>';
    RF.api.call("GET", "/h2h/" + encodeURIComponent(id)).then(function (r) {
      var l = r.listing;
      app.innerHTML = '<div class="wrap">' +
        '<div class="g-crumb"><a href="h2h.html">Gacan ka Gacan</a> / ' + e(CATS.filter(function (c) { return c[0] === l.cat; }).map(function (c) { return c[1]; })[0] || "Kale") + '</div>' +
        '<div class="g-phero"><div class="g-pic">' + (l.images && l.images[0]
          ? '<img src="' + e(l.images[0]) + '" alt="" referrerpolicy="no-referrer">'
          : '<span class="h2h-noimg big">' + e(l.title.slice(0, 1).toUpperCase()) + '</span>') + '</div><div>' +
          (l.state === "SOLD" ? '<span class="g-pill">LA IIBIYAY</span>' : '<span class="g-pill">Gacan ka Gacan</span>') +
          '<h1>' + e(l.title) + '</h1>' +
          '<div class="h2h-price">' + (l.price == null ? "Waa la heshiin karaa" : money(l.price)) + '</div>' +
          '<div class="g-eta">' + e(COND[l.condition] || l.condition) + ' · ' + e(l.district || l.city || "") + ' · ' + ago(l.at) + ' · ' + l.views + ' aragti</div>' +
          (l.descr ? '<p class="g-blurb">' + e(l.descr) + '</p>' : "") +
          (l.phone
            ? '<a class="btn g-buy" href="tel:+' + e(l.phone) + '">📞 Wac ' + e(RF.phoneFmt ? RF.phoneFmt(l.phone) : l.phone) + '</a>' +
              '<a class="btn ghost" style="margin-left:8px" href="https://wa.me/' + e(l.phone) + '" target="_blank" rel="noopener">WhatsApp</a>'
            : '<button class="btn g-buy" id="h2hLogin">Gal si aad lambarka u aragto</button>') +
        '</div></div>' +
        '<div class="h2h-warn">' +
          '<b>Garsoore ma dhex galo iibkan.</b> Lacag ma hayno, damaanad ma qaadno. Meel dadweyne ah ku kulma, ' +
          'alaabta tijaabi, kadibna lacagta bixi. Haddii wax khaldan yihiin, <button class="linkbtn" id="h2hRep">soo sheeg</button>.' +
        '</div>' +
        (l.mine ? '<div class="h2h-own"><b>Waa alaabtaada.</b> ' +
          '<button class="btn ghost" data-act="sold">La iibiyay</button> ' +
          '<button class="btn ghost" data-act="bump">Kor u qaad</button> ' +
          '<button class="btn ghost" data-act="remove">Tirtir</button></div>' : "") +
        '</div>';
      if ($("h2hLogin")) $("h2hLogin").onclick = function () { RF.backend.needUser("Gal si aad lambarka u aragto.").then(function () { one(app, id); }).catch(function () {}); };
      if ($("h2hRep")) $("h2hRep").onclick = function () {
        var why = prompt("Maxaa khaldan?");
        if (why == null) return;
        RF.api.call("POST", "/h2h/" + id + "/report", { reason: why }).then(function () { alert("Waa la diray. Mahadsanid."); }).catch(function (x) { alert(x.message); });
      };
      [].forEach.call(document.querySelectorAll("[data-act]"), function (b) {
        b.onclick = function () {
          RF.api.call("POST", "/h2h/" + id + "/" + b.dataset.act, {})
            .then(function () { if (b.dataset.act === "remove") location.href = "h2h.html"; else one(app, id); })
            .catch(function (x) { alert(x.message); });
        };
      });
    }).catch(function (x) { app.innerHTML = '<div class="wrap g-empty">' + e(x.message) + ' <a href="h2h.html">Dib u noqo →</a></div>'; });
  }

  RF.h2hUI = function (app) {
    var id = new URLSearchParams(location.search).get("id");
    if (id) one(app, id); else list(app);
  };
})();
