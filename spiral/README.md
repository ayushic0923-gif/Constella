# Inside one mind

A month of one person's mind as a real-looking galaxy. The big topics they kept thinking about sit along a spiral arm; scroll to travel from one to the next, and each topic's thoughts open around it, joined by what they share. Sign up to keep your own: free for 7 days, then $1 a month.

```bash
npm install
npm run dev       # http://localhost:5174
npm run build     # typecheck + production build into dist/
npm run test:db   # schema, privacy and free-week checks in real Postgres (PGlite)
```

## What you can do

- **Travel the topics.** Scroll (or `↓`/`Space`) to fly to the next topic; `↑` goes back. As you arrive, the topic's thoughts open out into a ring, each with its date and time, joined by threads where they share something. The topic says how you got there: *From The offer, through Ajji, food and sleep*.
- **Open a thought.** Click any thought to fly in close: the whole thought, its date and time, who and what it involves, and every thought it connects to, in this topic or another. Click one to go there; **Back to…** returns you.
- **Jump.** `/` or **Jump to** lists every topic (with how many thoughts, the date span and what it's mostly about) and searches every thought. **Home** (the wordmark) returns to the start.
- **The whole picture.** `O` pulls back out of the galaxy: every topic named on the arm, the threads between topics, and a date range (7, 15, 30 days, or everything).
- **What's new.** When a thought mentions a brand or place (IndiGo, Swiggy, Spotify, Namma Metro, Ladakh…), real recent headlines spring out of its star once you settle there. **What's new** collects them all, grouped by brand, with the topics they come from. Headlines come from Google News for the last two weeks; nothing is generated.
- **The night diary.** **Open the diary** (`N`, or **Menu** on phones) raises a night page dated today. Speak into it (tap the mic, or hold and let go), let Wispr Flow type into it, or write. When a passage lands all at once the page asks once whether it came from your voice; a yes stamps it **Spoken** with a receipt (words, time to say, time to type). Topic, time and kind sit under a fold; **Keep this page** folds it into a new star. People, places, brands and themes are picked out of the words (or mark them yourself with `@Mom`, `#Pune`, `$IndiGo`, `~money`). Guests save on the device; with an account it's saved to the database, and Claude reads it. **Example month / My mind** switches between the two.
- **Lenses.** The bar along the bottom recolours the whole galaxy: **What** (shared people, places, brands, themes), **Feeling**, **Need**, **Thinking** (thinking traps and the healthy moves that answer them), **Logic** (what led to what, answers, kept promises, tensions, replays) and **Time** (each day's train of thought). Open a thought to see all its readings.
- **Patterns.** Findings worked out from the readings, by lens, each with the thoughts behind it; tap one to fly there.

The sky follows the time of whatever you're looking at: warm at dawn, clear by day, amber at dusk, deep blue at night.

## How connections are found

Every thought carries tags: people (`@`), places (`#`), brands (`$`) and themes (`~`). Two thoughts are connected by what they share, weighted people 3, places and brands 2, themes 1 (`src/data/connect.ts`). Each thought keeps its two strongest links inside its topic and two across topics, so the picture shows structure rather than a hairball. Topic-to-topic connections add up every shared tag between their thoughts, normalised by size; the strongest shared tags become the sentence that explains the link. The journey order starts at the first topic and always continues to the one it connects to most.

## How thoughts are read

Six lenses, three readers. The full framework (sources, thresholds, every finding and how it's worked out) is the *Six Lenses* page; the short version:

- **Readings** (`src/data/lenses.ts`): one of nine emotions with valence (−1 heavy to +1 light) and arousal (0 to 1); up to two of six needs; up to three patterns from nine thinking traps and five healthy moves.
- **Logic**: links from a later thought to an earlier one (cause, answer, kept, tension), loops (one subject replayed) and open threads.
- **Readers**: the example month is read by hand (`src/data/readings.ts`). A signed-in person's thoughts are read by Claude in the `analyze` Edge Function, held to the same vocabulary with structured output, linked to the 30 thoughts before, and written to `thoughts.lens` by the server only. On-device word rules (`readByRules`) give an instant first reading and stand in for guests.
- **Findings** (`src/data/patterns.ts`): up to 22, each with the ids of its evidence and a minimum amount of data before it appears.

## Voice

Audio is never stored. A spoken note keeps its length and a 48-bar outline of the waveform (`thoughts.voice`); `thoughts.source` records typed, voice or flow. Wispr Flow is detected from how the text arrives (one input event carrying four or more words) and confirmed by asking; the app works with Wispr Flow and is not affiliated with Wispr.

## The example month

`src/data/month.ts`: 25 topics and 147 dated thoughts from October 2026, written as one plain line each (`- 10-27 09:30 | Booked it | p | … | @Mom #Pune $IndiGo`). It's a made-up person, labelled as such in the interface. Replace it with anyone's month.

## Accounts and the $1 subscription

Supabase holds accounts and thoughts; Razorpay takes the payment.

1. **Supabase.** Create a project. Run `supabase/migrations/` (with `npx supabase link` then `npx supabase db push`, or paste the SQL into the editor). Put the project URL and anon key in `.env.local` (see `.env.example`). Under Authentication → URL configuration, add your site URL for the email sign-in links.
2. **Razorpay.** In the dashboard, create a monthly plan for $1 (international payments must be enabled for USD), and API keys. Set the server secrets:
   ```bash
   npx supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_PLAN_ID=... RAZORPAY_WEBHOOK_SECRET=...
   ```
3. **Edge Functions.** `npx supabase functions deploy news razorpay-subscription razorpay-verify razorpay-webhook analyze`. In Razorpay, add a webhook to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` with the same webhook secret, for the `subscription.*` events. Set `VITE_NEWS_URL` to the deployed `news` function.
4. **Claude.** `npx supabase secrets set ANTHROPIC_API_KEY=...` for the `analyze` function. It uses Claude Haiku 5.5 by default, a fraction of a cent per thought; set `ANALYZE_MODEL=claude-opus-5-5` for a deeper reading (and refusal fallback, which Haiku doesn't have: a declined entry keeps its on-device reading).

How it works:

- Signing up (email link) creates a profile with `trial_ends_at` seven days ahead.
- `has_access()` in the database is true during the free week, or while the subscription is `active` (or `authenticated`: card set up, first charge scheduled), with a day's grace for renewals.
- Row-level security lets everyone read only their own topics and thoughts, and add or edit them only while `has_access()` is true. After the free week, everything stays readable.
- **Subscribe for $1 a month** asks `razorpay-subscription` to create the subscription; if the free week is still running, the first charge starts when it ends. Razorpay's own Checkout takes the card. `razorpay-verify` checks the payment signature and reads the subscription back before marking the profile; the webhook keeps it in step with renewals, failures and cancellations.
- Keys and secrets live only in the Edge Functions. Profiles can't be changed from the browser.

`npm run test:db` checks all of this against the real SQL as two different users (25 checks), including that nobody can write Claude's reading of their own thoughts from the browser.

Not done yet: moving thoughts saved on a device into a new account, and editing or deleting thoughts from the interface.

## Pay by UPI (no gateway)

An alternative to Razorpay for when a gateway isn't approved yet. It is off until all three of `VITE_UPI_ID`, `VITE_UPI_NAME` and `VITE_UPI_AMOUNT` (rupees) are set as Vercel environment variables; with them unset the site keeps using Razorpay.

1. A signed-in person opens **Account → Pay with UPI**, scans the QR code (or taps **Open my UPI app** on a phone), pays, and enters the 12-digit UPI reference (UTR) from the confirmation.
2. That is saved as a **pending** row in `public.payments` (see `supabase/migrations/20261031040000_upi_payments.sql`). A person can only add claims for themselves, at most three waiting at once, and one reference can only ever be used once.
3. **You approve it:** Supabase dashboard → Table Editor → `payments`. Check the reference against your bank or UPI app, then set `status` to `approved` (or `rejected`, with a `note` they will see). A database rule then gives that account 30 days of membership; paying early adds to the end of the current period.

There is no automatic confirmation: UPI to a personal or business UPI ID sends nothing back, so every payment is checked by a person. For automatic confirmation use a gateway. A third-party self-hosted gateway such as YouPI-PG was looked at and not used: it needs an always-on server and read access to bank SMS or email, and describes itself as experimental.

## Going live

The Supabase project is `inside-one-mind` (ref `lgqodftreabytovaflhp`, Mumbai). Its five migrations are applied and its five functions deployed; the public URL and publishable key are in `.env.local` (git-ignored). What's left is yours to do in the dashboards:

1. **Sign-in links.** Supabase → Authentication → URL configuration. Set **Site URL** to `https://www.ideora.space` (the main address: the bare domain redirects to it), and add these to **Redirect URLs**: `https://www.ideora.space/**`, `https://ideora.space/**` and `http://localhost:5174/**`. Without this the email link lands on the wrong address.
2. **Email.** Supabase's built-in sender allows only a couple of sign-in emails an hour. Add your own SMTP (Authentication → Emails → SMTP settings) before real people sign up.
3. **Secrets.** `npx supabase secrets set ANTHROPIC_API_KEY=... RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_PLAN_ID=... RAZORPAY_WEBHOOK_SECRET=... --project-ref lgqodftreabytovaflhp`.
4. **Razorpay webhook.** Point it at `https://lgqodftreabytovaflhp.supabase.co/functions/v1/razorpay-webhook`, with the same secret, for the `subscription.*` events.
5. **The site: `www.ideora.space` on Vercel** (project `constella`, Root Directory `spiral`, Vite). DNS is at Namecheap. `www` points at Vercel; the bare `ideora.space` is set in Vercel to redirect to `www` and needs one record at Namecheap: type A, host `@`, value `76.76.21.21`. The `VITE_` values (public, not secrets) are baked in at build time, so they are set as Vercel environment variables. The app uses `#` links, so no rewrite rules are needed. Deploy by pushing to GitHub, or with `npx vercel deploy --prod` from the folder above `spiral`.
6. **The plan.** A free Supabase project pauses after a week without activity. Move to Pro before launch.

## The galaxy

three.js with a bloom, day-grade and ACES pipeline (`src/world/`): about 190,000 stars with black-body colours and distance falloff, a near-star field that streaks as you travel, hydrogen-pink and oxygen-teal star-forming regions, dust lanes on each arm, distant galaxies, and adaptive resolution when frames run long. Topics are bright stars on the arm; their thoughts open from the topic star into a ring as you arrive (the same easing in the shader and the labels). Connections are drawn as curves that move with the opening rings and carry a bead of light.

## Design

Built with the `design-taste-frontend` skill (Stack Sans Headline Light and Stack Sans Text, the dealt navy and pink for surfaces and the one accent, no text shadows, gradients, glass or glowing controls) and `ui-ux-pro-max` (Immersive/Interactive pattern, OLED dark style). The pinned date and time hold still while everything else moves.
