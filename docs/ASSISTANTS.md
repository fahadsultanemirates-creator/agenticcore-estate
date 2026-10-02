# AgenticCore assistants and contact links

## What visitors see

Both sites (agenticcore.estate and agenticcorepk.com) show:
- **Footer:** "Contact AgenticCore" with WhatsApp chat and the business email, and "Follow AgenticCore" with the five official channels.
- **WhatsApp chat button:** a floating button. On PK it is the existing button and mobile bar, now using the real number.
- **"Ask AI" button:** opens one panel with two assistants.

| | AgenticCore AI Assistant | Amaan — AgenticCore Property Assistant |
|---|---|---|
| Job | Explains Estate and PK, onboarding, projects, trust rules, PK services, contact | Finds genuine listings; collects listing details and hands them to the sell form for review |
| Where | Estate: home, Properties, Buy, Rent. PK: home, Services | Same panel (tab). Also "Chat with Amaan" / "List a property with Amaan" under the Estate homepage search |
| Facts from | `services/assistant-knowledge.mjs` (approved text) | Live search (`findProperty`, genuine and visible listings only) and the listing-facts extractor |

Both are labelled as AI, not people. Human help is always one tap away: WhatsApp chat and email. Nothing is ever sent automatically.

## How a turn works

The endpoint is `POST /api/assistant`, in `netlify/functions/assistant.mjs`, on the Estate site. The PK site calls the same endpoint; cross-site calls are accepted only from the AgenticCore domains.

1. **Validate.** Body ≤ 12 KB, last 10 messages, ≤ 800 characters each. CNIC numbers, phone numbers and emails typed by the visitor are removed first.
2. **Deterministic first.**
   - Language detection: English, Urdu script, or Roman Urdu.
   - Topic routing.
   - Quick buttons answer instantly from approved text.
   - Amaan's search and listing facts are computed in code, never by the model.
3. **Claude for wording.**
   - It runs only when a key is set, within the daily cap and per-visitor limit.
   - It gets one call per turn, with the approved knowledge plus that turn's site data.
   - It returns structured JSON: `{reply, actions}`.
4. **Checks on every AI reply.** If any check fails, the visitor gets the approved deterministic answer.
   - Any number not present in the visitor's text, the site data or the approved knowledge rejects the reply. This blocks invented prices, sizes and counts.
   - Links, markdown and phone numbers are stripped.
   - Buttons must come from a fixed list; the browser maps each key to a URL, so a reply cannot inject a link.
   - Refusal, timeout, provider error or invalid output falls back to the approved answer.
5. **Privacy.**
   - Nothing about the conversation is stored or logged on the server.
   - The conversation lives in the visitor's browser tab (`sessionStorage`).

### Amaan: list a property

1. Amaan asks one question at a time (sale/rent, type, city, area, price, size, bedrooms/bathrooms).
2. Facts come only from the owner's own words.
3. When everything is collected, "Continue to the listing form" stores the owner's notes in this browser (`localStorage`, 2-hour expiry). They are never put in the URL.
4. The browser opens `sell.html?assist=1&amaan=1`. Signed-out visitors keep that destination through login and sign-up.
5. The existing draft-and-review step runs. Nothing is published until the owner submits the form.

On PK, Amaan sends people to Estate to list, because browser storage can't cross the two sites.

## Settings

All settings are Netlify environment variables on the **agenticcore-estate** site. Only the name is ever documented; values are never committed.

| Name | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes, to enable AI wording | — | Claude API key. Without it, both assistants run on the approved deterministic answers. |
| `AI_MODEL_ASSISTANT` | no | `claude-opus-5-5` | Model for both assistants |
| `ASSISTANT_EFFORT` | no | `low` | Claude effort (low = fastest replies) |
| `ASSISTANT_TIMEOUT_MS` | no | `9000` | Maximum wait for Claude before the approved answer is used. Keep it under the Netlify function limit. |
| `ASSISTANT_DAILY_AI_CAP` | no | `1000` | AI calls per day per function instance; after that, answers are deterministic |

Notes:
- If the existing `AI_PROVIDER` is not set, the existing Copilot and listing assistant also pick up `ANTHROPIC_API_KEY`.
- Rate limits are in-memory per instance: 30 turns per 10 minutes per visitor, and 60 AI turns per day per visitor. Also set a monthly spend limit in the Anthropic Console.

## Contact links (one place per site)

- **Estate:** `AC_CONTACT` in `ecosystem.js`.
- **PK:** `PK_CONFIG` in `js/config.js` (`whatsappNumber`, `whatsappDisplay`, `email`, `social`).

| Item | Link |
|---|---|
| WhatsApp chat (team) | `https://wa.me/18089985226` (+1 808 998 5226) |
| Business email | `hello@agenticcore.agency` |
| WhatsApp Channel | `https://whatsapp.com/channel/0029Vb8on5ZGpLHWOTLXUT45` |
| YouTube | `https://www.youtube.com/@AgenticcoreEstate` |
| TikTok | `https://www.tiktok.com/@agenticcore.estate` |
| Facebook | `https://www.facebook.com/profile.php?id=61594880046065` |
| Instagram | `https://www.instagram.com/agenticcore.estate` |

Marketplace contact is unchanged. Listing, project and profile contact still goes owner-to-visitor (public number or enquiry), never through AgenticCore's WhatsApp.

## Analytics (no tracker installed)

Events:
- `assistant_opened`, `assistant_question`, `assistant_action`
- `amaan_find_started`, `amaan_find_result`, `amaan_list_started`, `amaan_list_review`
- `assistant_handoff_whatsapp`, `assistant_handoff_email`
- `social_click`, `contact_click`

Fields are labels only (`bot`, `lang`, `action`, `result`, `channel`). They never include conversation text, IDs or contact details.

## Rollback

- **Turn AI off:** remove `ANTHROPIC_API_KEY`. Both assistants keep working on approved answers.
- **Remove the assistants:** delete the `ac-assistant-boot.js` script tags from the pages.
