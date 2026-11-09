import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/server-auth";
import { isValidChatId } from "../../../../lib/chat-id";

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  if (!(await getSessionUser())) redirect("/auth/login");
  const { chatId } = await params;
  if (!isValidChatId(chatId)) notFound();
  return null; // UI is rendered by the (app) layout; it reads the id from the URL.
}
