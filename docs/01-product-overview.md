# 01 — Product Overview

## The one-sentence version

A web page you open in your Tesla that shows the lyrics to whatever Spotify song is currently playing, scrolling and highlighting line-by-line in time with the music — and changing automatically when the song changes — without ever asking you to touch the screen again after you log in.

## The experience from the driver's seat

You're parked in your Tesla, or sitting in the passenger seat, with Spotify already playing through the car's native Spotify app. You open the browser (it remembers the bookmark), and the page is already showing the lyrics to the song you're hearing. The current line is large and bright in the center of the screen; the line you just heard is fading above it; the line coming next is dim below. As the singer reaches each line, the highlight moves down to meet it. When the chorus hits, the lyrics are already there. When the song ends and the next one starts, the screen quietly swaps to the new song's lyrics — no spinner you have to stare at, no button to press, no keyboard.

The whole thing is designed to be glanceable and calm. It is not a karaoke arcade. It is the lyrical equivalent of the album art and track title that the native player already shows, except it's the words, and they move with the music.

### A concrete walkthrough

1. **First run.** You navigate to the app's URL (typed once, then bookmarked / set as a browser shortcut). You see a single large "Log in with Spotify" button — nothing else, because typing on a car touchscreen is miserable and we want to minimize it.
2. **Login.** Tapping the button sends the whole page to Spotify's hosted login (a full-page redirect, *not* a popup — see [Auth](05-authentication-flow.md) for why). You authorize the requested permissions. Spotify redirects you back to the app.
3. **Detection.** The app immediately asks Spotify "what is this account playing right now?" If the native Spotify app is playing a track, the app knows the artist, title, album, and — crucially — the exact playback position in milliseconds.
4. **Lyrics appear.** The app fetches synchronized lyrics for that track and renders them. The line matching the current playback position is highlighted and centered.
5. **It stays in sync.** A local clock advances the highlight smoothly between server checks, so scrolling looks continuous rather than jumpy. Every few seconds the app quietly re-checks Spotify to correct any drift, detect a pause, or notice a new song.
6. **Song change.** When you skip or a song ends, the app detects the new track on its next check and swaps the lyrics in with a gentle transition. You did nothing.
7. **Pause / resume.** Pause the music and the highlight freezes. Resume and it picks up where it left off.

### What makes it feel "built-in"

- **No keyboard after login.** The only text entry in the entire app is your Spotify password, on Spotify's own page. After that, it is touch-optional.
- **Landscape, edge-to-edge, dark.** It is designed for a 15–17" landscape automotive panel viewed in a dim cabin, not a phone in daylight.
- **It mirrors the native player's mental model.** Same song the car is playing, same now-playing metadata, plus the words.
- **Failure is quiet.** No lyrics for a track? You see clean now-playing info and a calm "no synced lyrics for this song" — never a broken-looking error.

## Who it's for

- **Primary persona — "the parked listener / passenger."** Someone enjoying music in a stationary Tesla (charging, waiting, road-trip passenger) who wants to follow or sing along to lyrics. Tesla disables the browser and entertainment surfaces while the car is in motion for the driver, so the realistic usage context is **parked or passenger-side**, and the design embraces that rather than pretending otherwise.
- **Secondary persona — "the tinkerer."** A Tesla-owning developer who wants this for themselves and a few friends and is comfortable that it's a personal project bound by Spotify's 5-user development-mode cap.

## Explicit non-goals

- It does **not** play music. Audio is the native Tesla Spotify app's job. (Why: DRM/Widevine uncertainty in the Tesla browser, plus Spotify ToS — see [Feasibility](02-technical-feasibility.md).)
- It is **not** a commercial product. The Spotify 5-user development-mode cap and lyrics-licensing economics make a paid/public launch infeasible for an individual (see [Risks](15-risks.md)).
- It is **not** a native app, and there is no path to making it one — Tesla has no third-party in-car app store.
- It does **not** work while driving, by Tesla's design, and we do not try to circumvent that.

## Why build it at all, given the constraints?

Because within the "personal companion display" framing it is genuinely useful, genuinely buildable, and a clean demonstration of working *with* platform constraints instead of against them. The value proposition is honest: *your car already plays Spotify and already shows album art; this adds the words, in sync, for free, for you and a handful of people you allow-list.* Everything in the rest of this document is in service of making that specific experience excellent and robust.
