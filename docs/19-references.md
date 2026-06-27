# 19 — References & Research Notes

All factual claims in this document were researched as of **June 2026**. Items tagged `[UNCERTAIN]` throughout the docs require on-hardware verification.

## Tesla browser & hardware

- Tesla in-car browser is Chromium-based (switched from Qt in 2019); version trails mainline by 1–3 years (~Chrome 100s as of recent reports).
  - https://www.teslarati.com/tesla-chromium-in-car-web-browser/
  - https://www.androidpolice.com/2019/03/23/teslas-in-car-web-browser-is-switching-to-chromium/
  - https://www.notateslaapp.com/news/745/tesla-updates-its-browser-with-autocomplete-browsing-history-and-more
  - https://www.tesla.com/support/browser-support
- MCU generations (hardware): https://www.findmyelectric.com/blog/tesla-mcu1-vs-mcu2-explained/ · https://www.vehiclers.com/tesla/tesla-mcu3-upgrade/ · https://tesletter.com/tesla-mcu1-mcu2-differences/
- Display sizes/resolutions:
  - https://www.notateslaapp.com/tesla-reference/1281/tesla-screen-size-comparison-for-all-tesla-models-including-size-resolution-and-aspect-ratio
  - https://www.yeslak.com/blogs/tesla-guide/tesla-screen-comparison-sizes-resolutions-and-features
  - https://www.abstractocean.com/blogs/news/tesla-model-3-y-16-inch-screen-upgrade
  - https://www.basenor.com/blogs/news/tesla-model-y-canada-gets-black-headliner-16-screen
- Browser/entertainment disabled in motion; 2026.20 parental controls:
  - https://www.notateslaapp.com/news/4226/tesla-improves-parental-controls-in-update-202620
  - https://www.thesafecell.com/news/tesla-update-browser-theater-arcade-parental-controls
  - https://teslamotorsclub.com/tmc/threads/did-5-4-cripple-browser-use-while-in-drive.11453/
- Browser memory crashes / instability:
  - https://teslamotorsclub.com/tmc/threads/browser-crashing.237965/
  - https://teslamotorsclub.com/tmc/threads/issues-with-web-browser.265719/
  - https://evehiclelab.com/tesla-web-browser-not-working-fixed/
  - https://teslamotorsclub.com/tmc/threads/tesla-model-s-browser-cache-cookies-and-clearing-them.163104/
- Theater apps = whitelisted web apps; Widevine/720p cap (implies L3):
  - https://tesliens.com/en/screen/everything-you-need-to-know-about-netflix-and-youtube-with-your-teslas-theater-mode-and-its-limitations/
  - https://help.vivaldi.com/desktop/media/widevinecdm-eme-drm-netflix-amazon-spotify/
  - https://en.wikipedia.org/wiki/Widevine

## Tesla Fleet API

- https://developer.tesla.com/docs/fleet-api
- https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints
- https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-commands
- https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data
- Media telemetry fields (242–251) in proto: https://github.com/teslamotors/fleet-telemetry/blob/main/protos/vehicle_data.proto

## Spotify platform

- Nov 2024 Web API deprecations: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api · https://techcrunch.com/2024/11/27/spotify-cuts-developer-access-to-several-of-its-recommendation-features/ · https://musically.com/2024/11/28/spotify-removes-features-from-web-api-citing-security-issues/
- **Feb 6 2026 changes** (5-user dev cap, Premium requirement, more removals): https://developer.spotify.com/documentation/web-api/references/changes/february-2026 · https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security · https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/
- Player endpoints (NOT deprecated):
  - https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
  - https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback
- Rate limits: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- Quota modes (dev vs extended): https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- Scopes: https://developer.spotify.com/documentation/web-api/concepts/scopes
- Web Playback SDK (EME/Widevine, Premium): https://developer.spotify.com/documentation/web-playback-sdk
- SDK EME failures on embedded/mobile Chromium: https://github.com/spotify/web-playback-sdk/issues/10 · https://community.spotify.com/t5/Spotify-for-Developers/Web-Playback-SDK-Not-Working-on-Latest-Chrome-Android/td-p/5566302
- OAuth PKCE / refresh / implicit removal / HTTPS redirect:
  - https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
  - https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
  - https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025
  - https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify
- Extended access criteria (250k MAU, org-only): https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access
- Developer Policy / Terms (synchronization §III.6, integration §III.5, ML §III.14, attribution): https://developer.spotify.com/policy · https://developer.spotify.com/terms
- No official lyrics endpoint (unofficial scrapers violate ToS): https://github.com/akashrchandran/spotify-lyrics-api

## Lyrics providers & licensing

- LRCLIB: https://lrclib.net/docs · https://www.lrclib.net/ · https://news.ycombinator.com/item?id=39480390 · https://openpublicapis.com/api/lrclib
- Musixmatch (tiers, preview-only free, licensing): https://www.postman.com/musixmatch-dev/musixmatch-apis · https://freeapihub.com/apis/musixmatch · https://publicapis.io/musixmatch-api
- LyricFind v. Musixmatch antitrust (2025): https://www.musicbusinessworldwide.com/court-allows-lyricfinds-antitrust-lawsuit-against-musixmatch-to-go-forward/ · https://www.digitalmusicnews.com/2025/03/06/lyricfind-musixmatch-lawsuit/
- LyricFind (licensed aggregator): https://musically.com/2021/08/11/tools-lyricfind/
- Genius (metadata only; scraping violates ToS): https://lyricsgenius.readthedocs.io/en/stable/how_it_works.html · https://bigishdata.com/2016/09/27/getting-song-lyrics-from-geniuss-api-scraping/
- Apple Music / MusicKit (no public lyrics; private TTML): https://developer.apple.com/documentation/applemusicapi/ · https://developer.apple.com/forums/thread/670516 · https://github.com/dropcreations/Manzana-Apple-Music-Lyrics
- syncedlyrics (provider-abstraction pattern, fallbacks): https://pypi.org/project/syncedlyrics/ · https://github.com/moehmeni/syncedlyrics
- lyrics.ovh / Happi: https://lyricsovh.docs.apiary.io/ · https://happi.dev/
- Lyric copyright & NMPA enforcement: https://exploration.io/what-are-lyric-rights/ · http://www.billboard.com/biz/articles/news/legal-and-management/5785701/nmpa-targets-unlicensed-lyric-sites-rap-genius-among · https://nmpa.org/press_release/nmpa-files-suits-against-two-unlicensed-lyric-sites

## Confidence notes

- **Confirmed via primary docs:** Spotify endpoint availability/scopes/`progress_ms`/`timestamp`, rate-limit mechanics, OAuth PKCE + implicit removal + HTTPS rule, dev-mode 5-user cap + Premium requirement, extended-quota 250k-MAU criteria, Developer Policy synchronization/ML/attribution rules, Web Playback SDK Premium/EME requirement; Tesla Chromium basis, display specs, motion restrictions, Fleet API media fields; LRCLIB API shape, Musixmatch/LyricFind licensing, Genius/Apple limitations, lyric-copyright landscape.
- **Uncertain — verify on Tesla hardware:** exact running Chromium version; whether EME/Widevine is exposed to third-party sites (and thus whether the Web Playback SDK works — assumed NO); `localStorage`/cookie persistence across reboot/sleep; PWA/service-worker/popup/Fullscreen support; exact pixel count of the newest 16" QHD panel; precise Spotify rate-limit numbers and ideal poll intervals (Spotify publishes none); current Musixmatch commercial pricing.
