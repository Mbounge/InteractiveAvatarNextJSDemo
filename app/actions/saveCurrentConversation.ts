// app/actions/storeConversationInPinecone.ts
"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";
import OpenAI from "openai";
import { continueConversation } from "../action";

const openai = new OpenAI();

interface ChatMessage { role: string; content: string; }

export async function saveCurrentConversation({
  userId,
  conversationId,
  messages,
}: {
  userId: string;
  conversationId: string;
  messages: ChatMessage[];
}) {
  const indexName = "chat";
  const dimension = 1536; 
  const namespace = "chat";

  const fullConversation = messages
    .map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`)
    .join("\n");

  try {
    const summaryPrompt = `
      Summarize this conversation and highlight key takeaways between an AI Sports Advisor named Kroni and a user:
      ${fullConversation}
    `;

    const summaryRes = await continueConversation([{ role: "user", content: summaryPrompt }]);

    const summary = summaryRes

    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: summary,
      encoding_format: "float",
    });
    const [{ embedding }] = embeddingRes.data;

    const index = await ensurePineconeIndex(indexName, dimension);

    // Corrected upsert call:
    await index.namespace(namespace).upsert([
      {
        id: `${userId}-${conversationId}`,
        values: embedding,
        metadata: {
          userId,
          conversationId,
          summary,
          fullConversation,
          timestamp: Date.now(),
        },
      },
    ]);

    console.log("Conversation stored in Pinecone successfully.");
    return { success: true };
  } catch (error: any) {
    console.error("Error storing conversation in Pinecone:", error.message);
    return { success: false, error: error.message };
  }
}