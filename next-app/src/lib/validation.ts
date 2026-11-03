// Step 3 — validation helpers shared by routes and unit tests.
import { badRequest, forbidden } from "./errors";
import { MEDIA_MIMES_BY_KIND } from "./media";

/** Message send validation (ALGORITHMS §4, via backend/src/messages.ts).
 *  F10: media messages must reference a /uploads/ URL produced by
 *  /api/media (never an arbitrary external URL, exactly as status
 *  media and profile avatars already require), and mediaMime — which
 *  /api/media returns from the validated upload — must belong to the
 *  message type (FILE: any allowlisted upload MIME). */
export function validateSendMessage(input: {
  type: string;
  text?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
}): void {
  const validTypes = ["TEXT", "PHOTO", "VOICE", "VIDEO", "FILE", "SYSTEM"];
  if (!validTypes.includes(input.type)) throw badRequest("message type is invalid");
  if (input.type === "TEXT" && (input.text === undefined || input.text === null || input.text.trim() === "")) {
    throw badRequest("text message must not be empty");
  }
  if (["PHOTO", "VOICE", "VIDEO", "FILE"].includes(input.type)) {
    if (input.mediaUrl === undefined || input.mediaUrl === null || input.mediaUrl === "") {
      throw badRequest("media message requires an uploaded file");
    }
    const isUpload = input.mediaUrl.startsWith("/uploads/");
    const isDataUrl = input.mediaUrl.startsWith("data:image/") || input.mediaUrl.startsWith("data:audio/") || input.mediaUrl.startsWith("data:video/");
    if (!isUpload && !isDataUrl) {
      throw badRequest("media message must use an uploaded /uploads/ file or a data URL from our own system");
    }
    if (isDataUrl && input.mediaUrl.length > 8000000) {
      throw badRequest("media file is too large for in-app storage (max about 5 MB)");
    }
    const allowed = MEDIA_MIMES_BY_KIND[input.type];
    if (input.mediaMime === undefined || input.mediaMime === null || input.mediaMime === "" || !allowed.includes(input.mediaMime)) {
      throw badRequest("media type does not match the message type");
    }
  }
}

/** Call gate predicate (ALGORITHMS §7, via backend/src/calls.ts):
 *  a call is allowed ONLY when the callee accepted the caller and
 *  the caller is not blocked. A missing gate row means no call. */
export function callGateAllows(
  gate: { accepted: boolean; isBlocked: boolean } | null,
): boolean {
  return gate !== null && gate.accepted && !gate.isBlocked;
}
export function requireCallGate(gate: { accepted: boolean; isBlocked: boolean } | null): void {
  if (!callGateAllows(gate)) throw forbidden("calls are only allowed to accepted contacts");
}

/** User-search rule (ALGORITHMS §2): an exact 8-digit query is an ID
 *  lookup only — partial IDs are rejected, never searched as prefix. */
export function searchKind(query: string): "empty" | "id" | "username" {
  const q = query.trim();
  if (q === "") return "empty";
  if (/^[0-9]{8}$/.test(q)) return "id";
  return "username";
}

/** Length caps enforced server-side on every write route. */
export function validateLengths(input: { text?: string | null; title?: string | null; displayName?: string | null; bio?: string | null }): void {
  if (input.text !== undefined && input.text !== null && input.text.length > 4000) throw badRequest("message text is too long (max 4000 characters)");
  if (input.title !== undefined && input.title !== null && input.title.length > 50) throw badRequest("group name is too long (max 50 characters)");
  if (input.displayName !== undefined && input.displayName !== null && (input.displayName.trim() === "" || input.displayName.length > 50)) throw badRequest("display name must be 1-50 characters");
  if (input.bio !== undefined && input.bio !== null && input.bio.length > 200) throw badRequest("about text is too long (max 200 characters)");
}
