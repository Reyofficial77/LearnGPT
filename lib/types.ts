export type LearnModel = "learn-1.0-smart" | "learn-1.0-study" | "learn-2.0-thinking";
export type ChatAttachment = { id: string; name: string; mimeType: string; size: number; extractedText?: string; dataUrl?: string };
export type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[]; attachments?: ChatAttachment[] };
export type Theme = "dark" | "light" | "system";
export type Settings = { model: LearnModel; systemPrompt: string; theme: Theme };
export type ProjectSummary = { id: string; name: string; goal: string; slug: string };
export type Chat = { id: string; title: string; projectId: string | null; messages: ChatMessage[]; updatedAt: number; pinned: boolean; isPublic: boolean };
export const DEFAULT_SETTINGS: Settings = {
  model: "learn-1.0-smart",
  systemPrompt: "Follow the global LearnGPT learning instructions. Use the user's language, explain clearly, adapt to their level, and encourage active learning.",
  theme: "dark"
};
