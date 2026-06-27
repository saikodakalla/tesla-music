# 12 — Scalability

## 12.1 The honest headline

**The architecture scales effortlessly to 100,000+ users. Spotify's policy does not let you.** As of the Feb 6 2026 changes, a new app sits in **development mode capped at 5 allow-listed users**, and **extended quota** (unlimited users) requires a **registered company with ≥250,000 MAUs** — unreachable for an individual. So the realistic operating point is **5 users**, and every tier below 250k is hypothetical from a *Spotify-permission* standpoint even though it's trivial *technically*.

We still design the scaling story, because (a) it shows the architecture is sound, and (b) if this were ever taken on by a qualifying company (with a lyrics license), this is the path. Each tier states both the **technical** change and the **policy** reality.

## 12.2 Scaling tiers

### 100 users — *(already over the dev-mode cap; needs extended quota)*

- **Technical:** the serverless default handles this with zero change. One Vercel project, Upstash Redis free tier, Supabase free tier. Lyrics cache hit-rate is already high (100 users share popular songs).
- **Cost:** effectively $0–$20/mo.
- **Policy:** requires Spotify **extended quota** (org-only, 250k MAU bar) → **not available to an individual.** This tier is only reachable as a company.

### 1,000 users

- **Technical:** still comfortably serverless. Watch: serverless invocation counts from polling. **Move polling server-side (BFF)** so the server can *coalesce* — many users playing the same song still each need their own playback state, but the lyrics layer is shared and the per-user playback poll is a tiny GET. Add Redis-backed rate-limit buckets per user.
- **Lyrics:** import the **LRCLIB SQLite dump into Postgres** so lyric lookups are in-house (no per-miss dependency on LRCLIB). Negative-cache misses.
- **Cost:** tens of dollars/month.
- **Policy:** extended quota required; **lyrics licensing** now genuinely matters at 1k real users → need Musixmatch/LyricFind.

### 10,000 users

- **Technical:** the bottleneck becomes **playback polling fan-out** (10k users each polling Spotify). Options: (a) keep client-side polling (each client uses its *own* Spotify token, so Spotify's per-user limits, not ours, govern — this actually scales naturally because the load is distributed across users' own quotas); (b) if BFF, the *server* makes the calls and must respect per-user limits and our own egress — shard pollers, use a queue/worker pool, and a scheduler that polls active sessions only.
- **Caching:** Redis cluster / larger Upstash plan; CDN edge-cache lyrics aggressively. Lyric cache hit-rate is now very high.
- **Data:** Postgres with read replicas for the lyrics mirror; connection pooling (PgBouncer/serverless driver).
- **Observability:** Sentry + structured metrics dashboards (poll latencies, 429 rates, cache hit-rate) become essential.
- **Cost:** low hundreds/month.
- **Policy:** firmly company territory — extended quota + paid lyrics license + ToS review of the synchronization concern (§III.6) with Spotify.

### 100,000 users

- **Technical:** 
  - **Client-side polling is the scaling friend here** — load is naturally distributed because each user authenticates with their own Spotify account and consumes their own rate-limit budget; our servers mostly serve cached lyrics + token refresh. This is a strong argument to *keep* the smart-client (Variant A) design at scale rather than centralizing polling.
  - **Lyrics:** fully self-hosted mirror (LRCLIB dump and/or licensed provider feed) behind a CDN; lyric responses are immutable and edge-cacheable for very long TTLs → near-100% edge hit-rate. The lyrics layer becomes almost free per request.
  - **Token service:** the refresh/exchange path is the main server workload; horizontally scale stateless functions, store encrypted refresh tokens in a partitioned Postgres (or a managed KV), add caching for in-flight access tokens.
  - **Multi-region:** deploy functions + caches in multiple regions close to users; Postgres with regional read replicas.
  - **Queues/workers** only if BFF polling is chosen; otherwise minimal.
- **Cost:** low thousands/month — dominated by token-service compute and Postgres, not lyrics (cached) or bandwidth (small).
- **Policy:** only viable as an established company with extended quota and full lyrics licensing, and only after resolving the §III.6 synchronization question with Spotify directly. **For an individual, this tier does not exist.**

## 12.3 What scales naturally vs. what needs attention

| Concern | Scales naturally? | Why / what to do |
|---------|-------------------|------------------|
| **Static SPA delivery** | ✅ | CDN; trivially global. |
| **Lyrics serving** | ✅ (with cache/mirror) | Immutable, shareable, edge-cacheable; self-host the dump. |
| **Playback polling** | ✅ if client-side | Distributed across users' own Spotify quotas. Becomes a concern only if centralized (BFF). |
| **Token refresh/exchange** | ⚠️ | The real server workload at scale; stateless-scale it, cache access tokens, partition refresh-token storage. |
| **Refresh-token storage** | ⚠️ | Encrypted, partitioned Postgres or managed KV; back up; key management via KMS. |
| **Spotify quota** | ❌ (policy) | The hard ceiling. Distributed client polling helps with *rate limits*, but the **user-count cap** is a policy wall, not a technical one. |
| **Lyrics licensing cost** | ❌ (economics) | Per-user licensed-lyrics cost grows with users; needs a real business model. |

## 12.4 The takeaway

This system is **read-heavy, cacheable, and naturally distributed** (each user brings their own Spotify quota), which is the ideal shape for scaling — the *technical* curve is gentle and cheap all the way up. The binding constraints are **Spotify's user cap** and **lyrics licensing economics**, both of which are *business/legal* gates, not engineering ones. Honest conclusion: **build it for 5; architect it so it could scale; don't pretend the policy ceiling isn't there.**
