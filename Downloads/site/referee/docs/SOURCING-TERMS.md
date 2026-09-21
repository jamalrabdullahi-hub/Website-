# Managed wholesale sourcing — the rules

*Status: drafted, not reviewed by a lawyer. These are the operating rules the software enforces; they are not yet a
legal opinion on whether they are enforceable in Somalia. See the note at the bottom.*

## Who this is for

A Somali trader with capital and no interest in logistics. They can find stock on Alibaba — that part is easy. What
stops them is everything after "I want this":

> What is an incoterm? How do I get it from the factory to the port? How do I get it out of the port here?

They do not want to learn the answers. They want somebody to do it. That is the product.

## What Garsoore does

1. The trader sends a link (Alibaba, 1688, Made-in-China) or just describes the goods.
2. A Garsoore agent contacts the supplier, verifies the listing is real, and negotiates.
3. Garsoore comes back with **one price** — goods and shipping named separately, nothing else to pay.
4. On acceptance it becomes a normal Garsoore order and runs the existing procurement rail: factory → Garsoore China
   facility → consolidation → freight → Mogadishu → the trader's hands.

The trader never speaks to the factory, never books freight, never files a customs entry.

## The deposit

A deposit buys an agent's real hours. The rules are about **whose fault it is** that those hours were spent.

| Rule | Value |
|---|---|
| Deposit | **30% of the goods value** |
| Deposit on shipping | **None.** Shipping is never in the deposit base |
| Minimum deposit | $20 |
| Subscription alternative | **$100/month — no deposit at all** |
| Quote validity | 7 days |

### Garsoore fails to source it → full refund

Dead listing, a "supplier" who turns out to be a scam, a factory that will not sell at any price — **the whole
deposit comes back**. No deduction.

That failure is Garsoore's. The listing was on our site, or we accepted the link; the trader should not pay for our
inability to deliver. This rule is what makes the deposit safe to pay.

### The trader walks away mid-negotiation → a share is kept

**5% of the deposit per day**, counted from the day sourcing started, capped at the full deposit.

- **Day 0 costs nothing.** Changing your mind within a day is not the behaviour this exists to discourage.
- Day 1 → 5%. Day 10 → 50%. **Day 20 → the whole deposit.**

The agent's time was spent whether or not the trader proceeds, and a supplier who has been negotiated with and then
dropped is a relationship Garsoore has to repair.

**The exact figure is shown before the trader confirms.** The cancel button states, in money, what will be kept and
what will be returned, for that request, on that day. A rule you only discover when it is applied to you is a trap,
however fair the arithmetic is.

## What is deliberately *not* charged

- No deposit on the shipping portion
- No fee for a quote that the trader simply declines while it is still valid — declining a price is not cancelling
- No charge when Garsoore declines the job

## Open questions before this takes real money

1. **Is a 5%/day forfeit enforceable** under Somali contract law, and is 20 days to total forfeiture defensible? It is
   aggressive. It is also stated up front, which is the usual test, but that is a lawyer's call rather than mine.
2. **The subscription cannot be auto-billed** — there is no merchant account and no recurring payment provider. Today
   `users.sub_until` is set by an administrator by hand after payment is received.
3. **Refunds are manual.** A full refund on an unsourceable request creates the obligation; a person still has to send
   the money back.
4. Should the forfeit **cap below 100%**? Keeping an entire deposit reads as punitive even when the days justify it.

## Where it lives

- Terms: `SOURCING` in `deploy/api.js`, published at `/api/config` so the page and the server cannot disagree
- Forfeit arithmetic: `forfeitOf()` in `deploy/api.js` — days elapsed since `deposit_at`, 5% each, capped
- Data: `sourcing` table, `deploy/schema-11.sql`
- Customer page: `business/sourcing.html` → `assets/sourcing.js`
- Staff queue: `/ops/sourcing`
- Free shipping calculator (no account, no email): `calculator.html` → `assets/calc.js`
