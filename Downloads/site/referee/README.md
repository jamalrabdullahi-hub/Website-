# Referee

A rolled-up marketplace for **Somalia** — **Contracts & Tenders, Jobs, Local Services, Marketplace**
and a **commodity Exchange** — on one board where every counterparty is verified before they can
post and payment is held until both sides are done.

Localised to the Somali market: locations are Mogadishu, Hargeisa, Bosaso, Kismayo, Berbera, Baidoa,
Garowe and Beledweyne; prices are in USD (the trade currency); payment/escrow references mobile money
(EVC Plus / ZAAD / Sahal) and letters of credit / hawala for large lots. Seed data uses real Somali
institutions and trade categories (FGS ministries, Banadir Regional Administration, WFP, Hormuud,
Premier Bank, Dahabshiil; solar, boreholes, generators, bajaj, livestock, land).

Static site, no build step. Separate HTML page per board so each page only loads and renders its
own slice; shared CSS + JS are cached once.

```
index.html         landing — the boards + B2B + Commodity Exchange
contracts.html     window.BOARD = "tenders"
jobs.html          window.BOARD = "jobs"
services.html      window.BOARD = "services"
marketplace.html   window.BOARD = "classifieds"
b2b.html           window.BOARD = "b2b"       — wholesale marketplace: goods + services, RFQ → order
logistics.html     window.BOARD = "logi"      — freight board: "Just move it" RFQ over air/sea/land lanes
exchange.html      window.BOARD = "exchange"  — graded-commodity order book
activity.html      window.BOARD = "activity"  — your listings, deals, B2B orders, freight bookings, RFQs, wallet
assets/
  style.css        theme-aware, soft black/white
  engine.js        operations layer  (window.RF)  — no DOM
  market.js        commodity-exchange mechanism  (window.RF.market)  — no DOM
  b2b.js           B2B transaction core  (window.RF.b2b)  — no DOM
  logistics.js     freight lane board + matching  (window.RF.logi)  — no DOM
  app.js           UI layer — depends on RF
```

## Logistics layer — `assets/logistics.js` (`window.RF.logi`)

A freight board built on rails. Shippers press **"Just move it"** → a 12-step guided RFQ
(`RF.Wizard` with a custom fieldset, dynamic `from`/`to` options per mode). Underneath is the
mechanism carriers and coordinators actually use: capacity posted against **fixed lanes**.

| Mode | Lanes (both directions) |
| --- | --- |
| **Air** | MGQ⇄HGA, MGQ⇄BSA, MGQ⇄GGR, MGQ⇄GLK, MGQ⇄KMU, MGQ⇄BIB, HGA⇄BSA, HGA⇄BBO + MGQ⇄NBO / MGQ⇄JIB feeders |
| **Sea** | Mogadishu⇄Bosaso, Mogadishu⇄Kismayo, Berbera⇄Bosaso, Berbera⇄Mogadishu, Mogadishu⇄Marka |
| **Land** | Mogadishu⇄Baidoa / Beledweyne / Kismayo / Galkayo, Galkayo⇄Garowe, Garowe⇄Bosaso, Berbera⇄Hargeisa, Hargeisa⇄Wajaale, Baidoa⇄Doolow, Kismayo⇄Dhobley, Afgooye⇄Baidoa |

- **Capacity** — a carrier posts space on a lane (also on rails): service, equipment, departure,
  cut-off, transit, **rate basis** (`$/kg` air · `$/MT` `$/m³` `$/TEU` sea · `$/truck` `$/MT` land),
  rate, min charge, available quantity, reefer / DG flags.
- **Matching** — `RF.logi.match(shipment)` resolves candidate lanes (or all modes for
  *Cheapest* / *Fastest*), filters capacity by departure window, space, handling and
  packaging/equipment compatibility, computes a quote (chargeable weight = IATA volumetric for air,
  W/M revenue ton for sea, truckloads for land), and ranks by price (or transit for *Fastest*).
- **Booking** — a deal on the `logi` lifecycle: `BOOKED → CONFIRMED → PICKED_UP → IN_TRANSIT →
  ARRIVED → DELIVERED → POD → SETTLED` (branches `CANCELLED`, `EXCEPTION`). AWB / BL / CN issued at
  CONFIRMED, POD at DELIVERED. Escrow held in the business wallet, released to the carrier at SETTLED.

## B2B layer — `assets/b2b.js` (`window.RF.b2b`)

Phase 1 of the "small Somali Alibaba for B2B" plan: a wholesale marketplace whose
transaction core is built **exchange-ready** from day one, so Phase 3 needs no rewrite —
just: `RFQ → Quotes → Orders → Standardisation → Warehouse receipt → Bid/Ask`.

| Piece | What it does |
| --- | --- |
| **catalogue** | Supplier offers — GOODS + SERVICES — with `unitPrice`, `moq`, `availableQty`, `origin`, `incoterm`, `leadDays`, `warehouse`, optional `grade`/`commodity`. `isStandardized()` flags graded, warehouse-backed goods. |
| **rfqs** | `post` an RFQ → suppliers `quote` → buyer `accept` → a purchase order is created and the other quotes auto-decline. |
| **orders** | A confirmed order is a **deal on the `b2b` lifecycle** (`PLACED → ACCEPTED → PROCESSING → READY → SHIPPED → RECEIVED → SETTLED`, branches `CANCELLED` / `DISPUTED`). A **warehouse receipt** is issued at READY, an **invoice** at SHIPPED. Flows through *My activity*. |
| **wallet** | Per-business escrow wallet. Funds are **held** on order placement, **released** to the supplier at SETTLED, **refunded** on cancel/dispute. Ledger view + demo top-up. |
| **exchange seam** | `promote(offer)` — a standardised, graded, warehouse-backed good is listed on a **runtime-registered market** on `market.js` (`RF.market.registerMarket`). Same matching engine, same settlement lifecycle as the built-in commodity markets. `commodityQuotes()` powers the *Commodity prices* tab. |

Standardised contracts shipped: **Sesame Seed** (FAQ / B / A par, $/MT) and **White Maize**
(Feed / Milling par, $/MT), each as a `WR-*` warehouse-receipt market.

Run it from a server (pages share a script), e.g. `python -m http.server` then open
`http://localhost:8000`.

## Operations layer — `assets/engine.js` (`window.RF`)

Ported from the earlier *Market Cypher* prototype and generalised to four boards.

| Module | What it does |
| --- | --- |
| **SCHEMA** | Per-board field definitions (`type`, `required`, `options`, conditional `dependsOn`), the deal **lifecycle** (ordered states + which actor advances each + side branches + terminal effects), and the **verification checklist**. Change a board here — no UI edits. |
| **store** | `localStorage`-backed CRUD mirroring a DB API (`listings`, `addListing`, `updateListing`, `deals`, `addDeal`, `updateDeal`). Seeds once. `identity` is the auth stand-in. |
| **verify** | `required(listing)` → checks that apply · `status()` → done/pending + ratio · `publishable()` gate · `approve()` simulates a reviewer. Auto-checks pass from listing content (e.g. a salary range satisfies "pay disclosed"); the rest need a human. |
| **score** | Deterministic **Referee Score** 0–100 = verification completeness (40) + freshness (20) + transparency (25) + responsiveness (15). Returns `{score, band, factors}`. |
| **lifecycle** | `states(board)`, `transitions(board, state, actor)`, `create(listing, counterparty)`, `advance(dealId, toState, actor)`. Enforces actor permissions, moves escrow with the state, closes the listing on terminal states like `HIRED` / `COMPLETED`. |
| **parser** | `parse(board, text)` — paste a job description / tender notice / ad → structured field proposal + confidence + notes. Deterministic regex extractors for money, salary ranges, dates, licence numbers, reference numbers, categories, employment type, condition, etc. Never publishes; the wizard pre-fills from it and the user confirms every field. |
| **Wizard** | Staged posting flow: board → paste-or-scratch → one field at a time (required first, `dependsOn`-aware) → review → submit. `back()` history, `skip()` for optional fields, `applyProposal(parsed)`, `missingRequired()`, `build()` → listing (enters `in_review`). |

### Board lifecycles

```
Contracts    NOTICE_OPEN → INTENT_REGISTERED → CLARIFICATIONS → BID_SUBMITTED
             → UNDER_EVALUATION → AWARDED → CONTRACT_SIGNED      (branch: UNSUCCESSFUL)
Jobs         OPEN → APPLIED → SCREENING → INTERVIEW → OFFER → HIRED
             (branches: REJECTED, DECLINED · HIRED closes the listing)
Services     REQUESTED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED → RELEASED
             (branch: DECLINED · escrow releases on RELEASED)
Marketplace  ENQUIRY → RESERVED → PAYMENT_HELD → INSPECTION → RELEASED → COMPLETED
             (branches: CANCELLED, REFUNDED · escrow ≥ $500)
```

## Commodity exchange — `assets/market.js` (`window.RF.market`)

A continuous limit order book for Somalia's export and staple trade. Four markets:
**Export Livestock (Sheep & Goat), Frankincense (Beeyo), Sesame Seed (Whitish), Red Sorghum
(Domestic)** — each with a delivery-point list (Berbera / Bosaso / Erigavo / Mogadishu / Marka /
Kismayo / Baidoa / Beledweyne) and a published **grade-differential schedule**.

- **Par-grade book.** Every order is normalised to the par grade: `parLimit = rawLimit − differential(grade)`.
  One clean book per (market, delivery point) holds every deliverable grade.
- **Matching** — price-time priority, best-first, partial fills. A buy crosses a sell when
  `buy.parLimit ≥ sell.parLimit` **and** the seller's grade is the buyer's required grade *or better*
  (grade `rank`). Trades print at the resting (passive) order's par price.
- **Settlement price** = trade par price `+ differential(delivered grade)` — deliver a better grade,
  earn the premium; a worse grade clears at the discount.
- Each fill spawns an **exchange settlement** = a deal on the `exchange` lifecycle
  (`MATCHED → GRADE_SUBMITTED → GRADE_VERIFIED → IN_TRANSIT → DELIVERED → SETTLED`, branch
  `GRADE_REJECTED`), escrow held from match to settle. These appear on **My activity**.

API: `book`, `depth`, `quote`, `tape`, `submitOrder`, `cancelOrder`, `myOrders`, `ensureSeed`, `reseed`.
Markets seed a deterministic random book + trade history (mulberry32 keyed by market id) so the
tape, day range and depth ladder are populated on first load.

```
Livestock     par Export grade · Cull −18 / Local 2 −7 / Prime export +12       ($/head, 50-head lot)
Frankincense  par Grade 2 · Fusus −3.50 / Grade 3 −1.75 / Mushuq +4.25          ($/kg, 50 kg sack)
Sesame        par Grade 1 · FAQ −120 / Grade 2 −45 / Hulled +260                ($/tonne, 5 t lot)
Sorghum       par Grade 1 · Feed −4.00 / Grade 2 −1.50 / White food +3.00       ($/quintal, 50-quintal lot)
```

## Demo notes

- All data lives in your browser (`localStorage` key `referee.v1`). "Reset demo data" in the footer wipes it.
- New listings enter **verification** and stay hidden until every required check clears — use
  **Simulate reviewer** on *My activity* to clear them.
- Set your name (top-right) to post listings under it and to appear as a party on deals.

## Garsoore core catalogue (real supplier listings)
- `data/catalog.csv` is the source of truth — one row per variant, rows sharing a `sku` are one product. Every row is a
  **real listing**: the supplier's product URL, company name, photo, published price range (FOB, USD), minimum order and
  unit, weight and key specs, plus the capture date. `cost_cny` = the *upper* end of the supplier's range × 7.2 (conservative).
- `python tools/harvest-mic.py` builds it from public Made-in-China.com product pages: ~80 searches for what Somali buyers
  need (solar, generators, appliances, furniture, building, electronics, phones, clothing, vehicles). Filters drop
  accessories, bait prices, per-watt/per-metre listings, one-listing-many-sizes price ranges and minimum orders > 100.
  Pages are cached in `data/harvest-cache/` (gitignored); `--offline` rebuilds from the cache. It also writes
  `data/suppliers.json` (the real supplier directory shown on the business China page).
- Every harvested row is `cost_verified=check`. **A person confirms price + freight weight with the supplier, then sets
  `yes`.** With `REQUIRE_VERIFIED=1` (launch) only `yes` rows sell at a fixed price; the rest go through a staff quote.
- `python tools/import-catalog.py` validates the CSV and writes `assets/catalog-data.js` (bad rows are reported and skipped).
- Domestic sellers are added as rows with `source_platform=domestic` once they have signed up — never invented.
- Links for items outside the range become quote requests (`RF.quotes`), priced by staff in the ops console.

## Live China data (Apify)
`server/china-proxy.js` is a Cloudflare Worker that calls Apify actors so the token never reaches the browser:
1688 detail + search (`automation-lab/1688-scraper`), Taobao/Tmall detail (`zen-studio/taobao-detail-scraper`),
JD keyword search (`zen-studio/jd-com-search-scraper`). Not covered → the site offers a staff-priced quote request instead:
JD-by-link, Pinduoduo, Alibaba.com. None of the actors return weight, so freight on live one-offs is an estimate.

1. Create an Apify account, copy an API token, and set a monthly usage limit in the Apify console.
2. `cd server && npx wrangler secret put APIFY_TOKEN && npx wrangler deploy` (attach a custom domain such as china.garsoore.com — the Cache API needs one).
3. Put that URL in `assets/config.js` (`chinaEndpoint`). Leave it empty to stay on demo data.
4. Optional: `python tools/apify-refresh.py --limit 25 --yes` refreshes core-catalogue costs (needs `source_url` filled in). It writes `cost_verified=check`; a person confirms the match.

## Any link → product page
Paste any product link (or a WeChat/Taobao share text) into the home search box or the Shop China box:
- `RF.sources.urlOf(text)` extracts the link; a normal search phrase is left alone. `identify()` routes known platforms (JD, 1688, Taobao/Tmall, Pinduoduo, Alibaba) and treats everything else as platform `web`.
- Known product in the core range → normal buyable product page. Anything else → a one-off product page (title, image, source link) with **"Qiimo la sugayo" / ≈ estimate** and a **Codso qiimo rasmi ah** button; staff price it at `business/quotes.html`.
- Demo mode: title comes from the link's own wording, price stays unknown (nothing is invented).
- Live mode: `/item` (Apify) first, then the Worker's `/link` page reader (Open Graph + schema.org JSON-LD; SSRF-guarded, honest bot user-agent), then a quote request. Non-CNY page prices are never used as our cost.

## The two selling models — never collapse them (`RF.catalog.seller`)
A consumer product is sold under exactly one of these. They differ in **who owns the goods**, which decides who the customer is buying from, who carries the inventory risk, and what Garsoore is paid for.

| | **Garsoore Official Procurement** | **Fulfilled by Garsoore (FBG)** |
|---|---|---|
| Seller of record | **Garsoore Official** | The third-party merchant, named |
| Who owns the goods | Nobody until the customer buys | The merchant, until it sells |
| Does Garsoore hold stock? | **No** — never buys ahead | No — it is the merchant's stock |
| When is it bought? | **After** the customer pays | Already bought, already in the warehouse |
| Garsoore earns | Procurement margin + service | Fulfilment fees + commission |
| Customer sees supplier? | **Never** — internal relationship | Yes, the merchant is the seller |

**Garsoore Official Procurement** is a made-to-order chain: customer pays → funds confirmed → approved supplier selected → purchase order raised → supplier ships to the **forwarder's China warehouse** → received, consolidated onto **one AWB/BL** → air to **Aden Adde (MGQ)** or sea to the **Port of Mogadishu** → import clearance run by Garsoore → port pickup → last mile. Garsoore is the seller of record the whole way; the Chinese distributor behind it is an internal procurement relationship and its name never reaches a consumer page. Implemented in `procurement` (`deploy/schema-4.sql`) and surfaced to staff only.

**FBG** is fulfilment for somebody else's inventory (`deploy/schema-3.sql`). The merchant owns it, sets the price and carries the risk; Garsoore receives, stores, picks, packs, delivers, tracks, handles eligible returns and settles. Here the merchant's name *is* the honest answer to "who am I buying from", so it is shown, with Garsoore credited for the fulfilment.

`RF.catalog.seller(p)` is the single place that decides which label a product carries, and `sellerLabel` / `official` are exported to the server so no page can invent a different answer.

## Consolidation & the forwarder (`deploy/logistics-engine.js`, `deploy/schema-16.sql`)
Garsoore owns **no China warehouse and no carrier**. The consolidation point is a China→Somalia freight forwarder's
warehouse in **Guangzhou** (or Yiwu): they give Garsoore a receiving address and a client code, suppliers ship to it,
the forwarder consolidates and issues **one AWB (air) or Bill of Lading (sea)**, and the batch lands at
**Aden Adde / MGQ** (air cargo) or the **Port of Mogadishu** (sea).

Garsoore runs the leg the forwarder does not: **import clearance** (customs entry, duty, broker, terminal) and **port
or airport pickup**, then the last mile to Km4. That is why the commercial terms are **FOB / EXW / port-to-port — never
DDP**: DDP would put the clearance, and the duty, on the forwarder, which is exactly the work Garsoore does itself.

A consignment is the batch several paid orders ride in. It moves `OPEN → SEALED → HANDED_OVER → IN_TRANSIT →
ARRIVED_PORT → IN_CLEARANCE → CLEARED → COLLECTED`, and the customer's order state is **derived** from it, never set by
hand. Tracking arrives by forwarder **webhook** (HMAC-verified at `/webhooks/forwarder/<id>`), by poll, or typed by a
person — all three land as the same event shape. The forwarder is a swappable adapter (`deploy/logistics.js`): pick one
for the lane, not six; the day a provider has no API at all, `manual` still runs the whole engine end to end.

## Shipping: contracted rate cards, never spot quotes (`assets/shipping.js`, `data/rate-cards.json`)
**The rule: if Garsoore shows a customer a shipping price, Garsoore already knows how that shipment moves and which contracted rate produced the number.** No market averages, no guessing, and no "shipping went up 40%" after the fact.

- `data/rate-cards.json` is the only source of shipping numbers. `tools/gen-rates.py` generates `assets/rate-cards.js` (browser) and `deploy/rates.gen.js` (Worker) from it, so the shop, the price export and the API cannot disagree.
- A card carries origin, destination, mode, currency, validity window, minimum charge, minimum billable quantity, rate tiers, volumetric divisor, included and excluded surcharges, defined exceptional events, transit window, weekly capacity, rate-change notice period, claims window and provider reference.
- **Air:** `chargeable = max(actual_kg, volume_cm³ / contracted_divisor)`, rounded up to the contracted step, then the minimum charge applies.
- **Sea:** `chargeable = max(CBM, kg / weightCapPerCbm)` — the revenue-tonne rule — then minimum billable volume and minimum charge.
- `status` is load-bearing: `draft` means **nothing is signed yet** and the numbers are internal planning figures. The admin console's **Rarka** page says so at the top in plain words, because quoting a rate you have no contract to honour is the largest un-hedged risk in the business.
- **A sold order keeps its rate.** Migration 8 stores `ship_mode`, `rate_card_id`, `ship_cost`, `transit_min`, `transit_max` on the order. Rate changes affect the next card, never an order already placed; Garsoore absorbs ordinary movement.

### Packed dimensions are estimated, and say so
All 421 catalogue rows have a weight; none has measured packed dimensions. Volume is estimated from weight using a per-category packed density (`packedDensity` in the rate cards), flagged `estimated` everywhere it is used. Air break-even at divisor 6000 is 167 kg/CBM, so bulky categories (furniture 110, clothing 120) correctly price as volumetric-dominant. When the facility weighs and measures the real carton, Garsoore absorbs the difference — the customer's locked price does not move.

### Import clearance (`data/customs.json`)
The flat 5% duty is gone. What replaced it is structurally right and **numerically unconfirmed** — `status: "draft"`, `confirmedBy: null` — exactly like the rate cards, and the console says so.

- **Duty is ad valorem on CIF** (goods + the freight that brought them), at a rate that varies by category. Raising freight raises duty; they are not independent.
- **Clearing a consignment is a fixed cost** — agent, documents, terminal handling, delivery order — that does not care what is inside the box.
- **A customer pays a share of it, not the whole bill.** Garsoore consolidates many customers into one consignment and clears it once. The fees are spread over `typical`, the consignment size we expect to move (500 kg air / 20 CBM sea), giving a loading of $0.11/kg air and $5.25/CBM sea. Charging the full $55 per basket would have priced a $6 shirt at $98.
- `typical` is an **operating assumption, not a contract term**, and it is the most sensitive number in the file: too high and every order is underpriced, too low and nothing sells. Revisit it against real consignment weights once a few have shipped.
- Ask a broker specifically about **vehicles, solar and building materials** — those are the three most likely to sit off the default rate. If a category turns out to be relieved entirely, set it to `0` rather than deleting the line, so it is visible that somebody checked.

### PIN recovery (`deploy/schema-9.sql`)
The account is a phone number and a PIN, so there is no reset link and there was previously **no way back in at all** — `/auth/pin` needs the old PIN and an admin could change a person's role but not their PIN. The first customer to forget theirs was locked out of their orders and their escrow permanently.

Now: the customer asks from the sign-in sheet (`/auth/forgot`, public, **above the auth gate** — a locked-out user cannot authenticate to ask), a human rings the number on file and satisfies themselves it is them, then issues a one-time PIN from the ops console's **PIN la illoobay** tab. The reply is identical whether or not the number has an account, so this cannot be used to test which numbers are customers, and three requests an hour is the limit. The new PIN is shown to staff exactly once, forces a change at next sign-in, drops every existing session, and is written to `admin_log` with the name of whoever issued it. Staff never see anyone's existing PIN — nobody can, only a hash is stored.

### When a supplier cannot deliver
Cancelling a purchase order used to return a *hint* — a string telling staff to remember to cancel the order and refund. The customer's order sat in SOURCING with their money held, and they were told nothing. Now cancelling the PO cancels the order it exists for, moves the escrow to `refund_due`, returns any store credit they spent and notifies them with the reason, in one batch so it cannot half-happen. Marking the money actually returned stays a separate, deliberate step in the refunds queue.

### Basket freight: one basket is one shipment (`RF.shipping.basket`, `RF.catalog.basketPrice`)
Freight is charged **per shipment, not per line**. Charging the minimum on every line made cheap light goods unsellable: a $6 SHEIN top carried the $12 air minimum and retailed at $23.79, and ten of them would have quoted ten × $12 = $120 of freight against a real consolidated cost of $37.80.

- Lines travelling the same lane form one consignment; freight is priced once for the combined weight and volume, then shared out in proportion to each line's **chargeable** quantity (not actual weight, or dense cargo subsidises bulky cargo). Rounding remainder goes to the largest line so the shares always sum to the freight actually paid.
- Different lanes are different shipments and priced separately — an air line and a sea line in one basket do not pool.
- Consolidation is charged once per **line**, not per unit: the facility handles a SKU once whether the carton holds one shirt or ten.
- The product page prices the quantity on screen exactly as the cart will, so the two cannot disagree the moment somebody types "3". A single light item shows one line explaining that buying more is cheaper, with the three-unit price.
- The cart shows each lane's price computed with the rest of the basket held still, so the number on the chip is the number you pay if you tap it, plus the consolidation saving.
- **The server runs the identical calculation** (`basketFreight` / `lineLanded` in `deploy/api.js`) over the same rate cards and the same constants, which `tools/export-catalog.js` exports as `PRICING` rather than duplicating. Verified: a 3+2+1 basket priced $208 in the cart and $208 on the server, with freight shares summing exactly to the $46.20 shipment cost.

| Same garment | Freight | Each |
|---|---|---|
| ×1 | $12.00 *(minimum)* | $38.00 |
| ×3 | $21.00 | $29.67 |
| ×10 | $71.40 | $28.90 |

### Eligibility for instant buy (`RF.catalog.eligible`)
A product is not instantly buyable because somebody found a supplier. It needs a canonical SKU, a known purchase price, a known packed weight, and a lane today's rate card can actually price. Anything short of that renders **Codso qiimo rasmi ah** (request a quote) instead of a number. Price certainty is the product.

### What the customer sees
Two buttons and a window: `✈ Cirka 7–14 maalmood $581` / `🚢 Badda 25–45 maalmood $218`. A lane appears only if a customer could sensibly want it — air is always faster, so sea earns its place only by being cheaper, which is why a 0.5 kg phone shows air alone. No carrier, vessel, airline, port, transshipment, BAF, LCL/FCL, HS code or chargeable-weight arithmetic reaches a consumer page.

## Which marketplace belongs to which shop (`RF.sources.SURFACES`)
The two shops buy from different halves of China and the UI says so.

| Shop | Platforms | Why |
|---|---|---|
| `buurwen.com` | JD, Tmall/Taobao, Pinduoduo | Retail. One piece, a fixed price, a nameable brand. |
| `business.buurwen.com` | 1688, Alibaba.com, Made-in-China | Wholesale. MOQ, tier pricing, factories. |

- `surfaceOf(platform)` decides; `platformsFor(surface)` drives the chips, the platform filter and the cross-platform search. `web` (any other product page) belongs to neither and is accepted on both.
- Paste a **wholesale** link into the consumer shop and it is *not* refused — the page says 1688 sells in bulk and offers a button to `business.buurwen.com/china.html?u=<the same link>` via `RF.sources.crossLink()`. The link travels; nobody re-pastes.
- Paste a **retail** link into the business shop and it is accepted with a note that the price is per piece with no wholesale tiers (buying a sample before a carton is the right instinct).
- The 421-product catalogue is unaffected. Where Garsoore *buys* stock is not the same question as which channel a shopper browses: the catalogue is Garsoore's own imported range, sold retail on the consumer shop regardless of which Chinese market it was sourced from.

## Buy-for-me (`SERVICES` in `deploy/api.js`, service menu in `bizChina`)
Superbuy-style agent buying. You paste a vendor link, Garsoore buys from the vendor, checks the goods, and forwards them. The goods are yours from the moment we pay the vendor; what Garsoore sells is the buying, the checking and the rail.

| Service | Price |
|---|---|
| Visual check + photos | **free** |
| Count + measure | $2 |
| Powered function test | $5 |
| Unboxing video | $4 |
| Reinforced repack | $3 |
| Remove vendor invoice | $1 |
| Written QC report | $8 |

Plus a **5% buying fee, minimum $3**, on the vendor's price.

- Basic photo inspection is free on purpose: it is what makes buying blind from a link survivable, and it is the reason to use Garsoore over a friend in Guangzhou.
- The ticked services ride along with the quote request. The **server re-prices them from its own table** (`serviceFee()`) and ignores unknown keys — the browser never sets a price.
- Migration `schema-7.sql` adds `services`, `qty` and `service_fee` to `quotes`. Staff see the requested services on the quote row in the ops console, so the price they quote already includes them.

## Browsing without an account
The business side is readable end to end while signed out. Fudud mode used to call `needUser()` before it would render a form, which threw a sign-in sheet over `business.buurwen.com` on arrival.
- Forms (China sourcing, agent mandate) render publicly; the account is asked for at the **moment of committing**, via `submit()`. Cancelling the sheet leaves the form exactly as typed.
- Only the jobs that show *your own* records (FBG, your stock, your orders) gate, and they explain why inline rather than in a modal.
- The FBG fee table renders in full while signed out — `/api/config` is public, so nobody has to hand over a phone number to learn a price.

## Deploy (development: Buurwen.com on Cloudflare Workers)
| Address | What |
|---|---|
| `buurwen.com` (+ `www` → apex) | consumer site (`garsoore-dev` Worker, static assets) |
| `business.buurwen.com` | business site — the Worker maps it onto `business/`; shared `/assets/` come from the root |
| `china.buurwen.com` | China supply proxy (`garsoore-china-dev` Worker) — `/link` works without secrets, `/item` + `/search` need `APIFY_TOKEN` |

```
python tools/build-site.py --china https://china.buurwen.com   # packages only public files into deploy/public
cd deploy && npx wrangler deploy                                # site
cd server && npx wrangler deploy --config wrangler.dev.jsonc    # proxy
```
Auth is via the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` environment variables — never in a file. The built site carries `robots.txt` = disallow-all while it is a dev site.
On a real domain `chrome()` links the two surfaces as subdomains; locally and on `*.workers.dev` they stay folders (`business/`).

## Backend (shared API + D1) — `deploy/api.js`, `deploy/schema.sql`
Both hosts call the same Worker at `/api/*`, so **one login and one set of orders/quotes** covers buurwen.com and
business.buurwen.com (session cookie on `.buurwen.com`). Database: Cloudflare D1 `garsoore-dev-db`.
- Accounts: phone number + PIN (PBKDF2), created inside checkout. Staff = phones listed in the `STAFF_PHONES` secret.
- Orders are **re-priced on the server** from `deploy/catalog.gen.js` (generated by `tools/export-catalog.js` from the
  same `price()` the browser uses; the build runs it). Browser-sent prices are ignored.
- Payment: customer pays the merchant number (`vars.MERCHANT_*`), enters the transaction ID → staff verify → escrow held →
  completion only with the customer's pickup code → escrow released. Cancel/refund, 7-day disputes, reviews, referrals.
- Staff console: `business.buurwen.com/ops.html` (payments, orders, pickup desk, quotes, refunds & disputes, KPIs).
- `REQUIRE_VERIFIED="1"` (launch): products without `cost_verified=yes` sell only via a staff quote.
- Local full stack: `npx wrangler dev --cwd deploy --local --local-upstream localhost:8788 --port 8788`
  (apply the schema once with `npx wrangler d1 execute garsoore-dev-db --local --file schema.sql`; `deploy/.dev.vars` for local secrets).
- The plain static server (`python -m http.server`) still works: `RF.backend` falls back to the browser-only demo.

**Read next:** [docs/LAUNCH.md](docs/LAUNCH.md) (what blocks a profitable launch, unit economics) ·
[docs/DOCTRINE.md](docs/DOCTRINE.md) (UX doctrine — the psychology rules every screen follows).

## Console (admin.<domain>)
The admin console is its own site on `admin.buurwen.com` (→ `admin/index.html`, `assets/console.js` + `console.css`),
not a page inside either shop: sidebar sections for money, accounts, businesses, FBG, agents, catalogue, daily operations
and the audit log. `business.<domain>/admin.html` now redirects there.
- Only the **admin** role gets past the gate; everyone else sees a sign-out prompt.
- `vars.ADMIN_HOST` pins `/api/admin/*` to that hostname, so the admin endpoints answer nowhere else.
- The console is served with `X-Robots-Tag: noindex, nofollow`.
- For a second lock, put Cloudflare Access (Zero Trust) in front of `admin.<domain>` in the dashboard — the app needs no change.
- Moving to the real domain later: add `admin.garsoore.com` to `routes` and set `ADMIN_HOST` to it.

## Accounts & admin panel
Roles on `users.role`: **consumer · business · agent · staff · admin** (staff and admin both reach the ops console;
only admin reaches `business.<domain>/admin.html`). Business accounts carry a profile in `businesses`:
`seller` (sells their own stock) · `fbg` (Fulfilled by Garsoore — stock held and shipped by us) · `buyer` (wholesale) ·
`supplier` (factory) · `logistics`.

- **Bootstrap** (once): `cd deploy && npx wrangler d1 execute garsoore-dev-db --remote --file schema-2.sql`, then
  `npx wrangler secret put ADMIN_PHONES` (one number) and `npx wrangler secret put STAFF_PHONES` (comma-separated).
  Those numbers get their role when they register on the site. Exactly one admin is allowed; the panel refuses to
  create a second, or to demote/suspend the admin.
- **The panel** (`assets/admin.js`): overview by role, account search, create accounts of any type (business and agent
  accounts get their profile in the same step), change role, suspend (existing sessions are dropped), issue a temporary
  PIN, adjust store credit, approve businesses and set a per-business commission, approve agents, and an audit log.
- New accounts start with a temporary PIN and must set their own on first sign-in (`RF.pinGate`, `/api/auth/pin`).
- Every admin action is written to `admin_log` with who did it — account changes are always traceable.

## FBG — Fulfilment by Garsoore (`assets/fbg.js`, `deploy/schema-3.sql`)
Import → consolidate → store → sell, with the importer owning the goods the whole way.
1. The importer enrols and gets a **suite code**; Chinese suppliers ship to the **forwarder's China receiving address**
   (`vars.FBG_CHINA_ADDRESS`, `{suite}` replaced with the importer's code) with that code on every carton.
2. They declare each expected shipment (supplier, platform, tracking, value, and what to do with it).
3. Staff (ops console → **FBG**) receive: cartons, weight, cbm, count, photos → receiving fee charged; inspect; flag problems.
4. Several inbounds are **consolidated** into one air or sea consignment; on shipping, the freight cost is split across
   them by weight and charged to each owner's ledger.
5. On arrival the goods become **inventory** with a landed cost per unit (their goods cost + their share of fees).
6. The owner then picks per item: **keep** (we hand it over), **sell** (listed on buurwen.com as local stock, ready today —
   Garsoore takes `FBG.commissionPct` + pick & pack when it sells), or **agent** (creates a mandate, liquidity or margin).
7. A consumer order against FBG stock reserves units; the pickup code releases them, credits the owner's ledger with the
   sale and charges the commission. Cancelling returns the units to stock.
Fees live in `deploy/api.js → FBG`. Storage (`storagePerCbmDay` after `freeStorageDays`) is defined but **not yet charged
automatically** — add it before launch. Garsoore never finances the stock: the importer pays for the goods and owns them.

## Language (`assets/i18n.js`)
Somali is the interface language and the source of truth in the code. The **EN / SO** button in the header (and in the
console sidebar) switches the rendered text to English and remembers the choice (`localStorage garsoore.lang`, or
`?lang=en`). The layer translates text nodes plus `placeholder` / `title` / `aria-label`, re-runs on every re-render,
and handles phrases carrying numbers through a small pattern list. Anything without a translation stays in Somali, so a
missing entry costs a word rather than a screen. Supplier product titles are never translated. To add a phrase, put the
exact Somali string as the key in `DICT` (or add a regex to `PATTERNS` when it carries a number).

## Business modes — Fudud / Xirfadle (`assets/simple.js`)
The business site has two faces, switched by a button in its header (`localStorage garsoore.bizmode`, default **Fudud**).
- **Fudud (simple)** — one task launcher: source from China · receive & ship my purchase (FBG) · let an agent sell for me ·
  put my stock on sale · what's moving. Each job is a short guided card (3–4 fields, plain Somali, defaults chosen) that
  calls the same API as the pro screens. Fees, prices and the escrow promise are always shown — simple never means hidden.
- **Xirfadle (pro)** — the full surfaces: B2B board, mandate board with caps and spread splits, FBG inbound/consignments/
  ledger, landed cost per unit, tiers, freight. In pro mode `business/index.html`, `agents.html`, `fbg.html` and
  `china.html` render as before.
Both write the same records, so a mandate created in Fudud shows up in full detail in Xirfadle. Staff and admin tools
(`ops.html`, the console) are always the pro versions.

## JD.com as a supply channel
JD blocks its desktop pages and signs its price APIs, but the **mobile product page is readable**, so the proxy
(`server/china-proxy.js` → `jdItem()`) fetches `item.m.jd.com/product/<id>.html` and returns the real title, shop and
photos with **no Apify token**. JD masks the price for anonymous readers (`"jdPrice":"2??"`), so the reader returns
`price: null` and the site routes that item through a staff quote carrying the real name and photo — it never invents
a number. Paste any JD link into the home or Shop China box and you get a proper product page.
With `APIFY_TOKEN` set, JD keyword search (and priced results) come back through the same endpoints.

## Site essentials
- **Content pages** — `help.html`, `terms.html`, `returns.html`, `privacy.html` (linked in every footer) and a real
  `404.html` on both surfaces. Their words live in the HTML, written twice (`.lang-so` / `.lang-en`, toggled by
  `assets/pages.js`) — legal sentences are not machine-translated. All four are marked as drafts pending legal review.
- **Link previews** — `deploy/worker.js` rewrites `<head>` on product pages with real Open Graph tags (title, price,
  photo) from the bundled catalogue, so a product shared on WhatsApp shows the item instead of the bare domain.
- **Notifications** (`schema-6.sql`, `RF.bell` in `assets/api.js`) — the server writes a notification in the same batch
  as the event that caused it: payment verified, order sourced / shipped / arrived / ready / collected, quote priced or
  declined, mandate claimed or sold, FBG goods arrived, referral credit paid. A bell in the header shows the unread
  count and marks them read when opened. There is no push provider yet, so the ops console also has **one-tap WhatsApp**
  buttons with the right Somali message already written (payment chase, "your goods are ready", order update).
