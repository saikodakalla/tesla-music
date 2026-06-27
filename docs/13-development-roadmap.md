# 13 — Development Roadmap

Six phases, each shippable and demoable on its own. The ordering front-loads the two biggest *risks* (does OAuth work in the Tesla browser? does playback detection work?) so we learn the hard truths early rather than after building a pretty UI.

> **Pre-Phase 0 — On-hardware reality check (do this first, ~½ day).** Before writing app code, open a throwaway test page in a real Tesla browser and verify the `[UNCERTAIN]` items: full-page-redirect OAuth round-trip, `localStorage`/cookie survival across a reboot, the Chromium version (`navigator.userAgent`), and whether a long-lived polling page stays alive. These results can change architectural choices, so they come before everything.

## Phase 1 — Authentication

**Goal:** a Tesla-browser user can log in with Spotify and the app holds a valid, refreshable session.

Deliverables:
- Spotify app registered (dev mode), redirect URIs (HTTPS prod + `http://127.0.0.1` dev) allow-listed; the 5 user slots noted.
- PKCE authorize → full-page redirect → callback handled.
- Backend token exchange + refresh; refresh token stored server-side (encrypted); httpOnly session cookie.
- "Log in with Spotify" screen (one button) and a working logout.
- Proactive + reactive (401) refresh.
- **Exit criteria:** log in on a real Tesla, leave it an hour, confirm the access token silently refreshes; reboot the browser and confirm graceful behavior (resume or one-tap re-login).

## Phase 2 — Playback detection

**Goal:** the app knows, in real time, what the account is playing and where in the song it is.

Deliverables:
- Polling loop against `/me/player` with the adaptive intervals.
- The **interpolated sync clock** (`progress_ms` + `timestamp` + elapsed).
- Event detection: song change, pause/resume, scrub, ad, episode, 204 idle.
- A bare debug view (text): current track, position ticking up smoothly, state transitions logged.
- Error recovery: 401 refresh, 429 backoff, 5xx/network backoff.
- **Exit criteria:** play/pause/skip/scrub on the native Tesla Spotify app and watch the debug view track every change correctly, with the position ticking smoothly between polls.

## Phase 3 — Lyrics

**Goal:** correct synced lyrics for the detected track, fetched and cached.

Deliverables:
- `LyricsProvider` abstraction; **LRCLIB** implementation.
- Robust matching (track/artist/album + duration ±2s; `/search` fallback; normalization; ISRC when present).
- Backend `/api/lyrics` proxy: fetch → parse LRC → normalize to `LyricsDoc` → cache (Redis) with negative caching.
- Handle instrumental / plain-only / not-found.
- **Exit criteria:** for a playlist of varied songs (popular, obscure, live, remix, non-English, instrumental), the right lyrics (or the right graceful fallback) appear, and a second play of the same song is a cache hit.

## Phase 4 — UI

**Goal:** the calm, legible, auto-scrolling lyric experience.

Deliverables:
- Three-zone layout; dark/night default; large type; slim auto-hiding top bar with **Spotify attribution + album art** (policy-required).
- Windowed rendering (~7–9 lines) + `transform`/rAF smooth scroll + active-line emphasis.
- Smooth song-change cross-fade; pause freeze; idle/ad/instrumental/no-lyrics states.
- No keyboard after login; huge touch targets; fullscreen attempt with graceful degrade.
- **Exit criteria:** on a desktop browser sized to 1920×1200, the lyric glide holds 60fps and every edge-case state renders cleanly.

## Phase 5 — Tesla optimization

**Goal:** it actually feels great *in the car*, on the real (old, memory-limited) browser.

Deliverables:
- Test + tune on real hardware across model resolutions (1920×1200 baseline; verify 2200×1300 / 2560×1600 scaling).
- Memory-pressure hardening: confirm tiny stable DOM, no leaks over a 60-min session, rAF/timer cleanup on hide/pause.
- Conservative transpile target validated against the car's actual Chromium version.
- Night-mode/brightness polish for a dim cabin; verify fullscreen/visibility behaviors on hardware.
- **Exit criteria:** a 60-minute in-car session with multiple song changes stays smooth and does not crash; sync feels tight by eye/ear.

## Phase 6 — Deployment

**Goal:** stable, observable, shareable with the (≤5) allow-listed users.

Deliverables:
- Production deploy on Vercel/Cloudflare (HTTPS/HSTS, env-managed secrets, tight CSP).
- Upstash Redis + Supabase Postgres provisioned; optional LRCLIB dump mirrored.
- Sentry + app-health analytics (no listening data) wired.
- The 5 Spotify users allow-listed; a short "how to add this to your Tesla browser bookmarks" note.
- Runbook for the common failure modes (token revoked, LRCLIB down, browser crash).
- **Exit criteria:** two allow-listed users run it on real cars for a week with errors visible in Sentry and no manual babysitting.

## Timeline sketch (solo, part-time)

| Phase | Rough effort |
|-------|--------------|
| Pre-Phase 0 | ½ day |
| 1 Auth | 2–3 days |
| 2 Playback | 2–3 days |
| 3 Lyrics | 2–3 days |
| 4 UI | 3–4 days |
| 5 Tesla optimization | 2–4 days (gated by car access) |
| 6 Deployment | 1–2 days |

A focused solo dev reaches a genuinely usable in-car build in **~2–3 weeks part-time**; the one-weekend MVP (see [MVP](17-mvp.md)) is a deliberately scoped subset of Phases 1–4.
