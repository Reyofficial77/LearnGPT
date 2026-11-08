// Safe to import from both server and client (no Node APIs here).
// A project's slug is the first URL segment of its chats: /{slug}/{25-char-id}.

// Top-level paths the app already owns. A project can never take one of these names.
export const RESERVED_SLUGS = new Set([
  "chat", "api", "auth", "login", "logout", "register", "settings", "help",
  "new", "project", "projects", "workspace", "admin", "images", "public", "static",
  "favicon", "robots", "sitemap", "manifest", "_next"
]);

export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.has(value.toLowerCase());
}

/** "Belajar Matematika Kelas 9!" -> "belajar-matematika-kelas-9" */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "project";
}
