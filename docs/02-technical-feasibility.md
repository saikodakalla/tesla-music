# 02 — Technical Feasibility

This is the most important section. For every feature implied by the project, it assigns one of:

- **✅ Supported** — works today with sanctioned, documented APIs.
- **⚠️ Possible with workaround** — achievable but fragile, unofficial, or caveated.
- **❌ Not possible** — blocked by platform, DRM, policy, or physics.

Each row explains *why*, and where a claim depends on un-verified Tesla behavior it is tagged `[UNCERTAIN — verify on hardware]`.

---

## 2.1 The feature matrix

| # | Feature | Verdict | Why |
|---|---------|---------|-----|
| 1 | Open the app in the Tesla browser | ✅ | The Tesla browser is a Chromium-based browser that loads arbitrary HTTPS URLs. A standard responsive SPA loads fine. |
| 2 | Log in with Spotify (OAuth) | ✅ | Spotify Authorization Code + PKCE is a standard full-page redirect flow that works in any modern browser. **Use full-page redirect, not a popup** (popup/`window.open` support in the Tesla browser is `[UNCERTAIN]`). |
| 3 | Grant Spotify permissions / scopes | ✅ | Standard OAuth consent screen on Spotify's domain. Scopes needed: `user-read-currently-playing`, `user-read-playback-state`. |
| 4 | Auto-detect the currently playing Spotify track | ✅ | `GET /me/player/currently-playing` and `GET /me/player` are **not deprecated** and survived both the Nov-2024 and Feb-2026 API purges. They return track id, metadata, `is_playing`, `progress_ms`, and `timestamp`. |
| 5 | Get the exact playback position for sync | ✅ | `progress_ms` + `timestamp` are returned by the playback-state endpoint. Interpolating locally between polls gives sub-second sync accuracy. |
| 6 | Fetch synchronized (timestamped) lyrics | ✅ (LRCLIB) / ⚠️ (licensed) | LRCLIB returns LRC line-level synced lyrics free with no key. **But LRCLIB is legally gray** (unlicensed/crowdsourced). A *licensed* source (Musixmatch/LyricFind) is ⚠️: technically available but paid, contract-gated, and commercial-only. |
| 7 | Auto-scroll & highlight lyrics in sync with the music | ✅ | Pure client-side rendering driven by the interpolated playback clock. No platform dependency. |
| 8 | Update lyrics automatically on song change (no refresh) | ✅ | The polling loop detects a track-id change and swaps content client-side. No reload needed. |
| 9 | Detect pause / resume | ✅ | `is_playing` flips in the playback-state response; freeze/resume the local clock accordingly. |
| 10 | UI optimized for the Tesla touchscreen | ✅ | CSS/responsive design targeting known landscape resolutions (see [UX](08-tesla-browser-ux.md)). |
| 11 | **Play Spotify audio inside the web app (Web Playback SDK)** | ❌ (effectively) | Requires EME + **Widevine** DRM. Not confirmed to be exposed to arbitrary third-party sites in the Tesla browser; the SDK has documented `EMEError: No supported keysystem was found` failures on embedded/mobile Chromium. Also requires Premium and arguably violates the streaming-SDA commercial rules. **We deliberately do not depend on this.** `[UNCERTAIN but treat as blocked]` |
| 12 | Control playback (skip / pause) from the app | ⚠️ | The Web API player *control* endpoints (`PUT /me/player/pause`, `POST /me/player/next`) exist and need `user-modify-playback-state`. They work against an active device, but require the native app to be the active device and add ToS surface. Out of MVP scope; possible later. |
| 13 | Run while the car is in motion | ❌ | Tesla disables the browser/entertainment surfaces while driving for the driver. By design. Not circumventable, and we don't try. |
| 14 | Persist login across reboots / sleep | ⚠️ | Standard Chromium persists `localStorage`/cookies, **but** the Tesla browser is memory-pressured, clears data on crashes, and persistence across reboot/sleep/software-update is **not guaranteed** `[UNCERTAIN]`. Design for re-auth being occasionally required; keep the refresh token server-side in an httpOnly cookie session to maximize survivability. |
| 15 | Offline lyric caching / PWA install | ⚠️→❌ | Service workers / PWA install are unconfirmed in the Tesla browser; assume **no** reliable offline support. In-memory caching within a session works; durable offline does not. |
| 16 | Read what's playing via the **Tesla Fleet API** instead of Spotify | ⚠️ | Fleet API telemetry *does* expose now-playing artist/title/album/elapsed (fields 247/248/249/246). But it gives no track **id**, no reliable millisecond position for sync, requires per-vehicle OAuth + signed commands, and wakes/costs against the car. Useful as a *fallback* metadata source, **not** as the sync engine. |
| 17 | Word-by-word ("karaoke") highlighting | ⚠️ | LRCLIB is line-level only; word-level needs Musixmatch Richsync or Apple's TTML (both gated/licensed). Possible only with a paid/licensed provider. |
| 18 | Show album artwork & now-playing metadata | ✅ | Returned by the Spotify track object; displaying it is also *required* by Spotify's attribution policy when showing their content. |
| 19 | Scale to thousands/public users | ❌ (policy) | New Spotify apps are capped at **5 development-mode users** (since Feb 6 2026), and extended quota is org-only with a 250k-MAU bar. The infra would scale; **the Spotify policy will not let you.** |
| 20 | Display lyrics synchronized to Spotify playback, commercially | ❌ (policy/legal) | Spotify Developer Policy §III.6 prohibits synchronizing Spotify content with visual media, §III.5 prohibits integrating other services' content; lyrics need a publisher license for commercial display. Personal/non-commercial use is the only defensible posture. |

---

## 2.2 The three findings that reshape the project

### Finding A — We cannot be the audio player. We are a *companion display*.

The original brief implies the app might both play music and show lyrics. It can't play music: the Web Playback SDK's Widevine/EME requirement is the wall. So the architecture inverts — **the native Tesla Spotify app plays the audio, and we are a read-only overlay** that asks Spotify "what's playing and where are we in it?" and draws lyrics accordingly. This is not a downgrade so much as a different (and more robust) product: we never fight DRM, we never need Premium for *playback* (though the user obviously needs Spotify), and we never block on autoplay policy because we make no sound.

> **Closest feasible alternative to in-app playback:** the companion-display model above. If a user *wants* in-app controls, the Web API control endpoints (#12) can pause/skip the native device — but that's a later, optional nicety, not the core.

### Finding B — This is a personal project, not a product.

The Feb 6 2026 Spotify changes cut development mode to **5 allow-listed users** and require the developer to hold Premium. Extended quota (unlimited users) now requires a registered company with **≥250,000 MAUs**. An individual cannot get there. Therefore the *only* honest framing is: **you, plus up to four people you explicitly allow-list.** Everything about scaling in [Scalability](12-scalability.md) is written with this ceiling stated plainly: the technical architecture can scale, but the Spotify quota is the binding constraint.

### Finding C — Two ToS landmines: synchronization and other-service integration.

Spotify's Developer Policy §III.6 ("do not synchronize any sound recordings with any visual media") and §III.5 ("do not integrate with content from another service") both point straight at "scroll third-party lyrics in time with Spotify audio." The currently-playing endpoint page itself reprints "Do not synchronize Spotify content." For a **personal, non-commercial** tool the practical enforcement risk is low (you're one of five allow-listed users), but it must be stated openly: **a commercial version of this exact app is not policy-compliant without Spotify's written approval and a lyrics license.** See [Risks](15-risks.md).

---

## 2.3 Things that *sound* hard but are actually fine

- **Smooth scrolling in an old, memory-limited Chromium.** Fine, because we render a small DOM and animate with `transform`/`requestAnimationFrame`, not by reflowing thousands of nodes. See [Performance](09-performance.md).
- **Staying in sync without hammering the API.** Fine: poll every few seconds, interpolate the clock locally between polls, and only tighten polling around suspected track changes. See [Spotify Integration](06-spotify-integration.md).
- **CORS to Spotify and LRCLIB.** Spotify's token endpoint and LRCLIB are reached through **our backend proxy**, so browser CORS is a non-issue for those; the front end only talks to our own origin and (optionally) Spotify's CORS-enabled API for GETs.

## 2.4 Things to verify on real Tesla hardware before committing

These are tagged `[UNCERTAIN]` throughout and gate the design:

1. Does an OAuth **full-page redirect** complete cleanly and return to the app? (Expected: yes.)
2. Do `localStorage`/cookies **survive a reboot and a sleep cycle**? (Expected: unreliable — design around it.)
3. What **Chromium version** is actually running, and does it support the CSS/JS we use? (Expected: older 100s; avoid bleeding-edge APIs.)
4. Does the page stay alive and performant over a **30–60 minute** session without the memory-crash behavior owners report?
5. (Only if ever attempted) Does EME/Widevine negotiate for a third-party site? (Expected: no — which is why we don't depend on it.)
