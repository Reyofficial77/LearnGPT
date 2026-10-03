export type Provider = "gemini" | "openai" | "anthropic";
export type LearnModel = "learn-1.0-smart" | "learn-1.0-study" | "learn-2.0-thinking";
export type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[] };
export type Settings = { provider: Provider; model: LearnModel; keys: Record<Provider,string>; systemPrompt: string };
export const DEFAULT_SETTINGS: Settings = { provider:"gemini", model:"learn-1.0-smart", keys:{gemini:"",openai:"",anthropic:""}, systemPrompt:"You are LearnGPT, a patient learning assistant. Explain concepts clearly, adapt to the learner's level, use examples, and encourage active learning." };
