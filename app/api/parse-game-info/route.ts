// File: app/api/parse-game-info/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { gameInfoHtml } = await request.json();

    if (!gameInfoHtml) {
      return NextResponse.json(
        { error: "Missing gameInfoHtml to parse." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-05-20",
      generationConfig: {
        temperature: 0, // We want deterministic output
        responseMimeType: "application/json", // Crucial for forcing JSON output
      },
    });

    const prompt = `
      You are a data extraction expert for hockey scouting reports.
      Analyze the following text block which contains details about a scouted game.
      Your task is to extract the specified information and return it as a valid JSON object.

      **RULES:**
      1.  Your response MUST be a valid JSON object and nothing else.
      2.  The "homeTeam" is the first team listed in the "Game:" line.
      3.  The "awayTeam" is the second team listed.
      4.  Try to identify the scores for the home and away team from the text block
      5.  If any piece of information cannot be found, the value for that key should be \`null\`.
      6.  Do not add any extra fields to the JSON structure.

      **JSON Structure to use:**
      {
        "homeTeam": {
          "name": "string | null",
          "score": "number | null"
        },
        "awayTeam": {
          "name": "string | null",
          "score": "number | null"
        },
        "gameDate": "string | null",
        "league": "string | null"
      }

      **Text to Analyze:**
      ---
      ${gameInfoHtml}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const gameDetails = JSON.parse(response.text());

    return NextResponse.json(gameDetails);

  } catch (error) {
    console.error("Error parsing game info:", error);
    // If parsing fails, return a default structure so the PDF doesn't break
    const fallback = {
      homeTeam: { name: "N/A", score: null },
      awayTeam: { name: "N/A", score: null },
      gameDate: "N/A",
      league: "N/A",
    };
    return NextResponse.json(fallback, { status: 500 });
  }
}