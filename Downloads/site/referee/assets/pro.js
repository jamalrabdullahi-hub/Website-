/* Garsoore Business Pro (window.RF.proUI) — business.<domain>/pro.html

   Two tiers, and the line between them is deliberate: everything about BUYING is free. Searching wholesale, pasting
   a link, asking for a price, placing an order, using an agent, selling on the consumer shop — none of it is behind
   a paywall, because charging somebody for permission to spend money with you is how a marketplace stays empty.

   Pro is the two things that consume real capacity rather than server time: a China suite of their own, and an agent
   working a sourcing request on trust instead of against a deposit. Both are things Garsoore must reserve whether or
   not the member uses them that month, which is what a subscription is actually for. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function when(iso) { return iso ? new Date(iso).toLocaleDateString("so-SO", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

RF.proUI = function (app) {
  if (!RF.api || !RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  var cfg = RF.api.config || {}, P = cfg.plans || { proMonthly: 50 }, SRC = cfg.sourcing || { depositPct: 30 }, F = cfg.fbg || {};

  function page(status) {
    return '<div class="wrap"><section class="g-chero biz"><span class="g-tagw">XUBINNIMO</span>' +
      '<h1>Garsoore Ganacsi, iyo Garsoore Ganacsi <span style="color:var(--gold)">Pro</span>.</h1>' +
      '<p>Iibsigu <b>bilaash</b> weeye. Raadi, ku dheji link, codso qiime, dalbo, wakiil isticmaal, kaydkaaga ku iib — ' +
      'midkoodna lacag kuma jirto. Pro waa laba shay oo bakhaar iyo waqti wakiil ka qaata.</p></section>' +
      status +
      '<div class="pr-grid">' +

        '<div class="pr-card"><div class="pr-head"><b>Garsoore Ganacsi</b><span class="pr-price">Bilaash</span></div>' +
          '<ul class="pr-list">' +
            '<li>✓ Raadi jumlada Shiinaha (1688, Alibaba, warshado)</li>' +
            '<li>✓ Ku dheji link kasta — qiime ayaa lagu soo celinayaa</li>' +
            '<li>✓ Dalbo oo lacagtaadu xajisan tahay ilaa aad hesho</li>' +
            '<li>✓ Wakiillo: mandate iib ama iibsi</li>' +
            '<li>✓ Kaydkaaga ku iib suuqa macaamiisha</li>' +
            '<li>✓ Xisaabiyaha rarka</li>' +
            '<li class="off">✗ Cinwaan Shiinaha oo kaaga gaar ah (FBG)</li>' +
            '<li class="off">✗ Raadin carbuun la\'aan — ' + SRC.depositPct + '% ayaa laga rabaa</li>' +
          '</ul></div>' +

        '<div class="pr-card on"><div class="pr-head"><b>Garsoore Ganacsi Pro</b><span class="pr-price">' + money(P.proMonthly) + '<small>/bishii</small></span></div>' +
          '<ul class="pr-list">' +
            '<li>✓ <b>Wixii ku jira Ganacsiga oo dhan</b></li>' +
            '<li>✓ <b>FBG — cinwaan Shiinaha oo kaaga gaar ah.</b> Iibiyayaashaadu halkaas ayay u diraan; waan qaabilnaa, ' +
              'sawirnaa, miisaannaa, isku darnaa oo Muqdisho keennaa. Alaabtu adigaa iska leh ilaa ay iibsanto.</li>' +
            '<li>✓ <b>Raadin carbuun la\'aan.</b> Wakiil ayaa kuu raadinaya, kuuna gorgortamaya, adigoo aan wax hore u bixin.</li>' +
            '<li>✓ Kaydkaaga bakhaarka Muqdisho</li>' +
          '</ul>' +
          '<div class="pr-fees">Kharashka FBG waa sidiisii: qaabilaad ' + money(F.receivingPerCarton) + ' sanduuqii · rar ' +
            money(F.seaPerKg) + '/kg (bad) ' + money(F.airPerKg) + '/kg (cir) · kayd bilaash ' + F.freeStorageDays + ' maalmood · ' +
            'komishan ' + F.commissionPct + '% marka la iibiyo. Pro waa furitaanka, ma aha kharashyada.</div>' +
        '</div>' +
      '</div>' +

      '<div class="g-sec"><h2>Maxaa lacag looga qaadayaa labadan oo keliya?</h2></div>' +
      '<p class="g-eta" style="max-width:76ch">Labaduba wax dhab ah ayay Garsoore ka qaadaan bil kasta, haddii aad isticmaasho iyo haddii kaleba: ' +
      'cinwaanku wuxuu qabsadaa meel bakhaarka Shiinaha iyo booskaaga shixnadaha; raadinta carbuunka la\'aan waxay ku kacaysaa ' +
      'saacado wakiil oo dhab ah oo aan lacag hor leh lagu ilaalin. Iibsigu ma aha mid kharash noocaas ah leh — ' +
      'sidaa darteed waa bilaash, oo sidaas ayuu ku sii ahaanayaa.</p>' +

      '<div class="g-sec"><h2>Sidee loo bixiyaa?</h2></div>' +
      '<p class="g-eta" style="max-width:76ch">Hadda gacan ayaa loo qabtaa: nala soo xiriir, lacagta EVC/ZAAD ku dir, ' +
      'waxaana laguu furayaa isla maalintaas. <b>Si otomaatig ah lagaama qaadayo</b> — bil kasta adigaa go\'aansanaya ' +
      'inaad sii wadato. Marka lacag bixinta otomaatigga ah la helo, waan kuu sheegi doonnaa ka hor.</p>' +
      '<a class="btn g-buy" href="https://wa.me/252772428472?text=' + encodeURIComponent("Salaan, waxaan rabaa Garsoore Business Pro.") + '" target="_blank" rel="noopener">💬 Nala soo xiriir — Pro</a>' +
      '</div>';
  }

  if (!RF.api.user) {
    app.innerHTML = page('<div class="g-empty">Gal si aad u aragto xaaladdaada. <button class="btn" id="prIn">Gal</button></div>');
    $("prIn").onclick = function () { RF.authUI.open("Garsoore Ganacsi Pro").then(function () { RF.proUI(app); }).catch(function () {}); };
    return;
  }

  RF.api.call("GET", "/plan").then(function (j) {
    app.innerHTML = page(j.pro
      ? '<div class="cs-ok pr-status"><b>✓ Waxaad ku jirtaa Garsoore Ganacsi Pro</b> — wuxuu dhacayaa ' + when(j.until) +
        '. <a href="fbg.html" style="color:var(--link);font-weight:700">Fur FBG →</a></div>'
      : '<div class="pr-status off">Hadda waxaad ku jirtaa <b>Garsoore Ganacsi</b> (bilaash).</div>');
    if ($("prIn")) $("prIn").onclick = function () { RF.authUI.open("Garsoore Ganacsi Pro").then(function () { RF.proUI(app); }).catch(function () {}); };
  }).catch(function () { app.innerHTML = page(""); });
};
})();
