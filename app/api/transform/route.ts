import { NextRequest, NextResponse } from "next/server";

import query3 from "@/public/lib/query3";

// POST method handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Parse JSON body
    const { messages } = body;

    if (!messages) {
      return NextResponse.json(
        { error: "Please provide a prompt!" },
        { status: 400 }
      );
    }

    // Call your query function
    const response = await query3(messages);

    return NextResponse.json({ answer: response }, { status: 200 });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}