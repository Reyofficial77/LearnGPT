// Client-safe: only the public LearnGPT model ids live here.
// The real Ollama Cloud model names are resolved on the server (see lib/ollama.ts).
export const LEARN_MODELS = ["learn-1.0-smart", "learn-1.0-study", "learn-2.0-thinking"] as const;
export type LearnModel = (typeof LEARN_MODELS)[number];

export const MODEL_LABELS: Record<LearnModel, string> = {
  "learn-1.0-smart": "Learn 1.0 Smart",
  "learn-1.0-study": "Learn 1.0 Study",
  "learn-2.0-thinking": "Learn 2.0 Thinking"
};
