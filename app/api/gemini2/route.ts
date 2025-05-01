// File: /app/api/video/route.ts (or /pages/api/video.ts)
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Helper function to pause execution for a given number of milliseconds.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body; optionally, you can allow clients to pass a custom prompt.
    const body = await req.json();

    const { bio } = body;

    if (!bio) {
      return NextResponse.json(
        { error: "Athletes Bio is missing" },
        { status: 400 }
      );
    }

    const promptText = `An athlete has submitted a video for film study to improve their performance.
    Below is their sports bio information for context: ${bio}. Please perform a comprehensive analysis of the video,
    highlighting key moments, strengths, and areas for improvement. Your review should focus on aspects such as technique, strategy, execution,
    and overall performance, and offer actionable feedback that the athlete can use to enhance their skills and development.`;

    // Retrieve your Gemini API key from environment variables.
    // Use a secure server-side variable; here we use GEMINI_API_KEY.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is not defined" },
        { status: 500 }
      );
    }

    // Initialize the File API manager with your API key.
    const fileManager = new GoogleAIFileManager(apiKey);

    // Define the local path to your video file.
    // In this example, the file is located at "public/GreatRedSpot.mp4".
    const videoFilePath = path.join(process.cwd(), "public", "GreatMax.mov");

    // Upload the video file.
    const uploadResponse = await fileManager.uploadFile(videoFilePath, {
      mimeType: "video/mov",
      displayName: "Graet",
    });

    console.log(
      `Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`
    );

    // Retrieve the file name from the upload response.
    const fileName = uploadResponse.file.name;

    // Poll every 10 seconds to check the file's processing state.
    let file = await fileManager.getFile(fileName);
    while (file.state === FileState.PROCESSING) {
      console.log("Processing video file, waiting 10 seconds...");
      await sleep(10_000);
      file = await fileManager.getFile(fileName);
    }

    // If the file processing failed, return an error.
    if (file.state === FileState.FAILED) {
      console.error("Video processing failed.");
      return NextResponse.json(
        { error: "Video processing failed." },
        { status: 500 }
      );
    }

    // At this point, file.state is ACTIVE and the video is ready for inference.
    console.log(
      `File ${file.displayName} is ready for inference as ${file.uri}`
    );

    // Initialize the Gemini generative AI client.
    const genAI = new GoogleGenerativeAI(apiKey);

    // Choose a Gemini model. (The docs use gemini-1.5-pro for video.)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Generate content by providing an array of parts:
    //   1. The video file (by reference using fileData).
    //   2. A text prompt.
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType, // "video/mp4"
          fileUri: file.uri,
        },
      },
      {
        text: promptText,
      },
    ]);

    // Retrieve the generated text.
    const answer = result.response.text();
    console.log("Film Study Report complete:", answer);

    // generate the commentary
//     const promptComment = `
// An athlete has submitted a video for film study to enhance their performance. Below is their sports bio for context: ${bio}.

// We have also generated a detailed video review report, including key timestamps, observations, and actionable feedback: ${answer}.

// Based on the video, the athlete's background, and the review report, please create a comprehensive and engaging narration. The narration should:
// - Provide a clear, unified analysis of the athlete's performance.
// - Highlight overall impressions, key moments, strengths, and areas for improvement.
// - Include specific references to notable plays and timestamps where appropriate.
// - Deliver constructive, motivational feedback that resonates with athletes, coaches, and scouts alike.
// - Be engaging and dynamic, as it will be converted to speech using Elevenlabs TTS.

// Your narration should blend in-depth analysis with encouraging commentary, helping the athlete understand their performance and inspire further improvement.
// `;

const promptComment = `
An athlete has submitted a video for film study to boost their performance. Below is their sports bio for context: ${bio}.
There's no need to repeat this information in the narration - you can reference specific parts about the bio in the narration
Just not all of it in a single sentence

We also have a detailed video review report, including key timestamps, observations, and actionable feedback: ${answer}.

The video is also provided for your additional context and reference

Try to identify if the video is of a game or training practice - use this additional information to help inform you on the purpose of the video
To give you a better understanding on how to deliver your narration
Always double check with the video when referencing timestamps before giving out feedback. 

Using this information, please craft an engaging and conversational narration that feels personal and warm. Begin with a friendly, inviting introduction—imagine you're speaking directly to the athlete in a relaxed, upbeat tone similar to a popular YouTube video. Your narration should:
- Start with a genuine greeting that immediately pulls the listener in.
- Clearly explain the purpose of the review and set an encouraging tone.
- Seamlessly integrate the athlete’s bio, the video insights, and key feedback into a cohesive commentary.
- Highlight important moments (with timestamps) while blending technical insights with relatable, everyday language.
- Offer constructive (you are allowed to be brutally honest), motivational feedback that inspires the athlete to keep improving.

Keep the narration natural and flowing, as it will be converted to speech using Elevenlabs TTS. The goal is to provide an analysis that feels both professional and approachable, resonating with athletes, coaches, and scouts alike. Make the narration as long and comprehensive as possible.
`;


    const resultComment = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType, // "video/mp4"
          fileUri: file.uri,
        },
      },
      {
        text: promptComment,
      },
    ]);

    // Retrieve the generated text.
    const commentary = resultComment.response.text();
    console.log("\n");
    console.log("\n");
    console.log("Narration complete:", commentary);

    // Delete the video from the File API now that we're done.
    await fileManager.deleteFile(fileName);
    console.log(`Deleted ${uploadResponse.file.displayName}`);

    // Return the generated answer.
    return NextResponse.json({ answer: commentary }, { status: 200 });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
