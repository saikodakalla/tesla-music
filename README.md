# Tesla Lyrics — Synchronized Spotify Lyrics for the Tesla Center Display

> **Status:** Technical design / architecture deliverable. This repository contains **no implementation code** — it is a production-grade design document intended to be read before a single line is written.

A web application that lets Tesla owners view **time-synchronized Spotify lyrics** on the Tesla center touchscreen while music plays. It runs **inside the Tesla web browser** (not a native app) and is designed to feel as close to a built-in Tesla feature as possible: large text, night-friendly, landscape-first, auto-scrolling, and zero keyboard after login.

---

## ⚠️ Read this first: the two findings that define the project

This design exists in a constrained reality. Two research findings dominate every decision in this document, and you should internalize them before reading further:

1. **You almost certainly cannot play Spotify audio from inside this web app.** The Spotify Web Playback SDK requires EME/Widevine DRM, which is not confirmed to be exposed to arbitrary third-party sites in the Tesla browser, and the SDK has a documented history of failing on embedded/mobile Chromium with `EMEError: No supported keysystem was found`. The realistic architecture is **"companion display"**: audio plays from the **native Tesla Spotify app**, and our web app runs alongside it as a **read-only lyrics overlay** driven by the Spotify Web API's playback-state endpoints. See [`docs/02-technical-feasibility.md`](docs/02-technical-feasibility.md).

2. **Spotify's own Developer Policy says "do not synchronize Spotify content," and a new app is capped at 5 users.** Synchronizing scrolling lyrics to Spotify playback sits in direct tension with Developer Policy §III.6, and as of the **February 6, 2026** platform changes, new apps in development mode are limited to **5 allow-listed users** with the developer required to hold Premium. Extended quota (unlimited users) is realistically **unavailable** to individuals. This is fundamentally a **personal / hobby / open-source** project, not a commercial one. See [`docs/15-risks.md`](docs/15-risks.md).

Neither finding kills the project. Both reshape it. The honest framing throughout this document is: *a personal-use companion lyrics display, not a built-in-feature clone you can ship to the world.*

---

## What this is

| | |
|---|---|
| **Experience** | Open a URL in the Tesla browser → log in with Spotify once → lyrics for whatever you're playing appear and scroll in sync, updating automatically on song change. |
| **Plays the audio?** | **No.** Audio comes from the native Tesla Spotify app. We read "what's playing" via the Spotify Web API and overlay lyrics. |
| **Lyrics source** | **LRCLIB** for the personal/open-source build (free, no key, LRC synced lyrics); **Musixmatch or LyricFind** if ever licensed for commercial use. |
| **Runs where** | The Tesla in-car Chromium browser (and any landscape touchscreen / desktop browser for development). |
| **Backend** | A thin server for the OAuth token exchange/refresh and a lyrics-fetch proxy (CORS + caching). The UI is otherwise a static SPA. |

## What this is *not*

- Not a native Tesla app (Tesla has no third-party in-car app platform).
- Not a Spotify audio player (DRM + Tesla browser limits + ToS).
- Not a commercial product (Spotify 5-user cap; lyrics licensing).
- Not an implementation. There is no React, no scaffolding, no code here by design.

---

## How to read this document

The full design is split into 18 sections under [`docs/`](docs/). Read them in order for a narrative, or jump to what you need.

| # | Section | What it answers |
|---|---|---|
| 01 | [Product Overview](docs/01-product-overview.md) | What it does and how it feels from the driver's seat. |
| 02 | [Technical Feasibility](docs/02-technical-feasibility.md) | Per-feature ✅ / ⚠️ / ❌ with reasons. **Start here for reality.** |
| 03 | [High-Level Architecture](docs/03-high-level-architecture.md) | Every component and why each technology was chosen. |
| 04 | [System Diagram](docs/04-system-diagram.md) | ASCII/mermaid diagrams of components and interactions. |
| 05 | [Authentication Flow](docs/05-authentication-flow.md) | Spotify OAuth + PKCE, tokens, sessions, security. |
| 06 | [Spotify Integration](docs/06-spotify-integration.md) | Endpoints, polling, song-change/pause detection, recovery. |
| 07 | [Lyrics Strategy](docs/07-lyrics-strategy.md) | LRCLIB vs Musixmatch vs Genius vs LyricFind vs Apple. |
| 08 | [Tesla Browser UX](docs/08-tesla-browser-ux.md) | Screen sizes, night mode, touch targets, smooth scroll. |
| 09 | [Performance](docs/09-performance.md) | Latency, polling, bandwidth, caching, smooth rendering. |
| 10 | [Edge Cases](docs/10-edge-cases.md) | No lyrics, ads, pause, offline, token expiry, reloads… |
| 11 | [Security](docs/11-security.md) | OAuth, HTTPS, token storage, CSRF/XSS, secrets. |
| 12 | [Scalability](docs/12-scalability.md) | 100 → 100k users and the infra at each step. |
| 13 | [Development Roadmap](docs/13-development-roadmap.md) | Phases 1–6 with deliverables. |
| 14 | [Tech Stack Recommendation](docs/14-tech-stack.md) | The recommended stack, justified line by line. |
| 15 | [Risks](docs/15-risks.md) | Technical, legal, API-dependency, maintenance. |
| 16 | [Future Features](docs/16-future-features.md) | Karaoke, translation, gestures, AI, and feasibility of each. |
| 17 | [MVP](docs/17-mvp.md) | The smallest version buildable in one weekend. |
| 18 | [Production Version](docs/18-production-version.md) | The ideal polished build with no time constraints. |

A consolidated source list lives in [`docs/19-references.md`](docs/19-references.md).

---

## TL;DR architecture

```
Native Tesla Spotify app  ──plays audio──▶  Car speakers
            │
            │ (Spotify Web API reports what's playing)
            ▼
Tesla browser (our SPA)  ──poll /me/player──▶  Our backend  ──▶  Spotify Web API
            │                                       │
            │ ◀──synced lyrics (LRC)────────────────┴──▶  LRCLIB (cached)
            ▼
   Lyrics auto-scroll & highlight in sync with progress_ms
```

We never touch the audio. We read `progress_ms` + `timestamp` from Spotify, fetch the matching LRC lyrics, and animate the highlight locally using a clock interpolated from the last poll.

---

## Conventions used in this document

- **✅ Supported** — works today with documented, sanctioned APIs.
- **⚠️ Possible with workaround** — achievable, but via a fragile path, an unofficial route, or with caveats.
- **❌ Not possible** — blocked by platform, DRM, policy, or physics.
- **[CONFIRMED] / [UNCERTAIN]** — tags on research claims, indicating whether a fact is backed by primary docs or needs on-device verification.

All factual claims about Tesla, Spotify, and lyrics providers were researched as of **June 2026**. Anything tagged `[UNCERTAIN]` — most importantly whether EME/Widevine and persistent storage work in the Tesla browser — **must be verified on real hardware** before committing engineering effort.
