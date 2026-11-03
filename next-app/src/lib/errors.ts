// Step 3 — shared API error type, mirroring backend/src/errors.ts exactly.
// HTTP status codes match ALGORITHMS.md. No route may leak internals:
// unknown errors map to 500 "internal_error" (see http.ts).
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
export function unauthenticated(): ApiError {
  return new ApiError(401, "unauthenticated", "unauthenticated");
}
export function forbidden(message: string): ApiError {
  return new ApiError(403, "forbidden", message);
}
export function badRequest(message: string): ApiError {
  return new ApiError(400, "bad_request", message);
}
export function notFound(message: string): ApiError {
  return new ApiError(404, "not_found", message);
}
export function conflict(message: string): ApiError {
  return new ApiError(409, "conflict", message);
}
export function serviceUnavailable(message: string): ApiError {
  return new ApiError(503, "db_unavailable", message);
}
