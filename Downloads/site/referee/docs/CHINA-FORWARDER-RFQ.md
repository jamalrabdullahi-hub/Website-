# Finding the Guangzhou receiving point

The receiving warehouse and the forwarder are normally **one company**. Freight forwarders in the China→Africa
trade give you a warehouse address and a client code for free, because they earn on the freight, not the storage.
So you are hiring one counterparty, not two.

---

## Where to look, best route first

**1. Somali importers who already do this.** Somalis have been importing out of Guangzhou for well over a decade.
Someone trading in Bakaara or Hamarweyne already has a consolidator there. The question to ask is not "do you know a
forwarder" — it is **"who receives your goods in China, and would you use them again?"** A name that comes with a
grudge attached is worth more than a hundred search results, because you can hear what went wrong.

**2. Your own suppliers.** The Made-in-China and 1688 suppliers in the catalogue ship to forwarders every working day.
Ask one directly: *"Which forwarder do your East African customers use? Can you send goods to their warehouse?"*
Suppliers have no reason to lie about this and every reason to be helpful — they want the order.

**3. Somali and East African trader groups** on WeChat, Facebook and Telegram. There is a large, long-standing African
trading community in Guangzhou. Ask in the group; the same two or three names will keep coming up.

**4. Alibaba's freight marketplace and Made-in-China listings.** Plenty of forwarders advertise there. Usable, but
unvetted — treat anything found this way as a stranger until proven otherwise.

**Do not start with a cold web search.** You will find hundreds of companies and have no way to tell them apart.

---

## Ask about DDP before anything else

Many China→Somalia forwarders quote **DDP** — "delivered duty paid": one all-in rate per kg or CBM that covers
freight, customs clearance and duty, to Mogadishu.

For a first shipment this is worth taking seriously, because it collapses three separate unknowns — the forwarder, the
clearing agent, and the duty rate — into **one number from one counterparty**. You lose visibility into the cost
build-up, which matters later when you are optimising margin, but you gain certainty now, which is what a proof of
concept actually needs.

The rate cards in `data/rate-cards.json` can hold a DDP rate: set the freight tiers to the all-in price, set the
customs duty band for the lane to `0`, and note in the card that duty is included in the freight rate. Say so in the
card's `notes` so nobody later double-counts duty that the forwarder already paid.

---

## The RFQ — send this to every candidate, unchanged

Sending the same text to three to five companies is what makes the quotes comparable. Change nothing between them.

> Hello,
>
> I am setting up regular imports from China to Mogadishu, Somalia. I am looking for a forwarder who can also receive
> and consolidate goods at a warehouse in Guangzhou. Please answer the following so I can compare offers fairly.
>
> **Receiving**
> 1. Do you have your own warehouse in Guangzhou? Please give the full address.
> 2. Do I get a client code to put on cartons so you can identify my goods?
> 3. How many days of free storage, and what is the charge after that?
> 4. When a parcel arrives, do you send me: photographs, the actual weight, and the measured dimensions? This is a
>    requirement, not a preference.
> 5. Can you check a carton against a purchase order number I give you, and tell me if the contents do not match?
>
> **Freight to Mogadishu**
> 6. Do you ship to Mogadishu by air and by sea? How often does each depart?
> 7. Air: your rate per kg, the **volumetric divisor** you use (5000 or 6000), your minimum charge, and your
>    typical door-to-door transit time.
> 8. Sea: your rate per CBM, minimum billable volume, minimum charge, and typical transit time.
> 9. Which surcharges are included in those rates, and which are extra?
> 10. Do you offer DDP (duty and clearance included)? If yes, please quote that as a separate all-in price.
> 11. If not DDP: do you hand over at the port or airport, or do you arrange clearance?
>
> **Commercial**
> 12. Payment terms. For a first shipment I would want to pay on arrival.
> 13. What happens if goods are lost or damaged? Do you offer insurance, and at what cost?
> 14. Please send a copy of your business licence.
> 15. Do you have other customers shipping to Somalia? May I speak to one?
>
> Thank you.

---

## Why question 7 matters more than it looks

The **volumetric divisor** decides what you are charged for anything bulky. At divisor 5000 the same carton is
charged 20% heavier than at 6000. Two forwarders quoting an identical "$7.20 per kg" are not quoting the same price
if one uses 5000 and the other 6000. Get the number in writing, and put it in the rate card.

The system already prices this correctly — it is why a 50 kg office chair is charged as 76 kg by air — so a wrong
divisor in the card quietly mis-prices every bulky product in the catalogue.

---

## Vetting: what should worry you

- **Full payment in advance, to a personal account.** For a first shipment, pay on arrival. A real forwarder with
  other Somali customers will not find this strange.
- **No verifiable address, or unwillingness to do a video call from the warehouse.** Ask them to walk the phone
  around. This costs them five minutes and tells you the place exists.
- **A rate far below everyone else's.** Either something is excluded that they have not mentioned, or the quote will
  change once your goods are sitting in their building.
- **No business licence, or a licence whose name does not match the bank account** you are asked to pay.
- **Vague answers about weighing and photographing.** If they will not measure cartons, you cannot calibrate your
  pricing and you are back to guessing.

---

## How to de-risk the first run

1. **Ship your own goods first, not a customer's.** One low-value box. If the forwarder turns out to be a fraud, you
   lose the box, not somebody's trust.
2. Give them the **PO reference** the system generates and require it in their arrival photographs.
3. Record what it actually costs — freight, clearance, duty, the measured weight and dimensions, and the real transit
   days — in the console's **Saxitaan** page. That single shipment corrects the four assumptions every price on the
   site currently rests on.
4. Only after that box lands should a paying customer's order go into the same pipe.

---

## What you should end up with

- A Guangzhou warehouse address, plus a client code → goes into `FBG_CHINA_ADDRESS`
- A named person and a WeChat contact
- Written air and sea rates, with the divisor and the minimums → goes into `data/rate-cards.json`
- Either a DDP rate, or a separate clearing agent in Mogadishu
- An answer on insurance

At that point every Tier 1 item in the launch list except the pickup premises and the merchant account is solved by
one relationship.
