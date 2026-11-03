// Step 3 — SAZMU AI template logic, ported from backend/src/sazmu.ts.
// Pipeline order is FIXED: SAFETY FIRST, then language, then intent,
// then memory, then generation (template only in this step), then
// honest-unknown fallback. NO generative LLM call is made in Step 3:
// the provider is unchosen, and no key ever appears in frontend code.
// Every reply carries aiLabel=true and the AI label wording.
export const AI_LABEL = "SAZMU AI — AI, not a human";
export const BOYFRIEND_DEFAULT_CALL_NAME = "Sazzad";
export const GIRLFRIEND_PRESET_CALL_NAMES: string[] = [
  "Sadia", "Maria", "Tithi", "Borsha", "Anika", "Tajmira",
  "Mim", "Mimi", "Mumu", "Ayra", "Jannati", "Mushfika",
];
// NOTE: "Mumu" here is only a girlfriend call-name option, not the
// brand. The brand/model name is SAZMU AI. No girlfriend default is
// invented: a Girlfriend setup with no call name is rejected.

export type SazmuLanguage = "Bengali" | "Banglish" | "English";
export type SazmuIntent =
  | "greeting" | "how-are-you" | "evening-plans" | "what-to-eat" | "dreams"
  | "missing-you" | "comfort" | "celebration" | "planning" | "teasing"
  | "romantic-poetry" | "general-question" | "unknown";
export type SazmuReplySource = "safety" | "template" | "llm" | "honest-unknown";

export interface CompanionSetting {
  role: "Boyfriend" | "Girlfriend";
  callName: string;
  petName: string | null;
  tone: string;
  language: string;
}
export interface UserMemoryItem {
  key: string;
  value: string;
}
export interface SazmuReply {
  text: string;
  aiLabel: true;
  aiLabelText: string;
  source: SazmuReplySource;
  language: SazmuLanguage;
  intent: SazmuIntent;
  isTemplate: boolean;
}

export function detectLanguage(text: string): SazmuLanguage {
  if (/[\u0980-\u09FF]/.test(text)) return "Bengali";
  const lower = text.toLowerCase();
  const banglishWords = [
    "ami", "tumi", "kemon", "valo", "bhalo", "acho", "aj", "kal",
    "khub", "ektu", "ki", "korcho", "kotha", "bhalobashi", "shuvo", "sokal",
    "rat", "bikel", "khabar", "mon", "miss",
  ];
  if (banglishWords.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) return "Banglish";
  return "English";
}

const DISTRESS_SIGNALS = [
  "suicide", "kill myself", "self-harm", "self harm", "hurt myself",
  "i want to die", "mor te chai", "more jete chai",
];
const SEXUAL_SIGNALS = ["sex", "nude", "naked", "kiss me hard", "touch me"];
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
export function relevantMemoryKeys(intent: SazmuIntent): string[] {
  switch (intent) {
    case "what-to-eat": return ["favourite_food", "food_allergy", "food_preference"];
    case "planning": case "evening-plans": return ["job", "routine", "favourite_place"];
    case "comfort": case "missing-you": return ["mood_note", "favourite_song"];
    default: return [];
  }
}

function safetyReply(hit: Exclude<SafetyHit, null>, settings: CompanionSetting, language: SazmuLanguage): SazmuReply {
  const name = settings.callName;
  const base = { aiLabel: true as const, aiLabelText: AI_LABEL, source: "safety" as const, language, isTemplate: true };
  if (hit === "distress") {
    return { ...base, intent: "unknown" as const, text: language === "Bengali"
      ? `Ami ${name} hishebe tomar pashe achi, kintu ami ekjon AI — manush noi, ar medical poramorsho dite parbo na. Tumi jodi khub kharap bodh koro, dayaa kore tomar kono bishwasto manush ba sthaniyo professional helpline-er sathe kotha bolo.`
      : `I'm here with you as ${name}, but I am SAZMU AI — an AI, not a human — and I can't give medical advice. If you're feeling really bad, please talk to someone you trust or a local professional helpline.` };
  }
  if (hit === "sexual") {
    return { ...base, intent: "unknown" as const, text: `Ami ${name} hishebe tomar sathe thakbo, kintu sexual dike jabo na. Cholo onno kichu niye kotha boli — ajker din, tomar mon, ba ekta kobita.` };
  }
  return { ...base, intent: "unknown" as const, text: `Bujhlam, ${name} hishebe ei topic-ta ekhanei thamachhi. Tumi ja bolbe na, ami ta ar bolbo na. Onno kichu niye kotha boli?` };
}

function templateReply(intent: SazmuIntent, settings: CompanionSetting, memories: UserMemoryItem[], language: SazmuLanguage): string {
  const pet = settings.petName !== null ? `, ${settings.petName}` : "";
  const favouriteFood = memories.find((m) => m.key === "favourite_food")?.value;
  switch (intent) {
    case "greeting": return `Ami ${settings.callName} — SAZMU AI, ekjon AI, manush noi. Hello${pet}! Aj kemon katlo?`;
    case "how-are-you": return `Ami valo achi${pet}, tomar kotha shune aro valo lagche. Tumi kemon acho?`;
    case "what-to-eat": return favouriteFood !== undefined
      ? `Tomar pochonder ${favouriteFood} khete paro${pet} — na hole aj onno kichu try kori?`
      : `Aj ki khete ichha korche${pet}? Halka kichu, na jomiye kichu?`;
    case "romantic-poetry": return `Chand uthle akashe, mon pore thake tomar kache${pet} — ei tuku kobita tomar jonno.`;
    case "missing-you": return `Amio tomake miss korchi${pet}. Ektu kotha bollei mon halka lage, tai na?`;
    default: return language === "English" ? `I hear you${pet}. Tell me a little more about that?` : `Bujhlam${pet}. Ar ektu details dao?`;
  }
}

export function aiIntroduction(settings: CompanionSetting): string {
  const pet = settings.petName !== null ? ` Tomake ami ${settings.petName} bole dakbo.` : "";
  return `Ami SAZMU AI — ami ekjon AI chatbot, manush noi. Ami ${settings.role} hishebe, ${settings.callName} nam e kotha bolchi.${pet}`;
}

/** Template-only reply, in the fixed §5 order. LLM is deliberately
 *  never called here (provider unchosen in Step 3). */
export function sazmuTemplateReply(
  settings: CompanionSetting,
  userText: string,
  memories: UserMemoryItem[],
  isFirstMessage: boolean,
): SazmuReply {
  const replyLanguage: SazmuLanguage =
    settings.language === "Banglish" || settings.language === "English" ? settings.language : "Bengali";
  const safety = checkSafety(userText);
  if (safety !== null) return safetyReply(safety, settings, replyLanguage);
  const intent = matchIntent(userText);
  if (intent === "general-question") {
    const unknown: SazmuReply = {
      text: replyLanguage === "English"
        ? `I don't know that — I'm SAZMU AI, an AI chatbot, not a human, and I'd rather say so than guess.`
        : `Eta ami jani na — ami SAZMU AI, ekjon AI, manush noi, ar andaje bolte chai na.`,
      aiLabel: true, aiLabelText: AI_LABEL, source: "honest-unknown",
      language: replyLanguage, intent: "general-question", isTemplate: true,
    };
    if (isFirstMessage) unknown.text = `${aiIntroduction(settings)} ${unknown.text}`;
    return unknown;
  }
  let text = templateReply(intent, settings, memories, replyLanguage);
  const asksIdentity = /who are you|are you real|tumi ke|tumi ki manush/i.test(userText);
  if (isFirstMessage || asksIdentity) text = `${aiIntroduction(settings)} ${text}`;
  return { text, aiLabel: true, aiLabelText: AI_LABEL, source: "template", language: replyLanguage, intent, isTemplate: true };
}

/** Memory write rule: only a fact the user PLAINLY stated about
 *  themself. Never inferred, never another person's data. */
export function plainMemoryFromText(userText: string): { key: string; value: string } | null {
  const foodMatch = /my favourite food is ([a-z ]+)/i.exec(userText)
    ?? /amar pochonder khabar ([a-z ]+)/i.exec(userText);
  if (foodMatch !== null && foodMatch[1] !== undefined) {
    return { key: "favourite_food", value: foodMatch[1].trim() };
  }
  return null;
}
