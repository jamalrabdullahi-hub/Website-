"""Generate the STARTER core catalogue (data/catalog.csv) — ~1,000 products, real brands / model names,
PLACEHOLDER costs and blank source links. Your buying agent fills cost_cny, source_url and sets cost_verified=yes.
Re-running overwrites the file, so run it once and edit the CSV (or the spreadsheet) after that."""
import csv, os, random, re

random.seed(7)
STORAGE = [("4GB · 64GB", .85), ("6GB · 128GB", 1), ("8GB · 256GB", 1.25)]
STORAGE_PC = [("8GB · 256GB", 1), ("16GB · 512GB", 1.25), ("32GB · 1TB", 1.7)]
NONE = [("Standard", 1)]
COL_PHONE = [("Black", "#22232A"), ("Blue", "#3F6FB5"), ("Green", "#5C8A6B")]
COL_NEUTRAL = [("White", "#F3F1EC"), ("Black", "#26262A"), ("Silver", "#C4C7CC")]
COL_NONE = [("—", "")]
V = {"storage": STORAGE, "pc": STORAGE_PC, "none": NONE}
C = {"phone": COL_PHONE, "neutral": COL_NEUTRAL, "none": COL_NONE}
ICON = {"PHN": "📱", "CMP": "💻", "SOL": "☀️", "APL": "🧊", "HOM": "🍳", "FRN": "🪑", "CLO": "👘", "BLD": "🔧", "VEH": "🛺", "ELC": "🎧"}
BLURB = {
    "PHN": "Taleefan / agab taleefan cusub, sanduuqeeda ku jira. Dammaanad iibiye.",
    "CMP": "Qalab kombiyuutar / xafiis cusub, dammaanad 12 bil.",
    "SOL": "Qalab solar tayo leh — ku habboon guryaha iyo ganacsiga Soomaaliya.",
    "APL": "Qalab guri cusub, 220V, koronto yar.",
    "HOM": "Alaab wax-karin iyo guri, tayo wanaagsan.",
    "FRN": "Alaab guri cusub, la keeno Muqdisho.",
    "CLO": "Dhar iyo kabo cusub, cabbirro kala duwan.",
    "BLD": "Qalab dhismo, korontada iyo amniga.",
    "VEH": "Qaybo baabuur iyo bajaj oo cusub.",
    "ELC": "Qalab elektaroonik cusub, tayo la hubiyay.",
}
SUP = {"PHN": "Shenzhen Huaqiang Mobile Trading", "CMP": "Dongguan Lianxin Computer Parts", "SOL": "Hangzhou Solar Tech",
       "APL": "Guangzhou Baiyun Home Appliance", "HOM": "Yiwu Jinlong Household Goods", "FRN": "Foshan Shunde Furniture Works",
       "CLO": "Yiwu Jinlong Household Goods", "BLD": "Dongguan Lianxin Computer Parts", "VEH": "Guangzhou Baiyun Home Appliance",
       "ELC": "Shenzhen Huaqiang Mobile Trading"}

# (cat, brand, pattern, base_cny, kg, labels, variant-set, colour-set, platform, moq)
L = []
def line(cat, brand, pat, base, kg, labels, v="none", c="none", plat="1688", moq=1):
    L.append((cat, brand, pat, base, kg, labels if isinstance(labels, list) else labels.split("|"), v, c, plat, moq))

# ---- phones & accessories
line("PHN", "Xiaomi", "Redmi {t}", 1100, .6, "Note 13|Note 13 Pro|Note 13 Pro+|Note 14|Note 14 Pro|Note 14 Pro+|13|13C|14C|A3|A5|12|12C", "storage", "phone", "jd")
line("PHN", "Xiaomi", "Poco {t}", 1500, .6, "X6|X6 Pro|F6|F6 Pro|M6|M6 Pro|C65|C75", "storage", "phone", "jd")
line("PHN", "Xiaomi", "Xiaomi {t}", 2600, .6, "13T|14|14T|14T Pro|15", "storage", "phone", "jd")
line("PHN", "Tecno", "Tecno {t}", 800, .6, "Spark 20|Spark 20 Pro|Spark 30|Spark 30C|Camon 30|Camon 30 Pro|Pova 6|Pova 6 Pro|Phantom X2|Spark Go 1", "storage", "phone", "1688")
line("PHN", "Infinix", "Infinix {t}", 750, .6, "Hot 40|Hot 40i|Hot 50|Hot 50i|Note 40|Note 40 Pro|Smart 8|Smart 9|Zero 30|GT 20 Pro", "storage", "phone", "1688")
line("PHN", "itel", "itel {t}", 500, .55, "A70|A80|P55|P55+|S24|City 100|Vision 5|A60s", "storage", "phone", "1688")
line("PHN", "Samsung", "Galaxy {t}", 1300, .6, "A05|A15|A25|A35|A55|A06|S24|S24 FE|M15|M35", "storage", "phone", "jd")
line("PHN", "Oppo", "Oppo {t}", 1300, .6, "A18|A38|A58|A60|Reno 11|Reno 12|A3 Pro", "storage", "phone", "jd")
line("PHN", "Vivo", "Vivo {t}", 1200, .6, "Y03|Y18|Y28|Y36|V30|V40|T3", "storage", "phone", "jd")
line("PHN", "Realme", "Realme {t}", 1000, .6, "C53|C55|C63|C65|12|12 Pro|Note 50|Narzo 70", "storage", "phone", "jd")
line("PHN", "Honor", "Honor {t}", 1100, .6, "X6b|X7b|X8b|X9b|200|200 Lite", "storage", "phone", "jd")
line("PHN", "Anker", "Anker {t}", 90, .3, "PowerCore 10000|PowerCore 20000|PowerCore 26800|Nano 30W|735 GaN 65W|USB-C cable 1m|USB-C cable 2m|Lightning cable 1m|PowerPort 20W|Car charger 48W|Wireless pad 15W|737 GaN 120W", "none", "neutral", "jd")
line("PHN", "Baseus", "Baseus {t}", 60, .3, "Bowie E9|Bowie WM02|65W GaN charger|100W GaN charger|USB-C cable 1m|Braided cable 2m|Power bank 20000|Power bank 30000|Car holder|Phone tripod|Magnetic wireless pad|Cable organiser", "none", "neutral", "1688", 5)
line("PHN", "Ugreen", "Ugreen {t}", 55, .3, "USB-C cable 1m|Fast charger 30W|Fast charger 65W|Nexode 100W|Power bank 20000|OTG adapter|Type-C hub 5-in-1|Lightning cable|Car charger|Earphone adapter", "none", "neutral", "1688", 5)
line("PHN", "Generic", "Tempered glass — {t}", 8, .05, "Redmi Note 13|Redmi Note 14|Redmi 13C|Tecno Spark 20|Tecno Spark 30|Infinix Hot 40|Infinix Hot 50|Galaxy A15|Galaxy A55|iPhone 13|iPhone 14|iPhone 15", "none", "none", "1688", 50)
line("PHN", "Generic", "Silicone case — {t}", 10, .06, "Redmi Note 13|Redmi Note 14|Redmi 13C|Tecno Spark 20|Tecno Spark 30|Infinix Hot 40|Infinix Hot 50|Galaxy A15|Galaxy A55|iPhone 13|iPhone 14|iPhone 15", "none", "phone", "1688", 50)
line("PHN", "Xiaomi", "{t}", 180, .2, "Redmi Buds 5|Redmi Buds 6 Lite|Buds 4 Pro|Smart Band 8|Smart Band 9|Redmi Watch 5|Watch S3|Mi Power Bank 20000", "none", "neutral", "jd")
line("PHN", "QCY", "QCY {t}", 90, .15, "T13|T13 ANC|HT05|HT07|T20|AilyBuds|MeloBuds|Crossky C1", "none", "neutral", "1688", 5)
line("PHN", "Oraimo", "Oraimo {t}", 70, .15, "FreePods 4|FreePods Lite|Riff|SpaceBuds|PowerBank 10000|PowerBank 20000|Necklace Lite", "none", "neutral", "1688", 5)

# ---- computers & office
line("CMP", "Lenovo", "Lenovo {t}", 3300, 2.2, "IdeaPad Slim 3|IdeaPad Slim 5|IdeaPad 1|Xiaoxin Air 14|Xiaoxin Pro 14|Xiaoxin Pro 16|Legion 5|LOQ 15|ThinkPad E14|ThinkPad E16|ThinkBook 14|ThinkBook 16", "pc", "neutral", "jd")
line("CMP", "HP", "HP {t}", 3000, 2.2, "14s|15s|Pavilion 15|Pavilion Plus 14|Envy x360|Victus 15|ProBook 450|ProBook 440|250 G10|255 G10|EliteBook 840", "pc", "neutral", "jd")
line("CMP", "Dell", "Dell {t}", 3300, 2.2, "Inspiron 15|Inspiron 14|Vostro 3520|Vostro 3420|Latitude 3440|Latitude 5440|G15|XPS 13|Alienware m16", "pc", "neutral", "jd")
line("CMP", "ASUS", "ASUS {t}", 3200, 2.2, "Vivobook 15|Vivobook 14|Vivobook Go 15|Zenbook 14|TUF F15|TUF A15|ROG Strix G16|ExpertBook B1", "pc", "neutral", "jd")
line("CMP", "Acer", "Acer {t}", 2900, 2.2, "Aspire 3|Aspire 5|Swift Go 14|Nitro V15|Extensa 15|TravelMate P2", "pc", "neutral", "jd")
line("CMP", "Huawei", "Huawei {t}", 3600, 1.8, "MateBook D14|MateBook D16|MateBook 14|MatePad 11.5|MatePad SE|MatePad Air", "pc", "neutral", "jd")
line("CMP", "Xiaomi", "Xiaomi {t}", 3100, 2, "RedmiBook 15|RedmiBook Pro 14|Book Air 13|Pad 6|Pad 7|Redmi Pad SE", "pc", "neutral", "jd")
line("CMP", "Dell", "Dell monitor {t}", 900, 5, "SE2222H 22\"|E2423H 24\"|P2423D 24\"|P2723D 27\"|S2721HS 27\"|U2723QE 27\"", "none", "none", "jd")
line("CMP", "LG", "LG monitor {t}", 850, 5, "22MR410 22\"|24MR400 24\"|27MP400 27\"|27UP850 27\"|24GN600 24\"", "none", "none", "jd")
line("CMP", "HP", "HP printer {t}", 900, 8, "LaserJet M111w|LaserJet M141w|LaserJet Pro M15w|LaserJet Pro MFP M28w|LaserJet MFP M139we|Smart Tank 515|Smart Tank 725|DeskJet 2720", "none", "none", "jd")
line("CMP", "Canon", "Canon {t}", 1000, 8, "PIXMA G2020|PIXMA G3020|PIXMA G3420|imageCLASS LBP6030|i-SENSYS MF3010|PIXMA E410", "none", "none", "jd")
line("CMP", "Epson", "Epson {t}", 1100, 8, "L121|L3210|L3250|L5290|L1210|EcoTank M1120", "none", "none", "jd")
line("CMP", "TP-Link", "TP-Link {t}", 120, .5, "Archer C6|Archer AX23|Archer AX55|TL-WR841N|TL-WR940N|Deco M4 (2-pack)|Deco X20|TL-SG1008D switch|TL-SG108E switch|Archer T3U adapter|Tapo C200|Tapo C210", "none", "none", "jd")
line("CMP", "Huawei", "Huawei {t}", 250, .6, "WiFi AX3|WiFi AX2|B311 4G router|B535 4G CPE|E5576 MiFi|WiFi Mesh 3", "none", "none", "jd")
line("CMP", "Logitech", "Logitech {t}", 90, .3, "M170 mouse|M185 mouse|MK270 combo|MK295 combo|K380 keyboard|C270 webcam|C920 webcam|H111 headset", "none", "none", "jd")
line("CMP", "Kingston", "Kingston {t}", 80, .05, "DataTraveler 32GB|DataTraveler 64GB|DataTraveler 128GB|A400 SSD 240GB|A400 SSD 480GB|NV2 SSD 500GB|NV2 SSD 1TB|Canvas Select microSD 64GB|Canvas Select microSD 128GB", "none", "none", "jd", 5)
line("CMP", "Generic", "{t}", 200, 1.5, "Laptop bag 15.6\"|Laptop stand|Mouse pad XL|HDMI cable 2m|HDMI cable 5m|USB hub 4-port|Power strip 6-way|UPS 650VA|UPS 1000VA|UPS 2000VA|Laptop charger universal|Screen cleaning kit", "none", "none", "1688", 5)

# ---- solar & power
line("SOL", "Jinko", "Jinko solar panel {t}", 480, 25, "450W mono|500W mono|550W mono|580W mono|610W mono|670W mono", "none", "none", "1688")
line("SOL", "Canadian Solar", "Canadian Solar panel {t}", 520, 25, "455W|500W|550W|600W|650W", "none", "none", "1688")
line("SOL", "LONGi", "LONGi Hi-MO panel {t}", 500, 25, "450W|500W|550W|580W|620W", "none", "none", "alibaba")
line("SOL", "Growatt", "Growatt inverter {t}", 3800, 22, "SPF 3000TL|SPF 5000ES|SPF 6000ES Plus|MIN 3000TL-X|MIN 5000TL-X|MOD 10KTL3-X|SPH 5000|SPH 8000", "none", "none", "1688")
line("SOL", "Deye", "Deye hybrid inverter {t}", 5200, 30, "5kW SUN-5K|6kW SUN-6K|8kW SUN-8K|10kW SUN-10K|12kW SUN-12K|Three-phase 15kW", "none", "none", "1688")
line("SOL", "Felicity", "Felicity lithium battery {t}", 5500, 45, "48V 100Ah|48V 200Ah|51.2V 100Ah|51.2V 200Ah|24V 100Ah|12V 100Ah LiFePO4", "none", "none", "1688")
line("SOL", "Generic", "Deep-cycle gel battery {t}", 1300, 28, "12V 100Ah|12V 150Ah|12V 200Ah|2V 1000Ah|2V 2000Ah|12V 65Ah", "none", "none", "1688")
line("SOL", "Victron", "Victron {t}", 1600, 3, "SmartSolar MPPT 100/30|SmartSolar MPPT 100/50|SmartSolar MPPT 150/60|SmartSolar MPPT 150/85|BlueSolar 75/15|Orion-Tr 12/12-18", "none", "none", "alibaba")
line("SOL", "Generic", "Solar street light {t}", 260, 9, "60W|100W|150W|200W|300W|400W", "none", "none", "1688", 2)
line("SOL", "Generic", "Solar floodlight {t}", 90, 3, "40W|60W|100W|200W|300W", "none", "none", "1688", 5)
line("SOL", "Generic", "Solar home kit {t}", 900, 30, "300W + 1kW inverter|500W + 2kW inverter|1kW + 3kW inverter|2kW + 5kW inverter|3kW + 5kW lithium|5kW + 8kW lithium", "none", "none", "1688")
line("SOL", "Generic", "Solar water pump {t}", 1200, 18, "0.5HP|1HP|2HP|3HP|5HP|7.5HP", "none", "none", "1688")
line("SOL", "Generic", "Solar cable & connectors — {t}", 160, 10, "PV cable 4mm² 100m|PV cable 6mm² 100m|MC4 connectors (10 pairs)|Combiner box 4-in-1|DC breaker 63A|AC breaker 32A|Mounting rails (set)|Roof hooks (set of 20)", "none", "none", "1688", 2)
line("SOL", "Honda", "Honda generator {t}", 4200, 45, "EU22i 2.2kW|EU30is 3kW|EG5500 5.5kW|EM10000 10kW|GX160 engine|GX270 engine", "none", "none", "1688")
line("SOL", "Kipor", "Kipor generator {t}", 3000, 60, "IG2000 2kW|IG3000 3kW|KDE6700 5kW diesel|KDE12STA 10kW diesel|KDE16STA 12kW diesel|KDE35SS3 30kW diesel", "none", "none", "1688")
line("SOL", "Generic", "Voltage stabilizer {t}", 380, 12, "1kVA|3kVA|5kVA|10kVA|15kVA", "none", "none", "1688")

# ---- home appliances
line("APL", "Midea", "Midea inverter AC {t}", 1500, 42, "1HP|1.5HP|2HP|2.5HP|3HP", "none", "none", "jd")
line("APL", "Gree", "Gree AC {t}", 1450, 42, "1HP|1.5HP|2HP|2.5HP|3HP|Cassette 4HP|Floor standing 5HP", "none", "none", "jd")
line("APL", "Haier", "Haier fridge {t}", 1900, 58, "2-door 200L|2-door 260L|2-door 320L|2-door 400L|Side-by-side 500L|Chest freezer 200L|Chest freezer 300L|Chest freezer 500L", "none", "neutral", "jd")
line("APL", "Hisense", "Hisense {t}", 1800, 55, "Fridge 2-door 250L|Fridge 2-door 350L|Chest freezer 250L|Chest freezer 400L|Upright freezer 200L|Water dispenser|Washing machine 7kg|Washing machine 9kg", "none", "neutral", "jd")
line("APL", "Midea", "Midea washing machine {t}", 1300, 35, "6kg top-load|8kg top-load|10kg top-load|8kg front-load|10kg front-load|Twin tub 10kg", "none", "none", "jd")
line("APL", "Samsung", "Samsung TV {t}", 1500, 12, "32\" HD|43\" FHD|50\" 4K|55\" 4K|65\" 4K|75\" 4K", "none", "none", "jd")
line("APL", "Hisense", "Hisense TV {t}", 1300, 12, "32\" HD|43\" FHD|50\" 4K|55\" 4K|65\" 4K|75\" 4K|85\" 4K", "none", "none", "jd")
line("APL", "TCL", "TCL TV {t}", 1200, 12, "32\" HD|43\" FHD|50\" 4K|55\" 4K|65\" 4K|75\" 4K", "none", "none", "jd")
line("APL", "Xiaomi", "Xiaomi TV {t}", 1300, 12, "A 32\"|A 43\"|A 50\"|A 55\"|A 65\"|A Pro 75\"", "none", "none", "jd")
line("APL", "Midea", "Midea ceiling / stand fan {t}", 130, 4, "16\" stand fan|18\" stand fan|Ceiling fan 56\"|Rechargeable fan 16\"|Table fan 12\"|Air cooler 30L|Air cooler 60L", "none", "none", "1688", 2)
line("APL", "Midea", "Midea microwave / oven {t}", 500, 14, "20L microwave|23L microwave|25L microwave|30L oven|45L oven|60L oven", "none", "none", "jd")
line("APL", "Philips", "Philips {t}", 500, 4, "Air fryer HD9252|Air fryer XL HD9280|Blender HR2041|Blender HR3655|Rice cooker HD4515|Steam iron GC1740|Kettle HD9350|Hair dryer BHD006", "none", "none", "jd")
line("APL", "Xiaomi", "Xiaomi {t}", 250, 3, "Smart kettle Pro|Rice cooker 3L|Air purifier 4 Lite|Vacuum G10|Robot vacuum E10|Hand blender|Air fryer 4L|Induction cooker", "none", "none", "jd")
line("APL", "Generic", "Water heater / cooler {t}", 300, 8, "Electric shower heater|Storage geyser 30L|Storage geyser 50L|Water dispenser hot/cold|Water dispenser bottom-load|Ice maker|Water filter 5-stage|RO purifier 75GPD", "none", "none", "1688", 2)
line("APL", "Generic", "Cooking appliance {t}", 240, 8, "Gas stove 2-burner|Gas stove 3-burner|Gas stove 4-burner|Gas cooker with oven|Induction 2-plate|Electric hotplate|Pressure cooker 6L|Pressure cooker 12L", "none", "none", "1688", 2)
line("APL", "Generic", "Iron / small appliance {t}", 70, 2, "Steam iron 2000W|Hair dryer 2000W|Hair clipper|Electric shaver|Toaster 2-slice|Sandwich maker|Juicer|Food processor 800W", "none", "none", "1688", 5)

# ---- kitchen & household
line("HOM", "Generic", "Cookware — {t}", 90, 3, "Non-stick pot set 8pc|Non-stick pan 28cm|Pressure pot 8L|Stainless pot set 12pc|Rice pot 30cm|Big aluminium pot 50cm|Frying pan 32cm|Tea kettle 3L", "none", "none", "1688", 5)
line("HOM", "Generic", "Water tank {t}", 350, 12, "500L|1000L|2000L|3000L|5000L|10000L", "none", "none", "1688")
line("HOM", "Generic", "Storage / plastic {t}", 30, 2, "Bucket 20L (pack 10)|Basin set (pack 6)|Storage box 50L|Storage box 100L|Jerrycan 20L|Jerrycan 25L|Thermos flask 2L|Thermos flask 3L|Lunch box set", "none", "none", "1688", 10)
line("HOM", "Generic", "Bedding — {t}", 120, 3, "Mattress cover|Blanket (Tanzanian) 2pc|Duvet set|Pillow (pack 4)|Bed sheet set|Mosquito net|Prayer mat (pack 5)|Floor mat 3x4m", "none", "none", "1688", 5)
line("HOM", "Generic", "Kitchen ware — {t}", 60, 2, "Cutlery set 24pc|Plate set 24pc|Glass set 12pc|Knife set 6pc|Thermos cup|Food container (pack 10)|Colander set|Spice rack", "none", "none", "1688", 5)
line("HOM", "Generic", "Cleaning — {t}", 40, 3, "Broom & mop set|Vacuum cleaner 2000W|Steam cleaner|Floor mop 360°|Trash bins (pack 3)|Laundry basket|Drying rack|Iron board", "none", "none", "1688", 5)
line("HOM", "Generic", "Lighting — {t}", 25, 1, "LED bulb 9W (pack 10)|LED bulb 15W (pack 10)|LED tube 18W (pack 10)|Rechargeable lantern|LED floodlight 50W|LED floodlight 100W|Ceiling light 24W|Emergency light|Solar garden light (pack 4)", "none", "none", "1688", 5)
line("HOM", "Generic", "Household — {t}", 50, 2, "Curtains (pair)|Wall clock|Carpet 2x3m|Carpet 3x4m|Sofa cover|Door mat|Umbrella (pack 5)|Suitcase 24\"|Suitcase set 3pc", "none", "none", "1688", 5)

# ---- furniture
line("FRN", "Generic", "Office chair {t}", 380, 16, "Ergonomic mesh|Executive leather|Visitor chair|High-back boss|Gaming chair|Drafting chair|Task chair basic", "none", "neutral", "1688", 2)
line("FRN", "Generic", "Plastic chair / table {t}", 22, 3, "Plastic chair stackable|Plastic chair with arms|Plastic table 4-seat|Plastic table round|Folding chair|Folding table 1.8m|Bar stool|Kids chair", "none", "none", "1688", 20)
line("FRN", "Generic", "Bed & mattress {t}", 700, 40, "Single bed frame|Double bed frame|Queen bed frame|Bunk bed|Foam mattress 3ft|Foam mattress 4.5ft|Foam mattress 6ft|Spring mattress 6ft", "none", "none", "1688")
line("FRN", "Generic", "Sofa {t}", 1600, 60, "3-seater fabric|2-seater fabric|3+2 set fabric|L-shape corner|Majlis floor sofa set|Leather 3-seater|Recliner|Sofa bed", "none", "neutral", "1688")
line("FRN", "Generic", "Wardrobe / storage {t}", 800, 45, "2-door wardrobe|3-door wardrobe|4-door wardrobe|Shoe rack|Chest of drawers|Bookshelf|TV stand|Kitchen cabinet set", "none", "none", "1688")
line("FRN", "Generic", "Office furniture {t}", 650, 40, "Desk 1.2m|Desk 1.6m|Manager desk|Filing cabinet 4-drawer|Conference table 3m|Reception desk|Workstation 4-person|Steel shelving 5-tier", "none", "none", "1688")
line("FRN", "Generic", "Dining / school {t}", 500, 30, "Dining table 6-seat|Dining table 8-seat|Dining chairs (set 6)|School desk & chair set|Classroom desk (pack 10)|Whiteboard 120x90|Teacher table|Bookcase steel", "none", "none", "1688", 2)

# ---- clothing
line("CLO", "Generic", "Men's wear — {t}", 45, .5, "Cotton thobe (khamiis)|Macawis (sarong)|Dress shirt|Polo shirt (pack 5)|Trousers|Jeans|Suit jacket|Kufi cap (pack 10)|Track suit|T-shirts (pack 10)", "none", "neutral", "1688", 10)
line("CLO", "Generic", "Women's wear — {t}", 50, .5, "Abaya|Dirac (Somali dress)|Hijab (pack 10)|Jilbab|Prayer garment|Chiffon scarf (pack 10)|Maxi dress|Kids dress (pack 5)", "none", "neutral", "1688", 10)
line("CLO", "Generic", "Fabric (per roll) — {t}", 300, 15, "Dirac fabric|Abaya crepe|Cotton lining|Chiffon|Silk blend|Curtain fabric|Uniform fabric|Denim", "none", "none", "1688", 2)
line("CLO", "Generic", "Footwear — {t}", 60, .8, "Sandals (pack 10)|Leather shoes|Sports shoes|Kids shoes (pack 10)|Rubber boots|Safety boots|Slippers (pack 20)|Flip-flops (pack 20)", "none", "none", "1688", 10)
line("CLO", "Generic", "School — {t}", 55, .8, "School uniform set|School bag|Backpack 20L|Exercise books (pack 100)|Pens (box 50)|Pencil case (pack 10)|Geometry set (pack 10)|Textbook covers", "none", "none", "1688", 10)

# ---- building & hardware
line("BLD", "Hikvision", "Hikvision {t}", 800, 5, "4-camera CCTV kit|8-camera CCTV kit|DS-2CD 2MP dome|DS-2CD 4MP bullet|DS-7104 DVR|DS-7108 DVR|DS-7208 NVR|DS-K1T fingerprint terminal", "none", "none", "jd")
line("BLD", "Dahua", "Dahua {t}", 750, 5, "4-camera CCTV kit|8-camera CCTV kit|IPC 2MP dome|IPC 4MP bullet|XVR 4-ch|XVR 8-ch|NVR 8-ch|Video doorbell", "none", "none", "jd")
line("BLD", "Bosch", "Bosch {t}", 500, 3, "GSB 550 drill|GSB 13 RE drill|GWS 750 grinder|GWS 900 grinder|GBH 2-26 rotary hammer|GKS 600 saw|GST 65 jigsaw|Tool set 100pc", "none", "none", "jd")
line("BLD", "Makita", "Makita {t}", 650, 3, "HP1630 drill|HR2470 rotary hammer|9553NB grinder|5008MG circular saw|DDF485 cordless drill|DTD152 impact driver|Angle grinder 125mm|Battery 18V 5Ah", "none", "none", "jd")
line("BLD", "Generic", "Electrical — {t}", 45, 4, "Cable 2.5mm² 100m|Cable 4mm² 100m|Cable 6mm² 100m|Breaker 16A|Breaker 32A|Distribution board 12-way|Sockets (pack 10)|Switches (pack 10)|Conduit 20mm (pack 20)|Extension cord 10m", "none", "none", "1688", 5)
line("BLD", "Generic", "Plumbing — {t}", 60, 5, "PVC pipe 2\" (pack 10)|PVC pipe 4\" (pack 10)|PPR pipe 25mm (pack 20)|Taps (pack 10)|Toilet set|Wash basin set|Shower mixer|Water pump 0.5HP|Water pump 1HP|Float valve (pack 10)", "none", "none", "1688", 5)
line("BLD", "Generic", "Building material — {t}", 120, 20, "Roofing sheet 0.4mm (bundle)|Galvanised pipe 6m (bundle)|Steel bar 12mm (ton)|Steel bar 16mm (ton)|Wire mesh roll|Tile 60x60 (box)|Wall paint 20L|Floor tile adhesive (bag 20)|Door steel 90x200|Window aluminium", "none", "none", "1688", 5)
line("BLD", "Generic", "Security / access — {t}", 130, 3, "Padlock heavy (pack 10)|Door lock set|Electric fence energiser|Razor wire 50m|Gate motor sliding|Intercom kit|Metal detector|Safe box 30cm", "none", "none", "1688", 2)
line("BLD", "Generic", "Hand tools — {t}", 50, 3, "Toolbox 130pc|Spanner set 24pc|Screwdriver set 32pc|Hammer set|Pliers set|Measuring tape (pack 10)|Spirit level (pack 5)|Wheelbarrow|Ladder 3m aluminium|Ladder 5m aluminium", "none", "none", "1688", 2)

# ---- vehicle & bajaj parts
line("VEH", "Bajaj", "Bajaj RE {t}", 200, 3, "brake pads|clutch plate|piston kit|spark plug (pack 10)|air filter (pack 5)|oil filter (pack 5)|headlight|tail light|side mirror|tyre 4.00-8|tube 4.00-8|chain set", "none", "none", "1688", 5)
line("VEH", "Generic", "Motorbike {t}", 150, 3, "tyre 2.75-18|tyre 3.00-17|inner tube 2.75-18|brake pads|chain & sprocket kit|spark plug (pack 10)|battery 12V 9Ah|helmet|handle grips (pack 10)|mirror pair|headlamp|engine oil 1L (pack 12)", "none", "none", "1688", 5)
line("VEH", "Generic", "Car battery {t}", 550, 15, "12V 45Ah|12V 60Ah|12V 70Ah|12V 100Ah|12V 150Ah truck|24V 200Ah truck", "none", "none", "1688")
line("VEH", "Michelin", "Tyre {t}", 500, 9, "165/70R13|175/70R13|185/65R15|195/65R15|205/55R16|215/65R16|235/65R17|265/70R16 SUV|7.50R16 truck|11R22.5 truck", "none", "none", "1688")
line("VEH", "Generic", "Car accessories — {t}", 80, 2, "Seat covers set|Car floor mats|Jump starter 12V|Tyre inflator|Dash camera|Car vacuum|Steering cover (pack 5)|Tow rope|Fire extinguisher (pack 5)|First-aid kit", "none", "none", "1688", 5)
line("VEH", "Generic", "Toyota parts — {t}", 300, 5, "Vitz brake pads|Vitz shock absorbers (pair)|Corolla brake pads|Corolla shock absorbers (pair)|Hilux clutch kit|Hilux shock absorbers (pair)|Land Cruiser fuel filter|Prado shock absorbers (pair)|Oil filter (pack 10)|Air filter (pack 5)", "none", "none", "1688", 2)

# ---- electronics
line("ELC", "JBL", "JBL {t}", 350, .6, "Tune 230NC|Tune 520BT|Go 3|Flip 6|Charge 5|Clip 5|Boombox 3|PartyBox 110", "none", "neutral", "jd")
line("ELC", "Anker", "Anker Soundcore {t}", 300, .5, "Q30|Q20i|P30i|R50i|Life Note|Motion 300|Boom 2|Life U2", "none", "neutral", "jd")
line("ELC", "Xiaomi", "Xiaomi {t}", 200, .8, "TV Box S|TV Stick 4K|Smart Camera C300|Smart Camera 2K|Mi Router AX3000|Mi Router 4A|Electric scooter 4 Lite|Air Purifier 4", "none", "none", "jd")
line("ELC", "Generic", "Bluetooth speaker / audio — {t}", 90, 2, "Home theatre 5.1|Soundbar 2.1|Karaoke speaker|PA speaker 12\"|Microphone wireless pair|Amplifier 2-channel|Mixer 8-channel|Portable speaker 20W", "none", "none", "1688", 2)
line("ELC", "Generic", "Camera & security — {t}", 150, 1, "WiFi camera 2MP|WiFi camera 4MP solar|Dash camera|Body camera|Baby monitor|Video doorbell|GPS tracker|Alarm system kit", "none", "none", "1688", 5)
line("ELC", "Generic", "Batteries & power — {t}", 60, 2, "AA batteries (pack 40)|AAA batteries (pack 40)|Rechargeable AA (pack 8)|Power extension 6-way|Surge protector|Inverter 1000W|Inverter 3000W|Car jump pack", "none", "none", "1688", 5)
line("ELC", "Generic", "Retail / POS — {t}", 350, 3, "Barcode scanner|Receipt printer 80mm|POS terminal|Cash drawer|Label printer|Money counter|Weighing scale 30kg|Weighing scale 300kg|Price tag gun", "none", "none", "1688", 2)
line("ELC", "Generic", "Gaming & TV accessories — {t}", 100, 1, "HDMI splitter|HDMI cable 3m|TV bracket 32-55\"|TV bracket 55-85\"|Universal remote|Gamepad|Antenna indoor|Satellite dish 60cm", "none", "none", "1688", 5)


# ---- extra range
line("PHN", "Samsung", "Galaxy {t}", 1100, .6, "A04|A04s|A14|A24|A34|A54|S23|S23 FE|M14|M34", "storage", "phone", "jd")
line("PHN", "Tecno", "Tecno {t}", 650, .6, "Spark 10|Spark 10 Pro|Spark 10C|Camon 20|Camon 20 Pro|Pop 8|Pop 7|Spark Go 2024", "storage", "phone", "1688")
line("PHN", "Infinix", "Infinix {t}", 600, .6, "Hot 30|Hot 30i|Hot 20|Note 30|Note 30 Pro|Smart 7|Zero 20|Hot 12", "storage", "phone", "1688")
line("PHN", "Apple", "iPhone {t}", 3800, .6, "SE 3|11|12|13|14|14 Pro|15|15 Plus|15 Pro|16", "storage", "neutral", "jd")
line("CMP", "Apple", "MacBook {t}", 6800, 1.6, "Air 13 M1|Air 13 M2|Air 15 M2|Air 13 M3|Pro 14 M3", "pc", "neutral", "jd")
line("CMP", "Generic", "Desktop PC {t}", 2200, 8, "Core i3 office|Core i5 office|Core i7 workstation|Ryzen 5 gaming|Ryzen 7 gaming|All-in-one 24\" i5", "pc", "none", "1688")
line("APL", "Generic", "Blender / juicer {t}", 120, 3, "Blender 1.5L|Blender 2L|Juicer 800W|Juice extractor slow|Hand mixer|Stand mixer 5L|Food chopper|Coffee grinder", "none", "none", "1688", 5)
line("APL", "Generic", "Rice cooker {t}", 110, 3, "1.8L|2.8L|4L|5L|8L|10L commercial", "none", "none", "1688", 5)
line("APL", "Singer", "Singer sewing machine {t}", 500, 9, "Domestic 4423|Domestic 4432|Heavy Duty 4452|Portable|Industrial straight stitch|Industrial overlock", "none", "none", "1688")
line("BLD", "Generic", "Farm & irrigation — {t}", 400, 12, "Drip kit 1 acre|Sprinkler set 20pc|Hose 50m|Knapsack sprayer 16L|Diesel pump 3\"|Diesel pump 4\"|Grain mill 5HP|Maize sheller|Hand tractor 12HP|Chaff cutter", "none", "none", "1688")
line("HOM", "Generic", "Baby & kids — {t}", 70, 2, "Baby stroller|Baby cot|Feeding bottles (pack 6)|Diapers (carton)|Baby bath tub|High chair|Kids bicycle 16\"|School lunch bag", "none", "none", "1688", 5)
line("HOM", "Generic", "Beauty & care — {t}", 40, 1, "Hair clipper set|Hair dryer 2200W|Straightener|Perfume oil (dozen)|Oud incense set|Body lotion (carton)|Razor set (pack 20)|Nail care kit", "none", "none", "1688", 10)
line("HOM", "Generic", "Sports & outdoor — {t}", 90, 4, "Football size 5 (pack 5)|Gym bench|Dumbbell set 20kg|Skipping rope (pack 10)|Camping tent 4-person|Sleeping bag|Water bottle 1L (pack 10)|Cool box 30L", "none", "none", "1688", 5)
line("ELC", "Generic", "Smart watch — {t}", 110, .2, "GT Pro|Ultra 2|Kids GPS|Fitness band|Watch 9|Sport S1", "none", "neutral", "1688", 5)
line("CLO", "Generic", "Bags & accessories — {t}", 50, .8, "Ladies handbag|Backpack travel|Wallet (pack 10)|Belt (pack 10)|Sunglasses (pack 10)|Watches men (pack 5)|Scarf (pack 10)|Umbrella (pack 5)", "none", "none", "1688", 10)

CATS_N = {}
rows = []
n = 10000
random.seed(11)
for (cat, brand, pat, base, kg, labels, vs, cs, plat, moq) in L:
    for i, lab in enumerate(labels):
        n += 1
        sku = "GRS-%s-%05d" % (cat, n)
        model = pat.replace("{t}", lab)
        model_no = (re.sub(r"[^A-Za-z0-9+]+", "-", (brand[:3] + " " + lab)).strip("-").upper()[:20] + "-%d" % n)
        cost = base * (1 + .16 * i) * random.uniform(.94, 1.06)
        colors = C[cs] if vs == "none" else C[cs][:2]
        variants = [(vl, vm) for vl, vm in V[vs]]
        for vl, vm in variants:
            for cn, hx in (colors if len(variants) == 1 else colors[:1]):
                rows.append([sku, cat, brand, model.replace(brand + " ", "", 1) if model.startswith(brand + " ") else model, model_no, vl, cn, hx,
                             round(cost * vm), kg, moq, plat, "", SUP[cat], "no", BLURB[cat]])
        if len(variants) == 1 and len(colors) > 1:
            pass  # colours already emitted as separate variants above

os.makedirs("data", exist_ok=True)
with open("data/catalog.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["sku", "cat", "brand", "model", "model_no", "variant", "color", "color_hex", "cost_cny", "kg", "moq",
                "source_platform", "source_url", "supplier", "cost_verified", "blurb_so"])
    w.writerows(rows)
print("products:", len({r[0] for r in rows}), "variant rows:", len(rows))
