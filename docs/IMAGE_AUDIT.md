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

## Premium visual asset pass (1 Oct 2026, branch `claude/estate-visual-pass`)

Eight images were supplied; images 7 and 8 are pixel-identical to the AgenticCore Pakistan reel cover and WhatsApp card already live on the PK site. Each image was checked at full size for text errors, false claims, fake listings/contacts and claims the product can't back.

| # | Artwork (source size) | Decision | Reason |
|---|---|---|---|
| 1 | "One Ecosystem for Pakistan Real Estate" — Estate → Pakistan, List/Market/Share/Grow (1672×941) | **Accepted, top banner only** (0–512 px) | The top banner is accurate and on-brand. The lower half is excluded: "Get Better Results / More inquiries" with a rising chart (results claim), "Trusted Platforms — Genuine listings" (Estate doesn't verify every listing), six third-party social-network logos, a non-functional "Get Started Today" button, and a sample form showing Lahore (not served yet). The step ideas are on the page as real HTML text instead. |
| 2 | "From Listing to More Opportunities" (1536×1024) | Rejected | Typo "webistes"; "Set Price — Get AI suggestions" (Estate doesn't suggest prices); "Trusted Platform — verified information"; results-style claims. |
| 3 | "A Better Way to Find Your Ideal Property" (1672×941) | Rejected | Fake listing cards with prices ("House for Sale DHA Lahore PKR 85,000,000", etc.) that read as real listings; Lahore, Karachi, Peshawar, Multan, Quetta presented as served (Estate is live in Islamabad & Rawalpindi only); "Verified Listings / Real Information"; garbled map labels and a cut-off word. |
| 4 | "Discover Properties Across Pakistan" (1672×941) | Rejected | Four fake listing cards with prices; map with a misspelt duplicate "Quettn"; "Across Pakistan" coverage claim; "Verified Listings — genuine properties and real information"; "Pakistan's Real Estate Growth Partner". |
| 5 | "List Smarter, Get Better Results" — AI Listing Assistant (1672×941) | Rejected | Describes features Estate doesn't have: competitive-pricing guidance, photo-angle suggestions, choosing the location, "rank higher and get more views". Estate's real tools are the quality score, wording suggestions and the notes-to-draft assistant, which never invents prices. Also "Safe & Secure / Reach Genuine Buyers / Better Results" and a robot mascot that isn't part of the brand. |
| 6 | "Find Your Next Property" (1672×941) | **Accepted for the share image only** | Clean text and no prices, but it's a picture of a search bar and tabs that don't work, so it isn't placed on any page next to the real search. As a link preview it's appropriate. |
| 7 | PK reel cover (1672×941) | Not used on Estate | Duplicate of a PK asset with PK branding ("AI Services & Digital Marketing"); it belongs on the PK site, where it's already live. |
| 8 | PK WhatsApp card (1122×1402) | Not used on Estate | As 7. |

**Files**

| File | Size | Weight | From | Used |
|---|---|---|---|---|
| `images/estate-pk-ecosystem.webp` | 1672×512 | 191 KB | #1 crop (0,0)–(1672,512), native resolution | `#ecosystem`, desktop (srcset 1672w) |
| `images/estate-pk-ecosystem-960.webp` | 960×294 | 87 KB | same, downscaled | `#ecosystem`, tablet/small desktop (srcset 960w) |
| `images/estate-pk-ecosystem-mobile.webp` | 560×512 | 55 KB | #1 crop (560,0)–(1120,512): both product names, the headline and List/Market/Share/Grow | `#ecosystem`, phones under 700 px (`<picture>` source) |
| `images/og-estate.jpg` | 1200×630 | 196 KB | #6 crop (0,14)–(1672,892), downscaled | `og:image` / `twitter:image` on the homepage |

Nothing is upscaled or stretched. The artwork is lazy-loaded with explicit width and height on both the `<img>` and the mobile `<source>`. Alt text is EN + UR through the new `data-i18n-alt` hook in `i18n.js`. The previous share image (`pakistan-map-hero.jpg`, 1200×896, no branding, wrong ratio for large link previews) stays in the expansion section.
