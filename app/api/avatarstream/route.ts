import { NextRequest } from "next/server";
import openai from "@/public/lib/chatgpt";
import { createReadableStream } from "@/public/lib/sseHelpers"; 

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages) {
      return new Response(JSON.stringify({ error: "Please provide a prompt!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call OpenAI API with streaming
    const openAIRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      stream: true,
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    // Return a browser-compatible ReadableStream
    const stream = createReadableStream(openAIRes);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Error in streaming route:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}