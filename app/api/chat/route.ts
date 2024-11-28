import { NextRequest, NextResponse } from "next/server";

import query from "@/public/lib/query";

// POST method handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Parse JSON body
    const { prompt, chatId, model, messages } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Please provide a prompt!" },
        { status: 400 }
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: "Please provide a valid chat ID!" },
        { status: 400 }
      );
    }

    // Call your query function
    const response = await query(prompt, chatId, model, messages);

    return NextResponse.json({ answer: response }, { status: 200 });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
