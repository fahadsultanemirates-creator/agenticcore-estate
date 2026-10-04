# Six cities + learning memory

## Six cities (launch: Tuesday 6 October 2026, 00:00 PKT)
- Cities: Islamabad, Rawalpindi (live) + Lahore, Karachi, Sialkot, Faisalabad.
- Before the launch moment: sign-ups and listings in the four new cities are
  accepted and saved; their listings are hidden from the public (owner and
  admins see them). A small "Launching 6 Oct" label shows in every city
  picker; the homepage announcement says "Coming … on Tuesday 6 October 2026".
- From the launch moment: everything switches by date alone — labels
  disappear, the announcement reads "Now in Lahore, Karachi, Sialkot and
  Faisalabad", listings show publicly, the bots stop giving the launch
  message. Nothing to switch on.
- Source of truth for city and area names: `data/cities.json` (Zameen-style
  names; border societies such as DHA and Bahria Town phases are listed
  under both Islamabad and Rawalpindi). After editing it run
  `node scripts/gen-cities.mjs` (writes `ac-cities.js` here and
  `js/ac-cities.js` in the PK repo). The database copy is migration 0022.

## Learning memory (migration 0023)
- **Shared knowledge** (`kb_facts`): every genuine listing (website or
  Telegram) and every place a member names in a chat is an observation. A
  new place is a *candidate*; it is *learned* (used by the bots) once 3
  different people confirm it, or *approved* by the owner — approval also
  adds it to the area dropdown. Rejected facts are never used. Contributors
  are stored as one-way hashes. Samples never teach.
- **Border societies**: when members tell Amaan which city a "Bahria Town
  Phase 7" is in, those answers are counted. Once 5+ people agree (4× more
  than the other city), Amaan stops asking and uses that city.
- **Member memory** (`member_memory`): a member's own recent cities, areas,
  property types and language. The Telegram welcome uses it ("Last time:
  House, Johar Town, Lahore"). Members can read and delete their own
  memory; nobody else can, except the server.
- **Owner**: `/learn` in Telegram lists places waiting for review (2+
  people) with Approve / Reject; a nudge arrives once a day at 09:00 PKT
  when there is something to review.

## Owner setup
Run in the Supabase SQL editor, in order: `0022_six_cities.sql`, then
`0023_learning_memory.sql` (after the earlier pending ones: PK
`pk_0006_telegram_orders.sql`, `0021_telegram_enquiries.sql`).
