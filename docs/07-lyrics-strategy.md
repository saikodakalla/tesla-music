# 07 — Lyrics Strategy

The hardest *product* decision after "we can't play audio." Spotify provides **no public lyrics API** (its consumer lyrics come from a Musixmatch partnership via a private endpoint we cannot use). So lyrics must come from a separate source. Below, every realistic option is compared, then a recommendation.

## 7.1 Provider comparison

| Provider | Synced? | API access | Cost | Coverage / reliability | Licensing / legal | Verdict |
|----------|---------|-----------|------|------------------------|-------------------|---------|
| **LRCLIB** | ✅ line-level LRC (no word-level) | Free, public, **no key, no auth** | **$0** | ~3M crowdsourced entries; strong on popular tracks, patchy on obscure/non-English; quality varies; single hobbyist-run service | **Gray.** Crowdsourced, **unlicensed** ("a Library Genesis for lyrics"); no publisher licenses. Fine for personal/FOSS; not a clean commercial base. | **✅ Recommended for the personal build** |
| **Musixmatch** | ✅ line-level **and** word-level (Richsync) — the most capable | Paid; free tier returns only ~30% preview text, non-commercial | Pro/Enterprise pricing **not public** (contact sales); free tier ~couple-thousand calls/day, no full/synced lyrics | Best-in-class; powers Spotify's lyrics | **Licensed** (holds publisher deals incl. exclusive Warner Chappell). The legally-clean choice. *Note:* defendant in LyricFind's 2025 $1B+ antitrust suit (proceeding to discovery). | **⚠️ The choice only if commercial + licensed + budgeted** |
| **LyricFind** | ✅ line-level (auto-synced to label audio) | B2B/partner only, not self-serve | Negotiated (enterprise; deals worth tens of millions at Spotify scale) | Fully licensed (Universal, Sony, BMG…); powers Google/YouTube/Amazon/Deezer | **Licensed.** The other legitimate licensor; a hedge against Musixmatch exclusivity. | **⚠️ Enterprise alternative to Musixmatch** |
| **Genius** | ❌ no sync | API returns **metadata only, not lyrics**; lyrics require scraping the page (**violates ToS**) | Free API / scraping is ToS-violating | Huge catalog & annotations | Lyrics are licensed property; scraping prohibited. | **❌ Not viable for synced lyrics** |
| **Apple Music / MusicKit** | ✅ (TTML, word-level) but **private** | Public API has **no lyrics**; synced lyrics only via privileged/private endpoints | — | Excellent, but inaccessible | Apple holds licenses; third-party use of private endpoints **violates terms** and can break anytime. | **❌ Not a public integration path** |
| **lyrics.ovh / Happi.dev / AZLyrics** | ❌ no sync | Plain lyrics only (or scraping) | Free/cheap | Varies | Gray / no developer access | **❌ No sync** |
| **NetEase / QQ Music / Megalobiz** | ✅ line-level (unofficial endpoints) | Unofficial/reverse-engineered | Free | Large (esp. Asian catalogs) | Unlicensed/gray; ToS/geo concerns | **⚠️ Only as fallback in an aggregator** |

## 7.2 The legal landscape (why this matters even for a hobby)

Song lyrics are **copyrighted compositions**; displaying full lyrics is a reproduction/display that legally requires a publisher license. Short excerpts *may* be fair use; full songs are not. Commercial display in practice requires a license via **Musixmatch or LyricFind** (or direct publisher deals). Enforcement is real: the **NMPA** sent takedowns to 50 unlicensed lyric sites in 2013 (Rap Genius topped the list), sued SeekLyrics/LyricsTime, and previously won $7M+ against LyricWiki's operator. LRCLIB exists precisely in the gap — crowdsourced, non-profit, often hosted abroad, low enforcement priority — but it confers **no license** on downstream users.

**Implication for this project:** as a **personal, non-commercial** tool serving ≤5 allow-listed users, LRCLIB is a pragmatic and low-risk choice. The moment money or public distribution enters, you need Musixmatch/LyricFind and a real license — which, combined with Spotify's own §III.5/§III.6 restrictions, is why the commercial version is effectively gated (see [Risks](15-risks.md)).

## 7.3 Recommendation

**Use LRCLIB, behind a provider-abstraction layer.**

1. **LRCLIB is the default backend** for the personal/open-source build: free, no key, LRC synced lyrics, and — uniquely — it publishes **full-database SQLite dumps** we can mirror. Mirroring is a major reliability win: it removes the single-point-of-failure of a hobbyist service and lets us serve lyrics from our own Postgres/cache with LRCLIB as a fallback fetch for cache misses.
2. **Abstract behind a `LyricsProvider` interface** (the pattern the `syncedlyrics` library demonstrates). The app calls `provider.getSynced(track)`; the implementation is swappable. This means we can:
   - start on **LRCLIB**,
   - add **NetEase/Megalobiz as fallbacks** for misses (with the same gray-area caveat),
   - and **swap in Musixmatch/LyricFind** wholesale if the project ever goes licensed — without rewiring the app.
3. **No word-level karaoke in v1**, because LRCLIB is line-level only. Word-level is explicitly a "licensed-provider-only" future feature (see [Future Features](16-future-features.md)).

## 7.4 Matching: from a Spotify track to the right LRC

The lookup must be robust because titles/durations vary across sources:

1. **Primary key:** `GET https://lrclib.net/api/get?track_name=&artist_name=&album_name=&duration=`. LRCLIB matches on track/artist/album **and duration within ±2s**, which disambiguates remixes/live/edits surprisingly well.
2. **Use `duration_ms` from Spotify** (÷1000) as the duration — this is the single best disambiguator for "same title, different version."
3. **Fallback:** if exact `/get` misses, fall to `GET /api/search?q=` and pick the best candidate by (a) closest duration, (b) artist match, (c) presence of `syncedLyrics`.
4. **Normalization:** strip "(Remastered 2011)", "- Live", "(feat. …)" noise when matching, but keep the original for display. Lowercase/trim/strip diacritics for comparison keys.
5. **ISRC** (when present from Spotify `external_ids.isrc`) can be stored as part of the cache key to distinguish versions even when titles collide.
6. **`instrumental` flag:** LRCLIB returns `instrumental: true` for instrumentals → show a tasteful "instrumental — no lyrics" state rather than searching forever.

## 7.5 LRC parsing & data shape

LRCLIB returns `syncedLyrics` as LRC text: `[mm:ss.xx] line`. The backend parses it once into a normalized array the client can consume directly:

```
LyricLine = { tMs: number, text: string }   // tMs = absolute ms offset
LyricsDoc = {
  source: "lrclib",
  trackKey: string,            // normalized signature used for caching
  durationMs: number,
  synced: boolean,             // false → only plainLyrics available
  lines: LyricLine[],          // sorted by tMs; [] if instrumental
  plain?: string               // fallback unsynced text
}
```

Parsing server-side (not in the slow Tesla browser) keeps the client light and lets us cache the *parsed* form. Lines are sorted by `tMs`; the renderer binary-searches for the active line given the interpolated position.

## 7.6 Caching & cost

- **Free** at our scale (LRCLIB has no documented rate limit; we set a descriptive `User-Agent` as requested).
- **Cache the parsed `LyricsDoc`** in Redis keyed by `trackKey` with a long TTL (lyrics don't change). Popular songs are fetched from LRCLIB **once, ever**, then served from cache to all allow-listed users.
- **Optional DB mirror:** import the LRCLIB SQLite dump into Postgres for offline-of-LRCLIB resilience; refresh the dump periodically. This makes the lyrics layer essentially **self-sufficient**.
- **Negative caching:** remember "no lyrics found for trackKey" with a shorter TTL so we don't re-query LRCLIB for every poll of a song that has none.
