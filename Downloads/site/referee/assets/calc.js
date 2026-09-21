/* Garsoore — free shipping calculator (window.RF.calcUI).

   Public, no account, no email capture. It exists because the question that stops a Somali trader importing is not
   "what does the stock cost" — that one is on Alibaba in plain numbers. It is "what does it cost to GET here", and
   nobody will tell you without a conversation you feel unqualified to have.

   It runs on the same contracted rate cards as the shop (assets/shipping.js), so the number it gives is the number
   Garsoore would charge. It does not pretend to be an all-in landed cost: duty and clearance are shown separately
   and labelled, because a calculator that quietly folds in customs is how people get surprised at the port. */
(function () {
var RF = window.RF = window.RF || {};
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

RF.calcUI = function (app) {
  var S = RF.shipping;
  if (!S) { app.innerHTML = '<div class="wrap g-empty">Mishiinka rarka lama helin.</div>'; return; }

  app.innerHTML = '<div class="wrap"><section class="g-chero"><span class="g-tagw">XISAABIYE BILAASH AH</span>' +
    '<h1>Immisa ayay ku noqonaysaa inaad Shiinaha wax ka keento?</h1>' +
    '<p>Ku qor miisaanka iyo cabbirka — waxaad hesha qiimaha rarka <b>isla markiiba</b>. Akoon uma baahnid, ' +
    'iimayl kuma weydiinayno. Qiimahani wuxuu ka yimaadaa isla kaadhadhka Garsoore ku shaqeeyo.</p></section>' +

    '<div class="cl-grid">' +
      '<div class="cl-form">' +
        '<div class="g-lbl">Maxaad keenaysaa?</div>' +
        '<div class="cl-row"><label>Miisaanka guud (kg)<input class="g-in" id="clKg" type="number" min="0" step="0.1" value="50"></label>' +
        '<label>Tirada sanduuqa<input class="g-in" id="clBox" type="number" min="1" step="1" value="1"></label></div>' +

        '<div class="g-lbl" style="margin-top:14px">Cabbirka sanduuq kasta (sm) — haddii aad taqaan</div>' +
        '<div class="cl-row3"><label>Dherer<input class="g-in" id="clL" type="number" min="0" placeholder="—"></label>' +
        '<label>Ballac<input class="g-in" id="clW" type="number" min="0" placeholder="—"></label>' +
        '<label>Sare<input class="g-in" id="clH" type="number" min="0" placeholder="—"></label></div>' +
        '<div class="g-eta" style="margin-top:6px">Haddii aadan cabbirka aqoon, waan qiyaasaynaa nooca alaabta.</div>' +

        '<div class="g-lbl" style="margin-top:14px">Nooca alaabta</div>' +
        '<select class="g-in" id="clCat">' + (RF.catalog ? RF.catalog.CATS.map(function (c) {
          return '<option value="' + c.id + '"' + (c.id === "HOM" ? " selected" : "") + '>' + e(c.so) + '</option>'; }).join("") : "") + '</select>' +

        '<button class="btn g-buy full" id="clGo" style="margin-top:16px">Xisaabi</button>' +
        '<div class="g-escrow">Ma jiro wax lacag ah oo lagaa qaadayo. Tani waa qiyaas rar oo bilaash ah.</div>' +
      '</div>' +
      '<div class="cl-out" id="clOut"><div class="g-empty sm">Ku qor miisaanka, kadibna riix “Xisaabi”.</div></div>' +
    '</div>' +

    '<div class="g-sec"><h2>Waxa aan kuu qabanno</h2></div>' +
    '<ol class="g-how"><li><b>Warshadda</b>waan la xiriirnaa oo aan iibsanaa</li><li><b>Dekedda/Garoonka</b>annaga ayaa qabanayna</li>' +
    '<li><b>Gudbinta</b>canshuurta iyo warqadaha</li><li><b>Muqdisho</b>gacantaada ayay ku timaaddaa</li></ol>' +
    '<p class="g-eta" style="max-width:74ch">Uma baahnid inaad garato <i>incoterm</i>, <i>bill of lading</i>, ama sida looga saaro alaabta dekedda. ' +
    'Taasi waa shaqadayada. Adigu waxaad dooranaysaa waxa aad rabto iyo immisa.</p></div>';

  function draw() {
    var kg = +$("clKg").value || 0, boxes = Math.max(1, +$("clBox").value || 1), cat = $("clCat").value;
    var l = +$("clL").value, w = +$("clW").value, h = +$("clH").value;
    var dims = (l > 0 && w > 0 && h > 0) ? { l: l, w: w, h: h } : null;
    if (!(kg > 0)) { $("clOut").innerHTML = '<div class="g-err">Ku qor miisaanka.</div>'; return; }

    /* one shipment, both lanes, exactly as the shop prices them */
    var out = ["air", "sea"].map(function (m) {
      var q = S.quote({ kg: kg / boxes, cat: cat, qty: boxes, dims: dims, mode: m });
      if (!q.ok) return null;
      var clr = S.clearanceFee ? S.clearanceFee(m, q.chargeable) : 0;
      var duty = S.dutyRate ? S.dutyRate(cat) : 0.05;
      return { m: m, q: q, clr: clr, duty: duty };
    }).filter(Boolean);

    if (!out.length) { $("clOut").innerHTML = '<div class="g-err">Xaaladdan hadda lama qiimayn karo — nala soo xiriir.</div>'; return; }

    var best = out.slice().sort(function (a, b) { return (a.q.cost + a.clr) - (b.q.cost + b.clr); })[0];
    $("clOut").innerHTML = out.map(function (x) {
      var q = x.q, total = Math.round((q.cost + x.clr) * 100) / 100;
      return '<div class="cl-card' + (x === best ? " on" : "") + '">' +
        '<div class="cl-head"><b>' + (x.m === "air" ? "✈ Cirka" : "🚢 Badda") + '</b>' +
          (x === best ? '<span class="g-pill gold">Ugu raqiisan</span>' : "") + '</div>' +
        '<div class="cl-big">' + money(total) + '</div>' +
        '<div class="g-eta">' + q.transitMin + '–' + q.transitMax + ' maalmood · Muqdisho</div>' +
        '<div class="cl-lines">' +
          '<div><span>Rarka</span><b>' + money(q.cost) + '</b></div>' +
          '<div><span>Gudbin (dekedda/garoonka)</span><b>' + money(x.clr) + '</b></div>' +
          '<div><span>Lagu qiimeeyay</span><b>' + q.chargeable + ' ' + q.unit + (q.basis === "volumetric" ? " (mug)" : q.basis === "weight-capped" ? " (miisaan)" : "") + '</b></div>' +
        '</div>' +
        '<div class="g-eta cl-note">Canshuurta alaabtu waa ~' + Math.round(x.duty * 100) + '% qiimaha alaabta + rarka. ' +
          'Qiimaha alaabta lagama xisaabin halkan.</div></div>';
    }).join("") +
    (out[0].q.estimatedSize ? '<div class="g-eta cl-est">⚠ Cabbirka lama qorin, waa la qiyaasay. Cabbirka saxda ah ayaa qiimaha sax ka dhigaya.</div>' : "") +
    '<a class="btn g-buy full" href="' + (window.SURFACE === "business" ? "sourcing.html" : "business/sourcing.html") + '" style="margin-top:14px">Naga codso inaan kuu keenno →</a>';
  }

  $("clGo").onclick = draw;
  ["clKg", "clBox", "clL", "clW", "clH", "clCat"].forEach(function (id) { $(id).onkeydown = function (ev) { if (ev.key === "Enter") draw(); }; });
  draw();
};
})();
