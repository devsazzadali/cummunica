export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { badRequest, notFound } from "@/lib/errors";
import { handleError, json, readJson, asString } from "@/lib/http";
import {
  AI_LABEL, BOYFRIEND_DEFAULT_CALL_NAME, GIRLFRIEND_PRESET_CALL_NAMES,
  aiIntroduction, plainMemoryFromText, sazmuTemplateReply,
  type CompanionSetting,
} from "@/lib/sazmu";

/** GET /api/sazmu — the caller's companion setting, or 404 when not
 *  set up yet. SAZMU AI is always labelled AI, never a real human. */
export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const setting = await prisma.companionSetting.findUnique({ where: { userId: auth.userId } });
    if (setting === null) throw notFound("companion not set up yet");
    return json({
      setting: {
        role: setting.role, callName: setting.callName, petName: setting.petName,
        tone: setting.tone, language: setting.language,
      },
      aiLabel: AI_LABEL,
      girlfriendPresets: GIRLFRIEND_PRESET_CALL_NAMES,
    });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/sazmu
 *  - setup: { action:"setup", role, callName?, petName?, language? }
 *    Boyfriend with no call name defaults to Sazzad; Girlfriend with
 *    no call name is rejected (no girlfriend default is invented).
 *  - chat: { text, isFirstMessage? } => template reply only.
 *    LLM-PROXY SHAPE, LLM NOT CALLED in this step: the provider is
 *    unchosen, so the server-side key (if any) is never used and no
 *    key appears in frontend code. Response is always labelled
 *    template (isTemplate:true) with the AI label, and general
 *    questions get the honest-unknown fallback, never an invented
 *    fact. Safety order (distress > sexual > boundary) is preserved. */
export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    const prisma = getPrisma();
    const body = await readJson(request);

    if (body.action === "setup") {
      const role = asString(body.role);
      if (role !== "Boyfriend" && role !== "Girlfriend") throw badRequest("role is invalid");
      let callName = asString(body.callName).trim();
      if (callName === "" && role === "Boyfriend") callName = BOYFRIEND_DEFAULT_CALL_NAME;
      if (callName === "") throw badRequest("please pick or type a call name");
      const language = ["Bengali", "Banglish", "English"].includes(asString(body.language)) ? asString(body.language) : "Bengali";
      const setting = await prisma.companionSetting.upsert({
        where: { userId: auth.userId },
        update: { role: role as "Boyfriend" | "Girlfriend", callName, petName: typeof body.petName === "string" ? body.petName : null, tone: asString(body.tone) || "soft", language },
        create: { userId: auth.userId, role: role as "Boyfriend" | "Girlfriend", callName, petName: typeof body.petName === "string" ? body.petName : null, tone: asString(body.tone) || "soft", language },
      });
      return json({ setting: { role: setting.role, callName: setting.callName, petName: setting.petName, tone: setting.tone, language: setting.language }, aiLabel: AI_LABEL });
    }

    const text = asString(body.text);
    if (text.trim() === "") throw badRequest("text is required");
    const settingRow = await prisma.companionSetting.findUnique({ where: { userId: auth.userId } });
    if (settingRow === null) throw badRequest("companion not set up yet");
    const settings: CompanionSetting = {
      role: settingRow.role, callName: settingRow.callName, petName: settingRow.petName,
      tone: settingRow.tone, language: settingRow.language,
    };
    // Memory first (plain stated facts only, own user only), then reply.
    const plain = plainMemoryFromText(text);
    if (plain !== null) {
      await prisma.userMemory.upsert({
        where: { userId_key: { userId: auth.userId, key: plain.key } },
        update: { value: plain.value },
        create: { userId: auth.userId, key: plain.key, value: plain.value },
      });
    }
    // Candidate memory keys only (small, own-user only); the reply
    // function picks the keys relevant to the matched intent.
    const memoryRows = await prisma.userMemory.findMany({
      where: { userId: auth.userId, key: { in: ["favourite_food", "food_allergy", "food_preference", "job", "routine", "favourite_place", "mood_note", "favourite_song"] } },
    });
    const reply = sazmuTemplateReply(settings, text, memoryRows.map((m) => ({ key: m.key, value: m.value })), body.isFirstMessage === true);
    return json({ reply, aiIntroduction: aiIntroduction(settings), llmUsed: false, llmConfigured: false });
  } catch (err) {
    return handleError(err);
  }
}
