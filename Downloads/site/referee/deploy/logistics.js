/* Logistics providers.
 *
 * Garsoore hands over goods, customs data and a service level. It gets back a logistics order id, a tracking
 * number, a label, routing information and a stream of events. That contract is identical whether the carrier is
 * Cainiao, Maersk, DSV or a forwarder in Guangzhou with a WhatsApp number — so it is written once here, and each
 * carrier is an adapter behind it.
 *
 * This matters more than it looks. Garsoore has not chosen a carrier yet: quotes are out with tier-1 forwarders,
 * a Somali operator and a Chinese 3PL, and Cainiao's own coverage of Mogadishu is unconfirmed. Building the order
 * engine around one carrier's field names would make the second carrier a rewrite of everything that touches it.
 *
 * Every adapter implements:
 *    create(env, shipment, lines) -> { providerOrder, tracking, labelUrl, routing, pickup, state, raw }
 *    track (env, shipment)        -> { state, events: [{at, code, text, place}], raw }
 *    cancel(env, shipment)        -> { ok, raw }
 *
 * An adapter never throws for a carrier saying no. It returns a state and the raw response, because "they refused
 * it" is information the operator needs, not an exception to swallow.
 */

/* Carrier vocabularies differ; ours does not. Anything unrecognised stays IN_TRANSIT rather than being invented
   into a state that would tell a customer their goods arrived. */
const STATES = ["CREATED", "BOOKED", "PICKED_UP", "IN_TRANSIT", "CUSTOMS", "ARRIVED", "DELIVERED", "CANCELLED", "FAILED"];
export const normState = s => STATES.includes(String(s || "").toUpperCase()) ? String(s).toUpperCase() : "IN_TRANSIT";

/* ---------------------------------------------------------------- manual
   The one that works today. No carrier account, no API: staff hand cartons to whoever is carrying them and paste
   back the tracking number. It exists so the whole order engine — manifest, handover, tracking, the customer's
   order page — can run end to end before a single carrier contract is signed, rather than waiting on one. */
const manual = {
  id: "manual",
  label: "Manual / forwarder",
  configured: () => true,
  async create(env, s) {
    return {
      providerOrder: s.id,            // our own reference is the only one that exists yet
      tracking: null,                 // staff paste it once the forwarder issues one
      labelUrl: null,
      routing: null,
      pickup: null,
      state: "CREATED",
      raw: { note: "handed over manually; no carrier API" }
    };
  },
  async track(env, s) {
    /* Nothing to poll. The events on a manual shipment are the ones staff typed, so returning them unchanged is
       the honest answer — inventing a "still in transit" ping would be worse than silence. */
    return { state: s.state, events: [], raw: null };
  },
  async cancel() { return { ok: true, raw: null }; }
};

/* ---------------------------------------------------------------- Cainiao
   Alibaba's logistics arm. Their own coverage pages name Spain, the Netherlands, the UK and Belgium; East Africa
   is not a named lane and Mogadishu is unconfirmed, so this adapter is written to the documented method shapes and
   left dark until somebody confirms both the route and the credentials.
   Secrets: CAINIAO_BASE, CAINIAO_APP_KEY, CAINIAO_APP_SECRET, CAINIAO_CP_CODE. */
const cainiao = {
  id: "cainiao",
  label: "Cainiao",
  configured: env => !!(env.CAINIAO_APP_KEY && env.CAINIAO_APP_SECRET),

  async call(env, method, params) {
    const base = env.CAINIAO_BASE || "https://link.cainiao.com/gateway/link.do";
    const content = JSON.stringify(params);
    /* Cainiao's Link gateway signs as md5(content + appSecret), base64. If theirs differs the first call returns a
       signature error rather than data, which is a one-function fix and not a redesign. */
    const bytes = new TextEncoder().encode(content + env.CAINIAO_APP_SECRET);
    const digest = await crypto.subtle.digest("MD5" in crypto.subtle ? "MD5" : "SHA-256", bytes).catch(() => null);
    const sign = digest ? btoa(String.fromCharCode(...new Uint8Array(digest))) : "";
    const form = new URLSearchParams({
      msg_type: method, logistic_provider_id: env.CAINIAO_APP_KEY,
      to_code: env.CAINIAO_CP_CODE || "", data_digest: sign, logistics_interface: content
    });
    const r = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString()
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { success: false, raw: text.slice(0, 500) }; }
  },

  async create(env, s, lines) {
    const res = await this.call(env, "CAINIAO_GLOBAL_CREATE_LOGISTICS_ORDER", {
      externalOrderId: s.id,
      solutionCode: s.service === "air" ? "AIR" : "SEA",
      sender: { name: "Garsoore", address: s.origin || "", countryCode: "CN" },
      receiver: {
        name: s.dest_name || "", mobile: s.dest_phone || "",
        address: s.dest_address || "", city: s.dest_city || "Mogadishu", countryCode: s.dest_country || "SO"
      },
      packageInfo: { packageCount: s.packages || 1, weight: s.weight_kg || 0, volume: s.cbm || 0 },
      declaration: {
        totalValue: s.declared_value || 0, currency: s.currency || "USD",
        items: (lines || []).map(l => ({
          sku: l.sku, description: l.description, quantity: l.qty,
          weight: l.weight_kg, hsCode: l.hs_code, originCountry: l.origin,
          unitValue: l.declared_value && l.qty ? +(l.declared_value / l.qty).toFixed(2) : null,
          currency: l.currency || "USD",
          /* a battery nobody has classified is sent as unknown rather than as none. A carrier refusing an
             unclassified line is the correct outcome; a carrier accepting a false declaration is not. */
          battery: l.battery || "unknown", unNumber: l.un_number || null
        }))
      }
    });
    const d = (res && (res.data || res)) || {};
    return {
      providerOrder: d.logisticsOrderId || d.orderId || null,
      tracking: d.mailNo || d.trackingNumber || null,
      labelUrl: d.printUrl || d.labelUrl || null,
      routing: d.routingInfo || d.presortInfo || null,
      pickup: d.pickupInfo || null,
      state: res && res.success === false ? "FAILED" : (d.mailNo ? "BOOKED" : "CREATED"),
      raw: res
    };
  },

  async track(env, s) {
    const res = await this.call(env, "CAINIAO_GLOBAL_TRACE_QUERY", {
      logisticsOrderId: s.provider_order || undefined, mailNo: s.tracking_no || undefined
    });
    const d = (res && (res.data || res)) || {};
    const raw = d.traceList || d.traces || [];
    const events = raw.map(x => ({
      at: x.time || x.eventTime || null, code: x.status || x.eventCode || "",
      text: x.desc || x.eventDesc || "", place: x.location || x.city || ""
    }));
    return { state: normState(d.status || (events.length ? "IN_TRANSIT" : s.state)), events, raw: res };
  },

  async cancel(env, s) {
    const res = await this.call(env, "CAINIAO_GLOBAL_CANCEL_LOGISTICS_ORDER", {
      externalOrderId: s.id, logisticsOrderId: s.provider_order || undefined
    });
    return { ok: !(res && res.success === false), raw: res };
  }
};

const ALL = { manual, cainiao };
export const provider = id => ALL[id] || manual;
export const providers = env => Object.values(ALL).map(p => ({ id: p.id, label: p.label, configured: p.configured(env) }));
