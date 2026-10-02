# Marketplace V2 — sample asset manifest

All images are approved **sample / demonstration** assets. Every record that uses them is `is_sample = true`, owned by the system account `00000000-0000-4000-8000-00000000a001`, and always shown with a SAMPLE badge. Names, prices and locations are fictional ("Example location").

Uploaded: 26 images. **25 are used** as TEMPORARY demonstration artwork (owner decision: genuine content replaces them within a day); 1 is excluded (`d0dca44b`, real society name). Every record shows a SAMPLE badge and a generic "Sample …" name under the image.

| # | Uploaded file (session upload id) | Category | Web files (WebP) | Sample entity (id suffix) | Where it appears |
|---|---|---|---|---|---|
| 1 | `889c3e33-image.png` | properties | `images/samples/properties/modern-villa-evening-card.webp` 480×360, 32 KB<br>`images/samples/properties/modern-villa-evening-1280.webp` 1280×853, 251 KB | Sample listing: Modern 10 Marla house (`5a3b1e00-…-0101`) | Homepage Properties row (when <5 genuine), property detail, Sample examples strip on properties/buy/rent directories |
| 2 | `22584290-image.jpg` | properties | `images/samples/properties/classic-jaali-house-card.webp` 480×360, 32 KB<br>`images/samples/properties/classic-jaali-house-1280.webp` 1152×1728, 310 KB | Sample listing: Classic-style 7 Marla house (`…-0102`) | Homepage Properties row (when <5 genuine), property detail, Sample examples strip on properties/buy/rent directories |
| 3 | `bd01b91e-image.jpg` | properties | `images/samples/properties/contemporary-house-wood-gate-card.webp` 480×360, 15 KB<br>`images/samples/properties/contemporary-house-wood-gate-1280.webp` 1152×1728, 178 KB | Sample listing: Contemporary 5 Marla house for rent (`…-0103`) | Homepage Properties row (when <5 genuine), property detail, Sample examples strip on properties/buy/rent directories |
| 4 | `66de06c4-image.png` | properties | `images/samples/properties/modern-villa-stone-facade-card.webp` 480×360, 33 KB<br>`images/samples/properties/modern-villa-stone-facade-1280.webp` 1280×853, 242 KB | Sample listing: 1 Kanal modern villa (`…-0104`) | Homepage Properties row (when <5 genuine), property detail, Sample examples strip on properties/buy/rent directories |
| 6 | `8f0bce9a-image.png` | projects | `images/samples/projects/twin-residential-towers-card.webp` 480×360, 40 KB<br>`images/samples/projects/twin-residential-towers-1280.webp` 1280×853, 255 KB | Sample project: Twin residential towers (`…-0201`) | Homepage Projects row, project detail, projects directory examples strip, builder profile project row |
| 7 | `69d41001-image.png` | projects | `images/samples/projects/high-rise-residences-card.webp` 480×360, 35 KB<br>`images/samples/projects/high-rise-residences-1280.webp` 1280×853, 239 KB | Sample project: High-rise residences (`…-0202`) | Homepage Projects row, project detail, projects directory examples strip, builder profile project row |
| 8 | `74410b27-image.png` | projects | `images/samples/projects/tower-under-construction-card.webp` 480×360, 41 KB<br>`images/samples/projects/tower-under-construction-1280.webp` 1280×853, 270 KB | Sample project: Apartment tower under construction (`…-0203`) | Homepage Projects row, project detail, projects directory examples strip, builder profile project row |
| 9 | `aaa9e3d5-image.png` | projects | `images/samples/projects/fenced-development-site-card.webp` 480×360, 22 KB<br>`images/samples/projects/fenced-development-site-1280.webp` 1280×720, 151 KB | Sample project: New residential plots (`…-0204`) | Homepage Projects row, project detail, projects directory examples strip, builder profile project row |
| 10 | `1d5462a9-image.png` | projects | `images/samples/projects/commercial-office-building-card.webp` 480×360, 32 KB<br>`images/samples/projects/commercial-office-building-1280.webp` 1280×853, 198 KB | Sample project: Commercial office building (`…-0205`) | Homepage Projects row, project detail, projects directory examples strip, builder profile project row |

## Restored as temporary samples (owner decision) — replace with genuine content

The owner chose to show these temporarily, labelled as samples, instead of icons/initials. They were flagged in the brand-safety review for the reasons in the table; replace or remove them (run `remove_marketplace_samples.sql`) once genuine content arrives.

| # | Uploaded file | What it shows | Brand-safety note | Used on (temporarily) |
|---|---|---|---|---|
| 5 | `f8ce2712-image.jpg` | Heritage-style residence | On-image signboard "Al-Majalla Residence – Block B" (EN/UR), mosque dome and calligraphy sculpture: a named place plus religious connotation | Sample listing `…-0105` ("Heritage-style 1 Kanal residence") |
| 11–15 | `a3d87544`, `3231c267`, `9af58501`, `73312dae`, `6ff07d1f` | AI-generated portraits | Owner decision: samples must not look like real, identifiable agents (portrait 3 also had an arched, mosque-like background) | Sample professionals `…-0301`…`-0305` |
| 16 | `f5e0c2fa-image.jpg` | Logo "Horizon Real Estate" | Common agency name; may match real businesses | Sample Agency — Family Homes (`…-0401`) |
| 17 | `c71fe593-image.png` | Logo "Greenland Real Estate" | Likely to match a real agency or society name | Sample Agency — Homes & Plots (`…-0402`) |
| 18 | `13e7f135-image.png` | Logo "Nova Living Real Estate" | May match real businesses | Sample Agency — Buy, Sell & Rent (`…-0403`) |
| 19 | `605e1dc7-image.png` | Logo "Skyline Properties" | Common name in Pakistan | Sample Agency — Commercial & Residential (`…-0404`) |
| 20 | `2d02af8d-image.png` | Logo "Prestige Real Estate" | Common name in Pakistan | Sample Agency — Large Family Homes (`…-0405`) |
| 21 | `9de61421-image.png` | Logo "Al-Haramain Developers" | Religious connotation; may match real firms | Sample Developer — Commercial Projects (`…-0501`) |
| 22 | `fdd6e874-image.png` | Logo "Capital Builders & Developers" | Common name in Islamabad | Sample Builder — Grey Structure & Turnkey (`…-0502`) |
| 23 | `72caf4ef-image.png` | Logo "Nova Developments" | May match real businesses | Sample Developer — Residential Towers (`…-0503`) |
| 24 | `ca9ae181-image.png` | Logo "Pineview Builders" | May match real businesses | Sample Builder — House Construction (`…-0504`) |
| 25 | `94e784ca-image.png` | Logo "Riverdale Developers" | May match real businesses | Sample Developer — Apartment Buildings (`…-0505`) |
| — (excluded) | `d0dca44b-image.jpg` | House with board "Bahria Enclave – Executive Block" / "Al-Hira Residence" | Names a real housing society (excluded since the first pass) | not used |

## Collision review of what remains

- **Names**: every sample now uses a generic demonstration label: "Sample Agency — …", "Sample Builder — …" / "Sample Developer — …", "Sample Professional · <specialisation>", "Sample listing: …", "Sample project: …". Locations are "Example location". None of these is a business, person or project name.
- **Person samples**: generic role labels (no personal names); AI portraits shown temporarily.
- **Photos kept** (9 property/project images): no business names, logos or real place names. Minor generic details: house number plates "17" (classic house) and "House No. 10" (contemporary house, detail image only), plus a Pakistan flag on the contemporary house. No action needed unless the owner prefers otherwise.
- **Form placeholders** that used invented brand-like names ("Bilal Developments", "Bilal Construction & Developers", "Al-Noor Estate Agency", "Al-Kabir Town Phase 2") now read "Your company name", "Your agency name" and "Project name".

