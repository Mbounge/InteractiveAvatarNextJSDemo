"use server";

import { ensurePineconeIndex } from "@/public/lib/ensureClient";

export async function retrieveRecentConversations({
  userId,
  namespace = "chat",
  indexName = "chat",
  limit = 5, // Number of recent conversations to retrieve
}: {
  userId: string;
  namespace?: string;
  indexName?: string;
  limit?: number;
}) {
  const dimension = 1536;

  try {
    // Ensure the index exists and get its handle
    const index = await ensurePineconeIndex(indexName, dimension);

    // Query Pinecone for conversations associated with the user
    const queryResponse = await index.namespace(namespace).query({
      vector: new Array(dimension).fill(0), // Dummy vector (fetch by filter only)
      topK: 50, // Retrieve more records to ensure we can sort locally
      includeMetadata: true,
      filter: { userId }, // Filter for the specific user
    });

    const matches = queryResponse.matches || [];

    // Type guard: Ensure metadata exists and has a valid timestamp
    const filteredMatches = matches.filter(
      (match) => match.metadata && typeof match.metadata.timestamp === "number"
    );

    // Sort the filtered matches by timestamp (descending)
    const sortedByTimestamp = filteredMatches.sort(
      (a, b) => (b.metadata!.timestamp as number) - (a.metadata!.timestamp as number)
    );

    // Return the top `limit` conversations
    const recentConversations = sortedByTimestamp.slice(0, limit).map((match) => ({
      conversationId: match.metadata!.conversationId,
      summary: match.metadata!.summary,
      fullConversation: match.metadata!.fullConversation,
      timestamp: match.metadata!.timestamp,
    }));

    return recentConversations;
  } catch (error) {
    console.error("Error retrieving recent conversations:", error);
    return [];
  }
}