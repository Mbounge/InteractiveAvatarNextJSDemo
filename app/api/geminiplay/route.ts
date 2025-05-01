// File: /app/api/video-playht/route.ts (or /pages/api/video-playht.ts)
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to pause execution for a given number of milliseconds.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the PlayHT API directly to generate audio from text.
 * It writes the full streamed response to a file before returning the file path.
 */

const tts = `And here comes Tomas, picking up speed through center ice, he's got options"

Quick dish to the wing! Looking for the one-timer

HE SHOOTS!

SCORES! What a beautiful setup by Tomas, and a rocket of a shot! That's how you finish a play! Textbook hockey right there, folks!`

async function createAudioFileFromText(text: string): Promise<string> {
  const apiKey = process.env.PLAYDIALOG_API_KEY;
  const userId = process.env.PLAYDIALOG_USER_ID;
  if (!apiKey || !userId) {
    throw new Error("Missing PlayHT credentials");
  }

  // Configure headers with your API key and user ID.
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-USER-ID': userId,
  };

  // Configure the request payload.
  const reqBody = {
    outputFormat: 'mp3',
    language: 'english',
    speed: 1,
    model: 'PlayDialog',
    text,
    // Use the provided voice or a default voice URI.
    voice: process.env.PLAYHT_VOICE || 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json',
  };

  // Send the POST request to the PlayHT API endpoint.
  const response = await fetch('https://api.play.ai/api/v1/tts/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(reqBody),
  });

  console.log('here')

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PlayHT API failed with status ${response.status}: ${errorText}`);
  }

  console.log('Request sent successfully! Downloading audio file...');

  // Ensure we get the full binary response.
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate a unique file name.
  const fileName = `${Date.now()}.mp3`;
  const filePath = path.join(process.cwd(), fileName);

  // Write the full audio buffer to a file.
  fs.writeFileSync(filePath, buffer);
  console.log(`Audio file saved as ${fileName}`);

  return filePath;
}

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body.
    const body = await req.json();
    const { bio } = body;
    if (!bio) {
      return NextResponse.json(
        { error: "Athlete's bio is missing" },
        { status: 400 }
      );
    }

    // Create a prompt for the film study analysis.
    const promptText = `An athlete has submitted a video for film study to improve their performance.
Below is their sports bio information for context: ${bio}.
Please perform a comprehensive analysis of the video, highlighting key moments, strengths, and areas for improvement.
Focus on technique, strategy, execution, and overall performance, and offer actionable feedback for the athlete.`;

    // Retrieve your Gemini API key.
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not defined" },
        { status: 500 }
      );
    }

    // Initialize the File API manager.
    const fileManager = new GoogleAIFileManager(geminiApiKey);

    // Define the path to your video file (adjust as needed).
    const videoFilePath = path.join(process.cwd(), "public", "LucasGraet.mov");

    // Upload the video file.
    const uploadResponse = await fileManager.uploadFile(videoFilePath, {
      mimeType: "video/mov",
      displayName: "Graet",
    });
    console.log(`Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`);
    const fileName = uploadResponse.file.name;

    // Poll every 10 seconds until the file processing is complete.
    let file = await fileManager.getFile(fileName);
    while (file.state === FileState.PROCESSING) {
      console.log("Processing video file, waiting 10 seconds...");
      await sleep(10_000);
      file = await fileManager.getFile(fileName);
    }
    if (file.state === FileState.FAILED) {
      console.error("Video processing failed.");
      return NextResponse.json({ error: "Video processing failed." }, { status: 500 });
    }
    console.log(`File ${file.displayName} is ready for inference as ${file.uri}`);

    // Initialize the Gemini generative AI client.
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Generate the film study report.
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      { text: promptText },
    ]);
    const answer = result.response.text();
    console.log("Film Study Report complete:", answer);

    // Create a prompt for generating the narration commentary.
    const promptComment = `
An athlete has submitted a video for film study to boost their performance. Below is their sports bio for context: ${bio}.
(No need to repeat all the bio details—reference specific parts as needed.)
We also have a detailed video review report with key timestamps, observations, and actionable feedback: ${answer}.
Using this information, please craft an engaging, personal, and conversational narration.
Begin with a friendly greeting (imagine speaking directly to the athlete in a relaxed, upbeat tone like a popular YouTube video).
Explain the review purpose, highlight important moments (with timestamps), and offer constructive, motivational feedback.
Keep the narration natural and comprehensive so that it resonates with athletes, coaches, and scouts alike.
Do not use any heading or sections to talk about a new section - just make each section flows seamlessly in the conversation narration 
- the tts doesn't do very well with timestamps so use something more natural for mentioning the timestamps
    `;
    const resultComment = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      { text: promptComment },
    ]);
    const commentary = resultComment.response.text();
    console.log("Narration complete:", commentary);

    // Delete the video from the File API now that processing is complete.
    await fileManager.deleteFile(fileName);
    console.log(`Deleted ${uploadResponse.file.displayName}`);

    // Generate the audio file using the direct PlayHT API call.
    const audioFilePath = await createAudioFileFromText(tts);
    console.log("Audio file generated at:", audioFilePath);

    // Read the generated audio file into a buffer.
    const audioBuffer = await fsPromises.readFile(audioFilePath);

    // Delete the temporary audio file.
    await fsPromises.unlink(audioFilePath);
    console.log("Temporary audio file deleted.");

    // Return the audio file as a downloadable response.
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mp3",
        "Content-Disposition": `attachment; filename=${path.basename(audioFilePath)}`,
      },
    });

  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

