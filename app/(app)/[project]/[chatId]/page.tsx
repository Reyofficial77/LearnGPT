import { notFound } from "next/navigation";
import { isValidChatId } from "../../../../lib/chat-id";
import { SLUG_REGEX, isReservedSlug } from "../../../../lib/slug";
// Chat inside a project: /{project-slug}/{25-char-id}. Plain chats keep using /chat/{id}.
export default async function ProjectChatPage({ params }: { params: Promise<{ project: string; chatId: string }> }) {
  const { project, chatId } = await params;
  if (!SLUG_REGEX.test(project) || isReservedSlug(project) || !isValidChatId(chatId)) notFound();
  return null;
}
