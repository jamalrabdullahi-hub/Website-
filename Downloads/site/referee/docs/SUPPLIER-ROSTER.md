# Supplier roster — who can fill the Garsoore catalogue

The model this roster serves:

> Garsoore sells → the supplier sources and fulfils → goods arrive at the forwarder's China
> warehouse in Guangzhou → one consolidated AWB/BL → Mogadishu (Port of Mogadishu or Aden Adde/MGQ).

## The thing that changes the shortlist

Because goods only have to reach **Guangzhou**, not Mogadishu, "can you ship to us" is
trivially true for every supplier in China. Domestic Chinese shipping is ¥5–15 and next-day.
International shipping — the hard, expensive part — is Garsoore's own leg.

So the binding constraints are not logistical. They are:

1. **Is there an API?** Without one, somebody types the catalogue in by hand.
2. **Can you pay it without a Chinese bank account?** This is what actually excludes the
   cheapest sources.
3. **Does the feed carry a weight?** No weight, no freight quote, no instant-buy.

---

## Tier A — plug in directly (API, card payment, English)

| Supplier | Strength | API | MOQ | Weights | Notes |
|---|---|---|---|---|---|
| **CJdropshipping** | general consumer goods | ✅ live | 1 | ✅ | **integrated.** No phones or laptops — confirmed by probing their API |
| **Sunsky-online** | phone accessories, parts, wearables, cameras, repair tools — 300k SKUs | ✅ Open API | 1 | ? | Shenzhen since 2001, tiered wholesale pricing. **Best next integration** |
| **AliExpress Open Platform** | largest catalogue of anything | ✅ | 1 | unreliable | application already submitted |
| **Chinavasion** | electronics incl. phones, tablets, refurbished | ✅ | 1 | ? | 17 years, B2B dropship. Verify goods before trusting the branded listings |
| **Eprolo** | general, free tier, branding | ✅ | 1 | ? | budget option, thinner catalogue |
| **HyperSKU** | faster sourcing at volume | ✅ | varies | ? | aimed at established sellers |

Deliberately **not** recommended: Zendrop, Spocket, AutoDS, DSers, Printful. All are
Shopify-first and built to ship direct to a Western end customer. Garsoore is neither.

## Tier B — the real Chinese market (cheapest, hardest)

1688, Taobao, JD and Pinduoduo are where the prices actually are — often a fraction of what
an export-facing platform quotes for the same item. They are domestic-only and need a Chinese
entity, a Chinese phone number and Alipay or WeChat Pay.

Two ways in:

- **Your own counterpart in Guangzhou buys on your behalf.** Best margin, needs a person you
  trust and cannot be automated at the start.
- **A buying agent** (Superbuy, Wegobuy, CSSBuy, Sugargoo). Note what this is: these agents
  are Garsoore's own business model pointed at a different market. Using one means paying
  somebody else to be the layer you are trying to be. Fine as a bridge, wrong as a strategy.

> Pandabuy was shut down by enforcement action in 2024. Do not build on an agent whose
> business is moving counterfeits.

## Tier C — phones and computers

There is no API for genuine branded phones, and there will not be one.

- **Authorised Apple / Samsung distribution** is closed to a new importer in an unbanked
  market. Not a paperwork problem you can solve this year.
- **Parallel import** from Huaqiangbei (Shenzhen) or Hong Kong wholesalers is what Mogadishu
  phone shops already do. Genuine sealed units, no manufacturer warranty, sometimes
  region-locked. Priced daily on WeChat, settled in cash.
- **Chinavasion** is the only Tier A name that lists phones and tablets at all, including
  refurbished. Treat any branded listing as unverified until a sample is in your hands.

**Counterfeits are the whole risk.** The Alibaba scrape turned up fake S24s and "Apple"
phones openly listed. One counterfeit sold under escrow ends the refund promise the whole
business rests on.

**So do not put branded phones in the catalogue.** Use the two paths already built:

- **FBG** — a phone trader lists their own stock. Garsoore never owns it and never carries
  the counterfeit risk, and takes 10%.
- **Request a quote** — the customer asks, your counterpart quotes today's price, staff post
  it. This is a price desk, not a catalogue, because phone prices move like currency.

---

## Order to work in

1. **Sunsky** — closest adjacency to the electronics gap, has an API, MOQ 1, and Shenzhen is
   next-day to Guangzhou.
2. **AliExpress** — when the application clears. Breadth, but the weights need checking.
3. **Chinavasion** — only once somebody has held a sample.
4. **A Guangzhou counterpart buying on 1688** — the best margin, and the slowest to arrange.

## Ask every one of them the same four questions

1. Will you ship to our Guangzhou address and mark each carton with our suite code?
2. Does your API return a **packed weight** per SKU, and are dimensions available?
3. What is the real MOQ, and does price tier with quantity?
4. Can we pay by international card or PayPal without a Chinese entity?

Question 2 is the one that decides whether a supplier can be sold instantly or only by quote.

## One rule

**Do not stack agents.** Every layer takes a margin, and being the layer is Garsoore's entire
business. An agent who buys from another agent is a customer, not a competitor.

---

## API access gates — what each source actually asks for

Checked against the platforms' own documentation, not their marketing.

| Source | Gate | Verdict |
|---|---|---|
| **CJdropshipping** | email + API key | open, integrated |
| **SUNSKY** | account + Open API key | open, probe written |
| **AliExpress** | developer application | applied |
| **1688** | **Alipay with enterprise real-name verification** | needs a Chinese entity |
| **JD** | Chinese business entity | needs a Chinese entity |
| **Taobao / Pinduoduo** | Chinese entity | needs a Chinese entity |

### 1688 Open Platform, in detail

From `open.1688.com/doc/appJoin.htm` (updated 2026-08-19), developer registration needs **both**:

1. an Alibaba China account, and
2. an Alipay account that has passed **enterprise real-name verification** (企业实名认证) —
   enterprise developers additionally need merchant certification (商家认证).

Requirement 2 needs a Chinese business licence. Everything after it is straightforward: register
an app for an appKey and a 5,000-call cap, pick WEB authorisation for self-use, submit for review,
and Alibaba answers within a week. Apps built purely for our own use are **explicitly permitted** —
they are approved and simply never listed in the app market. On approval the cap rises to 100,000
calls, which is ample for a catalogue importer.

Necessary but not sufficient: individual API groups generally need their own permission
application, and the platform has paid-service rules. Clearing the entity hurdle does not by itself
hand over a product feed. The documentation is Chinese-only and the signing scheme is Alibaba's own.

### The pattern worth seeing

Paying Chinese suppliers, buying on JD, and the 1688 API are all gated behind **the same single
thing**: a Chinese legal entity. The Guangzhou counterpart is not only someone who pays suppliers —
they are the legal person who can hold the enterprise Alipay and register the developer account.

That makes the counterpart the highest-leverage item on this list, and the 1688 API one of the
lowest: its payoff is an automated feed, and 421 wholesale products were imported without one.
