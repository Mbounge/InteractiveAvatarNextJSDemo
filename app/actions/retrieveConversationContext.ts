// app/actions/retrieveContext.ts
"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";
import OpenAI from "openai";
import { tool } from "ai";
import { z } from "zod";

export async function retrieveConversationContext({
  userId,
  userQuery,
  minScore = 0.7, // Minimum similarity score for filtering
  topK = 3, // Number of top matches to retrieve
}: {
  userId: string;
  userQuery: string;
  minScore?: number;
  topK?: number;
}) {
  const indexName = "chat";
  const dimension = 1536;
  const namespace = "chat";

  const openai = new OpenAI();

  try {
    // Step 1: Generate embedding for the user query
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userQuery,
      encoding_format: "float",
    });
    const [{ embedding }] = embeddingRes.data;

    // Step 2: Ensure the index exists and get its handle
    const index = await ensurePineconeIndex(indexName, dimension);

    // Step 3: Query Pinecone for similar conversation summaries
    const queryResponse = await index.namespace(namespace).query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: { userId }, // Only retrieve vectors for the specified user
    });

    // Step 4: Filter matches by minScore
    const matches = queryResponse.matches || [];
    console.log(matches)
    const qualifyingDocs = matches.filter((match) => match.score && match.score >= minScore);

    // Step 5: Extract summaries from the qualifying matches
    const relevantSummaries = qualifyingDocs.map((match) => {
      const metadata = match.metadata as Record<string, any>;
      return metadata.summary;
    });

    return relevantSummaries;
  } catch (error) {
    console.error("Error during context retrieval:", error);
    return []; // Return an empty array on error
  }
}

// Define the tool for the AI model
export const retrieveConversationContextTool = tool({
  description: "Retrieve relevant conversation context from the vector database based on a user's query.",
  parameters: z.object({
    userId: z.string().describe("The unique identifier for the user (accessCode)."),
    userQuery: z.string().describe("The query or prompt for retrieving related conversation context."),
  }),
  execute: async ({ userId, userQuery }) => {
    const results = await retrieveConversationContext(
      { userId, userQuery },
    );
    return { relevantContext: results };
  },
});