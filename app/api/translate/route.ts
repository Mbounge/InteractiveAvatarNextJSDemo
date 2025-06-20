// /api/translate/route.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

// Helper map to convert country codes to language names/codes
const countryToLanguageMap: { [key: string]: { name: string; code: string } } = {
  SE: { name: "Swedish", code: "sv" },
  FI: { name: "Finnish", code: "fi" },
  CZ: { name: "Czech", code: "cz" },
  SK: { name: "Slovak", code: "sk" },
  RU: { name: "Russian", code: "ru" },
  DE: { name: "German", code: "de" },
  CH: { name: "German", code: "de" }, // Swiss German is complex, German is a safe default
  // Add more mappings as needed
};

// Countries where English is the primary language (no translation needed)
const englishSpeakingCountries = ["US", "CA", "GB", "AU", "NZ", "IE"];

export async function POST(request: Request) {
  try {
    const { reportText, playerCountry } = await request.json();

    if (!reportText || !playerCountry) {
      return NextResponse.json(
        { error: "Report text and player country are required." },
        { status: 400 }
      );
    }

    // Check if translation is necessary
    if (englishSpeakingCountries.includes(playerCountry.toUpperCase())) {
      return NextResponse.json({
        translationSkipped: true,
        reason: "Player's country is English-speaking.",
      });
    }

    const targetLanguage = countryToLanguageMap[playerCountry.toUpperCase()];
    if (!targetLanguage) {
      return NextResponse.json({
        translationSkipped: true,
        reason: `No language mapping found for country code: ${playerCountry}`,
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-05-20",
      generationConfig: {
        temperature: 0.2
      }
    });

    const prompt = `
      Translate the following hockey scouting report into ${targetLanguage.name}. 
      Preserve the exact Markdown and HTML formatting, including headings, bold text, lists, and tables.
      Only provide the translated text as the response, with no additional commentary.

      ---
      ${reportText}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const translatedText = response.text();

    return NextResponse.json({ 
      translatedText,
      languageName: targetLanguage.name,
    });

  } catch (error) {
    console.error("Error translating report:", error);
    return NextResponse.json(
      { error: "Failed to translate report." },
      { status: 500 }
    );
  }
}