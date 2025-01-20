// app/actions/retrieveContext.ts
"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";
import OpenAI from "openai";

export async function retrieveGoalContext({
  userId,
  userQuery,
  minScore = 0.7, // Minimum similarity score for filtering
  topK = 3,       // Number of top matches to retrieve
}: {
  userId: string;
  userQuery: string;
  minScore?: number;
  topK?: number;
}) {
  const indexName = "chat";
  const dimension = 1536;
  const namespace = "goals";  // Use the "goals" namespace for searching goals

  const openai = new OpenAI();

  try {
    // Generate embedding for the user query
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userQuery,
      encoding_format: "float",
    });
    const [{ embedding }] = embeddingRes.data;

    // Ensure the index exists and get its handle
    const index = await ensurePineconeIndex(indexName, dimension);

    // Query Pinecone for similar goal records
    const queryResponse = await index.namespace(namespace).query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: { userId }, // Filter results for the specified user
    });

    const matches = queryResponse.matches || [];

    // Filter matches by minScore
    const qualifyingDocs = matches.filter(
      (match) => match.score && match.score >= minScore
    );

    // Extract the goals from qualifying matches
    const relevantGoals = qualifyingDocs.map((match) => {
      const metadata = match.metadata as Record<string, any>;
      return metadata.goals;
    });

    return relevantGoals;
  } catch (error) {
    console.error("Error during goal context retrieval:", error);
    return []; // Return an empty array on error
  }
}