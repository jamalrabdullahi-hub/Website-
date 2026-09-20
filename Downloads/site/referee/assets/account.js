/* Garsoore — akoonkayga (my account).
   Signed out, this page is the sign-up: your phone number becomes your account, no email, no password to forget.
   Signed in, it is the one place your details live — name, city, delivery address, mobile-money number, PIN, credit,
   referral code — saved on the server so every checkout afterwards is two taps, on any device you sign in from. */
(function () {
var RF = window.RF;
function $(id) { return document.getElementById(id); }
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
function toast(m) { var t = document.createElement("div"); t.className = "toast in"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
var PAYS = ["EVC Plus", "ZAAD", "Sahal", "Premier Wallet"];
var ROLE_SO = { consumer: "Macmiil", business: "Ganacsi", agent: "Wakiil", staff: "Shaqaale Garsoore", admin: "Maamule" };

RF.accountUI = function (app) {
  if (!RF.api) { app.innerHTML = '<div class="wrap g-empty">Server-ka lama helin.</div>'; return; }
  if (!RF.api.checked) { app.innerHTML = '<div class="wrap g-empty sm">⏳</div>'; return void RF.api.ready.then(function () { RF.accountUI(app); }); }
  if (!RF.api.remote) { app.innerHTML = '<div class="wrap g-empty">Akoonnadu waxay u baahan yihiin server-ka.</div>'; return; }
  var call = RF.api.call;
  if (!RF.api.user) return signup(app);
  draw(app);
};

/* ---------------------------------------------------------------- signed out: create an account (or sign in) */
function signup(app) {
  var mode = "join";
  function render(msg) {
    app.innerHTML = '<div class="wrap ac-wrap"><section class="ac-hero"><h1>' + (mode === "join" ? "Samee akoon" : "Gal akoonkaaga") + '</h1>' +
      '<p>Lambarkaaga taleefanku waa akoonkaaga. Iimayl ma jiro, eray sir ah oo la illoobo ma jiro — lambarkaaga iyo PIN kaliya.</p></section>' +
      '<div class="ac-grid"><form class="ac-card" id="acForm">' +
        (mode === "join" ? '<label class="g-lbl">Magacaaga</label><input class="g-in" id="acName" autocomplete="name" placeholder="Magaca oo buuxa">' : "") +
        '<label class="g-lbl">Lambarka taleefanka</label><input class="g-in" id="acPhone" inputmode="tel" autocomplete="tel" placeholder="61 5xx xxxx">' +
        '<label class="g-lbl">PIN (4–6 lambar)</label><input class="g-in" id="acPin" type="password" inputmode="numeric" maxlength="6" autocomplete="' + (mode === "join" ? "new-password" : "current-password") + '" placeholder="••••">' +
        '<div class="g-err sm" id="acErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
        '<button class="btn g-buy full" id="acGo">' + (mode === "join" ? "Samee akoon" : "Gal") + '</button>' +
        '<div class="g-eta" style="margin-top:12px;text-align:center">' + (mode === "join" ? 'Akoon ma leedahay? <a href="#" id="acSw">Gal</a>' : 'Akoon ma lihid? <a href="#" id="acSw">Samee mid</a>') + '</div>' +
        '<div class="g-escrow">🔒 PIN-kaaga cid kale ha u sheegin. Shaqaalaha Garsoore weligood kuma weydiin doonaan.</div>' +
      '</form>' +
      '<aside class="ac-why"><h3>Maxaad u samaynaysaa akoon?</h3>' +
        '<ul><li><b>Dalabkaaga la soco</b> — halka uu marayo iyo koodhka qaadashada.</li>' +
        '<li><b>Hal mar ku qor</b> cinwaankaaga iyo lambarka lacag bixinta — mar dambe laba taabasho ayaa ku filan.</li>' +
        '<li><b>Lacagtaadu way xajisan tahay</b> ilaa aad alaabta hesho — cabasho 7 maalmood.</li>' +
        '<li><b>Hal akoon</b> Garsoore.com iyo Ganacsi.</li>' +
        '<li><b>Saaxiibkaa ku casuun</b> oo hel dheeraad markuu wax qaato.</li></ul></aside></div></div>';
    $("acSw").onclick = function (ev) { ev.preventDefault(); mode = mode === "join" ? "login" : "join"; render(); };
    $("acForm").onsubmit = function (ev) {
      ev.preventDefault();
      var ph = $("acPhone").value, pin = $("acPin").value, go = $("acGo");
      go.disabled = true; go.textContent = "…";
      (mode === "join" ? RF.api.register($("acName").value, ph, pin) : RF.api.login(ph, pin))
        .then(function () { location.href = "account.html"; })
        .catch(function (x) { if (x.status === 409) mode = "login"; render(x.message); });
    };
  }
  render();
}

/* ---------------------------------------------------------------- signed in: the details we keep */
function draw(app) {
  var u = RF.api.user, p = u.profile || {}, call = RF.api.call;
  var biz = window.SURFACE === "business", root = location.hostname.replace(/^(business|admin)\./, "");
  var real = /\.[a-z]{2,}$/i.test(location.hostname) && !/(workers|pages)\.dev$/.test(location.hostname);
  var other = real ? location.protocol + "//" + (biz ? root : "business." + root) + "/" : (biz ? "../" : "business/");
  app.innerHTML = '<div class="wrap ac-wrap"><section class="ac-hero"><h1>Akoonkayga</h1>' +
    '<p>' + e(u.name) + ' · ' + e(RF.phoneFmt ? RF.phoneFmt(p.phoneFull) : (p.phoneFull || u.phone)) + ' · ' + e(ROLE_SO[u.role] || u.role) + (p.joined ? ' · ka mid ah ' + new Date(p.joined).toLocaleDateString("so-SO", { month: "long", year: "numeric" }) : "") + '</p></section>' +
    '<div class="ac-grid">' +
      '<form class="ac-card" id="acSave"><h3>Xogtaada</h3>' +
        '<label class="g-lbl">Magaca</label><input class="g-in" id="pName" value="' + e(u.name) + '">' +
        '<label class="g-lbl">Magaalada</label><input class="g-in" id="pCity" value="' + e(p.city) + '" placeholder="Muqdisho">' +
        '<label class="g-lbl">Cinwaanka gaarsiinta</label><textarea class="g-in" id="pAddr" rows="2" placeholder="Degmada iyo calaamad — tusaale: Hodan, agagaarka Tarabuunka">' + e(p.address) + '</textarea>' +
        '<label class="g-lbl">Habka lacag bixinta</label><div class="g-pay" id="pPay">' + PAYS.map(function (m) { return '<div class="' + (p.payMethod === m ? "on" : "") + '" data-pay="' + m + '">' + m + '</div>'; }).join("") + '</div>' +
        '<label class="g-lbl">Lambarka lacag bixinta</label><input class="g-in" id="pPhone" inputmode="tel" value="' + e(RF.phoneFmt ? RF.phoneFmt(p.payPhone) : p.payPhone) + '" placeholder="61 5xx xxxx">' +
        '<div class="g-err sm" id="pErr" hidden></div>' +
        '<button class="btn g-buy full" id="pGo">Kaydi</button>' +
        '<div class="g-escrow">Xogtan waxaa loo isticmaalaa dalabkaaga oo keliya. Cidna lama siiyo.</div></form>' +
      '<div class="ac-side">' +
        '<div class="ac-card"><h3>Dheeraadkaaga</h3><div class="ac-big">' + money(u.credit) + '</div>' +
          '<p class="g-eta">Si toos ah ayaa looga jaraa dalabkaaga xiga.</p>' +
          '<h3 style="margin-top:16px">Koodhka casuumaadda</h3><div class="ac-code">' + e(u.refCode) + '</div>' +
          '<p class="g-eta">Marka saaxiibkaa qaato dalabkiisa koowaad waxaad heshaa dheeraad; isna wuxuu helayaa 5% dhimis.</p>' +
          '<a class="btn gold full" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent("Garsoore — wax walba hal meel. Ku isticmaal koodhka SOODHAWOW 5% dhimis: https://" + root + "/?ref=" + u.refCode) + '">Ku wadaag WhatsApp</a></div>' +
        '<div class="ac-card"><h3>Ammaanka</h3>' +
          '<button class="btn ghost full" id="acPinBtn">Beddel PIN-ka</button>' +
          '<button class="btn ghost full" id="acOut" style="margin-top:8px">Ka bax</button>' +
          '<p class="g-eta" style="margin-top:10px">Haddii aad taleefanka lumiso, nala soo xidhiidh — waan hakin karnaa akoonka.</p></div>' +
        '<div class="ac-card"><h3>Kale</h3>' +
          '<a class="ac-link" href="orders.html">Dalabyadayda →</a>' +
          '<a class="ac-link" href="cart.html">Dambiisha →</a>' +
          '<a class="ac-link" href="' + other + (biz ? "index.html" : "index.html") + '">' + (biz ? "Garsoore (suuqa)" : "Garsoore Ganacsi") + ' →</a>' +
          (u.role === "staff" || u.role === "admin" ? '<a class="ac-link" href="' + (biz ? "" : other) + 'ops.html">⚙ Hawlgalka →</a>' : "") +
          (u.role === "admin" && real ? '<a class="ac-link" href="' + location.protocol + "//admin." + root + '/">🛡 Console →</a>' : "") + '</div>' +
      '</div></div></div>';
  var pay = p.payMethod || "";
  [].forEach.call($("pPay").children, function (d) { d.onclick = function () { pay = d.dataset.pay; [].forEach.call($("pPay").children, function (x) { x.classList.toggle("on", x === d); }); }; });
  $("acSave").onsubmit = function (ev) { ev.preventDefault(); $("pGo").click(); };
  $("pGo").onclick = function (ev) {
    ev.preventDefault();
    var b = { name: $("pName").value.trim(), city: $("pCity").value.trim(), address: $("pAddr").value.trim(), payMethod: pay || undefined, payPhone: $("pPhone").value.trim() || undefined };
    $("pGo").disabled = true;
    call("POST", "/me", b).then(function (r) { RF.api._set(r.user); toast("✓ Waa la kaydiyay"); draw(app); })
      .catch(function (x) { $("pGo").disabled = false; $("pErr").textContent = x.message; $("pErr").hidden = false; });
  };
  $("acPinBtn").onclick = function () { pinSheet(); };
  $("acOut").onclick = function () { RF.api.logout().then(function () { location.href = "index.html"; }); };
}

function pinSheet() {
  var box = $("modalBox");
  function draw(msg) {
    box.innerHTML = '<div class="g-co"><h2>Beddel PIN-ka</h2>' +
      '<label class="g-lbl">PIN-ka hadda</label><input class="g-in" id="pkOld" type="password" inputmode="numeric" maxlength="6">' +
      '<label class="g-lbl">PIN cusub (4–6 lambar)</label><input class="g-in" id="pkNew" type="password" inputmode="numeric" maxlength="6">' +
      '<div class="g-err sm" id="pkErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
      '<button class="btn g-buy full" id="pkGo">Kaydi</button></div>';
    $("pkGo").onclick = function () {
      RF.api.call("POST", "/auth/pin", { old: $("pkOld").value, pin: $("pkNew").value })
        .then(function () { $("modal").classList.remove("on"); toast("✓ PIN-ka waa la beddelay"); })
        .catch(function (x) { draw(x.message); });
    };
  }
  draw();
  $("modal").classList.add("on");
}
})();
