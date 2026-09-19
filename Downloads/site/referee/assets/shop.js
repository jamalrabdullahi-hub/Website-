/* Garsoore — consumer shop UI: home (split hero + feed), product (immersive + sticky buy bar),
   Shop China (paste a JD/1688 link), one-page checkout, order tracking. Depends on catalog.js. */
(function () {
var RF = window.RF, C = RF.catalog;
var e, toast, chName = function (c) { return RF.chName(c); };
function $(id) { return document.getElementById(id); }
function qs(k) { return new URLSearchParams(location.search).get(k) || ""; }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US"); }
function eta(d) { return d ? "~" + d + " maalmood" : "Maanta"; }

function cardHTML(p) {
  var c = C.card(p);
  return '<a class="g-pc" href="product.html?sku=' + c.sku + '"><div class="g-pimg"><span class="g-bd ' + (c.china ? "cn" : "lo") + '">' +
    (c.china ? "SHIINAHA" : "GUDAHA") + '</span>' + c.icon + '</div><div class="g-pb"><div class="g-pn">' + e(c.title) + '</div>' +
    '<div class="g-pr">' + money(c.total) + '</div><div class="g-eta"><span class="g-v">✓</span> ' + eta(c.etaDays) + ' · ' + e(c.where) + '</div></div></a>';
}

/* ---------------------------------------------------------------- home */
function home(app) {
  var q = qs("q"), cat = qs("cat");
  app.innerHTML =
    '<div class="wrap">' +
    '<section class="g-split">' +
      '<div class="g-local"><span class="g-pill">✓ Iibiye kasta waa la hubiyay</span>' +
        '<h1>Wax walba,<br>hal meel.</h1>' +
        '<p>Alaab, adeegyo iyo xayeysiis gudaha Soomaaliya — lacagtaadu way xajisan tahay ilaa aad hesho.</p>' +
        '<form class="g-search" id="sForm"><input id="sQ" placeholder="Raadi taleefan, laptop, solar, qaboojiye…" value="' + e(q) + '"><button class="btn">Raadi</button></form>' +
        '<div class="g-quick">' + ["Redmi", "Laptop", "Solar", "Qaboojiye", "Bajaj"].map(function (w) { return '<a class="chip" href="?q=' + encodeURIComponent(w) + '#feed">' + w + '</a>'; }).join("") + '</div>' +
      '</div>' +
      '<div class="g-china"><span class="g-tagw">GARSOORE CHINA</span><h2>Ka hel Shiinaha.<br>Ku iibso Garsoore.</h2>' +
        '<p>Ku dheji link JD, 1688, Taobao ama Pinduoduo — hal qiimo, hal badhan. Iibsiga, rarka iyo keenista annaga ayaa qabanayna.</p>' +
        '<form class="g-paste" id="pForm"><input id="pU" placeholder="https://item.jd.com/…"><button class="btn gold">Qiimee</button></form>' +
        '<div class="g-src"><span>JD</span><span>1688</span><span>Taobao/Tmall</span><span>Pinduoduo</span><span>~20 maalmood</span><span>Pickup Muqdisho</span></div></div>' +
    '</section>' +
    '<div class="g-sec"><h2>Qaybaha</h2></div><div class="g-tiles">' +
      C.CATS.map(function (c) { return '<a class="g-tile' + (cat === c.id ? " on" : "") + '" href="?cat=' + c.id + '#feed"><div>' + c.icon + '</div>' + c.so + '</a>'; }).join("") +
      '<a class="g-tile cn" href="china.html"><div>🇨🇳</div>Shiinaha</a></div>' +
    '<div class="g-sec" id="feed"><h2>' + (q ? "Natiijooyinka “" + e(q) + "”" : cat ? C.CATS.filter(function (c) { return c.id === cat; })[0].so : "Hadda la jecel yahay") + '</h2>' +
      '<div class="g-seg" id="seg"><span class="on" data-v="">Dhammaan</span><span data-v="lo">Gudaha</span><span data-v="cn">Shiinaha</span></div></div>' +
    '<div class="g-grid" id="grid"></div>' +
    '<section class="g-bizband"><div><h3>Garsoore <span>Ganacsi</span></h3><p>Jumlad, qandaraas, adeegyo ganacsi iyo iibsi Shiinaha oo badan.</p></div>' +
      '<form class="g-req" onsubmit="location.href=\'business/index.html\';return false"><input placeholder="Waxaan u baahanahay 50 laptop…"><button class="btn gold">Codso qiimo</button></form></section>' +
    '</div>';
  var PAGE_N = 30, shown = PAGE_N, filt = "";
  function draw() {
    var list = C.search(q, { cat: cat || null, china: filt === "cn" ? true : filt === "lo" ? false : undefined });
    if (!q) list = C.mixed(list);
    $("grid").innerHTML = list.length ? list.slice(0, shown).map(cardHTML).join("") +
      (list.length > shown ? '<div class="g-more"><button class="btn ghost" id="moreBtn">Muuji dheeraad (' + (list.length - shown) + ')</button></div>' : "") :
      '<div class="g-empty">Wax lama helin. <a href="china.html?q=' + encodeURIComponent(q) + '">Ka raadi Shiinaha →</a></div>';
    if ($("moreBtn")) $("moreBtn").onclick = function () { shown += PAGE_N; draw(); };
  }
  draw();
  $("seg").onclick = function (ev) { var sp = ev.target.closest("span"); if (!sp) return; [].forEach.call(this.children, function (x) { x.classList.toggle("on", x === sp); }); filt = sp.dataset.v; shown = PAGE_N; draw(); };
  $("sForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "?q=" + encodeURIComponent($("sQ").value) + "#feed"; };
  $("pForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "china.html?u=" + encodeURIComponent($("pU").value); };
}

/* ---------------------------------------------------------------- product (immersive + sticky buy bar) */
var CUR = null;
function productView(p, host) {
  var vi = 0;
  function render() {
    var v = p.variants[vi], pr = C.price(p, v), china = !pr.local, src = p.sources[0], isReq = p.oneoff && !v.quoted;
    host.innerHTML =
      '<div class="g-phero"><div class="g-pic">' + p.icon + '</div><div>' +
        '<span class="g-pill ' + (china ? "gold" : "") + '">' + (china ? "Garsoore China · " + chName(src.channel) + (v.quoted ? " · qiimo rasmi" : p.oneoff ? " · dalab hal mar" : "") : "✓ " + e(src.seller) + " · " + e(src.city)) + '</span>' +
        '<div class="g-sku">' + p.sku + (p.modelNo ? " · " + e(p.modelNo) : "") + '</div>' +
        '<h1>' + e((p.brand ? p.brand + " " : "") + p.model) + '</h1><p class="g-blurb">' + e(p.blurb) + '</p>' +
        (p.variants.length > 1 ? '<div class="g-lbl">Nooca</div><div>' + p.variants.map(function (x, i) {
          return '<button class="g-o' + (i === vi ? " on" : "") + '" data-i="' + i + '">' + (x.hex ? '<i style="background:' + x.hex + '"></i>' : "") + e(x.label) + (x.color && x.color !== "—" ? " · " + e(x.color) : "") + '</button>';
        }).join("") + '</div>' : "") +
      '</div></div>' +
      '<div class="g-specs">' + p.specs.map(function (s) { return '<div><span>' + e(s[0]) + '</span><b>' + e(s[1]) + '</b></div>'; }).join("") + '</div>' +
      '<div class="g-trust"><div><b>Hal qiimo</b>Kharash qarsoon ma jiro</div><div><b>Lacag la xajiyo</b>Garsoore ayaa haya ilaa aad hesho</div><div><b>Celin 7 maalmood</b>Haddii aysan ahayn sidii la sheegay</div></div>' +
      '<div class="g-buybar"><div class="g-bi">' + p.icon + '</div><div class="g-bt"><b>' + e(p.model) + (v.label && v.label !== "Standard" ? " · " + e(v.label) : "") + '</b>' +
        '<div class="g-eta">' + (china ? "🚚 Diyaar " + eta(pr.etaDays) + " · Pickup Muqdisho" : "Diyaar maanta · " + e(src.city)) + ' · 🔒 Lacag la xajiyo</div></div>' +
        '<div class="g-price">' + (isReq ? "≈ " : "") + money(pr.total) + '</div><button class="btn g-buy" id="buyBtn">' + (isReq ? "Codso qiimo rasmi ah" : "Hadda iibso") + '</button></div>' +
      (isReq ? '<div class="g-found" style="margin-top:12px">Alaabtan ma ahan kuwa katalogga. Qiimahan waa qiyaas — koox Garsoore ah ayaa hubinaysa oo kuu soo diraysa qiimo rasmi ah (saacado gudahood), kadibna waad iibsan kartaa.</div>' : "");
    [].forEach.call(host.querySelectorAll(".g-o"), function (b) { b.onclick = function () { vi = +b.dataset.i; render(); }; });
    $("buyBtn").onclick = function () {
      if (!isReq) return checkout(p, v);
      var q = RF.quotes.request(p);
      $("buyBtn").outerHTML = '<a class="btn g-buy" href="orders.html?quote=' + q.id + '">✓ La diray — eeg Dalabyadayda</a>';
      toast("Codsigii qiimaha waa la diray · " + q.id);
    };
  }
  render();
}
function product(app) {
  var qid = qs("quote"), qq = qid && RF.quotes.list().filter(function (x) { return x.id === qid && x.status === "quoted"; })[0];
  var p = qq ? RF.quotes.asProduct(qq) : C.get(qs("sku"));
  if (!p) { app.innerHTML = '<div class="wrap g-empty">Alaabtan lama helin. <a href="index.html">Dib u noqo →</a></div>'; return; }
  app.innerHTML = '<div class="wrap"><div class="g-crumb"><a href="index.html">Suuqa</a> / ' + (C.CATS.filter(function (c) { return c.id === p.cat; })[0] || { so: "Shiinaha" }).so + '</div><div id="pv"></div>' +
    '<div class="g-sec"><h2>Waxyaabo la mid ah</h2></div><div class="g-grid" id="rel"></div></div>';
  productView(p, $("pv"));
  $("rel").innerHTML = C.products.filter(function (x) { return x.sku !== p.sku && x.cat === p.cat; }).slice(0, 5).map(cardHTML).join("");
}

/* ---------------------------------------------------------------- one-page checkout */
function checkout(p, v) {
  var pr = C.price(p, v), st = { delivery: false, pay: "EVC Plus" };
  var box = $("modalBox");
  function render() {
    var total = pr.total + (st.delivery ? 5 : 0);
    box.innerHTML = '<div class="g-co"><h2>Lacag bixinta</h2><div class="g-sku">Hal tallaabo — waa intaas</div>' +
      '<div class="g-line"><div class="g-th">' + p.icon + '</div><div style="flex:1"><b>' + e((p.brand ? p.brand + " " : "") + p.model) + '</b><div class="g-eta">' +
        e([v.label, v.color].filter(function (x) { return x && x !== "—" && x !== "Standard"; }).join(" · ") || "×1") + ' · ' + (pr.local ? "Diyaar maanta" : "Diyaar " + eta(pr.etaDays)) + '</div></div><b>' + money(pr.total) + '</b></div>' +
      '<div class="g-lbl">Halkee ka qaadanaysaa?</div>' +
      '<div class="g-rad' + (!st.delivery ? " on" : "") + '" data-d="0"><i></i>Xarunta Garsoore · Km4, Muqdisho<span>Bilaash</span></div>' +
      '<div class="g-rad' + (st.delivery ? " on" : "") + '" data-d="1"><i></i>Gaarsiin guriga (Muqdisho)<span>+$5</span></div>' +
      '<div class="g-lbl">Ku bixi</div><div class="g-pay">' + ["EVC Plus", "ZAAD", "Sahal", "Premier Wallet"].map(function (m) { return '<div class="' + (st.pay === m ? "on" : "") + '">' + m + '</div>'; }).join("") + '</div>' +
      '<div class="g-tot"><span>Wadarta</span><b>' + money(total) + '</b></div>' +
      '<button class="btn g-buy full" id="confirm">Xaqiiji dalabka</button>' +
      '<div class="g-escrow">🔒 <b>Garsoore ayaa hayn doona lacagtaada</b> ilaa aad alaabta gacanta ku hesho.</div></div>';
    [].forEach.call(box.querySelectorAll(".g-rad"), function (r) { r.onclick = function () { st.delivery = r.dataset.d === "1"; render(); }; });
    [].forEach.call(box.querySelectorAll(".g-pay div"), function (d) { d.onclick = function () { st.pay = d.textContent; render(); }; });
    $("confirm").onclick = function () { var o = RF.orders.place(p, v, st); location.href = "orders.html?new=" + o.id; };
  }
  render();
  $("modal").classList.add("on");
}

/* ---------------------------------------------------------------- Shop China */
function china(app) {
  var u = qs("u"), q = qs("q"), S = RF.sources, A = S.ADAPTERS;
  var chips = Object.keys(A).map(function (k) { return '<span>' + A[k].name + ' <small>' + A[k].zh + '</small></span>'; }).join("");
  app.innerHTML = '<div class="wrap"><section class="g-chero"><span class="g-tagw">GARSOORE CHINA</span><h1>Ka hel Shiinaha. Ku iibso Garsoore.</h1>' +
    '<p>Kuma baahnid akoon Shiinees, luqad, lacag bixin Shiinees ama rar. Ku dheji link — waxaad helaysaa hal qiimo iyo hal badhan.</p>' +
    '<form class="g-paste big" id="pForm"><input id="pU" placeholder="Ku dheji link JD, 1688, Taobao, Tmall, Pinduoduo ama Alibaba…" value="' + e(u) + '"><button class="btn gold">Qiimee</button></form>' +
    '<div class="g-src">' + chips + '</div>' +
    '<div class="g-src"><a href="?u=https://item.jd.com/100071383535.html">Tijaabi: laptop JD</a><a href="?u=https://detail.1688.com/offer/712288934512.html">Tijaabi: AC 1688</a>' +
      '<a href="?u=https://item.taobao.com/item.htm?id=693311240517">Tijaabi: Taobao</a><a href="?u=https://mobile.yangkeduo.com/goods.html?goods_id=512233441">Tijaabi: Pinduoduo</a></div>' +
    '<ol class="g-how"><li><b>Ku dheji</b>link ama raadi</li><li><b>Hel qiimo</b>hal wadar, kharash qarsoon ma jiro</li><li><b>Iibso</b>EVC · ZAAD · Sahal</li><li><b>Ka qaado</b>Muqdisho ~20 maalmood</li></ol></section>' +
    '<div id="res"></div>' +
    '<div class="g-sec"><h2>Ka raadi dhammaan suuqyada Shiinaha</h2><form class="g-search sm" id="sForm"><input id="sQ" placeholder="kettle, charger, CCTV…" value="' + e(q) + '"><button class="btn">Raadi</button></form></div>' +
    '<div class="g-grid" id="grid"></div></div>';
  $("pForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "?u=" + encodeURIComponent($("pU").value); };
  $("sForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "?q=" + encodeURIComponent($("sQ").value) + "#grid"; };
  var cat = C.search(q, { china: true });
  var total = cat.length; cat = (q ? cat : C.mixed(cat)).slice(0, 40);
  S.search(total >= 8 ? "\u0000" : q, {}, function (offers) {
    // one card per item: cheapest platform wins, so the consumer never compares marketplaces
    var best = {};
    offers.forEach(function (o) { var k = o.title; if (!best[k] || o.tiers[0].cost < best[k].tiers[0].cost) best[k] = o; });
    var extra = Object.keys(best).map(function (k) { var o = best[k], p = S.toProduct(o).product; C._tmp = C._tmp || {}; C._tmp[p.sku] = p; return p; });
    var list = cat.concat(extra);
    $("grid").innerHTML = list.length ? list.map(function (p) { return cardHTML(p).replace('href="product.html?sku=' + p.sku + '"', p.oneoff ? 'href="?u=' + encodeURIComponent(S.ADAPTERS[p.sources[0].channel].url(p.sources[0].ref)) + '"' : '$&'); }).join("")
      : '<div class="g-empty">Wax lama helin — isku day inaad link ku dhejiso.</div>';
  });
  if (u) {
    $("res").innerHTML = '<div class="g-found">⏳ Waa la raadinayaa…</div>';
    RF.china.resolveAsync(u, function (r) {
      if (r.error) {
        $("res").innerHTML = '<div class="g-err">' + e(r.error) + (r.canQuote ? '<div style="margin-top:10px"><button class="btn" id="qBtn">Codso qiimo rasmi ah</button></div>' : "") + '</div>';
        if (r.canQuote) $("qBtn").onclick = function () { var q = RF.quotes.requestLink(r.id, r.url); location.href = "orders.html?quote=" + q.id; };
        return;
      }
      var o = r.offer, sel = o.seller;
      $("res").innerHTML = '<div class="g-found">✓ ' + (r.mode === "catalog" ? "Waa la aqoonsaday — alaab ku jirta katalogga Garsoore" : "Waa la aqoonsaday — dalab hal mar ah") +
        ' · ' + S.ADAPTERS[o.platform].name + ' · iibiye ' + (sel.verified ? "la hubiyay" : "aan weli la hubin") + '</div><div id="pv"></div>';
      productView(r.product, $("pv"));
    });
  }
}

/* ---------------------------------------------------------------- orders */
function orders(app) {
  var list = RF.orders.list(), fresh = qs("new"), ops = qs("ops") === "1";
  app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Dalabyadayda</h1>' +
    '<a class="chip" href="?' + (ops ? "" : "ops=1") + '">' + (ops ? "Qari" : "Muuji") + ' ops view (demo)</a></div>' +
    (fresh ? '<div class="g-found">✓ Dalabkaaga waa la helay. Lacagta Garsoore ayaa haysa ilaa aad hesho.</div>' : "") +
    (RF.quotes.list().length ? '<div class="g-sec"><h2>Codsiyada qiimaha</h2></div>' + RF.quotes.list().map(function (x) {
      return '<div class="g-order' + (x.id === qs("quote") ? " new" : "") + '"><div class="g-ohead"><div class="g-th">' + x.icon + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
        '<div class="g-eta">' + x.id + ' · ' + chName(x.platform) + ' · ' + (x.estimate == null ? "qiimo la sugayo" : "qiyaas ≈ " + money(x.estimate)) + '</div></div>' +
        (x.status === "pending" ? '<span class="g-pill gold">⏳ Waa la qiimaynayaa</span>' :
         x.status === "quoted" ? '<div style="text-align:right"><div class="g-price sm">' + money(x.total) + '</div><div class="g-eta">~' + x.etaDays + ' maalmood</div></div><a class="btn" href="product.html?quote=' + x.id + '">Iibso</a>' :
         '<span class="g-pill">Lama helin</span>') + '</div>' + (x.staffNote ? '<div class="g-eta" style="margin-top:8px">Fariin: ' + e(x.staffNote) + '</div>' : "") + '</div>';
    }).join("") : "") + (list.length ? '<div class="g-sec"><h2>Dalabyada</h2></div>' : "") +
    (list.length ? list.map(function (o) {
      var f = RF.orders.FLOW[o.flow], i = f.indexOf(o.state);
      return '<div class="g-order' + (o.id === fresh ? " new" : "") + '"><div class="g-ohead"><div class="g-th">' + o.icon + '</div><div style="flex:1"><b>' + e(o.title) + '</b>' +
        '<div class="g-eta">' + e(o.variant || "") + ' · ' + o.id + ' · ' + e(o.pay) + ' · ' + e(o.pickup) + '</div></div><div class="g-price sm">' + money(o.total) + '</div></div>' +
        '<div class="g-track">' + f.map(function (s, k) { return '<div class="' + (k < i ? "d" : k === i ? "n" : "") + '"><i></i>' + RF.orders.STATE_SO[s] + '</div>'; }).join("") + '</div>' +
        '<div class="g-orow"><span class="g-eta">' + (o.escrow === "released" ? "✓ Lacagta waa la sii daayay" : "🔒 Lacagta waa la xajiyay") + (o.etaDays && o.state !== "COMPLETED" ? " · Diyaar " + eta(o.etaDays) : "") + '</span>' +
        (i < f.length - 1 ? '<button class="btn ghost" data-adv="' + o.id + '">' + (f[i + 1] === "COMPLETED" ? "Waan qaatay ✓" : "Tallaabada xigta (demo)") + '</button>' : "") + '</div>' +
        (ops && o.internal ? '<pre class="g-ops">' + e(JSON.stringify(o.internal, function (k, v) { return typeof v === "number" ? Math.round(v * 100) / 100 : v; }, 2)) + '</pre>' : "") +
      '</div>';
    }).join("") : '<div class="g-empty">Dalab weli ma jiro. <a href="index.html">Bilow iibsiga →</a></div>') + '</div>';
  [].forEach.call(app.querySelectorAll("[data-adv]"), function (b) { b.onclick = function () { RF.orders.advance(b.dataset.adv); orders(app); }; });
}


/* ---------------------------------------------------------------- business: China procurement (business.garsoore.com/china.html) */
function bizChina(app) {
  var S = RF.sources, A = S.ADAPTERS, q = qs("q"), u = qs("u"), plat = qs("p") || "";
  var plats = plat ? [plat] : ["1688", "alibaba", "jd", "taobao", "pdd"];
  function on(k) { return plat === k ? ' style="background:rgba(255,255,255,.35)"' : ""; }
  app.innerHTML = '<div class="wrap"><section class="g-chero"><span class="g-tagw">GARSOORE CHINA · GANACSI</span><h1>Iibsi jumlad ah oo Shiinaha ka yimaada.</h1>' +
    '<p>Raadi 1688, Alibaba, JD, Taobao iyo Pinduoduo hal mar. Qiimaha waa <b>la keenay Muqdisho</b> (DAP): alaab, rar Shiinaha, isku-darid, rar bad/cir, canshuur. Garsoore ayaa la xiriira iibiyaha, lacagta haya, oo tayada hubiya.</p>' +
    '<form class="g-paste big" id="bForm"><input id="bQ" placeholder="Raadi (solar light, chairs, CCTV) ama ku dheji link…" value="' + e(u || q) + '"><button class="btn gold">Raadi</button></form>' +
    '<div class="g-src"><a href="?' + (q ? "q=" + encodeURIComponent(q) : "") + '"' + on("") + '>Dhammaan</a>' +
      Object.keys(A).map(function (k) { return '<a href="?p=' + k + (q ? "&q=" + encodeURIComponent(q) : "") + '"' + on(k) + '>' + A[k].name + ' <small>' + A[k].zh + '</small></a>'; }).join("") + '</div></section>' +
    '<div class="g-sec"><h2>Dalabyo</h2><span class="g-eta">Qiimaha halkii unug = la keenay Muqdisho · beddel tirada si aad u aragto qiimaha jumladda</span></div>' +
    '<div id="offers"></div>' +
    '<div class="g-sec"><h2>Iibiyeyaasha Shiinaha</h2><span class="g-eta">Warshado iyo ganacsato ay Garsoore hubisay</span></div>' +
    '<div class="g-vendors">' + S.VENDORS.map(function (v) {
      return '<div class="g-vendor"><b>' + e(v.name) + '</b><div class="g-eta">' + e(v.zh) + ' · ' + e(v.city) + ' · ' + v.years + ' sano · ★ ' + v.rating + '</div>' +
        '<div class="g-vtags">' + (v.verified ? '<span class="g-pill">✓ La hubiyay</span>' : '<span class="g-pill gold">Hubin socota</span>') + (v.factory ? '<span class="g-pill gold">Warshad</span>' : "") +
        v.platforms.map(function (p) { return '<span class="chip">' + (A[p] ? A[p].name : "Toos") + '</span>'; }).join("") + '</div></div>';
    }).join("") + '</div></div>';
  $("bForm").onsubmit = function (ev) { ev.preventDefault(); var v = $("bQ").value.trim(); location.href = S.identify(v) ? "?u=" + encodeURIComponent(v) : "?q=" + encodeURIComponent(v) + (plat ? "&p=" + plat : ""); };
  function priceTxt(L) { return "halkii · $" + L.total.toLocaleString() + " wadar · " + (L.mode === "sea" ? "bad" : "cir") + " ~" + L.etaDays + " maalmood"; }
  function rows(offers) {
    if (!offers.length) { $("offers").innerHTML = '<div class="g-empty">Wax lama helin.</div>'; return; }
    $("offers").innerHTML = '<div class="g-otable">' + offers.map(function (o, i) {
      var L = S.landed(o, Math.max(o.moq, 50));
      return '<div class="g-orow2"><div class="g-th">' + o.icon + '</div>' +
        '<div class="g-oinfo"><b>' + e(o.title) + '</b><div class="g-eta">' + e(o.titleZh) + ' · <a href="' + e(o.url) + '" target="_blank" rel="noopener">' + A[o.platform].name + ' ↗</a></div>' +
          '<div class="g-eta">' + (o.seller.verified ? "✓ " : "") + e(o.seller.name) + ' · ' + e(o.seller.city) + (o.seller.factory ? " · warshad" : "") + ' · MOQ ' + o.moq + ' · kayd ' + o.stock.toLocaleString() + '</div>' +
          '<div class="g-eta">Heerarka: ' + o.tiers.map(function (t) { return t.minQty + "+ → ¥" + t.cost; }).join(" · ") + '</div></div>' +
        '<div class="g-oqty"><label class="g-eta">Tirada</label><input type="number" min="' + o.moq + '" value="' + L.qty + '" data-q="' + i + '"></div>' +
        '<div class="g-oprice"><div class="g-price sm" data-pu="' + i + '">$' + L.perUnit + '</div><div class="g-eta" data-pt="' + i + '">' + priceTxt(L) + '</div></div>' +
        '<button class="btn" data-rfq="' + i + '">Codso</button></div>';
    }).join("") + '</div>';
    [].forEach.call(document.querySelectorAll("[data-q]"), function (inp) {
      inp.oninput = function () { var o = offers[+inp.dataset.q], L = S.landed(o, +inp.value || o.moq);
        document.querySelector('[data-pu="' + inp.dataset.q + '"]').textContent = "$" + L.perUnit;
        document.querySelector('[data-pt="' + inp.dataset.q + '"]').textContent = priceTxt(L); };
    });
    [].forEach.call(document.querySelectorAll("[data-rfq]"), function (b) {
      b.onclick = function () { var i = +b.dataset.rfq, qty = +document.querySelector('[data-q="' + i + '"]').value;
        var r = S.procure(offers[i], qty); if (r.error) return toast(r.error);
        toast("RFQ waa la diray · Garsoore China: $" + r.landed.perUnit + "/unug. Eeg Hawlaha shirkadda.");
        b.textContent = "✓ La diray"; b.disabled = true; };
    });
  }
  if (u) {
    var id = S.identify(u);
    if (!id) { $("offers").innerHTML = '<div class="g-err">Link-gan lama aqoonsan. Isticmaal JD, 1688, Taobao/Tmall, Pinduoduo ama Alibaba.com.</div>'; return; }
    S.fetchOffer(id.platform, id.ref, function (err, o) {
      if (o) return rows([o]);
      $("offers").innerHTML = '<div class="g-err">Ma helin macluumaadka link-gan hadda. <button class="btn" id="qBtn2">Codso qiimo rasmi ah</button></div>';
      $("qBtn2").onclick = function () { var q = RF.quotes.requestLink(id, u); toast("Codsigii waa la diray · " + q.id); $("qBtn2").disabled = true; };
    });
  } else S.search(q, { platforms: plats }, rows);
}

/* ---------------------------------------------------------------- business: price incoming quote requests (business/quotes.html) */
function quotesAdmin(app) {
  function draw() {
    var list = RF.quotes.list(), pend = list.filter(function (x) { return x.status === "pending"; });
    app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Codsiyada qiimaha</h1><span class="g-eta">' + pend.length + ' sugaya · ' + list.length + ' guud ahaan</span></div>' +
      '<p class="g-eta" style="max-width:70ch;margin-bottom:14px">Codsiyada alaabta aan katalogga ku jirin. Hubi isku-xigga, qiimee alaabta (tixraac ¥ + rar + canshuur + faa\'iido), kadibna ku qor qiimaha rasmiga ah ee doolarka.</p>' +
      (list.length ? list.map(function (x) {
        return '<div class="g-order"><div class="g-ohead"><div class="g-th">' + x.icon + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
          '<div class="g-eta">' + x.id + ' · <a href="' + e(x.url) + '" target="_blank" rel="noopener" style="color:var(--pri);font-weight:700">' + chName(x.platform) + ' ↗</a> · ' + e(x.seller || "") + ' · ' + x.kg + ' kg · ' + e(x.contact || "aan magac lahayn") + '</div>' +
          '<div class="g-eta">Qiyaasta nidaamka: ' + (x.estimate == null ? "aan la garanayn" : money(x.estimate)) + '</div></div>' +
          (x.status === "pending" ? '<div class="g-oqty"><label class="g-eta">Qiimo $</label><input type="number" min="1" value="' + (x.estimate == null ? "" : x.estimate) + '" data-t="' + x.id + '"></div>' +
            '<div class="g-oqty"><label class="g-eta">Maalmo</label><input type="number" min="1" value="20" data-d="' + x.id + '"></div>' +
            '<button class="btn" data-q="' + x.id + '">Qiimee</button><button class="btn ghost" data-x="' + x.id + '">Diid</button>' :
            '<span class="g-pill ' + (x.status === "quoted" ? "" : "gold") + '">' + (x.status === "quoted" ? "✓ " + money(x.total) + " · " + x.etaDays + "m" : "La diiday") + '</span>') + '</div></div>';
      }).join("") : '<div class="g-empty">Codsi ma jiro weli. Waxay soo muuqdaan marka macmiil ku dhejiyo link aan katalogga ku jirin.</div>') + '</div>';
    [].forEach.call(app.querySelectorAll("[data-q]"), function (b) { b.onclick = function () {
      var id = b.dataset.q, t = +app.querySelector('[data-t="' + id + '"]').value, d = +app.querySelector('[data-d="' + id + '"]').value;
      if (!(t > 0)) return toast("Ku qor qiimo sax ah."); RF.quotes.price(id, t, d); toast("Qiimaha waa la diray · " + id); draw(); }; });
    [].forEach.call(app.querySelectorAll("[data-x]"), function (b) { b.onclick = function () { RF.quotes.decline(b.dataset.x, "Alaabtan ma keeni karno."); draw(); }; });
  }
  draw();
}

RF.shopUI = function (page, h) {
  e = h.e; toast = h.toast;
  var app = document.getElementById("app");
  ({ home: home, product: product, china: china, orders: orders, bizchina: bizChina, quotes: quotesAdmin }[page] || home)(app);
};
})();
