import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "crypto";
import { env } from "./env";

/**
 * Stateless, encrypted session.
 *
 * The design docs (docs/05 §5.5) call for the refresh token to live
 * server-side, encrypted, never readable by browser JS. We satisfy that goal
 * *without* requiring an external database by sealing the tokens into an
 * encrypted (AES-256-GCM via JWE) **httpOnly** cookie. The browser carries an
 * opaque blob it cannot read or forge; only the server (holding SESSION_SECRET)
 * can decrypt it. This keeps the app deployable to Vercel with zero external
 * services. To move the refresh token fully off the client (true Variant B
 * server storage), swap this module for a Postgres/Redis-backed store — the
 * rest of the app is unchanged. See README "Architecture notes".
 */

const COOKIE_NAME = "tl_session";
const ALG = "dir";
const ENC = "A256GCM";

// 30 days. The Spotify refresh token (~6 months) is the hard ceiling; we keep
// the cookie long-lived to minimise re-logins on the fragile Tesla browser.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionData {
  refreshToken: string;
  accessToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

/** Derive a stable 32-byte key from the configured secret. */
function key(): Uint8Array {
  return new Uint8Array(createHash("sha256").update(env.sessionSecret).digest());
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
});

export async function sealSession(data: SessionData): Promise<string> {
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .encrypt(key());
}

export async function readSession(): Promise<SessionData | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, key());
    if (
      typeof payload.refreshToken === "string" &&
      typeof payload.accessToken === "string" &&
      typeof payload.expiresAt === "number"
    ) {
      return {
        refreshToken: payload.refreshToken,
        accessToken: payload.accessToken,
        expiresAt: payload.expiresAt,
      };
    }
    return null;
  } catch {
    // Tampered, expired, or secret rotated → treat as logged out.
    return null;
  }
}

/** Write the session onto a response's cookies. */
export async function writeSession(data: SessionData): Promise<void> {
  const sealed = await sealSession(data);
  cookies().set(COOKIE_NAME, sealed, cookieOptions());
}

export function clearSession(): void {
  cookies().set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
}

/** Short-lived httpOnly cookies that carry PKCE state across the redirect. */
export const PKCE_VERIFIER_COOKIE = "tl_pkce_verifier";
export const OAUTH_STATE_COOKIE = "tl_oauth_state";
// The exact redirect_uri sent to /authorize must be replayed verbatim at the
// token exchange, so we carry it across the round-trip rather than re-deriving.
export const OAUTH_REDIRECT_URI_COOKIE = "tl_oauth_redirect_uri";

export function setOAuthTransientCookies(
  verifier: string,
  state: string,
  redirectUri: string,
): void {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10, // 10 minutes is plenty for a login round-trip
  };
  cookies().set(PKCE_VERIFIER_COOKIE, verifier, opts);
  cookies().set(OAUTH_STATE_COOKIE, state, opts);
  cookies().set(OAUTH_REDIRECT_URI_COOKIE, redirectUri, opts);
}

export function readOAuthTransientCookies(): {
  verifier: string | null;
  state: string | null;
  redirectUri: string | null;
} {
  return {
    verifier: cookies().get(PKCE_VERIFIER_COOKIE)?.value ?? null,
    state: cookies().get(OAUTH_STATE_COOKIE)?.value ?? null,
    redirectUri: cookies().get(OAUTH_REDIRECT_URI_COOKIE)?.value ?? null,
  };
}

export function clearOAuthTransientCookies(): void {
  cookies().set(PKCE_VERIFIER_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  cookies().set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  cookies().set(OAUTH_REDIRECT_URI_COOKIE, "", { path: "/", maxAge: 0 });
}
