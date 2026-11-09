import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/server-auth";
import { isValidChatId } from "../../../../lib/chat-id";
import { SLUG_REGEX, isReservedSlug } from "../../../../lib/slug";

export default async function ProjectChatPage({ params }: { params: Promise<{ project: string; chatId: string }> }) {
  if (!(await getSessionUser())) redirect("/auth/login");
  const { project, chatId } = await params;
  if (!SLUG_REGEX.test(project) || isReservedSlug(project) || !isValidChatId(chatId)) notFound();
  return null;
}
