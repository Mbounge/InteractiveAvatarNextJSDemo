// File: /app/api/gemini/route.ts (or /pages/api/gemini.ts if using the pages directory)
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Helper function to read a file and convert it to the Gemini inline data format.
function fileToGenerativePart(filePath: string, mimeType: string) {
  // Construct the absolute file path. Here we assume the file is in the public folder.
  const absolutePath = path.join(process.cwd(), filePath);
  const fileBuffer = fs.readFileSync(absolutePath);
  return {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType,
    },
  };
}

// POST method handler
export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body (if you need any inputs from the client)
    const body = await req.json();
    // For example, you might accept a custom prompt from the client:
    // const promptText = body.prompt || "Default prompt text";
    
    // For demonstration, we’re using a hardcoded prompt:
    const promptText =
      "Tell me the difference between the 2 images I have given you";

    const promptVideo = 'can you see this video'

    // Retrieve your Gemini API key from environment variables.
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is not defined" },
        { status: 500 }
      );
    }

    // Create an instance of the Gemini API client.
    const genAI = new GoogleGenerativeAI(apiKey);

    // Choose the Gemini model.
    // In this example, we’re using "gemini-1.5-pro" because we’re including an image.
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Prepare the image data.
    // Adjust the file path as needed. Here, we assume the image is located at "public/KroniPic.png"
    const imagePart = fileToGenerativePart("public/KroniPic.png", "image/png");
    const imagePart2 = fileToGenerativePart("public/demo.png", "image/png");
    const videoPart = fileToGenerativePart("public/GreatMax.mov", "video/mov")

    // Send the prompt along with the image data to the model.
    // The Gemini API accepts an array of parts, where the first element is your prompt text.
    const generatedContent = await model.generateContent([promptVideo, videoPart]);

    // Retrieve the generated text from the response.
    const answer = generatedContent.response.text();

    const tokens = generatedContent.response.usageMetadata

    console.log(tokens)

    // Return the result in a JSON response.
    return NextResponse.json({ answer }, { status: 200 });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
