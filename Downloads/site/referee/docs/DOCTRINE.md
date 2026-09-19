# Garsoore UX Doctrine

*Garsoore* means **referee**. The whole product is one promise: *a neutral party stands between buyer and seller, holds
the money, and makes sure what was promised is what arrives.* Every screen either earns that trust or spends it.
This doctrine is how we design so that it only ever earns it.

It is written for anyone who adds a screen, a sentence, a price, or a notification — designers, engineers, ops staff,
marketing. When in doubt, apply **the Referee Test** (end of this document).

---

## 0. The situation we design for

- **Trust is the bottleneck, not interest.** In a survey of 744 Somali professionals and students on e‑commerce, *trust
  ranked lowest* of all factors, and people said they do not feel safe shopping online; the availability of *local*
  payment methods (mobile money) drove awareness and acceptance. Perceived trust also directly drives intention to use
  digital wallets in Mogadishu. → We lead with protection and local payment, not with deals.
- **Mobile money is the rail.** EVC Plus (Hormuud), ZAAD (Telesom), Sahal (Golis), Premier Wallet. People already trust
  *these*; we borrow that trust by paying through them and showing the steps exactly as the phone shows them.
- **Phones, not desktops.** Small screens, variable data, shared devices. Every flow must work one‑handed at 375px.
- **Word of mouth and WhatsApp** carry more weight than ads. A recommendation from a relative or neighbour is the
  strongest signal there is.
- **Hidden costs kill checkouts everywhere.** Extra costs revealed late are the #1 fixable reason people abandon a
  checkout (~39% in Baymard's research); forced account creation and missing trust signals follow.

---

## 1. Principles

Each principle: the psychology behind it → the rule → where it lives in the product → how we know it works.

### P1 · Show the protection at the moment of fear
*Psychology:* loss aversion — a loss weighs roughly twice as much as an equal gain (Kahneman & Tversky). The fear at
the pay button is "I will lose my money."
**Rule:** Every money moment carries the escrow promise in plain words, next to the button, not in a footer.
**Where:** product trust strip, checkout 4‑step strip (*You pay → Garsoore holds → you check & collect → seller is paid*),
payment step ("the seller is not paid until you collect"), orders page escrow line per order.
**Measure:** checkout → order, order → paid conversion (ops funnel).

### P2 · One price, all‑in, before the button
*Psychology:* drip pricing and late fees trigger a sense of being tricked; anchoring on the first price seen makes any
later increase feel like a loss.
**Rule:** The price on the product page is the price paid. Anything that can be added (home delivery) is stated on the
product page with its exact amount and the threshold that makes it free. No fee may appear for the first time at checkout.
**Where:** "✓ $X is the whole price — goods, freight China→Mogadishu, duty and service included" under every price;
delivery fee and free threshold on product page, cart and checkout; server enforces the same numbers (`/api/config`).
**Measure:** cart → checkout, checkout → order.

### P3 · Fewer, better choices
*Psychology:* choice overload (Iyengar & Lepper) and Hick's law — more options, slower and less confident decisions.
**Rule:** The consumer never compares marketplaces, suppliers or freight modes — Garsoore picks the best source and shows
one card. Two pickup options, four payment methods, one button. Complexity lives on the business site, where buyers want it.
**Where:** Shop China merges platforms into one card per item; consumer product page has one buy path.

### P4 · Ask for commitment at the moment of value, and only as much as needed
*Psychology:* foot‑in‑the‑door / commitment & consistency (Cialdini); forced registration before value feels like a toll.
**Rule:** Browsing, saving and building a cart need no account. The account is created *inside* checkout — the mobile‑money
number they are already typing becomes the account, plus a name and a PIN. Never a separate sign‑up page before buying.
**Where:** checkout "This number becomes your account" block; `RF.authUI` only when an action truly needs identity
(quote requests, orders).

### P5 · Social proof must be true, recent and meaningful — or absent
*Psychology:* social proof (Cialdini) is powerful precisely because people assume it is real. One fake review found =
every review distrusted, and in a low‑trust market that spills onto the whole brand.
**Rule:** Only verified purchases can review (order must be *collected*). Purchase counts come from the database, cover a
stated window ("30 days"), and are hidden below 3 (a "1 person bought this" reads as "nobody buys this").
Never invent, round up, seed or buy reviews or counts.
**Where:** `/api/social` (`bought30` null below 3), reviews tied to COMPLETED orders, "✓ verified buyer" label.

### P6 · Show progress; make the next step obvious
*Psychology:* goal‑gradient effect — effort increases as people near a goal (Hull; Kivetz et al., coffee‑card study);
Zeigarnik — open loops stay on the mind.
**Rule:** Waiting is shown as progress with dates, never as silence. Thresholds are shown as a bar with the exact amount left.
**Where:** order timeline with timestamps per step and expected arrival date; "Add $X → free home delivery" bar in cart
and checkout; payment‑review message with expected time ("usually 30 minutes").

### P7 · Design the peak and the end
*Psychology:* peak‑end rule — people judge an experience by its most intense moment and its end (Kahneman).
**Rule:** The pickup moment is the peak: a big, clear 6‑digit code, the instruction to *check the item first*, and the
reassurance that the seller is only paid when they hand over the code. Only after collection do we ask for a review
and offer the referral — when satisfaction is highest.
**Where:** pickup code panel (READY), review + "buy again" after COMPLETED, referral card on orders page.

### P8 · Reciprocity, community, WhatsApp
*Psychology:* reciprocity (Cialdini); trust transfers through people we know.
**Rule:** Referrals give value to both sides (friend: 5% off first order; referrer: store credit once the friend has
*collected* — never on sign‑up, so it cannot be farmed). Sharing goes to WhatsApp by default.
**Where:** `?ref=CODE` links, referral card, `ECON.refReward`, credit auto‑applied (can be turned off) at checkout.

### P9 · Defaults serve the customer, and are remembered
*Psychology:* default effect (Thaler & Sunstein) — most people keep the default.
**Rule:** Defaults are the cheapest safe option (free pickup at Km4), never a paid add‑on. The last payment method, number
and address are remembered so repeat purchase is two taps. Nothing is ever pre‑ticked that costs money.

### P10 · Make it reversible
*Psychology:* perceived risk falls when a decision can be undone; ease of exit increases willingness to enter.
**Rule:** Cancelling is as easy as buying until the goods are purchased from the supplier (then the reason is explained,
and the 7‑day dispute path is offered instead). Refunds are tracked as a visible state ("refund in progress"), not a promise.
**Where:** Cancel button (AWAITING_PAYMENT → PLACED; local until CONFIRMED), dispute within 7 days of collection,
staff refunds queue.

### P11 · Say what is happening, in Somali, in short sentences
*Psychology:* uncertainty is experienced as risk; plain status reduces anxiety and support calls.
**Rule:** Somali first. One idea per sentence. Numbers, icons and currency carry the meaning so a quick glance is enough.
Every state has a human sentence (e.g. PAYMENT_REVIEW → "Lacagta waa la hubinayaa — badanaa 30 daqiiqo").
Errors say what to do next, never just "error".

### P12 · Honest urgency only
*Psychology:* scarcity and urgency work — which is exactly why fake versions are banned.
**Rule:** The only deadlines we show are real ones (unpaid orders are held 24 h; a staff quote is valid until withdrawn).
No countdown timers, "only 2 left" or "12 people are looking" unless it is literally true and measured.

### P13 · Two surfaces, two psychologies
The consumer site (buurwen.com / garsoore.com) optimises for *confidence*: warm cream, few choices, one price, protection.
The business site (business.) optimises for *control*: cool blue, tables, tiers, landed cost per unit, MOQ, suppliers,
RFQs. One click between them (the switch in the header), never mixed on one page.

---

## 2. Banned patterns (dark patterns)

Never ship any of these, whatever the short‑term conversion gain:

| Pattern | Example we will not do |
|---|---|
| Fake scarcity / fake urgency | countdown timers, "only 3 left" without stock data |
| Fake social proof | seeded reviews, inflated "bought" counts, reviews from non‑buyers |
| Drip pricing | a fee that first appears at checkout |
| Pre‑ticked extras | insurance, express delivery, donations ticked by default |
| Confirmshaming | "No thanks, I don't like saving money" |
| Roach motel | easy to order, hard to cancel or get a refund |
| Disguised ads | sponsored items without a clear label |
| Nagging | repeated pop‑ups asking to sign up / enable notifications |
| Bait price | showing a price we cannot honour (→ the verified‑cost launch switch) |
| Asking for secrets | staff never ask for a PIN; the pickup code is only shown to the customer |

---

## 3. How we measure (and when to change the doctrine)

The ops console (**Hawlgalka → Tirakoob**) shows the funnel from anonymous, per‑browser events:
`view → cart → checkout → order → paid`, plus GMV, revenue, gross profit, AOV, held escrow, refunds due, open disputes,
quote backlog age and catalogue verification.

- **Leading indicators:** order → paid within 24 h (payment friction), quote response < 4 h (red when late), disputes per
  100 collected orders, repeat purchase rate, share of orders from referrals.
- **Change one thing at a time,** run it for two weeks, compare the step it targets. If a change raises conversion but
  also raises cancellations or disputes, it failed.
- A principle can be changed only with evidence from our own customers, written into this file with the date and data.

---

## 4. The Referee Test (use on every feature)

Before shipping, answer all five with "yes":

1. **Would a neutral referee approve?** If the buyer saw exactly how this works, would they feel treated fairly?
2. **Is every number true?** Prices, counts, dates, stock, reviews — all real, all current.
3. **Is the money story visible?** At this step, does the user know who holds their money and how to get it back?
4. **Is it undoable?** Can the user back out, and is that as easy as going forward?
5. **Is it the fewest choices that still respect the user?**

---

## Sources

- Online purchase behaviour of Somali consumers — [ResearchGate](https://www.researchgate.net/publication/348054735_Online_Purchase_Behavior_of_Somali_Consumers)
- Online payment options and consumer trust: determinants of e‑commerce in Africa (744 Somali respondents) — [IJEK](https://ijek.org/index.php/IJEK/article/view/121), [PDF](https://pdfs.semanticscholar.org/6447/55534cd5b76c9a3020644b3ae8643bc86216.pdf)
- Determinants of digital wallet adoption in Mogadishu (trust → intention) — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S259029112600611X)
- EVC Plus and Somali SMEs — [ResearchGate](https://www.researchgate.net/publication/351814708_Assessing_the_Effects_of_the_Mobile_Money_Service_on_Small_and_Medium_Sized_Enterprises_Study_on_EVC-Plus_Services_in_Somalia)
- Hormuud merchant accounts — [hormuud.com/Merchant](https://hormuud.com/Merchant); Somalia payment rails overview — [Transfi](https://www.transfi.com/blog/somalias-payment-rails-how-they-work---evc-plus-mobile-banking-remittance-integration)
- Checkout abandonment causes — [Baymard: reduce cart abandonment](https://baymard.com/blog/reduce-cart-abandonment), [Baymard: abandonment statistics](https://baymard.com/lists/cart-abandonment-rate)
- Classic behavioural research: Kahneman & Tversky (prospect theory, loss aversion); Kahneman (peak‑end rule);
  Cialdini, *Influence* (reciprocity, commitment, social proof, scarcity); Iyengar & Lepper (2000) choice overload;
  Hick–Hyman law; Kivetz, Urminsky & Zheng (2006) goal‑gradient; Thaler & Sunstein, *Nudge* (defaults).
