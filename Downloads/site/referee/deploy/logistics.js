/* Logistics providers.
 *
 * Garsoore hands goods to a China→Somalia forwarder: the forwarder's China warehouse receives and consolidates,
 * then issues one AWB/BL for the main leg to Mogadishu. What we get back is a reference, a carriage document
 * number, and a stream of events. That contract is the same whether the forwarder is a Guangzhou consolidator with a
 * webhook, a DDP specialist with a poll endpoint, or a man with a WhatsApp number — so it is written once here, and
 * each one is an adapter behind it.
 *
 * There is no Cainiao to integrate with: Cainiao is AliExpress e-commerce logistics and runs no consolidated B2B
 * lane into Mogadishu. The lane is served by China→Somalia consolidators, so the honest default is `manual` until a
 * forwarder's actual integration is in hand.
 *
 * Every adapter implements:
 *    create(env, shipment, lines)     -> { providerOrder, tracking, labelUrl, routing, pickup, state, raw }
 *    track (env, shipment)            -> { state, events: [{at, code, text, place}], raw }
 *    cancel(env, shipment)            -> { ok, raw }
 *    verifyWebhook(env, req, rawBody) -> { ok, consignment, state, event, raw }   (only where they push)
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

/* ---------------------------------------------------------------- forwarder
   A China→Somalia freight forwarder, driven entirely by env so switching forwarder is config, not a rewrite. There
   is no single "giant automated" API on this lane: the operator is a consolidator with a Guangzhou receiving
   warehouse and whatever integration they actually offer — a tracking webhook, a poll endpoint, or a portal a person
   copies from. This adapter is written to the common shape (JSON REST + HMAC webhook); a forwarder that offers no
   API simply stays on `manual`.

   Secrets (Worker secrets, never wrangler.jsonc):
     FORWARDER_API_BASE         e.g. https://api.<forwarder>.com/v1
     FORWARDER_API_KEY          bearer token for create / track / cancel
     FORWARDER_WAREHOUSE_CODE   our client code at that forwarder's China warehouse
     FORWARDER_WEBHOOK_SECRET   HMAC-SHA256 secret for inbound tracking pushes
   A provider missing these is simply not `configured`, and the ops console says so. */
const forwarder = {
  id: "forwarder",
  label: "Freight forwarder (API)",
  configured: env => !!(env.FORWARDER_API_KEY && env.FORWARDER_API_BASE),

  async call(env, path, { method = "GET", body } = {}) {
    const base = (env.FORWARDER_API_BASE || "").replace(/\/$/, "");
    if (!base) throw new Error("FORWARDER_API_BASE not configured");
    const r = await fetch(base + path, {
      method,
      headers: { "Authorization": "Bearer " + env.FORWARDER_API_KEY, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { ok: false, raw: text.slice(0, 500) }; }
  },

  /* Hand the consignment over: one batch, one carriage document. The forwarder returns their id and, once issued,
     the AWB/BL and a print URL. Nothing here invents a tracking number a carrier has not actually given us. */
  async create(env, s, lines) {
    const sea = s.service === "sea";
    const res = await this.call(env, "/consignments", { method: "POST", body: {
      reference: s.id, receiveCode: s.receive_code || s.id,
      mode: sea ? "sea" : "air",
      arrivalPort: s.arrival_port || (sea ? "PORT_MOGADISHU" : "AIRPORT_MGQ"),
      warehouseCode: s.warehouse_code || env.FORWARDER_WAREHOUSE_CODE || null,
      origin: { address: s.origin || "", countryCode: "CN" },
      destination: { name: s.dest_name || "Garsoore", phone: s.dest_phone || "",
        address: s.dest_address || "", city: s.dest_city || "Mogadishu", countryCode: "SO" },
      quantity: { packages: s.packages || 1, weightKg: s.weight_kg || 0, cbm: s.cbm || 0 },
      declaredValue: s.declared_value || 0, currency: s.currency || "USD",
      items: (lines || []).map(l => ({ sku: l.sku, description: l.description, quantity: l.qty,
        weightKg: l.weight_kg, hsCode: l.hs_code, originCountry: l.origin || "CN",
        unitValue: l.declared_value && l.qty ? +(l.declared_value / l.qty).toFixed(2) : null,
        /* a battery nobody classified goes as unknown, not as none: a carrier refusing an unclassified line is the
           correct outcome; a carrier accepting a false declaration is not. */
        battery: l.battery || "unknown", unNumber: l.un_number || null }))
    }});
    const d = (res && (res.data || res)) || {};
    const doc = d.awb || d.bl || d.trackingNo || d.mailNo || null;
    return {
      providerOrder: d.id || d.consignmentId || d.orderId || null,
      tracking: doc,
      labelUrl: d.labelUrl || d.printUrl || null,
      routing: d.routing || d.presortInfo || null, pickup: d.pickup || null,
      docType: sea ? "BL" : "AWB",
      state: res && res.ok === false ? "FAILED" : (doc ? "BOOKED" : "CREATED"),
      raw: res
    };
  },

  /* Poll. The same event {at, code, text, place} shape the webhook delivers, so the engine treats them alike. */
  async track(env, s) {
    const res = await this.call(env, "/consignments/" + encodeURIComponent(s.provider_order || s.id) + "/events", { method: "GET" });
    const d = (res && (res.data || res)) || {};
    const raw = d.events || d.traces || d.traceList || [];
    const events = raw.map(x => ({ at: x.at || x.time || x.eventTime || null,
      code: x.code || x.status || x.eventCode || "", text: x.text || x.desc || x.eventDesc || "",
      place: x.place || x.location || x.city || "" }));
    return { state: normState(d.state || d.status || (events.length ? "IN_TRANSIT" : s.state)), events, raw: res };
  },

  async cancel(env, s) {
    const res = await this.call(env, "/consignments/" + encodeURIComponent(s.provider_order || s.id) + "/cancel", { method: "POST" });
    return { ok: !(res && res.ok === false), raw: res };
  },

  /* Inbound tracking push. The body is verified by HMAC before it is trusted — a webhook that moves goods without a
     signature is an open door to move anyone's. Constant-time compare, because timing is a free side channel. */
  async verifyWebhook(env, req, rawBody) {
    const secret = env.FORWARDER_WEBHOOK_SECRET;
    if (!secret) return { ok: false, why: "webhook secret not configured" };
    const given = req.headers.get("x-forwarder-signature") || "";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
    let diff = hex.length ^ given.length;
    for (let i = 0; i < Math.max(hex.length, given.length); i++) diff |= (hex.charCodeAt(i) || 0) ^ (given.charCodeAt(i) || 0);
    if (diff !== 0) return { ok: false, why: "signature mismatch" };
    let j; try { j = JSON.parse(rawBody); } catch { return { ok: false, why: "not json" }; }
    return { ok: true, consignment: j.reference || j.consignmentId || j.id || null, state: j.state || j.status || null,
      event: { at: j.at || j.time || new Date().toISOString(), code: j.code || j.status || "",
        text: j.text || j.desc || "", place: j.place || j.location || "" }, raw: rawBody };
  }
};

const ALL = { manual, forwarder };
export const provider = id => ALL[id] || manual;
export const providers = env => Object.values(ALL).map(p => ({ id: p.id, label: p.label, configured: p.configured(env) }));
