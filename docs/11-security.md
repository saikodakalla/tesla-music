# 11 — Security

Threat model is modest (personal app, ≤5 users) but the OAuth surface and the fragile, semi-public Tesla browser make a few things genuinely important. The north star: **no long-lived secret ever lives in the browser.**

## 11.1 Assets to protect

1. **Spotify client secret** — full app credential. Compromise = impersonate the app.
2. **Refresh tokens** — long-lived (~6 mo) per-user access. Compromise = read a user's playback indefinitely.
3. **Access tokens** — short-lived (~1 hr) bearer tokens.
4. **Session cookies** — map a browser to a user's tokens.
5. **(If self-hosted) the LRCLIB mirror / our infra** — lower sensitivity.

## 11.2 OAuth security

- **PKCE (S256)** on every authorization — an intercepted authorization code is useless without the `code_verifier`.
- **`state` parameter**, random per attempt, validated on callback — defends the OAuth callback against CSRF/replay.
- **Authorization Code flow, not implicit** — implicit was removed by Spotify (Nov 27 2025) anyway, and it leaked tokens in the URL fragment.
- **Server-side token exchange** — the client secret is used only by the backend, never shipped to the browser.
- **Exact redirect-URI allow-list** in the Spotify dashboard; HTTPS-only (Spotify requirement); local dev uses `http://127.0.0.1` (not `localhost`, which Spotify banned).
- **Minimum scopes** (`user-read-currently-playing`, `user-read-playback-state`); add `user-modify-playback-state` only if/when transport controls ship.

## 11.3 Token storage

| Token | Where | Protection |
|-------|-------|-----------|
| Client secret | Backend env / secret manager only | Never in repo, never in client bundle, injected at deploy. |
| Refresh token | Server-side store (Postgres) | **Encrypted at rest** (app-level encryption with a KMS-held key); rotated when Spotify rotates it. |
| Access token | Browser **memory only** (Variant A) | Never in `localStorage`/`sessionStorage` (XSS + Tesla-persistence). In **Variant B (BFF)** it never reaches the browser at all. |
| Session id | **httpOnly, Secure, SameSite=Lax** cookie | Not readable by JS → XSS can't exfiltrate it. |

**Why not `localStorage` for tokens?** Two reasons: (1) it's readable by any injected script (XSS), and (2) the Tesla browser may wipe it on reboot/crash anyway. The httpOnly-cookie-backed server session is both safer and more durable.

## 11.4 Transport security

- **HTTPS everywhere**, HSTS enabled. Mandatory — Spotify rejects non-HTTPS redirect URIs, and we never want bearer tokens on the wire in cleartext.
- **TLS terminated at the CDN/host** (Vercel/Cloudflare auto-manage certs).
- **No mixed content** — all assets and API calls over HTTPS.

## 11.5 CSRF

- OAuth `state` for the auth callback.
- **SameSite=Lax** session cookie blocks cross-site cookie sending for the dangerous cases.
- State-changing backend endpoints (`/api/auth/*`) require the session cookie and, where applicable, a CSRF token / double-submit pattern. (Most of our endpoints are GET/idempotent or token-bound, limiting CSRF surface.)
- Backend validates `Origin`/`Referer` on sensitive POSTs.

## 11.6 XSS

- **React's default escaping**; **never** `dangerouslySetInnerHTML` for lyrics (they're third-party text — treat as untrusted and render as text only).
- **Content-Security-Policy** header: restrict `script-src` to self (+ the minimal needed CDNs for the Spotify SDK *only if ever used*), `connect-src` to self + Spotify API + (server-side only) LRCLIB, `img-src` to self + Spotify's image CDN, `object-src 'none'`, `base-uri 'self'`. A tight CSP is the main reason an access token in memory is acceptable.
- Sanitize/normalize lyric text server-side before caching (strip control chars; it's plain text, never markup).
- httpOnly session cookie means even a successful XSS can't read the session id.

## 11.7 Rate limiting & abuse

- **Spotify side:** honor `Retry-After` on 429; client backs off (see [Spotify Integration](06-spotify-integration.md)).
- **Our backend:** rate-limit `/api/lyrics` and `/api/auth/*` per session/IP to prevent a misbehaving client (or abuse) from hammering LRCLIB or the token endpoint. Cheap at our scale; important for hygiene.
- **Allow-list enforcement:** because Spotify dev mode is capped at 5 users, only allow-listed Spotify accounts can authenticate at all — a built-in abuse ceiling.

## 11.8 Secrets management

- Secrets in the host's **encrypted environment / secret manager** (Vercel/Cloudflare env vars, or a dedicated KMS for the token-encryption key).
- **Never** committed — `.gitignore` excludes `.env*` (a `.env.example` documents the *names* only).
- Rotate the client secret if ever exposed; refresh tokens are revocable via the user re-consenting / Spotify account settings.
- Least-privilege DB credentials; separate keys for encryption vs. app DB access.

## 11.9 Backend validation

- **Validate everything from the client**: the `code`/`code_verifier` shape on callback, query params on `/api/lyrics` (track/artist/duration), session presence on protected routes.
- **Never trust client-supplied user identity** — derive the user from the server session, not from a client-sent id.
- **Type-checked request schemas** (TypeScript + a runtime validator like zod) at the API boundary.
- **Output encoding** on anything reflected.

## 11.10 Privacy & policy-driven security

- **We do not log per-user listening data** — both a privacy choice and a Spotify-policy requirement (§III.13 forbids deriving listenership analytics/profiles). Playback data is used transiently and not retained.
- **No third-party trackers** that could leak tokens/URLs; analytics is app-health only and privacy-respecting.
- **Data minimization:** the only personal data we store is what's needed to maintain the session (an opaque user id + encrypted refresh token). Easy account deletion (revoke + purge).

## 11.11 Tesla-browser-specific notes

- Storage volatility actually *helps* security (tokens don't linger), but we still never put long-lived secrets client-side.
- Because the car is a semi-shared space, **logout must fully clear** the server session and any client state, and Spotify consent can be revoked from the user's Spotify account.
- Full-page-redirect OAuth (no popup) also avoids popup-based phishing/redirect ambiguities.
