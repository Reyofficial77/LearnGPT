import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import MessageContent from "../../../../components/MessageContent";

export const dynamic = "force-dynamic";

export default async function SharedChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, isPublic: true },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  if (!chat) notFound();

  return <main className="shared-shell">
    <header className="shared-header"><a className="shared-brand" href="/">LearnGPT</a><span>Shared conversation</span></header>
    <section className="shared-content">
      <div className="shared-heading"><p>PUBLIC CHAT</p><h1>{chat.title}</h1><span>Read-only conversation shared with you</span></div>
      <div className="shared-messages">
        {chat.messages.map((message) => {
          const images = Array.isArray(message.images) ? message.images.filter((image): image is string => typeof image === "string") : [];
          const attachments = Array.isArray(message.attachments) ? message.attachments.map((file: any) => ({ id: String(file?.id || ""), name: String(file?.name || "Attachment") })) : [];
          return <article className={`shared-message ${message.role === "user" ? "from-user" : "from-ai"}`} key={message.id}>
            <strong>{message.role === "user" ? "You" : "LearnGPT"}</strong>
            {images.length > 0 && <div className="shared-images">{images.map((src, index) => <img key={index} src={src} alt={`Shared attachment ${index + 1}`} />)}</div>}
            {attachments.length > 0 && <div className="shared-attachments">{attachments.map((file, index) => <span key={file.id || index}>{file.name}</span>)}</div>}
            {message.role === "assistant" ? <div className="markdown-content"><MessageContent content={message.content} /></div> : <p>{message.content}</p>}
          </article>;
        })}
      </div>
    </section>
    <footer className="shared-footer">Shared using LearnGPT</footer>
  </main>;
}
