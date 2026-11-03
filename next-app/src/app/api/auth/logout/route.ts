export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { requireAuth } from "@/lib/auth";
import { blockToken } from "@/lib/token-blocklist";
import { handleError, json } from "@/lib/http";

/** POST /api/auth/logout — revokes THIS token server-side (jti
 *  blocklist until expiry). The client must also clear its stored
 *  token. LIMITATION (honest, see SECURITY.md): the blocklist is
 *  in-memory/single-process, and tokens remain in localStorage until
 *  the httpOnly-cookie hardening lands — a stolen token copied
 *  before logout is only stopped after logout is called. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const expMs = auth.exp ? auth.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
    blockToken(auth.jti, expMs);
    return json({ loggedOut: true });
  } catch (err) {
    return handleError(err);
  }
}
