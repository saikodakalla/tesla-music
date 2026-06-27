# 04 — Complete System Diagram

## 4.1 Component / data-flow overview (ASCII)

```
                        ┌───────────────────────────────────────────────┐
                        │                 TESLA VEHICLE                  │
                        │                                               │
   audio out  ◀─────────┤  Native Tesla Spotify app  ──── plays ──────┐ │
   (speakers)           │                                            │ │
                        │  ┌──────────────────────────────────────┐  │ │
                        │  │  Tesla Chromium browser               │  │ │
                        │  │  ┌────────────────────────────────┐   │  │ │
                        │  │  │  OUR SPA (React/Next, static)  │   │  │ │
                        │  │  │  • playback poller             │   │  │ │
                        │  │  │  • interpolated sync clock     │   │  │ │
                        │  │  │  • lyrics renderer (rAF)       │   │  │ │
                        │  │  │  access token in memory only   │   │  │ │
                        │  │  └───────┬───────────────┬────────┘   │  │ │
                        │  └──────────┼───────────────┼────────────┘  │ │
                        └─────────────┼───────────────┼───────────────┘ │
                                      │               │                 │
              (1) GET /me/player      │               │  (2) GET /api/lyrics
              with access token       │               │  (our origin)
                                      ▼               ▼
             ┌────────────────────────────┐   ┌──────────────────────────────┐
             │     SPOTIFY WEB API        │   │      OUR BACKEND (Vercel)     │
             │  /me/player                │   │  Next.js API routes:          │
             │  /me/player/currently-     │   │  • /api/auth/* (PKCE exch,    │
             │     playing                │   │     refresh, session)         │
             │  returns: track id, meta,  │   │  • /api/lyrics (proxy+cache)  │
             │  is_playing, progress_ms,  │   │  secrets: CLIENT_SECRET,      │
             │  timestamp                 │   │  refresh tokens (server-only) │
             └─────────────▲──────────────┘   └───┬───────────┬──────────┬────┘
                           │                      │           │          │
            (3) token exchange/refresh            │           │          │
            (client_secret, server→Spotify)       │           │          │
                           │             (4) lyric │   (5) hot │  (6) tok │
                           └──────────────────────┘   cache   │  store   │
                                                ▼              ▼          ▼
                                    ┌────────────────┐ ┌───────────┐ ┌──────────┐
                                    │   LRCLIB API   │ │  Redis    │ │ Postgres │
                                    │ (synced LRC)   │ │ (Upstash) │ │(Supabase)│
                                    │ + DB mirror    │ │ hot cache │ │ refresh  │
                                    └────────────────┘ └───────────┘ │ tokens + │
                                                                     │ lyric    │
                                                                     │ mirror   │
                                                                     └──────────┘

  Cross-cutting:  CDN edge (static SPA + cacheable lyrics)   •   Sentry (errors)   •   platform logs/analytics (app-health only)
```

## 4.2 Mermaid — component graph

```mermaid
flowchart TB
  subgraph Car["Tesla vehicle"]
    SPOT_NATIVE["Native Tesla Spotify app\n(plays audio)"]
    subgraph Browser["Tesla Chromium browser"]
      SPA["Our SPA\npoller · sync clock · renderer\n(access token in memory)"]
    end
    SPEAKERS(["Car speakers"])
  end

  subgraph Cloud["Our backend (Vercel serverless)"]
    AUTH["/api/auth/*\nPKCE exchange · refresh · session"]
    LYR["/api/lyrics\nproxy · parse · cache"]
  end

  REDIS[("Redis / Upstash\nhot lyric cache")]
  PG[("Postgres / Supabase\nrefresh tokens · lyric mirror")]
  SPOTIFY["Spotify Web API\n/me/player(*)"]
  LRCLIB["LRCLIB\nsynced LRC + DB dump"]
  SENTRY["Sentry / logs\napp-health only"]

  SPOT_NATIVE -->|audio| SPEAKERS
  SPA -->|GET /me/player + access token| SPOTIFY
  SPA -->|GET /api/lyrics| LYR
  SPA -->|login code / session| AUTH
  AUTH -->|code/refresh + client_secret| SPOTIFY
  AUTH -->|store/read refresh token| PG
  LYR -->|check/set| REDIS
  LYR -->|miss → fetch| LRCLIB
  LYR -->|mirror/store| PG
  SPA -.errors.-> SENTRY
  LYR -.errors.-> SENTRY
```

## 4.3 Sequence — first login through first synced lyric

```mermaid
sequenceDiagram
  participant U as Driver
  participant SPA as SPA (Tesla browser)
  participant BE as Backend
  participant SP as Spotify
  participant LR as LRCLIB/cache

  U->>SPA: open app URL
  SPA->>U: show "Log in with Spotify"
  U->>SPA: tap login
  SPA->>SPA: generate PKCE verifier+challenge
  SPA->>SP: full-page redirect /authorize (challenge, scopes)
  U->>SP: approve permissions
  SP-->>SPA: redirect back with auth code
  SPA->>BE: POST code + verifier
  BE->>SP: exchange code (+client_secret) for tokens
  SP-->>BE: access + refresh token
  BE->>BE: store refresh token (server), set session cookie
  BE-->>SPA: access token (memory) + session
  SPA->>SP: GET /me/player (access token)
  SP-->>SPA: track id, progress_ms, timestamp, is_playing
  SPA->>BE: GET /api/lyrics?track=...&dur=...
  BE->>LR: lookup (cache → LRCLIB on miss)
  LR-->>BE: synced LRC
  BE-->>SPA: parsed lyric lines + timings
  SPA->>SPA: start interpolated clock, render & highlight
```

## 4.4 Sequence — steady-state polling & song change

```mermaid
sequenceDiagram
  participant SPA as SPA
  participant SP as Spotify
  participant BE as Backend

  loop every ~3-5s (adaptive)
    SPA->>SP: GET /me/player/currently-playing
    alt same track
      SP-->>SPA: same id, new progress_ms+timestamp
      SPA->>SPA: re-anchor local clock (correct drift)
    else new track
      SP-->>SPA: new track id
      SPA->>BE: GET /api/lyrics (new track)
      BE-->>SPA: new lyrics
      SPA->>SPA: transition + restart clock
    else 204 / nothing playing
      SP-->>SPA: 204 No Content
      SPA->>SPA: show idle "nothing playing" state, slow poll
    else 401 token expired
      SP-->>SPA: 401
      SPA->>BE: refresh access token
      BE-->>SPA: new access token, retry
    end
  end
```

## 4.5 Interaction inventory

Every arrow in the system, enumerated:

1. **Native Spotify → speakers** — audio. We do not touch this.
2. **SPA → Spotify Web API (GET)** — playback polling with the bearer access token; CORS-enabled GETs, so allowed directly from the browser.
3. **SPA → Backend `/api/auth/*`** — sends the PKCE auth code, receives a session + access token; later requests a refreshed access token.
4. **Backend → Spotify token endpoint** — server-side code exchange and refresh using the client secret. The only place the secret is used.
5. **SPA → Backend `/api/lyrics`** — same-origin lyric request keyed by normalized track signature.
6. **Backend → Redis** — read-through hot cache for parsed lyrics.
7. **Backend → LRCLIB** — cache-miss fetch; optionally served from a self-hosted DB mirror instead.
8. **Backend → Postgres** — store/read encrypted refresh tokens; optional lyric mirror.
9. **SPA/Backend → Sentry & logs** — error and app-health telemetry only (no listening data).
10. **CDN edge** — sits in front of static assets and cacheable lyric responses for latency.
