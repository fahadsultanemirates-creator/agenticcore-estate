# AgenticCore Estate ↔ AgenticCore Pakistan — cross-site contract

Estate (agenticcore.estate) is where property, projects and professionals are **listed and found**.
AgenticCore Pakistan (PK) is a **separate, paid marketing service** for promoting them. Estate listings and
profiles stay free. PK services are quoted and paid separately on PK. Neither site's UI suggests otherwise.

The two sites share one Supabase project and one account. **A URL never proves anything.** Context in a URL
only changes wording and navigation. Ownership is decided by the database alone.

## 1. Estate → PK

```
https://agenticcorepk.netlify.app/<page>?from=estate&intent=<intent>[&entity_type=<type>&entity_id=<uuid>][&listing=<uuid>]
```

| Parameter | Allowed values | Notes |
|---|---|---|
| `from` | `estate` | |
| `intent` | `promote`, `brand`, `social`, `project_marketing`, `website`, `creative`, `services` | Anything else is dropped |
| `entity_type` | `property`, `project`, `professional`, `agency`, `builder` | Kept only with a valid UUID |
| `entity_id` | UUID | Kept only with a valid type |
| `listing` | UUID | The original property-promotion handoff, unchanged: `?from=estate&listing=<uuid>` → PK pack, guarded by trigger `pk_0003` |

These are built only by `acPkUrl()` in `ecosystem.js`. PK reads them only through `pkEstateContext()` in
`js/estate-link.js`. Both ignore every other parameter.

## 2. PK → Estate

```
https://agenticcore.estate/<page>?from=pk&intent=<intent>
```

`intent` must be one of `browse`, `list`, `profile`, `agency`, `builder`, `project`, `view`.
On `signup.html` the intent preselects the role:
- `profile` → professional
- `agency` → agency
- `builder` → builder
- `project` → developer
- `list` → buyer (the default account type, which can list property)

Each of these is a free choice that the person can change. An intent never grants a capability. Project
publishing still needs the approved capability (0018).

## 3. What is never carried

The following never go in a URL in either direction:
- phone, email, name, CNIC
- notes, tokens, session data, prices, referral or benefit state

Entity ids are public ids of public pages.

## 4. Ownership (security model)

- **PK owner label.** "For: <title>" appears only after `my_marketplace_entity(type, id)` (migration 0019)
  returns a row. That function is security definer and read-only. It answers only when:
  - `auth.uid()` owns the entity, and
  - the entity is not a sample.

  Otherwise it returns nothing, so a hand-edited id reveals nothing and unlocks nothing. Anonymous callers
  have no execute grant.
- **Orders.** An order that references a listing is still checked by `pk_0003`. It is unchanged.
- **Estate owner tools.** On detail pages, the edit, promotion, toolkit and pathway links render only when the
  signed-in viewer is the owner and the entity is not a sample. RLS still governs every write. The links are
  convenience, not authority.
- **Samples.** Sample entities never get owner tools, share bars, pathways or PK context. They are `noindex`.

## 5. PK pathways (Estate → real PK catalogue)

| Entity | Pathways (PK `data/services.json`) |
|---|---|
| property | promote pack (`listing=`) · #28 photo enhancement · social media group |
| project | #40 project launch campaign · #6 brochures · #15 landing pages |
| professional | #3 agent personal branding · social media group · print & sales group |
| agency | #1 logo / brand identity · social media group · #14 agency/developer websites · campaigns group |
| builder | #40 project launch campaign · #6 brochures · #14 websites |

Links go to `services.html#service-<no>` (opens the service) or `services.html#<group-slug>`. No prices are
shown on Estate.

## 6. Analytics

`acTrack()` uses no tracking library. It emits a `ac:track` DOM event, and pushes to `window.dataLayer` only if
one exists. Unknown events and fields are dropped.

Events:
- `estate_to_pk_click`, `pk_to_estate_click`
- `promote_property_click`, `promote_project_click`
- `share_property`, `share_profile`, `share_project`
- `toolkit_export`
- `enquiry_started`, `enquiry_sent`
- `next_action_click`

Fields: `intent`, `entity` (type only, never an id), `channel`, `format`, `action`, `page`.

On PK, `pkTrack` adds `estate_context` and `from_estate` (intent and entity type only).

## 7. Deferred: PIN-protected private share

**Not implemented, on purpose.** Listing rows are publicly readable, and listing photos live in a public
bucket. A PIN on a share link would only hide a page whose data is already public, which would be fake
security. A real version needs:
- a private photo bucket,
- signed, expiring URLs,
- a server function that checks the PIN, rate-limits attempts, and returns the private listing.

That is a separate, owner-approved project.
