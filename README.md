# Handoff: PriRecos Website (5 pages)

## Overview
Marketing site for PriRecos, an independent advisory firm structuring exploration and strategic partnerships across Somalia's mining, hydrocarbon, marine, and agricultural sectors. Audience: international investors and energy/mining firms. Primary CTA: submit a partnership/investor inquiry.

## About the Design Files
The HTML files in this bundle (`index.html`, `about.html`, `sectors.html`, `partner.html`, `contact.html`) are **design references** — working prototypes showing intended look, content, and behavior. They are not production code to ship as-is. Recreate them in whatever stack the target codebase uses (static site generator, Next.js, etc.) — or choose the most suitable static/SSG framework if none exists yet.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy, and layout are final. Recreate pixel-for-pixel.

## Pages
1. **Home** (`index.html`) — Hero with tagline/CTA, coastline photo, stat strip (3,300+ km coastline / 4 sectors / 1 gateway), sector preview grid (4 cards linking to Sectors), "Transparent Process / Compliance & Cooperation / Independent Facilitation" 3-up, Partner Portal teaser with blurred dashboard mock, closing CTA band.
2. **About Us** (`about.html`) — Dark mission header, pull-quote, "What We Do" 4-card grid (Survey & Data, Concession Facilitation, Investor Facilitation, Sustainability Oversight), "How We Operate" 4-row timeline (Founding → Regulatory Fluency → International Outreach → Sector Expansion).
3. **Sectors & Blocks** (`sectors.html`) — Dark header, then 4 full-width sector rows (image left, copy right) in this order: Agriculture & Arable Land, Mining & Rare Earth Elements, Blue Economy & Marine Resources, Hydrocarbons & Offshore Energy. Each has an "Inquire about this sector" CTA to Contact.
4. **Partner Portal** (`partner.html`) — Marketing teaser only (no real login). Blurred dashboard mockup with an "Invitation Only" / "Now Accepting Applications" badge (toggle via `portalStatus` prop) and a "Request Access" CTA to Contact. Below: 4-step "How Partnership Works" (Submit Inquiry → Due Diligence → Concession Agreement → Portal Onboarding).
5. **Contact** (`contact.html`) — Toggle between General Inquiry / Partnership Inquiry (sector-of-interest select only shows for Partnership). Form fields: Full Name, Organization, [Sector], Message. On submit, opens a `mailto:partnership@prirecos.com` draft pre-filled with subject + body (no backend — see Interactions below). Sidebar shows partnership@prirecos.com and Mogadishu, Somalia office line.

All 5 pages share a sticky header (logo + wordmark, 5-item nav, globe icon + 13-language `<select>` — English default, plus Somali/Turkish/Arabic/Hindi/Spanish/Italian/Norwegian/Swedish/Russian/Chinese/Japanese/Korean — and a "Partner Inquiry" pill button to Contact) and a 3-column footer (brand blurb, Company links, Contact link, copyright).

## Localization
All 5 pages are fully translated (nav, hero, section headings, cards, timelines, forms, footer, sector names/descriptions) into 13 languages: English (default), Somali, Turkish, Arabic, Hindi, Spanish, Italian, Norwegian, Swedish, Russian, Chinese, Japanese, Korean. The header language `<select>` swaps a `TRANSLATIONS` dict per page and persists the choice to `localStorage` (`prirecos_lang`) so it carries across page navigation. Arabic renders the page `dir="rtl"`.

## Interactions & Behavior
- **Language switcher**: `<select>` in the header; selecting a language re-renders all UI strings from a `TRANSLATIONS` dict and persists the choice to `localStorage` (`prirecos_lang`) so it carries across page loads/navigation.
- **Contact form**: client-side only in this prototype. Submit builds a `mailto:` URL (recipient `partnership@prirecos.com`, subject `"{Inquiry Type} — {Full Name}"`, body listing type/name/organization/[sector]/message) and navigates to it, which opens the visitor's email client with the message pre-filled — nothing is sent server-side. **For production, wire the form to a real backend/email service** (e.g. a serverless function or form provider) that delivers submissions to partnership@prirecos.com directly, rather than relying on the visitor's mail client.
- **Partner Portal status**: `portalStatus` prop/flag (`invitation` | `open`) switches the badge copy and overlay text on the dashboard mock — wire this to a real feature flag or CMS field.
- **Nav active state**: the current page's nav link renders in the dark ink color; others in a muted gray.
- No animations beyond standard link/button hover (not specified further — use subtle opacity/color transitions consistent with the rest of the site).

## Design Tokens
- **Colors** (as OKLCH, used verbatim in the HTML — convert to hex/HSL as your tooling requires):
  - Ink (primary text/dark surfaces): `oklch(20% 0.02 60)`
  - Ink soft (secondary text): `oklch(40% 0.02 60)`
  - Page background: `oklch(97% 0.012 85)`
  - Section tint background: `oklch(94% 0.014 85)`
  - Hairline border: `oklch(88% 0.012 85)`
  - Gold accent (links, eyebrow labels, hero eyebrow): `oklch(68% 0.15 65)`
  - Bronze accent (secondary eyebrow/badges): `oklch(52% 0.12 40)`
  - White surfaces: `white`
- **Typography**: Headings — `'Source Serif 4', serif` (weight 600, sometimes 500 for pull-quotes). Body/UI — `'Public Sans', sans-serif` (400/500/600/700). Loaded via Google Fonts.
  - H1: 44–52px / line-height 1.1
  - H2: 26–32px
  - Body: 14–17px / line-height 1.55–1.6
  - Eyebrow labels: 12px, uppercase, letter-spacing 0.14em, weight 600
- **Radius**: pill buttons/tags = `100px`; cards/images = `6–10px`
- **Shadows**: dashboard mockups use a soft large shadow, e.g. `0 20px 60px -20px oklch(20% 0.02 60 / 0.25)`
- **Spacing**: section vertical padding 80–96px; max content width `1280px` (contact/about narrower at `900–1100px`); base gap scale in 8px increments (8/10/14/20/24/32/40/56px)

## Assets
- `assets/logo.png` — PriRecos logo, transparent background (user-supplied)
- `assets/sector-agriculture.jpg`, `assets/sector-mining.jpg`, `assets/sector-marine.jpg`, `assets/sector-energy.jpg` — sector photography (agriculture/mining are user-supplied real photos; marine/energy currently placeholder-quality and flagged for replacement with real photography)
- `farm-mrsv1vfp-mg41.jpg` — hero image on Home (Somalia coastline)
- Google Fonts: Public Sans, Source Serif 4 (loaded via `<link>`, no local files needed)
- No icon library — the single globe icon (language switcher) is inline SVG in the header markup

## Files
- `index.html` — Home
- `about.html` — About Us
- `sectors.html` — Sectors & Blocks
- `partner.html` — Partner Portal
- `contact.html` — Contact
- `assets/` — logo + sector photography referenced above

Each HTML file is self-contained (inline styles, no external CSS files) and can be opened directly in a browser to see the reference design.
