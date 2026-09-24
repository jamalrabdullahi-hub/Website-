# Garsoore purchaser-agent service

`business.<domain>` is not only a wholesale marketplace — it is a **service**: a sourcing agent you hire. A trader
sends an Alibaba / 1688 / Made-in-China link, or just a description, and someone actually goes and investigates,
negotiates, and comes back with **one priced offer**.

## The people

| Role | Who | What they do | Paid from |
|---|---|---|---|
| `client` | a trader (or a legacy buyer who already imports) | sends a link/description, accepts a quote | pays the fee |
| `sales` | **sales agent** — owns a book of clients | brings and manages clients | **50%** of the goods commission of their clients' orders |
| `china` | **China agent** (Guangzhou) | sources, negotiates, quotes | a cut of the commission (**25%** default) |
| — | Garsoore | the platform: rail, escrow, clearance, pickup | the remainder (**25%**) |

Existing `agent` (the marketplace *wakiil* who fronts a per-deal mandate) is a different job and is untouched.

## The money (all numbers live in `deploy/api.js → SOURCING.commission → COMM`)

- **Engage one of two ways**: a **$50/month subscription** (no deposit, no minimum), or a **30% deposit** on the
  **goods value only** (never shipping).
- **MOQ**: a non-subscriber must clear **$500 of goods** — below it the agent's investigation costs Garsoore more
  than the trade is worth. A subscriber has no minimum.
- **Commission**: **5% → 3% of the goods value** (tiered by size; the 3% band starts at $5,000). It is never charged
  on shipping.
- **Split of that commission**: **50% sales agent · 25% China agent · 25% Garsoore**. Rounded to the cent, platform
  takes the remainder, so the three always sum exactly.
- Commission is **earned when the request becomes a real order** (`ORDERED`) and written to `agent_ledger` in the
  same batch as the state change.

## The flow

`AWAITING_DEPOSIT` → deposit confirmed (`SOURCING`) → a China agent **claims** it and **quotes** (`QUOTED`) →
client **accepts** (`ACCEPTED`) → ops **orders** it (`ORDERED`, commission accrues) → delivered.
Side-exits: **`UNSOURCEABLE`** (our fault → full deposit refunded) · **`CANCELLED`** (client walks → deposit decays
5%/day against the agent's spent time) · **`DECLINED`**.

## Assigning an agent

Every client carries `users.client_agent`. On sign-up they **assign themselves an agent** from the public roster
(`GET /reps?kind=sales`), or Garsoore assigns the approved sales agent carrying the fewest clients. Ops can reassign
any time (`POST /ops/clients/{id}`) — a client with no agent is a sale nobody is paid for.

## Surfaces

- **Storefront**: `business/sourcing.html` (`assets/sourcing.js`) — both plans, the MOQ, the commission, an agent
  picker, and a form that creates the account inside the same tap when signed out.
- **Agent desk**: `business/agent.html` (`assets/agentdesk.js`) — sales see their client book + earnings; China
  agents see the sourcing queue with claim/quote. Accounts apply via `POST /rep/apply` and are approved by ops.
- **Ops/admin**: `admin.<domain>` → **Reps** page — approve/pause reps, reassign the client book, read the commission
  ledger (`/ops/reps`, `/ops/clients`, `/ops/commission`).

## Tables (`deploy/schema-17.sql`)

`agent_reps` (sales|china rep accounts) · `users.client_agent` + `cust_kind` · `sourcing.sales_agent_id` /
`china_agent_id` / `customer_kind` / `commission_goods` / `commission_split` · `agent_ledger` (signed commission and
payouts; balances are always `SUM(amount)`, never a stored number).
