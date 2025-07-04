// /api/translate/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 150;

export async function POST(request: Request) {
  try {
    // --- MODIFICATION START: Expect `targetLang` instead of `playerCountry` ---
    const { reportText, targetLang } = await request.json();

    if (!reportText || !targetLang) {
      return NextResponse.json(
        { error: "Report text and target language are required." },
        { status: 400 }
      );
    }
    // --- MODIFICATION END ---

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-05-20", // Using a slightly more robust model for translation can help
      generationConfig: {
        temperature: 0.2
      }
    });

    // --- MODIFICATION START: Use `targetLang` directly in the prompt ---
    const prompt = `
      Translate the following hockey scouting report into ${targetLang}.
      The only text that MUST remain in English is the main header: "GRAET SCOUTING REPORT".
      Preserve the exact Markdown and HTML formatting, including headings (###), bold text (**text**), lists, and tables.
      Do not add any extra commentary, introductory text, or markdown code blocks (like \`\`\`) to your response.
      The response should start directly with the translated version of the report content.

      ---
      ${reportText}
      ---
    `;
    // --- MODIFICATION END ---

    const result = await model.generateContent(prompt);
    const response = result.response;
    const translatedText = response.text();

    return NextResponse.json({ 
      translatedText,
      languageName: targetLang, // Return the language name we received
    });

  } catch (error) {
    console.error("Error translating report:", error);
    return NextResponse.json(
      { error: "Failed to translate report." },
      { status: 500 }
    );
  }
}