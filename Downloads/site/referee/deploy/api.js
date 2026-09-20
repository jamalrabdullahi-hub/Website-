/* Garsoore API — runs inside the same Worker as the site, so buurwen.com and business.buurwen.com share it.
   Storage: Cloudflare D1 (binding DB, schema in schema.sql).
   Rules that matter for money:
     - The server prices every order from CATALOG (built from the same price() as the browser). Browser prices are ignored.
     - Payment (launch mode): the customer pays the Garsoore merchant number by mobile money and types the transaction
       reference; staff match it against the merchant statement, then the money is "held" (escrow) until pickup.
     - An order completes only when staff enter the customer's 6-digit pickup code (staff never see the code).
*/
import { CATALOG } from "./catalog.gen.js";
import { RATES } from "./rates.gen.js";

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
/* ---- buy-for-me (Wakiil Iibsi): the customer pays Garsoore, Garsoore buys from the Chinese vendor on their behalf.
   The goods belong to the buyer from the moment we pay the vendor; what Garsoore sells is the buying, the checking and
   the rail. Fees are flat and published — a buyer must be able to work out the bill before they commit.
   Basic photo inspection is free on purpose: it is what makes buying blind from a link survivable. */
export const SERVICES = {
  buyFeePct: 5,            // service fee on the vendor's price for placing and chasing the order
  buyFeeMin: 3,            // ...but never less than this, because a small order costs the same effort
  items: {
    inspect:       { so: "Hubin muuqaal + sawiro", en: "Visual check + photos",   price: 0, note: "Bilaash" },
    count:         { so: "Tirin iyo cabbir",       en: "Count + measure",         price: 2 },
    test:          { so: "Tijaabo shaqayn",        en: "Powered function test",   price: 5 },
    video:         { so: "Muuqaal furitaan",       en: "Unboxing video",          price: 4 },
    repack:        { so: "Dib-u-xidhmo adag",      en: "Reinforced repack",       price: 3 },
    removeInvoice: { so: "Ka saar qiimaha",        en: "Remove vendor invoice",   price: 1 },
    qcReport:      { so: "Warbixin QC qoran",      en: "Written QC report",       price: 8 }
  }
};
/* What the chosen services come to. Unknown keys are ignored rather than trusted — the browser does not set prices. */
function serviceFee(keys) {
  const seen = {};
  return (Array.isArray(keys) ? keys : []).reduce((sum, k) => {
    const it = SERVICES.items[k];
    if (!it || seen[k]) return sum;
    seen[k] = 1;
    return sum + it.price;
  }, 0);
}

/* Discounts never exceed contribution margin: first-order only, capped. */
const PROMOS = { SOODHAWOW: { pct: 0.05, cap: 10, firstOrder: true } };

const FLOW = {
  china: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED", "SOURCING", "IN_TRANSIT", "ARRIVED", "READY", "COMPLETED"],
  local: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "PLACED", "CONFIRMED", "READY", "COMPLETED"]
};
const PAYS = ["EVC Plus", "ZAAD", "Sahal", "Premier Wallet"];
const EVENTS = ["view", "cart", "checkout", "order", "paid", "quote", "search"];

/* account types. staff and admin both reach the ops console; only admin reaches the admin panel. */
const ROLES = {
  consumer: "Macmiil",
  business: "Ganacsi",
  agent: "Wakiil",
  staff: "Shaqaale Garsoore",
  admin: "Maamule"
};
const BIZ_KINDS = {
  seller: "Iibiye (alaabtiisa ayuu iibinayaa)",
  fbg: "FBG — alaabta Garsoore ayaa u haysa oo u diraya",
  buyer: "Iibsade jumlo",
  supplier: "Alaab-qeybiye / warshad",
  logistics: "Rar iyo gaarsiin"
};
const bizOut = b => ({ id: b.id, company: b.company, kind: b.kind, kindName: BIZ_KINDS[b.kind] || b.kind, city: b.city,
  regNo: b.reg_no, contact: b.contact, commission: b.commission, status: b.status, note: b.note, createdAt: b.created_at });

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
  return "; Domain=." + host.replace(/^(www|business|admin)\./, "");      // one login across buurwen.com, business. and admin.
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
const pubUser = u => u && { id: u.id, name: u.name, phone: mask(u.phone), role: u.role, refCode: u.ref_code, credit: u.credit,
  status: u.status || "active", mustChangePin: !!u.must_change_pin,
  /* saved details, so nobody types their address twice (only ever sent to the person themselves) */
  profile: { city: u.city || "", address: u.address || "", payMethod: u.pay_method || "", payPhone: u.pay_phone || "", phoneFull: "+" + u.phone, joined: u.created_at } };

function merchants(env) {
  return { "EVC Plus": env.MERCHANT_EVC || "", "ZAAD": env.MERCHANT_ZAAD || "", "Sahal": env.MERCHANT_SAHAL || "", "Premier Wallet": env.MERCHANT_PREMIER || "" };
}

function orderOut(r, staff) {
  const o = {
    id: r.id, basket: r.basket, sku: r.sku, quoteId: r.quote_id, title: r.title, icon: r.icon, variant: r.variant, qty: r.qty, unit: r.unit,
    discount: r.discount, creditUsed: r.credit_used, fee: r.fee, total: r.total, flow: r.flow, state: r.state, etaDays: r.eta_days,
    /* the lane the customer chose and the window they were promised. The rate card id stays out of the customer
       payload — it is an internal contract reference, and staff read it from the console. */
    shipMode: r.ship_mode || null, transitMin: r.transit_min || null, transitMax: r.transit_max || null,
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

/* A notification is a fact the person would otherwise have to discover by refreshing. Returns a statement so it can
   ride along in the same batch as the change that caused it — no notification without the event, and none lost. */
function notify(env, userId, kind, title, bodyText, href) {
  return env.DB.prepare("INSERT INTO notifications (id, user_id, at, kind, title, body, href) VALUES (?,?,?,?,?,?,?)")
    .bind(rid("N-", 8), userId, now(), kind, String(title).slice(0, 120), String(bodyText || "").slice(0, 300), href || null);
}


/* ---- FBG (Fulfilment by Garsoore): the importer owns the goods, Garsoore is paid for the rail around them.
   Fees are charged to the importer's ledger as the goods move; the commission is taken only when something sells. */
export const FBG = {
  receivingPerCarton: 1.5,   // scan, photograph, weigh, put away at the China facility
  storagePerCbmDay: 0.35,    // Mogadishu warehouse
  freeStorageDays: 30,
  airPerKg: 7.5,             // charged on consolidated freight (same rates as the catalogue build-up)
  seaPerKg: 1.1,
  pickPack: 1,               // per order picked and handed over in Mogadishu
  commissionPct: 10,         // Garsoore's cut when FBG stock sells on the marketplace
  chinaCity: "Guangzhou"
};
function chinaAddress(env, suite) {
  return env.FBG_CHINA_ADDRESS
    ? String(env.FBG_CHINA_ADDRESS).replace("{suite}", suite)
    : "(dev) Cinwaanka bakhaarka Shiinaha weli lama dejin — ha dirin alaab. Kood: " + suite;
}
const FX = 7.2;                       // CNY per USD — the rate the catalogue prices were built with
const procOut = r => ({ id: r.id, orderId: r.order_id, sku: r.sku, title: r.title, qty: r.qty, platform: r.platform,
  sourceUrl: r.source_url, supplier: r.supplier, targetCny: r.target_cny, paidCny: r.paid_cny, tracking: r.tracking,
  cartons: r.cartons, kg: r.kg, cbm: r.cbm, consignment: r.consignment, state: r.state, note: r.note,
  history: J(r.history) || [], createdAt: r.created_at, customer: r.u_name ? { name: r.u_name, phone: "+" + r.u_phone } : null,
  orderState: r.o_state, orderTotal: r.o_total });
const inboundOut = r => ({ id: r.id, supplier: r.supplier, platform: r.platform, tracking: r.tracking, title: r.title,
  qtyExpected: r.qty_expected, qtyReceived: r.qty_received, value: r.value_usd, disposition: r.disposition, state: r.state,
  cartons: r.cartons, kg: r.kg, cbm: r.cbm, photos: J(r.photos) || [], problem: r.problem, consignment: r.consignment,
  history: J(r.history) || [], createdAt: r.created_at, updatedAt: r.updated_at });
const invOut = r => ({ id: r.id, inboundId: r.inbound_id, title: r.title, cat: r.cat, icon: r.icon, image: r.image,
  qtyTotal: r.qty_total, qtyAvailable: r.qty_available, qtyReserved: r.qty_reserved, qtySold: r.qty_sold,
  landedUnit: r.landed_unit, price: r.price, disposition: r.disposition, mandateId: r.mandate_id, location: r.location,
  note: r.note, createdAt: r.created_at });

/* ---- agents: how a mandate's spread is divided (see docs/DOCTRINE.md — the agent's incentive is visible to everyone) */
export const AGENT = {
  capLiquidity: 15,     // liquidity mandate: the agent may price at most this % past the principal's floor
  capMargin: 40,        // margin mandate: more room, because the principal shares the upside
  platformPct: 10,      // Garsoore's cut OF THE SPREAD (never of the principal's floor)
  sellerPctMin: 25,     // limits on the principal's share of the spread in a margin mandate
  sellerPctMax: 80,
  defaultDays: 14
};
/* sell: buyer pays `price`, principal keeps floor + share of the spread.
   buy:  principal pays no more than floor; the saving below it is the spread, split the same way. */
function settle(md, price) {
  const spread = Math.max(0, md.side === "sell" ? price - md.floor : md.floor - price);
  const platform = Math.round(spread * AGENT.platformPct) / 100;
  const rest = spread - platform;
  const principal = Math.round(rest * md.seller_pct) / 100;
  const agent = Math.round((rest - principal) * 100) / 100;
  return { price, spread: +spread.toFixed(2), platform: +platform.toFixed(2), principalSpread: +principal.toFixed(2),
           principalTotal: +((md.side === "sell" ? md.floor : price) + (md.side === "sell" ? principal : 0)).toFixed(2),
           principalPays: md.side === "buy" ? +(price + 0).toFixed(2) : null, agent: agent };
}
function mandateOut(r) {
  return { id: r.id, side: r.side, mode: r.mode, title: r.title, cat: r.cat, qty: r.qty, unit: r.unit, floor: r.floor,
    capPct: r.cap_pct, sellerPct: r.seller_pct, ask: r.ask, city: r.city, notes: r.notes, state: r.state,
    bestOffer: r.best_offer, dealPrice: r.deal_price, split: J(r.split), expiresAt: r.expires_at, createdAt: r.created_at,
    updatedAt: r.updated_at, agentName: r.a_name || null, principal: r.u_name || null };
}

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
    if (it.fbg) {                      // someone else's stock, held in the Garsoore warehouse (FBG)
      const iv = await env.DB.prepare("SELECT * FROM fbg_inventory WHERE id = ? AND disposition = 'listed'").bind(String(it.fbg)).first();
      if (!iv) return Promise.reject(new Error("Alaabtan hadda lama iibinayo."));
      if (iv.qty_available < qty) throw new Error("Kaydka: " + iv.qty_available + " ayaa hadhay.");
      if (iv.user_id === user.id) throw new Error("Alaabtaada adigu ma iibsan kartid.");
      out.push({ sku: iv.id, vsku: null, fbgId: iv.id, ownerId: iv.user_id, title: iv.title, icon: iv.icon || "📦", variant: "",
        qty, unit: iv.price, etaDays: 0, flow: "local", cogs: null, seller: "FBG" });
      continue;
    }
    const p = CATALOG[it.sku], v = p && p.variants[Math.floor(+it.vi || 0)];
    if (!p || !v) throw new Error("Alaab lama helin: " + String(it.sku).slice(0, 30));
    if (v.total == null) throw new Error("Alaabtan qiimo rasmi ah weli ma leh — codso qiimo.");
    // launch switch: never sell at a placeholder cost. Unverified products go through a staff quote instead.
    if (env.REQUIRE_VERIFIED === "1" && !p.verified) throw new Error("Qiimaha alaabtan waa la hubinayaa — codso qiimo rasmi ah.");
    /* The customer picks air or sea; the server prices that lane from its own copy of the catalogue and records which
       rate card produced the number. A lane the browser asks for that this product does not have is refused rather
       than silently swapped, because a silent swap is how somebody pays for air and waits six weeks. */
    const want = it.mode === "air" || it.mode === "sea" ? it.mode : null;
    const lane = v.lanes && (v.lanes[want || v.mode] || null);
    if (want && v.lanes && !v.lanes[want]) throw new Error("Habkan rarka alaabtan looma heli karo.");
    const unit = lane ? lane.total : v.total;
    out.push({ sku: it.sku, vsku: v.vsku, title: p.title, icon: p.icon, variant: [v.label, v.color].filter(x => x && x !== "—" && x !== "Standard").join(" · "),
      qty, unit, etaDays: v.local ? 0 : (lane ? lane.transitMax : v.etaDays), flow: v.local ? "local" : "china",
      cogs: lane ? lane.cogs : v.cogs, seller: p.seller,
      shipMode: v.local ? null : (lane ? (want || v.mode) : null), rateCardId: lane ? lane.rateCardId : null,
      shipCost: lane ? lane.cost : null, transitMin: lane ? lane.transitMin : null, transitMax: lane ? lane.transitMax : null });
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
      let oh = ""; try { oh = new URL(origin).hostname; } catch { return err("Bad origin", 403); }
      const apex = url.hostname.replace(/^(www|business|admin)\./, "");
      if (!(oh === url.hostname || oh === apex || oh.endsWith("." + apex))) return err("Bad origin", 403);
    }
  }
  try {
    const user = await currentUser(req, env);
    const staff = user && (user.role === "staff" || user.role === "admin");
    let m;

    if (path === "/health") return json({ ok: true, time: now() });
    if (path === "/config") return json({ requireVerified: env.REQUIRE_VERIFIED === "1", agent: AGENT, fbg: FBG, services: SERVICES,
      /* the lanes a customer may choose, and nothing about who flies or sails them */
      shipping: { lanes: RATES.cards.filter(c => c.status !== "expired").map(c => ({ mode: c.mode, transitMin: c.transitMinDays, transitMax: c.transitMaxDays })),
        facility: "Garsoore China Facility · Guangzhou" }, econ: { deliveryFee: ECON.deliveryFee, freeDeliveryOver: ECON.freeDeliveryOver, refReward: ECON.refReward, unpaidHours: ECON.unpaidHours }, merchants: merchants(env), flows: FLOW });
    if (path === "/me" && M === "GET") return json({ user: pubUser(user) });

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
      const adminList = String(env.ADMIN_PHONES || "").split(",").map(normPhone).filter(Boolean);
      const role = adminList.includes(phone) ? "admin" : staffList.includes(phone) ? "staff" : "consumer";
      const u = { id: rid("U-"), phone, name, role, ref: rid("", 6) };
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
      if (u && u.status === "suspended") return err("Akoonkan waa la hakiyay. La xidhiidh Garsoore.", 403);
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

    /* public: FBG stock for sale on the consumer marketplace (local goods, ready today) */
    if (path === "/listings" && M === "GET") {
      const r = await env.DB.prepare(`SELECT i.id, i.title, i.cat, i.icon, i.image, i.price, i.qty_available, u.name seller
        FROM fbg_inventory i JOIN users u ON u.id = i.user_id
        WHERE i.disposition = 'listed' AND i.qty_available > 0 AND i.price > 0 ORDER BY i.updated_at DESC LIMIT 200`).all();
      return json({ listings: r.results.map(x => ({ id: x.id, title: x.title, cat: x.cat || "HOM", icon: x.icon || "📦", image: x.image || "",
        price: x.price, qty: x.qty_available, seller: x.seller })) });
    }

    if (!user) return err("Fadlan gal (login).", 401);
    if (user.status === "suspended") return err("Akoonkan waa la hakiyay.", 403);

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
        const revenue = it.fbgId ? gross * FBG.commissionPct / 100 + FBG.pickPack
          : it.flow === "local" ? gross * ECON.commission : it.cogs != null ? gross - it.cogs * it.qty : gross * 0.10;
        const deliveryCost = delivery && k === 0 ? ECON.deliveryCost : 0;
        const econ = { revenue: +revenue.toFixed(2), discount: disc, credit, feeIn: f, deliveryCost, payFee: +((total) * ECON.payFee).toFixed(2),
          gross: +(revenue - disc - credit + f - deliveryCost - total * ECON.payFee).toFixed(2), cogs: it.cogs != null ? +(it.cogs * it.qty).toFixed(2) : null, seller: it.seller || null };
        const o = { id: rid("GRS-", 7), code: String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)) };
        if (it.fbgId) stmts.push(env.DB.prepare("UPDATE fbg_inventory SET qty_available = qty_available - ?, qty_reserved = qty_reserved + ?, updated_at = ? WHERE id = ? AND qty_available >= ?")
          .bind(it.qty, it.qty, t, it.fbgId, it.qty));
        stmts.push(env.DB.prepare(`INSERT INTO orders (id,user_id,basket,sku,vsku,quote_id,title,icon,variant,qty,unit,discount,credit_used,fee,total,flow,state,eta_days,pickup,address,pay,pay_phone,escrow,code,econ,history,created_at,updated_at,fbg_id,ship_mode,rate_card_id,ship_cost,transit_min,transit_max)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(o.id, user.id, basket, it.sku, it.vsku, it.quoteId || null, it.title, it.icon, it.variant, it.qty, it.unit, disc, credit, f, total,
          it.flow, total > 0 ? "AWAITING_PAYMENT" : "PLACED", it.etaDays, delivery ? "Gaarsiin guriga" : "Xarunta Garsoore · Km4, Muqdisho", delivery ? address : null, b.pay, payPhone,
          total > 0 ? "none" : "held", o.code, JSON.stringify(econ), JSON.stringify([{ state: total > 0 ? "AWAITING_PAYMENT" : "PLACED", at: t }]), t, t, it.fbgId || null,
          it.shipMode || null, it.rateCardId || null, it.shipCost != null ? it.shipCost * it.qty : null, it.transitMin || null, it.transitMax || null));
        orders.push(o.id);
      });
      if (creditTotal) stmts.push(env.DB.prepare("UPDATE users SET credit = credit - ? WHERE id = ? AND credit >= ?").bind(creditTotal, user.id, creditTotal));
      /* save what they just used, so the next checkout is two taps */
      stmts.push(env.DB.prepare("UPDATE users SET pay_method = ?, pay_phone = ?, address = COALESCE(NULLIF(?, ''), address) WHERE id = ?").bind(b.pay, payPhone, delivery ? address : "", user.id));
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
        if (o.fbg_id) await env.DB.prepare("UPDATE fbg_inventory SET qty_available = qty_available + ?, qty_reserved = MAX(0, qty_reserved - ?), updated_at = ? WHERE id = ?").bind(o.qty, o.qty, t, o.fbg_id).run();
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
      const svc = (Array.isArray(b.services) ? b.services : []).filter(k => SERVICES.items[k]).slice(0, 12);
      const qty = Math.max(1, Math.min(100000, Math.round(+b.qty || 1)));
      await env.DB.prepare("INSERT INTO quotes (id,user_id,status,title,icon,platform,ref,url,seller,kg,estimate,note,created_at,services,qty,service_fee) VALUES (?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(q.id, user.id, String(b.title || "Alaab").slice(0, 160), String(b.icon || "📦").slice(0, 8), String(b.platform || "web").slice(0, 20), String(b.ref || "").slice(0, 80),
          /^https?:\/\//.test(b.url || "") ? String(b.url).slice(0, 500) : "", String(b.seller || "").slice(0, 120), +b.kg || null, Number.isFinite(+b.estimate) && b.estimate != null ? Math.round(+b.estimate) : null, String(b.note || "").slice(0, 500), now(),
          JSON.stringify(svc), qty, serviceFee(svc)).run();
      return json({ id: q.id, services: svc, serviceFee: serviceFee(svc), qty });
    }
    if (path === "/quotes" && M === "GET") {
      const r = staff && url.searchParams.get("all") ? await env.DB.prepare("SELECT q.*, u.name u_name, u.phone u_phone FROM quotes q LEFT JOIN users u ON u.id = q.user_id ORDER BY q.created_at DESC LIMIT 300").all()
        : await env.DB.prepare("SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
      const svcOf = q => { try { return JSON.parse(q.services || "[]"); } catch { return []; } };
      return json({ quotes: r.results.map(q => ({ id: q.id, status: q.status, title: q.title, icon: q.icon, platform: q.platform, ref: q.ref, url: q.url, seller: q.seller, kg: q.kg, estimate: q.estimate,
        services: svcOf(q), qty: q.qty || 1, serviceFee: q.service_fee || 0,
        note: q.note, total: q.total, etaDays: q.eta_days, staffNote: q.staff_note, createdAt: q.created_at, quotedAt: q.quoted_at, contact: staff && q.u_name ? q.u_name + " · +" + q.u_phone : undefined })) });
    }

    if (path === "/notifications" && M === "GET") {
      const r = await env.DB.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY at DESC LIMIT 30").bind(user.id).all();
      const n = await env.DB.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(user.id).first();
      return json({ unread: n.c, items: r.results.map(x => ({ id: x.id, at: x.at, kind: x.kind, title: x.title, body: x.body, href: x.href, read: !!x.read_at })) });
    }
    if (path === "/notifications/read" && M === "POST") {
      await env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(now(), user.id).run();
      return json({ ok: true });
    }

    /* ---------------------------------------------------------------- account: saved details */
    if (path === "/me" && M === "POST") {
      const b = await body(req), name = String(b.name || "").trim().slice(0, 60);
      if (name && name.length < 2) return err("Magacu waa gaaban yahay.");
      const payPhone = b.payPhone ? normPhone(b.payPhone) : null;
      if (b.payPhone && !payPhone) return err("Lambarka lacag bixinta ma saxna.");
      if (b.payMethod && !PAYS.includes(b.payMethod)) return err("Habka lacag bixinta ma saxna.");
      await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), city = ?, address = ?, pay_method = ?, pay_phone = COALESCE(?, pay_phone) WHERE id = ?")
        .bind(name || null, String(b.city || "").slice(0, 40), String(b.address || "").slice(0, 200), b.payMethod || null, payPhone, user.id).run();
      const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
      return json({ user: pubUser(row) });
    }

    /* ---------------------------------------------------------------- account: change your own PIN */
    if (path === "/auth/pin" && M === "POST") {
      const b = await body(req);
      if (!user.must_change_pin && !(await pinOk(String(b.old || ""), user.pin_hash))) return err("PIN-ka hore waa khalad.");
      const pin = String(b.pin || "");
      if (!/^\d{4,6}$/.test(pin)) return err("PIN cusub waa 4–6 lambar.");
      if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) return err("PIN-kan aad buu u fudud yahay.");
      await env.DB.prepare("UPDATE users SET pin_hash = ?, must_change_pin = 0 WHERE id = ?").bind(await pinHash(pin), user.id).run();
      return json({ ok: true });
    }

    /* ---------------------------------------------------------------- business account (company profile) */
    if (path === "/business/me" && M === "GET") {
      const b = await env.DB.prepare("SELECT * FROM businesses WHERE user_id = ?").bind(user.id).first();
      return json({ business: b ? bizOut(b) : null, kinds: BIZ_KINDS });
    }
    if (path === "/business/apply" && M === "POST") {
      const b = await body(req), company = String(b.company || "").trim().slice(0, 120);
      if (company.length < 2) return err("Ku qor magaca shirkadda.");
      if (!BIZ_KINDS[b.kind]) return err("Dooro nooca akoonka ganacsiga.");
      const ex = await env.DB.prepare("SELECT id, status FROM businesses WHERE user_id = ?").bind(user.id).first();
      const t = now();
      if (ex) {
        await env.DB.prepare("UPDATE businesses SET company = ?, kind = ?, city = ?, reg_no = ?, contact = ?, updated_at = ? WHERE id = ?")
          .bind(company, b.kind, String(b.city || "").slice(0, 40), String(b.regNo || "").slice(0, 40), String(b.contact || "").slice(0, 60), t, ex.id).run();
        return json({ ok: true, id: ex.id, status: ex.status });
      }
      const id = rid("BZ-", 6);
      await env.DB.prepare("INSERT INTO businesses (id, user_id, company, kind, city, reg_no, contact, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?)")
        .bind(id, user.id, company, b.kind, String(b.city || "").slice(0, 40), String(b.regNo || "").slice(0, 40), String(b.contact || "").slice(0, 60), t, t).run();
      return json({ ok: true, id, status: "pending" });
    }

    /* ---------------------------------------------------------------- admin panel (role 'admin' only) */
    if (path.startsWith("/admin/")) {
      if (user.role !== "admin") return err("Maamulaha oo keliya.", 403);
      /* the console lives on its own hostname; when ADMIN_HOST is set these endpoints answer nowhere else */
      if (env.ADMIN_HOST && url.hostname !== env.ADMIN_HOST && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return err("Console-ka oo keliya.", 403);
      const alog = (action, target, detail) => env.DB.prepare("INSERT INTO admin_log (at, who, who_name, action, target, detail) VALUES (?,?,?,?,?,?)")
        .bind(now(), user.id, user.name, action, target || null, detail || null);

      if (path === "/admin/overview" && M === "GET") {
        const roles = (await env.DB.prepare("SELECT role, COUNT(*) n FROM users GROUP BY role").all()).results;
        const st = (await env.DB.prepare("SELECT status, COUNT(*) n FROM users GROUP BY status").all()).results;
        const biz = (await env.DB.prepare("SELECT kind, status, COUNT(*) n FROM businesses GROUP BY kind, status").all()).results;
        const ag = (await env.DB.prepare("SELECT status, COUNT(*) n FROM agents GROUP BY status").all()).results;
        const pend = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM businesses WHERE status='pending') b, (SELECT COUNT(*) FROM agents WHERE status='pending') a").first();
        return json({ roles, status: st, businesses: biz, agents: ag, pending: pend, roleList: ROLES, kinds: BIZ_KINDS });
      }
      if (path === "/admin/users" && M === "GET") {
        const q = (url.searchParams.get("q") || "").trim(), role = url.searchParams.get("role") || "";
        const like = "%" + q.replace(/[%_]/g, "") + "%";
        const rows = (await env.DB.prepare(`SELECT u.*, b.company, b.kind, b.status b_status, a.status a_status,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders
            FROM users u LEFT JOIN businesses b ON b.user_id = u.id LEFT JOIN agents a ON a.user_id = u.id
            WHERE (? = '' OR u.role = ?) AND (? = '' OR u.name LIKE ? OR u.phone LIKE ?)
            ORDER BY u.created_at DESC LIMIT 200`).bind(role, role, q, like, like).all()).results;
        return json({ users: rows.map(u => ({ id: u.id, name: u.name, phone: "+" + u.phone, role: u.role, status: u.status, credit: u.credit,
          mustChangePin: !!u.must_change_pin, refCode: u.ref_code, orders: u.orders, createdAt: u.created_at,
          company: u.company || null, kind: u.kind || null, bizStatus: u.b_status || null, agentStatus: u.a_status || null })) });
      }
      if (path === "/admin/users" && M === "POST") {
        const b = await body(req), phone = normPhone(b.phone), name = String(b.name || "").trim().slice(0, 60);
        if (!phone) return err("Lambarka taleefanka ma saxna.");
        if (name.length < 2) return err("Ku qor magaca.");
        if (!ROLES[b.role]) return err("Dooro nooca akoonka.");
        if (b.role === "admin") return err("Hal maamule ayaa jira. Wareeji xilka haddii loo baahdo.");
        if (await env.DB.prepare("SELECT 1 FROM users WHERE phone = ?").bind(phone).first()) return err("Lambarkan akoon ayuu leeyahay.", 409);
        const pin = String(b.pin || "").trim() || String(100000 + Math.floor(Math.random() * 899999));
        if (!/^\d{4,6}$/.test(pin)) return err("PIN-ku waa 4–6 lambar.");
        const id = rid("U-"), t = now(), stmts = [
          env.DB.prepare("INSERT INTO users (id, phone, name, pin_hash, role, ref_code, credit, created_at, status, must_change_pin, created_by) VALUES (?,?,?,?,?,?,0,?, 'active', 1, ?)")
            .bind(id, phone, name, await pinHash(pin), b.role, rid("", 6), t, user.id),
          alog("user.create", id, name + " · " + b.role)
        ];
        if (b.role === "business") {
          if (!BIZ_KINDS[b.kind]) return err("Dooro nooca ganacsiga (FBG, iibiye, iibsade…).");
          stmts.push(env.DB.prepare("INSERT INTO businesses (id, user_id, company, kind, city, reg_no, contact, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,'approved',?,?)")
            .bind(rid("BZ-", 6), id, String(b.company || name).slice(0, 120), b.kind, String(b.city || "").slice(0, 40), String(b.regNo || "").slice(0, 40), "+" + phone, t, t));
        }
        if (b.role === "agent") {
          stmts.push(env.DB.prepare("INSERT INTO agents (id, user_id, name, cats, cities, capacity, status, created_at) VALUES (?,?,?,?,?,?,'approved',?)")
            .bind(rid("AG-", 6), id, name, JSON.stringify(Array.isArray(b.cats) ? b.cats : []), JSON.stringify(b.city ? [b.city] : []), Math.max(1, Math.min(50, +b.capacity || 5)), t));
        }
        await env.DB.batch(stmts);
        return json({ id, pin, note: "Lambarkan PIN ah u sheeg qofka — waa inuu beddelaa markuu galo." });
      }
      if ((m = path.match(/^\/admin\/users\/(U-[A-Z0-9]+)$/)) && M === "POST") {
        const b = await body(req), target = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(m[1]).first();
        if (!target) return err("Akoon lama helin.", 404);
        const stmts = [];
        if (b.role && ROLES[b.role] && b.role !== target.role) {
          if (b.role === "admin") return err("Hal maamule ayaa jira.");
          if (target.role === "admin") return err("Maamulaha xilka lagama qaadi karo halkan.");
          stmts.push(env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(b.role, target.id), alog("user.role", target.id, target.role + " → " + b.role));
        }
        if (b.status && ["active", "suspended"].includes(b.status) && b.status !== target.status) {
          if (target.role === "admin") return err("Maamulaha lama hakin karo.");
          stmts.push(env.DB.prepare("UPDATE users SET status = ? WHERE id = ?").bind(b.status, target.id), alog("user.status", target.id, b.status + (b.note ? " · " + b.note : "")));
          if (b.status === "suspended") stmts.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id));   // sign them out now
        }
        if (b.credit != null) {
          const c = Math.max(0, Math.min(100000, Math.round(+b.credit)));
          stmts.push(env.DB.prepare("UPDATE users SET credit = ? WHERE id = ?").bind(c, target.id), alog("user.credit", target.id, target.credit + " → " + c + (b.note ? " · " + b.note : "")));
        }
        let pin = null;
        if (b.resetPin) {
          pin = String(100000 + Math.floor(Math.random() * 899999));
          stmts.push(env.DB.prepare("UPDATE users SET pin_hash = ?, must_change_pin = 1 WHERE id = ?").bind(await pinHash(pin), target.id),
            env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id), alog("user.pin", target.id, "temporary PIN issued"));
        }
        if (!stmts.length) return err("Wax isbeddel ah ma jiro.");
        await env.DB.batch(stmts);
        return json({ ok: true, pin });
      }
      if (path === "/admin/businesses" && M === "GET") {
        const rows = (await env.DB.prepare("SELECT b.*, u.name u_name, u.phone u_phone FROM businesses b JOIN users u ON u.id = b.user_id ORDER BY (b.status='pending') DESC, b.created_at DESC LIMIT 200").all()).results;
        return json({ businesses: rows.map(b => Object.assign(bizOut(b), { owner: b.u_name, phone: "+" + b.u_phone })), kinds: BIZ_KINDS });
      }
      if ((m = path.match(/^\/admin\/businesses\/(BZ-[A-Z0-9]+)$/)) && M === "POST") {
        const b = await body(req), st = ["approved", "paused", "rejected", "pending"].includes(b.status) ? b.status : null;
        const row = await env.DB.prepare("SELECT * FROM businesses WHERE id = ?").bind(m[1]).first();
        if (!row) return err("Lama helin.", 404);
        const stmts = [];
        if (st) {
          stmts.push(env.DB.prepare("UPDATE businesses SET status = ?, note = ?, updated_at = ? WHERE id = ?").bind(st, String(b.note || "").slice(0, 200), now(), row.id), alog("business.status", row.id, st));
          if (st === "approved") stmts.push(env.DB.prepare("UPDATE users SET role = 'business' WHERE id = ? AND role = 'consumer'").bind(row.user_id));
        }
        if (b.commission != null) {
          const c = Math.max(0, Math.min(50, Math.round(+b.commission)));
          stmts.push(env.DB.prepare("UPDATE businesses SET commission = ?, updated_at = ? WHERE id = ?").bind(c, now(), row.id), alog("business.commission", row.id, c + "%"));
        }
        if (b.kind && BIZ_KINDS[b.kind]) stmts.push(env.DB.prepare("UPDATE businesses SET kind = ?, updated_at = ? WHERE id = ?").bind(b.kind, now(), row.id), alog("business.kind", row.id, b.kind));
        if (!stmts.length) return err("Wax isbeddel ah ma jiro.");
        await env.DB.batch(stmts);
        return json({ ok: true });
      }
      if (path === "/admin/log" && M === "GET") {
        const rows = (await env.DB.prepare("SELECT * FROM admin_log ORDER BY at DESC LIMIT 200").all()).results;
        return json({ log: rows.map(x => ({ at: x.at, who: x.who_name, action: x.action, target: x.target, detail: x.detail })) });
      }
      return err("Not found", 404);
    }

    /* ---------------------------------------------------------------- FBG — Fulfilment by Garsoore
       The importer buys in China and ships to their Garsoore China suite. We receive, inspect, photograph, weigh,
       consolidate, freight to Mogadishu and store. They then keep it, sell it on Garsoore, or hand it to an agent.
       The goods stay theirs until sold; Garsoore charges fees + a commission on what sells. */
    if (path === "/fbg/me" && M === "GET") {
      const acc = await env.DB.prepare("SELECT * FROM fbg_accounts WHERE user_id = ?").bind(user.id).first();
      if (!acc) return json({ account: null, fees: FBG, address: null });
      const inb = (await env.DB.prepare("SELECT * FROM fbg_inbound WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(user.id).all()).results;
      const inv = (await env.DB.prepare("SELECT * FROM fbg_inventory WHERE user_id = ? AND disposition != 'closed' ORDER BY created_at DESC LIMIT 100").bind(user.id).all()).results;
      const led = (await env.DB.prepare("SELECT * FROM fbg_ledger WHERE user_id = ? ORDER BY at DESC LIMIT 100").bind(user.id).all()).results;
      const bal = led.reduce((s, l) => s + l.amount, 0);
      return json({ account: { suite: acc.suite, since: acc.created_at }, address: chinaAddress(env, acc.suite), fees: FBG,
        inbound: inb.map(inboundOut), inventory: inv.map(invOut), ledger: led.map(l => ({ at: l.at, kind: l.kind, amount: +l.amount.toFixed(2), ref: l.ref, note: l.note })),
        balance: +bal.toFixed(2) });
    }
    if (path === "/fbg/enroll" && M === "POST") {
      const ex = await env.DB.prepare("SELECT suite FROM fbg_accounts WHERE user_id = ?").bind(user.id).first();
      if (ex) return json({ suite: ex.suite, address: chinaAddress(env, ex.suite) });
      const suite = "GS-" + String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
      await env.DB.prepare("INSERT INTO fbg_accounts (id, user_id, suite, status, created_at) VALUES (?,?,?, 'active', ?)").bind(rid("FB-", 6), user.id, suite, now()).run();
      return json({ suite, address: chinaAddress(env, suite) });
    }
    if (path === "/fbg/inbound" && M === "POST") {
      const acc = await env.DB.prepare("SELECT suite FROM fbg_accounts WHERE user_id = ?").bind(user.id).first();
      if (!acc) return err("Isdiiwaangeli FBG marka hore.");
      const b = await body(req), title = String(b.title || "").trim().slice(0, 120);
      if (title.length < 2) return err("Ku qor alaabta aad soo dirayso.");
      const qty = Math.max(1, Math.min(1000000, Math.round(+b.qty || 1)));
      const t = now(), id = rid("IN-", 6);
      await env.DB.prepare(`INSERT INTO fbg_inbound (id,user_id,supplier,platform,tracking,title,qty_expected,value_usd,disposition,state,history,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?, 'EXPECTED', ?, ?, ?)`).bind(id, user.id, String(b.supplier || "").slice(0, 120), String(b.platform || "other").slice(0, 20),
        String(b.tracking || "").slice(0, 60), title, qty, Math.round(+b.value || 0) || null, ["keep", "sell", "agent"].includes(b.disposition) ? b.disposition : "sell",
        JSON.stringify([{ state: "EXPECTED", at: t }]), t, t).run();
      return json({ id, suite: acc.suite });
    }
    if ((m = path.match(/^\/fbg\/inbound\/(IN-[A-Z0-9]+)$/)) && M === "POST") {
      const row = await env.DB.prepare("SELECT * FROM fbg_inbound WHERE id = ? AND user_id = ?").bind(m[1], user.id).first();
      if (!row) return err("Lama helin.", 404);
      const b = await body(req);
      if (b.cancel) {
        if (row.state !== "EXPECTED") return err("Waa la helay — lama joojin karo.");
        await env.DB.prepare("DELETE FROM fbg_inbound WHERE id = ?").bind(row.id).run();
        return json({ ok: true });
      }
      if (!["keep", "sell", "agent"].includes(b.disposition)) return err("Dooro waxa lagu sameeyo alaabta.");
      if (["SHIPPED", "ARRIVED", "CLOSED"].includes(row.state)) return err("Waa la diray — beddelka waxaa lagu sameeyaa kaydka.");
      await env.DB.prepare("UPDATE fbg_inbound SET disposition = ?, updated_at = ? WHERE id = ?").bind(b.disposition, now(), row.id).run();
      return json({ ok: true });
    }
    /* what the owner does with stock that has arrived: keep it, list it, or hand it to an agent */
    if ((m = path.match(/^\/fbg\/inventory\/(IV-[A-Z0-9]+)$/)) && M === "POST") {
      const iv = await env.DB.prepare("SELECT * FROM fbg_inventory WHERE id = ? AND user_id = ?").bind(m[1], user.id).first();
      if (!iv) return err("Lama helin.", 404);
      const b = await body(req), t = now();
      if (b.action === "list") {
        const price = Math.round(+b.price);
        if (!(price > 0)) return err("Ku qor qiimaha iibka.");
        await env.DB.prepare("UPDATE fbg_inventory SET disposition = 'listed', price = ?, updated_at = ? WHERE id = ?").bind(price, t, iv.id).run();
        return json({ ok: true, commissionPct: FBG.commissionPct, net: +(price * (1 - FBG.commissionPct / 100) - FBG.pickPack).toFixed(2) });
      }
      if (b.action === "unlist") {
        await env.DB.prepare("UPDATE fbg_inventory SET disposition = 'stored', updated_at = ? WHERE id = ?").bind(t, iv.id).run();
        return json({ ok: true });
      }
      if (b.action === "release") {                       // ship the stock to the owner
        if (iv.qty_reserved > 0) return err("Qaar waa la dalbaday — sug inta dalabyadu dhammaanayaan.");
        await env.DB.prepare("UPDATE fbg_inventory SET disposition = 'release', updated_at = ? WHERE id = ?").bind(t, iv.id).run();
        return json({ ok: true });
      }
      if (b.action === "agent") {                          // hand it to a selling agent (mandate)
        const mode = b.mode === "margin" ? "margin" : "liquidity";
        const floor = Math.round(+b.floor);
        if (!(floor > 0)) return err("Ku qor qiimaha ugu yar ee aad aqbali karto.");
        const capPct = mode === "liquidity" ? AGENT.capLiquidity : AGENT.capMargin;
        const sellerPct = mode === "liquidity" ? 0 : Math.max(AGENT.sellerPctMin, Math.min(AGENT.sellerPctMax, Math.round(+b.sellerPct || 50)));
        const md = rid("MD-", 6);
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO mandates (id,user_id,side,mode,title,cat,qty,unit,floor,cap_pct,seller_pct,city,notes,state,expires_at,created_at,updated_at)
            VALUES (?,?, 'sell', ?,?,?,?, 'xabbo', ?,?,?, 'Muqdisho', ?, 'OPEN', ?, ?, ?)`).bind(md, user.id, mode, iv.title, iv.cat, iv.qty_available, floor, capPct, sellerPct,
            "FBG: alaabtu waxay ku jirtaa bakhaarka Garsoore (" + iv.id + ")", new Date(Date.now() + 30 * 864e5).toISOString(), t, t),
          env.DB.prepare("INSERT INTO mandate_events (mandate_id, at, who, who_name, kind, amount, text) VALUES (?,?,?,?, 'created', ?, ?)").bind(md, t, user.id, user.name, floor, "FBG stock " + iv.id),
          env.DB.prepare("UPDATE fbg_inventory SET disposition = 'agent', mandate_id = ?, updated_at = ? WHERE id = ?").bind(md, t, iv.id)
        ]);
        return json({ ok: true, mandate: md });
      }
      return err("Ficil aan la aqoon.");
    }
    /* ---------------------------------------------------------------- procurement (staff / buying agent)
       Every paid China order lands here as a purchase task. Nobody can buy on 1688/JD through an API from outside
       China, so the job is made one-click instead: the task carries the exact link, quantity, the most that may be
       paid, and the reference code for the carton. After that the goods drive the order forward by themselves. */
    if (path.startsWith("/ops/procurement")) {
      if (!staff) return err("Shaqaalaha Garsoore oo keliya.", 403);
      if (path === "/ops/procurement" && M === "GET") {
        const rows = (await env.DB.prepare(`SELECT p.*, o.state o_state, o.total o_total, u.name u_name, u.phone u_phone
          FROM procurement p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = p.user_id
          WHERE p.state NOT IN ('ARRIVED','CANCELLED') ORDER BY p.created_at ASC LIMIT 200`).all()).results;
        return json({ tasks: rows.map(procOut), address: chinaAddress(env, "<PO>"), fx: FX });
      }
      if ((m = path.match(/^\/ops\/procurement\/(PO-[A-Z0-9]+)\/(ordered|received|cancel|note)$/)) && M === "POST") {
        const p = await env.DB.prepare("SELECT * FROM procurement WHERE id = ?").bind(m[1]).first();
        if (!p) return err("Lama helin.", 404);
        const b = await body(req), t = now(), h = J(p.history) || [], act = m[2];
        const push = st => { h.push({ state: st, at: t, by: user.name }); return JSON.stringify(h); };
        if (act === "ordered") {
          const paid = +b.paidCny;
          if (!(paid > 0)) return err("Ku qor lacagta aad bixisay (¥).");
          await env.DB.batch([
            env.DB.prepare("UPDATE procurement SET state = 'ORDERED', paid_cny = ?, tracking = ?, supplier = ?, history = ?, updated_at = ? WHERE id = ?")
              .bind(paid, String(b.tracking || "").slice(0, 60), String(b.supplier || "").slice(0, 120), push("ORDERED"), t, p.id),
            env.DB.prepare("UPDATE orders SET state = CASE WHEN state = 'PLACED' THEN 'SOURCING' ELSE state END, history = json_insert(history, '$[#]', json(?)), updated_at = ? WHERE id = ? AND state = 'PLACED'")
              .bind(JSON.stringify({ state: "SOURCING", at: t, by: user.name }), t, p.order_id)
          ]);
          const over = p.target_cny ? +(paid - p.target_cny).toFixed(2) : 0;
          return json({ ok: true, overTarget: over > 0 ? over : 0, targetCny: p.target_cny });
        }
        if (act === "received") {                      // the parcel reached the China facility
          const kg = +b.kg;
          if (!(kg > 0)) return err("Ku qor miisaanka (kg).");
          await env.DB.prepare("UPDATE procurement SET state = 'IN_CHINA', cartons = ?, kg = ?, cbm = ?, history = ?, updated_at = ? WHERE id = ?")
            .bind(Math.max(1, Math.round(+b.cartons || 1)), kg, +b.cbm || 0, push("IN_CHINA"), t, p.id).run();
          return json({ ok: true });
        }
        if (act === "note") {
          await env.DB.prepare("UPDATE procurement SET note = ?, updated_at = ? WHERE id = ?").bind(String(b.note || "").slice(0, 300), t, p.id).run();
          return json({ ok: true });
        }
        await env.DB.prepare("UPDATE procurement SET state = 'CANCELLED', note = ?, history = ?, updated_at = ? WHERE id = ?").bind(String(b.note || "").slice(0, 300), push("CANCELLED"), t, p.id).run();
        return json({ ok: true, hint: "Dalabka macmiilka waa in la joojiyaa oo lacagta la celiyaa." });
      }
      return err("Not found", 404);
    }

    /* ---- staff: the China facility and the Somali warehouse */
    if (path.startsWith("/ops/fbg")) {
      if (!staff) return err("Shaqaalaha Garsoore oo keliya.", 403);
      if (path === "/ops/fbg" && M === "GET") {
        const inb = (await env.DB.prepare(`SELECT f.*, u.name u_name, u.phone u_phone, a.suite FROM fbg_inbound f JOIN users u ON u.id = f.user_id
          LEFT JOIN fbg_accounts a ON a.user_id = f.user_id WHERE f.state NOT IN ('CLOSED') ORDER BY f.created_at ASC LIMIT 200`).all()).results;
        const cons = (await env.DB.prepare("SELECT * FROM fbg_consignments WHERE state != 'ARRIVED' ORDER BY created_at DESC LIMIT 50").all()).results;
        const rel = (await env.DB.prepare("SELECT i.*, u.name u_name FROM fbg_inventory i JOIN users u ON u.id = i.user_id WHERE i.disposition = 'release' LIMIT 50").all()).results;
        const po = (await env.DB.prepare("SELECT p.*, u.name u_name, u.phone u_phone FROM procurement p JOIN users u ON u.id = p.user_id WHERE p.state IN ('ORDERED','IN_CHINA','CONSOLIDATED') ORDER BY p.created_at ASC LIMIT 200").all()).results;
        return json({ purchases: po.map(procOut),
          inbound: inb.map(x => Object.assign(inboundOut(x), { owner: x.u_name, phone: "+" + x.u_phone, suite: x.suite })),
          consignments: cons.map(c => ({ id: c.id, mode: c.mode, awb: c.awb, kg: c.kg, cbm: c.cbm, cost: c.cost_usd, state: c.state, eta: c.eta })),
          releases: rel.map(x => Object.assign(invOut(x), { owner: x.u_name })), fees: FBG });
      }
      if ((m = path.match(/^\/ops\/fbg\/inbound\/(IN-[A-Z0-9]+)\/(receive|inspect|problem)$/)) && M === "POST") {
        const row = await env.DB.prepare("SELECT * FROM fbg_inbound WHERE id = ?").bind(m[1]).first();
        if (!row) return err("Lama helin.", 404);
        const b = await body(req), t = now(), h = J(row.history) || [];
        if (m[2] === "problem") {
          h.push({ state: "PROBLEM", at: t, by: user.name });
          await env.DB.prepare("UPDATE fbg_inbound SET state = 'PROBLEM', problem = ?, history = ?, updated_at = ? WHERE id = ?").bind(String(b.note || "").slice(0, 300), JSON.stringify(h), t, row.id).run();
          return json({ ok: true });
        }
        if (m[2] === "receive") {
          const cartons = Math.max(1, Math.round(+b.cartons || 1)), kg = +b.kg, cbm = +b.cbm || 0, qty = Math.round(+b.qty || row.qty_expected);
          if (!(kg > 0)) return err("Ku qor miisaanka (kg).");
          h.push({ state: "RECEIVED", at: t, by: user.name });
          const fee = +(cartons * FBG.receivingPerCarton).toFixed(2);
          await env.DB.batch([
            env.DB.prepare("UPDATE fbg_inbound SET state = 'RECEIVED', cartons = ?, kg = ?, cbm = ?, qty_received = ?, photos = ?, history = ?, updated_at = ? WHERE id = ?")
              .bind(cartons, kg, cbm, qty, JSON.stringify((Array.isArray(b.photos) ? b.photos : []).slice(0, 8)), JSON.stringify(h), t, row.id),
            env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'receiving', ?, ?, ?)")
              .bind(rid("LG-", 6), row.user_id, t, -fee, row.id, cartons + " sanduuq · " + kg + " kg")
          ]);
          return json({ ok: true, fee });
        }
        h.push({ state: "INSPECTED", at: t, by: user.name });
        await env.DB.prepare("UPDATE fbg_inbound SET state = 'INSPECTED', problem = ?, history = ?, updated_at = ? WHERE id = ?").bind(String(b.note || "").slice(0, 300) || null, JSON.stringify(h), t, row.id).run();
        return json({ ok: true });
      }
      if (path === "/ops/fbg/consolidate" && M === "POST") {
        const b = await body(req), ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 100).map(String);
        if (!ids.length) return err("Dooro alaabta la isku darayo.");
        const mode = b.mode === "air" ? "air" : "sea", t = now(), cid = rid("CN-", 6);
        const inIds = ids.filter(x => x.startsWith("IN-")), poIds = ids.filter(x => x.startsWith("PO-"));
        const rows = inIds.length ? (await env.DB.prepare(`SELECT * FROM fbg_inbound WHERE id IN (${inIds.map(() => "?").join(",")}) AND state IN ('RECEIVED','INSPECTED')`).bind(...inIds).all()).results : [];
        const pos = poIds.length ? (await env.DB.prepare(`SELECT * FROM procurement WHERE id IN (${poIds.map(() => "?").join(",")}) AND state = 'IN_CHINA'`).bind(...poIds).all()).results : [];
        if (!rows.length && !pos.length) return err("Alaabtan lama isku dari karo (waa in la helo marka hore).");
        const kg = rows.concat(pos).reduce((s, r) => s + (r.kg || 0), 0), cbm = rows.concat(pos).reduce((s, r) => s + (r.cbm || 0), 0);
        const kind = rows.length && pos.length ? "mixed" : rows.length ? "fbg" : "own";
        const stmts = [env.DB.prepare("INSERT INTO fbg_consignments (id, mode, kg, cbm, state, kind, created_at, updated_at) VALUES (?,?,?,?, 'OPEN', ?, ?, ?)").bind(cid, mode, +kg.toFixed(2), +cbm.toFixed(3), kind, t, t)];
        rows.forEach(r => {
          const h = J(r.history) || []; h.push({ state: "CONSOLIDATED", at: t, by: user.name });
          stmts.push(env.DB.prepare("UPDATE fbg_inbound SET state = 'CONSOLIDATED', consignment = ?, history = ?, updated_at = ? WHERE id = ?").bind(cid, JSON.stringify(h), t, r.id));
        });
        pos.forEach(r => {
          const h = J(r.history) || []; h.push({ state: "CONSOLIDATED", at: t, by: user.name });
          stmts.push(env.DB.prepare("UPDATE procurement SET state = 'CONSOLIDATED', consignment = ?, history = ?, updated_at = ? WHERE id = ?").bind(cid, JSON.stringify(h), t, r.id));
        });
        await env.DB.batch(stmts);
        return json({ ok: true, id: cid, kg: +kg.toFixed(2), cbm: +cbm.toFixed(3), items: rows.length + pos.length });
      }
      if ((m = path.match(/^\/ops\/fbg\/consignments\/(CN-[A-Z0-9]+)\/(ship|arrive)$/)) && M === "POST") {
        const cn = await env.DB.prepare("SELECT * FROM fbg_consignments WHERE id = ?").bind(m[1]).first();
        if (!cn) return err("Lama helin.", 404);
        const b = await body(req), t = now();
        const rows = (await env.DB.prepare("SELECT * FROM fbg_inbound WHERE consignment = ?").bind(cn.id).all()).results;
        const pos = (await env.DB.prepare("SELECT * FROM procurement WHERE consignment = ?").bind(cn.id).all()).results;
        if (m[2] === "ship") {
          if (cn.state !== "OPEN") return err("Horey ayaa loo diray.");
          const cost = +b.cost > 0 ? +b.cost : (cn.kg || 0) * (cn.mode === "air" ? FBG.airPerKg : FBG.seaPerKg);
          const stmts = [env.DB.prepare("UPDATE fbg_consignments SET state = 'SHIPPED', awb = ?, cost_usd = ?, eta = ?, updated_at = ? WHERE id = ?")
            .bind(String(b.awb || "").slice(0, 40), +cost.toFixed(2), String(b.eta || "").slice(0, 30), t, cn.id)];
          const totalKg = rows.concat(pos).reduce((s, r) => s + (r.kg || 0), 0) || 1;
          rows.forEach(r => {                                   // freight is shared out by weight
            const share = +(cost * (r.kg || 0) / totalKg).toFixed(2), h = J(r.history) || [];
            h.push({ state: "SHIPPED", at: t, by: user.name });
            stmts.push(env.DB.prepare("UPDATE fbg_inbound SET state = 'SHIPPED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, r.id),
              env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'freight', ?, ?, ?)")
                .bind(rid("LG-", 6), r.user_id, t, -share, r.id, cn.mode + " " + (r.kg || 0) + " kg · " + cn.id));
          });
          for (const r of pos) {                                 // our own goods: the freight share lands on the order
            const share = +(cost * (r.kg || 0) / totalKg).toFixed(2), h = J(r.history) || [];
            h.push({ state: "SHIPPED", at: t, by: user.name });
            const ord = await env.DB.prepare("SELECT econ, history FROM orders WHERE id = ?").bind(r.order_id).first();
            const econ = (ord && J(ord.econ)) || {};
            econ.freightActual = share;
            econ.goodsActual = r.paid_cny ? +(r.paid_cny / FX).toFixed(2) : null;
            if (econ.goodsActual != null) econ.grossActual = +((econ.revenue || 0) + (econ.cogs || 0) - econ.goodsActual - share - (econ.deliveryCost || 0) - (econ.payFee || 0)).toFixed(2);
            const oh = (ord && J(ord.history)) || []; oh.push({ state: "IN_TRANSIT", at: t, by: user.name });
            stmts.push(env.DB.prepare("UPDATE procurement SET state = 'SHIPPED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, r.id),
              env.DB.prepare("UPDATE orders SET state = CASE WHEN state IN ('PLACED','SOURCING') THEN 'IN_TRANSIT' ELSE state END, econ = ?, history = ?, updated_at = ? WHERE id = ?")
                .bind(JSON.stringify(econ), JSON.stringify(oh), t, r.order_id));
          }
          await env.DB.batch(stmts);
          return json({ ok: true, cost: +cost.toFixed(2), items: rows.length + pos.length });
        }
        /* arrived in Mogadishu: the goods become inventory the owner can sell, keep or hand to an agent */
        const stmts = [env.DB.prepare("UPDATE fbg_consignments SET state = 'ARRIVED', updated_at = ? WHERE id = ?").bind(t, cn.id)];
        for (const r of rows) {
          const h = J(r.history) || []; h.push({ state: "ARRIVED", at: t, by: user.name });
          const qty = r.qty_received || r.qty_expected;
          const led = (await env.DB.prepare("SELECT COALESCE(SUM(amount),0) s FROM fbg_ledger WHERE ref = ?").bind(r.id).first()).s;
          const landed = qty ? +(((r.value_usd || 0) + Math.abs(led)) / qty).toFixed(2) : null;   // the owner's own cost per unit
          stmts.push(env.DB.prepare("UPDATE fbg_inbound SET state = 'ARRIVED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, r.id));
          stmts.push(notify(env, r.user_id, "fbg", "Alaabtaadu Muqdisho ayay timid", r.title + " — hadda waad dooran kartaa: qaado, iib, ama wakiil.", "fbg.html"));
          if (r.disposition === "keep") {
            stmts.push(env.DB.prepare(`INSERT INTO fbg_inventory (id,user_id,inbound_id,title,cat,icon,qty_total,qty_available,landed_unit,disposition,location,created_at,updated_at)
              VALUES (?,?,?,?,?, '📦', ?,?,?, 'release', 'Km4', ?, ?)`).bind(rid("IV-", 6), r.user_id, r.id, r.title, null, qty, qty, landed, t, t));
          } else {
            stmts.push(env.DB.prepare(`INSERT INTO fbg_inventory (id,user_id,inbound_id,title,cat,icon,qty_total,qty_available,landed_unit,disposition,location,created_at,updated_at)
              VALUES (?,?,?,?,?, '📦', ?,?,?, 'stored', 'Km4', ?, ?)`).bind(rid("IV-", 6), r.user_id, r.id, r.title, null, qty, qty, landed, t, t));
          }
        }
        for (const r of pos) {
          const h = J(r.history) || []; h.push({ state: "ARRIVED", at: t, by: user.name });
          const ord = await env.DB.prepare("SELECT history FROM orders WHERE id = ?").bind(r.order_id).first();
          const oh = (ord && J(ord.history)) || []; oh.push({ state: "ARRIVED", at: t, by: user.name });
          stmts.push(env.DB.prepare("UPDATE procurement SET state = 'ARRIVED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, r.id),
            env.DB.prepare("UPDATE orders SET state = CASE WHEN state IN ('PLACED','SOURCING','IN_TRANSIT') THEN 'ARRIVED' ELSE state END, history = ?, updated_at = ? WHERE id = ?")
              .bind(JSON.stringify(oh), t, r.order_id));
        }
        await env.DB.batch(stmts);
        return json({ ok: true, items: rows.length + pos.length });
      }
      if ((m = path.match(/^\/ops\/fbg\/inventory\/(IV-[A-Z0-9]+)\/(released|adjust)$/)) && M === "POST") {
        const iv = await env.DB.prepare("SELECT * FROM fbg_inventory WHERE id = ?").bind(m[1]).first();
        if (!iv) return err("Lama helin.", 404);
        const b = await body(req), t = now();
        if (m[2] === "released") {                 // handed over to the owner
          await env.DB.prepare("UPDATE fbg_inventory SET disposition = 'closed', qty_available = 0, updated_at = ? WHERE id = ?").bind(t, iv.id).run();
          return json({ ok: true });
        }
        const qty = Math.max(0, Math.round(+b.qty));
        await env.DB.prepare("UPDATE fbg_inventory SET qty_available = ?, qty_total = ?, note = ?, updated_at = ? WHERE id = ?")
          .bind(qty, qty + iv.qty_sold + iv.qty_reserved, String(b.note || "").slice(0, 200), t, iv.id).run();
        return json({ ok: true });
      }
      if (path === "/ops/fbg/payout" && M === "POST") {
        const b = await body(req), amount = +b.amount;
        if (!(amount > 0)) return err("Ku qor lacagta la bixiyay.");
        const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(String(b.userId || "")).first();
        if (!target) return err("Milkiile lama helin.");
        await env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'payout', ?, ?, ?)")
          .bind(rid("LG-", 6), target.id, now(), -Math.abs(amount), String(b.ref || "").slice(0, 40), String(b.note || "").slice(0, 200)).run();
        return json({ ok: true });
      }
      return err("Not found", 404);
    }

    /* ---------------------------------------------------------------- agents & mandates (business side)
       A mandate hands a sale (or a purchase) to an agent. The agent earns the spread between the principal's
       floor and the price actually achieved; Garsoore takes a cut of that spread and holds the money.
         liquidity : principal takes the floor, fast. The agent keeps the whole spread (markup capped hard).
         margin    : the principal keeps seller_pct of the spread. Worse for the agent → slower to place. */
    if (path === "/agents" && M === "GET") {
      const r = await env.DB.prepare(`SELECT a.id, a.name, a.cats, a.cities, a.capacity, a.status, a.created_at,
          (SELECT COUNT(*) FROM mandates m WHERE m.agent_id = a.id AND m.state IN ('ASSIGNED','LISTED','NEGOTIATING')) live,
          (SELECT COUNT(*) FROM mandates m WHERE m.agent_id = a.id AND m.state IN ('SOLD','SETTLED')) done
        FROM agents a WHERE a.status = 'approved' ORDER BY done DESC LIMIT 100`).all();
      return json({ agents: r.results.map(x => ({ id: x.id, name: x.name, cats: J(x.cats) || [], cities: J(x.cities) || [], capacity: x.capacity, live: x.live, done: x.done, since: x.created_at })) });
    }
    if (path === "/agent/me" && M === "GET") {
      const me = await env.DB.prepare("SELECT * FROM agents WHERE user_id = ?").bind(user.id).first();
      return json({ agent: me ? { id: me.id, name: me.name, cats: J(me.cats), cities: J(me.cities), capacity: me.capacity, status: me.status, note: me.note } : null });
    }
    if (path === "/agent/apply" && M === "POST") {
      const b = await body(req), cats = (Array.isArray(b.cats) ? b.cats : []).slice(0, 10).map(String);
      const cities = (Array.isArray(b.cities) ? b.cities : []).slice(0, 10).map(x => String(x).slice(0, 30));
      const cap = Math.max(1, Math.min(50, Math.round(+b.capacity || 5)));
      const ex = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ?").bind(user.id).first();
      if (ex) { await env.DB.prepare("UPDATE agents SET cats = ?, cities = ?, capacity = ? WHERE id = ?").bind(JSON.stringify(cats), JSON.stringify(cities), cap, ex.id).run(); return json({ ok: true, id: ex.id }); }
      const id = rid("AG-", 6);
      await env.DB.prepare("INSERT INTO agents (id, user_id, name, cats, cities, capacity, status, created_at) VALUES (?,?,?,?,?,?,'pending',?)")
        .bind(id, user.id, user.name, JSON.stringify(cats), JSON.stringify(cities), cap, now()).run();
      return json({ ok: true, id, status: "pending" });
    }

    if (path === "/mandates" && M === "POST") {
      const b = await body(req);
      const side = b.side === "buy" ? "buy" : "sell", mode = b.mode === "margin" ? "margin" : "liquidity";
      const title = String(b.title || "").trim().slice(0, 120);
      if (title.length < 3) return err("Ku qor waxa aad rabto in wakiilku kuu iibiyo/kuu soo iibiyo.");
      const floor = Math.round(+b.floor);
      if (!(floor > 0 && floor <= 10000000)) return err(side === "sell" ? "Ku qor qiimaha ugu yaraan ee aad aqbali karto." : "Ku qor qiimaha ugu badan ee aad bixin karto.");
      const qty = Math.max(1, Math.min(100000, Math.round(+b.qty || 1)));
      const capPct = mode === "liquidity" ? AGENT.capLiquidity : AGENT.capMargin;
      const sellerPct = mode === "liquidity" ? 0 : Math.max(AGENT.sellerPctMin, Math.min(AGENT.sellerPctMax, Math.round(+b.sellerPct || 50)));
      const days = Math.max(1, Math.min(90, Math.round(+b.days || 14)));
      const id = rid("MD-", 6), t = now();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO mandates (id,user_id,side,mode,title,cat,qty,unit,floor,cap_pct,seller_pct,city,notes,state,expires_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'OPEN',?,?,?)`).bind(id, user.id, side, mode, title, String(b.cat || "").slice(0, 8) || null, qty, String(b.unit || "").slice(0, 20) || null,
          floor, capPct, sellerPct, String(b.city || "").slice(0, 40) || null, String(b.notes || "").slice(0, 600) || null, new Date(Date.now() + days * 864e5).toISOString(), t, t),
        env.DB.prepare("INSERT INTO mandate_events (mandate_id, at, who, who_name, kind, amount, text) VALUES (?,?,?,?,'created',?,?)")
          .bind(id, t, user.id, user.name, floor, mode === "liquidity" ? "Degdeg: qiimaha hoose, wakiilku wuxuu haystaa faa'iidada" : "Faa'iido: " + sellerPct + "% faa'iidada waxaa haysta milkiilaha")
      ]);
      return json({ id, capPct, sellerPct });
    }
    if (path === "/mandates" && M === "GET") {
      const scope = url.searchParams.get("scope") || "mine";
      const me = await env.DB.prepare("SELECT * FROM agents WHERE user_id = ?").bind(user.id).first();
      let rows;
      if (scope === "open") {                       // the mandate board an approved agent can claim from
        if (!me || me.status !== "approved") return json({ mandates: [], needAgent: true });
        rows = (await env.DB.prepare("SELECT m.*, u.name u_name FROM mandates m JOIN users u ON u.id = m.user_id WHERE m.state = 'OPEN' AND m.expires_at > ? ORDER BY (m.mode = 'liquidity') DESC, m.created_at ASC LIMIT 100").bind(now()).all()).results;
      } else if (scope === "assigned") {
        if (!me) return json({ mandates: [] });
        rows = (await env.DB.prepare("SELECT m.*, u.name u_name FROM mandates m JOIN users u ON u.id = m.user_id WHERE m.agent_id = ? ORDER BY m.updated_at DESC LIMIT 100").bind(me.id).all()).results;
      } else {
        rows = (await env.DB.prepare("SELECT m.*, a.name a_name FROM mandates m LEFT JOIN agents a ON a.id = m.agent_id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 100").bind(user.id).all()).results;
      }
      return json({ mandates: rows.map(mandateOut), agent: me ? { id: me.id, status: me.status } : null, econ: AGENT });
    }
    if ((m = path.match(/^\/mandates\/(MD-[A-Z0-9]+)$/)) && M === "GET") {
      const md = await env.DB.prepare("SELECT m.*, a.name a_name, u.name u_name FROM mandates m LEFT JOIN agents a ON a.id = m.agent_id JOIN users u ON u.id = m.user_id WHERE m.id = ?").bind(m[1]).first();
      if (!md) return err("Lama helin.", 404);
      const me = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ?").bind(user.id).first();
      const mine = md.user_id === user.id, isAgent = me && md.agent_id === me.id;
      if (!(mine || isAgent || staff)) return err("Ma lihid fasax.", 403);
      const ev = (await env.DB.prepare("SELECT * FROM mandate_events WHERE mandate_id = ? ORDER BY at ASC").bind(md.id).all()).results;
      return json({ mandate: mandateOut(md), events: ev.map(x => ({ at: x.at, who: x.who_name, kind: x.kind, amount: x.amount, text: x.text })), role: mine ? "principal" : isAgent ? "agent" : "staff", econ: AGENT });
    }
    if ((m = path.match(/^\/mandates\/(MD-[A-Z0-9]+)\/(claim|ask|offer|sold|cancel|settle)$/)) && M === "POST") {
      const md = await env.DB.prepare("SELECT * FROM mandates WHERE id = ?").bind(m[1]).first();
      if (!md) return err("Lama helin.", 404);
      const b = await body(req), t = now(), act = m[2];
      const me = await env.DB.prepare("SELECT * FROM agents WHERE user_id = ?").bind(user.id).first();
      const isAgent = me && md.agent_id === me.id, mine = md.user_id === user.id;
      const log = (kind, amount, text) => env.DB.prepare("INSERT INTO mandate_events (mandate_id, at, who, who_name, kind, amount, text) VALUES (?,?,?,?,?,?,?)")
        .bind(md.id, t, user.id, user.name, kind, amount == null ? null : Math.round(amount), text || null);

      if (act === "claim") {
        if (!me || me.status !== "approved") return err("Wakiillada Garsoore ee la ansixiyay oo keliya.", 403);
        if (md.state !== "OPEN") return err("Mandate-kan horey ayaa loo qaatay.");
        if (md.user_id === user.id) return err("Mandate-kaaga adigu ma qaadan kartid.");
        const live = await env.DB.prepare("SELECT COUNT(*) n FROM mandates WHERE agent_id = ? AND state IN ('ASSIGNED','LISTED','NEGOTIATING')").bind(me.id).first();
        if (live.n >= me.capacity) return err("Awooddaada (" + me.capacity + " mandate) way buuxdaa.");
        await env.DB.batch([
          env.DB.prepare("UPDATE mandates SET agent_id = ?, state = 'ASSIGNED', updated_at = ? WHERE id = ? AND state = 'OPEN'").bind(me.id, t, md.id),
          log("assigned", null, "Wakiil: " + user.name),
          notify(env, md.user_id, "mandate", "Wakiil ayaa qaatay mandate-kaaga", md.title + " — " + user.name + " ayaa hadda suuqa u geynaya.", "agents.html?tab=mine")
        ]);
        return json({ ok: true });
      }
      if (act === "ask") {
        if (!isAgent) return err("Wakiilka loo xilsaaray oo keliya.", 403);
        const ask = Math.round(+b.ask);
        const lo = md.side === "sell" ? md.floor : Math.round(md.floor * (1 - md.cap_pct / 100));
        const hi = md.side === "sell" ? Math.round(md.floor * (1 + md.cap_pct / 100)) : md.floor;
        if (!(ask >= lo && ask <= hi)) return err("Qiimuhu waa inuu u dhexeeyaa $" + lo + " iyo $" + hi + " (xadka mandate-ka).");
        await env.DB.batch([
          env.DB.prepare("UPDATE mandates SET ask = ?, state = CASE WHEN state = 'ASSIGNED' THEN 'LISTED' ELSE state END, updated_at = ? WHERE id = ?").bind(ask, t, md.id),
          log("ask", ask, String(b.note || "").slice(0, 200) || null)
        ]);
        return json({ ok: true });
      }
      if (act === "offer") {
        if (!isAgent) return err("Wakiilka loo xilsaaray oo keliya.", 403);
        const amount = Math.round(+b.amount);
        if (!(amount > 0)) return err("Ku qor qiimaha la soo bandhigay.");
        const best = md.best_offer == null ? amount : (md.side === "sell" ? Math.max(md.best_offer, amount) : Math.min(md.best_offer, amount));
        await env.DB.batch([
          env.DB.prepare("UPDATE mandates SET best_offer = ?, state = CASE WHEN state IN ('ASSIGNED','LISTED') THEN 'NEGOTIATING' ELSE state END, updated_at = ? WHERE id = ?").bind(best, t, md.id),
          log("offer", amount, String(b.from || "").slice(0, 60) || null)
        ]);
        return json({ ok: true });
      }
      if (act === "sold") {
        if (!isAgent) return err("Wakiilka loo xilsaaray oo keliya.", 403);
        if (!["ASSIGNED", "LISTED", "NEGOTIATING"].includes(md.state)) return err("Mandate-kan lama xidhi karo hadda.");
        const price = Math.round(+b.price);
        const lo = md.side === "sell" ? md.floor : 1;
        const hi = md.side === "sell" ? Math.round(md.floor * (1 + md.cap_pct / 100)) : md.floor;
        if (!(price >= lo && price <= hi)) return err("Qiimaha heshiisku waa inuu u dhexeeyaa $" + lo + " iyo $" + hi + ".");
        const split = settle(md, price);
        await env.DB.batch([
          env.DB.prepare("UPDATE mandates SET state = 'SOLD', deal_price = ?, split = ?, updated_at = ? WHERE id = ?").bind(price, JSON.stringify(split), t, md.id),
          log("sold", price, String(b.buyer || "").slice(0, 80) || null),
          notify(env, md.user_id, "mandate", "Mandate-kaagii waa la iibiyay: $" + price, md.title + " — qaybtaada: $" + split.principalTotal + ". Garsoore ayaa lacagta kuu diraya.", "agents.html?tab=mine")
        ]);
        return json({ ok: true, split });
      }
      if (act === "cancel") {
        if (!(mine || staff)) return err("Milkiilaha oo keliya.", 403);
        if (!["OPEN", "ASSIGNED", "LISTED"].includes(md.state)) return err("Wax lagu heshiiyay lama joojin karo — la xidhiidh Garsoore.");
        await env.DB.batch([
          env.DB.prepare("UPDATE mandates SET state = 'CANCELLED', updated_at = ? WHERE id = ?").bind(t, md.id),
          log("cancelled", null, String(b.why || "").slice(0, 200) || null)
        ]);
        return json({ ok: true });
      }
      if (!staff) return err("Shaqaalaha Garsoore oo keliya.", 403);     // settle: money actually moved
      if (md.state !== "SOLD") return err("Mandate-kan weli lama iibin.");
      await env.DB.batch([
        env.DB.prepare("UPDATE mandates SET state = 'SETTLED', updated_at = ? WHERE id = ?").bind(t, md.id),
        log("settled", md.deal_price, "Lacagta waa la qaybiyay")
      ]);
      return json({ ok: true });
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
        if (b.ok) {
          h.push({ state: "PLACED", at: t, by });
          const stmts = [env.DB.prepare("UPDATE orders SET state = 'PLACED', escrow = 'held', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id),
            notify(env, o.user_id, "order", "Lacagtaadu waa la hubiyay", o.title + " — Garsoore ayaa lacagta hayn doona ilaa aad alaabta qaadato.", "orders.html")];
          /* a paid China order becomes a purchase task for the buying agent (FBG stock and local goods need none) */
          if (o.flow === "china" && !o.fbg_id) {
            const cat = CATALOG[o.sku], v = cat && cat.variants.filter(x => x.vsku === o.vsku)[0];
            const done = await env.DB.prepare("SELECT 1 FROM procurement WHERE order_id = ?").bind(o.id).first();
            if (!done) stmts.push(env.DB.prepare(`INSERT INTO procurement (id,order_id,user_id,sku,vsku,title,qty,platform,source_url,supplier,target_cny,state,history,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?, 'QUEUED', ?, ?, ?)`).bind(rid("PO-", 6), o.id, o.user_id, o.sku, o.vsku, o.title, o.qty,
              cat ? cat.channel : (o.quote_id ? "quote" : "web"), cat ? cat.url || "" : "", cat ? cat.seller : "",
              v && v.cny ? +(v.cny * o.qty).toFixed(2) : null, JSON.stringify([{ state: "QUEUED", at: t, by }]), t, t));
          }
          await env.DB.batch(stmts);
        }
        else { h.push({ state: "AWAITING_PAYMENT", at: t, by, note: "lacag lama helin" }); await env.DB.prepare("UPDATE orders SET state = 'AWAITING_PAYMENT', pay_txn = NULL, history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id).run(); }
        return json({ ok: true });
      }
      if (m[2] === "advance") {
        const f = FLOW[o.flow], i = f.indexOf(o.state);
        if (i < f.indexOf("PLACED") || f[i + 1] === "COMPLETED" || i < 0 || i >= f.length - 1) return err("Tallaabadan halkan lagama qaadi karo (lacag bixin = hubi; qaadasho = koodhka).");
        h.push({ state: f[i + 1], at: t, by });
        const nx = f[i + 1];
        const msg = nx === "READY" ? ["Alaabtaadu waa diyaar", o.title + " — imow xarunta Km4 oo la imow koodhkaaga 6-ta lambar. Waxaad ka arki kartaa bogga dalabyada."]
          : nx === "ARRIVED" ? ["Alaabtaadu Muqdisho ayay timid", o.title + " — waxaan kuu soo sheegaynaa marka ay diyaar noqoto."]
          : nx === "SOURCING" ? ["Alaabtaada waa la iibsaday", o.title + " — hadda waxay ku jirtaa habka rarka."]
          : nx === "IN_TRANSIT" ? ["Alaabtaadu way soo socotaa", o.title + " — waan ku soo ogeysiin doonaa markay timaaddo."]
          : nx === "CONFIRMED" ? ["Iibiyuhu wuu xaqiijiyay", o.title] : null;
        await env.DB.batch([env.DB.prepare("UPDATE orders SET state = ?, history = ?, updated_at = ? WHERE id = ?").bind(nx, JSON.stringify(h), t, o.id)]
          .concat(msg ? [notify(env, o.user_id, "order", msg[0], msg[1], "orders.html")] : []));
        return json({ ok: true, state: nx });
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
      const stmts = [env.DB.prepare("UPDATE orders SET state = 'COMPLETED', escrow = 'released', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id),
        notify(env, o.user_id, "order", "Waad qaadatay — mahadsanid", o.title + " — haddii wax khaldan yihiin, cabasho waxaad furi kartaa 7 maalmood gudahood.", "orders.html")];
      if (o.fbg_id) {        // FBG sale: the stock was someone else's, so credit them the price less commission and pick & pack
        const iv = await env.DB.prepare("SELECT * FROM fbg_inventory WHERE id = ?").bind(o.fbg_id).first();
        if (iv) {
          const gross = o.unit * o.qty, commission = +(gross * FBG.commissionPct / 100).toFixed(2), pp = FBG.pickPack;
          stmts.push(
            env.DB.prepare("UPDATE fbg_inventory SET qty_reserved = qty_reserved - ?, qty_sold = qty_sold + ?, updated_at = ? WHERE id = ?").bind(o.qty, o.qty, t, iv.id),
            env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'sale', ?, ?, ?)").bind(rid("LG-", 6), iv.user_id, t, gross, o.id, o.title + " ×" + o.qty),
            env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'commission', ?, ?, ?)").bind(rid("LG-", 6), iv.user_id, t, -(commission + pp), o.id, FBG.commissionPct + "% + pick & pack")
          );
        }
      }
      let rewarded = false;
      if (o.referred_by) {
        const prev = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE user_id = ? AND state = 'COMPLETED'").bind(o.user_id).first();
        if (prev.n === 0) {
          stmts.push(env.DB.prepare("UPDATE users SET credit = credit + ? WHERE id = ?").bind(ECON.refReward, o.referred_by),
            notify(env, o.referred_by, "money", "Waxaad heshay $" + ECON.refReward + " dheeraad ah", "Saaxiibkaagii aad casuuntay ayaa dalabkiisii koowaad qaatay.", "account.html"));
          rewarded = true;
        }
      }
      await env.DB.batch(stmts);
      return json({ ok: true, order: { id: o.id, title: o.title, qty: o.qty, customer: o.u_name }, referralPaid: rewarded });
    }
    if ((m = path.match(/^\/ops\/quotes\/(Q-[A-Z0-9]+)$/)) && M === "POST") {
      const b = await body(req), t = now();
      if (b.action === "price") {
        const total = Math.round(+b.total); if (!(total > 0)) return err("Ku qor qiimo sax ah.");
        const q = await env.DB.prepare("SELECT user_id, title FROM quotes WHERE id = ?").bind(m[1]).first();
        await env.DB.batch([
          env.DB.prepare("UPDATE quotes SET status = 'quoted', total = ?, eta_days = ?, staff_note = ?, quoted_at = ? WHERE id = ? AND status = 'pending'").bind(total, Math.max(1, Math.round(+b.etaDays || 20)), String(b.note || "").slice(0, 300), t, m[1])
        ].concat(q && q.user_id ? [notify(env, q.user_id, "quote", "Qiimahaagii waa diyaar: $" + total, q.title + " — hadda waad iibsan kartaa qiimahan rasmiga ah.", "orders.html")] : []));
      } else {
        const q = await env.DB.prepare("SELECT user_id, title FROM quotes WHERE id = ?").bind(m[1]).first();
        await env.DB.batch([
          env.DB.prepare("UPDATE quotes SET status = 'declined', staff_note = ?, quoted_at = ? WHERE id = ? AND status = 'pending'").bind(String(b.note || "Alaabtan ma keeni karno.").slice(0, 300), t, m[1])
        ].concat(q && q.user_id ? [notify(env, q.user_id, "quote", "Codsigaagii lama qiimayn karin", q.title + " — " + String(b.note || "Alaabtan ma keeni karno."), "orders.html")] : []));
      }
      return json({ ok: true });
    }
    if (path === "/ops/agents" && M === "GET") {
      const ag = (await env.DB.prepare("SELECT a.*, u.phone u_phone FROM agents a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200").all()).results;
      const md = (await env.DB.prepare("SELECT m.*, a.name a_name, u.name u_name FROM mandates m LEFT JOIN agents a ON a.id = m.agent_id JOIN users u ON u.id = m.user_id WHERE m.state IN ('OPEN','ASSIGNED','LISTED','NEGOTIATING','SOLD') ORDER BY m.created_at ASC LIMIT 200").all()).results;
      return json({ agents: ag.map(x => ({ id: x.id, name: x.name, phone: "+" + x.u_phone, cats: J(x.cats), cities: J(x.cities), capacity: x.capacity, status: x.status, createdAt: x.created_at })),
        mandates: md.map(mandateOut) });
    }
    if ((m = path.match(/^\/ops\/agents\/(AG-[A-Z0-9]+)$/)) && M === "POST") {
      const b = await body(req), st = ["approved", "paused", "blocked", "pending"].includes(b.status) ? b.status : null;
      if (!st) return err("Xaalad aan sax ahayn.");
      await env.DB.prepare("UPDATE agents SET status = ?, note = ? WHERE id = ?").bind(st, String(b.note || "").slice(0, 200), m[1]).run();
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
