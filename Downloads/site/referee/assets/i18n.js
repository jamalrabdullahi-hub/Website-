/* Garsoore — Somali first, English on request.
   The interface is written in Somali. This layer swaps rendered Somali for English when the reader asks for it:
   it translates text nodes and the attributes people actually read (placeholder, title, aria-label), and re-runs
   whenever a page re-renders. Anything without a translation stays in Somali rather than breaking — so a missing
   entry costs a word, never a screen. Supplier product titles are left exactly as the supplier wrote them. */
(function () {
var RF = window.RF = window.RF || {};
var KEY = "garsoore.lang";
var lang = "so";
try {
  var q = new URLSearchParams(location.search).get("lang");
  if (q) localStorage.setItem(KEY, q === "en" ? "en" : "so");
  lang = localStorage.getItem(KEY) === "en" ? "en" : "so";
} catch (x) {}

/* exact phrases (left: as written in the code, right: English) */
var DICT = {
  /* chrome + navigation */
  "Suuqa": "Market", "Xayeysiis": "Classifieds", "Adeegyo": "Services", "Shaqooyin": "Jobs",
  "Ka iibso Shiinaha": "Shop China", "Dalabyadayda": "My orders", "Iibi": "Sell", "Dhig": "Post",
  "Gal": "Sign in", "Ganacsi": "Business", "Dambiisha": "Cart", "Kaydi": "Save",
  "Suuqa ganacsiga": "Business market", "Iibsi Shiinaha": "China sourcing", "Qandaraasyo": "Tenders",
  "Rar": "Freight", "Suuqa badeecada": "Commodities", "Hawlaha shirkadda": "Company activity",
  "⚙ Hawlgalka": "⚙ Operations", "🛡 Console ↗": "🛡 Console ↗", "FBG": "FBG", "Wakiillo": "Agents",
  "Dib u deji xogta": "Reset data", "Ganacsi  →": "Business →", "Garsoore ⇄ Ganacsi": "Garsoore ⇄ Business",
  "— garsooraha u dhexeeya iibsadaha iyo iibiyaha. Prototype · xogtu waxay ku jirtaa browser-kaaga.":
    "— the referee between buyer and seller. Prototype · data is stored in your browser.",

  /* home */
  "✓ Iibiye kasta waa la hubiyay": "✓ Every seller is verified",
  "Wax walba,": "Everything,", "hal meel.": "in one place.",
  "Alaab, adeegyo iyo xayeysiis gudaha Soomaaliya — lacagtaadu way xajisan tahay ilaa aad hesho.":
    "Goods, services and classifieds across Somalia — your money is held safely until you receive.",
  "Raadi": "Search", "Qiimee": "Get a price", "Qaybaha": "Categories",
  "Ka hel Shiinaha.": "Source it from China.", "Ku iibso Garsoore.": "Buy it through Garsoore.",
  "Ka hel Shiinaha. Ku iibso Garsoore.": "Source it from China. Buy it through Garsoore.",
  "Ku dheji link JD, 1688, Taobao ama Pinduoduo — hal qiimo, hal badhan. Iibsiga, rarka iyo keenista annaga ayaa qabanayna.":
    "Paste a JD, 1688, Taobao or Pinduoduo link — one price, one button. We handle the buying, freight and delivery.",
  "Hadda la jecel yahay": "Popular now", "Dhammaan": "All", "Gudaha": "Local", "Shiinaha": "China",
  "Kala saar": "Sort", "Ku habboon": "Best match", "Qiimaha ↑": "Price ↑", "Qiimaha ↓": "Price ↓",
  "Ugu dhakhsaha badan": "Fastest", "Ugu badnaan $": "Max $", "Diyaar maanta": "Ready today",
  "Aad dhowaan eegtay": "Recently viewed", "Pickup Muqdisho": "Pickup in Mogadishu",
  "Jumlad, qandaraas, adeegyo ganacsi iyo iibsi Shiinaha oo badan.": "Wholesale, tenders, business services and China sourcing at scale.",
  "Codso qiimo": "Request a price", "Wax lama helin.": "Nothing found.", "Ka raadi Shiinaha →": "Search China →",
  "Iibiyeyaasha gudaha (Muqdisho, Hargeysa…) waa la diiwaangelinayaa — alaabtooda halkan ayay ka soo muuqan doontaa.":
    "Local sellers (Mogadishu, Hargeisa…) are being signed up — their goods will appear here.",
  "Eeg alaabta Shiinaha →": "See goods from China →",

  /* categories */
  "Taleefanno": "Phones", "Kombiyuutar": "Computers", "Qalab guri": "Appliances", "Alaab guri": "Furniture",
  "Baabuur & qalab": "Vehicles & parts", "Elektaroonik": "Electronics", "Guriga & jikada": "Home & kitchen",
  "Dhar & kabo": "Clothing", "Dhismo & amni": "Building & security",
  "SHIINAHA": "CHINA", "GUDAHA": "LOCAL", "GANACSI": "BUSINESS", "GARSOORE CHINA": "GARSOORE CHINA",
  "Garsoore — Wax walba, hal meel": "Garsoore — Everything, in one place",
  "Alaab": "Item", "Ka iibso Shiinaha — Garsoore": "Shop China — Garsoore",

  /* product */
  "Hal qiimo": "One price", "Kharash qarsoon ma jiro": "No hidden costs", "Lacag la xajiyo": "Money held safely",
  "Garsoore ayaa haya ilaa aad hesho": "Garsoore holds it until you receive", "Celin 7 maalmood": "7-day returns",
  "Haddii aysan ahayn sidii la sheegay": "If it isn't as described", "Celin": "Returns", "7 maalmood": "7 days",
  "Hadda iibso": "Buy now", "🛒 Dambiisha": "🛒 Add to cart", "♡ Kaydi": "♡ Save", "♥ La kaydiyay": "♥ Saved",
  "↗ La wadaag": "↗ Share", "Nooca": "Variant", "Faallooyinka iibsadayaasha": "Buyer reviews",
  "Kaliya dadka alaabta dhab ahaan qaatay": "Only people who actually collected the item",
  "Faallo weli ma jirto. Faallooyinka Garsoore waxaa qora oo keliya dadka alaabta ka qaatay — lama iibsan karo, lama been abuuri karo.":
    "No reviews yet. Only people who collected the item can review on Garsoore — reviews cannot be bought or faked.",
  "Waxyaabo la mid ah": "Similar items", "Garsoore China": "Garsoore China", "Alaabtan lama helin.": "Item not found.",
  "Dib u noqo →": "Go back →", "Codso qiimo rasmi ah": "Request an official price",
  "Halka ay taallo": "Location", "Diyaar": "Ready", "Kayd": "Stock", "Il": "Source", "Model": "Model",
  "✓ iibsade la hubiyay": "✓ verified buyer", "faallo la hubiyay": "verified reviews",

  /* cart + checkout */
  "0 shay": "0 items", "Dambiishu waa madhan tahay.": "Your cart is empty.", "Bilow iibsiga →": "Start shopping →",
  "Waxaad kaydsatay": "Saved items", "Taabo ♡ alaab kasta si aad u kaydsato.": "Tap ♡ on any item to save it.",
  "U gudub lacag bixinta": "Go to payment", "Ka saar": "Remove", "Alaabta": "Goods", "Gaarsiin": "Delivery",
  "Ka qaadasho Km4": "Pickup at Km4", "Gaarsiin guriga": "Home delivery", "Wadarta": "Total", "Bilaash": "Free",
  "Bilaash (pickup)": "Free (pickup)", "✓ Gaarsiin guriga waa bilaash": "✓ Home delivery is free",
  "🔒 Lacagta waa la xajiyaa ilaa aad hesho.": "🔒 The money is held until you receive.",
  "Lacag bixinta": "Payment", "Halkee ka qaadanaysaa?": "Where will you collect it?",
  "Xarunta Garsoore · Km4, Muqdisho": "Garsoore counter · Km4, Mogadishu",
  "Gaarsiin guriga (Muqdisho)": "Home delivery (Mogadishu)", "Ku bixi": "Pay with", "Isticmaal": "Apply",
  "Adiga": "You", "ayaa bixiya": "pay", "ayaa haya lacagta": "holds the money", "ayaad hubisaa": "you check it",
  "oo qaadataa": "and collect", "Kadib": "Then", "iibiyaha": "the seller", "ayaa la siiyaa": "is paid",
  "Dhimis": "Discount", "Dheeraad": "Credit", "kharash kale ma jiro": "no other costs",
  "lacagtaada waa laguu celinayaa": "your money is refunded",
  ". Waad joojin kartaa ka hor inta aan la iibsan.": ". You can cancel before we buy it.",
  "🔒 Haddii alaabtu aysan iman ama aysan ahayn sidii la sheegay,": "🔒 If the goods don't arrive or aren't as described,",
  "Lambarkan ayaa noqonaya akoonkaaga": "This number becomes your account",
  "— si aad dalabkaaga ula socoto.": "— so you can follow your order.",
  "Akoon ma leedahay? Gal": "Already have an account? Sign in",
  "Hal tallaabo oo kale": "One more step", "Waan bixiyay": "I have paid",
  "Mar dambe ayaan bixin doonaa": "I'll pay later", "Tixraac": "Reference",
  "🔒 Lacagtu waxay taagan tahay Garsoore — iibiyaha lama siinayo ilaa aad alaabta qaadato.":
    "🔒 Garsoore holds the money — the seller is not paid until you collect the goods.",

  /* orders */
  "socda": "in progress", "diyaar in la qaado": "ready to collect", "Garsoore ayaa haysa": "held by Garsoore",
  "dheeraadkaaga": "your credit", "wadar": "total", "Socda": "Active", "Dhammaaday": "Finished",
  "Dalabyada": "Orders", "Codsiyada qiimaha": "Price requests", "Dalab weli ma jiro.": "No orders yet.",
  "Halkan wax ma jiraan.": "Nothing here.", "Jooji": "Cancel", "Cabasho": "Complaint", "★ Qiimee": "★ Rate",
  "Mar kale iibso": "Buy again", "Dir faallada": "Send review", "Koodhka qaadashada": "Pickup code",
  "⏳ Sugaya lacag bixintaada": "⏳ Waiting for your payment",
  "Dalab": "Ordered", "La xaqiijiyay": "Confirmed", "Laga iibsaday": "Bought", "Soo socda": "On the way",
  "Yimid Soomaaliya": "Arrived in Somalia", "La qaatay": "Collected", "La joojiyay": "Cancelled",
  "Lacag weli lama bixin": "Not paid yet", "🔒 Lacagta Garsoore ayaa haysa ilaa aad hesho": "🔒 Garsoore holds the money until you receive",
  "✓ Lacagta iibiyaha waa la siiyay": "✓ The seller has been paid",
  "↩ Lacag celin ayaa socota (24 saac gudahood)": "↩ A refund is on its way (within 24 hours)",
  "↩ Lacagta waa laguu celiyay": "↩ Your money was refunded",
  "Saaxiibkaa ku casuun": "Invite a friend",
  "Marka saaxiibkaa qaato dalabkiisa koowaad, waxaad heshaa dheeraad. Isaguna wuxuu helayaa 5% dhimis (SOODHAWOW).":
    "When your friend collects their first order you get credit. They get 5% off (SOODHAWOW).",

  /* China page */
  "Kuma baahnid akoon Shiinees, luqad, lacag bixin Shiinees ama rar. Ku dheji link — waxaad helaysaa hal qiimo iyo hal badhan.":
    "No Chinese account, language, payment or freight needed. Paste a link — you get one price and one button.",
  "Ku dheji": "Paste", "link ama raadi": "a link, or search", "Hel qiimo": "Get a price",
  "hal wadar, kharash qarsoon ma jiro": "one total, no hidden costs", "Iibso": "Buy",
  "Ka qaado": "Collect", "Muqdisho ~20 maalmood": "Mogadishu in ~20 days",
  "Ka raadi dhammaan suuqyada Shiinaha": "Search every Chinese marketplace",
  "Tijaabi: laptop JD": "Try: a JD laptop", "Tijaabi: AC 1688": "Try: an 1688 air conditioner",
  "Tijaabi: Taobao": "Try: Taobao", "Tijaabi: Pinduoduo": "Try: Pinduoduo",
  "⏳ Waa la raadinayaa…": "⏳ Looking it up…",

  /* sign-in sheet */
  "Samee akoon": "Create account", "Magacaaga": "Your name", "Lambarka taleefanka": "Phone number",
  "PIN (4–6 lambar)": "PIN (4–6 digits)", "Akoon ma lihid?": "No account?",
  "Samee mid — 20 ilbiriqsi": "Create one — 20 seconds", "Akoon ma leedahay?": "Already have an account?",
  "Lambarkaaga taleefanku waa akoonkaaga — hal akoon Garsoore iyo Ganacsi.":
    "Your phone number is your account — one login for Garsoore and Business.",
  "🔒 PIN-kaaga cid kale lama wadaagto — shaqaalaha Garsoore weligood kuma weydiin doonaan.":
    "🔒 Never share your PIN — Garsoore staff will never ask for it.",
  "Beddel PIN-kaaga": "Change your PIN", "PIN cusub (4–6 lambar)": "New PIN (4–6 digits)", "Kaydi": "Save",

  /* business surfaces (most used) */
  "Mandate-yadayda": "My mandates", "Suuqa mandate-yada": "Mandate board", "Shaqadayda (wakiil)": "My work (agent)",
  "Sida ay u shaqeyso": "How it works", "Degdeg": "Liquidity", "Faa'iido": "Margin",
  "+ Mandate cusub": "+ New mandate", "Qaado mandate-kan": "Take this mandate", "Qiimo dhig": "Set a price",
  "Diiwaangeli dalab": "Log an offer", "Xidh heshiiska": "Close the deal", "Taariikhda": "History",
  "Shixnadaha soo socda": "Incoming shipments", "Kaydkaaga Muqdisho": "Your stock in Mogadishu",
  "Xisaabta": "Statement", "+ Ku sheeg shixnad": "+ Declare a shipment", "Koodhkaaga": "Your code",
  "Cinwaanka Shiinaha (Garsoore)": "Garsoore China address", "Koobbi cinwaanka": "Copy the address",
  "Xisaabtaada": "Your balance", "Ii keen": "Send it to me", "Iib / wakiil": "Sell / agent",
  "Ka saar suuqa": "Remove from sale", "Beddel qiimaha": "Change the price",
  "Tirakoob": "Dashboard", "Lacag bixin": "Payments", "Dalabyo": "Orders", "Qaadasho": "Handover",
  "Iibsiga": "Buying", "FBG (Shiinaha)": "FBG (China)", "Codsiyo qiimo": "Price requests",
  "Celin & cabasho": "Refunds & complaints", "Hawlgalka": "Operations", "Maamulka": "Admin",
  "Waan iibsaday": "I bought it", "Waa la helay Shiinaha": "Received in China", "Waa la helay": "Received",
  "Qoraal": "Note", "Qaabil": "Receive", "Hubi": "Inspect", "Dhibaato": "Problem", "Dir": "Ship",
  "Yimid Muqdisho": "Arrived in Mogadishu", "Isku dar → bad": "Consolidate → sea", "Isku dar → cir": "Consolidate → air",
  "Shixnadaha rarka": "Freight consignments", "Alaab la rabo in la qaado": "Stock awaiting handover",
  "Waa la wareejiyay": "Handed over", "Xaqiiji qaadashada": "Confirm handover", "✓ La helay": "✓ Received",
  "✕ Lama helin": "✕ Not received", "Ansixi": "Approve", "Haki": "Suspend", "Xidh": "Block", "Fur": "Unblock",
  "+ Akoon cusub": "+ New account", "Akoonnada": "Accounts", "Ganacsiyada": "Businesses", "Wakiillada": "Agents",
  "Katalogga": "Catalogue", "Diiwaanka": "Audit log", "Lacagta": "Money", "Guud": "Overview",
  "Macmiil": "Consumer", "Wakiil": "Agent", "Shaqaale": "Staff", "Maamule": "Admin", "Shaqaale Garsoore": "Garsoore staff",
  "firfircoon": "active", "hakis": "suspended", "ansixsan": "approved", "sugaya": "pending",
  "Ka bax": "Sign out", "Suuqa ↗": "Market ↗", "Ganacsi ↗": "Business ↗",
  /* FBG + agents (business surfaces) */
  "hal tallaabo": "one step", "hal badhan": "one button",
  "Ku dheji link alaab kasta \u2014 JD, 1688, Taobao, Pinduoduo, Alibaba, ama bog kale\u2026":
    "Paste any product link \u2014 JD, 1688, Taobao, Pinduoduo, Alibaba, or any other page\u2026",
  "Raadi (solar light, chairs, CCTV) ama ku dheji link alaab kasta\u2026": "Search (solar light, chairs, CCTV) or paste any product link\u2026",
  "Ka soo iibso Shiinaha. Annaga ayaa qaabilayna, isku darayna, keenayna \u2014 kadibna waad iibin kartaa.":
    "Buy in China. We receive, consolidate and deliver it \u2014 then you can sell it.",
  "Waxaad hesha": "You get", "cinwaan Shiinaha oo kaliya adiga": "a China address that is yours alone",
  ". Iibiyayaashaadu halkaas ayay u soo diraan. Waxaan qaabilnaa, sawirnaa, miisaannaa, isku darnaa alaabtaada \u2014 kadibna hal shixnad ayaa Muqdisho timaadda. Alaabtu":
    ". Your suppliers ship there. We receive, photograph, weigh and consolidate your goods \u2014 then one shipment comes to Mogadishu. The goods",
  "adigaa iska leh": "are yours", "ilaa ay iibsanto.": "until they sell.",
  "Shiinaha (1688, JD, warshad\u2026)": "in China (1688, JD, a factory\u2026)",
  "U dir": "Ship it to", "cinwaankaaga Garsoore China": "your Garsoore China address",
  "Waan isku darnaa": "We consolidate it", "oo aan keenaa": "and deliver it",
  "Dooro": "Choose", "qaado, iib, ama wakiil": "keep, sell, or an agent",
  "Bilow FBG": "Start FBG", "Samee akoon FBG": "Create an FBG account", "\u2190 Garsoore": "\u2190 Garsoore",
  "Koodhkan ku qor": "Write this code on", "sanduuq kasta": "every carton",
  "oo iibiyuhu kuu soo diro.": "your supplier sends.",
  "Garsoore ayaa kuu haysa": "Garsoore is holding this for you", "Waxaad ku leedahay Garsoore": "You owe Garsoore",
  "Weli shixnad ma jirto. Marka aad Shiinaha wax ka iibsato, halkan ku sheeg si aan u aqoonsanno markay timaaddo.":
    "No shipments yet. When you buy in China, declare it here so we can identify it on arrival.",
  "Weli kayd ma jiro.": "No stock yet.", "Weli wax dhaqaale ah ma dhicin.": "Nothing has moved yet.",
  "Alaabtu adigaa iska leh ilaa ay iibsanto": "The goods are yours until they sell",
  "Ku sheeg shixnad": "Declare a shipment",
  "Wakiil kaa iibiya \u2014 ama kuu soo iibiya.": "An agent who sells for you \u2014 or buys for you.",
  "Qiimahaaga hoose ayaad hesha, dhaqso iyo wareeg badan. Wakiilku wuxuu haystaa farqiga oo dhan, qiimuhuna kama badan karo 15%.":
    "You take your floor price, fast, with high turnover. The agent keeps the whole spread and may not price more than 15% above it.",
  "Mandate cusub": "New mandate", "Ii iibi (waan haystaa)": "Sell for me (I have it)",
  "Ii soo iibi (waan doonayaa)": "Buy for me (I want it)", "Waa maxay?": "What is it?",
  "Tirada": "Quantity", "Magaalada": "City", "Muddada (maalmo)": "Duration (days)",
  "Nooca mandate-ka": "Mandate type", "Dir mandate-ka": "Send the mandate",
  "Laba nooc oo mandate ah": "Two kinds of mandate", "Tusaale": "Example",
  "Waxa wakiilku samayn karo": "What the agent may do", "Waxa uusan samayn karin": "What the agent may not do"

};

/* phrases that carry a number or a price */
var PATTERNS = [
  [/^Waxaad hesha kood iyo cinwaan Shiinaha\. Kharashka: qaabilaad \$(\S+) sanduuqii · rar (\S+)\$\/kg \(bad\) ama (\S+)\$\/kg \(cir\) · kayd bilaash (\d+) maalmood, kadib \$(\S+)\/cbm maalintii · komishan (\d+)% marka la iibiyo\.$/,
    "You get a code and a China address. Fees: receiving $$$1 per carton · freight $$$2/kg (sea) or $$$3/kg (air) · $4 days free storage, then $$$5/cbm per day · $6% commission when it sells."],
  [/^(\d+) sanduuq · ([\d.]+) kg$/, "$1 cartons · $2 kg"],
  [/^diyaar (\d+)$/, "available $1"],
  [/^([\d,]+) alaab$/, "$1 products"],
  [/^Muuji dheeraad \((\d+)\)$/, "Show more ($1)"],
  [/^~(\d+) maalmood$/, "~$1 days"],
  [/^Diyaar ~(\d+) maalmood$/, "Ready in ~$1 days"],
  [/^Diyaar maanta$/, "Ready today"],
  [/^Maanta$/, "Today"],
  [/^(\d+) shay · hal tallaabo$/, "$1 item(s) · one step"],
  [/^(\d+) shay$/, "$1 item(s)"],
  [/^(\$[\d,]+) waa qiimaha oo dhan$/, "$1 is the whole price"],
  [/^— alaabta, rarka Shiinaha → Muqdisho, canshuurta iyo adeegga way ku jiraan\. Ka qaado Km4 bilaash, ama gaarsiin guriga \$(\d+) \(bilaash haddii ay ka badato \$([\d,]+)\)\.$/,
    "— goods, freight China → Mogadishu, duty and service are all included. Collect at Km4 free, or home delivery $$$1 (free above $$$2)."],
  [/^— alaabta iyo adeegga way ku jiraan\. Ka qaado Km4 bilaash, ama gaarsiin guriga \$(\d+) \(bilaash haddii ay ka badato \$([\d,]+)\)\.$/,
    "— goods and service included. Collect at Km4 free, or home delivery $$$1 (free above $$$2)."],
  [/^Dalbo · (\$[\d,]+)$/, "Order · $1"],
  [/^Bixi (\$[\d,]+)$/, "Pay $1"],
  [/^Wax walba waxay diyaar noqonayaan ~(\d+) maalmood$/, "Everything will be ready in ~$1 days"],
  [/^Wax walba waa diyaar maanta$/, "Everything is ready today"],
  [/^Lambarka (.+) \((.+)…\)$/, "$1 number ($2…)"],
  [/^Ku dar (\$[\d,]+) alaab ah → gaarsiintu waa bilaash$/, "Add $1 of goods → delivery is free"],
  [/^Ku dar (\$[\d,]+) → gaarsiin guriga bilaash$/, "Add $1 → free home delivery"],
  [/^Saaxiibkaa ku casuun, hel (\$\d+)$/, "Invite a friend, get $1"],
  [/^(\d+) qof ayaa iibsaday 30kii maalmood ee la soo dhaafay$/, "$1 people bought this in the last 30 days"],
  [/^Standard · ×(\d+)$/, "Standard · ×$1"],
  [/^Dhimis \((\d+)%\)$/, "Discount ($1%)"],
  [/^✓ (\d+) dalab ayaa la helay\./, "✓ $1 orders received."],
  [/^⏳ Lacagta waa la hubinayaa$/, "⏳ Checking the payment"],
  [/^⏳ Waa la qiimaynayaa · saacado gudahood$/, "⏳ Being priced · within hours"],
  [/^(\d+) xabbo$/, "$1 units"],
  [/^Kaliya (\d+)/, "Only $1"]
];

function core(s) {
  var lead = s.match(/^[^0-9A-Za-zÀ-ɏ$]+/), tail = s.match(/[^0-9A-Za-zÀ-ɏ.)%]+$/);
  var a = lead ? lead[0] : "", b = tail && tail.index > a.length ? tail[0] : "";
  return [a, s.slice(a.length, s.length - b.length), b];
}
function one(t) {
  if (!t) return t;
  if (DICT[t]) return DICT[t];
  for (var i = 0; i < PATTERNS.length; i++) if (PATTERNS[i][0].test(t)) return t.replace(PATTERNS[i][0], PATTERNS[i][1]);
  var p = core(t);
  if (p[1] && p[1] !== t) {
    if (DICT[p[1]]) return p[0] + DICT[p[1]] + p[2];
    for (var k = 0; k < PATTERNS.length; k++) if (PATTERNS[k][0].test(p[1])) return p[0] + p[1].replace(PATTERNS[k][0], PATTERNS[k][1]) + p[2];
  }
  return t;
}
function phrase(t) {
  if (DICT[t]) return DICT[t];
  for (var j = 0; j < PATTERNS.length; j++) if (PATTERNS[j][0].test(t)) return t.replace(PATTERNS[j][0], PATTERNS[j][1]);
  if (t.indexOf(" · ") > 0) {
    var parts = t.split(" · "), hit = false;
    var out = parts.map(function (x) { var y = one(x); if (y !== x) hit = true; return y; });
    return hit ? out.join(" · ") : t;
  }
  return one(t);
}
function translate(s) {
  var t = s.trim();
  if (t.length < 2) return s;
  var out = phrase(t);
  return out === t ? s : s.replace(t, out);
}

var ATTRS = ["placeholder", "title", "aria-label"];
function walk(root) {
  if (lang !== "en" || !root) return;
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n, todo = [];
  while ((n = w.nextNode())) { var p = n.parentNode; if (p && /^(SCRIPT|STYLE|CODE)$/.test(p.nodeName)) continue; todo.push(n); }
  todo.forEach(function (x) { var v = translate(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  var els = root.querySelectorAll ? root.querySelectorAll("[placeholder],[title],[aria-label],option") : [];
  [].forEach.call(els, function (el) {
    ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v) { var t = translate(v); if (t !== v) el.setAttribute(a, t); } });
  });
}
var timer = null;
function schedule() { if (lang !== "en") return; clearTimeout(timer); timer = setTimeout(function () { walk(document.body); }, 30); }

RF.i18n = {
  lang: function () { return lang; },
  set: function (l) {
    try { localStorage.setItem(KEY, l === "en" ? "en" : "so"); } catch (x) {}
    location.reload();          /* a reload re-renders everything in the chosen language, with no half-translated state */
  },
  t: function (s) { return lang === "en" ? phrase(s) : s; },
  apply: schedule
};

if (lang === "en") {
  document.documentElement.setAttribute("lang", "en");
  document.addEventListener("DOMContentLoaded", function () {
    document.title = document.title.split(" — ").map(phrase).join(" — ");
    walk(document.body);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}
})();
