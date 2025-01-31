"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";
import OpenAI from "openai";
import { retrieveUserGoals } from "./retrieveGoals";
import { retrieveRecentConversations } from "./retrieveRecentConversations";
import { CoreMessage } from "ai";

const openai = new OpenAI();

export async function saveUserGoals({
  userId,
  messages,
}: {
  userId: string;
  messages: CoreMessage[];
}) {
  const indexName = "chat";  
  const dimension = 1536;
  const namespace = "goals";

  // Combine the current conversation into one string
  const currentConversation = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n");

  try {
    // Retrieve existing goals
    const existingGoalsList = await retrieveUserGoals({ userId, topK: 5 });

    const oldGoals = existingGoalsList.map(goal => {
        const timestamp = new Date(goal.timestamp).toISOString();
        return `[Timestamp: ${timestamp}]\n${goal.goals || ''}`
    })

    // Retrieve recent conversations
    const recentConversationsList = await retrieveRecentConversations({ userId, limit: 5 });
    const pastConversationsText = recentConversationsList
      .map(convo => {
        //@ts-ignore
        const timestamp = new Date(convo.timestamp).toISOString();
        return `[Timestamp: ${timestamp}]\n Summary: ${convo.summary || ""}\nFull Conversation: ${convo.fullConversation}`;
      })
      .join("\n\n");

    // Construct a prompt incorporating old goals, past and current conversations
    const prompt = generateGoalUpdatePrompt({
      oldGoals,
      pastConversations: pastConversationsText,
      currentConversation,
    });

    // Send prompt to LLM for updated goals and session notes
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const rawLLMOutput = chatResponse.choices[0]?.message?.content?.trim() || "";

    // Ensure the index exists
    const index = await ensurePineconeIndex(indexName, dimension);

    // Create an embedding of the updated goals & notes
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: rawLLMOutput,
      encoding_format: "float",
    });
    const [{ embedding }] = embeddingRes.data;

    // Save updated goals & notes to Pinecone
    await index.namespace(namespace).upsert([
      {
        id: `${userId}-${Date.now()}`,
        values: embedding,
        metadata: {
          userId,
          goals: rawLLMOutput,
          timestamp: Date.now(),
        },
      },
    ]);

    console.log("Updated user goals stored in Pinecone successfully.");
    return { success: true, updatedGoals: rawLLMOutput };
  } catch (error: any) {
    console.error("Error updating user goals:", error.message);
    return { success: false, error: error.message };
  }
}

function generateGoalUpdatePrompt({
  oldGoals,
  pastConversations,
  currentConversation,
}: {
  oldGoals: string[];
  pastConversations: string;
  currentConversation: string;
}) {
  if (oldGoals.length === 0) {
    return `
You are an AI assistant that extracts the user's goals and objectives from conversations.
Here is the current conversation:
${currentConversation}

Please do the following:
1) Identify the core objectives/goals the user wants to achieve.
2) Summarize them in bullet points.
3) Provide session notes: how can the AI sports advisor best support the user going forward.
Return the result in plain text. 
    `;
  }

  return `
We have an existing set of goals from previous sessions:
${oldGoals}

Based on past conversations:
${pastConversations}

Now, here is the latest conversation between a user and an AI sports advisor:
${currentConversation}

Please do the following:
1) Compare the existing goals with anything new from this conversation. 
   - If any goal is achieved, note that.
   - If any goal is changed, update it.
   - If new goals appear, add them.
2) Provide an updated list of all current goals, indicating progress or achievements if relevant.
3) Provide new session notes: Are we supporting the user effectively? How can we better support them moving forward?

Return your result in plain text. 
`;
}