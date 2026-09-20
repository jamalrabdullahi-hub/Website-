# Garsoore — launch readiness

Status as of 2026-09-19. The software can take real orders end to end. What stands between this and a profitable
launch is mostly **business setup**, listed below in the order it blocks money.

## What works now (live on buurwen.com / business.buurwen.com)

| Area | Done |
|---|---|
| Accounts | Phone + PIN (PBKDF2), one login across both sites (cookie on `.buurwen.com`), 5 tries / 15 min lockout, staff role |
| Orders | Server‑priced from the catalogue (browser prices ignored), baskets, delivery fee + free threshold, first‑order promo (capped), store credit |
| Payment | Mobile money to the Garsoore merchant number → customer enters transaction ID → staff verify → escrow *held*; unpaid orders expire after 24 h |
| Fulfilment | Staff advance orders; completion **only** with the customer's 6‑digit pickup code (staff never see it) → escrow *released* |
| After‑sale | Cancel (auto refund‑due if paid), 7‑day disputes with staff resolution, verified‑buyer reviews, buy again |
| Growth | Referral codes / `?ref=` links, credit paid when the friend *collects* the first order, WhatsApp share |
| Quotes | Any link → quote request → staff price → customer buys at the fixed price |
| Ops console | `business.buurwen.com/ops.html`: payments to verify, orders, pickup desk, quotes (late > 4 h in red), refunds & disputes, KPIs (GMV, revenue, gross profit, AOV, funnel) |
| Safety switch | `REQUIRE_VERIFIED=1` → products without a human‑checked cost become "request a price"; server refuses to sell them at a placeholder |

## Launch blockers (business, in order)

1. **Merchant accounts** — EVC Plus (Hormuud), ZAAD (Telesom), Sahal (Golis), Premier Wallet. Put the numbers in
   `deploy/wrangler.jsonc → vars.MERCHANT_*`. Until then the payment step says "(Dev) not configured — do not send money".
2. **Confirm prices.** The catalogue is now built from real supplier listings (`tools/harvest-mic.py`), but a listed
   price is an asking price (`cost_verified = check`). For each product you will really sell: message the supplier from
   the `source_url`, confirm unit price at your quantity, packed weight and lead time, update `data/catalog.csv`, set
   `cost_verified = yes`, run `python tools/import-catalog.py`. Start with 50–100 best sellers. Turn on
   `REQUIRE_VERIFIED = "1"` for launch — everything else still sells, via a staff quote.
3. **Supply chain contracts**: a buying agent / consolidator in Guangzhou (or Yiwu), an air + sea forwarder to MGQ, a
   customs broker, and the Km4 pickup counter. Their real rates replace the assumptions in `assets/catalog.js → RULES`.
4. **Domestic sellers**: signed agreements with the commission (8% in `ECON.commission`) and payout terms
   (on pickup‑code release).
5. **Legal pages**: terms of sale, returns (7 days), privacy (we store phone, name, orders), company registration.
6. **Staff**: set staff phone numbers — `npx wrangler secret put STAFF_PHONES` (comma‑separated, e.g. `252615551234`),
   then have them register on the site.
7. **Security hygiene**: rotate every credential pasted into chats (Cloudflare tokens, R2 keys, server SSH key);
   move to the production account/domain (garsoore.com) per the plan to swap servers before launch.
8. **Later (not blocking)**: SMS/WhatsApp OTP instead of PIN‑only sign‑in; automatic payment confirmation via the
   operators' merchant APIs; Apify token for live China prices (`wrangler secret put APIFY_TOKEN` on the proxy).

## Unit economics (from `deploy/api.js → ECON` and `assets/catalog.js → RULES`)

Per order, Garsoore earns:

- **China item**: 10% margin on landed cost (goods + China freight + consolidation + intl freight + 5% duty).
  e.g. laptop $907 → **$82** revenue.
- **Domestic item**: 8% commission on the seller's price. e.g. phone $365 → **$29**.
- **Delivery**: +$5 fee vs ~$3.50 cost (free above $150 → −$3.50).
- **Costs per order**: ~1% mobile‑money fee; first‑order promo ≤ $10; referral credit $5 (only after a collected order).

Verified in a test run: 2 orders, GMV $1,272 → revenue $111.61 → gross profit $95.39 (7.5% of GMV).

**Break‑even** = monthly fixed costs ÷ average gross profit per order.
*Illustration (assumptions, replace with real numbers):* $2,500/month fixed (2 staff, Km4 counter, phones, misc)
÷ $20 average gross profit ≈ **125 orders/month ≈ 4 a day**.

**Recommendation:** 10% on China goods is thin once FX moves, damage, returns and failed sourcing are counted.
Consider 15% for small items (< $50, where freight minimums already hurt) and keep 10% on big tickets — change
`RULES.margin` in `assets/catalog.js` (one number) and rebuild. The dashboard shows the effect on gross profit within days.

## Launch‑day switches

```
deploy/wrangler.jsonc  vars.MERCHANT_EVC / _ZAAD / _SAHAL / _PREMIER = real numbers
deploy/wrangler.jsonc  vars.REQUIRE_VERIFIED = "1"
npx wrangler secret put STAFF_PHONES
python tools/build-site.py --china https://china.<domain> && cd deploy && npx wrangler deploy
```

UX rules for everything above: [DOCTRINE.md](DOCTRINE.md).
