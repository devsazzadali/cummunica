export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { promises as fs } from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { ApiError, badRequest } from "@/lib/errors";
import { handleError, json } from "@/lib/http";
import { safeUploadFilename, sniffUpload, validateUpload } from "@/lib/media";

/** POST /api/media — authenticated multipart upload to server storage
 *  (public/uploads). Validated mime + size (see lib/media.ts caps),
 *  safe filename only — user input never becomes a path. F11: the
 *  file's content bytes are sniffed server-side (sniffUpload) and
 *  must match the declared MIME — the client-supplied file.type is
 *  never trusted on its own, and the stored extension is forced
 *  from the validated MIME, so a sniffed type and its extension
 *  cannot disagree. Response honestly reports
 *  storage:"server-local"; S3/object storage is the production
 *  follow-up (SECURITY.md), NOT claimed here.
 *  A successful upload is NOT a sent message: the caller must still
 *  POST /api/messages with the returned url. */
export async function POST(request: Request) {
  try {
    requireAuth(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("file is required");
    const { kind, ext } = validateUpload(file.type, file.size);
    const buf = Buffer.from(await file.arrayBuffer());
    sniffUpload(new Uint8Array(buf), file.type);
    const name = safeUploadFilename(file.name, ext);
    const dir = path.join(process.cwd(), "public", "uploads");
    try { await fs.mkdir(dir, { recursive: true }); } catch { throw new ApiError(503, "storage_unavailable", "media storage is not available on this host — the app will store small files in its own database instead"); }
    // Defence in depth: the joined path must stay inside uploads/.
    const dest = path.join(dir, name);
    if (!dest.startsWith(dir + path.sep)) throw badRequest("invalid filename");
    try { await fs.writeFile(dest, buf); } catch { throw new ApiError(503, "storage_unavailable", "media storage is not available on this host — the app will store small files in its own database instead"); }
    return json({ url: `/uploads/${name}`, mime: file.type, size: file.size, kind, storage: "server-local" }, 201);
  } catch (err) {
    return handleError(err);
  }
}
