// Customer support — shared constants + validation (Workstream 2, 2026-11-03).
// Categories are the exact values the ticket form offers and the API
// accepts; anything else is a 400. Length caps are enforced server-side
// on every write, and mirrored client-side on /support (never instead).
import { badRequest, forbidden } from "./errors";

export const SUPPORT_CATEGORIES = ["login/account", "chats", "calls", "SAZMU", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  "login/account": "Login / account",
  chats: "Chats",
  calls: "Calls",
  SAZMU: "SAZMU AI",
  other: "Other",
};

export const SUPPORT_STATUSES = ["Open", "InProgress", "Resolved"] as const;
export type SupportTicketStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  Open: "Open",
  InProgress: "In progress",
  Resolved: "Resolved",
};

export const MAX_TICKET_SUBJECT = 150;
export const MIN_TICKET_SUBJECT = 3;
export const MAX_TICKET_MESSAGE = 4000;
export const MIN_TICKET_MESSAGE = 10;
export const MAX_REPLY_BODY = 4000;

export function validateTicketInput(input: Record<string, unknown>): {
  category: SupportCategory;
  subject: string;
  message: string;
} {
  const category = typeof input.category === "string" ? input.category : "";
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) {
    throw badRequest("category must be one of: login/account, chats, calls, SAZMU, other");
  }
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  if (subject.length < MIN_TICKET_SUBJECT || subject.length > MAX_TICKET_SUBJECT) {
    throw badRequest(`subject must be ${MIN_TICKET_SUBJECT}-${MAX_TICKET_SUBJECT} characters`);
  }
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (message.length < MIN_TICKET_MESSAGE || message.length > MAX_TICKET_MESSAGE) {
    throw badRequest(`message must be ${MIN_TICKET_MESSAGE}-${MAX_TICKET_MESSAGE} characters`);
  }
  return { category: category as SupportCategory, subject, message };
}

export function validateReplyInput(input: Record<string, unknown>): { body: string; status: SupportTicketStatus | null } {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body === "" || body.length > MAX_REPLY_BODY) {
    throw badRequest(`reply must be 1-${MAX_REPLY_BODY} characters`);
  }
  if (input.status === undefined || input.status === null || input.status === "") return { body, status: null };
  if (typeof input.status !== "string" || !(SUPPORT_STATUSES as readonly string[]).includes(input.status)) {
    throw badRequest("status must be one of: Open, InProgress, Resolved");
  }
  return { body, status: input.status as SupportTicketStatus };
}

/** INTERIM admin gate (documented, fails closed):
 *  The admin-dashboard Phase 4/5 will replace this with a User.role
 *  gate. Until then, NO role field exists, so the only check available
 *  is: the caller's stored DB email must equal the deploy-time env
 *  var SUPER_ADMIN_EMAIL. NO email address is hardcoded anywhere —
 *  the value comes only from the deployment environment. If the env
 *  var is absent/empty, or the caller has no email, or the emails
 *  differ (case-insensitive), this throws 403. It NEVER opens access.
 *  This gate grants NO access to private chats, which admins must
 *  never read. requireInterimAdmin is the shared form (used by the
 *  theme default-setting endpoint too); requireInterimSupportAdmin
 *  keeps the exact support message for the ticket-reply endpoint. */
export function requireInterimAdmin(callerEmail: string | null, denialMessage: string): void {
  const configured = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (configured === "") {
    throw forbidden("admin is not configured in this environment");
  }
  if (callerEmail === null || callerEmail.trim().toLowerCase() !== configured) {
    throw forbidden(denialMessage);
  }
}

export function requireInterimSupportAdmin(callerEmail: string | null): void {
  requireInterimAdmin(callerEmail, "only the support admin can reply to tickets");
}
