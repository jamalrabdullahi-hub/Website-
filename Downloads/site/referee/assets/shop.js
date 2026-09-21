/* Garsoore — consumer shop UI: home (split hero + feed), product (immersive + sticky buy bar),
   Shop China (paste a JD/1688 link), one-page checkout, order tracking. Depends on catalog.js. */
(function () {
var RF = window.RF, C = RF.catalog;
var e, toast, chName = function (c) { return RF.chName(c); };
function $(id) { return document.getElementById(id); }
function qs(k) { return new URLSearchParams(location.search).get(k) || ""; }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US"); }
function eta(d) { return d ? "~" + d + " maalmood" : "Maanta"; }
/* delivery terms — the API's /config overrides these so the page can never promise something the server will not charge */
var DELIV = { fee: 5, free: 150 };
if (RF.api) RF.api.ready.then(function () { var c = RF.api.config && RF.api.config.econ; if (c) { DELIV.fee = c.deliveryFee; DELIV.free = c.freeDeliveryOver; } });

function stars(n) { n = Math.round(n); return '<span class="g-stars">' + "★★★★★".slice(0, n) + '<i>' + "★★★★★".slice(n) + '</i></span>'; }
function rating(sku) { var r = RF.orders.reviewsFor(sku); if (!r.length) return null; return { avg: r.reduce(function (s, x) { return s + x.stars; }, 0) / r.length, n: r.length, list: r }; }
function cardHTML(p) {
  var c = C.card(p), rt = rating(p.sku), sv = RF.saved.has(p.sku);
  return '<a class="g-pc" href="product.html?sku=' + c.sku + '"><div class="g-pimg"><span class="g-bd ' + (c.china ? "cn" : "lo") + '">' +
    (c.china ? "SHIINAHA" : "GUDAHA") + '</span><button class="g-heart' + (sv ? " on" : "") + '" data-save="' + c.sku + '" aria-label="Kaydi" title="Kaydi">' + (sv ? "♥" : "♡") + '</button>' +
    (c.image ? '<img class="g-pimgi" loading="lazy" src="' + e(c.image) + '" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(\'' + c.icon + '\'))">' : c.icon) + '</div><div class="g-pb"><div class="g-pn">' + e(c.title) + '</div>' +
    /* the item first, the shipping immediately under it — never one without the other */
    '<div class="g-pr">' + money(c.china && c.shipping ? c.item : c.total) + (c.moq > 1 ? '<small class="g-moq"> / xabbo</small>' : "") + '</div>' +
    (c.china && c.shipping ? '<div class="g-ship-sm">+ ' + money(c.shipping) + ' gaarsiin' + (c.moq > 1 ? ' · ugu yaraan ' + c.moq : "") + '</div>' : "") +
    (rt ? '<div class="g-eta">' + stars(rt.avg) + ' ' + rt.n + '</div>' : "") +
    '<div class="g-eta"><span class="g-v">✓</span> ' + eta(c.etaDays) + ' · ' + e(c.where) + '</div></div></a>';
}
/* one delegated handler for every ♡ on the page (cards live inside links) */
document.addEventListener("click", function (ev) {
  var b = ev.target.closest && ev.target.closest("[data-save]"); if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  var on = RF.saved.toggle(b.dataset.save);
  [].forEach.call(document.querySelectorAll('[data-save="' + b.dataset.save + '"]'), function (x) { x.classList.toggle("on", on); x.textContent = x.dataset.label ? (on ? "♥ La kaydiyay" : "♡ Kaydi") : on ? "♥" : "♡"; });
  if (toast) toast(on ? "Waa la kaydiyay — eeg Dambiisha" : "Waa laga saaray kaydka");
}, true);

/* ---------------------------------------------------------------- home */
function home(app) {
  var q = qs("q"), cat = qs("cat");
  app.innerHTML =
    '<div class="wrap">' +
    '<section class="g-split">' +
      '<div class="g-local"><span class="g-pill">✓ Iibiye kasta waa la hubiyay</span>' +
        '<h1>Wax walba,<br>hal meel.</h1>' +
        '<p>Alaab, adeegyo iyo xayeysiis gudaha Soomaaliya — lacagtaadu way xajisan tahay ilaa aad hesho.</p>' +
        '<form class="g-search" id="sForm"><input id="sQ" placeholder="Raadi, ama ku dheji link alaab (JD, 1688, Taobao…)" value="' + e(q) + '"><button class="btn">Raadi</button></form>' +
        '<div class="g-quick">' + ["Solar", "Inverter", "Qaboojiye", "Matoor", "Laptop", "Bajaj"].map(function (w) { return '<a class="chip" href="?q=' + encodeURIComponent(w) + '#feed">' + w + '</a>'; }).join("") + '</div>' +
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
    '<div class="g-filters"><label>Kala saar <select id="fSort"><option value="">Ku habboon</option><option value="lo">Qiimaha ↑</option><option value="hi">Qiimaha ↓</option><option value="fast">Ugu dhakhsaha badan</option></select></label>' +
      '<label>Ugu badnaan $ <input id="fMax" type="number" min="0" step="10" placeholder="—"></label>' +
      '<label class="g-chk"><input type="checkbox" id="fToday"> Diyaar maanta</label>' +
      '<label class="g-chk"><input type="checkbox" id="fOne"> Tus jumlada sidoo kale</label><span class="g-eta" id="fCount"></span></div>' +
    '<div class="g-grid" id="grid"></div>' +
    (RF.recent.list().length ? '<div class="g-sec"><h2>Aad dhowaan eegtay</h2></div><div class="g-grid g-row" id="recent"></div>' : "") +
    '<section class="g-bizband"><div><h3>Garsoore <span>Ganacsi</span></h3><p>Jumlad, qandaraas, adeegyo ganacsi iyo iibsi Shiinaha oo badan.</p></div>' +
      '<form class="g-req" onsubmit="location.href=\'business/index.html\';return false"><input placeholder="Waxaan u baahanahay 50 laptop…"><button class="btn gold">Codso qiimo</button></form></section>' +
    '</div>';
  var PAGE_N = 30, shown = PAGE_N, filt = "";
  function draw() {
    var list = C.search(q, { cat: cat || null, china: filt === "cn" ? true : filt === "lo" ? false : undefined });
    var sort = $("fSort").value, max = +$("fMax").value, today = $("fToday").checked, bulk = $("fOne").checked;
    /* The consumer shop shows what a consumer can buy: one of. Wholesale lots live on business.buurwen.com, where
       MOQ and tiers are the point. The checkbox lets a shopper opt INTO seeing bulk rather than having to filter it
       out — the default should be the shop they came for. */
    if (!bulk) list = list.filter(C.retailOK);
    if (max > 0 || today || sort) {
      var withP = list.map(function (p) { return { p: p, c: C.card(p) }; }).filter(function (x) { return (!(max > 0) || (x.c.total != null && x.c.total <= max)) && (!today || !x.c.china); });
      if (sort) withP.sort(function (a, b) { return sort === "lo" ? a.c.total - b.c.total : sort === "hi" ? b.c.total - a.c.total : (a.c.etaDays || 0) - (b.c.etaDays || 0); });
      list = withP.map(function (x) { return x.p; });
    }
    if (!q && !sort) list = C.mixed(list);
    $("fCount").textContent = list.length.toLocaleString() + " alaab";
    $("grid").innerHTML = list.length ? list.slice(0, shown).map(cardHTML).join("") +
      (list.length > shown ? '<div class="g-more"><button class="btn ghost" id="moreBtn">Muuji dheeraad (' + (list.length - shown) + ')</button></div>' : "") :
      (filt === "lo" ? '<div class="g-empty">Iibiyeyaasha gudaha (Muqdisho, Hargeysa…) waa la diiwaangelinayaa — alaabtooda halkan ayay ka soo muuqan doontaa. <a href="?#feed">Eeg alaabta Shiinaha →</a></div>'
        : '<div class="g-empty">Wax lama helin. <a href="china.html?q=' + encodeURIComponent(q) + '">Ka raadi Shiinaha →</a></div>');
    if ($("moreBtn")) $("moreBtn").onclick = function () { shown += PAGE_N; draw(); };
  }
  draw();
  ["fSort", "fMax", "fToday", "fOne"].forEach(function (id) { $(id).onchange = $(id).oninput = function () { shown = PAGE_N; draw(); }; });
  if ($("recent")) $("recent").innerHTML = RF.recent.list().map(C.get).filter(Boolean).slice(0, 6).map(cardHTML).join("");
  $("seg").onclick = function (ev) { var sp = ev.target.closest("span"); if (!sp) return; [].forEach.call(this.children, function (x) { x.classList.toggle("on", x === sp); }); filt = sp.dataset.v; shown = PAGE_N; draw(); };
  $("sForm").onsubmit = function (ev) { ev.preventDefault(); var v = $("sQ").value, u = RF.sources && RF.sources.urlOf(v);
    location.href = u ? "china.html?u=" + encodeURIComponent(u) : "?q=" + encodeURIComponent(v) + "#feed"; };
  $("pForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "china.html?u=" + encodeURIComponent($("pU").value); };
}

/* ---------------------------------------------------------------- product (immersive + sticky buy bar) */
var CUR = null;
/* The freight minimum falls on a shipment, not on a unit, so one of something carries a whole shipment by itself.
   That is not a number to hide — it is the best argument the business shop has. On the consumer page we say it
   plainly and hand the customer over; on the business page we show the ladder instead of arguing. */
function perUnit(p, v, n, mode) {
  var L = C.basketPrice([{ product: p, variant: v, qty: n, mode: mode }]).lines[0];
  return L && L.total != null ? L.total / n : null;
}
function bulkHTML(p, v, pr, bp, qty, moq) {
  if (!bp || bp.total == null || moq > 1) return "";
  if (window.SURFACE === "business") {
    var one = perUnit(p, v, 1, pr.mode);
    var rows = [1, 5, 10, 25, 50].map(function (n) {
      var u = perUnit(p, v, n, pr.mode);
      if (u == null) return "";
      var save = one ? Math.round(100 * (1 - u / one)) : 0;
      return '<tr' + (n === qty ? ' class="on"' : "") + '><td>' + n + ' xabbo</td><td><b>' + money(Math.round(u)) + '</b> midkii</td>' +
        '<td>' + money(Math.round(u * n)) + '</td><td>' + (save > 0 ? '<span class="ok">−' + save + '%</span>' : "—") + '</td></tr>';
    }).join("");
    return '<div class="g-bulk"><b>📉 Qiimaha jumlada</b> — rarku hal shixnad ayuu ku baxaa, ee ma aha hal xabbo. ' +
      'Sidaa darteed mid kastaa wuu raqiisanayaa marka tiradu kordho.' +
      '<table class="g-ladder"><tr><th>Tirada</th><th>Halkii</th><th>Wadarta</th><th>Kaydsi</th></tr>' + rows + '</table></div>';
  }
  /* consumer: only when the shipment minimum is genuinely what is hurting */
  if (qty !== 1 || !(bp.freight >= 10)) return "";
  var u10 = perUnit(p, v, 10, pr.mode);
  if (u10 == null || !(u10 < bp.total * 0.8)) return "";
  var href = (RF.sources ? RF.sources.crossHref("product.html?sku=" + encodeURIComponent(p.sku) + "&qty=10", "business") : "#");
  return '<div class="g-bulk">😅 <b>Rarka hal xabbo waa ' + money(bp.shipping) + '</b> — isla shixnaddaas ayaa qaadi karta 10. ' +
    'Iibso 10 oo 9-da sii saaxiibbadaa… lacag yar dul saar :)' +
    '<div class="g-bulkrow"><span>10 xabbo = <b>' + money(Math.round(u10)) + '</b> midkii</span>' +
    '<a class="btn ghost" href="' + href + '">Ku iibso jumlad →</a></div>' +
    '<small>Garsoore Ganacsi · isla alaabta, isla qiimaha, tiro badan</small></div>';
}
/* Someone can always reach a product page by link, so the gate that keeps freight-heavy goods out of the consumer
   grid has to explain itself here rather than just quietly not existing. The item is not withdrawn — it is sold at
   the quantity where its freight stops dominating, which is the business shop. */
function freightHeavyHTML(p, v) {
  if (window.SURFACE === "business" || !C.viability || p.fbg || p.oneoff) return "";
  if (Math.max(1, Math.round(+p.moq || 1)) > 1) return "";      /* the MOQ notice already covers these */
  var vb = C.viability(p, v, 1);
  if (vb.ok) return "";
  var href = (RF.sources ? RF.sources.crossHref("product.html?sku=" + encodeURIComponent(p.sku) + "&qty=10", "business") : "#");
  return '<div class="g-bulk">⚖️ <b>Alaabtan way culus tahay marka loo eego qiimaheeda</b> — ' +
    Math.round(vb.share * 100) + '% qiimaha waa rar. Hal xabbo si macquul ah uguma soo diri karno, ' +
    'mana rabno inaan kuu iibinno wax rarkiisu ka qaali yahay alaabta.' +
    '<div class="g-bulkrow"><span>Tiro badan ayay macquul ku tahay</span>' +
    '<a class="btn ghost" href="' + href + '">Ku eeg jumlad →</a></div></div>';
}
function productView(p, host, quoteId) {
  /* The business shop opens at a wholesale quantity. Freight per unit is the entire reason a trader is on this page,
     and starting at 1 would show them the worst number this product can produce. A ?qty= carried over from the
     consumer nudge wins, so the quantity somebody was pitched is the quantity they land on. */
  var BULK_START = 10;
  var vi = 0, mode = null;
  var qty = Math.max(C.moqOf(p, p.variants[0]), (+qs("qty") || 0) || (window.SURFACE === "business" ? BULK_START : 0));
  function render() {
    /* launch mode: products whose cost nobody has checked yet are sold via a staff quote, never at a placeholder price */
    var gate = RF.api && RF.api.config && RF.api.config.requireVerified && !p.oneoff && p.verified !== true;
    var v = p.variants[vi], pr = C.price(p, v, mode), china = !pr.local, src = p.sources[0], isReq = (p.oneoff && !v.quoted) || gate || !!pr.quote;
    var sl = pr.seller || C.seller(p), opts = pr.options || null;
    /* Freight is charged per shipment, so three of something is not three times the price of one. The buy bar prices
       the quantity on screen exactly as the cart will, or the two would disagree the moment somebody typed "3". */
    /* Garsoore holds no stock, so the supplier's minimum is the customer's minimum. Saying so on the page is the
       difference between an honest shop and one that takes money for an order it cannot place. */
    var moq = C.moqOf(p, v);
    if (qty < moq) qty = moq;
    var bp = (!isReq && !pr.quote && pr.total != null) ? C.basketPrice([{ product: p, variant: v, qty: qty, mode: pr.mode }]).lines[0] : null;
    var lineTotal = bp && bp.total != null ? bp.total : (pr.total != null ? pr.total * qty : null);
    /* Only offer a lane the customer could sensibly want. Air is always faster, so sea earns its place on the page
       only by being cheaper; for a 0.5 kg phone the sea minimum makes it both slower AND dearer, and showing it would
       be a worse page, not a more complete one. */
    var lanes = [];
    if (opts && opts.air) lanes.push(["air", opts.air]);
    if (opts && opts.sea && (!opts.air || opts.sea.total < opts.air.total)) lanes.push(["sea", opts.sea]);
    var LANE_SO = { air: ["✈ Cirka", "degdeg"], sea: ["🚢 Badda", "raqiis"] };
    host.innerHTML =
      '<div class="g-phero"><div class="g-pic">' + (p.image ? '<img src="' + e(p.image) + '" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(\'' + p.icon + '\'))">' : p.icon) + '</div><div>' +
        /* Who the customer is buying from. For procurement that is Garsoore itself — the Chinese supplier behind it is
           an internal relationship and never appears on a consumer page. For FBG the merchant owns the goods, so the
           merchant is named and Garsoore is credited only with the fulfilment. */
        '<span class="g-pill ' + (sl.official ? "gold" : "") + '">' + (sl.official ? "Garsoore Official ✓" : e(sl.name) + " · Fulfilled by Garsoore") +
          (v.quoted ? " · qiimo rasmi" : p.oneoff ? " · dalab hal mar" : "") + '</span>' +
        '<div class="g-sku">' + p.sku + (p.modelNo ? " · " + e(p.modelNo) : "") + '</div>' +
        '<h1>' + e((p.brand ? p.brand + " " : "") + p.model) + '</h1><div id="soc" class="g-soc"></div><p class="g-blurb">' + e(p.blurb) + '</p>' +
        (p.pageUrl && p.oneoff ? '<div class="g-eta">Il: <a href="' + e(p.pageUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link);font-weight:700">' + e(RF.sources.hostOf(p.pageUrl)) + ' ↗</a></div>' : "") +
        (p.variants.length > 1 ? '<div class="g-lbl">Nooca</div><div>' + p.variants.map(function (x, i) {
          return '<button class="g-o' + (i === vi ? " on" : "") + '" data-i="' + i + '">' + (x.hex ? '<i style="background:' + x.hex + '"></i>' : "") + e(x.label) + (x.color && x.color !== "—" ? " · " + e(x.color) : "") + '</button>';
        }).join("") + '</div>' : "") +
      '</div></div>' +
      '<div class="g-specs">' + p.specs.map(function (s) { return '<div><span>' + e(s[0]) + '</span><b>' + e(s[1]) + '</b></div>'; }).join("") + '</div>' +
      '<div class="g-trust"><div><b>Hal qiimo</b>Kharash qarsoon ma jiro</div><div><b>Lacag la xajiyo</b>Garsoore ayaa haya ilaa aad hesho</div><div><b>Celin 7 maalmood</b>Haddii aysan ahayn sidii la sheegay</div></div>' +
      (lanes.length > 1 && !isReq ? '<div class="g-ship"><div class="g-lbl">Sidee ayaad u rabtaa?</div><div class="g-shopts">' +
        lanes.map(function (L) {
          var k = L[0], b = L[1];
          return '<button class="g-shopt' + (k === pr.mode ? " on" : "") + '" data-mode="' + k + '"><b>' + LANE_SO[k][0] + '</b>' +
            '<span>' + b.transitMin + '–' + b.transitMax + ' maalmood</span><i>' + money(b.total) + '</i></button>';
        }).join("") + '</div></div>' : "") +
      (moq > 1 && window.SURFACE !== "business" ?
        '<div class="g-bulk">🏢 Tani waa alaab <b>jumlad</b> ah — ugu yaraan ' + moq + ' xabbo. ' +
        'Waxay ku habboon tahay <a href="' + (RF.sources ? RF.sources.crossLink(location.href, "business") : "#") + '" style="color:var(--link);font-weight:700">Garsoore Ganacsi</a>, ' +
        'halkaas oo qiimaha heerarka iyo MOQ-gu ay yihiin waxa aad u timid.</div>' : "") +
      (moq > 1 ? '<div class="g-bulk">📦 Alaabtan iibiyuhu wuxuu ka iibiyaa <b>ugu yaraan ' + moq + ' xabbo</b> — ' +
        'Garsoore kayd ma hayo, wuxuu iibsadaa markaad adigu iibsato, sidaa darteed ugu yaraantiisu waa taada. ' +
        'Hal xabbo ma iibsan kartid, laakiin waad <a href="china.html" style="color:var(--link);font-weight:700">codsan kartaa qiimo</a>.</div>' : "") +
      /* say why one costs what it does, once, exactly where the single-shipment minimum bites */
      freightHeavyHTML(p, v) +
      bulkHTML(p, v, pr, bp, qty, moq) +
      (bp && bp.shipping ? '<div class="g-incl">✓ <b>' + money(bp.item) + ' alaabta + ' + money(bp.shipping) + ' gaarsiin = ' + money(lineTotal) + '</b> — ' +
        'gaarsiintu waxay ku jirtaa rarka Shiinaha → Muqdisho, canshuurta iyo gudbinta. Wax kale lagaama qaadayo. ' +
        'Ka qaado Km4 bilaash, ama gaarsiin guriga $' + DELIV.fee + ' (bilaash haddii ay ka badato $' + DELIV.free + ').</div>' : "") +
      (pr.total != null && !isReq && !(bp && bp.shipping) ? '<div class="g-incl">✓ <b>' + money(pr.total) + ' waa qiimaha oo dhan</b> — ' + (china ? "alaabta, rarka Shiinaha → Muqdisho, canshuurta iyo adeegga" : "alaabta iyo adeegga") + ' way ku jiraan. Ka qaado Km4 bilaash, ama gaarsiin guriga $' + DELIV.fee + ' (bilaash haddii ay ka badato $' + DELIV.free + ').</div>' : "") +
      '<div class="g-buybar"><div class="g-bi">' + p.icon + '</div><div class="g-bt"><b>' + e(p.model) + (v.label && v.label !== "Standard" ? " · " + e(v.label) : "") + '</b>' +
        '<div class="g-eta">' + (china ? "🚚 " + (pr.transitMin ? pr.transitMin + "–" + pr.transitMax + " maalmood" : eta(pr.etaDays)) + " · Pickup Muqdisho" : "Diyaar maanta · Muqdisho") + ' · 🔒 Lacag la xajiyo</div></div>' +
        '<div class="g-price"' + (pr.total == null ? ' style="font-size:19px"' : "") + '>' +
          (pr.total == null ? "Qiimo la sugayo" : isReq ? "≈ " + money(pr.total) : money(bp && bp.shipping ? bp.item : lineTotal)) +
          (bp && bp.shipping ? '<small class="g-ship-in">+ ' + money(bp.shipping) + ' gaarsiin · wadar ' + money(lineTotal) + '</small>' : "") + '</div>' +
        (isReq ? "" : '<div class="g-qty"><button data-dq="-1" aria-label="ka dhim"' + (qty <= moq ? " disabled" : "") + '>−</button><span>' + qty + '</span><button data-dq="1" aria-label="ku dar">+</button></div>' +
          '<button class="btn ghost g-add" id="addBtn">🛒 Dambiisha</button>') +
        '<button class="btn g-buy" id="buyBtn">' + (isReq ? "Codso qiimo rasmi ah" : "Hadda iibso") + '</button></div>' +
      (p.oneoff ? "" : '<div class="g-pact"><button class="chip" data-save="' + p.sku + '" data-label="1">' + (RF.saved.has(p.sku) ? "♥ La kaydiyay" : "♡ Kaydi") + '</button>' +
        '<button class="chip" id="shareBtn">↗ La wadaag</button></div>') +
      (isReq ? '<div class="g-found" style="margin-top:12px">' + (pr.reason === "no-shippable-rate" ? 'Alaabtan weli si hubaal ah looma qiimayn karo rarka — ma rabno inaan ku siinno qiime beddelaya. ' : pr.total == null ? 'Alaabtan ma ahan kuwa katalogga, qiimana lama helin. ' : 'Alaabtan ma ahan kuwa katalogga. Qiimahan waa qiyaas — ') +
        'koox Garsoore ah ayaa hubinaysa oo kuu soo diraysa qiimo rasmi ah (saacado gudahood), kadibna waad iibsan kartaa.</div>' : "");
    [].forEach.call(host.querySelectorAll(".g-o"), function (b) { b.onclick = function () { vi = +b.dataset.i; render(); }; });
    [].forEach.call(host.querySelectorAll("[data-mode]"), function (b) { b.onclick = function () { mode = b.dataset.mode; render(); }; });
    [].forEach.call(host.querySelectorAll("[data-dq]"), function (b) { b.onclick = function () { qty = Math.max(moq, Math.min(p.stock || 999, qty + +b.dataset.dq * (moq > 1 ? moq : 1))); render(); }; });
    if ($("addBtn")) $("addBtn").onclick = function () { RF.cart.add(p.sku, vi, Math.max(qty, moq), quoteId, quoteId ? p : null, pr.mode || null); RF.api.ev("cart", p.sku); toast("✓ " + qty + " × waa lagu daray dambiisha"); };
    if ($("shareBtn")) $("shareBtn").onclick = function () {
      var url = location.href, t = (p.brand ? p.brand + " " : "") + p.model + " — " + money(pr.total) + " · Garsoore";
      if (navigator.share) navigator.share({ title: t, url: url }).catch(function () {});
      else window.open("https://wa.me/?text=" + encodeURIComponent(t + " " + url), "_blank", "noopener");
    };
    $("buyBtn").onclick = function () {
      if (!isReq) return checkout([{ product: p, variant: v, price: pr, line: { qty: qty, quote: quoteId || null, fbg: p.fbg ? p.sku : null, mode: pr.mode || null } }]);
      RF.backend.needUser("Gal si aan qiimaha rasmiga ah kuugu soo dirno.").then(function () { return RF.backend.requestQuote(p); }).then(function (q) {
        RF.api.ev("quote", p.sku);
        $("buyBtn").outerHTML = '<a class="btn g-buy" href="orders.html?quote=' + q.id + '">✓ La diray — eeg Dalabyadayda</a>';
        toast("Codsigii qiimaha waa la diray · " + q.id);
      }).catch(function (x) { if (x.message !== "cancelled") toast(x.message); });
    };
  }
  render();
}
function product(app) {
  var qid = qs("quote");
  if (qid) {
    app.innerHTML = '<div class="wrap g-empty">⏳</div>';
    return RF.backend.needUser("Gal si aad u aragto qiimahaaga rasmiga ah.").then(function () { return RF.backend.quote(qid); }).then(function (qq) {
      if (!qq || qq.status !== "quoted") { app.innerHTML = '<div class="wrap g-empty">Qiimahan weli lama bixin ama wuu dhacay. <a href="orders.html">Dalabyadayda →</a></div>'; return; }
      productPage(app, RF.quotes.asProduct(qq), qq.id);
    }).catch(function () { app.innerHTML = '<div class="wrap g-empty">Gal si aad u aragto qiimahan. <a href="orders.html">Dalabyadayda →</a></div>'; });
  }
  var p = C.get(qs("sku"));
  if (!p) { app.innerHTML = '<div class="wrap g-empty">Alaabtan lama helin. <a href="index.html">Dib u noqo →</a></div>'; return; }
  productPage(app, p, null);
}
function reviewsHTML(list) {
  if (!list.length) return '<div class="g-empty sm">Faallo weli ma jirto. Faallooyinka Garsoore waxaa qora oo keliya dadka alaabta ka qaatay — lama iibsan karo, lama been abuuri karo.</div>';
  var avg = list.reduce(function (s, x) { return s + x.stars; }, 0) / list.length;
  return '<div class="g-revsum">' + stars(avg) + ' <b>' + avg.toFixed(1) + '</b> · ' + list.length + ' faallo la hubiyay</div>' +
    list.map(function (r) { return '<div class="g-rev">' + stars(r.stars) + ' <b>' + e(r.by) + '</b> <span class="g-eta">✓ iibsade la hubiyay · ' + new Date(r.at).toLocaleDateString("so-SO") + '</span>' + (r.text ? '<p>' + e(r.text) + '</p>' : "") + '</div>'; }).join("");
}
function productPage(app, p, quoteId) {
  app.innerHTML = '<div class="wrap"><div class="g-crumb"><a href="index.html">Suuqa</a> / ' + (C.CATS.filter(function (c) { return c.id === p.cat; })[0] || { so: "Shiinaha" }).so + '</div><div id="pv"></div>' +
    '<div class="g-sec"><h2>Faallooyinka iibsadayaasha</h2><span class="g-eta">Kaliya dadka alaabta dhab ahaan qaatay</span></div><div id="revs"></div>' +
    '<div class="g-sec"><h2>Waxyaabo la mid ah</h2></div><div class="g-grid" id="rel"></div></div>';
  productView(p, $("pv"), quoteId);
  if (RF.api) RF.api.ready.then(function () { if (RF.api.config && RF.api.config.requireVerified && p.verified !== true && !p.oneoff) productView(p, $("pv"), quoteId); });
  if (!p.oneoff) { RF.recent.push(p.sku); RF.api.ev("view", p.sku); }
  $("revs").innerHTML = reviewsHTML([]);
  if (!p.oneoff) RF.backend.social(p.sku).then(function (s) {
    $("revs").innerHTML = reviewsHTML(s.reviews || []);
    /* honest social proof: real, recent, and only once the number is meaningful (server returns null below 3) */
    if (s.bought30 && $("soc")) $("soc").innerHTML = '🔥 ' + s.bought30 + ' qof ayaa iibsaday 30kii maalmood ee la soo dhaafay';
  }).catch(function () {});
  $("rel").innerHTML = C.products.filter(function (x) { return x.sku !== p.sku && x.cat === p.cat; }).slice(0, 5).map(cardHTML).join("");
}

/* ---------------------------------------------------------------- one-page checkout */
/* items: [{ product, variant, price, line:{qty, quote?} }]  fromCart → empty the cart afterwards
   Psychology (see docs/DOCTRINE.md): every cost is visible before the pay button; the escrow promise sits at the
   moment of payment; the account is created inside this step (your phone number is your account) — no detour. */
var PAYS = { "EVC Plus": "61/77", "ZAAD": "63", "Sahal": "90", "Premier Wallet": "61/62/68" };
function checkout(items, fromCart) {
  var st = { delivery: false, pay: "EVC Plus", payPhone: "", promo: "", disc: 0, cap: Infinity, discCode: "", address: "", useCredit: true, name: "", pin: "" };
  try { var mem = JSON.parse(localStorage.getItem("garsoore.checkout")) || {}; st.pay = mem.pay || st.pay; st.payPhone = mem.phone || ""; st.address = mem.address || ""; } catch (x) {}
  /* a signed-in person has these saved on their account, so a new device is still two taps */
  var prof = RF.api.user && RF.api.user.profile;
  if (prof) { st.pay = prof.payMethod || st.pay; st.payPhone = (RF.phoneFmt && prof.payPhone ? RF.phoneFmt(prof.payPhone) : prof.payPhone) || st.payPhone; st.address = prof.address || st.address; }
  var box = $("modalBox"), A = RF.api;
  RF.api.ev("checkout");
  function nm(p) { return (p.brand ? p.brand + " " : "") + p.model; }
  function vl(v) { return [v.label, v.color].filter(function (x) { return x && x !== "—" && x !== "Standard"; }).join(" · "); }
  function sums() {
    items.forEach(function (it) { if (it.line && !it.line.mode && it.price && it.price.mode) it.line.mode = it.price.mode; });
    var sub = items.reduce(function (s, it) { return s + it.price.total * it.line.qty; }, 0), disc = Math.min(Math.round(sub * st.disc), st.cap);
    var fee = st.delivery && sub < DELIV.free ? DELIV.fee : 0, credit = A.remote && A.user && st.useCredit ? Math.min(A.user.credit || 0, sub - disc + fee) : 0;
    return { sub: sub, disc: disc, fee: fee, credit: credit, total: sub - disc + fee - credit };
  }
  function render() {
    var S = sums(), slow = Math.max.apply(null, items.map(function (it) { return it.price.local ? 0 : it.price.etaDays; })), needAcct = A.remote && !A.user;
    box.innerHTML = '<div class="g-co"><h2>Lacag bixinta</h2><div class="g-sku">' + items.length + ' shay · hal tallaabo</div>' +
      items.map(function (it) { var p = it.product, v = it.variant;
        return '<div class="g-line"><div class="g-th">' + p.icon + '</div><div style="flex:1"><b>' + e(nm(p)) + '</b><div class="g-eta">' +
          e(vl(v) || "Standard") + ' · ×' + it.line.qty + ' · ' + (it.price.local ? "Diyaar maanta" : "Diyaar " + eta(it.price.etaDays)) + '</div></div><b>' + money(it.price.total * it.line.qty) + '</b></div>'; }).join("") +
      '<div class="g-lbl">Halkee ka qaadanaysaa?</div>' +
      '<div class="g-rad' + (!st.delivery ? " on" : "") + '" data-d="0"><i></i>Xarunta Garsoore · Km4, Muqdisho<span>Bilaash</span></div>' +
      '<div class="g-rad' + (st.delivery ? " on" : "") + '" data-d="1"><i></i>Gaarsiin guriga (Muqdisho)<span>' + (S.sub >= DELIV.free ? "Bilaash" : "+$" + DELIV.fee) + '</span></div>' +
      (st.delivery ? '<input class="g-in" id="coAddr" placeholder="Degmada iyo calaamad (tusaale: Hodan, agagaarka Tarabuunka)" value="' + e(st.address) + '">' +
        (S.sub < DELIV.free ? '<div class="g-goal"><div><i style="width:' + Math.round(100 * S.sub / DELIV.free) + '%"></i></div>Ku dar ' + money(DELIV.free - S.sub) + ' alaab ah → gaarsiintu waa bilaash</div>' : "") : "") +
      '<div class="g-lbl">Ku bixi</div><div class="g-pay">' + Object.keys(PAYS).map(function (m) { return '<div class="' + (st.pay === m ? "on" : "") + '">' + m + '</div>'; }).join("") + '</div>' +
      '<input class="g-in" id="coPhone" inputmode="tel" autocomplete="tel" placeholder="Lambarka ' + st.pay + ' (' + PAYS[st.pay] + '…)" value="' + e(st.payPhone) + '">' +
      (needAcct ? '<div class="g-acct"><b>Lambarkan ayaa noqonaya akoonkaaga</b> — si aad dalabkaaga ula socoto. <a href="#" id="coLogin">Akoon ma leedahay? Gal</a>' +
        '<input class="g-in" id="coName" autocomplete="name" placeholder="Magacaaga" value="' + e(st.name) + '">' +
        '<input class="g-in" id="coPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="Samee PIN (4–6 lambar)" value="' + e(st.pin) + '"></div>' : "") +
      '<div class="g-promo"><input class="g-in" id="coPromo" placeholder="Koodh dhimis (ikhtiyaari)" value="' + e(st.promo) + '"><button class="btn ghost" id="coApply">Isticmaal</button></div>' +
      (A.remote && A.user && A.user.credit ? '<label class="g-chk" style="margin-top:10px;display:flex;gap:8px"><input type="checkbox" id="coCred"' + (st.useCredit ? " checked" : "") + '> Isticmaal dheeraadkaaga ' + money(A.user.credit) + '</label>' : "") +
      '<div class="g-sum"><div><span>Alaabta</span><b>' + money(S.sub) + '</b></div>' + (S.disc ? '<div class="ok"><span>Dhimis (' + Math.round(st.disc * 100) + '%)</span><b>−' + money(S.disc) + '</b></div>' : "") +
        '<div><span>Gaarsiin</span><b>' + (S.fee ? money(S.fee) : "Bilaash") + '</b></div>' + (S.credit ? '<div class="ok"><span>Dheeraad</span><b>−' + money(S.credit) + '</b></div>' : "") + '</div>' +
      '<div class="g-tot"><span>Wadarta</span><b>' + money(S.total) + '</b></div>' +
      '<div class="g-eta" style="margin:-4px 0 10px">' + (slow ? "Wax walba waxay diyaar noqonayaan ~" + slow + " maalmood" : "Wax walba waa diyaar maanta") + ' · kharash kale ma jiro</div>' +
      '<ol class="g-steps"><li><b>Adiga</b> ayaa bixiya</li><li><b>Garsoore</b> ayaa haya lacagta</li><li>Alaabta <b>ayaad hubisaa</b> oo qaadataa</li><li>Kadib <b>iibiyaha</b> ayaa la siiyaa</li></ol>' +
      '<div class="g-err sm" id="coErr" hidden></div>' +
      '<button class="btn g-buy full" id="confirm">' + (A.remote ? "Dalbo · " + money(S.total) : "Bixi " + money(S.total)) + '</button>' +
      '<div class="g-escrow">🔒 Haddii alaabtu aysan iman ama aysan ahayn sidii la sheegay, <b>lacagtaada waa laguu celinayaa</b>. Waad joojin kartaa ka hor inta aan la iibsan.</div></div>';
    function keep() { st.payPhone = $("coPhone").value; st.promo = $("coPromo").value; if ($("coAddr")) st.address = $("coAddr").value; if ($("coName")) { st.name = $("coName").value; st.pin = $("coPin").value; } if ($("coCred")) st.useCredit = $("coCred").checked; }
    [].forEach.call(box.querySelectorAll(".g-rad"), function (r) { r.onclick = function () { keep(); st.delivery = r.dataset.d === "1"; render(); }; });
    [].forEach.call(box.querySelectorAll(".g-pay div"), function (d) { d.onclick = function () { keep(); st.pay = d.textContent; render(); }; });
    if ($("coCred")) $("coCred").onchange = function () { keep(); render(); };
    if ($("coLogin")) $("coLogin").onclick = function (ev) { ev.preventDefault(); keep(); RF.authUI.open().then(function () { checkout(items, fromCart); }).catch(function () { checkout(items, fromCart); }); };
    $("coApply").onclick = function () { keep();
      if (!st.promo.trim()) return;
      RF.backend.needUser("Gal si aad u isticmaasho koodhka.").then(function () { return RF.backend.promo(st.promo); })
        .then(function (r) { st.disc = r.pct; st.cap = r.cap || Infinity; st.discCode = st.promo; render(); })
        .catch(function (x) { st.disc = 0; st.discCode = ""; if (x.message === "cancelled") return checkout(items, fromCart); render(); err(x.message); }); };
    function err(m) { $("coErr").textContent = m; $("coErr").hidden = false; }
    $("confirm").onclick = function () {
      keep();
      if (!RF.phoneOk(st.payPhone)) return err("Ku qor lambar " + st.pay + " sax ah (tusaale 61 5xx xxxx).");
      if (st.delivery && st.address.trim().length < 4) return err("Ku qor halka alaabta la keenayo.");
      if (needAcct && st.name.trim().length < 2) return err("Ku qor magacaaga.");
      if (needAcct && !/^\d{4,6}$/.test(st.pin)) return err("Samee PIN 4–6 lambar ah.");
      try { localStorage.setItem("garsoore.checkout", JSON.stringify({ pay: st.pay, phone: st.payPhone, address: st.address })); } catch (x) {}
      var btn = $("confirm"); btn.disabled = true; btn.textContent = "…";
      (needAcct ? A.register(st.name, st.payPhone, st.pin).catch(function (x) { if (x.status === 409) return A.login(st.payPhone, st.pin); throw x; }) : Promise.resolve())
        .then(function () { return RF.backend.place(items, st); })
        .then(function (r) {
          if (fromCart) RF.cart.clear();
          if (r.local) { location.href = "orders.html?new=" + r.ids.join(","); return; }
          payStep(r);
        })
        .catch(function (x) { btn.disabled = false; btn.textContent = "Isku day mar kale"; err(x.message); });
    };
  }
  render();
  $("modal").classList.add("on");
}
/* step 2: pay the Garsoore merchant number, type the reference from the confirmation SMS. Staff match it, then escrow is held. */
function payStep(r) {
  var box = $("modalBox");
  box.innerHTML = '<div class="g-co"><h2>Hal tallaabo oo kale</h2><div class="g-sku">Dalabka ' + e(r.reference) + ' waa la kaydiyay · waxaa loo hayaa ' + r.expiresHours + ' saac</div>' +
    '<div class="g-paybox"><div class="g-lbl" style="margin:0">U dir ' + e(r.pay) + '</div><b class="g-amt">' + money(r.amount) + '</b>' +
      (r.merchant ? '<div>Lambarka ganacsiga Garsoore: <b class="g-mno">' + e(r.merchant) + '</b></div>' : '<div class="g-err sm">⚠ (Dev) Lambarka ganacsiga ' + e(r.pay) + ' weli lama dejin — ha dirin lacag dhab ah. Ku qor lambar tijaabo ah si aad u tijaabiso.</div>') +
      '<div class="g-eta">Tixraac: ' + e(r.reference) + '</div></div>' +
    '<ol class="g-steps v"><li>Fur ' + e(r.pay) + ' taleefankaaga oo u dir <b>' + money(r.amount) + '</b>' + (r.merchant ? ' lambarka <b>' + e(r.merchant) + '</b>' : "") + '.</li><li>Fariinta xaqiijinta ka koobbi <b>lambarka macaamilka</b> (transaction ID).</li><li>Halkan ku dheji — waan hubinaynaa, badanaa 30 daqiiqo gudahood.</li></ol>' +
    '<input class="g-in" id="payTxn" placeholder="Lambarka macaamilka, tusaale 5238XXXX">' +
    '<div class="g-err sm" id="payErr" hidden></div>' +
    '<button class="btn g-buy full" id="payGo">Waan bixiyay</button>' +
    '<a class="btn ghost full" style="margin-top:8px;text-align:center" href="orders.html?new=' + r.ids.join(",") + '">Mar dambe ayaan bixin doonaa</a>' +
    '<div class="g-escrow">🔒 Lacagtu waxay taagan tahay Garsoore — iibiyaha lama siinayo ilaa aad alaabta qaadato.</div></div>';
  $("payGo").onclick = function () {
    var t = $("payTxn").value.trim();
    if (t.length < 4) { $("payErr").textContent = "Ku qor lambarka macaamilka ee fariinta."; $("payErr").hidden = false; return; }
    $("payGo").disabled = true;
    RF.backend.paid(r.ids, t).then(function () { location.href = "orders.html?new=" + r.ids.join(","); })
      .catch(function (x) { $("payGo").disabled = false; $("payErr").textContent = x.message; $("payErr").hidden = false; });
  };
  $("modal").classList.add("on");
}

/* ---------------------------------------------------------------- cart + saved */
function cart(app) {
  function draw() {
    var items = RF.cart.resolve(), saved = RF.saved.list().map(C.get).filter(Boolean);
    /* One basket is one shipment. Freight is worked out across everything travelling the same way, so the per-item
       price falls as the basket grows — and the customer watches it fall. */
    var bk = C.basketPrice(items.map(function (it) { return { product: it.product, variant: it.variant, qty: it.line.qty, mode: it.line.mode }; }));
    items.forEach(function (it, i) { if (bk.lines[i]) it.price = bk.lines[i]; });
    var sub = bk.total;
    var goodsSum = items.reduce(function (n, it) { return n + (it.price.item != null ? it.price.item : it.price.total || 0); }, 0);
    var shipSum = items.reduce(function (n, it) { return n + (it.price.shipping || 0); }, 0);
    /* what the same basket would cost if every line paid freight on its own — the saving consolidation creates */
    var alone = items.reduce(function (n, it) {
      var one = C.basketPrice([{ product: it.product, variant: it.variant, qty: it.line.qty, mode: it.line.mode }]);
      return n + (one.lines[0] && one.lines[0].total != null ? one.lines[0].total : 0);
    }, 0);
    var saving = Math.max(0, alone - sub);
    app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Dambiisha</h1><span class="g-eta">' + RF.cart.count() + ' shay</span></div>' +
      (items.length ? '<div class="g-cart"><div>' + items.map(function (it) { var p = it.product, v = it.variant;
          return '<div class="g-order g-cl"><div class="g-ohead"><a class="g-th" href="product.html?' + (it.line.quote ? "quote=" + it.line.quote : "sku=" + p.sku) + '">' + p.icon + '</a><div style="flex:1"><b>' + e((p.brand ? p.brand + " " : "") + p.model) + '</b>' +
            '<div class="g-eta">' + e([v.label, v.color].filter(function (x) { return x && x !== "—"; }).join(" · ")) + ' · ' + (it.price.local ? "Diyaar maanta" : "Diyaar " + eta(it.price.etaDays)) + ' · ' + money(it.price.unit) + ' midkii' +
              (it.price.freight ? ' · rar ' + money(it.price.freight) : "") + '</div></div>' +
            '<div class="g-qty"><button data-q="' + it.i + '" data-d="-1">−</button><span>' + it.line.qty + '</span><button data-q="' + it.i + '" data-d="1">+</button></div>' +
            '<div class="g-price sm">' + money(it.price.total) + '</div><button class="g-x" data-rm="' + it.i + '" aria-label="Ka saar">×</button></div>' +
            /* the lane the customer picked, still changeable here — and the price moves in front of them */
            (it.price.mode ? '<div class="g-clane">' + ["air", "sea"].map(function (m) {
              /* each option is priced with the REST of the basket held still, so the number on the chip is the number
                 the customer will actually pay if they tap it */
              var alt = C.basketPrice(items.map(function (o, k) { return { product: o.product, variant: o.variant, qty: o.line.qty, mode: k === it.i ? m : o.line.mode }; }));
              var L = alt.lines[it.i]; if (!L || L.total == null || !L.mode) return "";
              return '<button class="chip' + (m === it.price.mode ? " on" : "") + '" data-lane="' + it.i + '" data-lm="' + m + '">' +
                (m === "air" ? "✈ Cirka" : "🚢 Badda") + ' · ' + L.transitMin + '–' + L.transitMax + 'm · ' + money(L.total) + '</button>';
            }).join("") + '</div>' : "") + '</div>'; }).join("") + '</div>' +
          '<aside class="g-order g-cside"><div class="g-sum"><div><span>Alaabta</span><b>' + money(goodsSum) + '</b></div>' +
            (shipSum ? '<div><span>Gaarsiin (rar + canshuur)</span><b>' + money(shipSum) + '</b></div>' : "") +
            (saving > 0 ? '<div class="save"><span>✓ Isku-darid</span><b>−' + money(saving) + '</b></div>' : "") +
            '<div><span>Ka qaadasho Km4</span><b>Bilaash</b></div><div><span>Gaarsiin guriga</span><b>' + (sub >= DELIV.free ? "Bilaash" : "$" + DELIV.fee) + '</b></div></div>' +
            (saving > 0 ? '<div class="g-goal ok">✓ Waxaad badbaadisay ' + money(saving) + ' — alaabtaadu hal shixnad ayay wada saaran tahay</div>'
              : items.length === 1 && !items[0].price.local ? '<div class="g-goal">Ku dar shay kale — rarku hal mar ayuu bixinayaa, sidaa darteed midkiiba wuu raqiisanayaa</div>' : "") +
            (sub < DELIV.free ? '<div class="g-goal"><div><i style="width:' + Math.round(100 * sub / DELIV.free) + '%"></i></div>Ku dar ' + money(DELIV.free - sub) + ' → gaarsiin guriga bilaash</div>' : '<div class="g-goal ok">✓ Gaarsiin guriga waa bilaash</div>') +
            '<div class="g-tot"><span>Wadarta</span><b>' + money(sub) + '</b></div><button class="btn g-buy full" id="coBtn">U gudub lacag bixinta</button>' +
            '<div class="g-escrow">🔒 Lacagta waa la xajiyaa ilaa aad hesho.</div></aside></div>'
        : '<div class="g-empty">Dambiishu waa madhan tahay. <a href="index.html">Bilow iibsiga →</a></div>') +
      '<div class="g-sec"><h2>Waxaad kaydsatay</h2><span class="g-eta">' + saved.length + '</span></div>' +
      (saved.length ? '<div class="g-grid">' + saved.map(cardHTML).join("") + '</div>' : '<div class="g-empty sm">Taabo ♡ alaab kasta si aad u kaydsato.</div>') + '</div>';
    [].forEach.call(app.querySelectorAll("[data-q]"), function (b) { b.onclick = function () {
    var i = +b.dataset.q, l = RF.cart.lines()[i], it = RF.cart.resolve().filter(function (x) { return x.i === i; })[0];
    var m = it ? C.moqOf(it.product, it.variant) : 1, step = m > 1 ? m : 1;
    var next = l.qty + (+b.dataset.d) * step;
    RF.cart.setQty(i, next < m ? 0 : next);          /* dropping below the minimum removes the line rather than pretending */
    draw(); }; });
    [].forEach.call(app.querySelectorAll("[data-rm]"), function (b) { b.onclick = function () { RF.cart.setQty(+b.dataset.rm, 0); draw(); }; });
    [].forEach.call(app.querySelectorAll("[data-lane]"), function (b) { b.onclick = function () { RF.cart.setMode(+b.dataset.lane, b.dataset.lm); draw(); }; });
    if ($("coBtn")) $("coBtn").onclick = function () { checkout(RF.cart.resolve(), true); };
  }
  draw();
  document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("[data-save]")) setTimeout(draw, 0); }, true);
}

/* ---------------------------------------------------------------- Shop China */
function china(app) {
  var u = qs("u"), q = qs("q"), S = RF.sources, A = S.ADAPTERS;
  /* The consumer shop buys retail: JD, Tmall/Taobao, Pinduoduo. One piece, one price, no minimum order.
     Wholesale links belong to business.buurwen.com and are handed over there rather than refused. */
  var RETAIL = S.platformsFor("consumer");
  var chips = RETAIL.map(function (k) { return '<span>' + A[k].name + ' <small>' + A[k].zh + '</small></span>'; }).join("");
  app.innerHTML = '<div class="wrap"><section class="g-chero"><span class="g-tagw">GARSOORE CHINA</span><h1>Ka hel Shiinaha. Ku iibso Garsoore.</h1>' +
    '<p>Kuma baahnid akoon Shiinees, luqad, lacag bixin Shiinees ama rar. Ku dheji link — waxaad helaysaa hal qiimo iyo hal badhan.</p>' +
    '<form class="g-paste big" id="pForm"><input id="pU" placeholder="Ku dheji link — JD, Taobao, Tmall, Pinduoduo, ama bog kale…" value="' + e(u) + '"><button class="btn gold">Qiimee</button></form>' +
    '<div class="g-src">' + chips + '</div>' +
    '<div class="g-src"><a href="?u=https://item.jd.com/100071383535.html">Tijaabi: laptop JD</a>' +
      '<a href="?u=https://item.taobao.com/item.htm?id=693311240517">Tijaabi: Taobao</a><a href="?u=https://mobile.yangkeduo.com/goods.html?goods_id=512233441">Tijaabi: Pinduoduo</a></div>' +
    '<div class="g-eta" style="margin-top:8px">Jumlad ma raadinaysaa (1688, Alibaba, warshad)? <a href="' + e(S.crossLink("", "business")) + '" style="color:var(--link);font-weight:700">Garsoore Ganacsi →</a></div>' +
    '<ol class="g-how"><li><b>Ku dheji</b>link ama raadi</li><li><b>Hel qiimo</b>hal wadar, kharash qarsoon ma jiro</li><li><b>Iibso</b>EVC · ZAAD · Sahal</li><li><b>Ka qaado</b>Muqdisho ~20 maalmood</li></ol></section>' +
    '<div id="res"></div>' +
    '<div class="g-sec"><h2>Ka raadi dhammaan suuqyada Shiinaha</h2><form class="g-search sm" id="sForm"><input id="sQ" placeholder="kettle, charger, CCTV… ama link" value="' + e(q) + '"><button class="btn">Raadi</button></form></div>' +
    '<div class="g-grid" id="grid"></div></div>';
  $("pForm").onsubmit = function (ev) { ev.preventDefault(); location.href = "?u=" + encodeURIComponent($("pU").value); };
  $("sForm").onsubmit = function (ev) { ev.preventDefault(); var v = $("sQ").value, lu = S.urlOf(v);
    location.href = lu ? "?u=" + encodeURIComponent(lu) : "?q=" + encodeURIComponent(v) + "#grid"; };
  var cat = C.search(q, { china: true });
  var total = cat.length; cat = (q ? cat : C.mixed(cat)).slice(0, 40);
  S.search(total >= 8 ? "\u0000" : q, { platforms: RETAIL }, function (offers) {
    // one card per item: cheapest platform wins, so the consumer never compares marketplaces
    var best = {};
    offers.forEach(function (o) { var k = o.title; if (!best[k] || o.tiers[0].cost < best[k].tiers[0].cost) best[k] = o; });
    var extra = Object.keys(best).map(function (k) { var o = best[k], p = S.toProduct(o).product; C._tmp = C._tmp || {}; C._tmp[p.sku] = p; return p; });
    var list = cat.concat(extra);
    $("grid").innerHTML = list.length ? list.map(function (p) { return cardHTML(p).replace('href="product.html?sku=' + p.sku + '"', p.oneoff ? 'href="?u=' + encodeURIComponent(S.ADAPTERS[p.sources[0].channel].url(p.sources[0].ref)) + '"' : '$&'); }).join("")
      : '<div class="g-empty">Wax lama helin — isku day inaad link ku dhejiso.</div>';
  });
  if (u) {
    var pid = S.identify(u);
    if (pid && !S.allowedOn("consumer", pid.platform)) {
      /* a wholesale link on the retail shop: the buyer is not wrong, they are on the wrong site */
      $("res").innerHTML = '<div class="g-found">' + e(A[pid.platform].name) + ' waa suuq jumlad ah — waxaa lagu iibiyaa tiro badan (MOQ), lagumana iibin karo hal xabbo.' +
        '<div style="margin-top:10px"><a class="btn gold" href="' + e(S.crossLink(u, "business")) + '">U gudub Garsoore Ganacsi →</a>' +
        '<div class="g-eta" style="margin-top:8px">Link-gaagu wuu ku socdaa — dib uma dhejin doontid.</div></div></div>';
      return;
    }
    $("res").innerHTML = '<div class="g-found">⏳ Waa la raadinayaa…</div>';
    RF.china.resolveAsync(u, function (r) {
      if (r.error) {
        $("res").innerHTML = '<div class="g-err">' + e(r.error) + (r.canQuote ? '<div style="margin-top:10px"><button class="btn" id="qBtn">Codso qiimo rasmi ah</button></div>' : "") + '</div>';
        if (r.canQuote) $("qBtn").onclick = function () { RF.backend.needUser("Gal si aan qiimaha rasmiga ah kuugu soo dirno.").then(function () { return RF.backend.requestLink(r.id, r.url, r.seen); }).then(function (q) { RF.api.ev("quote"); location.href = "orders.html?quote=" + q.id; }).catch(function (x) { if (x.message !== "cancelled") toast(x.message); }); };
        return;
      }
      var o = r.offer, sel = o.seller;
      $("res").innerHTML = '<div class="g-found">✓ ' + (r.mode === "catalog" ? "Waa la aqoonsaday — alaab ku jirta katalogga Garsoore" : "Waa la aqoonsaday — dalab hal mar ah") +
        ' · ' + e(S.label(o)) + ' · iibiye ' + (sel.verified ? "la hubiyay" : "aan weli la hubin") +
        (o.confidence === "low" ? '<div class="g-eta" style="margin-top:4px;color:var(--fg)">⚠ Macluumaadka bogga ma dhammaystirna — Garsoore ayaa hubinaya alaabta saxda ah ka hor inta aan qiimo bixin.</div>' : "") + '</div><div id="pv"></div>';
      productView(r.product, $("pv"));
    });
  }
}

/* ---------------------------------------------------------------- orders */
var OTAB = "active";
var PRE = { AWAITING_PAYMENT: "Sugaya lacag", PAYMENT_REVIEW: "Lacagta waa la hubinayaa", EXPIRED: "Waqtigii wuu dhacay" };
var ESC = { none: "Lacag weli lama bixin", held: "🔒 Lacagta Garsoore ayaa haysa ilaa aad hesho", released: "✓ Lacagta iibiyaha waa la siiyay",
  refund_due: "↩ Lacag celin ayaa socota (24 saac gudahood)", refunded: "↩ Lacagta waa laguu celiyay" };
function when(iso) { var d = new Date(iso); return d.toLocaleDateString("so-SO", { day: "numeric", month: "short" }) + " " + d.toTimeString().slice(0, 5); }
function canCancel(o) { return ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED"].indexOf(o.state) >= 0 || (o.flow === "local" && o.state === "CONFIRMED"); }
function canDispute(o) { return o.state === "COMPLETED" && !o.dispute && Date.now() - Date.parse(o.completedAt || o.createdAt) < 7 * 864e5; }
function orders(app) {
  app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Dalabyadayda</h1></div><div class="g-empty sm">⏳</div></div>';
  RF.api.ready.then(function () {
    if (RF.api.remote && !RF.api.user) {
      app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Dalabyadayda</h1></div><div class="g-empty">Gal si aad u aragto dalabyadaada — isla akoonka Garsoore iyo Ganacsi.<div style="margin-top:12px"><button class="btn" id="oLogin">Gal</button></div></div></div>';
      $("oLogin").onclick = function () { RF.authUI.open().then(function () { orders(app); }).catch(function () {}); };
      return;
    }
    Promise.all([RF.backend.orders(), RF.backend.quotes()]).then(function (a) { drawOrders(app, a[0], a[1]); })
      .catch(function (x) { app.innerHTML = '<div class="wrap g-err">' + e(x.message) + '</div>'; });
  });
}
function drawOrders(app, all, quotes) {
  var fresh = qs("new").split(","), ops = qs("ops") === "1", remote = RF.api.remote, U = RF.api.user;
  var FL = remote && RF.api.config ? RF.api.config.flows : RF.orders.FLOW;
  var done = function (o) { return ["COMPLETED", "CANCELLED", "EXPIRED"].indexOf(o.state) >= 0; };
  var list = all.filter(function (o) { return OTAB === "all" || (OTAB === "active" ? !done(o) : done(o)); });
  var unpaid = all.filter(function (o) { return o.state === "AWAITING_PAYMENT"; });
  function re() { orders(app); }
  app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Dalabyadayda</h1>' +
    (remote ? "" : '<a class="chip" href="?' + (ops ? "" : "ops=1") + '">' + (ops ? "Qari" : "Muuji") + ' ops view (demo)</a>') + '</div>' +
    (all.length ? '<div class="g-stats"><div><b>' + all.filter(function (o) { return !done(o); }).length + '</b>socda</div><div><b>' + all.filter(function (o) { return o.state === "READY"; }).length + '</b>diyaar in la qaado</div>' +
      '<div><b>' + money(all.filter(function (o) { return o.escrow === "held"; }).reduce(function (s, o) { return s + o.total; }, 0)) + '</b>Garsoore ayaa haysa</div>' +
      '<div><b>' + (U ? money(U.credit || 0) : money(all.filter(function (o) { return ["CANCELLED", "EXPIRED", "AWAITING_PAYMENT"].indexOf(o.state) < 0; }).reduce(function (s, o) { return s + o.total; }, 0))) + '</b>' + (U ? "dheeraadkaaga" : "wadar") + '</div></div>' : "") +
    (unpaid.length ? '<div class="g-paynote">⏳ <b>' + unpaid.length + ' dalab ayaa sugaya lacag bixin</b> — ' + money(unpaid.reduce(function (s, o) { return s + o.total; }, 0)) + '. Dalabyada aan la bixin waxay dhacaan ' + ((RF.api.config && RF.api.config.econ.unpaidHours) || 24) + ' saac kadib.<button class="btn" id="payAll">Bixi hadda</button></div>' : "") +
    (fresh[0] && !unpaid.length ? '<div class="g-found">✓ ' + (fresh.length > 1 ? fresh.length + " dalab ayaa" : "Dalabkaaga waa") + ' la helay. ' + (all.some(function (o) { return o.state === "PAYMENT_REVIEW"; }) ? "Lacagta waa la hubinayaa (badanaa 30 daqiiqo) — kadib Garsoore ayaa haynaysa ilaa aad hesho." : "Lacagta Garsoore ayaa haysa ilaa aad hesho.") + ' Koodhka qaadashada ayaad halkan ku arki doontaa marka uu diyaar noqdo.</div>' : "") +
    (U ? '<div class="g-refer"><div><b>Saaxiibkaa ku casuun, hel ' + money((RF.api.config && RF.api.config.econ.refReward) || 5) + '</b><div class="g-eta">Marka saaxiibkaa qaato dalabkiisa koowaad, waxaad heshaa dheeraad. Isaguna wuxuu helayaa 5% dhimis (SOODHAWOW).</div></div>' +
      '<code>' + e(U.refCode) + '</code><a class="btn gold" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent("Garsoore — wax walba hal meel, lacagtaduna way xajisan tahay ilaa aad hesho. Ku isticmaal koodhka SOODHAWOW 5% dhimis: " + location.origin + "/?ref=" + U.refCode) + '">WhatsApp</a></div>' : "") +
    (all.length ? '<div class="g-seg" id="otab" style="margin:6px 0 14px;display:inline-flex">' + [["active", "Socda"], ["done", "Dhammaaday"], ["all", "Dhammaan"]].map(function (t) { return '<span data-t="' + t[0] + '"' + (OTAB === t[0] ? ' class="on"' : "") + '>' + t[1] + '</span>'; }).join("") + '</div>' : "") +
    (quotes.length ? '<div class="g-sec"><h2>Codsiyada qiimaha</h2></div>' + quotes.map(function (x) {
      return '<div class="g-order' + (x.id === qs("quote") ? " new" : "") + '"><div class="g-ohead"><div class="g-th">' + (x.icon || "📦") + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
        '<div class="g-eta">' + x.id + ' · ' + chName(x.platform) + ' · ' + (x.estimate == null ? "qiimo la sugayo" : "qiyaas ≈ " + money(x.estimate)) + '</div></div>' +
        (x.status === "pending" ? '<span class="g-pill gold">⏳ Waa la qiimaynayaa · saacado gudahood</span>' :
         x.status === "quoted" ? '<div style="text-align:right"><div class="g-price sm">' + money(x.total) + '</div><div class="g-eta">~' + x.etaDays + ' maalmood</div></div><a class="btn" href="product.html?quote=' + x.id + '">Iibso</a>' :
         '<span class="g-pill">Lama helin</span>') + '</div>' + (x.staffNote ? '<div class="g-eta" style="margin-top:8px">Fariin: ' + e(x.staffNote) + '</div>' : "") + '</div>';
    }).join("") : "") + (list.length && quotes.length ? '<div class="g-sec"><h2>Dalabyada</h2></div>' : "") +
    (list.length ? list.map(function (o) {
      var f = (FL[o.flow] || []).filter(function (s) { return !PRE[s]; }), i = f.indexOf(o.state), hist = {}, cx = o.state === "CANCELLED" || o.state === "EXPIRED";
      (o.history || []).forEach(function (h) { hist[h.state] = h.at; });
      var due = new Date(Date.parse(o.createdAt) + (o.etaDays || 0) * 864e5);
      return '<div class="g-order' + (fresh.indexOf(o.id) >= 0 ? " new" : "") + (cx ? " cx" : "") + '"><div class="g-ohead"><a class="g-th" href="product.html?sku=' + o.sku + '">' + o.icon + '</a><div style="flex:1"><b>' + e(o.title) + (o.qty > 1 ? " ×" + o.qty : "") + '</b>' +
        '<div class="g-eta">' + (o.variant ? e(o.variant) + ' · ' : "") + o.id + (o.basket ? ' · dambiil ' + o.basket : "") + ' · ' + e(o.pay) + ' · ' + e(o.pickup) + '</div></div><div class="g-price sm">' + money(o.total) + '</div></div>' +
        (o.state === "CANCELLED" ? '<div class="g-eta" style="margin-top:10px">✕ La joojiyay ' + (hist.CANCELLED ? when(hist.CANCELLED) : "") + (o.cancelReason ? ' · “' + e(o.cancelReason) + '”' : "") + '</div>' :
         o.state === "EXPIRED" ? '<div class="g-eta" style="margin-top:10px">Waqtigii bixinta wuu dhacay — lacag lagama qaadin.</div>' :
         o.state === "AWAITING_PAYMENT" ? '<div class="g-eta" style="margin-top:10px">⏳ Sugaya lacag bixintaada</div>' :
         o.state === "PAYMENT_REVIEW" ? '<div class="g-eta" style="margin-top:10px">⏳ Lacagta waa la hubinayaa' + (o.payTxn ? " · macaamil " + e(o.payTxn) : "") + ' — badanaa 30 daqiiqo</div>' :
        '<div class="g-track">' + f.map(function (s, k) { return '<div class="' + (k < i ? "d" : k === i ? "n" : "") + '"><i></i>' + RF.orders.STATE_SO[s] + (hist[s] ? '<small>' + when(hist[s]) + '</small>' : "") + '</div>'; }).join("") + '</div>') +
        (o.state === "READY" && o.code ? '<div class="g-code"><div><div class="g-lbl" style="margin:0">Koodhka qaadashada</div><b>' + o.code.replace(/(\d{3})(\d{3})/, "$1 $2") + '</b></div><div class="g-eta">Tus koodhkan ' + (o.pickup.indexOf("guriga") >= 0 ? "wadaha" : "xarunta Km4") + ' marka aad alaabta hubiso. Koodhka ha u dirin cid kale — iibiyaha lacagta lama siinayo ilaa aad bixiso.</div></div>' : "") +
        '<div class="g-orow"><span class="g-eta">' + (o.state === "PAYMENT_REVIEW" ? "" : ESC[o.escrow] || "") +
          (!done(o) && o.flow === "china" && o.escrow === "held" ? " · la filayo ~" + due.toLocaleDateString("so-SO", { day: "numeric", month: "short" }) : "") + '</span><span class="g-oacts">' +
          (canCancel(o) ? '<button class="btn ghost" data-cx="' + o.id + '">Jooji</button>' : "") +
          (canDispute(o) ? '<button class="btn ghost" data-dp="' + o.id + '">Cabasho</button>' : "") +
          (o.state === "COMPLETED" && !o.review ? '<button class="btn ghost" data-rv="' + o.id + '">★ Qiimee</button>' : "") +
          ((o.state === "COMPLETED" || o.state === "EXPIRED") && !o.quoteId ? '<a class="btn ghost" href="product.html?sku=' + o.sku + '">Mar kale iibso</a>' : "") +
          (!remote && !cx && i >= 0 && i < f.length - 1 ? '<button class="btn" data-adv="' + o.id + '">' + (f[i + 1] === "COMPLETED" ? "Waan qaatay ✓" : "Tallaabada xigta (demo)") + '</button>' : "") + '</span></div>' +
        (o.dispute ? '<div class="g-err sm" style="margin-top:10px">⚖ Cabasho (' + when(o.dispute.at) + '): ' + e(o.dispute.reason) + ' — ' + (o.dispute.status === "open" ? "Garsoore ayaa go'aan ka gaari doona 48 saac gudahood." : o.dispute.status === "refunded" ? "Go'aan: lacagta waa laguu celinayaa." : "Go'aan: " + e(o.dispute.note || "lama aqbalin")) + '</div>' : "") +
        (o.review ? '<div class="g-eta" style="margin-top:8px">Qiimayntaada: ' + stars(o.review.stars) + (o.review.text ? ' “' + e(o.review.text) + '”' : "") + '</div>' : "") +
        '<div id="rv-' + o.id + '"></div>' +
        (ops && o.internal ? '<pre class="g-ops">' + e(JSON.stringify(o.internal, function (k, v) { return typeof v === "number" ? Math.round(v * 100) / 100 : v; }, 2)) + '</pre>' : "") +
      '</div>';
    }).join("") : '<div class="g-empty">' + (all.length ? "Halkan wax ma jiraan." : 'Dalab weli ma jiro. <a href="index.html">Bilow iibsiga →</a>') + '</div>') + '</div>';
  function fail(x) { toast(x.message || "Khalad"); }
  if ($("payAll")) $("payAll").onclick = function () {
    var cfg = RF.api.config || { merchants: {}, econ: {} }, pay = unpaid[0].pay;
    payStep({ ids: unpaid.map(function (o) { return o.id; }), amount: unpaid.reduce(function (s, o) { return s + o.total; }, 0), pay: pay, merchant: cfg.merchants[pay] || "",
      reference: unpaid[0].basket || unpaid[0].id, expiresHours: cfg.econ.unpaidHours || 24 });
  };
  if ($("otab")) $("otab").onclick = function (ev) { var t = ev.target.closest("span"); if (t) { OTAB = t.dataset.t; drawOrders(app, all, quotes); } };
  [].forEach.call(app.querySelectorAll("[data-adv]"), function (b) { b.onclick = function () { RF.orders.advance(b.dataset.adv); re(); }; });
  [].forEach.call(app.querySelectorAll("[data-cx]"), function (b) { b.onclick = function () {
    var why = prompt("Maxaad u joojinaysaa? (ikhtiyaari)"); if (why === null) return;
    RF.backend.cancel(b.dataset.cx, why).then(function (r) { toast(r && r.refund ? "La joojiyay — lacagta waa laguu celin doonaa" : "La joojiyay"); re(); }).catch(fail); }; });
  [].forEach.call(app.querySelectorAll("[data-dp]"), function (b) { b.onclick = function () {
    var why = prompt("Sharax dhibaatada (tusaale: ma ahan sidii la sheegay, wuu jabnaa, qayb ayaa ka maqan):"); if (!why || !why.trim()) return;
    RF.backend.dispute(b.dataset.dp, why.trim()).then(function () { toast("Cabashada waa la diray"); re(); }).catch(fail); }; });
  [].forEach.call(app.querySelectorAll("[data-rv]"), function (b) { b.onclick = function () {
    var id = b.dataset.rv, n = 5, box = $("rv-" + id);
    function paint() { box.innerHTML = '<div class="g-rvform"><div class="g-pick">' + [1, 2, 3, 4, 5].map(function (k) { return '<button data-s="' + k + '" class="' + (k <= n ? "on" : "") + '">★</button>'; }).join("") + '</div>' +
      '<textarea class="g-in" id="rt-' + id + '" rows="2" placeholder="Maxaad ka jeclayd / aadan ka jeclayn? (ikhtiyaari)"></textarea><button class="btn" id="rs-' + id + '">Dir faallada</button></div>';
      [].forEach.call(box.querySelectorAll("[data-s]"), function (s) { s.onclick = function () { var t = $("rt-" + id).value; n = +s.dataset.s; paint(); $("rt-" + id).value = t; }; });
      $("rs-" + id).onclick = function () { RF.backend.review(id, n, $("rt-" + id).value.trim()).then(function () { toast("Mahadsanid — faalladaadu waa la daabacay"); re(); }).catch(fail); }; }
    paint(); }; });
}


/* ---------------------------------------------------------------- business: China procurement (business.garsoore.com/china.html) */
function bizChina(app) {
  var S = RF.sources, A = S.ADAPTERS, q = qs("q"), u = qs("u"), plat = qs("p") || "";
  /* Business buys wholesale by default — 1688, Alibaba, Made-in-China — but a trader ordering one retail sample
     before committing to a carton is doing the right thing, so retail stays reachable behind its own filter. */
  var WHOLESALE = S.platformsFor("business"), RETAIL = S.platformsFor("consumer");
  var plats = plat ? [plat] : WHOLESALE;
  function on(k) { return plat === k ? ' style="background:rgba(255,255,255,.35)"' : ""; }

  /* ---- buy-for-me service menu. The buyer pays Garsoore, Garsoore pays the vendor, and these are what we do to the
     goods in between. The server re-prices the selection on arrival; these numbers are only what the buyer is shown. */
  var SVC = (RF.api && RF.api.config && RF.api.config.services) || {
    buyFeePct: 5, buyFeeMin: 3,
    items: { inspect: { so: "Hubin muuqaal + sawiro", price: 0, note: "Bilaash" }, count: { so: "Tirin iyo cabbir", price: 2 },
      test: { so: "Tijaabo shaqayn", price: 5 }, video: { so: "Muuqaal furitaan", price: 4 }, repack: { so: "Dib-u-xidhmo adag", price: 3 },
      removeInvoice: { so: "Ka saar qiimaha", price: 1 }, qcReport: { so: "Warbixin QC qoran", price: 8 } }
  };
  var picked = { inspect: true };                        // the free visual check is on unless the buyer turns it off
  function svcKeys() { return Object.keys(picked).filter(function (k) { return picked[k] && SVC.items[k]; }); }
  function svcFee() { return svcKeys().reduce(function (n, k) { return n + (SVC.items[k].price || 0); }, 0); }
  function svcHTML() {
    return '<div class="g-svc"><div class="g-svch"><b>✓ Hubi ka hor inta aanay dhoofin</b>' +
      '<span class="g-eta">Waxaad adigu iibsanaysaa — Garsoore ayaa iibsanaya, hubinaya, oo kuu keenaya. Dooro waxaad rabto inaan samayno.</span></div>' +
      '<div class="g-svcgrid">' + Object.keys(SVC.items).map(function (k) {
        var it = SVC.items[k];
        return '<label class="g-svcit' + (picked[k] ? " on" : "") + '" data-svc="' + k + '"><input type="checkbox"' + (picked[k] ? " checked" : "") + '>' +
          '<span>' + e(it.so || k) + '</span><b>' + (it.price ? "$" + it.price : (it.note || "Bilaash")) + '</b></label>';
      }).join("") + '</div>' +
      '<div class="g-svcf">Adeegyada: <b id="svcT">$' + svcFee() + '</b> · khidmadda iibsiga ' + SVC.buyFeePct + '% (ugu yaraan $' + SVC.buyFeeMin + ') · ' +
        'lacagtaadu way xajisan tahay ilaa aan alaabta helno.</div></div>';
  }
  function wireSvc() {
    [].forEach.call(document.querySelectorAll("[data-svc]"), function (el) {
      el.onchange = function () { var k = el.dataset.svc; picked[k] = el.querySelector("input").checked;
        el.classList.toggle("on", !!picked[k]); var t = $("svcT"); if (t) t.textContent = "$" + svcFee(); };
    });
  }
  app.innerHTML = '<div class="wrap"><section class="g-chero"><span class="g-tagw">GARSOORE CHINA · GANACSI</span><h1>Iibsi jumlad ah oo Shiinaha ka yimaada.</h1>' +
    '<p>Raadi <b>1688, Alibaba iyo warshadaha</b> hal mar — ama ku dheji link. Qiimaha waa <b>la keenay Muqdisho</b> (DAP): alaab, rar Shiinaha, isku-darid, rar bad/cir, canshuur. Adigaa iibsanaya; Garsoore ayaa iibsiga kuu fuliya, lacagta haya, alaabta hubiya, kuuna keena. Suuqyada tafaariiqda (JD, Taobao) waa la heli karaa haddii aad sample rabto.</p>' +
    '<form class="g-paste big" id="bForm"><input id="bQ" placeholder="Raadi (solar light, chairs, CCTV) ama ku dheji link 1688 / Alibaba / warshad…" value="' + e(u || q) + '"><button class="btn gold">Raadi</button></form>' +
    '<div class="g-src"><a href="?' + (q ? "q=" + encodeURIComponent(q) : "") + '"' + on("") + '>Jumlad oo dhan</a>' +
      WHOLESALE.filter(function (k) { return !A[k].nosearch; }).concat(RETAIL).map(function (k) {
        return '<a href="?p=' + k + (q ? "&q=" + encodeURIComponent(q) : "") + '"' + on(k) + '>' + A[k].name + ' <small>' + (RETAIL.indexOf(k) >= 0 ? "tafaariiq" : A[k].zh) + '</small></a>'; }).join("") + '</div></section>' +
    svcHTML() +
    /* The 1688 / Made-in-China catalogue lives HERE. It is wholesale: every row carries the supplier's minimum and
       the per-unit landed price at that minimum, which is what a trader is actually deciding between. The consumer
       shop only ever shows what can be bought one of. */
    '<div class="g-sec"><h2>Katalogga jumlada</h2><span class="g-eta" id="bcCount"></span></div>' +
    '<div class="g-filters"><label>Qaybta <select id="bcCat"><option value="">Dhammaan</option>' +
      C.CATS.map(function (c) { return '<option value="' + c.id + '">' + e(c.so) + '</option>'; }).join("") + '</select></label>' +
      '<label>MOQ ugu badnaan <input id="bcMoq" type="number" min="1" step="1" placeholder="—" style="width:90px"></label>' +
      '<label>Qiimaha halkii unug ugu badnaan $ <input id="bcMax" type="number" min="0" step="10" placeholder="—" style="width:100px"></label></div>' +
    '<div class="g-grid" id="bcGrid"></div>' +
    '<div class="g-sec"><h2>Dalabyo</h2><span class="g-eta">Qiimaha halkii unug = la keenay Muqdisho · beddel tirada si aad u aragto qiimaha jumladda</span></div>' +
    '<div id="offers"></div>' +
    '<div class="g-sec"><h2>Iibiyeyaasha Shiinaha</h2><span class="g-eta">Warshado iyo ganacsato ay Garsoore hubisay</span></div>' +
    '<div class="g-vendors">' + S.VENDORS.map(function (v) {
      return '<div class="g-vendor"><b>' + e(v.name) + '</b><div class="g-eta">' + (v.real ? v.products + ' alaab katalogga · <a href="' + e(v.sample) + '" target="_blank" rel="noopener noreferrer" style="color:var(--link)">Made-in-China ↗</a>' : e(v.zh) + ' · ' + e(v.city) + ' · ' + v.years + ' sano · ★ ' + v.rating) + '</div>' +
        '<div class="g-vtags">' + (v.verified ? '<span class="g-pill">✓ La hubiyay</span>' : '<span class="g-pill gold">Hubin socota</span>') + (v.factory ? '<span class="g-pill gold">Warshad</span>' : "") +
          (v.real ? v.cats.map(function (c) { var k = C.CATS.filter(function (x) { return x.id === c; })[0]; return k ? '<span class="chip">' + k.so + '</span>' : ""; }).join("") : "") +
        v.platforms.map(function (p) { return '<span class="chip">' + (A[p] ? A[p].name : "Toos") + '</span>'; }).join("") + '</div></div>';
    }).join("") + '</div></div>';
  $("bForm").onsubmit = function (ev) { ev.preventDefault(); var v = $("bQ").value.trim(); location.href = S.urlOf(v) ? "?u=" + encodeURIComponent(S.urlOf(v)) : "?q=" + encodeURIComponent(v) + (plat ? "&p=" + plat : ""); };
  function priceTxt(L) { return "halkii · $" + L.total.toLocaleString() + " wadar · " + (L.mode === "sea" ? "bad" : "cir") + " ~" + L.etaDays + " maalmood"; }
  function rows(offers) {
    if (!offers.length) {
      /* Garsoore has listings from Made-in-China and 1688 only. Alibaba and the retail markets are link-in channels:
         say so, rather than leaving a filter that silently returns nothing and reads as a broken page. */
      var pn = plat && A[plat] ? A[plat].name : "";
      $("offers").innerHTML = '<div class="g-empty">' +
        (pn ? 'Garsoore weli katalog ' + e(pn) + ' ma laha. ' : 'Wax lama helin. ') +
        'Ku dheji link — wakiil ayaa la xiriiraya iibiyaha, kuuna soo celinaya hal qiime.' +
        '<div style="margin-top:10px"><a class="btn" href="sourcing.html">Naga codso inaan kuu iibsanno →</a></div></div>';
      return;
    }
    $("offers").innerHTML = '<div class="g-otable">' + offers.map(function (o, i) {
      var known = o.tiers[0].cost > 0, L = S.landed(o, Math.max(o.moq, 50));
      return '<div class="g-orow2"><div class="g-th">' + o.icon + '</div>' +
        '<div class="g-oinfo"><b>' + e(o.title) + '</b><div class="g-eta">' + e(o.titleZh) + ' · <a href="' + e(o.url) + '" target="_blank" rel="noopener">' + A[o.platform].name + ' ↗</a></div>' +
          '<div class="g-eta">' + (o.seller.verified ? "✓ " : "") + e(o.seller.name) + ' · ' + e(o.seller.city) + (o.seller.factory ? " · warshad" : "") + ' · MOQ ' + o.moq + ' · kayd ' + o.stock.toLocaleString() + '</div>' +
          '<div class="g-eta">Heerarka: ' + o.tiers.map(function (t) { return t.minQty + "+ → ¥" + t.cost; }).join(" · ") + '</div></div>' +
        '<div class="g-oqty"><label class="g-eta">Tirada</label><input type="number" min="' + o.moq + '" value="' + L.qty + '" data-q="' + i + '"></div>' +
        '<div class="g-oprice">' + (known ? '<div class="g-price sm" data-pu="' + i + '">$' + L.perUnit + '</div><div class="g-eta" data-pt="' + i + '">' + priceTxt(L) + '</div>'
          : '<div class="g-eta">Qiimo la sugayo</div>') + '</div>' +
        '<button class="btn" data-rfq="' + i + '"' + (known ? "" : ' data-unk="1"') + '>' + (known ? "Codso" : "Codso qiimo") + '</button></div>';
    }).join("") + '</div>';
    [].forEach.call(document.querySelectorAll("[data-q]"), function (inp) {
      inp.oninput = function () { var o = offers[+inp.dataset.q], L = S.landed(o, +inp.value || o.moq);
        document.querySelector('[data-pu="' + inp.dataset.q + '"]').textContent = "$" + L.perUnit;
        document.querySelector('[data-pt="' + inp.dataset.q + '"]').textContent = priceTxt(L); };
    });
    [].forEach.call(document.querySelectorAll("[data-rfq]"), function (b) {
      b.onclick = function () { var i = +b.dataset.rfq, qty = +document.querySelector('[data-q="' + i + '"]').value;
        if (b.dataset.unk) { RF.backend.needUser("Gal si aan qiimaha rasmiga ah kuugu soo dirno.").then(function () { return RF.backend.requestLink({ platform: offers[i].platform, ref: offers[i].ref }, offers[i].url, null, { services: svcKeys(), qty: qty }); }).then(function (qq) { toast("Codsigii waa la diray · " + qq.id); b.textContent = "✓ La diray"; b.disabled = true; }).catch(function (x) { if (x.message !== "cancelled") toast(x.message); }); return; }
        var r = S.procure(offers[i], qty); if (r.error) return toast(r.error);
        toast("RFQ waa la diray · Garsoore China: $" + r.landed.perUnit + "/unug. Eeg Hawlaha shirkadda.");
        b.textContent = "✓ La diray"; b.disabled = true; };
    });
  }
  wireSvc();

  /* ---- the wholesale catalogue grid */
  (function () {
    var PAGE = 36, shown = PAGE;
    function draw() {
      var cat = $("bcCat").value, maxMoq = +$("bcMoq").value, maxUnit = +$("bcMax").value;
      var list = C.products.filter(function (p) {
        if (p.fbg || p.oneoff) return false;                 /* FBG stock and pasted one-offs are not the catalogue */
        if (cat && p.cat !== cat) return false;
        var m = C.moqOf(p, p.variants[0]);
        if (maxMoq > 0 && m > maxMoq) return false;
        return true;
      }).map(function (p) {
        var m = C.moqOf(p, p.variants[0]);
        var L = C.basketPrice([{ product: p, variant: p.variants[0], qty: m }]).lines[0];
        return { p: p, moq: m, line: L, unit: L && L.total != null ? L.total / m : null };
      }).filter(function (x) { return x.unit != null && (!(maxUnit > 0) || x.unit <= maxUnit); });

      $("bcCount").textContent = list.length + " alaab · qiimaha waa la keenay Muqdisho";
      $("bcGrid").innerHTML = list.slice(0, shown).map(function (x) {
        var p = x.p, img = p.image;
        return '<a class="g-pc" href="' + (RF.sources ? RF.sources.crossLink("", "consumer").replace("china.html?u=", "") : "") + 'product.html?sku=' + p.sku + '" target="_blank" rel="noopener">' +
          '<div class="g-pimg"><span class="g-bd cn">MOQ ' + x.moq + '</span>' +
          (img ? '<img class="g-pimgi" loading="lazy" src="' + e(img) + '" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(\'' + p.icon + '\'))">' : p.icon) +
          '</div><div class="g-pb"><div class="g-pn">' + e((p.brand ? p.brand + " " : "") + p.model) + '</div>' +
          '<div class="g-pr">$' + (Math.round(x.unit * 100) / 100).toLocaleString() + '<small class="g-moq"> / xabbo</small></div>' +
          '<div class="g-ship-sm">' + x.moq + ' xabbo = ' + money(x.line.total) + '</div>' +
          '<div class="g-eta">' + (x.line.mode === "sea" ? "\ud83d\udea2 bad" : "\u2708 cir") + " " + x.line.transitMin + "\u2013" + x.line.transitMax + ' maalmood</div></div></a>';
      }).join("") + (list.length > shown ? '<button class="btn ghost" id="bcMore" style="grid-column:1/-1">Tus wax badan</button>' : "");
      if ($("bcMore")) $("bcMore").onclick = function () { shown += PAGE; draw(); };
    }
    ["bcCat", "bcMoq", "bcMax"].forEach(function (id) { $(id).onchange = $(id).oninput = function () { shown = PAGE; draw(); }; });
    draw();
  })();

  if (u) {
    var id = S.identify(u);
    if (!id) { $("offers").innerHTML = '<div class="g-err">Link-gan lama aqoonsan.</div>'; return; }
    if (!S.allowedOn("business", id.platform))
      $("offers").insertAdjacentHTML("beforebegin", '<div class="g-found">' + e(A[id.platform].name) + ' waa suuq tafaariiq ah — qiimuhu waa mid xabbo, heerar jumlad ma leh. Waan kuu iibsan karnaa (tusaale ahaan sample), laakiin qiimo jumlad ah kama heli doontid.</div>');
    S.fetchOffer(id.platform, id.ref, function (err, o) {
      if (o) return rows([o]);
      $("offers").innerHTML = '<div class="g-err">Ma helin macluumaadka link-gan hadda. <button class="btn" id="qBtn2">Codso qiimo rasmi ah</button></div>';
      $("qBtn2").onclick = function () { RF.backend.needUser("Gal si aan qiimaha rasmiga ah kuugu soo dirno.").then(function () { return RF.backend.requestLink(id, u, null, { services: svcKeys() }); }).then(function (q) { toast("Codsigii waa la diray · " + q.id); $("qBtn2").disabled = true; }).catch(function (x) { if (x.message !== "cancelled") toast(x.message); }); };
    });
  } else S.search(q, { platforms: plats }, rows);
}

/* ---------------------------------------------------------------- business: price incoming quote requests (business/quotes.html) */
function quotesAdmin(app) {
  if (RF.api && RF.api.remote) return RF.opsUI(app, "quotes");
  function draw() {
    var list = RF.quotes.list(), pend = list.filter(function (x) { return x.status === "pending"; });
    app.innerHTML = '<div class="wrap"><div class="g-sec" style="margin-top:34px"><h1>Codsiyada qiimaha</h1><span class="g-eta">' + pend.length + ' sugaya · ' + list.length + ' guud ahaan</span></div>' +
      '<p class="g-eta" style="max-width:70ch;margin-bottom:14px">Codsiyada alaabta aan katalogga ku jirin. Hubi isku-xigga, qiimee alaabta (tixraac ¥ + rar + canshuur + faa\'iido), kadibna ku qor qiimaha rasmiga ah ee doolarka.</p>' +
      (list.length ? list.map(function (x) {
        return '<div class="g-order"><div class="g-ohead"><div class="g-th">' + x.icon + '</div><div style="flex:1"><b>' + e(x.title) + '</b>' +
          '<div class="g-eta">' + x.id + ' · <a href="' + e(x.url) + '" target="_blank" rel="noopener" style="color:var(--link);font-weight:700">' + chName(x.platform) + ' ↗</a> · ' + e(x.seller || "") + ' · ' + x.kg + ' kg · ' + e(x.contact || "aan magac lahayn") + '</div>' +
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
  /* FBG stock is live data, so it is fetched before the first paint of any shop page */
  /* the pro screens for agents / FBG / China sourcing only render in Xirfadle mode */
  if (RF.mode && RF.mode.simple() && RF.simpleUI && ["agents", "fbg", "bizchina"].indexOf(page) >= 0)
    return RF.api.ready.then(function () { RF.simpleUI(app, { agents: "agent", fbg: "fbg", bizchina: "china" }[page]); });
  var run = function () { ({ home: home, product: product, china: china, orders: orders, cart: cart, bizchina: bizChina,
    calculator: function (a) { RF.calcUI(a); }, sourcing: function (a) { RF.sourcingUI(a); }, quotes: quotesAdmin, ops: function (a) { RF.opsUI(a, qs("tab") || "stats"); }, agents: function (a) { RF.agentsUI(a, qs("tab") || "mine"); }, admin: function (a) { RF.adminUI(a, qs("tab") || "home"); }, fbg: function (a) { RF.fbgUI(a); }, account: function (a) { RF.accountUI(a); } }[page] || home)(app); };
  /* staff pages need to know whether the API is there before drawing; shop pages draw immediately */
  if ((page === "quotes" || page === "ops" || page === "agents" || page === "admin" || page === "fbg" || page === "account" || page === "bizchina" || page === "sourcing") && RF.api) RF.api.ready.then(run);
  else if (RF.backend && ["home", "product", "cart", "china"].indexOf(page) >= 0)
    RF.backend.listings().then(function (l) { C.addLive(l || []); }).catch(function () {}).then(run);
  else run();
};
})();
