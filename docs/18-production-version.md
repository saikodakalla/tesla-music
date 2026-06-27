# 18 — Production Version

The ideal, polished build with no time constraints — *within what Tesla and Spotify actually permit.* "Production" here means **the best possible personal/open-source product**, plus a clear-eyed description of what a *truly* commercial version would additionally require (and why it's gated).

## 18.1 The polished personal/FOSS product

### Experience
- Flawless companion-display feel: instant resume after any reboot/crash, sub-second sync, buttery 60fps glide on every Tesla model, art-driven ambient backdrop, perfect night palette.
- Zero-friction auth: one-tap login, silent refresh, survives storage wipes via durable server session.
- Rich-but-calm states for every edge case in [Edge Cases](10-edge-cases.md) — nothing ever looks broken.
- Personalization: font scaling, theme options, manual sync-offset nudge, optional romanization/translation (personal use), tap-to-reveal playback controls.

### Reliability & resilience
- **Self-hosted LRCLIB mirror** (SQLite dump → Postgres), refreshed on a schedule, with live LRCLIB only as a miss-fallback → the lyrics layer no longer depends on a single hobbyist service.
- **Provider abstraction** with multi-source fallback (LRCLIB → community sources) for maximum coverage.
- **Fleet API media telemetry as a backup** now-playing source if the Spotify Web API ever restricts the player endpoints (degraded sync, but keeps lyrics flowing).
- Aggressive multi-layer caching (edge + Redis + DB) so popular songs are effectively free and instant.

### Engineering quality
- Full **Variant B (BFF)** auth: access token never touches the browser; tightest token-theft posture.
- Comprehensive **error tracking (Sentry)** with Tesla-browser-specific dashboards; structured logs for cache hit-rate, 429s, LRCLIB health.
- Hardened against the Tesla memory-crash behavior: windowed DOM, leak-free loops, periodic soft-reset, validated over multi-hour sessions on every model.
- Conservative, feature-detected client proven against the car's actual Chromium version; graceful degradation for Fullscreen/visibility/storage.
- CI/CD with preview deploys; a runbook for every known failure mode.
- Tight CSP, HSTS, encrypted refresh tokens, least-privilege infra, secret rotation.

### Polish details
- Smooth, art-aware cross-fades on song change; tasteful instrumental-break affordance.
- Color-blind-safe, WCAG-AA+ contrast, `prefers-reduced-motion` support.
- Per-model layout tuning (1920×1200 / 2200×1300 / 2560×1600 / 2650×1440) verified in real cars.
- Open-source so anyone can run their own instance with their own Spotify 5-user slots — the only legitimate "scaling" path for individuals.

## 18.2 What a *commercial* production version would additionally require — and why it's gated

This is where "no time constraints" meets "no permission." To ship this to the public for money, you would need **all** of:

1. **Spotify Extended Quota** — requires a registered company with **≥250k MAUs**, commercial viability review, and weeks of approval. Not available to individuals; you must already be a substantial company. *(Blocker.)*
2. **Spotify's written approval for synchronization** — Developer Policy §III.6 ("no synchronizing Spotify content with visual media") and §III.5 ("no integrating other services' content") put a lyrics-sync product in direct tension; a commercial version needs an explicit partnership/exception. *(Blocker without Spotify buy-in.)*
3. **A real lyrics license** — Musixmatch or LyricFind (or direct publisher deals) for legal lyric display, including word-level/karaoke data. Negotiated enterprise pricing; complicated by the **Musixmatch–LyricFind antitrust litigation**. *(Cost + legal.)*
4. **Commercial-use clearance** — Spotify forbids commercial use / monetization / ads on streaming-adjacent apps without approval; the business model itself must be cleared. *(Blocker.)*
5. **Possibly Tesla engagement** — to feel "built-in" rather than "a web page," and to address the parked-only and in-motion constraints, you'd want Tesla's cooperation. Tesla has no third-party in-car app platform today. *(No current path.)*

**Conclusion:** the *technical* production version is fully achievable and is excellent. The *commercial* production version is not a matter of engineering effort — it's gated behind Spotify extended quota, a synchronization exception, a lyrics license, and (ideally) Tesla cooperation, none of which an individual can obtain. The most realistic "production" outcome is a **superb, open-source, personal companion display** that each user runs for themselves and ≤4 others.

## 18.3 Production vs MVP at a glance

| Dimension | MVP (weekend) | Production (no time limit, personal/FOSS) |
|-----------|---------------|-------------------------------------------|
| Auth | PKCE, token in memory (Variant A) | BFF (Variant B), token never in browser |
| Lyrics source | Live LRCLIB + light cache | Self-hosted mirror + multi-source fallback |
| Users | 1 (you) | up to 5 allow-listed (platform cap) |
| Sync | Solid, line-level | Tight, line-level (+ word-level *only if* licensed) |
| Edge cases | Common ones | All of section 10, gracefully |
| Tesla hardening | Basic | Full, multi-model, multi-hour validated |
| Resilience | Single provider | Mirror + Fleet-API fallback |
| Observability | Minimal | Full Sentry + health dashboards + runbook |
| Personalization | None | Font scaling, themes, offset nudge, translation/romanization |
| Commercial | No | **No (policy/licensing gated)** |
