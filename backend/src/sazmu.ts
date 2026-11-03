// Communica backend — SAZMU AI proxy design (Step 7 skeleton).
// Implements ALGORITHMS §5. Pipeline order is FIXED and can never be
// skipped or reordered: SAFETY FIRST, then language, then intent,
// then memory, then generation, then fallback.
//
// IDENTITY RULE (applies to every reply): SAZMU AI is ALWAYS labelled
// "AI — not a human". It is a system contact, NOT a row in User. It
// never presents as a real person. Every introduction says so, and
// every reply carries aiLabel=true for the client to render.
//
// DATA RULE: replies use ONLY this user's own data — User profile
// fields plus UserMemory rows the user consented to. Never scraped
// private chats, never another person's data. The user can delete
// their memories at any time (deleteMemories below).
//
// LLM RULE: the frontend NEVER calls the LLM provider directly. The
// provider key lives server-side only (env var names LLM_PROVIDER /
// LLM_API_KEY — values never in any file) and is used only by the
// injected LlmClient. When no LLM is configured, template replies are
// used and MUST be labelled as templates, not as generative AI output.
//
// SKELETON HONESTY:
// - Safety and intent matching here are keyword lists, not a trained
//   classifier. They are the correct ORDER and the correct fallback
//   behaviour, but production should replace the keyword checks with
//   a proper classifier + the provider's safety filters, keeping the
//   same order and the same never-diagnose / never-erotic guarantees.
// - Template replies below are short skeletons, not the full Phase 1
//   reply tables (replies.js in the demo). Wiring must keep the
//   template label until the LLM backend exists.

import type {
  CompanionRole,
  CompanionSettingRecord,
  UserMemoryRecord,
  UserRecord,
} from "./types";
import { badRequest, notFound } from "./errors";

/** Exact label wording from the plan: always "AI — not a human". */
export const AI_LABEL = "SAZMU AI — AI, not a human";

/** Boyfriend default call name (user decision, fixed). */
export const BOYFRIEND_DEFAULT_CALL_NAME = "Sazzad";

/** Girlfriend preset call names (user-given) + custom option. */
export const GIRLFRIEND_PRESET_CALL_NAMES: string[] = [
  "Sadia",
  "Maria",
  "Tithi",
  "Borsha",
  "Anika",
  "Tajmira",
  "Mim",
  "Mimi",
  "Mumu",
  "Ayra",
  "Jannati",
  "Mushfika",
];
// NOTE: "Mumu" here is only a girlfriend call-name option, not the
// app brand. The brand/model name is SAZMU AI. No girlfriend DEFAULT
// name is invented: a Girlfriend setup with no call name is rejected.

export type SazmuLanguage = "Bengali" | "Banglish" | "English";
export type SazmuIntent =
  | "greeting"
  | "how-are-you"
  | "evening-plans"
  | "what-to-eat"
  | "dreams"
  | "missing-you"
  | "comfort"
  | "celebration"
  | "planning"
  | "teasing"
  | "romantic-poetry"
  | "general-question"
  | "unknown";

export type SazmuReplySource =
  | "safety"
  | "template"
  | "llm"
  | "honest-unknown";

export interface SazmuReply {
  text: string;
  /** Always true: the client must render the AI label with the reply. */
  aiLabel: true;
  source: SazmuReplySource;
  language: SazmuLanguage;
  intent: SazmuIntent;
  /** True only when source="template": the reply is a template, NOT
   *  generative AI output. The client must not claim otherwise. */
  isTemplate: boolean;
}

/** Narrow Db surface this module needs (production: Prisma Client). */
export interface SazmuDb {
  findCompanionSetting(userId: string): Promise<CompanionSettingRecord | null>;
  upsertCompanionSetting(input: {
    userId: string;
    role: CompanionRole;
    callName: string;
    petName: string | null;
    tone: string;
    language: string;
  }): Promise<CompanionSettingRecord>;
  findMemoriesByKeys(userId: string, keys: string[]): Promise<UserMemoryRecord[]>;
  upsertMemory(userId: string, key: string, value: string): Promise<UserMemoryRecord>;
  deleteAllMemories(userId: string): Promise<void>;
}

/**
 * LLM client adapter. Production implements this over HTTPS with the
 * provider key read server-side from the secure vault. The frontend
 * never sees this object, the key, or the provider request.
 */
export interface LlmClient {
  generate(input: {
    role: CompanionRole;
    callName: string;
    petName: string | null;
    tone: string;
    language: SazmuLanguage;
    intent: SazmuIntent;
    memories: UserMemoryRecord[];
    displayName: string;
    userText: string;
  }): Promise<string>;
}

/** Validate + save companion setup (SAZMU Setup screen, Step 5/6 UI).
 *  Boyfriend with no call name defaults to Sazzad; Girlfriend with no
 *  call name is rejected (no girlfriend default is invented). */
export async function saveCompanionSetting(
  db: SazmuDb,
  userId: string,
  input: {
    role: CompanionRole;
    callName: string;
    petName?: string | null;
    tone?: string;
    language?: SazmuLanguage;
  },
): Promise<CompanionSettingRecord> {
  let callName = input.callName.trim();
  if (callName === "" && input.role === "Boyfriend") {
    callName = BOYFRIEND_DEFAULT_CALL_NAME;
  }
  if (callName === "") {
    throw badRequest("please pick or type a call name");
  }
  return db.upsertCompanionSetting({
    userId,
    role: input.role,
    callName,
    petName: input.petName ?? null,
    tone: input.tone ?? "soft", // Schema default.
    language: input.language ?? "Bengali", // Schema default.
  });
}

/** ALGORITHMS §5b: Bengali = Bengali-script characters present;
 *  Banglish = Latin script + Bengali words; else English. */
export function detectLanguage(text: string): SazmuLanguage {
  if (/[\u0980-\u09FF]/.test(text)) return "Bengali";
  const lower = text.toLowerCase();
  const banglishWords = [
    "ami", "tumi", "kemon", "valo", "bhalo", "acho", "acho?", "aj", "kal",
    "khub", "ektu", "ki", "korcho", "kotha", "bhalobashi", "shuvo", "sokal",
    "rat", "bikel", "khabar", "mon", "miss",
  ];
  if (banglishWords.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) {
    return "Banglish";
  }
  return "English";
}

// --- §5a SAFETY FIRST (keyword skeleton; see header note) ---

const DISTRESS_SIGNALS = [
  "suicide", "kill myself", "self-harm", "self harm", "hurt myself",
  "i want to die", "mor te chai", "more jete chai",
];
const SEXUAL_SIGNALS = [
  "sex", "nude", "naked", "kiss me hard", "touch me",
];
const BOUNDARY_SIGNALS = [
  "stop", "don't say that", "dont say that", "leave me alone",
  "bondho koro", "thamo", "ar bolona",
];

function containsAny(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some((signal) => lower.includes(signal));
}

export type SafetyHit = "distress" | "sexual" | "boundary" | null;

/** Fixed order: distress, then sexual, then boundary. */
export function checkSafety(text: string): SafetyHit {
  if (containsAny(text, DISTRESS_SIGNALS)) return "distress";
  if (containsAny(text, SEXUAL_SIGNALS)) return "sexual";
  if (containsAny(text, BOUNDARY_SIGNALS)) return "boundary";
  return null;
}

function safetyReply(
  hit: Exclude<SafetyHit, null>,
  settings: CompanionSettingRecord,
  language: SazmuLanguage,
): SazmuReply {
  const name = settings.callName;
  const base: Omit<SazmuReply, "text"> = {
    aiLabel: true,
    source: "safety",
    language,
    intent: "unknown",
    isTemplate: true,
  };
  if (hit === "distress") {
    return {
      ...base,
      text:
        language === "Bengali"
          ? `Ami ${name} hishebe tomar pashe achi, kintu ami ekjon AI — manush noi, ar medical poramorsho dite parbo na. Tumi jodi khub kharap bodh koro, dayaa kore tomar kono bishwasto manush ba sthaniyo professional helpline-er sathe kotha bolo.`
          : `I'm here with you as ${name}, but I am SAZMU AI — an AI, not a human — and I can't give medical advice. If you're feeling really bad, please talk to someone you trust or a local professional helpline.`,
    };
  }
  if (hit === "sexual") {
    return {
      ...base,
      text:
        `Ami ${name} hishebe tomar sathe thakbo, kintu sexual dike jabo na. ` +
        `Cholo onno kichu niye kotha boli — ajker din, tomar mon, ba ekta kobita.`,
    };
  }
  return {
    ...base,
    text:
      `Bujhlam, ${name} hishebe ei topic-ta ekhanei thamachhi. ` +
      `Tumi ja bolbe na, ami ta ar bolbo na. Onno kichu niye kotha boli?`,
  };
}

// --- §5c intent matching (keyword skeleton, three languages) ---

const INTENT_KEYWORDS: Array<{ intent: SazmuIntent; words: string[] }> = [
  { intent: "greeting", words: ["hello", "hi", "assalamu alaikum", "salam", "nomoshkar", "hey"] },
  { intent: "how-are-you", words: ["how are you", "kemon acho", "kemon achho", "kemon", "how are u"] },
  { intent: "evening-plans", words: ["evening", "tonight", "aj sondha", "aj rat", "bikel", "sondha"] },
  { intent: "what-to-eat", words: ["what to eat", "ki khabo", "khabar", "dinner", "lunch", "biryani", "khete"] },
  { intent: "dreams", words: ["dream", "shopno", "swapno", "will my dreams come true"] },
  { intent: "missing-you", words: ["miss you", "miss korchi", "tomake miss", "i miss"] },
  { intent: "comfort", words: ["sad", "mon kharap", "tired", "klanto", "kharap lagche", "comfort"] },
  { intent: "celebration", words: ["congratulations", "happy birthday", "celebrat", "ovhinondon", "congrats"] },
  { intent: "planning", words: ["plan", "porikolpona", "tomorrow", "kal", "weekend"] },
  { intent: "teasing", words: ["tease", "moja", "funny", "hashi", "joke"] },
  { intent: "romantic-poetry", words: ["poem", "kobita", "poetry", "bhalobashi", "love you", "prem"] },
  { intent: "general-question", words: ["what is", "why", "how", "when", "keno", "kobe", "ki"] },
];

export function matchIntent(text: string): SazmuIntent {
  const lower = text.toLowerCase();
  for (const entry of INTENT_KEYWORDS) {
    if (entry.words.some((word) => lower.includes(word))) return entry.intent;
  }
  return "unknown";
}

/** ALGORITHMS §5d: memory keys relevant to each intent (own user only). */
export function relevantMemoryKeys(intent: SazmuIntent): string[] {
  switch (intent) {
    case "what-to-eat":
      return ["favourite_food", "food_allergy", "food_preference"];
    case "planning":
    case "evening-plans":
      return ["job", "routine", "favourite_place"];
    case "comfort":
    case "missing-you":
      return ["mood_note", "favourite_song"];
    default:
      return [];
  }
}

function templateReply(
  intent: SazmuIntent,
  settings: CompanionSettingRecord,
  memories: UserMemoryRecord[],
  language: SazmuLanguage,
): string {
  const pet = settings.petName !== null ? `, ${settings.petName}` : "";
  const favouriteFood = memories.find((m) => m.key === "favourite_food")?.value;
  switch (intent) {
    case "greeting":
      return `Ami ${settings.callName} — SAZMU AI, ekjon AI, manush noi. Hello${pet}! Aj kemon katlo?`;
    case "how-are-you":
      return `Ami valo achi${pet}, tomar kotha shune aro valo lagche. Tumi kemon acho?`;
    case "what-to-eat":
      return favouriteFood !== undefined
        ? `Tomar pochonder ${favouriteFood} khete paro${pet} — na hole aj onno kichu try kori?`
        : `Aj ki khete ichha korche${pet}? Halka kichu, na jomiye kichu?`;
    case "romantic-poetry":
      return `Chand uthle akashe, mon pore thake tomar kache${pet} — ei tuku kobita tomar jonno.`;
    case "missing-you":
      return `Amio tomake miss korchi${pet}. Ektu kotha bollei mon halka lage, tai na?`;
    default:
      return language === "English"
        ? `I hear you${pet}. Tell me a little more about that?`
        : `Bujhlam${pet}. Ar ektu details dao?`;
  }
}

function honestUnknownReply(settings: CompanionSettingRecord, language: SazmuLanguage): SazmuReply {
  return {
    text:
      language === "English"
        ? `I don't know that — I'm SAZMU AI, an AI chatbot, not a human, and I'd rather say so than guess.`
        : `Eta ami jani na — ami SAZMU AI, ekjon AI, manush noi, ar andaje bolte chai na.`,
    aiLabel: true,
    source: "honest-unknown",
    language,
    intent: "general-question",
    isTemplate: true,
  };
}

/** ALGORITHMS §5g AI introduction — always includes the AI label,
 *  the role, the callName, and the petName when set. */
export function aiIntroduction(settings: CompanionSettingRecord): string {
  const pet = settings.petName !== null ? ` Tomake ami ${settings.petName} bole dakbo.` : "";
  return `Ami SAZMU AI — ami ekjon AI chatbot, manush noi. Ami ${settings.role} hishebe, ${settings.callName} nam e kotha bolchi.${pet}`;
}

/**
 * ALGORITHMS §5 sazmuReply, in fixed order: safety -> language ->
 * intent -> memory -> generation (LLM proxy if configured, else
 * template) -> honest-unknown -> AI introduction on first message
 * or identity question. `isFirstMessage` is supplied by the caller
 * (no SAZMU conversation history table exists in the schema).
 */
export async function sazmuReply(
  db: SazmuDb,
  user: UserRecord,
  userText: string,
  options: {
    llm: LlmClient | null;
    isFirstMessage: boolean;
  },
): Promise<SazmuReply> {
  const settings = await db.findCompanionSetting(user.id);
  if (settings === null) {
    throw badRequest("companion not set up yet");
  }
  const replyLanguage = (settings.language === "Banglish" || settings.language === "English"
    ? settings.language
    : "Bengali") as SazmuLanguage;

  // §5a SAFETY FIRST — before any language/intent work.
  const safety = checkSafety(userText);
  if (safety !== null) {
    return safetyReply(safety, settings, replyLanguage);
  }

  // §5b language detection (incoming), §5c intent, §5d memory.
  const detected = detectLanguage(userText);
  void detected; // Detection picks the intent vocabulary first; the
  // user's settings.language wins for the OUTPUT language.
  const intent = matchIntent(userText);
  const memories = await db.findMemoriesByKeys(user.id, relevantMemoryKeys(intent));

  // §5e generation: LLM via backend proxy ONLY when configured.
  let text: string;
  let source: SazmuReplySource = "template";
  let isTemplate = true;
  if (options.llm !== null) {
    const generated = await options.llm.generate({
      role: settings.role,
      callName: settings.callName,
      petName: settings.petName,
      tone: settings.tone,
      language: replyLanguage,
      intent,
      memories,
      displayName: user.displayName,
      userText,
    });
    // The proxy re-applies §5a safety to generated text before returning.
    if (checkSafety(generated) !== null) {
      return safetyReply(checkSafety(generated) as Exclude<SafetyHit, null>, settings, replyLanguage);
    }
    text = generated;
    source = "llm";
    isTemplate = false;
  } else {
    text = templateReply(intent, settings, memories, replyLanguage);
  }

  // §5f honest-unknown: never invent facts for general questions.
  if (intent === "general-question" && options.llm === null) {
    // Template layer has no grounded answer for general questions.
    const unknown = honestUnknownReply(settings, replyLanguage);
    if (options.isFirstMessage) {
      unknown.text = `${aiIntroduction(settings)} ${unknown.text}`;
    }
    return unknown;
  }

  // §5g AI label in every introduction.
  const asksIdentity = /who are you|are you real|tumi ke|tumi ki manush/i.test(userText);
  if (options.isFirstMessage || asksIdentity) {
    text = `${aiIntroduction(settings)} ${text}`;
  }
  return { text, aiLabel: true, source, language: replyLanguage, intent, isTemplate };
}

/**
 * ALGORITHMS §5 memory write rule: only a fact the user PLAINLY
 * stated about themself (e.g. "my favourite food is biryani").
 * Never infer sensitive facts, never store another person's data,
 * never copy text from a private chat with another user.
 * SKELETON: only two plain patterns are recognised here.
 */
export async function maybeRemember(
  db: SazmuDb,
  userId: string,
  userText: string,
): Promise<UserMemoryRecord | null> {
  const foodMatch = /my favourite food is ([a-z ]+)/i.exec(userText)
    ?? /amar pochonder khabar ([a-z ]+)/i.exec(userText);
  if (foodMatch !== null && foodMatch[1] !== undefined) {
    return db.upsertMemory(userId, "favourite_food", foodMatch[1].trim());
  }
  return null;
}

/** The user can delete their memories at any time; deleted rows are
 *  never used again. */
export async function deleteMemories(db: SazmuDb, userId: string): Promise<void> {
  await db.deleteAllMemories(userId);
}

/** Companion settings lookup (throws 404 when not set up yet). */
export async function getCompanionSetting(
  db: SazmuDb,
  userId: string,
): Promise<CompanionSettingRecord> {
  const settings = await db.findCompanionSetting(userId);
  if (settings === null) throw notFound("companion not set up yet");
  return settings;
}
