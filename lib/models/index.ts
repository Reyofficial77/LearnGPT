import type { Provider } from "../types";

export const LEARN_MODELS = ["learn-1.0-smart", "learn-1.0-study", "learn-2.0-thinking"] as const;
export type LearnModel = (typeof LEARN_MODELS)[number];

export const MODEL_REGISTRY: Record<Provider, Record<LearnModel, string>> = {
  gemini: {
    "learn-1.0-smart": "gemini-3.6-flash",
    "learn-1.0-study": "gemini-3.7-flash",
    "learn-2.0-thinking": "gemini-3.8-flash"
  },
  openai: {
    "learn-1.0-smart": "gpt-6-luna",
    "learn-1.0-study": "gpt-6.1-sol",
    "learn-2.0-thinking": "gpt-6-astra"
  },
  anthropic: {
    "learn-1.0-smart": "claude-sonnet-5-5",
    "learn-1.0-study": "claude-opus-5-5",
    "learn-2.0-thinking": "claude-fable-5-1"
  }
};

export function resolveModel(provider: Provider, learnModel: string): string | null {
  if (!LEARN_MODELS.includes(learnModel as LearnModel)) return null;
  return MODEL_REGISTRY[provider][learnModel as LearnModel];
}
