import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify";
import {
  readOAuthTransientCookies,
  clearOAuthTransientCookies,
  writeSession,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * OAuth redirect target. Spotify sends `code` + `state` here. We validate
 * `state` (CSRF defence, docs/05 §5.3 step 4), exchange the code for tokens
 * server-side (secret + PKCE verifier), seal them into the session cookie, and
 * redirect back to the app. Errors land on the home page with a reason.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const home = new URL("/", url.origin);

  if (error) {
    home.searchParams.set("auth_error", error);
    return redirectClearing(home);
  }

  const { verifier, state: savedState } = readOAuthTransientCookies();

  if (!code || !state || !savedState || !verifier) {
    home.searchParams.set("auth_error", "missing_params");
    return redirectClearing(home);
  }
  if (state !== savedState) {
    home.searchParams.set("auth_error", "state_mismatch");
    return redirectClearing(home);
  }

  try {
    const session = await exchangeCodeForTokens(code, verifier);
    await writeSession(session);
    clearOAuthTransientCookies();
    return NextResponse.redirect(home.toString());
  } catch {
    home.searchParams.set("auth_error", "exchange_failed");
    return redirectClearing(home);
  }
}

function redirectClearing(to: URL): NextResponse {
  clearOAuthTransientCookies();
  return NextResponse.redirect(to.toString());
}
