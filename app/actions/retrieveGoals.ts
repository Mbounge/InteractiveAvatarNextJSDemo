// app/actions/retrieveUserGoals.ts
"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";
import OpenAI from "openai";

const openai = new OpenAI();

interface GoalsMetadata {
  userId: string;
  conversationId: string;
  goals: string;      
  timestamp: number;
}

export async function retrieveUserGoals({
  userId,
  topK = 5,
}: {
  userId: string;
  topK?: number;
}) {
  const indexName = "chat";    // or "your-index"
  const dimension = 1536;
  const namespace = "goals";   // Distinct namespace for user goals

  try {
    const index = await ensurePineconeIndex(indexName, dimension);

    // Query Pinecone for goals belonging to the user
    const queryResponse = await index.namespace(namespace).query({
      vector: new Array(dimension).fill(0), // Dummy vector
      topK,
      includeMetadata: true,
      filter: { userId },
    });

    const matches = queryResponse.matches || [];

    // Sort by timestamp (descending) to get the most recent goals first
    const sortedByTimestamp = matches
      .filter((match) => match.metadata?.timestamp)
      .sort((a, b) => (b.metadata!.timestamp as number) - (a.metadata!.timestamp as number));

    // Return the metadata of each match
    const goalsList = sortedByTimestamp.map((match) => {
      const md = match.metadata as any;
      return {
        goals: md.goals,
        conversationId: md.conversationId,
        timestamp: md.timestamp,
      };
    });

    return goalsList; // from most recent to oldest
  } catch (error) {
    console.error("Error retrieving user goals:", error);
    return [];
  }
}