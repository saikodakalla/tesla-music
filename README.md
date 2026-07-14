# Tesla Lyrics — Synchronized Spotify Lyrics for the Tesla Center Display

A web app that shows **time-synced Spotify lyrics** on the Tesla center touchscreen (or any browser) while your music plays. It runs **inside the Tesla web browser** — no native app — and is built to feel like a built-in feature: large text, night-friendly dark theme, landscape-first, auto-scrolling, and **zero keyboard after login**.

> This repo contains both the **working application** (at the repo root) and the original **design research** in [`docs/`](docs/) (19 sections). The implementation follows that research; where it deviates for deployability, it's noted under [Architecture notes](#architecture-notes).

---

## The one thing to understand first

**This app does _not_ play audio.** The Spotify Web Playback SDK requires Widevine/EME DRM that the Tesla browser does not reliably expose, so playing audio in-browser on a Tesla is not feasible (see [`docs/02-technical-feasibility.md`](docs/02-technical-feasibility.md)). Instead this is a **companion display**:

- **Audio plays in the native Tesla Spotify app**, exactly as it does today.
- **This app reads "what's currently playing"** via the Spotify Web API (`/me/player`) and renders the lyrics in time.

That's the closest feasible thing to the original request, and it works well.

---

## Features

- 🎵 **Synced lyrics** from [LRCLIB](https://lrclib.net) (free, no API key) behind a **swappable provider interface** — drop in Musixmatch/LyricFind later without touching the UI.
- ⏱️ **Tight sync** via poll + client-side interpolation: the server polls Spotify, latency-corrects using Spotify's own `timestamp`, and a `requestAnimationFrame` clock advances the highlight smoothly between polls.
- ⏭️ **Instant Next Up**: the auto-hiding top bar shows the next queued track and prefetches lyrics for the first two upcoming songs.
- 🌐 **Dual-language lyrics**: explicitly generate a translation or romanization, then view the original, transformed text, or both in sync.
- 🌙 **Tesla-first UI**: near-black night theme, huge fluid type (`clamp()` scales 1920×1200 → 2560×1600 → Cybertruck), GPU-composited scroll, auto-hiding chrome, ≥64px touch targets, fullscreen-friendly.
- 🔒 **Secure auth**: Authorization Code **+ PKCE**, token exchange/refresh done server-side, tokens sealed in an **encrypted httpOnly cookie** — never readable by browser JS.
- 🧊 **Calm edge cases**: no-lyrics, instrumental, plain (unsynced) lyrics, paused, nothing playing, ad, podcast, token refresh, rate-limits, and network outages all degrade gracefully — never a blank screen or a stack trace.
- 🖥️ Works just as well in a **normal desktop/mobile browser**.

---

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · `jose` (cookie encryption) · `zod` (API validation). Deploys to **Vercel** with zero external services. See [`docs/14-tech-stack.md`](docs/14-tech-stack.md).

---

## Quick start (local)

### 1. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and **Create app**.
2. Note the **Client ID** and **Client Secret**.
3. Under **Edit settings → Redirect URIs**, add **exactly**:
   ```
   http://127.0.0.1:3000/api/auth/callback
   ```
   > Spotify removed the `localhost` alias on 2025-11-27 — you **must** use `127.0.0.1` for local dev. Production must be **HTTPS** (see below).
4. Select the **Web API** when asked which APIs you'll use. Save.

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What |
|----------|------|
| `SPOTIFY_CLIENT_ID` | From the dashboard. |
| `SPOTIFY_CLIENT_SECRET` | From the dashboard. **Server-side only.** |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:3000/api/auth/callback` for local. |
| `SESSION_SECRET` | 32+ char random string. Generate: `openssl rand -base64 32` |
| `LRCLIB_USER_AGENT` | Optional; identifies you to LRCLIB. |

### 3. Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3000** (use `127.0.0.1`, not `localhost`, so the redirect URI matches). Log in with Spotify, then **start a song in any Spotify app** (phone, desktop, or your Tesla) — the lyrics appear and scroll in sync.

```bash
npm run build   # production build (verifies types + compiles)
npm start       # run the production build locally
```

---

## ⚠️ Spotify development-mode 5-user cap

As of **2026-02-06**, a new Spotify app in *development mode* can only be used by up to **5 explicitly allow-listed users**, and the developer must have **Spotify Premium**.

**You must add each user (including yourself) by their Spotify account email:**

> Spotify Developer Dashboard → your app → **User Management** → add the person's **Spotify account email** → Save.

If a non-allow-listed account tries to log in, Spotify returns **403** and the app shows a clear "Access not enabled — limited to 5 approved users" message rather than failing silently. Extended quota (unlimited users) is effectively unavailable to individuals, which is why this is a **personal / hobby** project. See [`docs/15-risks.md`](docs/15-risks.md).

---

## Deploy to a domain (Vercel)

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Import** the repo (it auto-detects Next.js — no config needed).
3. Add the **Environment Variables** from your `.env.local` in **Project Settings → Environment Variables**, but set:
   ```
   SPOTIFY_REDIRECT_URI = https://your-domain.com/api/auth/callback
   ```
4. In the **Spotify dashboard**, add that **same HTTPS redirect URI** to the app's allow-list (exact match, including the path).
5. Deploy. Vercel gives you automatic HTTPS, which Spotify now **requires** for redirect URIs.

Using a custom domain? Add it in Vercel, then update both `SPOTIFY_REDIRECT_URI` and the Spotify dashboard to the custom domain. The redirect URI must match **exactly**.

---

## Using it in the Tesla

1. Make sure your Tesla's Spotify account email is **added to the app's 5-user allow-list** (above).
2. In the car (parked), open the Tesla browser and navigate to your deployed domain.
3. Log in with Spotify once (the only keyboard moment — Spotify usually remembers consent afterward).
4. Start playback in the **native Tesla Spotify app**. Switch back to the browser tab — lyrics track whatever's playing.
5. Tap anywhere to reveal the top bar (dim, fullscreen, log out); it auto-hides again.

Notes for the car (from the research in [`docs/08`](docs/08-tesla-browser-ux.md) / [`docs/10`](docs/10-edge-cases.md)):
- **Audio is the native Spotify app's job** — this is a display only.
- The browser is disabled while **driving**; on return to Park the app re-polls and resumes automatically.
- If the Tesla browser wipes its storage on reboot, you just tap "Log in" again (one tap; consent is remembered).
- Fullscreen is gesture-gated and may no-op on the Tesla browser — the layout is edge-to-edge regardless, so it still looks immersive.

---

## How it works

```
Browser (Tesla / desktop)                 Next.js server (Vercel)              Spotify / LRCLIB
─────────────────────────                 ───────────────────────              ────────────────
LoginScreen ── tap ──────────► GET /api/auth/login ── 302 ──► accounts.spotify.com/authorize
                               (PKCE verifier+state in httpOnly cookies)
                          ◄─── GET /api/auth/callback ◄── redirect w/ code
                               exchange code+secret+verifier ─► /api/token
                               seal {access,refresh,exp} into encrypted cookie
Player (poll loop) ──────────► GET /api/playback ──────────► GET /me/player
   anchor + rAF clock     ◄─── normalized PlaybackState      (refresh token if near expiry)
   on track change ──────────► GET /api/lyrics ────────────► lrclib.net (cached)
   LyricsView: binary-search active line, glide via transform
```

- **Sync model** (`lib/spotify.ts`, `hooks/usePlayback.ts`, `components/LyricsView.tsx`): the server latency-corrects `progress_ms` using Spotify's `timestamp`; the client re-anchors on each poll and interpolates with `requestAnimationFrame`. Adaptive poll intervals (5s steady → 2s near track end → 1s burst on change → 10–20s when paused/idle). See [`docs/06`](docs/06-spotify-integration.md).
- **Lyrics** (`lib/lyrics/`): `LyricsProvider` interface with an LRCLIB implementation; exact `/get` match by track+artist+album+duration, falling back to `/search` ranked by duration + synced availability; LRC parsed server-side into `{tMs, text}`; in-memory cache with negative caching. See [`docs/07`](docs/07-lyrics-strategy.md).
- **Auth** (`lib/session.ts`, `lib/spotify.ts`, `app/api/auth/*`): PKCE + server-side exchange/refresh; proactive refresh at T-60s and reactive refresh on 401. See [`docs/05`](docs/05-authentication-flow.md).

### Project structure

```
app/
  page.tsx                 # server component: session? → Player : LoginScreen
  layout.tsx, globals.css
  api/
    auth/{login,callback,logout}/route.ts
    playback/route.ts      # BFF proxy to /me/player (token stays server-side)
    lyrics/route.ts        # validated, cached lyrics fetch
components/                # LoginScreen, Player, TopBar, LyricsView, PlainLyrics, StatusCard, SpotifyMark
hooks/                     # usePlayback (poll+adaptive interval), useLyrics (fetch on track change)
lib/                       # env, session (jose), pkce, spotify, types, lyrics/*
docs/                      # the original 19-section design research (unchanged)
```

---

## Architecture notes

A few deliberate, documented choices that make this deployable to a domain with **zero external services**, while honoring the research:

- **Session storage.** The docs ([`docs/05`](docs/05-authentication-flow.md) §5.5) call for the refresh token to live server-side, encrypted, unreadable by browser JS. Rather than require a Postgres/Redis instance, we seal the tokens into an **encrypted (AES-256-GCM/JWE) httpOnly cookie** keyed by `SESSION_SECRET`. The browser carries an opaque blob it can't read or forge; only the server decrypts it. This satisfies the security goal and deploys with nothing but a Spotify app. To move the refresh token fully off the client (true server storage), replace `lib/session.ts` with a DB-backed store — the rest of the app is unchanged.
- **BFF (Variant B).** The browser never holds a Spotify token; it polls `/api/playback` and the server uses the server-held token. This is the stricter of the two variants in the docs and is the better fit for the Tesla browser's flaky storage.
- **Lyrics cache** is in-memory (per serverless instance). For a cache shared across instances, back `lib/lyrics/cache.ts` with Upstash Redis — same `get`/`set` shape.
- **Next.js version.** Pinned to the latest patched **14.2.x**. `npm audit` reports framework advisories whose only upstream fix is the major upgrade to Next 16 (which also makes `cookies()` async, reworking the session layer); the practical optimizer-related ones are mitigated by disabling the Next image optimizer (we render album art with plain `<img>` from Spotify's CDN). Bumping to Next 16 is a clean follow-up when you're ready for the major.

---

## Legal / scope

Personal, non-commercial use. LRCLIB lyrics are **crowdsourced and unlicensed** — fine for a personal tool, not a commercial base. Synchronizing lyrics to Spotify playback is in tension with Spotify Developer Policy §III.6; the personal, ≤5-user posture is the mitigation. Album art + metadata are shown and the track links back to Spotify per the attribution policy. The moment money or public distribution enters, you need a licensed provider (Musixmatch/LyricFind) and a different posture. See [`docs/07`](docs/07-lyrics-strategy.md) and [`docs/15-risks.md`](docs/15-risks.md).

---

## License

Personal/educational use. Respect Spotify's and LRCLIB's terms.
