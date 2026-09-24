/* Garsoore API — runs inside the same Worker as the site, so buurwen.com and business.buurwen.com share it.
   Storage: Cloudflare D1 (binding DB, schema in schema.sql).
   Rules that matter for money:
     - The server prices every order from CATALOG (built from the same price() as the browser). Browser prices are ignored.
     - Payment (launch mode): the customer pays the Garsoore merchant number by mobile money and types the transaction
       reference; staff match it against the merchant statement, then the money is "held" (escrow) until pickup.
     - An order completes only when staff enter the customer's 6-digit pickup code (staff never see the code).
*/
import { provider, providers, normState } from "./logistics.js";
import { CATALOG, PRICING } from "./catalog.gen.js";
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

/* ---- the two things a Somali business can be on Garsoore.

   GARSOORE BUSINESS (free) is the whole marketplace: search wholesale, paste a link, ask for a price, place an
   order, use an agent, sell on the consumer shop. Nothing about buying is behind a paywall, deliberately — charging
   somebody for permission to spend money with you is how a marketplace stays empty.

   GARSOORE BUSINESS PRO is the two things that cost Garsoore real capacity rather than server time:
     • an FBG suite — a China address of their own, and space in our facility and our consolidations
     • sourcing with no deposit — an agent works their request on trust instead of against money held

   Both are capacity we have to reserve whether or not they use it, which is exactly what a subscription is for. */
export const PLANS = {
  proMonthly: 50,            // $/month for Garsoore Business Pro
  proBenefits: ["fbg", "no-deposit"]
};

/* ---- managed wholesale sourcing. The deposit buys an agent's time, so the rules are about whose fault it is that
   the time was spent. Garsoore fails to source it: full refund, our problem. The trader walks away mid-negotiation:
   we keep a share that grows per day, because the hours are gone either way.
   Every one of these numbers is shown to the customer before they pay a cent — see docs/SOURCING-TERMS.md. */
export const SOURCING = {
  depositPct: 30,            // % of the GOODS value only. Shipping is never part of the deposit base.
  subscriptionUsd: 50,       // per month; Garsoore Business Pro waives the deposit entirely (see PLANS)
  cancelDecayPctPerDay: 5,   // % of the deposit kept per day elapsed once sourcing started
  cancelDecayCapPct: 100,    // ...never more than the deposit itself
  minDeposit: 20,            // below this the paperwork costs more than the deposit protects
  quoteValidDays: 7
};
/* What Garsoore keeps if the trader cancels. Day 0 costs them nothing: changing your mind the same hour is not the
   behaviour this is here to discourage. After that it is 5% a day, capped at the whole deposit. */
function forfeitOf(sr, at) {
  const paid = +sr.deposit_paid || 0;
  if (!paid || !sr.deposit_at) return 0;
  const days = Math.max(0, Math.floor((Date.parse(at) - Date.parse(sr.deposit_at)) / 864e5));
  const pct = Math.min(SOURCING.cancelDecayCapPct, days * SOURCING.cancelDecayPctPerDay);
  return Math.round(paid * pct) / 100;
}
/* Garsoore Business Pro, stored as an expiry rather than a boolean so a lapsed membership needs no cleanup job.
   There is no recurring billing yet — an administrator extends it after payment lands, which is honest about what
   the system can actually do today. */
function proActive(u, at) { return !!(u && u.sub_until && Date.parse(u.sub_until) > Date.parse(at || now())); }
const subActive = proActive;                     // sourcing called it a subscription before the tier had a name

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

/* ---------------------------------------------------------------- WaafiPay (EVC Plus, ZAAD, SAHAL, WAAFI)
   Somalia has no card rails, so payment is a USSD wallet. WaafiPay pushes a PIN prompt to the customer's own
   handset and tells us whether the wallet debited.

   GARSOORE NEVER SEES A PIN. We send an amount and a phone number; the customer types their PIN into their own
   phone, in their wallet's own prompt. That property is the reason to use this rather than anything that asks a
   customer to type a secret into our page, and it must not be traded away for convenience.

   Credentials live in Worker secrets, never in wrangler.jsonc, which is committed:
     npx wrangler secret put WAAFI_MERCHANT_UID
     npx wrangler secret put WAAFI_API_USER
     npx wrangler secret put WAAFI_API_KEY
   With any of them missing the feature stays dark and checkout keeps using the manual transaction-ID flow. */
const waafiOn = env => !!(env.WAAFI_MERCHANT_UID && env.WAAFI_API_USER && env.WAAFI_API_KEY);

/* 252611111111 - full international, no plus, no leading zero. A number that looks right to a Somali reader is
   not what the gateway accepts, so normalise rather than trusting what was typed. */
function msisdn(raw) {
  let d = String(raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("252")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d.length >= 7 && d.length <= 12 ? "252" + d : null;
}

async function waafiPurchase(env, { phone, amount, reference, description }) {
  const acct = msisdn(phone);
  if (!acct) return { ok: false, message: "Lambarka taleefanku ma sax aha." };
  const body = {
    schemaVersion: "1.0",
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    channelName: "WEB",
    serviceName: "API_PURCHASE",
    serviceParams: {
      merchantUid: env.WAAFI_MERCHANT_UID,
      apiUserId: env.WAAFI_API_USER,
      apiKey: env.WAAFI_API_KEY,
      paymentMethod: "MWALLET_ACCOUNT",
      payerInfo: { accountNo: acct },
      transactionInfo: {
        referenceId: String(reference).slice(0, 50),
        invoiceId: String(reference).slice(0, 50),
        amount: (+amount).toFixed(2),
        currency: "USD",
        description: String(description || "Garsoore").slice(0, 255)
      }
    }
  };
  let r, j;
  try {
    r = await fetch((env.WAAFI_BASE || "https://api.waafipay.net") + "/asm", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    j = await r.json();
  } catch (e) {
    /* The customer may well have approved it on their handset before this failed, so nothing here may retry:
       a blind retry is how one order gets charged twice. Staff resolve it against the wallet statement. */
    return { ok: false, unknown: true, message: "Lacag bixintu ma dhammaystirmin. Ha dib u bixin — la xidhiidh Garsoore." };
  }
  const p = (j && j.params) || {};
  const approved = String(p.state || "").toUpperCase() === "APPROVED";
  return {
    ok: approved,
    unknown: false,
    state: p.state || null,
    txn: p.transactionId || p.issuerTransactionId || null,
    charges: p.merchantCharges != null ? +p.merchantCharges : null,
    message: approved ? "" : (j && (j.responseMsg || j.errorMsg)) || "Lacag bixintu ma guulaysan."
  };
}

/* Compare secrets without leaking their length or prefix through timing. Any string that guards money gets this,
   even when the realistic attacker is not measuring microseconds. */
function timingSafeEq(a, b) {
  const x = new TextEncoder().encode(String(a)), y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

/* ---------------------------------------------------------------- payment SMS
   EVC Plus sends the merchant a confirmation message for every payment, whether or not anybody has approved an
   API account. A handset in the office forwarding those messages is therefore a payment feed that needs no
   gateway, no merchant agreement and nobody's signature — which is the whole point of it.

   It is a bridge, not a destination. A gateway tells us a payment succeeded; an SMS tells us a message arrived
   that looks like a payment. Everything below is built around that difference. */

/* Operators word these differently and change them without notice, so the parser reads loosely and records what
   it could not understand rather than guessing. A null here is honest; a wrong number is not. */
function parsePaymentSms(body) {
  const s = String(body || "").replace(/ /g, " ");
  const out = { amount: null, currency: "USD", payer: null, payerName: null, reference: null, receipt: false };

  /* A balance notification also contains a dollar figure. Treating one as a payment would credit an order
     against money nobody sent, so a message has to actually say something arrived before any amount is read
     off it. English and Somali wordings both, because the operator uses whichever it feels like. */
  const RECEIPT = /\b(received|credited|deposit|payment|paid|heshay|lagu\s*shubay|ayaa\s*lagugu\s*shubay|waxaad\s*heshay|la\s*helay)\b/i;
  const BALANCE_ONLY = /\bbalance\b|\bhadhaagu\b|\bharaagaagu\b/i;
  out.receipt = RECEIPT.test(s);
  if (!out.receipt) return out;                 // nothing else is read: no amount, no payer, no reference
  if (BALANCE_ONLY.test(s) && !RECEIPT.test(s.replace(BALANCE_ONLY, ""))) return out;

  /* $12.50 | USD 12.50 | 12.50 USD. Take the FIRST, because the trailing figure in these messages is the new
     balance and crediting that would be spectacular. */
  let m = s.match(/(?:\$|\bUSD\b)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i) || s.match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:\$|\bUSD\b)/i);
  if (m) out.amount = +String(m[1]).replace(",", ".");

  /* 252615551234, +252 61 555 1234, 0615551234, or a bare 615551234 */
  m = s.match(/(?:\+?252|00252|\b0)?(6[0-9]{8}|9[0-9]{8}|7[0-9]{8})\b/);
  if (m) out.payer = "252" + m[1];

  /* the operator's transaction id, however they label it; trailing punctuation is not part of it */
  const clean = v => String(v).replace(/[^A-Za-z0-9]+$/, "");
  m = s.match(/\b(?:ref(?:erence)?|txn|transaction(?:\s*id)?|trx|receipt|tid|lambarka\s*macaamilka)\b[^A-Za-z0-9]{0,4}([A-Za-z0-9._-]{4,40})/i);
  if (m) out.reference = clean(m[1]);
  else {
    /* fall back to a long number, but never the payer's own phone wearing a different hat */
    const digits = (out.payer || "").slice(3);
    const longs = s.match(/\b[0-9]{8,20}\b/g) || [];
    const pick = longs.find(n => n !== digits && !("252" + digits).includes(n) && n !== out.payer);
    if (pick) out.reference = pick;
  }

  m = s.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]{2,40})/i) || s.match(/\(([A-Za-z][A-Za-z .'-]{2,40})\)/);
  if (m) out.payerName = m[1].trim();

  return out;
}

/* Only ever auto-credits when the money and the person both line up.
   Amount alone is never enough: a catalogue with a $10 median will happily produce two customers owing the same
   figure within the same minute, and crediting the wrong one is worse than crediting neither.

   A basket is one wallet transaction but several orders. The customer taps once and pays $34; the database holds
   $7, $13 and $14. Matching only on a single order's total therefore misses every multi-item purchase, which is
   the normal case rather than an edge — so baskets are matched on their summed total and credited together. */
async function matchSms(env, sms) {
  if (!sms.receipt) return { state: "IGNORED", orders: [], why: "not a payment message" };
  if (!(sms.amount > 0)) return { state: "REVIEW", orders: [], why: "no amount" };
  const cents = Math.round(sms.amount * 100);
  const phoneOf = o => [normPhone(o.pay_phone), normPhone(o.user_phone)].filter(Boolean);

  /* a whole basket, summed, still entirely unpaid */
  const baskets = (await env.DB.prepare(
    `SELECT o.basket, SUM(o.total) AS sum_total, COUNT(*) AS n,
            MAX(o.pay_phone) AS pay_phone, MAX(u.phone) AS user_phone
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.basket IS NOT NULL AND o.state = 'AWAITING_PAYMENT'
      GROUP BY o.basket
     HAVING CAST(ROUND(SUM(o.total) * 100) AS INTEGER) = ?
      LIMIT 10`).bind(cents).all()).results;

  /* or a single order bought on its own */
  const singles = (await env.DB.prepare(
    `SELECT o.*, u.phone AS user_phone FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.state = 'AWAITING_PAYMENT' AND o.basket IS NULL
        AND CAST(ROUND(o.total * 100) AS INTEGER) = ?
      ORDER BY o.created_at DESC LIMIT 10`).bind(cents).all()).results;

  const cand = [
    ...baskets.map(b => ({ kind: "basket", key: b.basket, phones: phoneOf(b) })),
    ...singles.map(o => ({ kind: "order", key: o.id, phones: phoneOf(o) }))
  ];
  if (!cand.length) return { state: "NEW", orders: [], why: "no order or basket for that amount" };

  const load = async c => (await env.DB.prepare(
    c.kind === "basket"
      ? "SELECT * FROM orders WHERE basket = ? AND state = 'AWAITING_PAYMENT'"
      : "SELECT * FROM orders WHERE id = ? AND state = 'AWAITING_PAYMENT'").bind(c.key).all()).results;

  if (sms.payer) {
    const exact = cand.filter(c => c.phones.includes(sms.payer));
    if (exact.length === 1) return { state: "MATCHED", orders: await load(exact[0]), why: "amount and payer", ref: exact[0].key };
    if (exact.length > 1) return { state: "REVIEW", orders: [], why: "same payer, same amount, more than one purchase" };
  }
  /* right money, wrong or missing number: somebody paid from a relative's phone, which is ordinary here and
     still needs a person to look at it */
  return {
    state: "REVIEW",
    orders: cand.length === 1 ? await load(cand[0]) : [],
    why: sms.payer ? "payer does not match" : "no payer in message",
    ref: cand.length === 1 ? cand[0].key : null
  };
}

/* ---------------------------------------------------------------- shipping manifest
   What a forwarder and a customs broker ask for, per line, per consignment.

   A manifest line is created the moment an order is paid, from the catalogue's own record of the goods, so the
   declaration is built from what we sold rather than reconstructed months later from memory. Everything the
   catalogue does not know arrives as null or "unknown" and is visible as a gap, because the alternative — filling
   it with a plausible default — is inventing a customs declaration.

   UN numbers follow the battery status: UN3480 is a loose cell or a power bank, UN3481 is a battery inside or
   packed with equipment. Nothing here guesses which: it reads what a person recorded against the product. */
const STATES_OK = ["CREATED", "BOOKED", "PICKED_UP", "IN_TRANSIT", "CUSTOMS", "ARRIVED", "DELIVERED", "CANCELLED", "FAILED"];
const UN_FOR = { standalone: "UN3480", in_equipment: "UN3481", with_equipment: "UN3481" };

function manifestFromOrder(env, o, t) {
  const c = CATALOG[o.sku] || {};
  const sh = c.ship || {};
  const d = sh.dims || [];
  const battery = sh.battery || "unknown";
  /* Declared value is the goods value, not what the customer paid. Duty is assessed on the goods plus freight,
     and declaring the retail price would have Garsoore paying duty on its own margin. */
  const v = (c.variants || []).filter(x => x.vsku === o.vsku)[0];
  const declared = v && v.cny ? +((v.cny / FX) * o.qty).toFixed(2) : null;
  return env.DB.prepare(`INSERT INTO manifest_lines
    (id,consignment,order_id,po_id,sku,product_id,description,category,hs_code,origin,qty,packages,unit,
     weight_kg,length_cm,width_cm,height_cm,declared_value,currency,battery,un_number,hazmat,state,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'USD', ?,?,?, 'DRAFT', ?,?)`).bind(
    rid("ML-", 6), null, o.id, null, o.sku, c.ref || null,
    (sh.desc || c.title || o.title).slice(0, 200), c.cat || null, sh.hs || null, sh.origin || "CN",
    o.qty, null, "pieces",
    c.kg ? +(c.kg * o.qty).toFixed(3) : null,
    d[0] || null, d[1] || null, d[2] || null,
    declared, battery, UN_FOR[battery] || null,
    (sh.hazmat || []).join("|") || null, t, t);
}

/* The manifest as the forwarder receives it. Also the screen that shows what is NOT yet known, because a line
   with an unresolved battery status is the one that stops a consignment at the airport. */
async function manifestOut(env, where, binds) {
  const rows = (await env.DB.prepare(
    `SELECT * FROM manifest_lines ${where} ORDER BY created_at ASC LIMIT 500`).bind(...binds).all()).results;
  const lines = rows.map(r => ({
    id: r.id, consignment: r.consignment, orderId: r.order_id, sku: r.sku, productId: r.product_id,
    description: r.description, category: r.category, hsCode: r.hs_code, origin: r.origin,
    qty: r.qty, packages: r.packages, unit: r.unit,
    weightKg: r.weight_kg, dims: (r.length_cm && r.width_cm && r.height_cm) ? [r.length_cm, r.width_cm, r.height_cm] : null,
    declaredValue: r.declared_value, currency: r.currency,
    actualKg: r.actual_kg, actualCbm: r.actual_cbm, actualPackages: r.actual_packages,
    battery: r.battery, unNumber: r.un_number, hazmat: r.hazmat ? r.hazmat.split("|") : [],
    dgDeclared: !!r.dg_declared, state: r.state, note: r.note, at: r.created_at
  }));
  const gaps = {
    battery: lines.filter(l => l.battery === "unknown").length,
    hsCode: lines.filter(l => !l.hsCode).length,
    dimensions: lines.filter(l => !l.dims).length,
    weight: lines.filter(l => !l.weightKg).length,
    packages: lines.filter(l => !l.packages).length,
    declaredValue: lines.filter(l => l.declaredValue == null).length,
    dgUndeclared: lines.filter(l => l.unNumber && !l.dgDeclared).length
  };
  return {
    lines,
    totals: {
      lines: lines.length,
      qty: lines.reduce((a, l) => a + (l.qty || 0), 0),
      declaredValue: +lines.reduce((a, l) => a + (l.declaredValue || 0), 0).toFixed(2),
      weightKg: +lines.reduce((a, l) => a + (l.weightKg || 0), 0).toFixed(3),
      currency: "USD"
    },
    gaps,
    /* One sentence an operator can act on, rather than seven counters they have to interpret. */
    ready: gaps.battery === 0 && gaps.hsCode === 0 && gaps.dgUndeclared === 0
  };
}

/* CSV in the shape a forwarder will actually accept, because every one of them wants a spreadsheet. */
function manifestCsv(m) {
  const head = ["sku", "product_id", "description", "category", "hs_code", "origin", "qty", "unit", "packages",
    "weight_kg", "length_cm", "width_cm", "height_cm", "declared_value", "currency",
    "battery", "un_number", "hazmat", "order_id"];
  const esc = s => {
    const v = s == null ? "" : String(s);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const body = m.lines.map(l => [l.sku, l.productId, l.description, l.category, l.hsCode, l.origin, l.qty, l.unit,
    l.packages, l.weightKg, l.dims ? l.dims[0] : "", l.dims ? l.dims[1] : "", l.dims ? l.dims[2] : "",
    l.declaredValue, l.currency, l.battery, l.unNumber, l.hazmat.join("|"), l.orderId].map(esc).join(","));
  return [head.join(","), ...body].join("\n");
}

/* Everything that happens the moment money is confirmed, in one place.
   Two paths reach it now - a member of staff verifying a payment by eye, and WaafiPay telling us the wallet
   debited - and they must do exactly the same thing. When this logic lived inside the staff handler, an automatic
   payment would have quietly skipped the treasury entry and the purchase order. */
async function placeStmts(env, o, t, by) {
  const h = J(o.history) || [];
  h.push({ state: "PLACED", at: t, by });
  const stmts = [
    env.DB.prepare("UPDATE orders SET state = 'PLACED', escrow = 'held', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, o.id),
    notify(env, o.user_id, "order", "Lacagtaadu waa la hubiyay", o.title + " — Garsoore ayaa lacagta hayn doona ilaa aad alaabta qaadato.", "orders.html"),
    /* the mobile-money payment is now real cash in the Somali pool. Escrow says whose it is;
       the treasury says where it physically sits, and those are different questions. */
  ];
  /* Only real money reaches the treasury. An order covered by credit or a discount moves nothing into the Somali
     pool, and a zero-value collection row would be a transaction that never happened sitting in the books. */
  if (+o.total > 0) stmts.push(
    env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'SO_USD', 'collection', ?,?,?,?)")
      .bind(rid("TR-", 6), t, +(+o.total).toFixed(2), o.id, (o.pay || "mobile money") + " · " + (o.pay_txn || ""), by));
  /* a paid China order becomes a purchase task for the buying agent (FBG stock and local goods need none) */
  if (o.flow === "china" && !o.fbg_id) {
    const cat = CATALOG[o.sku], v = cat && cat.variants.filter(x => x.vsku === o.vsku)[0];
    const done = await env.DB.prepare("SELECT 1 FROM procurement WHERE order_id = ?").bind(o.id).first();
    if (!done) stmts.push(env.DB.prepare(`INSERT INTO procurement (id,order_id,user_id,sku,vsku,title,qty,platform,source_url,supplier,target_cny,state,history,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'QUEUED', ?, ?, ?)`).bind(rid("PO-", 6), o.id, o.user_id, o.sku, o.vsku, o.title, o.qty,
      cat ? cat.channel : (o.quote_id ? "quote" : "web"), cat ? cat.url || "" : "", cat ? cat.seller : "",
      v && v.cny ? +(v.cny * o.qty).toFixed(2) : null, JSON.stringify([{ state: "QUEUED", at: t, by }]), t, t));
    /* and the declaration the forwarder will need, built now from what we actually sold rather than
       reconstructed from memory when the cartons are already on a dock */
    const hasML = await env.DB.prepare("SELECT 1 FROM manifest_lines WHERE order_id = ?").bind(o.id).first();
    if (!hasML) stmts.push(manifestFromOrder(env, o, t));
  }
  return stmts;
}

/* ---- what a shipment actually costs Garsoore under the contracted rate card.
   This is the same arithmetic as assets/shipping.js, against the same generated cards, and it exists because the
   consignment ledger must be costed at the contracted rate rather than at the FBG price list. Those are different
   numbers for a good reason: FBG.airPerKg is what Garsoore CHARGES a merchant to move their goods; the rate card is
   what Garsoore PAYS to move anything. Costing our own cargo at the sell price is how a business convinces itself it
   is profitable when it is not. */
export function rateCardFor(mode, at) {
  const when = (at || new Date().toISOString()).slice(0, 10);
  const live = RATES.cards.filter(c => c.mode === mode && c.status !== "expired" && c.effectiveFrom <= when && (!c.effectiveUntil || c.effectiveUntil >= when));
  const pool = live.length ? live : RATES.cards.filter(c => c.mode === mode && c.status !== "expired");
  return pool.sort((a, b) => a.effectiveFrom < b.effectiveFrom ? 1 : -1)[0] || null;
}
/* chargeable BEFORE minimum and rounding — the basis a basket shares its freight out by */
function rawUnits(mode, kg, cbm, card) {
  if (mode === "air") return Math.max(kg, card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0);
  return Math.max(cbm, card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0);
}
function packedCbm(kg, cat) { const d = RATES.packedDensity || {}; return kg / (d[cat] || d._default || 175); }

/* ---- import clearance, mirroring assets/shipping.js against the same generated data.
   Duty is ad valorem on CIF at a rate that depends on the goods. Clearing the consignment is a fixed cost shared
   over the consignment size we expect to move, so a customer pays a share of it rather than the whole bill. */
function dutyRate(cat) {
  const b = (RATES.customs && RATES.customs.dutyBands) || {};
  return b[cat] != null ? b[cat] : (b._default != null ? b._default : PRICING.rules.duty);
}
function clearanceRate(mode) {
  const c = ((RATES.customs && RATES.customs.perConsignment) || {})[mode === "sea" ? "sea" : "air"];
  if (!c || !(c.typical > 0)) return 0;
  const fees = c.fees || {};
  return Object.keys(fees).reduce((n, k) => n + (+fees[k] || 0), 0) / c.typical;
}

/* One line's landed price given its share of the shipment. Mirrors lineTotal() in assets/catalog.js and uses the
   same exported constants, so the cart and the order cannot disagree. */
function lineLanded(costCny, qty, freight, cat, clearance) {
  const R = PRICING.rules, goods = (costCny / PRICING.fx) * Math.max(1, qty), cn = goods * R.cnFreight;
  const rate = dutyRate(cat);
  const duty = (goods + freight) * rate;                      // CIF basis: goods plus the freight that brought them
  const sub = goods + cn + R.consolidation + freight + duty + (clearance || 0);
  const margin = sub * R.margin;
  return { total: Math.ceil(sub + margin), margin, goods, freight, duty, dutyRate: rate, clearance: clearance || 0 };
}

/* Freight for a whole basket: one shipment per lane, shared out by each line's chargeable quantity. */
function basketFreight(lines, at) {
  const groups = {}, shares = {};
  lines.forEach((l, i) => {
    const mode = l.mode === "sea" ? "sea" : "air", kg = (l.kg || 0) * Math.max(1, l.qty || 1);
    (groups[mode] = groups[mode] || { idx: [], kg: 0, cbm: 0 });
    const cbm = packedCbm(kg, l.cat);
    groups[mode].idx.push({ i, kg, cbm });
    groups[mode].kg += kg; groups[mode].cbm += cbm;
  });
  const out = { groups: {}, shares };
  for (const mode of Object.keys(groups)) {
    const g = groups[mode], q = shipCost(mode, g.kg, g.cbm, at);
    if (!q) continue;
    const card = RATES.cards.find(c => c.id === q.rateCardId);
    const units = g.idx.map(x => Math.max(rawUnits(mode, x.kg, x.cbm, card), 1e-9));
    const totalUnits = units.reduce((a, b) => a + b, 0) || 1;
    const clr = Math.round(clearanceRate(mode) * q.chargeable * 100) / 100;
    let allocated = 0, allocatedClr = 0, biggest = 0;
    units.forEach((u, k) => { if (u > units[biggest]) biggest = k; });
    g.idx.forEach((x, k) => {
      const share = Math.round(q.cost * units[k] / totalUnits * 100) / 100;
      const cshare = Math.round(clr * units[k] / totalUnits * 100) / 100;
      shares[x.i] = { mode, freight: share, clearance: cshare };
      allocated += share; allocatedClr += cshare;
    });
    const drift = Math.round((q.cost - allocated) * 100) / 100;
    if (drift !== 0) shares[g.idx[biggest].i].freight = Math.round((shares[g.idx[biggest].i].freight + drift) * 100) / 100;
    const cdrift = Math.round((clr - allocatedClr) * 100) / 100;
    if (cdrift !== 0) shares[g.idx[biggest].i].clearance = Math.round((shares[g.idx[biggest].i].clearance + cdrift) * 100) / 100;
    q.clearance = clr;
    out.groups[mode] = q;
  }
  return out;
}

export function shipCost(mode, kg, cbm, at, cardId) {
  const card = cardId ? RATES.cards.find(c => c.id === cardId) : rateCardFor(mode, at);
  if (!card) return null;
  kg = +kg || 0; cbm = +cbm || 0;
  let chargeable;
  if (card.mode === "air") chargeable = Math.max(kg, card.volumetricDivisor > 0 ? (cbm * 1e6) / card.volumetricDivisor : 0);
  else chargeable = Math.max(cbm, card.weightCapPerCbm > 0 ? kg / card.weightCapPerCbm : 0);
  /* Pooling — the mirror of assets/shipping.js bulk(). A shipment minimum belongs to the consignment a week of
     orders leaves in, not to one customer's basket. These two calculations must agree to the cent or the price the
     customer was shown and the price the order is written at will differ. */
  const typical = +card.typicalConsignment || 0, pooled = typical > 0 && chargeable < typical;
  let rate, cost;
  if (pooled) {
    const units = chargeable;
    rate = card.tiers[0].rate;
    card.tiers.forEach(t => { if (typical >= t.from) rate = t.rate; });
    const consCost = Math.max(rate * typical, card.minimumCharge || 0);
    cost = consCost * (units / typical);
    chargeable = Math.round(units * 1000) / 1000;
  } else {
    chargeable = Math.max(chargeable, card.minimumBillable || 0);
    const step = card.roundingUnit || 0;
    if (step > 0) chargeable = Math.ceil(chargeable / step - 1e-9) * step;
    rate = card.tiers[0].rate;
    card.tiers.forEach(t => { if (chargeable >= t.from) rate = t.rate; });
    cost = Math.max(rate * chargeable, card.minimumCharge || 0);
  }
  return { cost: Math.round(cost * 100) / 100, chargeable: Math.round(chargeable * 1000) / 1000, rate, unit: card.unit,
    rateCardId: card.id, rateCardStatus: card.status, transitMin: card.transitMinDays, transitMax: card.transitMaxDays };
}
/* the customer's view of a sourcing request. `supplier` is deliberately absent: who the agent found is Garsoore's
   procurement relationship, exactly as it is for Official Procurement. */
const srcOut = r => ({ id: r.id, state: r.state, title: r.title, url: r.url, platform: r.platform, qty: r.qty, unit: r.unit,
  targetUnit: r.target_unit, goodsEst: r.goods_est, city: r.city, notes: r.notes,
  depositDue: r.deposit_due, depositPaid: r.deposit_paid, depositAt: r.deposit_at, depositTxn: r.deposit_txn, waived: !!r.waived,
  quoteUnit: r.quote_unit, quoteGoods: r.quote_goods, quoteShip: r.quote_ship, quoteTotal: r.quote_total,
  quoteEta: r.quote_eta, quoteNote: r.quote_note, quotedAt: r.quoted_at,
  forfeit: r.forfeit, refund: r.refund, closeReason: r.close_reason, orderId: r.order_id,
  history: J(r.history) || [], createdAt: r.created_at, updatedAt: r.updated_at });

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
    /* the ceiling has to clear the largest supplier minimum in the catalogue, or a 100-piece MOQ is unorderable */
    if (!(qty >= 1 && qty <= 9999)) throw new Error("Tirada alaabta ma saxna.");
    if (it.quote) {
      const q = await env.DB.prepare("SELECT * FROM quotes WHERE id = ? AND status = 'quoted' AND (user_id = ? OR user_id IS NULL)").bind(String(it.quote), user.id).first();
      if (!q) throw new Error("Qiimahan rasmiga ah lama helin ama wuu dhacay.");
      out.push({ sku: "GRS-Q-" + q.id.slice(2), vsku: q.id, quoteId: q.id, title: q.title, icon: q.icon || "📦", variant: "", qty, unit: q.total, lineTotal: q.total * qty, etaDays: q.eta_days || 20, flow: "china", cogs: null, quoted: true });
      continue;
    }
    if (it.fbg) {                      // someone else's stock, held in the Garsoore warehouse (FBG)
      const iv = await env.DB.prepare("SELECT * FROM fbg_inventory WHERE id = ? AND disposition = 'listed'").bind(String(it.fbg)).first();
      if (!iv) return Promise.reject(new Error("Alaabtan hadda lama iibinayo."));
      if (iv.qty_available < qty) throw new Error("Kaydka: " + iv.qty_available + " ayaa hadhay.");
      if (iv.user_id === user.id) throw new Error("Alaabtaada adigu ma iibsan kartid.");
      out.push({ sku: iv.id, vsku: null, fbgId: iv.id, ownerId: iv.user_id, title: iv.title, icon: iv.icon || "📦", variant: "",
        qty, unit: iv.price, lineTotal: iv.price * qty, etaDays: 0, flow: "local", cogs: null, seller: "FBG" });
      continue;
    }
    const p = CATALOG[it.sku], v = p && p.variants[Math.floor(+it.vi || 0)];
    if (!p || !v) throw new Error("Alaab lama helin: " + String(it.sku).slice(0, 30));
    if (v.total == null) throw new Error("Alaabtan qiimo rasmi ah weli ma leh — codso qiimo.");
    // launch switch: never sell at a placeholder cost. Unverified products go through a staff quote instead.
    if (env.REQUIRE_VERIFIED === "1" && !p.verified) throw new Error("Qiimaha alaabtan waa la hubinayaa — codso qiimo rasmi ah.");
    /* The customer picks air or sea; a lane this product does not have is refused rather than silently swapped,
       because a silent swap is how somebody pays for air and waits six weeks. Pricing itself waits until the whole
       basket is known: freight is charged once per shipment, not once per line. */
    /* Garsoore buys only after the customer buys, so the supplier's minimum is a hard limit on what can be sold.
       Selling one of a 100-piece minimum means taking the money and then cancelling from Guangzhou. */
    const moq = Math.max(1, +p.moq || 1);
    if (!v.local && qty < moq) throw new Error("Alaabtan waxaa laga iibiyaa ugu yaraan " + moq + " xabbo.");
    const want = it.mode === "air" || it.mode === "sea" ? it.mode : null;
    if (want && v.lanes && !v.lanes[want]) throw new Error("Habkan rarka alaabtan looma heli karo.");
    const mode = want || v.mode || null;
    out.push({ sku: it.sku, vsku: v.vsku, title: p.title, icon: p.icon, variant: [v.label, v.color].filter(x => x && x !== "—" && x !== "Standard").join(" · "),
      qty, unit: v.total, lineTotal: null, etaDays: v.local ? 0 : v.etaDays, flow: v.local ? "local" : "china",
      cogs: v.cogs, seller: p.seller,
      shipMode: v.local ? null : mode, rateCardId: null, shipCost: null, transitMin: null, transitMax: null,
      _cny: v.cny, _kg: p.kg, _cat: p.cat, _local: !!v.local });
  }

  /* ---- one shipment per lane, priced once, shared out. This is what makes ten light things affordable: the minimum
     charge is paid by the basket, not by every line in it. */
  const ship = [];
  out.forEach((o, i) => { if (!o._local && o.shipMode && o._cny > 0 && o._kg > 0) ship.push({ i, kg: o._kg, cat: o._cat, qty: o.qty, mode: o.shipMode }); });
  if (ship.length) {
    const bf = basketFreight(ship.map(x => ({ kg: x.kg, cat: x.cat, qty: x.qty, mode: x.mode })));
    ship.forEach((x, k) => {
      const sh = bf.shares[k], o = out[x.i];
      if (!sh) throw new Error("Rarka alaabtan lama qiimayn karo — codso qiimo.");
      const g = bf.groups[sh.mode], L = lineLanded(o._cny, o.qty, sh.freight, o._cat, sh.clearance);
      o.lineTotal = L.total;
      o.unit = Math.round(L.total / o.qty * 100) / 100;
      o.cogs = Math.round((L.total - L.margin) / o.qty * 100) / 100;
      o.shipCost = sh.freight;
      o.rateCardId = g.rateCardId;
      o.transitMin = g.transitMin || null; o.transitMax = g.transitMax || null;
      o.etaDays = g.transitMax || o.etaDays || 20;
    });
  }
  out.forEach(o => {
    if (o.lineTotal == null) o.lineTotal = o.unit * o.qty;         // domestic / fixed-price lines
    delete o._cny; delete o._kg; delete o._cat; delete o._local;
  });
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
    if (path === "/config") return json({ requireVerified: env.REQUIRE_VERIFIED === "1", autoPay: waafiOn(env), agent: AGENT, fbg: FBG, services: SERVICES, sourcing: SOURCING, plans: PLANS,
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
    /* Ingest. Called by the forwarder app on the handset that holds the Garsoore merchant line.
       Public by necessity - a phone cannot hold a session - so the shared secret is the ONLY thing standing
       between a stranger and a free order. It is compared in constant time, the sender id must look like the
       operator, and every message is deduplicated by hash so a forwarder retrying cannot credit twice. */
    if (path === "/pay/sms" && M === "POST") {
      const key = env.SMS_INGEST_KEY;
      if (!key) return err("SMS ingestion is not enabled.", 503);
      const given = req.headers.get("x-garsoore-key") || "";
      if (!timingSafeEq(given, key)) return err("Unauthorised.", 401);

      const b = await body(req);
      const smsBody = String(b.text || b.body || "").slice(0, 1000);
      if (smsBody.length < 8) return err("Empty message.");
      const sender = String(b.from || b.sender || "").slice(0, 40);
      /* Only the operator sends payment confirmations. Anything else is somebody's cousin or a marketing blast,
         and letting those through the parser is how a promotional message becomes a paid order. */
      if (env.SMS_SENDER_ALLOW && !env.SMS_SENDER_ALLOW.split(",").some(a => sender.toLowerCase().includes(a.trim().toLowerCase())))
        return json({ ok: true, ignored: "sender not allowed" });

      const receivedAt = String(b.receivedAt || b.at || new Date().toISOString()).slice(0, 40);
      const smsHash = await sha(sender + "|" + smsBody + "|" + receivedAt);
      const dup = await env.DB.prepare("SELECT id, state, order_id FROM payment_sms WHERE sms_hash = ?").bind(smsHash).first();
      if (dup) return json({ ok: true, duplicate: true, id: dup.id, state: dup.state });

      const t = now(), id = rid("PS-", 6);
      const p = parsePaymentSms(smsBody);
      const sms = { id, amount: p.amount, payer: p.payer, reference: p.reference, receipt: p.receipt };
      const mr = await matchSms(env, sms);

      const ref = mr.ref || (mr.orders[0] && mr.orders[0].id) || null;
      const stmts = [env.DB.prepare(`INSERT INTO payment_sms
        (id,received_at,ingested_at,sender,body,sms_hash,amount,currency,payer,payer_name,reference,state,order_id,matched_at,matched_by)
        VALUES (?,?,?,?,?,?,?, 'USD', ?,?,?,?,?,?,?)`).bind(
        id, receivedAt, t, sender, smsBody, smsHash, p.amount, p.payer, p.payerName, p.reference,
        mr.state, ref, mr.state === "MATCHED" ? t : null, mr.state === "MATCHED" ? "sms" : null)];

      if (mr.state === "MATCHED") {
        /* one wallet debit, every order in the basket: the customer paid once and should not be chased for
           the other two lines of their own purchase */
        for (const o of mr.orders) {
          o.pay_txn = p.reference || id;
          stmts.push(env.DB.prepare("UPDATE orders SET pay_txn = ? WHERE id = ?").bind(o.pay_txn, o.id));
          stmts.push(...(await placeStmts(env, o, t, "sms")));
        }
      }
      await env.DB.batch(stmts);
      return json({ ok: true, id, state: mr.state, why: mr.why, ref, orders: mr.orders.map(o => o.id) });
    }

    /* "I forgot my PIN". Deliberately says the same thing whether or not the number has an account: answering
       truthfully would turn this into a way to test which phone numbers are Garsoore customers. Nothing is changed
       here — it only puts the request in front of a human who will ring the number back. */
    if (path === "/auth/forgot" && M === "POST") {
      const b = await body(req), phone = normPhone(b.phone);
      if (!phone) return err("Ku qor lambarkaaga taleefanka.");
      const said = { ok: true, message: "Haddii lambarkani akoon leeyahay, shaqaale Garsoore ah ayaa ku soo wacaya si uu kuu caawiyo." };
      const recent = await env.DB.prepare("SELECT COUNT(*) n FROM pin_resets WHERE phone = ? AND at > ?").bind(phone, new Date(Date.now() - 36e5).toISOString()).first();
      if (recent.n >= 3) return json(said);                      // quietly stop someone hammering it
      const u = await env.DB.prepare("SELECT id, name FROM users WHERE phone = ?").bind(phone).first();
      await env.DB.prepare("INSERT INTO pin_resets (id, user_id, phone, at, state) VALUES (?,?,?,?, 'open')")
        .bind(rid("PR-", 6), u ? u.id : null, phone, now()).run();
      return json(said);
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
      const sub = items.reduce((s, i) => s + (i.lineTotal != null ? i.lineTotal : i.unit * i.qty), 0);
      let pct = 0, cap = Infinity;
      if (b.promo) { const p = await promoRate(env, user, b.promo); if (!p) return err("Koodhkan ma shaqaynayo."); if (p.error) return err(p.error); pct = p.pct; cap = p.cap; }
      let discLeft = Math.min(Math.round(sub * pct), cap);
      const fee = delivery && sub < ECON.freeDeliveryOver ? ECON.deliveryFee : 0;
      let creditLeft = b.useCredit ? Math.min(user.credit, sub - discLeft + fee) : 0;
      const creditTotal = creditLeft;
      const basket = items.length > 1 ? rid("B-", 6) : null, t = now(), stmts = [], orders = [];
      /* orders born PLACED because credit or a discount covered them: they skip the payment step, and therefore
         skip everything the payment step sets up */
      const freeOrders = [];
      items.forEach((it, k) => {
        const gross = it.lineTotal != null ? it.lineTotal : it.unit * it.qty;
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
          /* shipCost is this LINE's whole share of the shipment, not a per-unit figure, so it is stored as-is */
          it.shipMode || null, it.rateCardId || null, it.shipCost != null ? it.shipCost : null, it.transitMin || null, it.transitMax || null));
        orders.push(o.id);
      });
      if (creditTotal) stmts.push(env.DB.prepare("UPDATE users SET credit = credit - ? WHERE id = ? AND credit >= ?").bind(creditTotal, user.id, creditTotal));
      /* save what they just used, so the next checkout is two taps */
      stmts.push(env.DB.prepare("UPDATE users SET pay_method = ?, pay_phone = ?, address = COALESCE(NULLIF(?, ''), address) WHERE id = ?").bind(b.pay, payPhone, delivery ? address : "", user.id));
      stmts.push(env.DB.prepare("INSERT INTO events (name, sid, at) VALUES ('order', ?, ?)").bind(String(b.sid || "").slice(0, 40), t));
      await env.DB.batch(stmts);
      /* Free to us is not free to ship. An order covered entirely by credit still has to be bought in China and
         declared to a carrier, so it gets the same purchase order and manifest line a paid one would. Without
         this it is a real order that procurement and the forwarder never see. */
      if (freeOrders.length) {
        const rows = (await env.DB.prepare(
          `SELECT * FROM orders WHERE id IN (${freeOrders.map(() => "?").join(",")})`).bind(...freeOrders).all()).results;
        const after = [];
        for (const o of rows) after.push(...(await placeStmts(env, o, t, "credit")));
        if (after.length) await env.DB.batch(after);
      }
      const amount = sub - Math.min(Math.round(sub * pct), cap) + fee - creditTotal;
      return json({ ids: orders, basket, amount, pay: b.pay, merchant: merchants(env)[b.pay] || "", reference: basket || orders[0], expiresHours: ECON.unpaidHours, payPhone: b.payPhone || "" });
    }
    /* Automatic wallet payment. Replaces the whole PAYMENT_REVIEW detour when it is switched on: the wallet
       either debited or it did not, so there is no transaction ID for anyone to invent and nothing for staff to
       check by eye. Falls back to the manual flow whenever the credentials are absent. */
    if (path === "/orders/evc" && M === "POST") {
      if (!waafiOn(env)) return err("Lacag bixinta tooska ah weli lama furin.", 503);
      const b = await body(req), t = now();
      const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 20).map(String);
      if (!ids.length) return err("Dalab lama helin.");
      const rows = (await env.DB.prepare(
        `SELECT * FROM orders WHERE user_id = ? AND state = 'AWAITING_PAYMENT' AND id IN (${ids.map(() => "?").join(",")})`
      ).bind(user.id, ...ids).all()).results;
      if (!rows.length) return err("Dalabkan horey ayaa la bixiyay ama lama helin.");
      const amount = rows.reduce((a, o) => a + (+o.total || 0), 0);
      if (!(amount > 0)) return err("Qiimaha dalabku ma saxna.");
      const phone = b.phone || rows[0].pay_phone || user.phone;
      const reference = String(rows[0].basket || rows[0].id);

      /* Claim the orders BEFORE asking the wallet for money. Two taps arriving together would otherwise both see
         AWAITING_PAYMENT and both debit the customer. Moving them to PAYMENT_REVIEW first means the second request
         finds nothing to charge; if this Worker dies mid-flight the orders sit in a state staff already handle,
         which is a visible problem rather than a silent double charge. */
      const claim = await env.DB.prepare(
        `UPDATE orders SET state = 'PAYMENT_REVIEW', updated_at = ? WHERE user_id = ? AND state = 'AWAITING_PAYMENT' AND id IN (${ids.map(() => "?").join(",")})`
      ).bind(t, user.id, ...ids).run();
      if (!claim.meta || !claim.meta.changes) return err("Dalabkan horey ayaa la bixiyay ama waa la bixinayaa.");

      const res = await waafiPurchase(env, { phone, amount, reference, description: "Garsoore " + reference });
      if (!res.ok) {
        /* hand them back so the customer can try again or pay the manual way - unless we genuinely do not know
           whether the wallet debited, in which case they stay claimed for staff to settle against the statement */
        if (!res.unknown) await env.DB.prepare(
          `UPDATE orders SET state = 'AWAITING_PAYMENT', updated_at = ? WHERE user_id = ? AND state = 'PAYMENT_REVIEW' AND id IN (${ids.map(() => "?").join(",")})`
        ).bind(now(), user.id, ...ids).run();
        await env.DB.prepare("INSERT INTO events (name, sid, at) VALUES ('pay_fail', ?, ?)").bind(String(b.sid || "").slice(0, 40), t).run();
        return err(res.message, res.unknown ? 502 : 402);
      }
      /* one wallet debit covers the basket, so tag every order in it with the same gateway transaction */
      const stmts = [];
      for (const o of rows) {
        o.pay_txn = res.txn;
        stmts.push(env.DB.prepare("UPDATE orders SET pay_txn = ? WHERE id = ?").bind(res.txn, o.id));
        stmts.push(...(await placeStmts(env, o, t, "WaafiPay")));
      }
      stmts.push(env.DB.prepare("INSERT INTO events (name, sid, at) VALUES ('paid', ?, ?)").bind(String(b.sid || "").slice(0, 40), t));
      await env.DB.batch(stmts);
      return json({ ok: true, txn: res.txn, ids: rows.map(o => o.id), amount: +amount.toFixed(2) });
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

    /* ---------------------------------------------------------------- managed sourcing (customer) */
    if (path === "/sourcing" && M === "GET") {
      const r = await env.DB.prepare("SELECT * FROM sourcing WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
      return json({ requests: r.results.map(x => srcOut(x)), sub: { active: subActive(user), until: user.sub_until || null }, terms: SOURCING });
    }
    if (path === "/sourcing" && M === "POST") {
      const b = await body(req), t = now();
      const title = String(b.title || "").trim().slice(0, 200);
      if (title.length < 3) return err("Sharax waxa aad rabto.");
      const qty = Math.max(1, Math.min(1000000, Math.round(+b.qty || 0)));
      if (!(qty >= 1)) return err("Ku qor tirada aad rabto.");
      const goods = Math.round((+b.goodsEst || 0) * 100) / 100;
      if (!(goods > 0)) return err("Ku qor qiyaasta qiimaha alaabta (lacagta rarka ha ku darin).");
      const waived = subActive(user, t);
      /* the deposit is a share of the GOODS only — shipping is quoted later and never sits in the deposit base */
      const due = waived ? 0 : Math.max(SOURCING.minDeposit, Math.round(goods * SOURCING.depositPct) / 100);
      const id = rid("SR-", 6);
      await env.DB.prepare(`INSERT INTO sourcing (id,user_id,created_at,updated_at,state,title,url,platform,qty,unit,target_unit,goods_est,city,notes,deposit_due,waived,history)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, user.id, t, t, waived ? "SOURCING" : "AWAITING_DEPOSIT", title,
        /^https?:\/\//.test(b.url || "") ? String(b.url).slice(0, 500) : null, String(b.platform || "").slice(0, 20) || null,
        qty, String(b.unit || "xabbo").slice(0, 20), +b.targetUnit || null, goods,
        String(b.city || "Muqdisho").slice(0, 60), String(b.notes || "").slice(0, 800) || null,
        due, waived ? 1 : 0, JSON.stringify([{ state: waived ? "SOURCING" : "AWAITING_DEPOSIT", at: t }])).run();
      return json({ id, depositDue: due, waived, terms: SOURCING });
    }
    if ((m = path.match(/^\/sourcing\/(SR-[A-Z0-9]+)\/(deposit|cancel|accept)$/)) && M === "POST") {
      const sr = await env.DB.prepare("SELECT * FROM sourcing WHERE id = ? AND user_id = ?").bind(m[1], user.id).first();
      if (!sr) return err("Codsigan lama helin.", 404);
      const b = await body(req), t = now(), h = J(sr.history) || [];
      if (m[2] === "deposit") {
        if (sr.state !== "AWAITING_DEPOSIT") return err("Codsigan horey ayuu u socdaa.");
        const txn = String(b.txn || "").trim();
        if (!/^[A-Za-z0-9\-. ]{4,40}$/.test(txn)) return err("Ku qor lambarka macaamilka.");
        h.push({ state: "DEPOSIT_SENT", at: t });
        await env.DB.prepare("UPDATE sourcing SET deposit_txn = ?, history = ?, updated_at = ? WHERE id = ?").bind(txn, JSON.stringify(h), t, sr.id).run();
        return json({ ok: true });
      }
      if (m[2] === "cancel") {
        if (["CANCELLED", "UNSOURCEABLE", "ORDERED", "DELIVERED"].includes(sr.state)) return err("Codsigan lama joojin karo hadda.");
        /* the trader is told the exact number before this call, and it is written into the history either way */
        const keep = forfeitOf(sr, t), back = Math.round(((+sr.deposit_paid || 0) - keep) * 100) / 100;
        h.push({ state: "CANCELLED", at: t, by: "customer", forfeit: keep, refund: back });
        await env.DB.prepare("UPDATE sourcing SET state = 'CANCELLED', closed_at = ?, close_reason = ?, forfeit = ?, refund = ?, history = ?, updated_at = ? WHERE id = ?")
          .bind(t, String(b.why || "").slice(0, 300) || "Macmiilku wuu joojiyay", keep, back, JSON.stringify(h), t, sr.id).run();
        return json({ ok: true, forfeit: keep, refund: back });
      }
      if (sr.state !== "QUOTED") return err("Weli qiimo lama soo celin.");
      if (sr.quoted_at && Date.now() - Date.parse(sr.quoted_at) > SOURCING.quoteValidDays * 864e5) return err("Qiimahan wuu dhacay — codso mid cusub.");
      h.push({ state: "ACCEPTED", at: t });
      await env.DB.prepare("UPDATE sourcing SET state = 'ACCEPTED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, sr.id).run();
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

      /* ---------------------------------------------------------------- calibration
         Every consumer price rests on four guesses: the freight rate card, the clearance loading, the packed density
         per category, and the transit window. This compares each against what actually happened on shipments that
         have landed, and says what the number should be instead. It never edits anything — the operator reads the
         suggestion, decides, and edits data/rate-cards.json or data/customs.json by hand, because silently
         re-pricing a catalogue from one noisy sample is how you get a worse guess than you started with. */
      if (path === "/admin/calibration" && M === "GET") {
        const cns = (await env.DB.prepare("SELECT * FROM fbg_consignments WHERE state = 'ARRIVED' ORDER BY updated_at DESC LIMIT 50").all()).results;
        const out = [], density = {}, perCat = {};
        let freightPred = 0, freightReal = 0, clrPred = 0, clrReal = 0, transitN = 0, transitSum = 0, transitPredSum = 0;

        for (const cn of cns) {
          const pred = shipCost(cn.mode, cn.kg, cn.cbm, cn.shipped_at || cn.created_at);
          const clrRate = clearanceRate(cn.mode);
          const clrExpected = pred ? Math.round(clrRate * pred.chargeable * 100) / 100 : null;
          const days = cn.shipped_at && cn.arrived_at
            ? Math.max(0, Math.round((Date.parse(cn.arrived_at) - Date.parse(cn.shipped_at)) / 864e5)) : null;

          if (pred && cn.cost_usd != null) { freightPred += pred.cost; freightReal += cn.cost_usd; }
          if (clrExpected != null && cn.clearance_usd != null) { clrPred += clrExpected; clrReal += cn.clearance_usd; }
          if (days != null && pred) { transitN++; transitSum += days; transitPredSum += pred.transitMax; }

          /* measured density per category, from what the facility actually weighed and measured */
          const items = (await env.DB.prepare("SELECT sku, kg, cbm FROM procurement WHERE consignment = ?").bind(cn.id).all()).results;
          for (const it of items) {
            if (!(it.kg > 0) || !(it.cbm > 0)) continue;
            const cat = (CATALOG[it.sku] || {}).cat || "_unknown";
            (perCat[cat] = perCat[cat] || { kg: 0, cbm: 0, n: 0 });
            perCat[cat].kg += it.kg; perCat[cat].cbm += it.cbm; perCat[cat].n++;
          }

          out.push({ id: cn.id, mode: cn.mode, kg: cn.kg, cbm: cn.cbm,
            shippedAt: cn.shipped_at, arrivedAt: cn.arrived_at, transitDays: days,
            transitPredicted: pred ? [pred.transitMin, pred.transitMax] : null,
            freightPredicted: pred ? pred.cost : null, freightActual: cn.cost_usd,
            chargeable: pred ? pred.chargeable : null, unit: pred ? pred.unit : null,
            clearancePredicted: clrExpected, clearanceActual: cn.clearance_usd,
            dutyActual: cn.duty_usd, note: cn.note });
        }

        const assumed = (RATES.packedDensity || {});
        for (const cat of Object.keys(perCat)) {
          const p = perCat[cat];
          if (!(p.cbm > 0)) continue;
          density[cat] = { measured: Math.round(p.kg / p.cbm), assumed: assumed[cat] || assumed._default || null, items: p.n };
        }

        const pct = (a, b) => b > 0 ? Math.round((a - b) / b * 1000) / 10 : null;
        return json({
          shipments: out,
          samples: out.length,
          freight: { predicted: +freightPred.toFixed(2), actual: +freightReal.toFixed(2), errorPct: pct(freightReal, freightPred) },
          clearance: { predicted: +clrPred.toFixed(2), actual: +clrReal.toFixed(2), errorPct: pct(clrReal, clrPred),
            assumedPerKgAir: Math.round(clearanceRate("air") * 1000) / 1000, assumedPerCbmSea: Math.round(clearanceRate("sea") * 1000) / 1000 },
          transit: transitN ? { samples: transitN, avgActual: Math.round(transitSum / transitN), avgPredictedMax: Math.round(transitPredSum / transitN) } : null,
          density,
          cards: RATES.cards.map(c => ({ id: c.id, mode: c.mode, status: c.status })),
          customsStatus: (RATES.customs || {}).status || "draft"
        });
      }

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
          pro: proActive(u), proUntil: u.sub_until || null,
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
        /* Pro is granted by hand after money arrives, because there is no recurring payment provider yet.
           Months are added to whatever is left, so extending early never costs the member days. */
        if (b.proMonths != null) {
          const n = Math.max(-24, Math.min(24, Math.round(+b.proMonths || 0)));
          const from = target.sub_until && Date.parse(target.sub_until) > Date.now() ? Date.parse(target.sub_until) : Date.now();
          const until = n === 0 ? null : new Date(from + n * 30 * 864e5).toISOString();
          stmts.push(env.DB.prepare("UPDATE users SET sub_until = ? WHERE id = ?").bind(until, target.id),
            alog("user.pro", target.id, n === 0 ? "Pro waa la joojiyay" : n + " bilood → " + (until || "").slice(0, 10)));
          if (n > 0) stmts.push(notify(env, target.id, "money", "Garsoore Business Pro waa shaqeeya",
            "FBG iyo raadin carbuun la\'aan ah ayaad hadda heli kartaa. Waxay dhacaysaa " + (until || "").slice(0, 10) + ".", "pro.html"));
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
    /* what tier am I on, and what does the other one get me */
    if (path === "/plan" && M === "GET") {
      return json({ pro: proActive(user), until: user.sub_until || null, plans: PLANS,
        benefits: { fbg: proActive(user), noDeposit: proActive(user) } });
    }

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
      /* a suite reserves a physical address and space in our consolidations — that is the Pro tier.
         An existing suite keeps working if a membership lapses; we do not strand somebody's goods. */
      if (!proActive(user)) return err("FBG waxaa loo furay Garsoore Business Pro ($" + PLANS.proMonthly + " bishii).", 402);
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
      /* ---------------------------------------------------------------- treasury
         Two pools of money in two currencies, days apart: USD collected in Mogadishu by USSD, and
         CNY sitting in China ready to buy with. This answers the only questions that matter between
         them — how much have we collected, how much is in China, what can we buy right now, and what
         is the remittance actually costing us against the rate the catalogue was priced at. */
      /* ---------------------------------------------------------------- shipments
         A handover: manifest lines leave the China facility with a carrier. Provider-agnostic on purpose, so the
         carrier can be decided after this is built rather than before. */
      if (path === "/ops/shipments" && M === "GET") {
        const rows = (await env.DB.prepare("SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100").all()).results;
        return json({
          providers: providers(env),
          shipments: rows.map(s => ({
            id: s.id, provider: s.provider, providerOrder: s.provider_order, tracking: s.tracking_no,
            labelUrl: s.label_url, routing: s.routing, service: s.service,
            dest: { name: s.dest_name, phone: s.dest_phone, address: s.dest_address, city: s.dest_city, country: s.dest_country },
            packages: s.packages, weightKg: s.weight_kg, cbm: s.cbm,
            declaredValue: s.declared_value, currency: s.currency,
            state: s.state, lastEvent: s.last_event, events: J(s.events) || [], pickup: s.pickup,
            note: s.note, at: s.created_at, updatedAt: s.updated_at
          }))
        });
      }
      /* Create one from manifest lines. Refuses while any line carries an unresolved battery status, because that
         is the declaration a carrier will reject and an airport will hold - better to fail here than on a dock. */
      if (path === "/ops/shipments" && M === "POST") {
        const b = await body(req), t = now();
        const ids = (Array.isArray(b.lines) ? b.lines : []).slice(0, 200).map(String);
        if (!ids.length) return err("Dooro xariiqyada manifest-ka.");
        const lines = (await env.DB.prepare(
          `SELECT * FROM manifest_lines WHERE shipment IS NULL AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results;
        if (!lines.length) return err("Xariiqyadan horey ayaa loo diray.");
        const unresolved = lines.filter(l => l.battery === "unknown");
        if (unresolved.length && !b.force)
          return err(unresolved.length + " xariiq oo xaaladda baytarigoodu aan la garanayn. Dejiso ka hor inta aan la dirin.", 409);

        const P = provider(b.provider || "manual");
        if (!P.configured(env)) return err("Adeeg bixiyahan weli lama furin.", 503);
        const id = rid("SH-", 6);
        const sum = (f) => +lines.reduce((a, l) => a + (+l[f] || 0), 0).toFixed(3);
        const shipment = {
          id, service: ["air", "sea", "express"].includes(b.service) ? b.service : "sea",
          origin: chinaAddress(env, "<consolidation>"),
          dest_name: String(b.destName || "Garsoore Mogadishu").slice(0, 120),
          dest_phone: String(b.destPhone || "").slice(0, 30),
          dest_address: String(b.destAddress || "Km4, Mogadishu").slice(0, 200),
          dest_city: "Mogadishu", dest_country: "SO",
          packages: lines.reduce((a, l) => a + (+l.packages || 1), 0),
          weight_kg: sum("weight_kg"), cbm: sum("actual_cbm"),
          declared_value: sum("declared_value"), currency: "USD"
        };
        let res;
        try { res = await P.create(env, shipment, lines); }
        catch (e) { return err("Adeeg bixiyuhu ma jawaabin: " + String(e.message || e).slice(0, 120), 502); }

        const stmts = [env.DB.prepare(`INSERT INTO shipments
          (id,consignment,provider,provider_order,tracking_no,label_url,routing,service,origin,
           dest_name,dest_phone,dest_address,dest_city,dest_country,packages,weight_kg,cbm,declared_value,currency,
           state,last_event,events,pickup,raw,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'USD', ?,?,?,?,?,?,?)`).bind(
          id, b.consignment || null, P.id, res.providerOrder || null, res.tracking || null, res.labelUrl || null,
          typeof res.routing === "string" ? res.routing : (res.routing ? JSON.stringify(res.routing) : null),
          shipment.service, shipment.origin, shipment.dest_name, shipment.dest_phone, shipment.dest_address,
          shipment.dest_city, shipment.dest_country, shipment.packages, shipment.weight_kg, shipment.cbm,
          shipment.declared_value, normState(res.state), null, "[]",
          res.pickup ? (typeof res.pickup === "string" ? res.pickup : JSON.stringify(res.pickup)) : null,
          res.raw ? JSON.stringify(res.raw).slice(0, 4000) : null, t, t)];
        for (const l of lines) stmts.push(
          env.DB.prepare("UPDATE manifest_lines SET shipment = ?, state = 'DECLARED', updated_at = ? WHERE id = ?").bind(id, t, l.id));
        await env.DB.batch(stmts);
        return json({ id, provider: P.id, tracking: res.tracking, labelUrl: res.labelUrl, state: normState(res.state), lines: lines.length });
      }
      /* Refresh from the carrier, or record by hand what a forwarder said on WhatsApp. Both write the same
         event stream, so the customer's order page cannot tell which kind of carrier is behind it. */
      if ((m = path.match(/^\/ops\/shipments\/(SH-[A-Z0-9]+)$/)) && M === "POST") {
        const s = await env.DB.prepare("SELECT * FROM shipments WHERE id = ?").bind(m[1]).first();
        if (!s) return err("Lama helin.", 404);
        const b = await body(req), t = now();
        let events = J(s.events) || [], state = s.state, last = s.last_event;

        if (b.refresh) {
          const P = provider(s.provider);
          const r = await P.track(env, s).catch(e => ({ state: s.state, events: [], raw: String(e.message || e) }));
          if (r.events && r.events.length) {
            const seen = new Set(events.map(x => (x.at || "") + "|" + (x.text || "")));
            r.events.forEach(x => { if (!seen.has((x.at || "") + "|" + (x.text || ""))) events.push(x); });
            last = r.events[r.events.length - 1].text || last;
          }
          state = normState(r.state);
        }
        if (b.event) {   /* typed in by staff from a forwarder's message */
          events.push({ at: t, code: String(b.event.code || "manual").slice(0, 30),
                        text: String(b.event.text || "").slice(0, 200), place: String(b.event.place || "").slice(0, 80) });
          last = String(b.event.text || "").slice(0, 200);
        }
        const set = ["events = ?", "last_event = ?", "updated_at = ?"], vals = [JSON.stringify(events.slice(-100)), last, t];
        if (b.state && STATES_OK.includes(b.state)) { set.push("state = ?"); vals.push(b.state); state = b.state; }
        else if (b.refresh) { set.push("state = ?"); vals.push(state); }
        [["tracking", "tracking_no"], ["labelUrl", "label_url"], ["routing", "routing"], ["pickup", "pickup"], ["note", "note"], ["providerOrder", "provider_order"]]
          .forEach(([k, col]) => { if (b[k] != null) { set.push(col + " = ?"); vals.push(String(b[k]).slice(0, 400)); } });
        await env.DB.prepare(`UPDATE shipments SET ${set.join(", ")} WHERE id = ?`).bind(...vals, s.id).run();

        /* the customer only ever sees their own order move; the carrier behind it is Garsoore's business */
        if (state === "ARRIVED" || state === "DELIVERED") {
          const mls = (await env.DB.prepare("SELECT DISTINCT order_id FROM manifest_lines WHERE shipment = ? AND order_id IS NOT NULL").bind(s.id).all()).results;
          for (const r of mls) {
            await env.DB.prepare(`UPDATE orders SET state = CASE WHEN state IN ('PLACED','SOURCING','IN_TRANSIT') THEN 'ARRIVED' ELSE state END,
              history = json_insert(history, '$[#]', json(?)), updated_at = ? WHERE id = ?`)
              .bind(JSON.stringify({ state: "ARRIVED", at: t, by: "logistics" }), t, r.order_id).run();
          }
        }
        return json({ ok: true, state });
      }
      if (path === "/ops/manifest" && M === "GET") {
        const cons = url.searchParams.get("consignment");
        const m = cons ? await manifestOut(env, "WHERE consignment = ?", [cons])
                       : await manifestOut(env, "WHERE consignment IS NULL AND state != 'CLEARED'", []);
        if (url.searchParams.get("format") === "csv")
          return new Response(manifestCsv(m), { headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "cache-control": "no-store",
            "Content-Disposition": `attachment; filename="garsoore-manifest-${cons || "open"}.csv"` } });
        return json(m);
      }
      /* Fill in what the catalogue could not know. Staff set the battery status once per product and it is the
         single most important field here: an unresolved one is what stops a consignment at the airport. */
      if ((m = path.match(/^\/ops\/manifest\/(ML-[A-Z0-9]+)$/)) && M === "POST") {
        const row = await env.DB.prepare("SELECT * FROM manifest_lines WHERE id = ?").bind(m[1]).first();
        if (!row) return err("Lama helin.", 404);
        const b = await body(req), t = now(), set = [], vals = [];
        const BAT = ["unknown", "none", "in_equipment", "with_equipment", "standalone"];
        if (b.battery != null) {
          if (!BAT.includes(b.battery)) return err("Xaaladda baytariga ma saxna.");
          set.push("battery = ?", "un_number = ?"); vals.push(b.battery, UN_FOR[b.battery] || null);
        }
        [["hsCode", "hs_code"], ["description", "description"], ["origin", "origin"], ["note", "note"]].forEach(([k, col]) => {
          if (b[k] != null) { set.push(col + " = ?"); vals.push(String(b[k]).slice(0, 200)); }
        });
        [["packages", "packages"], ["actualPackages", "actual_packages"]].forEach(([k, col]) => {
          if (b[k] != null) { set.push(col + " = ?"); vals.push(Math.max(0, Math.round(+b[k] || 0))); }
        });
        [["weightKg", "weight_kg"], ["actualKg", "actual_kg"], ["actualCbm", "actual_cbm"],
         ["declaredValue", "declared_value"], ["lengthCm", "length_cm"], ["widthCm", "width_cm"], ["heightCm", "height_cm"]]
          .forEach(([k, col]) => { if (b[k] != null) { set.push(col + " = ?"); vals.push(+b[k] || null); } });
        if (b.dgDeclared != null) { set.push("dg_declared = ?"); vals.push(b.dgDeclared ? 1 : 0); }
        if (b.consignment != null) { set.push("consignment = ?"); vals.push(String(b.consignment).slice(0, 40) || null); }
        if (b.state != null && ["DRAFT", "DECLARED", "SHIPPED", "CLEARED"].includes(b.state)) { set.push("state = ?"); vals.push(b.state); }
        if (!set.length) return err("Waxba lama beddelin.");
        set.push("updated_at = ?"); vals.push(t);
        await env.DB.prepare(`UPDATE manifest_lines SET ${set.join(", ")} WHERE id = ?`).bind(...vals, row.id).run();
        return json({ ok: true });
      }
      if (path === "/ops/treasury" && M === "GET") {
        const bal = async (acct) => (await env.DB.prepare("SELECT COALESCE(SUM(amount),0) s FROM treasury WHERE account = ?").bind(acct).first()).s;
        const [so, cn] = [await bal("SO_USD"), await bal("CN_CNY")];
        /* purchases waiting on money. A PO is buyable now only if the China float covers it; anything
           past that is the size of the next remittance, not a queue to stare at. */
        const queue = (await env.DB.prepare(`SELECT id, order_id, title, qty, target_cny, state FROM procurement
          WHERE state = 'QUEUED' ORDER BY created_at ASC LIMIT 200`).all()).results;
        let running = 0;
        const tasks = queue.map(q => {
          const need = +q.target_cny || 0;
          const fundable = need > 0 && running + need <= cn;
          if (fundable) running += need;
          return { id: q.id, orderId: q.order_id, title: q.title, qty: q.qty, needCny: need, fundable };
        });
        const needCny = tasks.reduce((a, x) => a + x.needCny, 0);
        const rem = (await env.DB.prepare("SELECT * FROM remittances ORDER BY created_at DESC LIMIT 50").all()).results;
        /* the FX the catalogue assumed vs what remittances really returned, weighted by size. A gap
           here is margin leaving on every order and nobody deciding that it should. */
        const landed = rem.filter(r => r.state === "LANDED" && r.cny_received > 0 && r.usd_sent > 0);
        const sentUsd = landed.reduce((a, r) => a + r.usd_sent + (r.fee_usd || 0), 0);
        const gotCny = landed.reduce((a, r) => a + r.cny_received, 0);
        const realFx = sentUsd > 0 ? gotCny / sentUsd : null;
        const held = (await env.DB.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE escrow = 'held'").first()).s;
        const led = (await env.DB.prepare("SELECT * FROM treasury ORDER BY at DESC LIMIT 60").all()).results;
        return json({
          balances: { soUsd: +so.toFixed(2), cnCny: +cn.toFixed(2), cnUsdAt: realFx ? +(cn / realFx).toFixed(2) : null },
          escrowHeld: +held.toFixed(2),
          queue: { count: tasks.length, needCny: +needCny.toFixed(2), fundableNow: tasks.filter(t => t.fundable).length,
                   shortfallCny: +Math.max(0, needCny - cn).toFixed(2), tasks: tasks.slice(0, 50) },
          fx: { catalogue: FX, actual: realFx ? +realFx.toFixed(4) : null,
                variancePct: realFx ? +(((realFx - FX) / FX) * 100).toFixed(2) : null, sampleUsd: +sentUsd.toFixed(2) },
          remittances: rem.map(r => ({ id: r.id, usdSent: r.usd_sent, feeUsd: r.fee_usd, fx: r.fx, cnyReceived: r.cny_received,
            channel: r.channel, reference: r.reference, state: r.state, note: r.note, at: r.created_at })),
          ledger: led.map(x => ({ id: x.id, at: x.at, account: x.account, kind: x.kind, amount: x.amount, ref: x.ref, note: x.note, by: x.by }))
        });
      }
      /* Money leaves Somalia. It does NOT arrive in China until somebody confirms it did, because a
         hawala can fail and a float that counts unconfirmed money buys things it cannot pay for. */
      if (path === "/ops/treasury/remit" && M === "POST") {
        const b = await body(req), t = now();
        const usd = +b.usd, fee = Math.max(0, +b.fee || 0);
        if (!(usd > 0)) return err("Ku qor lacagta aad dirayso ($).");
        const id = rid("RM-", 6);
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO remittances (id,usd_sent,fee_usd,channel,reference,state,note,by,created_at,updated_at)
            VALUES (?,?,?,?,?, 'SENT', ?,?,?,?)`).bind(id, +usd.toFixed(2), +fee.toFixed(2),
            ["hawala", "bank", "agent", "cash"].includes(b.channel) ? b.channel : "hawala",
            String(b.reference || "").slice(0, 60), String(b.note || "").slice(0, 200), user.name, t, t),
          env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'SO_USD', 'remit_out', ?,?,?,?)")
            .bind(rid("TR-", 6), t, -(+(usd + fee).toFixed(2)), id, "u dir Shiinaha", user.name)
        ]);
        return json({ id });
      }
      if ((m = path.match(/^\/ops\/treasury\/remit\/(RM-[A-Z0-9]+)\/(landed|failed)$/)) && M === "POST") {
        const r = await env.DB.prepare("SELECT * FROM remittances WHERE id = ?").bind(m[1]).first();
        if (!r) return err("Lama helin.", 404);
        if (r.state !== "SENT") return err("Xawaaladdan horey ayaa loo xidhay.");
        const b = await body(req), t = now();
        if (m[2] === "failed") {
          await env.DB.batch([
            env.DB.prepare("UPDATE remittances SET state = 'FAILED', note = ?, updated_at = ? WHERE id = ?").bind(String(b.note || "").slice(0, 200), t, r.id),
            /* the money never left, so put it back rather than leaving a hole in the Somali pool */
            env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'SO_USD', 'adjust', ?,?,?,?)")
              .bind(rid("TR-", 6), t, +(r.usd_sent + (r.fee_usd || 0)).toFixed(2), r.id, "xawaalad guuldareysatay", user.name)
          ]);
          return json({ ok: true });
        }
        const cny = +b.cny;
        if (!(cny > 0)) return err("Ku qor lacagta la helay (¥).");
        const fx = +(cny / (r.usd_sent + (r.fee_usd || 0))).toFixed(4);
        await env.DB.batch([
          env.DB.prepare("UPDATE remittances SET state = 'LANDED', cny_received = ?, fx = ?, updated_at = ? WHERE id = ?").bind(+cny.toFixed(2), fx, t, r.id),
          env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'CN_CNY', 'remit_in', ?,?,?,?)")
            .bind(rid("TR-", 6), t, +cny.toFixed(2), r.id, "waa la helay Shiinaha", user.name)
        ]);
        return json({ ok: true, fx, catalogueFx: FX });
      }
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
            /* what the agent actually spent, out of the China float rather than out of a guess */
            env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'CN_CNY', 'purchase', ?,?,?,?)")
              .bind(rid("TR-", 6), t, -(+paid.toFixed(2)), p.id, p.title, user.name),
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
        /* A supplier that cannot deliver must not leave the customer's order sitting in SOURCING with their money
           held. Cancelling the purchase cancels the order it exists for, puts the escrow into refund_due, gives back
           any store credit they spent, and tells them why — in one batch, so it cannot half-happen. Marking the money
           actually returned stays a separate, deliberate step (/ops/orders/:id/refunded). */
        const why = String(b.note || "").slice(0, 300);
        const ord = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(p.order_id).first();
        const stmts = [env.DB.prepare("UPDATE procurement SET state = 'CANCELLED', note = ?, history = ?, updated_at = ? WHERE id = ?").bind(why, push("CANCELLED"), t, p.id)];
        let refund = false;
        if (ord && !["CANCELLED", "COMPLETED", "EXPIRED"].includes(ord.state)) {
          const oh = J(ord.history) || []; oh.push({ state: "CANCELLED", at: t, by: user.name });
          refund = ord.escrow === "held" || ord.state === "PAYMENT_REVIEW";
          stmts.push(env.DB.prepare("UPDATE orders SET state = 'CANCELLED', escrow = ?, cancel_reason = ?, history = ?, updated_at = ? WHERE id = ?")
            .bind(refund ? "refund_due" : "none", why || "Iibiyuhu ma heli karin alaabta.", JSON.stringify(oh), t, ord.id));
          if (ord.credit_used) stmts.push(env.DB.prepare("UPDATE users SET credit = credit + ? WHERE id = ?").bind(ord.credit_used, ord.user_id));
          stmts.push(notify(env, ord.user_id, "order", "Dalabkaaga waa la joojiyay",
            ord.title + " — " + (why || "iibiyuhu ma heli karin alaabta") + ". " +
            (refund ? "Lacagtaada oo dhan waa laguu celinayaa." : "Wax lacag ah lagaama qaadin."), "orders.html"));
        }
        await env.DB.batch(stmts);
        return json({ ok: true, order: ord ? ord.id : null, refundDue: refund });
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
          /* A real invoice from the provider wins (b.cost). Otherwise the contracted rate card prices it from what
             the facility actually weighed and measured — never the FBG sell price, and never weight alone. */
          const q = shipCost(cn.mode, cn.kg, cn.cbm, t);
          const cost = +b.cost > 0 ? +b.cost : (q ? q.cost : (cn.kg || 0) * (cn.mode === "air" ? FBG.airPerKg : FBG.seaPerKg));
          const stmts = [env.DB.prepare("UPDATE fbg_consignments SET state = 'SHIPPED', awb = ?, cost_usd = ?, eta = ?, shipped_at = ?, updated_at = ? WHERE id = ?")
            .bind(String(b.awb || "").slice(0, 40), +cost.toFixed(2), String(b.eta || "").slice(0, 30), t, t, cn.id)];
          /* Apportion by each item's own chargeable quantity. Sharing a bulky item's freight by actual weight makes
             the dense cargo in the same consignment subsidise it, which quietly misprices both. */
          const chargeableOf = r => { const c = shipCost(cn.mode, r.kg, r.cbm, t); return c ? c.chargeable : (r.kg || 0); };
          const totalKg = rows.concat(pos).reduce((s, r) => s + chargeableOf(r), 0) || 1;
          rows.forEach(r => {                                   // freight is shared out by weight
            const share = +(cost * chargeableOf(r) / totalKg).toFixed(2), h = J(r.history) || [];
            h.push({ state: "SHIPPED", at: t, by: user.name });
            stmts.push(env.DB.prepare("UPDATE fbg_inbound SET state = 'SHIPPED', history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(h), t, r.id),
              env.DB.prepare("INSERT INTO fbg_ledger (id,user_id,at,kind,amount,ref,note) VALUES (?,?,?, 'freight', ?, ?, ?)")
                .bind(rid("LG-", 6), r.user_id, t, -share, r.id, cn.mode + " " + (r.kg || 0) + " kg · " + cn.id));
          });
          for (const r of pos) {                                 // our own goods: the freight share lands on the order
            const share = +(cost * chargeableOf(r) / totalKg).toFixed(2), h = J(r.history) || [];
            h.push({ state: "SHIPPED", at: t, by: user.name });
            const ord = await env.DB.prepare("SELECT econ, history, ship_cost FROM orders WHERE id = ?").bind(r.order_id).first();
            const econ = (ord && J(ord.econ)) || {};
            econ.freightActual = share;
            /* What we quoted the customer against what the lane really cost. Garsoore absorbs the difference by
               design, but absorbing it silently is how an estimate error survives for a year, so it is recorded on
               every order and totalled in the console. */
            econ.freightQuoted = ord && ord.ship_cost != null ? +ord.ship_cost : null;
            econ.freightVariance = econ.freightQuoted != null ? +(share - econ.freightQuoted).toFixed(2) : null;
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
        /* what it really cost to land it. Staff type these off the invoices; blank is allowed — a half-filled
           calibration is still worth more than none, and the page says which figures are missing. */
        const stmts = [env.DB.prepare("UPDATE fbg_consignments SET state = 'ARRIVED', clearance_usd = ?, duty_usd = ?, arrived_at = ?, note = ?, updated_at = ? WHERE id = ?")
          .bind(+b.clearance > 0 ? +(+b.clearance).toFixed(2) : null, +b.duty > 0 ? +(+b.duty).toFixed(2) : null, t, String(b.note || "").slice(0, 300) || null, t, cn.id)];
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
          await env.DB.batch(await placeStmts(env, o, t, by));
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
        await env.DB.batch([
          env.DB.prepare("UPDATE orders SET escrow = 'refunded', updated_at = ? WHERE id = ?").bind(t, o.id),
          /* refunded money has left the Somali pool for real; a refund that only changes a status is
             a refund the books cannot see */
          env.DB.prepare("INSERT INTO treasury (id,at,account,kind,amount,ref,note,by) VALUES (?,?, 'SO_USD', 'refund', ?,?,?,?)")
            .bind(rid("TR-", 6), t, -(+(+o.total).toFixed(2)), o.id, "lacag celin", by)
        ]);
        return json({ ok: true });
      }
      const d = J(o.dispute); if (!d || d.status !== "open") return err("Cabasho furan ma jirto.");
      d.status = b.refund ? "refunded" : "rejected"; d.note = String(b.note || "").slice(0, 300); d.resolvedAt = t; d.by = by;
      await env.DB.prepare("UPDATE orders SET dispute = ?, escrow = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(d), b.refund ? "refund_due" : o.escrow, t, o.id).run();
      return json({ ok: true });
    }
    /* the reset queue. Staff see who asked and when; they never see anyone's existing PIN, because nobody can —
       only a hash is stored, and the new one is generated here and shown once. */
    /* ---------------------------------------------------------------- managed sourcing (staff) */
    if (path === "/ops/sourcing" && M === "GET") {
      const r = await env.DB.prepare(`SELECT s.*, u.name u_name, u.phone u_phone FROM sourcing s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.state NOT IN ('DELIVERED','CANCELLED','UNSOURCEABLE','DECLINED') ORDER BY s.created_at ASC LIMIT 200`).all();
      return json({ requests: r.results.map(x => Object.assign(srcOut(x), {
        supplier: x.supplier, customer: x.u_name ? { name: x.u_name, phone: "+" + x.u_phone } : null })) });
    }
    if ((m = path.match(/^\/ops\/sourcing\/(SR-[A-Z0-9]+)\/(deposit|quote|unsourceable|decline|ordered)$/)) && M === "POST") {
      const sr = await env.DB.prepare("SELECT * FROM sourcing WHERE id = ?").bind(m[1]).first();
      if (!sr) return err("Codsigan lama helin.", 404);
      const b = await body(req), t = now(), h = J(sr.history) || [];
      const push = (st, extra) => { h.push(Object.assign({ state: st, at: t, by: user.name }, extra || {})); return JSON.stringify(h); };

      if (m[2] === "deposit") {                       // the money landed: sourcing starts and the clock starts with it
        const paid = Math.round((+b.amount || sr.deposit_due) * 100) / 100;
        await env.DB.batch([
          env.DB.prepare("UPDATE sourcing SET state = 'SOURCING', deposit_paid = ?, deposit_at = ?, history = ?, updated_at = ? WHERE id = ?")
            .bind(paid, t, push("SOURCING", { deposit: paid }), t, sr.id),
          notify(env, sr.user_id, "money", "Waxaan bilownay raadinta", sr.title + " — wakiilkeennu wuxuu la xiriirayaa iibiyeyaasha. Qiimo ayaa kuu imanaya.", "sourcing.html")
        ]);
        return json({ ok: true });
      }
      if (m[2] === "quote") {                          // one number back, goods and shipping named separately
        const goods = Math.round((+b.goods || 0) * 100) / 100, ship = Math.round((+b.ship || 0) * 100) / 100;
        if (!(goods > 0)) return err("Ku qor qiimaha alaabta.");
        const total = Math.round((goods + ship) * 100) / 100;
        await env.DB.batch([
          env.DB.prepare(`UPDATE sourcing SET state = 'QUOTED', quote_goods = ?, quote_ship = ?, quote_total = ?, quote_unit = ?,
            quote_eta = ?, quote_note = ?, supplier = ?, quoted_at = ?, history = ?, updated_at = ? WHERE id = ?`)
            .bind(goods, ship, total, Math.round(goods / Math.max(1, sr.qty) * 100) / 100,
              Math.max(1, Math.round(+b.etaDays || 30)), String(b.note || "").slice(0, 600) || null,
              String(b.supplier || "").slice(0, 160) || null, t, push("QUOTED", { total }), t, sr.id),
          notify(env, sr.user_id, "quote", "Qiimahaagii waa diyaar: $" + total, sr.title + " — " + SOURCING.quoteValidDays + " maalmood ayuu shaqaynayaa.", "sourcing.html")
        ]);
        return json({ ok: true, total });
      }
      if (m[2] === "unsourceable") {                   // our listing was bad, so the deposit goes back whole
        const back = +sr.deposit_paid || 0;
        await env.DB.batch([
          env.DB.prepare("UPDATE sourcing SET state = 'UNSOURCEABLE', closed_at = ?, close_reason = ?, forfeit = 0, refund = ?, history = ?, updated_at = ? WHERE id = ?")
            .bind(t, String(b.why || "").slice(0, 300) || "Lama heli karo", back, push("UNSOURCEABLE", { refund: back }), t, sr.id),
          notify(env, sr.user_id, "money", "Lama heli karin — lacagtaadii waa laguu celinayaa",
            sr.title + " — " + (b.why || "iibiyuhu ma jirin ama ma iibin karin") + ". Carbuunkaagii oo dhan (" + back + "$) waa laguu celinayaa. Khalad kayaga ah.", "sourcing.html")
        ]);
        return json({ ok: true, refund: back });
      }
      if (m[2] === "decline") {
        await env.DB.prepare("UPDATE sourcing SET state = 'DECLINED', closed_at = ?, close_reason = ?, refund = ?, forfeit = 0, history = ?, updated_at = ? WHERE id = ?")
          .bind(t, String(b.why || "").slice(0, 300), +sr.deposit_paid || 0, push("DECLINED"), t, sr.id).run();
        return json({ ok: true });
      }
      await env.DB.prepare("UPDATE sourcing SET state = 'ORDERED', order_id = ?, history = ?, updated_at = ? WHERE id = ?")
        .bind(String(b.orderId || "").slice(0, 40) || null, push("ORDERED"), t, sr.id).run();
      return json({ ok: true });
    }

    if (path === "/ops/pin-resets" && M === "GET") {
      const r = await env.DB.prepare(`SELECT p.*, u.name u_name, u.status u_status,
          (SELECT COUNT(*) FROM orders o WHERE o.user_id = p.user_id) orders
        FROM pin_resets p LEFT JOIN users u ON u.id = p.user_id
        WHERE p.state = 'open' ORDER BY p.at ASC LIMIT 100`).all();
      return json({ requests: r.results.map(x => ({ id: x.id, phone: "+" + x.phone, at: x.at,
        name: x.u_name || null, hasAccount: !!x.user_id, suspended: x.u_status === "suspended", orders: x.orders || 0 })) });
    }
    if ((m = path.match(/^\/ops\/pin-resets\/(PR-[A-Z0-9]+)\/(issue|reject)$/)) && M === "POST") {
      const b = await body(req), t = now();
      const pr = await env.DB.prepare("SELECT * FROM pin_resets WHERE id = ? AND state = 'open'").bind(m[1]).first();
      if (!pr) return err("Codsigan lama helin ama horey ayaa loo xalliyay.", 404);
      if (m[2] === "reject") {
        await env.DB.prepare("UPDATE pin_resets SET state = 'rejected', handled_by = ?, handled_name = ?, handled_at = ?, note = ? WHERE id = ?")
          .bind(user.id, user.name, t, String(b.note || "").slice(0, 200), pr.id).run();
        return json({ ok: true });
      }
      if (!pr.user_id) return err("Lambarkan akoon ma laha.", 404);
      const target = await env.DB.prepare("SELECT id, name, phone, status, role FROM users WHERE id = ?").bind(pr.user_id).first();
      if (!target) return err("Akoonkan lama helin.", 404);
      if (target.status === "suspended") return err("Akoonkan waa la hakiyay — marka hore furfur.");
      if (target.role === "admin" && user.role !== "admin") return err("Maamulaha PIN-kiisa halkan lagama beddeli karo.");
      /* six random digits, never a pattern. Shown to staff once so they can read it down the phone, stored only as a
         hash, forced to be changed at first sign-in, and every existing session is dropped. */
      const temp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET pin_hash = ?, must_change_pin = 1 WHERE id = ?").bind(await pinHash(temp), target.id),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id),
        env.DB.prepare("UPDATE pin_resets SET state = 'issued', handled_by = ?, handled_name = ?, handled_at = ?, note = ? WHERE id = ?")
          .bind(user.id, user.name, t, String(b.note || "").slice(0, 200), pr.id),
        env.DB.prepare("INSERT INTO admin_log (at, who, who_name, action, target, detail) VALUES (?,?,?,?,?,?)")
          .bind(t, user.id, user.name, "user.pin_reset", target.id, "PIN ku meel gaar ah ayaa la siiyay (" + pr.id + ")"),
        notify(env, target.id, "money", "PIN-kaaga waa la beddelay",
          "Shaqaale Garsoore ah ayaa ku siiyay PIN ku meel gaar ah. Marka aad gasho waxaa lagu weydiinayaa inaad mid cusub dhigato. Haddii aanad adigu codsan, nala soo xiriir hadda.", "account.html")
      ]);
      return json({ ok: true, tempPin: temp, name: target.name, phone: "+" + target.phone });
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
      const pr = await env.DB.prepare("SELECT COUNT(*) n FROM pin_resets WHERE state = 'open'").first();
      const q = await env.DB.prepare("SELECT COUNT(*) n, MIN(created_at) oldest FROM quotes WHERE status = 'pending'").first();
      const users = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
      const cat = Object.values(CATALOG), catalog = { products: cat.length, verified: cat.filter(p => p.verified).length, requireVerified: env.REQUIRE_VERIFIED === "1" };
      return json({ days, orders: rows.length, paidOrders: paid.length, gmv: sum(paid, r => r.total), revenue: +sum(paid, r => (J(r.econ) || {}).revenue || 0).toFixed(2),
        gross: +sum(paid, r => (J(r.econ) || {}).gross || 0).toFixed(2), aov: paid.length ? Math.round(sum(paid, r => r.total) / paid.length) : 0,
        held: sum(rows.filter(r => r.escrow === "held"), r => r.total), refundDue: sum(rows.filter(r => r.escrow === "refund_due"), r => r.total),
        openDisputes: rows.filter(r => (J(r.dispute) || {}).status === "open").length, byState, funnel, pendingQuotes: q.n, oldestQuote: q.oldest, pendingResets: pr.n, users: users.n, econ: ECON, catalog });
    }
    return err("Not found", 404);
  } catch (x) {
    return err("Server error: " + (x && x.message || x), 500);
  }
}
