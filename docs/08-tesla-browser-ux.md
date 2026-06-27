# 08 — Tesla Browser UX

The UI has exactly one job done extremely well: show the current lyric, big and legible, moving smoothly with the music, in a dim car, with almost no interaction. Everything below serves that.

## 8.1 Target screen dimensions (researched)

| Model / variant | Display | Resolution | Aspect | Orientation |
|-----------------|---------|------------|--------|-------------|
| Model 3 (Highland, 2024+) | 15.4" | **1920 × 1200** | 16:10 | Landscape |
| Model Y (current / Juniper) | 15.4" | **1920 × 1200** | 16:10 | Landscape |
| Model Y Perf (Juniper) / 2026 16" | 16" | **QHD/2K (~2560 × 1600)** `[exact px UNCERTAIN]` | 16:10 | Landscape |
| Model S / X (2021+ refresh) | 17" | **2200 × 1300** | ~16:9.5 | Landscape (tilts L/R) |
| Cybertruck | 18.5" | **2650 × 1440** | ~16:9 | Landscape |
| Legacy Model S/X (pre-2021) | 17" | 1920 × 1200 | **Portrait** | Portrait (only if supporting legacy) |
| Model S/X rear screen | 8" | 1440 × 900 | 16:10 | Landscape |

**Design baseline:** **1920 × 1200 landscape** (covers Model 3/Y, the majority). Layout is **fluid** (vw/vh, clamp(), flexbox) so it scales up cleanly to 2200×1300 / 2560×1600 / 2650×1440 without per-model code. All panels are ~150 PPI, so we design for *physical* legibility at arm's length, not pixel density. Portrait legacy S/X is a known degraded case, not a primary target.

## 8.2 Layout

A three-zone vertical rhythm, centered, landscape:

```
┌──────────────────────────────────────────────────────────────────────┐
│  [album art]  Song Title — Artist            ●Spotify   ☾ (night)  ⏻   │  ← slim top bar (now-playing + attribution + minimal controls)
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                  previous line (dim, smaller)                          │
│                                                                        │
│            ███  CURRENT LINE — large, bright, centered  ███            │  ← the focal point
│                                                                        │
│                  next line (dim, smaller)                              │
│                  next+1 line (dimmer)                                  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

- **Vertical center band** is the stage; the active line sits at optical center, with 1–2 lines of context above and 2–3 below, all dimmed and slightly smaller, so the eye always knows where "now" is.
- **Top bar is slim and quiet**: album art thumbnail, title/artist, the **required Spotify attribution mark**, a night-mode toggle, and a logout/settings affordance. It auto-hides after a few seconds of no interaction and reveals on tap.
- **No nav, no menus, no scrollbars, no chrome.** One screen.

## 8.3 Typography & legibility

- **Large type.** Current line ~clamp(2.5rem, 5vw, 4.5rem); context lines ~60–70% of that. Readable at ~80cm in a moving glance.
- **High-contrast, variable-weight sans-serif** (system stack first to avoid font-load jank on the slow browser; one bundled fallback). Current line heavier weight + full opacity; context lines lighter + reduced opacity.
- **Generous line height and max line width** (~70–80% of screen) so long lyric lines wrap predictably and don't crowd the edges.
- **Active-line emphasis** via brightness/scale, not color alone (color-blind safe; also reads in a dim cabin).

## 8.4 Night mode (default in a car)

- **Default to dark.** Near-black background, off-white text. A bright white screen at night in a car is genuinely unpleasant and unsafe-feeling.
- **Auto/dim option:** optionally follow time of day, or offer a one-tap dim. (We can't read Tesla's cabin light sensor from the browser, so this is app-controlled, not vehicle-synced.) `[Tesla theme sync not available]`
- **No pure-white flashes** on transitions; cross-fades stay within the dark palette.

## 8.5 Touch targets & interaction

- **Minimal interaction by design.** After login there is essentially nothing you *must* touch.
- **When controls do appear, they're huge.** ≥64px hit targets, well-spaced — automotive touch is imprecise and often gloved. (WCAG says 44px; cars warrant bigger.)
- **No hover states** (touch only). No tiny icons. No long-press-only actions.
- **No keyboard after login.** The single text-entry moment is the Spotify password on Spotify's page. The app itself never raises the keyboard. (Avoiding the on-screen keyboard is a top UX goal — it's slow and covers half the screen.)
- **Tap anywhere** reveals the top bar; tap again or wait to dismiss.

## 8.6 Auto-scroll & current-lyric highlight

- The active line is always pulled to optical center; as the song advances, the **whole lyric column translates upward** so the next line glides into the center spot.
- The transition between active lines is a smooth ease (~300–400ms), not an instant jump, so it reads as a gentle, continuous scroll.
- Highlight = brightness + slight scale on the active line; the just-finished line fades as it leaves center.
- **Long instrumental gaps** (large `tMs` jump between lines) show a subtle progress affordance (e.g. a slowly filling dot row) so the screen isn't dead air, and then the next line arrives on time.

## 8.7 Fullscreen / immersive

- Offer fullscreen via the **Fullscreen API on a user tap** (gesture-gated; support in the Tesla browser is `[UNCERTAIN]` — degrade gracefully if it no-ops).
- Lay out edge-to-edge regardless, so even without true fullscreen it fills the viewport with no app chrome.
- Hide the cursor/idle UI after inactivity for a clean "feature, not webpage" feel.

## 8.8 Minimal distraction

- One focal element (the lyric). No ads (and Spotify policy forbids ads on a streaming-adjacent app anyway), no recommendations, no social, no notifications.
- Motion is purposeful (the scroll) and never decorative/flashy — appropriate for an in-car context.
- Failure states are calm: "No synced lyrics for this song," "Nothing playing," "Reconnecting…" — never a stack trace or broken layout.

## 8.9 Performance-driven UX choices (see also [Performance](09-performance.md))

- **Small DOM:** render only the visible window of ~7–9 lines, not the entire song, so the memory-limited Tesla Chromium stays smooth.
- **GPU-friendly animation:** animate a single container's `transform: translateY()` with `will-change`, driven by `requestAnimationFrame` — no per-line reflow, no layout thrash.
- **System fonts first** to avoid web-font load jank on a slow connection / old browser.
- **No heavy frameworks on the render path:** the per-frame work is "compute active index, set one transform" — cheap enough to hold 60fps even on modest hardware.

## 8.10 Accessibility & comfort

- Color-blind-safe emphasis (brightness/scale, not hue).
- Optional **font scaling** control (future) for riders who want larger/smaller text.
- Respect `prefers-reduced-motion` if exposed: replace the glide with a simpler cross-fade.
- Readable contrast ratios (WCAG AA+) in both dark and the optional lighter theme.
