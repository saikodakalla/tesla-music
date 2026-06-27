# 14 — Tech Stack Recommendation

The stack optimizes for: (1) one person can build and run it, (2) near-zero cost at 5 users, (3) HTTPS + secrets handled for us, (4) a conservative client that an old Tesla Chromium can run, and (5) easy swap-out of the lyrics provider.

## 14.1 The recommendation at a glance

| Layer | Choice | One-line justification |
|-------|--------|------------------------|
| Language | **TypeScript** | Catches the nullable/204/`progress_ms` edge cases at compile time; one language across client+server. |
| Framework | **Next.js (React)** | Static SPA *and* serverless API routes in one repo/deploy; great Vercel integration. |
| UI | **React** | The lyric view is state-driven (active line, playback state, transitions); React expresses it cleanly. |
| Styling | **Tailwind CSS** | Fast, consistent, utility-first for a small, high-contrast, responsive layout; no heavy component lib. |
| Animation | **Plain CSS `transform` + `requestAnimationFrame`** | GPU-composited, dependency-free, smooth on old hardware; no animation library on the render path. |
| Hosting | **Vercel** (alt: Cloudflare Pages+Workers) | Zero-config Next.js deploys, global edge, automatic HTTPS, generous free tier. |
| Serverless API | **Next.js API routes on Vercel** | Co-located with the client; token exchange + lyrics proxy as functions; pay-per-use ≈ $0. |
| Cache | **Redis via Upstash** | HTTP/serverless-friendly Redis for the hot lyric cache; free tier covers us. |
| Database | **Postgres via Supabase** | Encrypted refresh-token store + optional LRCLIB mirror; generous free tier; row-level security. |
| CDN | **Vercel edge** (or Cloudflare) | Latency + TLS for static assets and cacheable lyric responses. |
| Auth | **Spotify OAuth 2.0 Authorization Code + PKCE** | Spotify's recommended SPA flow; refresh tokens; secret stays server-side. |
| Lyrics | **LRCLIB** behind a `LyricsProvider` interface | Free, no key, LRC synced lyrics, self-hostable dump; swappable for Musixmatch/LyricFind. |
| Validation | **zod** (+ TypeScript) | Runtime validation at the API boundary. |
| Monitoring | **Sentry** | Surfaces Tesla-browser-specific JS errors we can't reproduce on desktop. |
| Analytics | **Plausible / self-host PostHog** (app-health only) | Privacy-respecting; deliberately *no* per-user listening data (Spotify policy). |

## 14.2 Why each, in more depth

**TypeScript** — the Spotify and LRCLIB payloads are full of nullables (`item`, `progress_ms`), union types (`currently_playing_type`), and a 204-with-no-body case. Types turn "forgot to handle null" from a 2am car bug into a compile error. Sharing types between the client and the API routes (one repo) removes a whole class of contract drift.

**Next.js (React)** — we need *both* a static client and a *little* server (token exchange, lyrics proxy). Next.js gives both in one project, one deploy, one type system, with first-class Vercel support and trivial HTTPS. It also lets us start as a near-static SPA and add server logic incrementally. (If we wanted zero server, a pure Vite SPA + separate functions would work, but Next.js bundles the two cleanly.)

**Tailwind** — the UI is one screen with a few large, high-contrast elements that must scale across resolutions. Utility classes + `clamp()`/viewport units make responsive type and spacing quick and consistent without a design system we don't need. No Material/Chakra — they'd add weight the old browser doesn't need.

**`transform` + rAF (no animation library)** — the single most performance-sensitive thing is the lyric glide on an old GPU. Compositor-only transforms driven by a hand-rolled rAF clock are both the smoothest and the lightest option; a library (Framer Motion etc.) would add bundle weight and potential layout-animating footguns. See [Performance](09-performance.md).

**Vercel** — Spotify now *requires* HTTPS redirect URIs; Vercel gives automatic TLS, preview deploys, edge delivery, and a free tier that covers 5 users with room to spare. Cold starts are a non-issue at this scale.

**Cloudflare alternative (worth stating):** Cloudflare Pages (static) + Workers (functions) + KV (token/cache) + Cache puts *everything* under one roof with arguably better edge-compute and KV ergonomics, and Workers stay warm. **Recommendation:** default to Vercel for the fastest Next.js path; choose Cloudflare if you want always-warm edge functions and a single-vendor edge stack. Either is correct.

**Upstash Redis** — serverless functions can't hold persistent Redis sockets well; Upstash speaks HTTP/REST and is built for exactly this. It's our hot cache for parsed lyrics (long TTL) and rate-limit buckets.

**Supabase Postgres** — we need a durable, encrypted home for refresh tokens (and optionally the LRCLIB mirror). Supabase bundles Postgres with strong defaults, row-level security, and a free tier matching hobby economics. At 5 users you could even skip the DB and use Upstash for everything; we keep Postgres for the encrypted-token-at-rest story and future mirror.

**LRCLIB behind an interface** — free, no auth, LRC synced lyrics, and a downloadable full DB dump for self-hosting/resilience. The `LyricsProvider` abstraction (the pattern `syncedlyrics` uses) means swapping to a licensed Musixmatch/LyricFind backend later is a one-file change, not a rewrite. See [Lyrics Strategy](07-lyrics-strategy.md).

**Sentry / Plausible** — Sentry because Tesla-browser failures are otherwise invisible (you can't open devtools in the car); Plausible/PostHog (self-host) for privacy-respecting app-health metrics that deliberately exclude listening data to honor Spotify policy §III.13.

## 14.3 What we deliberately did *not* choose

- **Spotify Web Playback SDK** — needs Widevine/EME, unconfirmed in the Tesla browser, Premium-only, and ToS-fraught. We're a companion display, not a player. (Feasibility #11.)
- **A native app / Tesla SDK** — no such platform exists.
- **A heavy SPA framework + state lib (Redux etc.)** — overkill for one screen; React state + a tiny store is plenty.
- **An animation library** — bundle weight and layout-thrash risk on old hardware.
- **A relational ORM-heavy data layer** — at 5 users the data model is "one row per user + a lyric cache"; keep it minimal.
- **Self-managed servers / Kubernetes** — absurd for this scale; serverless is correct.

## 14.4 Repository shape (when implementation begins — *not* built here)

This is a **design** repo; no code is scaffolded. When implementation starts, a sensible single-repo layout would be: a Next.js app with the SPA UI, `/api/auth/*` and `/api/lyrics` routes, a `lib/` for the `LyricsProvider` interface + LRCLIB impl + the sync-clock util, and `infra` config for Upstash/Supabase/Sentry. Intentionally left unspecified here to honor the "no implementation/scaffolding" constraint.
