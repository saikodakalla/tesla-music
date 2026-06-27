import { readSession } from "@/lib/session";
import LoginScreen from "@/components/LoginScreen";
import Player from "@/components/Player";

export const dynamic = "force-dynamic";

/**
 * Home. Server component: checks the httpOnly session cookie so there's no
 * flash of the wrong screen on load. If a session survived a Tesla browser
 * reboot, we go straight into the player and resume (docs/10 #20).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: { auth_error?: string };
}) {
  const session = await readSession();

  if (!session) {
    return <LoginScreen authError={searchParams.auth_error} />;
  }

  return <Player />;
}
