/* Garsoore API — runs inside the same Worker as the site, so buurwen.com and business.buurwen.com share it.
   Storage: Cloudflare D1 (binding DB, schema in schema.sql).
   Rules that matter for money:
     - The server prices every order from CATALOG (built from the same price() as the browser). Browser prices are ignored.
     - Payment (launch mode): the customer pays the Garsoore merchant number by mobile money and types the transaction
       reference; staff match it against the merchant statement, then the money is "held" (escrow) until pickup.
     - An order completes only when staff enter the customer's 6-digit pickup code (staff never see the code).
*/
import { CATALOG } from "./catalog.gen.js";

/* ---- economics (internal). Change here, redeploy. */
export const ECON = {
  commission: 0.08,        // take rate on domestic sellers' price (seller receives price - commission)
  deliveryFee: 5,          // charged to the customer per checkout (home delivery, Mogadishu)
  deliveryCost: 3.5,       // what a delivery costs Garsoore
  freeDeliveryOver: 150,   // goods subtotal at which delivery becomes free (lifts basket size)
  payFee: 0.01,            // mobile-money merchant fee estimate
  refReward: 5,            // store credit to the referrer when a referred friend collects a first order
  unpaidHours: 24          // unpaid orders expire after this
};
/* Discounts never exceed contribution margin: first-order only, capped. */
const PROMOS = { SOODHAWOW: { pct: 0.05, cap: 10, firstOrder: true } };

const FLOW = {
  china: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY", "COMPLETED"],
  local: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED", "CONFIRMED", "READY", "COMPLETED"]
};
const PAYS = ["EVC Plus", "ZAAD", "Sahal", "Premier Wallet"];
const EVENTS = ["view", "cart", "checkout", "order", "paid", "quote", "search"];

/* ---------------------------------------------------------------- helpers */
const now = () => new Date().toISOString();
const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
const err = (msg, s = 400) => json({ error: msg }, s);
const rid = (p, n = 8) => p + [...crypto.getRandomValues(new Uint8Array(n))].map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const J = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export function normPhone(s) {
  let d = String(s || "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (d.startsWith("00252")) d = d.slice(2);
  if (d.startsWith("0")) d = "252" + d.slice(1);
  if (/^(61|62|63|65|68|69|71|77|90)\d{7}$/.test(d)) d = "252" + d;
  return /^252(61|62|63|65|68|69|71|77|90)\d{7}$/.test(d) ? d : null;
}
const mask = p => p ? "+" + p.slice(0, 3) + " " + p.slice(3, 5) + " ••• " + p.slice(-2) : "";

async function pinHash(pin, salt) {
  salt = salt || hex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return "pbkdf2$100000$" + salt + "$" + hex(bits);
}
async function pinOk(pin, stored) {
  const salt = String(stored).split("$")[2];
  const a = await pinHash(pin, salt);
  if (a.length !== stored.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ stored.charCodeAt(i);
  return x === 0;
}

function cookieDomain(host) {
  if (/^(localhost|127\.|\[)/.test(host) || /(workers|pages)\.dev$/.test(host)) return "";
  return "; Domain=." + host.replace(/^(www|business)\./, "");      // one login for buurwen.com + business.buurwen.com
}
function sessionCookie(url, token, maxAge) {
  return "gs=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (url.protocol === "https:" ? "; Secure" : "") + cookieDomain(url.hostname);
}
async function currentUser(req, env) {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)gs=([a-f0-9]{64})/);
  if (!m) return null;
  const row = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?").bind(await sha(m[1]), now()).first();
  return row || null;
}
async function newSession(env, url, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = new Date(Date.now() + 30 * 864e5).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha(token), userId, exp, now()).run();
  return sessionCookie(url, token, 30 * 86400);
}
const pubUser = u => u && { id: u.id, name: u.name, phone: mask(u.phone), role: u.role, refCode: u.ref_code, credit: u.credit };

function merchants(env) {
  return { "EVC Plus": env.MERCHANT_EVC || "", "ZAAD": env.MERCHANT_ZAAD || "", "Sahal": env.MERCHANT_SAHAL || "", "Premier Wallet": env.MERCHANT_PREMIER || "" };
}

function orderOut(r, staff) {
  const o = {
    id: r.id, basket: r.basket, sku: r.sku, quoteId: r.quote_id, title: r.title, icon: r.icon, variant: r.variant, qty: r.qty, unit: r.unit,
    discount: r.discount, creditUsed: r.credit_used, fee: r.fee, total: r.total, flow: r.flow, state: r.state, etaDays: r.eta_days,
    pickup: r.pickup, pay: r.pay, payTxn: r.pay_txn, escrow: r.escrow, history: J(r.history) || [], dispute: J(r.dispute), review: J(r.review),
    cancelReason: r.cancel_reason, createdAt: r.created_at, completedAt: (J(r.history) || []).filter(h => h.state === "COMPLETED").map(h => h.at)[0] || null
  };
  if (staff) { o.econ = J(r.econ); o.customer = { name: r.u_name, phone: r.u_phone ? "+" + r.u_phone : "" }; o.payPhone = r.pay_phone; o.address = r.address; }
  else o.code = r.code;                       // the customer's own pickup code — never sent to staff views
  return o;
}

async function expireUnpaid(env) {
  const cut = new Date(Date.now() - ECON.unpaidHours * 36e5).toISOString();
  await env.DB.prepare("UPDATE orders SET state = 'EXPIRED', updated_at = ? WHERE state = 'AWAITING_PAYMENT' AND created_at < ?").bind(now(), cut).run();
}

async function body(req) { try { return await req.json(); } catch { return {}; } }

/* ---------------------------------------------------------------- pricing an order (server side) */
async function priceItems(env, user, items) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error("Dambiishu waa madhan tahay.");
  const out = [];
  for (const it of items) {
    const qty = Math.floor(+it.qty || 0);
    if (!(qty >= 1 && qty <= 99)) throw new Error("Tirada alaabta ma saxna.");
    if (it.quote) {
      const q = await env.DB.prepare("SELECT * FROM quotes WHERE id = ? AND status = 'quoted' AND (user_id = ? OR user_id IS NULL)").bind(String(it.quote), user.id).first();
      if (!q) throw new Error("Qiimahan rasmiga ah lama helin ama wuu dhacay.");
      out.push({ sku: "GRS-Q-" + q.id.slice(2), vsku: q.id, quoteId: q.id, title: q.title, icon: q.icon || "📦", variant: "", qty, unit: q.total, etaDays: q.eta_days || 20, flow: "china", cogs: null, quoted: true });
      continue;
    }
    const p = CATALOG[it.sku], v = p && p.variants[Math.floor(+it.vi || 0)];
    if (!p || !v) throw new Error("Alaab lama helin: " + String(it.sku).slice(0, 30));
    if (v.total == null) throw new Error("Alaabtan qiimo rasmi ah weli ma leh — codso qiimo.");
    // launch switch: never sell at a placeholder cost. Unverified products go through a staff quote instead.
    if (env.REQUIRE_VERIFIED === "1" && !p.verified) throw new Error("Qiimaha alaabtan waa la hubinayaa — codso qiimo rasmi ah.");
    out.push({ sku: it.sku, vsku: v.vsku, title: p.title, icon: p.icon, variant: [v.label, v.color].filter(x => x && x !== "—" && x !== "Standard").join(" · "),
      qty, unit: v.total, etaDays: v.local ? 0 : v.etaDays, flow: v.local ? "local" : "china", cogs: v.cogs, seller: p.seller });
  }
  return out;
}
async function promoRate(env, user, code) {
  const p = PROMOS[String(code || "").toUpperCase().replace(/\s+/g, "")];
  if (!p) return null;
  if (p.firstOrder) {
    const prev = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND state NOT IN ('EXPIRED','CANCELLED')").bind(user.id).first();
    if (prev.n > 0) return { error: "Koodhkan waa dalabka koowaad oo keliya." };
  }
  return p;
}

/* ---------------------------------------------------------------- router */
export async function handleApi(req, env, url) {
  if (!env.DB) return err("Database not configured", 503);
  const path = url.pathname.replace(/^\/api/, ""), M = req.method;
  if (M === "POST") {
    // CSRF: JSON only, and the request must come from one of our own pages
    if (!(req.headers.get("content-type") || "").includes("application/json")) return err("JSON only", 415);
    const origin = req.headers.get("origin");
    if (origin) {
      const oh = new URL(origin).hostname, apex = url.hostname.replace(/^(www|business)\./, "");
      if (!(oh === url.hostname || oh === apex || oh.endsWith("." + apex))) return err("Bad origin", 403);
    }
  }
  try {
    const user = await currentUser(req, env);
    const staff = user && user.role === "staff";
    let m;

    if (path === "/health") return json({ ok: true, time: now() });
    if (path === "/config") return json({ requireVerified: env.REQUIRE_VERIFIED === "1", econ: { deliveryFee: ECON.deliveryFee, freeDeliveryOver: ECON.freeDeliveryOver, refReward: ECON.refReward, unpaidHours: ECON.unpaidHours }, merchants: merchants(env), flows: FLOW });
    if (path === "/me") return json({ user: pubUser(user) });

    /* ---- auth: phone + PIN (SMS/WhatsApp OTP is a launch item once a provider is contracted) */
    if (path === "/auth/register" && M === "POST") {
      const b = await body(req), phone = normPhone(b.phone), name = String(b.name || "").trim().slice(0, 60);
      if (!phone) return err("Lambarka taleefanka ma saxna (tusaale 61 5xx xxxx).");
      if (!/^\d{4,6}$/.test(String(b.pin || ""))) return err("PIN-ku waa 4–6 lambar.");
      if (/^(\d)\1+$/.test(b.pin) || "0123456789".includes(b.pin) || "9876543210".includes(b.pin)) return err("PIN-kan aad buu u fudud yahay — dooro mid kale.");
      if (name.length < 2) return err("Ku qor magacaaga.");
      if (await env.DB.prepare("SELECT 1 FROM users WHERE phone = ?").bind(phone).first()) return err("Lambarkan akoon ayuu leeyahay — gal.", 409);
      let ref = null;
      if (b.ref) { const r = await env.DB.prepare("SELECT id FROM users WHERE ref_code = ?").bind(String(b.ref).toUpperCase().trim()).first(); ref = r && r.id; }
      const staffList = String(env.STAFF_PHONES || "").split(",").map(normPhone).filter(Boolean);
      const u = { id: rid("U-"), phone, name, role: staffList.includes(phone) ? "staff" : "customer", ref: rid("", 6) };
      await env.DB.prepare("INSERT INTO users (id, phone, name, pin_hash, role, ref_code, referred_by, credit, created_at) VALUES (?,?,?,?,?,?,?,0,?)")
        .bind(u.id, phone, name, await pinHash(String(b.pin)), u.role, u.ref, ref, now()).run();
      const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
      return json({ user: pubUser(row) }, 200, { "set-cookie": await newSession(env, url, u.id) });
    }
    if (path === "/auth/login" && M === "POST") {
      const b = await body(req), phone = normPhone(b.phone);
      if (!phone) return err("Lambarka taleefanka ma saxna.");
      const since = new Date(Date.now() - 15 * 6e4).toISOString();
      const tries = await env.DB.prepare("SELECT COUNT(*) n FROM login_attempts WHERE phone = ? AND at > ?").bind(phone, since).first();
      if (tries.n >= 5) return err("Isku day badan. Sug 15 daqiiqo.", 429);
      const u = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
      if (!u || !(await pinOk(String(b.pin || ""), u.pin_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (phone, at) VALUES (?, ?)").bind(phone, now()).run();
        return err("Lambarka ama PIN-ka waa khalad.", 401);
      }
      await env.DB.prepare("DELETE FROM login_attempts WHERE phone = ?").bind(phone).run();
      return json({ user: pubUser(u) }, 200, { "set-cookie": await newSession(env, url, u.id) });
    }
    if (path === "/auth/logout" && M === "POST") {
      const mm = (req.headers.get("cookie") || "").match(/(?:^|;\s*)gs=([a-f0-9]{64})/);
      if (mm) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha(mm[1])).run();
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(url, "", 0) });
    }

    /* ---- public: honest social proof + funnel events */
    if (path === "/social" && M === "GET") {
      const sku = url.searchParams.get("sku") || "";
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const b = await env.DB.prepare("SELECT COALESCE(SUM(qty),0) n FROM orders WHERE sku = ? AND created_at > ? AND state NOT IN ('AWAITING_PAYMENT','EXPIRED','CANCELLED')").bind(sku, since).first();
      const rv = await env.DB.prepare("SELECT review FROM orders WHERE sku = ? AND review IS NOT NULL ORDER BY updated_at DESC LIMIT 20").bind(sku).all();
      const reviews = rv.results.map(r => J(r.review)).filter(Boolean);
      return json({ bought30: b.n >= 3 ? b.n : null, reviews });   // below 3 we show nothing: small numbers read as "nobody buys this"
    }
    if (path === "/ev" && M === "POST") {
      const b = await body(req);
      if (EVENTS.includes(b.name)) await env.DB.prepare("INSERT INTO events (name, sku, sid, at) VALUES (?,?,?,?)").bind(b.name, String(b.sku || "").slice(0, 40) || null, String(b.sid || "").slice(0, 40), now()).run();
      return json({ ok: true });
    }

    if (!user) return err("Fadlan gal (login).", 401);

    /* ---- customer: orders */
    if (path === "/promo" && M === "POST") {
      const b = await body(req), p = await promoRate(env, user, b.code);
      if (!p) return err("Koodhkan ma shaqaynayo.");
      if (p.error) return err(p.error);
      return json({ pct: p.pct, cap: p.cap });
    }
    if (path === "/orders" && M === "GET") {
      await expireUnpaid(env);
      const r = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").bind(user.id).all();
      return json({ orders: r.results.map(x => orderOut(x, false)) });
    }
    if (path === "/orders" && M === "POST") {
      const b = await body(req);
      if (!PAYS.includes(b.pay)) return err("Dooro hab lacag bixin.");
      const payPhone = normPhone(b.payPhone);
      if (!payPhone) return err("Ku qor lambar " + b.pay + " sax ah.");
      const delivery = !!b.delivery, address = String(b.address || "").trim().slice(0, 200);
      if (delivery && address.length < 4) return err("Ku qor halka alaabta la keenayo.");
      let items; try { items = await priceItems(env, user, b.items); } catch (x) { return err(x.message); }
      const sub = items.reduce((s, i) => s + i.unit * i.qty, 0);
      let pct = 0, cap = Infinity;
      if (b.promo) { const p = await promoRate(env, user, b.promo); if (!p) return err("Koodhkan ma shaqaynayo."); if (p.error) return err(p.error); pct = p.pct; cap = p.cap; }
      let discLeft = Math.min(Math.round(sub * pct), cap);
      const fee = delivery && sub < ECON.freeDeliveryOver ? ECON.deliveryFee : 0;
      let creditLeft = b.useCredit ? Math.min(user.credit, sub - discLeft + fee) : 0;
      const creditTotal = creditLeft;
      const basket = items.length > 1 ? rid("B-", 6) : null, t = now(), stmts = [], orders = [];
      items.forEach((it, k) => {
        const gross = it.unit * it.qty;
        const disc = k === items.length - 1 ? discLeft : Math.min(discLeft, Math.round(gross * pct)); discLeft -= disc;
        const f = k === 0 ? fee : 0;
        const credit = Math.min(creditLeft, gross - disc + f); creditLeft -= credit;
        const total = gross - disc + f - credit;
        const revenue = it.flow === "local" ? gross * ECON.commission : it.cogs != null ? gross - it.cogs * it.qty : gross * 0.10;
        const deliveryCost = delivery && k === 0 ? ECON.deliveryCost : 0;
        const econ = { revenue: +revenue.toFixed(2), discount: disc, credit, feeIn: f, deliveryCost, payFee: +((total) * ECON.payFee).toFixed(2),
          gross: +(revenue - disc - credit + f - deliveryCost - total * ECON.payFee).toFixed(2), cogs: it.cogs != null ? +(it.cogs * it.qty).toFixed(2) : null, seller: it.seller || null };
        const o = { id: rid("GRS-", 7), code: String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)) };
        stmts.push(env.DB.prepare(`INSERT INTO orders (id,user_id,basket,sku,vsku,quote_id,title,icon,variant,qty,unit,discount,credit_used,fee,total,flow,state,eta_days,pickup,address,pay,pay_phone,escrow,code,econ,history,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(o.id, user.id, basket, it.sku, it.vsku, it.quoteId || null, it.title, it.icon, it.variant, it.qty, it.unit, disc, credit, f, total,
          it.flow, total > 0 ? "AWAITING_PAYMENT" : "PLACED", it.etaDays, delivery ? "Gaarsiin guriga" : "Xarunta Garsoore · Km4, Muqdisho", delivery ? address : null, b.pay, payPhone,
          total > 0 ? "none" : "held", o.code, JSON.stringify(econ), JSON.stringify([{ state: total > 0 ? "AWAITING_PAYMENT" : "PLACED", at: t }]), t, t));
        orders.push(o.id);
      });
      if (creditTotal) stmts.push(env.DB.prepare("UPDATE users SET credit = credit - ? WHERE id = ? AND credit >= ?").bind(creditTotal, user.id, creditTotal));
      stmts.push(env.DB.prepare("INSERT INTO events (name, sid, at) VALUES ('order', ?, ?)").bind(String(b.sid || "").slice(0, 40), t));
      await env.DB.batch(stmts);
      const amount = sub - Math.min(Math.round(sub * pct), cap) + fee - creditTotal;
      return json({ ids: orders, basket, amount, pay: b.pay, merchant: merchants(env)[b.pay] || "", reference: basket || orders[0], expiresHours: ECON.unpaidHours });
    }
    if (path === "/orders/paid" && M === "POST") {
      const b = await body(req), txn = String(b.txn || "").trim();
      if (!/^[A-Za-z0-9\-. ]{4,40}$/.test(txn)) return err("Ku qor lambarka macaamilka (transaction ID) ee fariinta lacagta.");
      const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 20).map(String), t = now();
      const stmts = ids.map(id => env.DB.prepare("UPDATE orders SET state = 'PAYMENT_REVIEW', pay_txn = ?, history = json_insert(history, '$[#]', json(?)), updated_at = ? WHERE id = ? AND user_id = ? AND state = 'AWAITING_PAYMENT'")
        .bind(txn, JSON.stringify({ state: "PAYMENT_REVIEW", at: t }), t, id, user.id));
      stmts.push(env.DB.prepare("INSERT INTO events (name, sid, at) VALUES ('paid', ?, ?)").bind(String(b.sid || "").slice(0, 40), t));
      await env.DB.batch(stmts);
      return json({ ok: true });
    }
    if ((m = path.match(/^\/orders\/(GRS-[A-Z0-9]+)\/(cancel|dispute|review)$/)) && M === "POST") {
      const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(m[1], user.id).first();
      if (!o) return err("Dalab lama helin.", 404);
      const b = await body(req), t = now(), h = J(o.history) || [];
      if (m[2] === "cancel") {
        const ok = ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED"].includes(o.state) || (o.flow === "local" && o.state === "CONFIRMED");
        if (!ok) return err("Dalabkan lama joojin karo hadda — alaabta waa la iibsaday. Fur cabasho marka aad hesho haddii ay dhibaato jirto.");
        const paid = o.escrow === "held" || o.state === "PAYMENT_REVIEW";
        h.push({ state: "CANCELLED", at: t });
        await env.DB.batch([
          env.DB.prepare("UPDATE orders SET state = 'CANCELLED', escrow = ?, cancel_reason = ?, history = ?, updated_at = ? WHERE id = ?").bind(paid ? "refund_due" : "none", String(b.why || "").slice(0, 200), JSON.stringify(h), t, o.id),
          ...(o.credit_used ? [env.DB.prepare("UPDATE users SET credit = credit + ? WHERE id = ?").bind(o.credit_used, user.id)] : [])
        ]);
        return json({ ok: true, refund: paid });
      }
      if (m[2] === "dispute") {
        const done = h.filter(x => x.state === "COMPLETED")[0];
        if (o.state !== "COMPLETED" || o.dispute || !done || Date.now() - Date.parse(done.at) > 7 * 864e5) return err("Cabasho waxaa la furi karaa 7 maalmood gudahood kadib qaadashada.");
        const reason = String(b.reason || "").trim().slice(0, 500); if (reason.length < 5) return err("Sharax dhibaatada.");
        await env.DB.prepare("UPDATE orders SET dispute = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify({ reason, at: t, status: "open" }), t, o.id).run();
        return json({ ok: true });
      }
      if (o.state !== "COMPLETED" || o.review) return err("Faallo waxaa laga bixin karaa alaab aad qaadatay oo keliya.");
      const stars = Math.max(1, Math.min(5, Math.round(+b.stars || 5)));
      await env.DB.prepare("UPDATE orders SET review = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify({ stars, text: String(b.text || "").trim().slice(0, 500), at: t, by: user.name.split(" ")[0] }), t, o.id).run();
      return json({ ok: true });
    }

    /* ---- quotes (customer) */
    if (path === "/quotes" && M === "POST") {
      const b = await body(req), q = { id: rid("Q-", 7) };
      await env.DB.prepare("INSERT INTO quotes (id,user_id,status,title,icon,platform,ref,url,seller,kg,estimate,note,created_at) VALUES (?,?,'pending',?,?,?,?,?,?,?,?,?,?)")
        .bind(q.id, user.id, String(b.title || "Alaab").slice(0, 160), String(b.icon || "📦").slice(0, 8), String(b.platform || "web").slice(0, 20), String(b.ref || "").slice(0, 80),
          /^https?:\/\//.test(b.url || "") ? String(b.url).slice(0, 500) : "", String(b.seller || "").slice(0, 120), +b.kg || null, Number.isFinite(+b.estimate) && b.estimate != null ? Math.round(+b.estimate) : null, String(b.note || "").slice(0, 500), now()).run();
      return json({ id: q.id });
    }
    if (path === "/quotes" && M === "GET") {
      const r = staff && url.searchParams.get("all") ? await env.DB.prepare("SELECT q.*, u.name u_name, u.phone u_phone FROM quotes q LEFT JOIN users u ON u.id = q.user_id ORDER BY q.created_at DESC LIMIT 300").all()
        : await env.DB.prepare("SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
      return json({ quotes: r.results.map(q => ({ id: q.id, status: q.status, title: q.title, icon: q.icon, platform: q.platform, ref: q.ref, url: q.url, seller: q.seller, kg: q.kg, estimate: q.estimate,
        note: q.note, total: q.total, etaDays: q.eta_days, staffNote: q.staff_note, createdAt: q.created_at, quotedAt: q.quoted_at, contact: staff && q.u_name ? q.u_name + " · +" + q.u_phone : undefined })) });
    }

    /* ---------------------------------------------------------------- staff */
    if (!path.startsWith("/ops/")) return err("Not found", 404);
    if (!staff) return err("Shaqaalaha Garsoore oo keliya.", 403);

    if (path === "/ops/orders" && M === "GET") {
      await expireUnpaid(env);
      const st = url.searchParams.get("state");
      const r = st ? await env.DB.prepare("SELECT o.*, u.name u_name, u.phone u_phone FROM orders o JOIN users u ON u.id = o.user_id WHERE o.state = ? ORDER BY o.created_at ASC LIMIT 300").bind(st).all()
        : await env.DB.prepare("SELECT o.*, u.name u_name, u.phone u_phone FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 300").all();
      return json({ orders: r.results.map(x => orderOut(x, true)) });
    }
    if ((m = path.match(/^\/ops\/orders\/(GRS-[A-Z0-9]+)\/(verify|advance|refunded|resolve)$/)) && M === "POST") {
      const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]).first();
      if (!o) return err("Dalab lama helin.", 404);
      const b = await body(req), t = now(), h = J(o.history) || [], by = user.name;
      if (m[2] === "verify") {
        if (o.state !== "PAYMENT_REVIEW") return err("Dalabkan ma sugayo hubinta lacagta.");
        if (b.ok) { h.push({ state: "PLACED", at: t, by }); await env.DB.prepare("UPDATE orders SET state = 'PLACED', escrow = 'held', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id).run(); }
        else { h.push({ state: "AWAITING_PAYMENT", at: t, by, note: "lacag lama helin" }); await env.DB.prepare("UPDATE orders SET state = 'AWAITING_PAYMENT', pay_txn = NULL, history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id).run(); }
        return json({ ok: true });
      }
      if (m[2] === "advance") {
        const f = FLOW[o.flow], i = f.indexOf(o.state);
        if (i < f.indexOf("PLACED") || f[i + 1] === "COMPLETED" || i < 0 || i >= f.length - 1) return err("Tallaabadan halkan lagama qaadi karo (lacag bixin = hubi; qaadasho = koodhka).");
        h.push({ state: f[i + 1], at: t, by });
        await env.DB.prepare("UPDATE orders SET state = ?, history = ?, updated_at = ? WHERE id = ?").bind(f[i + 1], JSON.stringify(h), t, o.id).run();
        return json({ ok: true, state: f[i + 1] });
      }
      if (m[2] === "refunded") {
        if (o.escrow !== "refund_due") return err("Lacag celin lama sugayo.");
        await env.DB.prepare("UPDATE orders SET escrow = 'refunded', updated_at = ? WHERE id = ?").bind(t, o.id).run();
        return json({ ok: true });
      }
      const d = J(o.dispute); if (!d || d.status !== "open") return err("Cabasho furan ma jirto.");
      d.status = b.refund ? "refunded" : "rejected"; d.note = String(b.note || "").slice(0, 300); d.resolvedAt = t; d.by = by;
      await env.DB.prepare("UPDATE orders SET dispute = ?, escrow = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(d), b.refund ? "refund_due" : o.escrow, t, o.id).run();
      return json({ ok: true });
    }
    if (path === "/ops/pickup" && M === "POST") {
      const b = await body(req), code = String(b.code || "").replace(/\D/g, "");
      if (code.length !== 6) return err("Koodhku waa 6 lambar.");
      const o = await env.DB.prepare("SELECT o.*, u.referred_by, u.name u_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.code = ? AND o.state = 'READY'").bind(code).first();
      if (!o) return err("Koodhkan ma laha dalab diyaar ah.", 404);
      const t = now(), h = J(o.history) || []; h.push({ state: "COMPLETED", at: t, by: user.name });
      const stmts = [env.DB.prepare("UPDATE orders SET state = 'COMPLETED', escrow = 'released', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id)];
      let rewarded = false;
      if (o.referred_by) {
        const prev = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND state = 'COMPLETED'").bind(o.user_id).first();
        if (prev.n === 0) { stmts.push(env.DB.prepare("UPDATE users SET credit = credit + ? WHERE id = ?").bind(ECON.refReward, o.referred_by)); rewarded = true; }
      }
      await env.DB.batch(stmts);
      return json({ ok: true, order: { id: o.id, title: o.title, qty: o.qty, customer: o.u_name }, referralPaid: rewarded });
    }
    if ((m = path.match(/^\/ops\/quotes\/(Q-[A-Z0-9]+)$/)) && M === "POST") {
      const b = await body(req), t = now();
      if (b.action === "price") {
        const total = Math.round(+b.total); if (!(total > 0)) return err("Ku qor qiimo sax ah.");
        await env.DB.prepare("UPDATE quotes SET status = 'quoted', total = ?, eta_days = ?, staff_note = ?, quoted_at = ? WHERE id = ? AND status = 'pending'").bind(total, Math.max(1, Math.round(+b.etaDays || 20)), String(b.note || "").slice(0, 300), t, m[1]).run();
      } else await env.DB.prepare("UPDATE quotes SET status = 'declined', staff_note = ?, quoted_at = ? WHERE id = ? AND status = 'pending'").bind(String(b.note || "Alaabtan ma keeni karno.").slice(0, 300), t, m[1]).run();
      return json({ ok: true });
    }
    if (path === "/ops/stats" && M === "GET") {
      const days = Math.min(365, Math.max(1, +url.searchParams.get("days") || 30)), since = new Date(Date.now() - days * 864e5).toISOString();
      const rows = (await env.DB.prepare("SELECT state, total, econ, escrow, dispute FROM orders WHERE created_at > ?").bind(since).all()).results;
      const paid = rows.filter(r => !["AWAITING_PAYMENT", "PAYMENT_REVIEW", "EXPIRED", "CANCELLED"].includes(r.state));
      const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
      const byState = {}; rows.forEach(r => byState[r.state] = (byState[r.state] || 0) + 1);
      const ev = (await env.DB.prepare("SELECT name, COUNT(DISTINCT sid) n FROM events WHERE at > ? GROUP BY name").bind(since).all()).results;
      const funnel = {}; ev.forEach(r => funnel[r.name] = r.n);
      const q = await env.DB.prepare("SELECT COUNT(*) n, MIN(created_at) oldest FROM quotes WHERE status = 'pending'").first();
      const users = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
      const cat = Object.values(CATALOG), catalog = { products: cat.length, verified: cat.filter(p => p.verified).length, requireVerified: env.REQUIRE_VERIFIED === "1" };
      return json({ days, orders: rows.length, paidOrders: paid.length, gmv: sum(paid, r => r.total), revenue: +sum(paid, r => (J(r.econ) || {}).revenue || 0).toFixed(2),
        gross: +sum(paid, r => (J(r.econ) || {}).gross || 0).toFixed(2), aov: paid.length ? Math.round(sum(paid, r => r.total) / paid.length) : 0,
        held: sum(rows.filter(r => r.escrow === "held"), r => r.total), refundDue: sum(rows.filter(r => r.escrow === "refund_due"), r => r.total),
        openDisputes: rows.filter(r => (J(r.dispute) || {}).status === "open").length, byState, funnel, pendingQuotes: q.n, oldestQuote: q.oldest, users: users.n, econ: ECON, catalog });
    }
    return err("Not found", 404);
  } catch (x) {
    return err("Server error: " + (x && x.message || x), 500);
  }
}
