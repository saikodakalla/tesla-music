# 03 — High-Level Architecture

## 3.1 Architectural shape in one paragraph

A **static single-page app** runs in the Tesla browser. It talks to a **thin backend** that does exactly three jobs: (1) complete and refresh the Spotify OAuth token exchange so no secret ever lives in the browser, (2) proxy and cache lyrics lookups (CORS + rate-limit shielding + a shared cache), and (3) hold the user session. The SPA polls Spotify for "what's playing," asks the backend for the matching lyrics, and renders the synchronized highlight entirely client-side using a local interpolated clock. Everything else — database, cache, CDN, monitoring — exists to make those three backend jobs cheap, fast, and observable.

The guiding principle is **"thin backend, smart client, nothing secret in the browser."** The client is smart about *rendering and timing*; the backend is the trust boundary for *secrets and caching*.

## 3.2 Components and why each technology was chosen

### Frontend — the SPA

- **Framework: Next.js (React) in mostly-static/SPA mode, TypeScript.** React because the lyrics view is a state-driven UI (current line, playback state, transitions) that React expresses cleanly; Next.js because it gives us a single project that serves the static client *and* hosts the few serverless API routes we need (token exchange, lyrics proxy), deployed as one unit. TypeScript because the Spotify/LRCLIB response shapes are fiddly and types catch the nullable `progress_ms`/204 cases at compile time.
- **Styling: Tailwind CSS.** Utility classes make the few, large, high-contrast layouts fast to build and easy to keep consistent across the handful of screen resolutions we target. No heavy component library — the UI is intentionally minimal (one screen).
- **Rendering/animation: plain CSS `transform` + `requestAnimationFrame`.** No animation library; the scroll is a single translated container, which the old Tesla Chromium can composite on the GPU. See [Performance](09-performance.md).
- **Caveat:** we deliberately avoid bleeding-edge browser APIs because the Tesla Chromium lags mainline by 1–3 years `[UNCERTAIN version]`. Build target is set conservatively (e.g. transpile to a 2-3-year-old baseline).

### Backend — the thin server

- **Runtime: Next.js API routes / serverless functions (Node, TypeScript), deployed on Vercel.** Co-locating the API with the front end keeps one repo, one deploy, one set of types. Serverless is the right cost model: traffic is a handful of users polling occasionally, so we pay near-nothing and never manage a box.
- **Responsibilities (and *only* these):**
  1. **OAuth token exchange & refresh.** The client does PKCE and hands the backend the authorization code; the backend exchanges it (and refreshes it) and stores the refresh token server-side. The client never sees the client secret or the refresh token.
  2. **Lyrics proxy + cache.** The client asks *our* `/api/lyrics?...`; the backend calls LRCLIB (or a licensed provider), normalizes/parses the LRC, caches it, and returns it. This solves CORS, shields LRCLIB from our traffic, and lets many users share one cached copy of a popular song's lyrics.
  3. **Session management.** Issues an httpOnly, secure session cookie; maps it to the stored Spotify tokens.

### Authentication

- **Spotify OAuth 2.0 Authorization Code with PKCE.** PKCE because the client is a public/SPA client that can't keep a secret; Authorization Code (not implicit — implicit was removed Nov 27 2025) because it yields refresh tokens for the 1-hour access tokens. Detailed in [Auth](05-authentication-flow.md).

### Spotify integration

- **Spotify Web API**, endpoints `GET /me/player` and `GET /me/player/currently-playing`. Polled by the client (with the access token) for playback state; the access token is minted/refreshed via the backend. Detailed in [Spotify Integration](06-spotify-integration.md).

### Lyrics service

- **LRCLIB** for the personal/open-source build: free, no key, LRC synced lyrics, and — importantly — **a downloadable full-DB SQLite dump** we can mirror to de-risk dependence on a single hobbyist-run service. A **provider-abstraction layer** sits in front so we can swap to **Musixmatch/LyricFind** if the project ever goes licensed/commercial. Detailed in [Lyrics Strategy](07-lyrics-strategy.md).

### Database

- **Postgres (via Supabase) — optional and minimal.** For 1–5 users you arguably need no database at all; a signed cookie can carry session state and refresh tokens can live in an encrypted KV store. We specify Postgres because: (a) it's the clean home for refresh tokens (encrypted at rest) keyed by user, and (b) it doubles as a durable lyrics cache / LRCLIB mirror if we self-host the dump. Supabase because it bundles Postgres + auth-grade row security + a generous free tier, matching the hobby-scale economics.

### Caching

- **Two layers.** (1) **Redis (Upstash, serverless/HTTP)** as a hot cache for parsed lyrics keyed by a normalized track signature, with a long TTL — popular songs are fetched once and served from cache thereafter. (2) **CDN edge cache** (Vercel/Cloudflare) for the static SPA assets and for cacheable lyrics responses (`Cache-Control` headers). Upstash specifically because it's HTTP/serverless-friendly (no persistent socket), which fits serverless functions.

### Hosting

- **Vercel** for the SPA + API routes. Reasons: zero-config Next.js deploys, global edge, automatic HTTPS (mandatory — Spotify now requires HTTPS redirect URIs), preview deployments, and a free tier that comfortably covers 5 users. The alternative considered — **Cloudflare Pages + Workers** — is an equally good fit and is the recommended move if we want everything (static, functions, KV, cache) under one Cloudflare roof; see [Tech Stack](14-tech-stack.md) for the trade-off.

### CDN

- **Vercel's edge network** (or Cloudflare) serves static assets close to the car and edge-caches lyrics where allowed. At hobby scale the CDN is mostly about latency and TLS, not load.

### Monitoring

- **Sentry** for client + server error tracking (it'll surface Tesla-browser-specific JS failures we can't reproduce on a desktop), plus **Vercel Analytics / platform logs** for request-level visibility. Structured logs on the lyrics proxy let us watch LRCLIB hit/miss rates and Spotify 429s.

### Analytics

- **Privacy-respecting, minimal (Plausible or PostHog self-host), and policy-aware.** Spotify's policy forbids deriving listenership analytics/user profiling from their data, so we explicitly **do not** log what songs users play. We track only app-health signals (loads, errors, lyric cache hit rate) — never per-user listening behavior.

## 3.3 Trust boundaries

```
┌─────────────────────────── Untrusted (browser) ───────────────────────────┐
│  Tesla browser SPA: holds short-lived ACCESS token in memory only.         │
│  Talks to: our backend (same origin) + Spotify GET endpoints (CORS).       │
└───────────────────────────────────────────────────────────────────────────┘
                              │  (httpOnly session cookie)
┌─────────────────────────── Trusted (server) ──────────────────────────────┐
│  Backend: holds CLIENT SECRET + REFRESH tokens. Does token exchange,       │
│  refresh, lyrics proxy/cache. Secrets in env/secret manager, never sent.   │
└───────────────────────────────────────────────────────────────────────────┘
```

The single most important architectural rule: **the Spotify client secret and refresh tokens live only on the server.** The browser gets a short-lived access token (or, in the stricter variant, never even sees that — see [Auth](05-authentication-flow.md) for the BFF option).

## 3.4 Why not simpler / why not fancier

- **Why not pure client-only (no backend)?** Because PKCE *can* be done client-only, but then the refresh token sits in the fragile, possibly-non-persistent Tesla browser storage, and the lyrics calls hit CORS and hammer LRCLIB per-user with no shared cache. A thin backend fixes all three for negligible cost.
- **Why not a heavy microservice backend?** Because there are three jobs and five users. A monolithic serverless deployment is correct; microservices would be ceremony.
- **Why not WebSockets/server-push for playback state?** Spotify offers no playback webhook/push to third parties, so we *must* poll. WebSockets between our server and the client would just move the poll, not remove it; client-side polling with local interpolation is simpler and lower-cost. (We revisit push only at hypothetical large scale in [Scalability](12-scalability.md).)
