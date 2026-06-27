# 10 — Edge Cases

Each case lists the trigger, detection, and the exact UX/behavior. The unifying principle: **fail quietly and keep the screen calm.** Never a stack trace, never a blank white page, never a spinner you have to stare at.

| # | Case | Detection | Behavior |
|---|------|-----------|----------|
| 1 | **No lyrics for the track** | LRCLIB `/get` + `/search` both miss (after normalization) | Show now-playing (art/title/artist) centered with a soft "No synced lyrics for this song." Negative-cache it so we don't re-query every poll. |
| 2 | **Plain lyrics only (no timestamps)** | `syncedLyrics` empty but `plainLyrics` present | Show the plain lyrics as a static, readable block (no scroll), clearly marked "(not synced)." Better than nothing. |
| 3 | **Instrumental** | LRCLIB `instrumental: true` (or `[]` lines) | Show "Instrumental" with the album art; no lyric search loop. |
| 4 | **Song not in any lyrics DB / very obscure** | Same as #1 | Same as #1. Optionally offer a tiny "report/contribute" hint (LRCLIB accepts anonymous contributions) — but never block the UI. |
| 5 | **Ad playing (free Spotify)** | `currently_playing_type === 'ad'` | "Ad playing…" idle card; no lyrics; slow poll until it returns to `track`. |
| 6 | **Podcast / episode** | `currently_playing_type === 'episode'` | Show episode metadata only (if we request episodes), "Lyrics are for music tracks." No lyric fetch. |
| 7 | **Playback paused** | `is_playing === false` | Freeze the local clock and highlight at current position. Subtle "paused" indicator. Resume picks up exactly where it stopped. |
| 8 | **Scrub / seek within a song** | Same `item.id`, `progress_ms` jumps beyond interpolation prediction | Snap the highlight/scroll to the new position; keep the same lyrics. |
| 9 | **Song change** | `item.id` differs | Fetch new lyrics, cross-fade transition, restart clock from new `progress_ms`. |
| 10 | **Duplicate songs (same title, different version)** | Title collision | Disambiguate by **duration (±2s)** and ISRC when present; LRCLIB matches on duration, which usually picks the right cut. |
| 11 | **Live version / remix / extended edit** | Different duration than the studio cut | Duration-based matching naturally selects the matching length; if no synced match, fall back to plain or "no synced lyrics." |
| 12 | **Explicit vs clean version** | Same lyrics, possibly different track id | Lyrics are usually identical; duration match handles it. We display whatever the matched LRC contains (we don't censor). |
| 13 | **Nothing playing / no active device** | Spotify returns **204** | "Nothing playing — start Spotify in your Tesla." Slow poll (15–30s) watching for playback. |
| 14 | **Spotify disconnected / device closed mid-session** | Was playing → now 204 | Drop to the idle card gracefully; don't blank the last lyrics abruptly — fade to idle. |
| 15 | **Access token expired** | Spotify GET returns **401** | Silent refresh via backend, retry the request. User sees nothing. |
| 16 | **Refresh token revoked/expired** | Refresh call fails | Drop to the one-tap login screen with a friendly "Please log in again." |
| 17 | **Rate limited** | **429** with `Retry-After` | Stop polling for the indicated seconds, then resume with a longer interval. Keep showing current lyrics frozen; no error shown unless prolonged. |
| 18 | **Poor / intermittent internet** | Timeouts, 5xx, network errors | Exponential backoff with jitter; keep last-known lyrics on screen with a subtle "reconnecting…" hint. Recover automatically when connectivity returns. |
| 19 | **Offline entirely** | All requests fail | "Offline — waiting for connection." Retain current view; auto-recover. (No durable offline lyrics cache — PWA storage unreliable on Tesla.) |
| 20 | **Tesla browser reload / crash recovery** | App boots fresh; in-memory state gone | If the httpOnly session cookie survived, silently restore session → immediately poll → resume. If storage was wiped, show one-tap login. Design assumes this can happen anytime. |
| 21 | **`localStorage`/cookies wiped on reboot** `[UNCERTAIN]` | No session on load | Same as #20: one-tap re-login (Spotify likely remembers consent, so it's fast). |
| 22 | **Car shifted into Drive** (browser disabled) | App backgrounded/closed by Tesla | Nothing we can do — Tesla blocks the browser while driving by design. On return to Park, the app resumes (re-poll, re-anchor). |
| 23 | **Long instrumental break inside a song** | Big `tMs` gap between consecutive lines | Show a subtle progress affordance during the gap; next line arrives on time. No "dead screen." |
| 24 | **Lyrics timing drift vs what the user hears** | Inherent crowdsourced timing imperfection | Re-anchor every poll (corrects our clock). If the *LRC itself* is mistimed, offer a tiny manual ±offset nudge (future feature) — but don't auto-fight it. |
| 25 | **Clock skew (device clock wrong)** | Interpolation biased | Anchor frequently on Spotify's `timestamp`; optionally compute a server-time offset at login. |
| 26 | **Multiple devices** (user playing on phone, not the car) | `/me/player` reflects the *active* device, whichever it is | We show lyrics for whatever the account is actively playing. If it's the phone, lyrics still track it — acceptable and arguably nice. Device name is available if we want to indicate it. |
| 27 | **Two of the 5 allow-listed users at once** | Independent sessions | Each session is isolated; shared lyric cache benefits both. No conflict. |
| 28 | **Non-allow-listed user tries to log in (dev-mode cap)** | Spotify returns **403** at auth/data | Explain plainly: "This app is in Spotify development mode and limited to 5 approved users." (See [Risks](15-risks.md).) |
| 29 | **Very long song / very long lyrics** | Large `lines[]` | Windowed rendering means DOM stays small regardless of length; no performance hit. |
| 30 | **Non-Latin / RTL lyrics** | Script detection | Render with appropriate font fallback and `dir` handling; romanization is a future feature, not v1. |
| 31 | **Spotify returns `item: null` while `is_playing` true** | Rare transient | Treat as transient; keep last state, re-poll shortly. |
| 32 | **Fullscreen API no-ops on Tesla** `[UNCERTAIN]` | Request resolves to no change | Degrade silently; edge-to-edge layout means it still looks immersive. |

## Design rules distilled from the above

1. **Last good state persists.** On any transient failure, keep showing the current lyrics rather than blanking.
2. **204 is normal, not an error.** Idle is a first-class, well-designed state.
3. **Every error has a calm, human message** and an automatic recovery path; the user rarely needs to act, and when they do it's one tap.
4. **Duration is the disambiguator** for the whole family of "same title, different version" cases (10–12).
5. **Assume the browser can vanish and come back** (20–22); make resume instant and storage-loss survivable.
