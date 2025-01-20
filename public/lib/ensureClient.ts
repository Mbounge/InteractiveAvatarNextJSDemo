// utils/ensureIndex.ts
import { Pinecone } from '@pinecone-database/pinecone';

export async function ensurePineconeIndex(indexName: string, dimension: number) {
  // Initialize the Pinecone client
  const pinecone = new Pinecone();

  // Retrieve the list of existing indexes
  const indexResponse = await pinecone.listIndexes(); // Returns { indexes: { name: string }[] }
  const indexList = indexResponse.indexes;

  // Check if the target index exists by its `name` property
  //@ts-ignore
  const indexExists = indexList.some(index => index.name === indexName);

  if (!indexExists) {
    console.log(`Creating Pinecone index: ${indexName}`);
    await pinecone.createIndex({
      name: indexName,
      dimension,
      metric: 'cosine', // Adjust metric as needed
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
      waitUntilReady: true, // Ensure index is ready before continuing
    });
  } else {
    console.log(`Index "${indexName}" already exists.`);
  }

  // Return a handle to the index for further operations
  return pinecone.Index(indexName);
}