/* Garsoore — browser client for the shared API (deploy/api.js).
   RF.api      : low-level calls, current user, funnel events
   RF.backend  : what the shop uses — same promise-based interface whether the API is there (live site / wrangler dev)
                 or not (plain static server: falls back to the browser-only RF.orders / RF.quotes demo).
   RF.authUI   : phone + PIN sign-in / sign-up sheet. Your phone number IS your account. */
(function () {
var RF = window.RF = window.RF || {};
function e(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function sid() { try { var s = localStorage.getItem("garsoore.sid"); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("garsoore.sid", s); } return s; } catch (x) { return ""; } }
/* ?ref=CODE on any link → remembered until sign-up */
try { var rf = new URLSearchParams(location.search).get("ref"); if (rf) localStorage.setItem("garsoore.ref", rf.toUpperCase()); } catch (x) {}

function call(method, path, data) {
  return fetch("/api" + path, { method: method, credentials: "same-origin", headers: data ? { "content-type": "application/json" } : {}, body: data ? JSON.stringify(data) : undefined })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var x = new Error(j.error || ("HTTP " + r.status)); x.status = r.status; throw x; }
        return j;
      });
    });
}
var listeners = [];
var api = RF.api = {
  remote: false, user: null, config: null,
  call: call,
  onUser: function (f) { listeners.push(f); if (api.checked) f(api.user); },
  _set: function (u) { api.user = u || null; if (u && RF.identity) RF.identity.set(u.name); listeners.forEach(function (f) { f(api.user); }); },
  login: function (phone, pin) { return call("POST", "/auth/login", { phone: phone, pin: pin }).then(function (j) { api._set(j.user); return j.user; }); },
  register: function (name, phone, pin) { var ref = ""; try { ref = localStorage.getItem("garsoore.ref") || ""; } catch (x) {}
    return call("POST", "/auth/register", { name: name, phone: phone, pin: pin, ref: ref }).then(function (j) { api._set(j.user); return j.user; }); },
  logout: function () { return call("POST", "/auth/logout", {}).then(function () { api._set(null); }); },
  refresh: function () { return call("GET", "/me").then(function (j) { api._set(j.user); return j.user; }); },
  ev: function (name, sku) { api.ready.then(function (on) { if (on) call("POST", "/ev", { name: name, sku: sku || "", sid: sid() }).catch(function () {}); }); },
  sid: sid
};
/* is there an API behind this page? (static dev server → no) */
api.ready = fetch("/api/health", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  .then(function (h) {
    api.remote = !!(h && h.ok);
    if (!api.remote) { api.checked = true; listeners.forEach(function (f) { f(null); }); return false; }
    return Promise.all([call("GET", "/me"), call("GET", "/config")]).then(function (a) { api.config = a[1]; api.checked = true; api._set(a[0].user); return true; })
      .catch(function () { api.checked = true; return true; });
  });

/* ---------------------------------------------------------------- RF.backend: one interface, two implementations */
function P(v) { return Promise.resolve(v); }
var local = {
  orders: function () { return P(RF.orders.list()); },
  place: function (items, st) {
    var basket = items.length > 1 ? "B-" + Date.now().toString(36).toUpperCase() : null;
    var ids = items.map(function (it) { return RF.orders.place(it.product, it.variant, { delivery: st.delivery, pay: st.pay, phone: st.payPhone, qty: it.line.qty, discount: st.disc || 0, basket: basket, address: st.address }).id; });
    return P({ ids: ids, local: true });
  },
  paid: function () { return P({ ok: true }); },
  evc: function () { return P({ ok: true, txn: "DEMO" }); },
  cancel: function (id, why) { return P(RF.orders.cancel(id, why)); },
  dispute: function (id, r) { return P(RF.orders.dispute(id, r)); },
  review: function (id, s, t) { return P(RF.orders.review(id, s, t)); },
  quotes: function () { return P(RF.quotes.list()); },
  quote: function (id) { return P(RF.quotes.list().filter(function (x) { return x.id === id; })[0] || null); },
  requestQuote: function (p) { return P(RF.quotes.request(p)); },
  requestLink: function (id, url, seen, extra) { return P(RF.quotes.requestLink(id, url, seen, extra)); },
  social: function (sku) { return P({ bought30: null, reviews: RF.orders.reviewsFor(sku) }); },
  listings: function () { return P([]); },
  promo: function (code) { var r = RF.promo.check(code); return r ? P({ pct: r, cap: 10 }) : Promise.reject(new Error("Koodhkan ma shaqaynayo.")); }
};
function quoteBody(p) {
  var src = p.sources[0], pr = RF.catalog.price(p, p.variants[0]);
  return { title: (p.brand ? p.brand + " " : "") + p.model, icon: p.icon, platform: src.channel, ref: src.ref, url: p.pageUrl || (RF.sources ? RF.sources.ADAPTERS[src.channel].url(src.ref) : ""),
    seller: src.seller || "", kg: p.kg, estimate: pr.total };
}
var remote = {
  orders: function () { return call("GET", "/orders").then(function (j) { return j.orders; }); },
  place: function (items, st) {
    /* `mode` is the air/sea lane the customer chose. The server prices that lane itself and records the rate card;
       we send the choice, never the price. */
    return call("POST", "/orders", { items: items.map(function (it) { return { sku: it.product.sku, vi: it.product.variants.indexOf(it.variant), qty: it.line.qty, quote: it.line.quote || null, fbg: it.product.fbg ? it.product.sku : null, mode: it.line.mode || (it.price && it.price.mode) || null }; }),
      delivery: st.delivery, address: st.address, pay: st.pay, payPhone: st.payPhone, promo: st.discCode || "", useCredit: !!st.useCredit, sid: sid() });
  },
  paid: function (ids, txn) { return call("POST", "/orders/paid", { ids: ids, txn: txn, sid: sid() }); },
  /* the wallet pushes a PIN prompt to the customer's own handset; we only ever send an amount and a number */
  evc: function (ids, phone) { return call("POST", "/orders/evc", { ids: ids, phone: phone, sid: sid() }); },
  cancel: function (id, why) { return call("POST", "/orders/" + id + "/cancel", { why: why }); },
  dispute: function (id, r) { return call("POST", "/orders/" + id + "/dispute", { reason: r }); },
  review: function (id, s, t) { return call("POST", "/orders/" + id + "/review", { stars: s, text: t }); },
  quotes: function () { return call("GET", "/quotes").then(function (j) { return j.quotes; }); },
  quote: function (id) { return remote.quotes().then(function (a) { return a.filter(function (x) { return x.id === id; })[0] || null; }); },
  requestQuote: function (p) { return call("POST", "/quotes", quoteBody(p)); },
  requestLink: function (id, url, seen, extra) {
    /* `seen` is whatever we could read from the source page (real title, photo, shop) — it saves staff a lookup.
       `extra` carries the buy-for-me services the buyer ticked; the server re-prices them, it does not trust these. */
    return call("POST", "/quotes", { title: (seen && seen.title) || ("Alaab ka timid " + (RF.chName ? RF.chName(id.platform) : id.platform)),
      icon: "📦", platform: id.platform, ref: id.ref, url: url, seller: (seen && seen.seller) || "",
      services: (extra && extra.services) || [], qty: (extra && extra.qty) || 1,
      note: seen && seen.image ? "Sawir: " + seen.image : "" }); },
  social: function (sku) { return call("GET", "/social?sku=" + encodeURIComponent(sku)); },
  listings: function () { return call("GET", "/listings").then(function (j) { return j.listings; }); },
  promo: function (code) { return call("POST", "/promo", { code: code }); }
};
RF.backend = {};
Object.keys(local).forEach(function (k) {
  RF.backend[k] = function () { var a = arguments; return api.ready.then(function () { return (api.remote ? remote : local)[k].apply(null, a); }); };
});
/* run f once signed in (opens the sign-in sheet if needed). Local mode: no accounts, just run. */
RF.backend.needUser = function (why) {
  return api.ready.then(function () { return !api.remote || api.user ? api.user : RF.authUI.open(why); });
};

/* forced PIN change after an admin issues a temporary one */
RF.pinGate = function () {
  if (!RF.api || !RF.api.user || !RF.api.user.mustChangePin) return;
  var box = document.getElementById("modalBox");
  function draw(msg) {
    box.innerHTML = '<div class="g-co"><h2>Beddel PIN-kaaga</h2><div class="g-sku">PIN-kaagu waa mid ku meel gaadh ah oo maamulku bixiyay.</div>' +
      '<label class="g-lbl">PIN cusub (4–6 lambar)</label><input class="g-in" id="pgNew" type="password" inputmode="numeric" maxlength="6">' +
      '<div class="g-err sm" id="pgErr"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
      '<button class="btn g-buy full" id="pgGo">Kaydi</button></div>';
    document.getElementById("pgGo").onclick = function () {
      RF.api.call("POST", "/auth/pin", { pin: document.getElementById("pgNew").value })
        .then(function () { document.getElementById("modal").classList.remove("on"); RF.api.refresh(); alert("PIN-ka waa la beddelay"); })
        .catch(function (x) { draw(x.message); });
    };
  }
  draw();
  document.getElementById("modal").classList.add("on");
};


/* ---------------------------------------------------------------- notifications bell
   Polled once per page load (and when opened). No push provider yet: this is the record people can check, and the
   ops console can also send the same message to their WhatsApp in one tap. */
RF.bell = {
  mount: function (host) {
    if (!host) return;
    if (!api.checked) return void api.ready.then(function () { RF.bell.mount(host); });   /* health check still in flight */
    if (!api.remote) return;
    host.insertAdjacentHTML("beforeend", '<button class="btn ghost bellbtn" id="bellBtn" aria-label="Ogeysiisyo">\ud83d\udd14<span id="bellN"></span></button>' +
      '<div class="bell-panel" id="bellPanel" hidden></div>');
    var btn = document.getElementById("bellBtn"), panel = document.getElementById("bellPanel");
    function badge(n) { var el = document.getElementById("bellN"); el.textContent = n || ""; el.className = n ? "n" : ""; }
    function load(open) {
      call("GET", "/notifications").then(function (j) {
        badge(j.unread);
        if (!open) return;
        panel.innerHTML = j.items.length ? j.items.map(function (x) {
          var t = new Date(x.at), ago = Math.round((Date.now() - t) / 6e4);
          return '<a class="bell-row' + (x.read ? "" : " new") + '" href="' + (x.href || "#") + '">' +
            '<b>' + esc(x.title) + '</b><span>' + esc(x.body || "") + '</span>' +
            '<i>' + (ago < 60 ? ago + " daq" : ago < 1440 ? Math.round(ago / 60) + " saac" : Math.round(ago / 1440) + " maalin") + ' kahor</i></a>';
        }).join("") : '<div class="bell-empty">Weli ogeysiis ma jiro.</div>';
        if (j.unread) call("POST", "/notifications/read", {}).then(function () { badge(0); });
      }).catch(function () {});
    }
    btn.onclick = function (ev) { ev.stopPropagation(); panel.hidden = !panel.hidden; if (!panel.hidden) load(true); };
    document.addEventListener("click", function () { panel.hidden = true; });
    panel.onclick = function (ev) { ev.stopPropagation(); };
    api.onUser(function (u) { btn.hidden = !u; if (u) load(false); });
  }
};
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

/* ---------------------------------------------------------------- sign-in sheet */
RF.authUI = {
  open: function (why) {
    return new Promise(function (resolve, reject) {
      var box = document.getElementById("modalBox"), modal = document.getElementById("modal"), mode = "login";
      function draw(msg) {
        box.innerHTML = '<div class="g-co g-auth"><h2>' + (mode === "login" ? "Gal" : "Samee akoon") + '</h2>' +
          '<div class="g-sku">' + e(why || "Lambarkaaga taleefanku waa akoonkaaga — hal akoon Garsoore iyo Ganacsi.") + '</div>' +
          '<form id="auF">' + (mode === "join" ? '<label class="g-lbl">Magacaaga</label><input class="g-in" id="auN" autocomplete="name" placeholder="Magaca oo buuxa">' : "") +
          '<label class="g-lbl">Lambarka taleefanka</label><input class="g-in" id="auP" inputmode="tel" autocomplete="tel" placeholder="61 5xx xxxx">' +
          '<label class="g-lbl">PIN (4–6 lambar)</label><input class="g-in" id="auK" type="password" inputmode="numeric" autocomplete="' + (mode === "login" ? "current-password" : "new-password") + '" maxlength="6" placeholder="••••">' +
          '<div class="g-err sm" id="auE"' + (msg ? "" : " hidden") + '>' + e(msg || "") + '</div>' +
          '<button class="btn g-buy full" id="auGo">' + (mode === "login" ? "Gal" : "Samee akoon") + '</button></form>' +
          '<div class="g-eta" style="margin-top:12px;text-align:center">' + (mode === "login" ? 'Akoon ma lihid? <a href="#" id="auSw">Samee mid — 20 ilbiriqsi</a>' : 'Akoon ma leedahay? <a href="#" id="auSw">Gal</a>') + '</div>' +
          (mode === "login" ? '<div class="g-eta" style="margin-top:6px;text-align:center"><a href="#" id="auForgot">PIN-ka ma illowday?</a></div>' : "") +
          '<div class="g-escrow">🔒 PIN-kaaga cid kale lama wadaagto — shaqaalaha Garsoore weligood kuma weydiin doonaan.</div></div>';
        document.getElementById("auSw").onclick = function (ev) { ev.preventDefault(); mode = mode === "login" ? "join" : "login"; draw(); };
        /* No email means no reset link. A person rings you back instead — so all this does is put the request in
           front of staff, and it says the same thing whether or not the number has an account. */
        if (document.getElementById("auForgot")) document.getElementById("auForgot").onclick = function (ev) {
          ev.preventDefault();
          var ph = document.getElementById("auP").value.trim();
          if (!ph) { draw("Marka hore ku qor lambarkaaga taleefanka."); return; }
          call("POST", "/auth/forgot", { phone: ph }).then(function (j) {
            box.innerHTML = '<div class="g-co g-auth"><h2>Waan ku soo wacaynaa</h2>' +
              '<div class="g-sku">' + e(j.message) + '</div>' +
              '<div class="g-escrow">🔒 Shaqaaluhu weligood kuma weydiin doonaan PIN-kaaga hore — mid cusub ayay ku siin doonaan, adiguna waad beddelan doontaa markaad gasho.</div>' +
              '<button class="btn ghost full" id="auBack" style="margin-top:14px">Ku laabo</button></div>';
            document.getElementById("auBack").onclick = function () { draw(); };
          }).catch(function (x) { draw(x.message); });
        };
        document.getElementById("auF").onsubmit = function (ev) {
          ev.preventDefault();
          var ph = document.getElementById("auP").value, pin = document.getElementById("auK").value, go = document.getElementById("auGo");
          go.disabled = true; go.textContent = "…";
          (mode === "login" ? api.login(ph, pin) : api.register(document.getElementById("auN").value, ph, pin))
            .then(function (u) { modal.classList.remove("on"); done = true; resolve(u); })
            .catch(function (x) { if (x.status === 409) mode = "login"; draw(x.message); });
        };
        (document.getElementById(mode === "join" ? "auN" : "auP") || {}).focus && document.getElementById(mode === "join" ? "auN" : "auP").focus();
      }
      var done = false;
      draw();
      modal.classList.add("on");
      /* closing the sheet = cancelled */
      var obs = new MutationObserver(function () { if (!modal.classList.contains("on")) { obs.disconnect(); if (!done) reject(new Error("cancelled")); } });
      obs.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });
  }
};
})();
