// File: /app/api/video/route.ts (or /pages/api/video.ts)
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ElevenLabsClient } from "elevenlabs";
import { createWriteStream, promises as fsPromises } from "fs";
import { v4 as uuid } from "uuid";

// Helper function to pause execution for a given number of milliseconds.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates an audio file from the provided text using ElevenLabs TTS.
 * Returns the generated file name.
 */

const tts = `Hey Maximilian! What's up, man? Awesome to get a look at your practice footage. I've gone through the whole video, taking notes, and I'm ready to break it down with you. The whole point here is to find those little things you can tweak to really level up your game. We're going to find those little gold nuggets that'll take you from good to great.

So, first off, the overall vibe is really positive. You've clearly got the basics down, you're embracing that butterfly style, which is perfect for a tall goalie like yourself. And you're in that crucial development stage – every goalie goes through this, it’s all about refining those skills. We’re not looking for perfection. We're going for that constant improvement.

Let's talk stance and positioning first, because that's your foundation, right? Throughout the practice, you've got that nice, solid butterfly – pads creating a wall, glove hand up and active, and a decent job staying square to the shooter. Really good stuff there. But, like any goalie, there's always room to grow. One thing I noticed is your posture – sometimes you get a little bit hunched over. You have that great height, 6'2, we need to use that! Think about staying taller in your butterfly, keeping that chest up. It'll help you see over traffic, and you'll cover more of the top of the net. It's a simple adjustment, but it makes a huge difference.

Another small thing about the stance – your butterfly width. Sometimes, it’s spot-on, and other times you bring those knees in a bit. Consistent, wide butterfly, you're a wall. Get that width down and you'll shut down even more of that net. Also, and this is super common, your glove hand dips down a little, especially right after you make a save. Keep that glove up and out – it's your best friend out there! And that stick, make sure that's resting flat on the ice.

Moving on to, well, movement! Throughout this video, you've got those shuffles down, moving side-to-side, tracking the puck. You're getting into that butterfly nice and quick, too. But, let's make those shuffles even smoother. They're a little bit choppy right now. Think about using your edges – really feeling that ice – for smooth, controlled lateral movements. This helps you keep your balance, and you'll be ready for that next shot way faster. And while we didn't see a ton of big movements, those T-pushes are key. Stronger T-pushes mean you're exploding across the crease, covering those posts like lightning.

The last item with movement, you get tall after making a save. Try to not pop up too much - we need to still play the puck, even after making the save.

Now, let's get into puck tracking and reacting. You're clearly locked in on the puck, your eyes are following it, and your reaction time is pretty good for your age. No doubt about it. But, here's a pro tip – lead with your head and eyes. Your head should be the first thing moving towards the puck, then your body follows. It sounds small, but it shaves off precious milliseconds and boosts your tracking. The drills in the video are pretty predictable, which is fine for practice, but in a real game, you need that anticipation. Start reading the play, thinking about what the shooter might do, where that puck might go before it even leaves their stick. It's like playing chess, not checkers – always thinking a few steps ahead.

Okay, save execution time! You're using that butterfly to block shots – you've got some good pad saves in there. And you're not afraid to challenge shooters, coming out a bit – love that aggressiveness! But, let's talk rebound control. This is a big one for every goalie, no matter how good they are. A lot of your saves are popping right back out into the slot. We need to redirect those rebounds. Think about angling your pads slightly outwards, sending those pucks into the corners or out of danger. And work on having "softer" hands – absorbing the puck with your glove and blocker, instead of just batting it away. Your stick is your other best friend – use it to steer those rebounds away from trouble.

On the five-hole – make absolutely sure your stick and pads are completely sealing that up when you're in the butterfly. And with those glove saves, practice making them clean catches. Really "look" the puck all the way into your glove, tracking it right into the pocket.

Finally, that post-save recovery. You're getting back up pretty fast, which is great. But, right after you make a save, you have to locate that puck and be aware of any other players sneaking in. Scan the ice, find that loose puck, and be ready for anything. And instead of just standing straight up, work on a more controlled recovery – staying low, using those edges, and being ready for the next shot. Think "low and controlled," not "pop-up."

So, you might be thinking, "That's a lot!" But don't worry, we've got some awesome drills to work on this. For that posture, practice your stance in front of a mirror, focusing on staying tall, wide butterfly, perfect glove and stick. Wall sits in your gear will build that leg strength. And have a coach or teammate just keep reminding you, "Head up!" during practice.

For movement, get a shuffle ladder out there – practice controlled shuffles, focus on those edges. Set up some cones and do T-pushes and shuffles between them, going for speed and efficiency. And add some "quick feet" drills – short bursts of shuffling, then dropping into that butterfly.

To improve that puck tracking, have your coach shoot two pucks in quick succession – really challenge your eyes. Get them to shoot pucks that deflect off sticks or boards – that'll force you to adjust. And even off the ice, you can do vision training exercises to boost your eye tracking.

For rebound control, it's all about practice. Have your coach shoot pucks at specific angles, forcing you to direct those rebounds. Shoot pucks at your glove and blocker, focusing on absorbing them. And use your stick to steer rebounds in practice – make it second nature.

And for that post-save game, after you make a save, have your coach immediately shoot another puck or put a puck somewhere else – forcing you to recover fast. You can even have them yell out a number or color, and you have to locate that object – it'll sharpen your awareness.

Oh, and one last thing that's super important – you're 6'2" and 148 pounds. We need to get you in the gym and get that weight up. Strength and conditioning are going to be huge for you. It's not just about size, it's about power and explosiveness.

Look, Maximilian, you've got the raw talent. You've got that foundation. Now it's all about putting in the work, focusing on those little details, and constantly pushing yourself. Consistent coaching, consistent feedback, and you putting in the effort – that's the recipe for success. Keep grinding, keep learning, and you're going to be an awesome goalie. I'm excited to see your progress!`

const createAudioFileFromText = async (text: string): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        return reject(new Error("ElevenLabs API key is not defined"));
      }
      // Initialize the ElevenLabs client.
      const client = new ElevenLabsClient({ apiKey: elevenLabsApiKey });
      // Generate the audio stream.
      // Here we use voice 'Rachel' and model_id 'eleven_turbo_v2_5' as per your documentation.
      const audioStream = await client.generate({
        voice: "Eric",
        model_id: "eleven_turbo_v2_5",
        text,
      });
      // Generate a unique file name.
      const fileName = `${uuid()}.mp3`;
      const fileStream = createWriteStream(fileName);
      audioStream.pipe(fileStream);
      fileStream.on("finish", () => resolve(fileName));
      fileStream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
};

export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body and extract athlete bio.
    const body = await req.json();
    const { bio } = body;
    if (!bio) {
      return NextResponse.json(
        { error: "Athlete's bio is missing" },
        { status: 400 }
      );
    }

    // Define the prompt for the film study analysis.
    const promptText = `An athlete has submitted a video for film study to improve their performance.
Below is their sports bio information for context: ${bio}. Please perform a comprehensive analysis of the video,
highlighting key moments, strengths, and areas for improvement. Your review should focus on aspects such as technique, strategy, execution,
and overall performance, and offer actionable feedback that the athlete can use to enhance their skills and development.`;

    // Retrieve the Gemini API key from environment variables.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not defined" },
        { status: 500 }
      );
    }

    // Initialize the File API manager.
    const fileManager = new GoogleAIFileManager(apiKey);

    // Define the local path to your video file.
    // In this example, the video is located at "public/GreatMax.mov".
    const videoFilePath = path.join(process.cwd(), "public", "LucasGraet.mov");

    // Upload the video file.
    const uploadResponse = await fileManager.uploadFile(videoFilePath, {
      mimeType: "video/mov",
      displayName: "Graet",
    });
    console.log(
      `Uploaded file ${uploadResponse.file.displayName} as: ${uploadResponse.file.uri}`
    );
    const fileName = uploadResponse.file.name;

    // Poll every 10 seconds to check the file's processing state.
    let file = await fileManager.getFile(fileName);
    while (file.state === FileState.PROCESSING) {
      console.log("Processing video file, waiting 10 seconds...");
      await sleep(10_000);
      file = await fileManager.getFile(fileName);
    }

    if (file.state === FileState.FAILED) {
      console.error("Video processing failed.");
      return NextResponse.json(
        { error: "Video processing failed." },
        { status: 500 }
      );
    }
    console.log(
      `File ${file.displayName} is ready for inference as ${file.uri}`
    );

    // Initialize the Gemini generative AI client.
    const genAI = new GoogleGenerativeAI(apiKey);

    // Choose a Gemini model.
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Generate the film study report.
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      {
        text: promptText,
      },
    ]);
    const answer = result.response.text();
    console.log("Film Study Report complete:", answer);

    // Define the prompt for generating the narration commentary.
    const promptComment = `
An athlete has submitted a video for film study to boost their performance. Below is their sports bio for context: ${bio}.
There's no need to repeat this information in the narration - you can reference specific parts about the bio in the narration.
We also have a detailed video review report, including key timestamps, observations, and actionable feedback: ${answer}.
The video is also provided for your additional context and reference.
Try to identify if the video is of a game or training practice - use this additional information to help inform you on the purpose of the video.
Always double check with the video when referencing timestamps before giving out feedback.
Using this information, please craft an engaging and conversational narration that feels personal and warm. Begin with a friendly, inviting introduction—imagine you're speaking directly to the athlete in a relaxed, upbeat tone similar to a popular YouTube video. Your narration should:
- Start with a genuine greeting that immediately pulls the listener in.
- Clearly explain the purpose of the review and set an encouraging tone.
- Seamlessly integrate the athlete’s bio, the video insights, and key feedback into a cohesive commentary.
- Highlight important moments (with timestamps) while blending technical insights with relatable, everyday language.
- Offer constructive (you are allowed to be brutally honest), motivational feedback that inspires the athlete to keep improving.
Keep the narration natural and flowing, as it will be converted to speech using ElevenLabs TTS. The goal is to provide an analysis that feels both professional and approachable, resonating with athletes, coaches, and scouts alike. Make the narration as long and comprehensive as possible.
    `;


    const promptComment2 = `
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

    // Generate the narration commentary.
    const resultComment = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      {
        text: promptComment2,
      },
    ]);

    const commentary = resultComment.response.text();
    console.log('/n')
    console.log('/n')
    console.log("Narration complete:", commentary);

    // Delete the video from the File API now that we're done.
    await fileManager.deleteFile(fileName);
    console.log(`Deleted ${uploadResponse.file.displayName}`);

    // Generate the audio file from the commentary using ElevenLabs TTS.
    const audioFileName = await createAudioFileFromText(commentary);
    console.log("Audio file created:", audioFileName);

    // Read the generated audio file into a buffer.
    const audioBuffer = await fsPromises.readFile(audioFileName);

    // Optionally, delete the temporary audio file from disk.
    await fsPromises.unlink(audioFileName);

    // Return the audio file as a downloadable response.
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename=${audioFileName}`,
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

