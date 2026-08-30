import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiKeyConfigured } from "@/lib/ai";
import { AiChat } from "./AiChat";

export const metadata: Metadata = { title: "AI Safety Assistant" };

export default async function AiAssistantPage() {
  const user = await requireUser();
  const [settings, conversation] = await Promise.all([
    getAiSettings(),
    prisma.aiConversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
    }),
  ]);

  return (
    <AiChat
      initialConversation={conversation ? {
        id: conversation.id,
        title: conversation.title,
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
      } : null}
      enabled={settings.isEnabled && isAiKeyConfigured(settings)}
      model={settings.model}
    />
  );
}
