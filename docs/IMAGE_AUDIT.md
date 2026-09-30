# Image audit — AgenticCore Estate (Product 2.0, Phase 1)

No images were downloaded from the internet. Everything below is either already in `images/` or a specification for an image the owner should supply or commission.

## Current homepage imagery

| File | Size | Where | Verdict |
|---|---|---|---|
| `images/islamabad-skyline.jpg` | 1408×768, 248 KB | Locations → Islamabad card | **Keep.** Relevant to the city. Compress to about 120 KB (WebP or JPEG q72) and serve at 800 px wide. |
| `images/listing-abu-bakr-block-photo.jpg` | 960×1280, 159 KB | Locations → Rawalpindi card | **Keep for now.** It's a real listing photo, which beats stock. Replace with a general Rawalpindi image (see R1) once there are more listings, so the city card isn't tied to one house. |
| `images/pakistan-map-hero.jpg` (new "Khwabon se ghar tak" map) | 1200×896, 87 KB | Expansion section near the bottom; also `og:image` | **Keep.** Per the brief it's no longer the first interaction. **Replace as `og:image`** with a proper 1200×630 share image (R2). A portrait/square map gets cropped badly by WhatsApp and Facebook. |
| `images/agenticcore-icon.png` | 160×160, 25 KB | Header, favicon, JSON-LD logo | Keep. Add a 512×512 version for the JSON-LD logo and `apple-touch-icon` (R3). |
| Share-card preview (canvas) | 1080×1350, drawn in the browser | Toolkit section | Generated from a real listing at runtime. No file needed. |

## Removed from the homepage in Phase 1

| File | Why removed |
|---|---|
| `images/rent-list-buy-sell.jpg` (1000×1500) | Portrait promo banner with baked-in text. It can't be translated to Urdu and reads as an advert, not a product. The new hero does its job. |
| `images/list-agency-builder-project.jpg` (1000×1500) | Same reason. Replaced by the agents/developers sections. |

The files are still in `images/` because other pages or older links may use them. They can be deleted after Phase 1 merges.

## Unused files in `images/`

`referral-promo.jpg`, `cta-signup-dashboard.jpg`, `agenticcore-logo-full.jpg`, `gulberg-greens-islamabad.jpg`, `listing-abu-bakr-block-flyer.jpg`. No page references them. Delete them, or keep them in a separate `brand-assets/` folder so they aren't deployed.

## Replacement / new image specifications

| # | File name to create | Aspect / size | Subject | Alt text |
|---|---|---|---|---|
| R1 | `images/city-rawalpindi.jpg` | 16:9, 1600×900 (serve 800w), ≤150 KB | Daytime street-level view of a recognisable Rawalpindi/Bahria residential area (e.g. Bahria Town boulevard). Owner-shot or licensed; no watermarks. | "Residential street in Bahria Town, Rawalpindi" |
| R2 | `images/og-share.jpg` | 1200×630, ≤200 KB | Brand background, "Find property your way." headline, a phone showing the Ask AgenticCore box, the logo. Text must stay large enough to read on WhatsApp previews. | (meta image — no alt needed) |
| R3 | `images/agenticcore-icon-512.png` | 512×512 PNG, transparent | Current icon at higher resolution | "AgenticCore logo" |
| R4 | `images/copilot-preview.png` | 4:5, 1080×1350 | Real screenshot of the Ask AgenticCore result (query → matched listing with "why it matches"), captured from production once real listings exist. For the demo section and social posts. | "AgenticCore showing why a listing matches a search" |
| R5 | `images/city-islamabad.webp` | 16:9, 1600×900, ≤120 KB | WebP re-encode of `islamabad-skyline.jpg` | "Islamabad skyline with the Margalla Hills" |
| R6 | `images/developers-projects.jpg` | 16:9, 1600×900 | Only once a real approved project is listed: that project's site or render, with the developer's permission. Until then the developers section uses no image, on purpose. | "<Project name> by <Developer>, <Area>" |

## Performance notes

- Every homepage image below the fold has `loading="lazy"` plus explicit `width`/`height` to avoid layout shift.
- Listing photos come from Supabase Storage at full upload size. For Phase 2: resize on upload (or use Supabase image transformations) to 1280px max plus a 480px thumbnail. This is the biggest remaining mobile-performance win.
