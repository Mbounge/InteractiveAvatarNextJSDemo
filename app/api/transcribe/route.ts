import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY); // Initialize Deepgram client

export async function POST(req: NextRequest) {
  try {
    // Parse the request body for the audio file
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required." },
        { status: 400 }
      );
    }

    // Convert the audio file into a buffer
    const audioBuffer = await audioFile.arrayBuffer();

    // Call Deepgram API to transcribe the audio
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      Buffer.from(audioBuffer),
      {
        model: "base", // Specify the model
        smart_format: true, // Enable smart formatting
      }
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to transcribe audio." },
        { status: 500 }
      );
    }

    // Extract the transcription result
    const transcription = result.results.channels[0]?.alternatives[0]?.transcript;

    return NextResponse.json({ text: transcription }, { status: 200 });
  } catch (error) {
    console.error("Error during transcription:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}