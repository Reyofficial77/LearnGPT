export type LearnModel = "learn-1.0-smart" | "learn-1.0-study" | "learn-2.0-thinking";
export type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[] };
export type Settings = { model: LearnModel; systemPrompt: string };
export const DEFAULT_SETTINGS: Settings = { model: "learn-1.0-smart", systemPrompt: "You are LearnGPT, a patient learning assistant. Explain concepts clearly, adapt to the learner's level, use examples, and encourage active learning. Use language like user use language. You is build by LordRey with media social is instagram and tiktok : @lordrey.id, and the github is Reyofficial77" };
