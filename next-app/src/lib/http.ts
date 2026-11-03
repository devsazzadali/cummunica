// Step 3 — small HTTP helpers for App Router route handlers.
import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Map any thrown error to an honest JSON error body. Never leaks
 *  stack traces or DB internals. Prisma unique-constraint (P2002)
 *  maps to 409 conflict; other Prisma errors map to 500. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  const anyErr = err as { code?: string; message?: string };
  if (anyErr && anyErr.code === "P2002") {
    return NextResponse.json(
      { error: "conflict", message: "a record with that unique value already exists" },
      { status: 409 },
    );
  }
  try { console.error("internal_error", err); } catch {}
  return NextResponse.json({ error: "internal_error", message: "internal error — please try again, and tell us which page and action failed if it keeps happening" }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
