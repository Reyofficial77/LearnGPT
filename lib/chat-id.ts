// Format: xxxxx-xxxxx-xxxxx-xxxxx-xxxxx  (25 random lowercase letters & digits)
// Safe to import from both server and client (no Node APIs here).
export const CHAT_ID_REGEX = /^[a-z0-9]{5}(?:-[a-z0-9]{5}){4}$/;
// Old chats created before this change used Prisma cuid() ids. Keep them reachable.
export const LEGACY_CHAT_ID_REGEX = /^c[a-z0-9]{24}$/;
export function isValidChatId(value: string): boolean {
  return CHAT_ID_REGEX.test(value) || LEGACY_CHAT_ID_REGEX.test(value);
}
