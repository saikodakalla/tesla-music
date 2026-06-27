import { randomBytes, createHash } from "crypto";

/**
 * PKCE (S256) helpers for the Authorization Code + PKCE flow (docs/05 §5.3).
 * Generated server-side in the /api/auth/login route; the verifier is parked in
 * a short-lived httpOnly cookie across the redirect.
 */

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** High-entropy code verifier (43–128 chars). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(64));
}

/** code_challenge = base64url(SHA256(verifier)). */
export function deriveCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** Random anti-CSRF state parameter. */
export function generateState(): string {
  return base64url(randomBytes(24));
}
