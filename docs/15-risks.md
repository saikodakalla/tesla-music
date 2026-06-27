# 15 — Risks

Ordered roughly by how likely they are to sink or reshape the project. The first three are existential-to-the-*commercial*-version; the rest are manageable engineering/operational risks.

## 15.1 Legal / policy risks (the big ones)

### R1 — Spotify Developer Policy §III.6: "do not synchronize Spotify content with visual media." **[HIGH for commercial / LOW-MED for personal]**

The core action — scrolling/highlighting lyrics in time with Spotify playback — is plausibly "synchronizing sound recordings with visual content." The currently-playing endpoint page itself reprints "Do not synchronize Spotify content." Combined with **§III.5** ("do not integrate with content from another service" — i.e. third-party lyrics) and **§III.11** ("don't replicate a core Spotify experience"), a *commercial/public* version of this app is **not policy-compliant without Spotify's written approval.**

- **Mitigation (personal):** stay non-commercial, ≤5 allow-listed users, full Spotify attribution + album art, no listening analytics, no ML training on Spotify data. Enforcement risk against a 5-user personal tool is low, but the risk is *real and must be disclosed.*
- **Mitigation (commercial):** would require direct engagement with Spotify partnerships + a lyrics license. Treat as a business-development prerequisite, not an engineering task.
- **Honest stance:** we frame this as a personal companion display precisely because that's the defensible posture.

### R2 — Spotify 5-user development-mode cap. **[HIGH — caps the audience]**

Since Feb 6 2026, new apps are limited to **5 allow-listed users** and the developer must hold Premium; **extended quota** is org-only with a **250k-MAU** bar. An individual cannot lift this. 

- **Impact:** the app can never serve more than 5 people unless owned by a qualifying company.
- **Mitigation:** none for an individual — design *for* 5 users and say so. Open-sourcing lets others run their *own* instance with their *own* 5 slots, which is the only "scaling" path available.

### R3 — Lyrics licensing. **[HIGH for commercial / MED for personal]**

Lyrics are copyrighted compositions; displaying them commercially needs a publisher license (via Musixmatch/LyricFind). **LRCLIB is unlicensed/gray** — fine for personal/FOSS, not a commercial foundation, and it confers no license on us. The NMPA has historically pursued unlicensed lyric sites (takedowns to 50 sites; lawsuits; a $7M+ judgment).

- **Mitigation:** personal use of LRCLIB; provider-abstraction so a licensed source can be swapped in for any commercial future. Note the **Musixmatch–LyricFind antitrust litigation (2025)** complicates single-vendor licensing even for a funded company.

## 15.2 Technical risks (Tesla side)

### R4 — EME/Widevine not available to third-party sites → no in-app playback. **[Already mitigated by design]**

We *assume* the Web Playback SDK won't work in the Tesla browser and build a companion display instead, so this risk is **designed around** rather than carried. Residual: if a user expected the app to *play* music, manage expectations clearly.

### R5 — Tesla browser storage doesn't persist across reboot/sleep. **[MED — `UNCERTAIN`]**

If `localStorage`/cookies are wiped, sessions vanish.

- **Mitigation:** server-side session + httpOnly cookie (more durable than `localStorage`), refresh token server-side, and a **one-tap re-login** that's fast because Spotify remembers consent. Verified in Pre-Phase 0 testing.

### R6 — Tesla browser memory crashes on long/heavy pages. **[MED — `UNCERTAIN`]**

Owners report crashes under memory pressure.

- **Mitigation:** tiny windowed DOM, transform-only animation, no leaks, bounded caches, periodic soft-reset; validated in Phase 5 on hardware. If a crash happens, recovery is graceful (resume from session).

### R7 — Old Chromium lacks APIs we use. **[LOW-MED — `UNCERTAIN`]**

The car's Chromium lags mainline 1–3 years.

- **Mitigation:** conservative transpile target, feature-detect (Fullscreen, visibility), avoid bleeding-edge CSS/JS, test on the actual version (Pre-Phase 0).

### R8 — App only usable when parked/passenger. **[LOW — inherent, not a defect]**

Tesla disables the browser while driving by design. We embrace the parked/passenger context rather than fighting it.

## 15.3 API-dependency risks

### R9 — Spotify deprecates or further restricts the player endpoints. **[MED]**

Spotify has aggressively cut API surface (Nov 2024, Feb 2026). The player endpoints *survived* both, but the trend is restrictive and turbulent (new-app creation was briefly disabled in late 2025).

- **Mitigation:** isolate Spotify calls behind a thin client module; monitor Spotify changelogs; have the **Tesla Fleet API media telemetry** as a *fallback* now-playing source (artist/title/album/elapsed) if the Web API ever closes — degraded (no track id / weaker sync) but a lifeline.

### R10 — LRCLIB (single hobbyist service) goes down or disappears. **[MED]**

- **Mitigation:** **mirror the LRCLIB SQLite dump** into our own Postgres so we're self-sufficient; cache aggressively; provider abstraction allows adding NetEase/Megalobiz fallbacks or a licensed provider.

### R11 — Spotify rate-limit changes / 429s. **[LOW at 5 users]**

- **Mitigation:** adaptive polling, honor `Retry-After`, backoff. Single-user load is far under any plausible limit.

## 15.4 Operational / maintenance risks

### R12 — Solo maintenance / bus factor. **[MED]**

A personal project depends on one person.

- **Mitigation:** open-source it, document the runbook (token revoked, LRCLIB down, browser crash), keep the stack boring and managed (Vercel/Supabase/Upstash) so there's little to operate.

### R13 — Token/secret leakage. **[LOW with controls]**

- **Mitigation:** secrets server-side only, encrypted refresh tokens, httpOnly cookies, tight CSP, no tokens in `localStorage`. See [Security](11-security.md).

### R14 — Cost surprise. **[LOW]**

- **Mitigation:** everything runs on free/cheap serverless tiers at 5 users; monitor usage; the only real cost would arrive with scale, which the Spotify cap prevents anyway.

### R15 — Sync feels "off" due to crowdsourced LRC timing. **[LOW-MED]**

- **Mitigation:** re-anchor every poll; offer a manual ±offset nudge (future); fall back to plain lyrics when synced timing is poor.

## 15.5 Risk summary table

| ID | Risk | Likelihood | Impact | Net |
|----|------|-----------|--------|-----|
| R1 | §III.6 synchronization (commercial) | High (commercial) | High | **Caps to personal use** |
| R2 | 5-user Spotify cap | Certain | High (audience) | **Personal/FOSS only** |
| R3 | Lyrics licensing | Med–High (commercial) | High | **Personal/FOSS only** |
| R4 | No in-app playback (Widevine) | High | — (designed around) | Mitigated by companion-display model |
| R5 | Storage non-persistence | Med `UNCERTAIN` | Med | One-tap re-login |
| R6 | Browser memory crash | Med `UNCERTAIN` | Med | Tiny DOM + graceful recovery |
| R7 | Old Chromium APIs | Low–Med | Low–Med | Conservative target + feature-detect |
| R9 | Spotify API restriction | Med | High | Isolate; Fleet API fallback |
| R10 | LRCLIB outage | Med | Med | Self-host the dump |
| R12 | Solo maintenance | Med | Med | Open-source + boring stack |

**Bottom line:** none of these block a *personal* build. R1–R3 together are what make a *commercial/public* build infeasible for an individual — and that's the single most important thing to communicate to any stakeholder.
