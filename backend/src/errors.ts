// Communica backend — shared error type (Step 7 skeleton).
// No external dependency. HTTP status codes match ALGORITHMS.md exactly.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** 401 — missing, expired, or invalid JWT (ALGORITHMS: AUTH). */
export function unauthenticated(): ApiError {
  return new ApiError(401, "unauthenticated", "unauthenticated");
}

/** 403 — authenticated but not allowed (e.g. not a chat member, not a group admin). */
export function forbidden(message: string): ApiError {
  return new ApiError(403, "forbidden", message);
}

/** 400 — request payload or state is invalid. */
export function badRequest(message: string): ApiError {
  return new ApiError(400, "bad_request", message);
}

/** 404 — row not found (also used for expired statuses, which are
 *  indistinguishable from missing ones per ALGORITHMS §9). */
export function notFound(message: string): ApiError {
  return new ApiError(404, "not_found", message);
}

/** 409 — uniqueness conflict (username taken, already a member). */
export function conflict(message: string): ApiError {
  return new ApiError(409, "conflict", message);
}
