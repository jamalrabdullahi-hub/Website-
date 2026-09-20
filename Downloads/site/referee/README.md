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
1. The importer enrols and gets a **suite code**; Chinese suppliers ship to the Garsoore China address (`vars.FBG_CHINA_ADDRESS`,
   `{suite}` is replaced) with that code on every carton.
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
