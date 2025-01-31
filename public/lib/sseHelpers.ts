// /lib/sseHelpers.ts (example location)

import { Readable } from "stream";
import OpenAI  from "openai"; // or the correct import

export function createReadableStream(openAiRes: any) {
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of openAiRes) {
            // Each chunk from OpenAI can be formatted as needed for SSE
            const payload = JSON.stringify(chunk);
            controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          }
          controller.close();
        } catch (err) {
          console.error("Error in stream processing:", err);
          controller.error(err);
        }
      },
    });
  }