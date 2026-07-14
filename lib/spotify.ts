import { env } from "./env";
import type {
  PlaybackState,
  CurrentlyPlayingType,
  PlaybackCommand,
  PlaybackControlCapabilities,
  QueueTrack,
} from "./types";
import type { SessionData } from "./session";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const PLAYER_URL =
  "https://api.spotify.com/v1/me/player?additional_types=track,episode";
const QUEUE_URL = "https://api.spotify.com/v1/me/player/queue";

/** Thrown when the user must re-authenticate (refresh failed / token revoked). */
export class SpotifyAuthError extends Error {
  constructor(message = "Spotify authentication required") {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

/** Thrown when Spotify returns 403 — typically the dev-mode 5-user cap. */
export class SpotifyForbiddenError extends Error {
  constructor(message = "Spotify access forbidden") {
    super(message);
    this.name = "SpotifyForbiddenError";
  }
}

/** Thrown on 429 so the client can honour Retry-After. */
export class SpotifyRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Spotify rate limited");
    this.name = "SpotifyRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class SpotifyNoActiveDeviceError extends Error {
  constructor(message = "No active Spotify device") {
    super(message);
    this.name = "SpotifyNoActiveDeviceError";
  }
}

export class SpotifyPremiumRequiredError extends Error {
  constructor(message = "Spotify Premium is required for playback controls") {
    super(message);
    this.name = "SpotifyPremiumRequiredError";
  }
}

export class SpotifyInsufficientScopeError extends Error {
  constructor(message = "Spotify playback-control permission is missing") {
    super(message);
    this.name = "SpotifyInsufficientScopeError";
  }
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

function basicAuthHeader(): string {
  const creds = `${env.spotifyClientId}:${env.spotifyClientSecret}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

/** Exchange an authorization code (with PKCE verifier) for tokens. */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<SessionData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    // Must be byte-for-byte the redirect_uri sent to /authorize.
    redirect_uri: redirectUri,
    client_id: env.spotifyClientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Confidential client: also send the secret (docs/05 §5.3 step 5).
      Authorization: basicAuthHeader(),
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as SpotifyTokenResponse;
  if (!json.refresh_token) {
    throw new Error("Token exchange did not return a refresh_token");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/**
 * Refresh the access token. PKCE refresh responses MAY rotate the refresh
 * token; we persist the new one when present (docs/05 §5.4 — a classic gotcha).
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<SessionData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.spotifyClientId,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    // 400/401 here means the refresh token is revoked/expired → re-login.
    throw new SpotifyAuthError(`Refresh failed (${res.status})`);
  }

  const json = (await res.json()) as SpotifyTokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken, // keep old if not rotated
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/**
 * Ensure the session has a valid access token, refreshing proactively at
 * ~T-60s (docs/05 §5.4). Returns the (possibly updated) session and whether it
 * changed (so the caller can re-seal the cookie).
 */
export async function ensureFreshSession(
  session: SessionData,
): Promise<{ session: SessionData; changed: boolean }> {
  const skewMs = 60_000;
  if (Date.now() < session.expiresAt - skewMs) {
    return { session, changed: false };
  }
  const refreshed = await refreshAccessToken(session.refreshToken);
  return { session: refreshed, changed: true };
}

/* ── Spotify raw response shapes (only the fields we read) ────────────────── */

interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}
interface SpotifyArtist {
  name: string;
}
interface SpotifyTrackItem {
  id: string;
  type?: string;
  name: string;
  duration_ms: number;
  artists?: SpotifyArtist[];
  album?: { name: string; images?: SpotifyImage[] };
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  // Episode shape overlaps loosely; we guard on currently_playing_type.
  images?: SpotifyImage[];
  show?: { name: string };
}
interface SpotifyPlayerResponse {
  is_playing: boolean;
  progress_ms: number | null;
  timestamp: number;
  currently_playing_type: string;
  item: SpotifyTrackItem | null;
  device?: {
    id?: string | null;
    name?: string;
    is_restricted?: boolean;
  } | null;
  actions?: {
    disallows?: {
      pausing?: boolean;
      resuming?: boolean;
      skipping_next?: boolean;
      skipping_prev?: boolean;
    };
  } | null;
}

interface SpotifyQueueResponse {
  queue?: SpotifyTrackItem[];
}

const IDLE: PlaybackState = {
  isActive: false,
  isPlaying: false,
  type: "unknown",
  progressMs: 0,
  durationMs: 0,
  trackId: null,
  title: null,
  artists: null,
  album: null,
  albumArtUrl: null,
  spotifyUrl: null,
  isrc: null,
  deviceId: null,
  deviceName: null,
  controlCapabilities: {
    play: false,
    pause: false,
    next: false,
    previous: false,
  },
};

function getControlCapabilities(
  data: SpotifyPlayerResponse,
): PlaybackControlCapabilities {
  if (
    !data.device ||
    data.device.is_restricted ||
    data.currently_playing_type === "ad"
  ) {
    return { play: false, pause: false, next: false, previous: false };
  }

  const disallows = data.actions?.disallows;
  return {
    play: !disallows?.resuming,
    pause: !disallows?.pausing,
    next: !disallows?.skipping_next,
    previous: !disallows?.skipping_prev,
  };
}

function pickArt(images?: SpotifyImage[]): string | null {
  if (!images || images.length === 0) return null;
  // Prefer a mid-size image (~300px) for a fast load on the Tesla connection.
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const mid = sorted.find((i) => (i.width ?? 0) >= 200) ?? sorted[sorted.length - 1];
  return mid?.url ?? null;
}

function normalizeType(raw: string): CurrentlyPlayingType {
  if (raw === "track" || raw === "episode" || raw === "ad") return raw;
  return "unknown";
}

/**
 * Fetch and normalise the current playback state.
 *
 * `progressMs` is latency-corrected here using Spotify's `timestamp`: we add
 * the time elapsed since Spotify captured the state, but only while playing
 * (docs/06 §6.2). The client then re-anchors on receipt.
 */
export async function fetchPlayback(accessToken: string): Promise<PlaybackState> {
  const res = await fetch(PLAYER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  // 204 = nothing playing / no active device → idle (docs/06 §6.1).
  if (res.status === 204) return IDLE;

  if (res.status === 401) throw new SpotifyAuthError();
  if (res.status === 403) throw new SpotifyForbiddenError();
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") ?? "5");
    throw new SpotifyRateLimitError(Number.isFinite(retry) ? retry : 5);
  }
  if (!res.ok) {
    throw new Error(`Spotify /me/player error: ${res.status}`);
  }

  const text = await res.text();
  if (!text) return IDLE; // some clients send 200 with empty body when idle
  const data = JSON.parse(text) as SpotifyPlayerResponse;

  const type = normalizeType(data.currently_playing_type);
  const item = data.item;

  // Progress.
  //
  // We deliberately do NOT apply Spotify's `timestamp` to "latency-correct"
  // progress_ms. Although documented as "when data was fetched", in practice
  // `timestamp` is frequently STALE (it reflects when the play context last
  // changed, not when progress_ms was sampled) and it's the Spotify *server*
  // clock, which can be skewed from ours. Adding `Date.now() - timestamp`
  // therefore pushed progress seconds ahead of reality, so lyrics highlighted
  // early. Instead we pass progress_ms through as-is and let the CLIENT advance
  // it from its own receive time (usePlayback's anchor + LyricsView's rAF
  // clock), which is precise and never runs ahead. A small constant lead in
  // LyricsView (LYRIC_LEAD_MS) compensates for the sub-second fetch latency.
  const baseProgress = data.progress_ms ?? 0;
  const durationMs = item?.duration_ms ?? 0;
  const progressMs = Math.min(baseProgress, durationMs || Infinity);

  if (!item) {
    // is_playing true but item null — rare transient (edge case #31). Treat as
    // active-but-unknown so the client keeps last lyrics rather than blanking.
    return {
      ...IDLE,
      isActive: true,
      isPlaying: data.is_playing,
      type,
    };
  }

  const isEpisode = type === "episode";
  const albumArtUrl = isEpisode
    ? pickArt(item.images)
    : pickArt(item.album?.images);

  return {
    isActive: true,
    isPlaying: data.is_playing,
    type,
    progressMs,
    durationMs,
    trackId: item.id ?? null,
    title: item.name ?? null,
    artists: item.artists?.map((a) => a.name).join(", ") ?? (item.show?.name ?? null),
    album: item.album?.name ?? null,
    albumArtUrl,
    spotifyUrl: item.external_urls?.spotify ?? null,
    isrc: item.external_ids?.isrc ?? null,
    deviceId: data.device?.id ?? null,
    deviceName: data.device?.name ?? null,
    controlCapabilities: getControlCapabilities(data),
  };
}

/** Fetch a compact, track-only queue for the auto-hiding Next Up display. */
export async function fetchQueue(accessToken: string): Promise<QueueTrack[]> {
  const res = await fetch(QUEUE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) throw new SpotifyAuthError();
  if (res.status === 403) throw new SpotifyForbiddenError();
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") ?? "5");
    throw new SpotifyRateLimitError(Number.isFinite(retry) ? retry : 5);
  }
  if (!res.ok) throw new Error(`Spotify /me/player/queue error: ${res.status}`);

  const data = (await res.json()) as SpotifyQueueResponse;
  return (data.queue ?? [])
    .filter((item) => item.type === "track" || !!item.artists?.length)
    .slice(0, 5)
    .map((item) => ({
      trackId: item.id,
      title: item.name,
      artists: item.artists?.map((artist) => artist.name).join(", ") ?? "",
      album: item.album?.name ?? null,
      albumArtUrl: pickArt(item.album?.images),
      durationMs: item.duration_ms,
      spotifyUrl: item.external_urls?.spotify ?? null,
      isrc: item.external_ids?.isrc ?? null,
    }));
}

/** Send a small, passenger-facing command to the currently active device. */
export async function sendPlaybackCommand(
  accessToken: string,
  command: PlaybackCommand,
  deviceId?: string,
): Promise<void> {
  const path: Record<PlaybackCommand, string> = {
    play: "play",
    pause: "pause",
    next: "next",
    previous: "previous",
  };
  const method = command === "play" || command === "pause" ? "PUT" : "POST";
  const url = new URL(`https://api.spotify.com/v1/me/player/${path[command]}`);
  if (deviceId) url.searchParams.set("device_id", deviceId);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) throw new SpotifyAuthError();
  if (res.status === 403) {
    const detail = await readSpotifyErrorMessage(res);
    if (/premium/i.test(detail)) throw new SpotifyPremiumRequiredError();
    if (/scope|permission/i.test(detail)) {
      throw new SpotifyInsufficientScopeError();
    }
    throw new SpotifyForbiddenError(detail || undefined);
  }
  if (res.status === 404) throw new SpotifyNoActiveDeviceError();
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") ?? "5");
    throw new SpotifyRateLimitError(Number.isFinite(retry) ? retry : 5);
  }
  if (!res.ok) {
    throw new Error(`Spotify playback command error: ${res.status}`);
  }
}

async function readSpotifyErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: unknown } | string;
  } | null;
  if (typeof body?.error === "string") return body.error;
  return typeof body?.error?.message === "string" ? body.error.message : "";
}
