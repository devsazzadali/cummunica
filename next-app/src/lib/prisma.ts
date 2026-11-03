// Step 3 — Prisma Client singleton, LAZY.
// The client is only constructed on the first getPrisma() call, i.e.
// at request time inside a route handler — never at module import and
// never during `next build`. Construction alone does not connect;
// Prisma connects on the first query, so `npm run build` never needs
// a live DB. DATABASE_URL / DIRECT_URL come from the deployment
// environment at runtime only; no real value is written in any file.
// If DATABASE_URL is absent at request time, callers get a 503
// db_not_configured error (honest failure, never a fake success).
import { PrismaClient } from "@prisma/client";
import { ApiError } from "./errors";

declare global {
  // eslint-disable-next-line no-var
  var __communicaPrisma: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new ApiError(
      503,
      "db_not_configured",
      "database is not configured in this environment (DATABASE_URL missing at runtime)",
    );
  }
  if (!globalThis.__communicaPrisma) {
    globalThis.__communicaPrisma = new PrismaClient();
  }
  return globalThis.__communicaPrisma;
}
