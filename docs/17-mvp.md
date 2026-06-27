# 17 — MVP (one weekend)

The smallest thing that delivers the actual magic — *the right lyrics scroll in sync with what I'm playing, and change on their own* — built realistically in a weekend by one person.

## 17.1 MVP scope

**In:**
- Spotify login (PKCE, full-page redirect) with server-side token exchange/refresh. *(Just enough auth — one user: you.)*
- Poll `/me/player/currently-playing`; detect track, position, pause, song change.
- Interpolated sync clock (`progress_ms` + `timestamp` + elapsed).
- LRCLIB lookup (track + artist + duration; `/search` fallback) via a small backend proxy with in-memory/Redis caching.
- One dark, landscape, large-type screen: current line centered + a few context lines, smooth `transform`/rAF scroll, active-line highlight.
- Graceful states: no lyrics, instrumental, paused, nothing playing (204), 401-refresh.
- Spotify attribution + album art (policy-required).
- Deployed to Vercel over HTTPS; tested in a real Tesla browser.

**Out (deferred to production):**
- Word-level karaoke, translation, romanization, AI explanations.
- Playback controls, gestures, queue.
- Postgres mirror of LRCLIB (use live LRCLIB + a simple cache).
- Multi-user niceties beyond the single developer slot.
- Fancy theming, offline, analytics dashboards.
- Heavy memory-pressure hardening (do the basics: small DOM, transform animation; full Phase-5 tuning is post-MVP).

## 17.2 Weekend plan

| When | Task |
|------|------|
| **Pre-flight (Fri eve)** | Register Spotify app (dev mode), allow-list your account, set HTTPS + `127.0.0.1` redirect URIs. Spin up a Next.js + Vercel skeleton. Quick Tesla-browser smoke test of a redirect + a polling page. |
| **Sat AM** | Auth: PKCE authorize → callback → server token exchange → httpOnly session → access token in memory → proactive/401 refresh. |
| **Sat PM** | Playback: polling loop + sync clock + event detection (change/pause/idle). Bare text debug view ticking in sync. |
| **Sun AM** | Lyrics: `/api/lyrics` proxy → LRCLIB get/search + duration match + LRC parse → cache. Wire to the debug view. |
| **Sun PM** | UI: dark landscape layout, windowed lyric render, transform/rAF smooth scroll + highlight, song-change cross-fade, graceful states. Deploy; test in the car. |

## 17.3 Definition of done

In a parked Tesla, you open the bookmarked URL, tap login once, and:
1. lyrics for the current Spotify song appear and the current line is highlighted/centered;
2. the highlight glides line-to-line in time with the music (looks smooth);
3. skipping to the next song swaps the lyrics automatically with no refresh;
4. pausing freezes the highlight; resuming continues it;
5. a song with no synced lyrics shows a calm fallback rather than breaking.

That's the whole product in miniature — and it's genuinely achievable in a weekend because the hard architectural calls (companion display, LRCLIB, interpolated clock, thin backend) are already made in this document.

## 17.4 Known MVP shortcuts (and why they're OK)

- **Live LRCLIB, light cache** — fine for one user; mirror the dump later.
- **Minimal error UI** — cover the common states; exotic edge cases (sections 10.24–10.32) can wait.
- **One user / dev mode** — that's the platform limit anyway; allow-list friends post-MVP up to 5.
- **Light Tesla hardening** — small DOM + transform animation get you 90% of smoothness; full memory tuning is Phase 5.
- **Variant A auth** (access token in memory) — simplest secure-enough path; upgrade to BFF (Variant B) only if needed.
